-- S10-01: Direct-client identity, optional organizations, readiness, and invitation administration.
-- Reference: dev-docs/specs/s10/s10-01-production-readiness-foundation-and-task-detail-implementation-spec.md
--
-- Forward-only source migration. This intentionally does not create browser-facing
-- invitation lifecycle APIs (S10-02), archive/account/bug/provider work, or task-detail
-- projections. Apply only after review through the separately authorized Supabase path.

begin;

-- Fail before adding identity indexes if existing active rows violate their
-- predicates. Counts only avoid exposing contact identities in migration errors.
do $preflight$
declare
  v_duplicate_organization_email_groups integer;
  v_duplicate_direct_email_groups integer;
  v_duplicate_profile_binding_groups integer;
begin
  select count(*) into v_duplicate_organization_email_groups
  from (
    select 1
    from public.client_contacts
    where client_id is not null and deleted_at is null
    group by client_id, email
    having count(*) > 1
  ) duplicate_groups;

  select count(*) into v_duplicate_direct_email_groups
  from (
    select 1
    from public.client_contacts
    where client_id is null and deleted_at is null
    group by email
    having count(*) > 1
  ) duplicate_groups;

  select count(*) into v_duplicate_profile_binding_groups
  from (
    select 1
    from public.client_contacts
    where profile_id is not null and deleted_at is null
    group by profile_id
    having count(*) > 1
  ) duplicate_groups;

  if v_duplicate_organization_email_groups > 0
    or v_duplicate_direct_email_groups > 0
    or v_duplicate_profile_binding_groups > 0 then
    raise exception
      'Cannot create client contact identity indexes: duplicate active organization-email groups %, direct-email groups %, profile-binding groups %',
      v_duplicate_organization_email_groups,
      v_duplicate_direct_email_groups,
      v_duplicate_profile_binding_groups;
  end if;
end;
$preflight$;

-- -----------------------------------------------------------------------------
-- 1. Contacts are people; an organization is an optional association.
-- -----------------------------------------------------------------------------
alter table public.client_contacts
  alter column client_id drop not null;

-- An organization can have one active primary contact. Direct contacts cannot be
-- primary for a non-existent organization.
drop index if exists public.client_primary_contact_uidx;
create unique index client_primary_contact_uidx
  on public.client_contacts (client_id)
  where client_id is not null and is_primary = true and deleted_at is null;

-- Keep organization-email identities unique and prevent duplicate active direct
-- identities. The partial predicates deliberately permit historical soft-deleted
-- records and the same person to move from a direct contact to an organization.
create unique index client_contacts_active_client_email_uidx
  on public.client_contacts (client_id, email)
  where client_id is not null and deleted_at is null;

create unique index client_contacts_active_direct_email_uidx
  on public.client_contacts (email)
  where client_id is null and deleted_at is null;

create unique index client_contacts_active_profile_uidx
  on public.client_contacts (profile_id)
  where profile_id is not null and deleted_at is null;

alter table public.client_contacts
  drop constraint if exists client_contacts_direct_primary_ck;
alter table public.client_contacts
  add constraint client_contacts_direct_primary_ck
  check (client_id is not null or is_primary = false);

-- A direct client invitation needs a stable person target. Legacy invitations
-- without contact_id remain accepted only against their matching organization
-- contact; this prevents a legacy organization invite from binding a direct user.
alter table public.invite_tokens
  add column if not exists contact_id uuid
  references public.client_contacts(id) on delete restrict;

alter table public.invite_tokens
  drop constraint if exists invite_tokens_contact_role_ck;
alter table public.invite_tokens
  add constraint invite_tokens_contact_role_ck
  check (contact_id is null or role = 'client');

create index invite_tokens_contact_id_idx
  on public.invite_tokens (contact_id)
  where contact_id is not null;

-- Bind pending legacy client invitations only where the recipient's active
-- contact is unambiguous. Do not guess or reconcile ambiguous historical data.
with unambiguous_legacy_contacts as (
  select i.id as invite_id, min(c.id::text)::uuid as contact_id
  from public.invite_tokens i
  join public.client_contacts c
    on c.client_id is not distinct from i.client_id
    and c.email = i.email
    and c.deleted_at is null
  where i.status = 'pending'
    and i.role = 'client'
    and i.contact_id is null
  group by i.id
  having count(*) = 1
)
update public.invite_tokens i
set contact_id = legacy.contact_id
from unambiguous_legacy_contacts legacy
where i.id = legacy.invite_id;

do $legacy_invite_preflight$
declare
  v_pending_legacy_client_invites_without_contact integer;
begin
  select count(*) into v_pending_legacy_client_invites_without_contact
  from public.invite_tokens
  where status = 'pending'
    and role = 'client'
    and contact_id is null;

  if v_pending_legacy_client_invites_without_contact > 0 then
    raise exception
      'Cannot migrate pending legacy client invitations: % invitation(s) lack an unambiguous active contact binding',
      v_pending_legacy_client_invites_without_contact;
  end if;
end;
$legacy_invite_preflight$;

-- A direct contact may be associated with a project before the person has an
-- account. This relationship is identity/readiness metadata only: it never grants
-- project membership, RLS visibility, or client access.
create table public.project_client_contacts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  contact_id uuid not null references public.client_contacts(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index project_client_contacts_active_uidx
  on public.project_client_contacts (project_id, contact_id)
  where deleted_at is null;
create index project_client_contacts_contact_idx
  on public.project_client_contacts (contact_id)
  where deleted_at is null;

alter table public.project_client_contacts enable row level security;

-- No browser role reads or writes identity associations directly. S10-01 commands
-- below are the sole command surface; future S10-02 UI consumes projections.

-- -----------------------------------------------------------------------------
-- 2. Admin/PM authority is global; PM membership capacities are metadata only.
-- -----------------------------------------------------------------------------
create or replace function private.is_project_pm(project_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select private.is_pm();
$function$;

create or replace function private.is_project_lead(project_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select private.is_pm();
$function$;

alter function private.is_project_pm(uuid) owner to postgres;
alter function private.is_project_lead(uuid) owner to postgres;
revoke all on function private.is_project_pm(uuid) from public, anon;
revoke all on function private.is_project_lead(uuid) from public, anon;
grant execute on function private.is_project_pm(uuid) to authenticated;
grant execute on function private.is_project_lead(uuid) to authenticated;

-- Reconcile direct policies that formerly required a PM to be a member of the
-- particular project. Operator/client self-access remains unchanged.
drop policy if exists projects_select_policy on public.projects;
create policy projects_select_policy on public.projects
for select to authenticated
using (
  deleted_at is null
  and ((select private.is_pm()) or (select private.is_project_member(id)))
);

drop policy if exists projects_update_policy on public.projects;
create policy projects_update_policy on public.projects
for update to authenticated
using (deleted_at is null and (select private.is_pm()))
with check (deleted_at is null and (select private.is_pm()));

drop policy if exists project_members_select_policy on public.project_members;
create policy project_members_select_policy on public.project_members
for select to authenticated
using (
  deleted_at is null
  and ((select private.is_pm()) or user_id = (select auth.uid()))
);

drop policy if exists project_members_insert_policy on public.project_members;
create policy project_members_insert_policy on public.project_members
for insert to authenticated
with check ((select private.is_pm()));

drop policy if exists project_members_update_policy on public.project_members;
create policy project_members_update_policy on public.project_members
for update to authenticated
using ((select private.is_pm()))
with check ((select private.is_pm()));

drop policy if exists project_members_delete_policy on public.project_members;
create policy project_members_delete_policy on public.project_members
for delete to authenticated
using ((select private.is_pm()));

-- Contacts are an Admin/PM-only directory. In particular, being a client on a
-- project or being associated with an organization does not expose other contacts.
drop policy if exists client_contacts_select_policy on public.client_contacts;
create policy client_contacts_select_policy on public.client_contacts
for select to authenticated
using (deleted_at is null and (select private.is_pm()));

drop policy if exists client_contacts_insert_policy on public.client_contacts;
create policy client_contacts_insert_policy on public.client_contacts
for insert to authenticated
with check ((select private.is_pm()));

drop policy if exists client_contacts_update_policy on public.client_contacts;
create policy client_contacts_update_policy on public.client_contacts
for update to authenticated
using (deleted_at is null and (select private.is_pm()))
with check (deleted_at is null and (select private.is_pm()));

-- Organization information is management metadata, not a client directory.
drop policy if exists clients_select_policy on public.clients;
create policy clients_select_policy on public.clients
for select to authenticated
using (deleted_at is null and (select private.is_pm()));

-- Raw token hashes have no browser-facing table policy. The authenticated
-- acceptance command below remains available through SECURITY DEFINER; S10-02
-- must add narrow lifecycle commands/projections instead of restoring table access.
drop policy if exists invite_tokens_select_policy on public.invite_tokens;
drop policy if exists invite_tokens_insert_policy on public.invite_tokens;
drop policy if exists invite_tokens_update_policy on public.invite_tokens;

-- client_project_view must still be usable by a valid client member after the
-- organization table ceases to be client-readable. A left join preserves the
-- existing DTO and returns no organization data when RLS excludes it.
create or replace view public.client_project_view
with (security_invoker = true)
as
select
  p.id,
  p.client_id,
  c.display_name as client_name,
  p.name,
  p.client_scope,
  p.status,
  p.deadline_at,
  p.drive_folder_url,
  p.completed_at,
  p.archived_at,
  (
    select max(d.last_activity_at)
    from public.deliverables d
    where d.project_id = p.id
      and d.deleted_at is null
  ) as last_deliverable_activity_at,
  p.created_at
from public.projects p
left join public.clients c
  on c.id = p.client_id
  and c.deleted_at is null
where p.project_type = 'client'
  and p.deleted_at is null;

-- -----------------------------------------------------------------------------
-- 3. Client readiness accepts a linked direct or organization contact, not an
--    organization universally. Membership and identity association are distinct.
-- -----------------------------------------------------------------------------
alter table public.projects
  drop constraint if exists projects_type_client_ck;
alter table public.projects
  add constraint projects_type_client_ck check (
    (project_type = 'client')
    or (project_type = 'internal' and client_id is null)
  );

create or replace function private.project_has_client_readiness(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select exists (
    select 1
    from public.projects project_row
    join public.project_members member_row
      on member_row.project_id = project_row.id
      and member_row.member_type = 'client'
      and member_row.deleted_at is null
    join public.profiles profile_row
      on profile_row.id = member_row.user_id
      and profile_row.role = 'client'
      and profile_row.is_active = true
      and profile_row.deleted_at is null
    join public.client_contacts contact_row
      on contact_row.profile_id = member_row.user_id
      and contact_row.deleted_at is null
    where project_row.id = p_project_id
      and project_row.project_type = 'client'
      and project_row.deleted_at is null
      and (
        (
          contact_row.client_id is null
          and exists (
            select 1
            from public.project_client_contacts direct_association
            where direct_association.project_id = project_row.id
              and direct_association.contact_id = contact_row.id
              and direct_association.deleted_at is null
          )
        )
        or (
          contact_row.client_id is not null
          and contact_row.client_id = project_row.client_id
        )
      )
  );
$function$;

create or replace function private.validate_client_project_readiness()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_project_id uuid;
  v_contact_id uuid;
  v_profile_id uuid;
  v_old_client_id uuid;
  v_new_client_id uuid;
begin
  if tg_table_name = 'projects' then
    v_project_id := case when tg_op = 'delete' then old.id else new.id end;
    if exists (
      select 1 from public.projects p
      where p.id = v_project_id
        and p.deleted_at is null
        and p.project_type = 'client'
        and p.status <> 'planning'
        and p.status <> 'cancelled'
        and not private.project_has_client_readiness(p.id)
    ) then
      raise exception 'Active non-planning client project % requires an active Client member linked to an associated direct contact or matching organization contact', v_project_id;
    end if;
    return null;
  end if;

  if tg_table_name = 'project_members' then
    v_project_id := case when tg_op = 'delete' then old.project_id else new.project_id end;
    if exists (
      select 1 from public.projects p
      where p.id = v_project_id
        and p.deleted_at is null
        and p.project_type = 'client'
        and p.status <> 'planning'
        and p.status <> 'cancelled'
        and not private.project_has_client_readiness(p.id)
    ) then
      raise exception 'Active non-planning client project % requires an active Client member linked to an associated direct contact or matching organization contact', v_project_id;
    end if;
    return null;
  end if;

  if tg_table_name = 'project_client_contacts' then
    v_project_id := case when tg_op = 'delete' then old.project_id else new.project_id end;
    if exists (
      select 1 from public.projects p
      where p.id = v_project_id
        and p.deleted_at is null
        and p.project_type = 'client'
        and p.status <> 'planning'
        and p.status <> 'cancelled'
        and not private.project_has_client_readiness(p.id)
    ) then
      raise exception 'Active non-planning client project % requires an active Client member linked to an associated direct contact or matching organization contact', v_project_id;
    end if;
    return null;
  end if;

  if tg_table_name = 'profiles' then
    v_profile_id := new.id;
    for v_project_id in
      select distinct p.id
      from public.projects p
      join public.project_members pm
        on pm.project_id = p.id
        and pm.user_id = v_profile_id
        and pm.deleted_at is null
      where p.deleted_at is null
        and p.project_type = 'client'
        and p.status not in ('planning', 'cancelled')
    loop
      if not private.project_has_client_readiness(v_project_id) then
        raise exception 'Active non-planning client project % requires an active Client member linked to an associated direct contact or matching organization contact', v_project_id;
      end if;
    end loop;
    return null;
  end if;

  -- A contact update can affect every project with its organization or a direct
  -- association. Check the old and new identities at deferred commit time.
  v_contact_id := case when tg_op = 'delete' then old.id else new.id end;
  if tg_op <> 'delete' then
    v_new_client_id := new.client_id;
  end if;
  if tg_op <> 'insert' then
    v_old_client_id := old.client_id;
  end if;
  for v_project_id in
    select distinct p.id
    from public.projects p
    left join public.project_client_contacts pcc
      on pcc.project_id = p.id
      and pcc.deleted_at is null
    where p.deleted_at is null
      and p.project_type = 'client'
      and p.status not in ('planning', 'cancelled')
      and (
        p.client_id = v_new_client_id
        or p.client_id = v_old_client_id
        or pcc.contact_id = v_contact_id
      )
  loop
    if not private.project_has_client_readiness(v_project_id) then
      raise exception 'Active non-planning client project % requires an active Client member linked to an associated direct contact or matching organization contact', v_project_id;
    end if;
  end loop;

  return null;
end;
$function$;

alter function private.project_has_client_readiness(uuid) owner to postgres;
alter function private.validate_client_project_readiness() owner to postgres;
revoke all on function private.project_has_client_readiness(uuid) from public, anon;
revoke all on function private.validate_client_project_readiness() from public, anon;

create constraint trigger s10_client_project_readiness_projects_ct
  after insert or update or delete on public.projects
  deferrable initially deferred
  for each row execute function private.validate_client_project_readiness();
create constraint trigger s10_client_project_readiness_members_ct
  after insert or update or delete on public.project_members
  deferrable initially deferred
  for each row execute function private.validate_client_project_readiness();
create constraint trigger s10_client_project_readiness_contacts_ct
  after insert or update or delete on public.client_contacts
  deferrable initially deferred
  for each row execute function private.validate_client_project_readiness();
create constraint trigger s10_client_project_readiness_associations_ct
  after insert or update or delete on public.project_client_contacts
  deferrable initially deferred
  for each row execute function private.validate_client_project_readiness();
create constraint trigger s10_client_project_readiness_profiles_ct
  after update of role, is_active, deleted_at on public.profiles
  deferrable initially deferred
  for each row execute function private.validate_client_project_readiness();

-- Retain the established membership cardinality checks but replace the former
-- organization-dependent client requirement with the direct-capable readiness
-- predicate enforced by the deferred triggers above.
create or replace function private.validate_project_memberships()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_target_project_id uuid;
  v_proj record;
  v_primary_leads integer;
  v_leads integer;
  v_client_members integer;
  v_total_members integer;
begin
  if tg_table_name = 'projects' then
    v_target_project_id := case when tg_op = 'delete' then old.id else new.id end;
  else
    v_target_project_id := case when tg_op = 'delete' then old.project_id else new.project_id end;
  end if;

  for v_proj in
    select p.id, p.project_type, p.status, p.deleted_at
    from public.projects p
    where p.id = v_target_project_id
      and p.deleted_at is null
      and p.status <> 'cancelled'
  loop
    select
      count(*) filter (where member_type = 'pm_lead' and is_primary = true),
      count(*) filter (where member_type = 'pm_lead'),
      count(*) filter (where member_type = 'client'),
      count(*)
    into v_primary_leads, v_leads, v_client_members, v_total_members
    from public.project_members
    where project_id = v_proj.id
      and deleted_at is null;

    if tg_table_name = 'project_members' or v_total_members > 0 then
      if v_leads < 1 then
        raise exception 'Active project % must have at least one active PM Lead', v_proj.id;
      end if;
      if v_primary_leads <> 1 then
        raise exception 'Active project % must have exactly one active primary PM Lead (found %)', v_proj.id, v_primary_leads;
      end if;
    end if;
    if v_proj.project_type = 'internal' and v_client_members > 0 then
      raise exception 'Internal project % cannot have active Client members (found %)', v_proj.id, v_client_members;
    end if;
  end loop;

  if tg_table_name = 'project_members' and tg_op in ('insert', 'update') and new.deleted_at is null then
    declare
      v_role public.app_role;
    begin
      select role into v_role from public.profiles where id = new.user_id;
      if new.member_type in ('pm_lead', 'pm_watcher') and v_role not in ('pm', 'admin') then
        raise exception 'Member % with role % cannot be assigned PM metadata capacity', new.user_id, v_role;
      elsif new.member_type = 'operator' and v_role not in ('operator', 'admin') then
        raise exception 'Member % with role % cannot be assigned capacity operator', new.user_id, v_role;
      elsif new.member_type = 'client' and v_role <> 'client' then
        raise exception 'Member % with role % cannot be assigned capacity client', new.user_id, v_role;
      end if;
    end;
  end if;

  return null;
end;
$function$;

-- Deliverable validation previously used projects.client_id as the universal
-- readiness gate. Keep all workflow/deadline checks, but use verified readiness.
create or replace function private.sync_and_validate_deliverable()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_task record;
  v_project record;
  v_assignee_member_type public.project_member_type;
begin
  select t.project_id, t.task_type, t.deleted_at
  into v_task
  from public.tasks t
  where t.id = new.task_id;

  if not found or v_task.deleted_at is not null then
    raise exception 'Deliverable task % not found or deleted', new.task_id;
  end if;
  new.project_id := v_task.project_id;

  select p.project_type, p.status, p.deleted_at
  into v_project
  from public.projects p
  where p.id = new.project_id;
  if not found or v_project.deleted_at is not null then
    raise exception 'Deliverable project % not found or deleted', new.project_id;
  end if;
  if v_project.status = 'cancelled' then
    raise exception 'Deliverables cannot be created for cancelled project %', new.project_id;
  end if;

  select pm.member_type
  into v_assignee_member_type
  from public.project_members pm
  join public.profiles pr on pr.id = pm.user_id
  where pm.project_id = new.project_id
    and pm.user_id = new.assignee_id
    and pm.deleted_at is null
    and pr.deleted_at is null
    and pr.is_active = true;
  if not found then
    raise exception 'Assignee % is not an active member of project %', new.assignee_id, new.project_id;
  end if;

  if v_task.task_type = 'client_request' then
    if v_project.project_type <> 'client' or not private.project_has_client_readiness(new.project_id) then
      raise exception 'Client-request deliverables require a client project with verified direct-or-organization client readiness';
    end if;
    if new.workflow_type <> 'client_submission' then
      raise exception 'Client-request tasks require client-submission deliverables';
    end if;
    if v_assignee_member_type <> 'client' then
      raise exception 'Client-request deliverables must be assigned to an active Client member';
    end if;
    if new.submission_deadline_at is null
      or new.internal_review_deadline_at is not null
      or new.client_delivery_deadline_at is not null then
      raise exception 'Client-submission deliverables require only submission_deadline_at';
    end if;
  else
    if new.workflow_type <> 'production' then
      raise exception 'Internal-work tasks require production deliverables';
    end if;
    if v_assignee_member_type not in ('pm_lead', 'pm_watcher', 'operator') then
      raise exception 'Internal-work deliverables must be assigned to an active PM or Operator';
    end if;
    if new.internal_review_deadline_at is null or new.submission_deadline_at is not null then
      raise exception 'Production deliverables require internal_review_deadline_at and forbid submission_deadline_at';
    end if;
    if v_project.project_type = 'client' then
      if not private.project_has_client_readiness(new.project_id) then
        raise exception 'Client-project production deliverables require verified direct-or-organization client readiness';
      end if;
      if new.client_delivery_deadline_at is null
        or new.client_delivery_deadline_at < new.internal_review_deadline_at then
        raise exception 'Client-project production deliverables require client_delivery_deadline_at on or after internal_review_deadline_at';
      end if;
    elsif new.client_delivery_deadline_at is not null then
      raise exception 'Internal-project production deliverables cannot have client_delivery_deadline_at';
    end if;
  end if;

  update public.tasks set has_deliverables = true
  where id = new.task_id and has_deliverables = false;
  return new;
end;
$function$;

alter function private.sync_and_validate_deliverable() owner to postgres;
revoke all on function private.sync_and_validate_deliverable() from public, anon;

-- -----------------------------------------------------------------------------
-- 4. Narrow Admin/PM contact and project-association command/projection surface.
-- -----------------------------------------------------------------------------
create or replace function public.save_client_contact(
  p_contact_id uuid,
  p_full_name text,
  p_email text,
  p_phone_e164 text default null,
  p_job_title text default null,
  p_client_id uuid default null,
  p_is_primary boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_contact_id uuid;
  v_operation text;
begin
  if v_actor_id is null or not private.is_pm() then
    raise exception 'Active Admin or PM authority required';
  end if;
  if coalesce(char_length(btrim(p_full_name)), 0) not between 1 and 120 then
    raise exception 'Contact full name must contain 1 to 120 characters';
  end if;
  if coalesce(char_length(btrim(p_email)), 0) not between 3 and 320
    or position('@' in btrim(p_email)) = 0 then
    raise exception 'A valid contact email is required';
  end if;
  if p_job_title is not null and char_length(btrim(p_job_title)) > 120 then
    raise exception 'Contact job title must not exceed 120 characters';
  end if;
  if p_is_primary and p_client_id is null then
    raise exception 'A direct contact cannot be an organization primary contact';
  end if;
  if p_client_id is not null and not exists (
    select 1 from public.clients c where c.id = p_client_id and c.deleted_at is null
  ) then
    raise exception 'Organization is not available';
  end if;

  if p_contact_id is null then
    insert into public.client_contacts (
      client_id, full_name, email, phone_e164, job_title, is_primary, created_by, updated_by
    ) values (
      p_client_id, btrim(p_full_name), btrim(p_email)::extensions.citext,
      nullif(btrim(p_phone_e164), ''), nullif(btrim(p_job_title), ''), p_is_primary,
      v_actor_id, v_actor_id
    ) returning id into v_contact_id;
    v_operation := 'contact_created';
  else
    perform 1 from public.client_contacts where id = p_contact_id and deleted_at is null for update;
    if not found then
      raise exception 'Contact is not available';
    end if;
    update public.client_contacts
    set client_id = p_client_id,
        full_name = btrim(p_full_name),
        email = btrim(p_email)::extensions.citext,
        phone_e164 = nullif(btrim(p_phone_e164), ''),
        job_title = nullif(btrim(p_job_title), ''),
        is_primary = p_is_primary,
        updated_by = v_actor_id,
        updated_at = now()
    where id = p_contact_id;
    v_contact_id := p_contact_id;
    v_operation := 'contact_updated';
  end if;

  insert into public.audit_logs (entity_type, entity_id, action, changed_fields, actor_id, actor_role)
  values (
    'client', v_contact_id, v_operation,
    jsonb_build_object('contact_id', v_contact_id, 'organization_id', p_client_id, 'is_direct', p_client_id is null),
    v_actor_id, private.current_user_role()
  );
  return v_contact_id;
end;
$function$;

create or replace function public.set_project_client_contact(
  p_project_id uuid,
  p_contact_id uuid,
  p_associated boolean
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_project public.projects%rowtype;
begin
  if v_actor_id is null or not private.is_pm() then
    raise exception 'Active Admin or PM authority required';
  end if;
  select * into v_project from public.projects
  where id = p_project_id and deleted_at is null for update;
  if not found or v_project.project_type <> 'client' then
    raise exception 'Client project is not available';
  end if;
  perform 1 from public.client_contacts
  where id = p_contact_id and deleted_at is null for update;
  if not found then
    raise exception 'Contact is not available';
  end if;

  if p_associated then
    insert into public.project_client_contacts (project_id, contact_id, created_by)
    values (p_project_id, p_contact_id, v_actor_id)
    on conflict (project_id, contact_id) where deleted_at is null do nothing;
  else
    update public.project_client_contacts
    set deleted_at = now(), updated_at = now()
    where project_id = p_project_id and contact_id = p_contact_id and deleted_at is null;
  end if;

  insert into public.audit_logs (entity_type, entity_id, project_id, action, changed_fields, actor_id, actor_role)
  values (
    'project', p_project_id, p_project_id, 'project_client_contact_association_changed',
    jsonb_build_object('contact_id', p_contact_id, 'associated', p_associated),
    v_actor_id, private.current_user_role()
  );
  return p_associated;
end;
$function$;

create or replace function public.list_client_contacts_for_administration()
returns table (
  id uuid, client_id uuid, profile_id uuid, full_name text, email text,
  phone_e164 text, job_title text, is_primary boolean, created_at timestamptz, updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
begin
  if auth.uid() is null or not private.is_pm() then
    raise exception 'Active Admin or PM authority required';
  end if;
  return query
  select c.id, c.client_id, c.profile_id, c.full_name, c.email::text,
    c.phone_e164, c.job_title, c.is_primary, c.created_at, c.updated_at
  from public.client_contacts c
  where c.deleted_at is null
  order by c.full_name asc, c.id asc;
end;
$function$;

create or replace function public.list_client_organizations_for_administration()
returns table (id uuid, display_name text, slug text)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
begin
  if auth.uid() is null or not private.is_pm() then
    raise exception 'Active Admin or PM authority required';
  end if;
  return query
  select c.id, c.display_name, c.slug
  from public.clients c
  where c.deleted_at is null
  order by c.display_name asc, c.id asc;
end;
$function$;

-- -----------------------------------------------------------------------------
-- 5. Trusted acceptance: bind only the invite's exact eligible contact.
-- -----------------------------------------------------------------------------
create or replace function public.accept_invite(p_token_hash bytea)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_invite public.invite_tokens%rowtype;
  v_contact public.client_contacts%rowtype;
  v_project public.projects%rowtype;
  v_user_email extensions.citext;
  v_user_id uuid := auth.uid();
  v_existing_role public.app_role;
  v_member_type public.project_member_type;
begin
  if v_user_id is null then
    raise exception 'Authentication required to accept invite';
  end if;
  select email into v_user_email from auth.users where id = v_user_id;
  if v_user_email is null then
    raise exception 'Invitation cannot be accepted';
  end if;

  select * into v_invite from public.invite_tokens
  where token_hash = p_token_hash for update;
  if not found then
    raise exception 'Invalid or not found invitation token';
  end if;
  if v_invite.status <> 'pending' or v_invite.revoked_at is not null or v_invite.expires_at <= now() then
    if v_invite.status = 'pending' and v_invite.expires_at <= now() then
      update public.invite_tokens set status = 'expired' where id = v_invite.id;
    elsif v_invite.status = 'pending' and v_invite.revoked_at is not null then
      update public.invite_tokens set status = 'revoked' where id = v_invite.id;
    end if;
    raise exception 'Invitation cannot be accepted';
  end if;
  if v_invite.role not in ('operator', 'client')
    or lower(v_invite.email::text) <> lower(v_user_email::text) then
    raise exception 'Invitation cannot be accepted';
  end if;

  select role into v_existing_role from public.profiles where id = v_user_id for update;
  if found and v_existing_role in ('admin', 'pm') then
    raise exception 'Invitation cannot be accepted';
  end if;

  if v_invite.project_id is not null then
    select * into v_project from public.projects
    where id = v_invite.project_id and deleted_at is null for update;
    if not found then
      raise exception 'Invitation cannot be accepted';
    end if;
  end if;

  if v_invite.role = 'client' then
    if v_invite.contact_id is not null then
      select * into v_contact from public.client_contacts
      where id = v_invite.contact_id and deleted_at is null for update;
    elsif v_invite.client_id is not null then
      -- Legacy organization invitation compatibility only.
      select * into v_contact from public.client_contacts
      where client_id = v_invite.client_id
        and email = v_invite.email
        and deleted_at is null
      for update;
    else
      raise exception 'Invitation cannot be accepted';
    end if;
    if not found
      or lower(v_contact.email::text) <> lower(v_user_email::text)
      or (v_contact.profile_id is not null and v_contact.profile_id <> v_user_id) then
      raise exception 'Invitation cannot be accepted';
    end if;
    if v_invite.client_id is not null and v_contact.client_id is distinct from v_invite.client_id then
      raise exception 'Invitation cannot be accepted';
    end if;
    if v_invite.project_id is not null then
      if v_contact.client_id is null then
        if not exists (
          select 1 from public.project_client_contacts pcc
          where pcc.project_id = v_invite.project_id
            and pcc.contact_id = v_contact.id
            and pcc.deleted_at is null
        ) then
          raise exception 'Invitation cannot be accepted';
        end if;
      elsif v_project.client_id is distinct from v_contact.client_id then
        raise exception 'Invitation cannot be accepted';
      end if;
    end if;
  end if;

  insert into public.profiles (id, role, full_name, is_active)
  values (
    v_user_id, v_invite.role,
    coalesce((select raw_user_meta_data ->> 'full_name' from auth.users where id = v_user_id), split_part(v_user_email::text, '@', 1)),
    true
  )
  on conflict (id) do update
  set role = v_invite.role, is_active = true, deleted_at = null, updated_at = now();

  if v_invite.role = 'client' then
    update public.client_contacts
    set profile_id = v_user_id, updated_at = now()
    where id = v_contact.id and profile_id is null;
  end if;

  if v_invite.project_id is not null then
    v_member_type := case when v_invite.role = 'operator' then 'operator'::public.project_member_type else 'client'::public.project_member_type end;
    insert into public.project_members (project_id, user_id, member_type, created_by)
    values (v_invite.project_id, v_user_id, v_member_type, v_invite.created_by)
    on conflict do nothing;
  end if;

  update public.invite_tokens
  set status = 'accepted', accepted_at = now(), accepted_by = v_user_id
  where id = v_invite.id;

  -- Evidence contains identifiers and outcome only; it never stores the token or email.
  insert into public.audit_logs (entity_type, entity_id, project_id, action, changed_fields, actor_id, actor_role)
  values (
    'invite_token', v_invite.id, v_invite.project_id, 'invite_accepted',
    jsonb_build_object('role', v_invite.role, 'project_id', v_invite.project_id, 'client_id', v_invite.client_id, 'contact_id', v_invite.contact_id),
    v_user_id, v_invite.role
  );

  return jsonb_build_object('success', true, 'role', v_invite.role, 'project_id', v_invite.project_id, 'client_id', v_invite.client_id);
end;
$function$;

alter function public.save_client_contact(uuid, text, text, text, text, uuid, boolean) owner to postgres;
alter function public.set_project_client_contact(uuid, uuid, boolean) owner to postgres;
alter function public.list_client_contacts_for_administration() owner to postgres;
alter function public.list_client_organizations_for_administration() owner to postgres;
alter function public.accept_invite(bytea) owner to postgres;

revoke all on function public.save_client_contact(uuid, text, text, text, text, uuid, boolean) from public, anon, service_role;
revoke all on function public.set_project_client_contact(uuid, uuid, boolean) from public, anon, service_role;
revoke all on function public.list_client_contacts_for_administration() from public, anon, service_role;
revoke all on function public.list_client_organizations_for_administration() from public, anon, service_role;
revoke all on function public.accept_invite(bytea) from public, anon, service_role;

grant execute on function public.save_client_contact(uuid, text, text, text, text, uuid, boolean) to authenticated;
grant execute on function public.set_project_client_contact(uuid, uuid, boolean) to authenticated;
grant execute on function public.list_client_contacts_for_administration() to authenticated;
grant execute on function public.list_client_organizations_for_administration() to authenticated;
grant execute on function public.accept_invite(bytea) to authenticated;

commit;
