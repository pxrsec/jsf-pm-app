-- S10-04: account settings, access hygiene, stale-access reminder state, and
-- controlled bug triage. This forward migration also closes the known S10-03
-- archive visibility gaps left by the already-applied M03 migration.
--
-- Scope:
--   * all application roles: bounded self-account settings and bug submission;
--   * active Admin/PM: global, role-safe access directory and activate/deactivate;
--   * active Admin/PM: stale-access candidate/reminder-state administration;
--   * active Admin/PM: controlled bug-triage read/status updates;
--   * S10-03: complete forward archive-visibility closure across every operational
--     view, SECURITY DEFINER RPC, and trigger function enumerated in the S10-03
--     remediation gate specification.
--
-- No Auth user is deleted, banned, or modified. Deactivation is an application
-- access state only: profiles.is_active = false while deleted_at remains null.
-- No external provider dispatch, scheduler, public issue tracker, contact
-- directory, email/token projection, or browser direct-table mutation is added.

begin;

-- =============================================================================
-- SECTION 1. S10-04 types, tables, indexes, and no-direct-access posture
-- =============================================================================

create type public.bug_report_status as enum ('open', 'triaged', 'resolved', 'dismissed');

create table public.user_access_actions (
  id bigint generated always as identity primary key,
  target_user_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check (action in ('deactivated', 'reactivated')),
  actor_id uuid not null references auth.users(id) on delete restrict,
  actor_role public.app_role not null check (actor_role in ('admin', 'pm')),
  created_at timestamptz not null default now()
);

create index user_access_actions_target_created_idx
  on public.user_access_actions (target_user_id, created_at desc, id desc);

-- `inactivity_period_started_at` is deliberately initialized at M04 application
-- for all existing profiles. Pre-M04 assignment/membership end-times were never
-- recorded, so they cannot truthfully establish an earlier consecutive period.
-- From this migration onward, the trigger family below resets this state exactly
-- whenever qualifying active membership/assignment state changes.
create table public.user_access_hygiene_state (
  user_id uuid primary key references public.profiles(id) on delete restrict,
  inactivity_period_started_at timestamptz,
  notified_for_period_started_at timestamptz,
  observed_qualifying_access boolean not null default false,
  initialized_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    notified_for_period_started_at is null
    or notified_for_period_started_at = inactivity_period_started_at
  )
);

create index user_access_hygiene_state_candidate_idx
  on public.user_access_hygiene_state (inactivity_period_started_at)
  where inactivity_period_started_at is not null
    and notified_for_period_started_at is null;

create table public.stale_access_reminders (
  id bigint generated always as identity primary key,
  subject_user_id uuid not null references public.profiles(id) on delete restrict,
  inactivity_period_started_at timestamptz not null,
  decided_by uuid not null references auth.users(id) on delete restrict,
  decided_at timestamptz not null default now(),
  state text not null default 'recorded' check (state in ('recorded')),
  unique (subject_user_id, inactivity_period_started_at)
);

create table public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete restrict,
  reporter_role public.app_role not null,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  description text not null check (char_length(btrim(description)) between 1 and 5000),
  status public.bug_report_status not null default 'open',
  status_changed_by uuid references auth.users(id) on delete set null,
  status_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'open' and status_changed_at is null and status_changed_by is null)
    or (status <> 'open' and status_changed_at is not null)
  )
);

create index bug_reports_triage_queue_idx
  on public.bug_reports (status, created_at desc, id desc);
create index bug_reports_reporter_created_idx
  on public.bug_reports (reporter_id, created_at desc, id desc);

alter table public.user_access_actions enable row level security;
alter table public.user_access_hygiene_state enable row level security;
alter table public.stale_access_reminders enable row level security;
alter table public.bug_reports enable row level security;

revoke all on table public.user_access_actions from public, anon, authenticated, service_role;
revoke all on table public.user_access_hygiene_state from public, anon, authenticated, service_role;
revoke all on table public.stale_access_reminders from public, anon, authenticated, service_role;
revoke all on table public.bug_reports from public, anon, authenticated, service_role;

-- =============================================================================
-- SECTION 2. Exact post-M04 access-activity state
-- =============================================================================

create or replace function private.user_has_qualifying_access(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select exists (
    select 1
    from public.project_members pm
    join public.projects p on p.id = pm.project_id
    where pm.user_id = p_user_id
      and pm.deleted_at is null
      and p.deleted_at is null
      and p.archived_at is null
  )
  or exists (
    select 1
    from public.tasks t
    join public.projects p on p.id = t.project_id
    where t.assignee_id = p_user_id
      and t.deleted_at is null
      and t.archived_at is null
      and p.deleted_at is null
      and p.archived_at is null
  )
  or exists (
    select 1
    from public.deliverables d
    join public.tasks t on t.id = d.task_id
    join public.projects p on p.id = d.project_id
    where d.assignee_id = p_user_id
      and d.deleted_at is null
      and d.archived_at is null
      and t.deleted_at is null
      and t.archived_at is null
      and p.deleted_at is null
      and p.archived_at is null
  );
$function$;

create or replace function private.refresh_user_access_hygiene_state(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_qualifying boolean;
begin
  if p_user_id is null or not exists (select 1 from public.profiles where id = p_user_id) then
    return;
  end if;

  v_qualifying := private.user_has_qualifying_access(p_user_id);

  insert into public.user_access_hygiene_state (
    user_id,
    inactivity_period_started_at,
    notified_for_period_started_at,
    observed_qualifying_access,
    initialized_at,
    updated_at
  ) values (
    p_user_id,
    case when v_qualifying then null else now() end,
    null,
    v_qualifying,
    now(),
    now()
  )
  on conflict (user_id) do update
  set inactivity_period_started_at = case
        when v_qualifying then null
        when public.user_access_hygiene_state.observed_qualifying_access
          then now()
        else public.user_access_hygiene_state.inactivity_period_started_at
      end,
      notified_for_period_started_at = case
        when v_qualifying or public.user_access_hygiene_state.observed_qualifying_access
          then null
        else public.user_access_hygiene_state.notified_for_period_started_at
      end,
      observed_qualifying_access = v_qualifying,
      updated_at = now();
end;
$function$;

create or replace function private.refresh_access_hygiene_from_assignment_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if tg_table_name = 'project_members' then
    perform private.refresh_user_access_hygiene_state(
      case when tg_op = 'DELETE' then old.user_id else new.user_id end
    );
  elsif tg_table_name = 'tasks' then
    perform private.refresh_user_access_hygiene_state(
      case when tg_op = 'DELETE' then old.assignee_id else new.assignee_id end
    );
    if tg_op = 'UPDATE' and new.assignee_id is distinct from old.assignee_id then
      perform private.refresh_user_access_hygiene_state(old.assignee_id);
    end if;
  elsif tg_table_name = 'deliverables' then
    perform private.refresh_user_access_hygiene_state(
      case when tg_op = 'DELETE' then old.assignee_id else new.assignee_id end
    );
    if tg_op = 'UPDATE' and new.assignee_id is distinct from old.assignee_id then
      perform private.refresh_user_access_hygiene_state(old.assignee_id);
    end if;
  end if;
  return null;
end;
$function$;

create or replace function private.refresh_access_hygiene_from_project_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid;
begin
  if tg_op = 'UPDATE'
    and new.archived_at is not distinct from old.archived_at
    and new.deleted_at is not distinct from old.deleted_at then
    return null;
  end if;

  for v_user_id in
    select pm.user_id from public.project_members pm where pm.project_id = coalesce(new.id, old.id)
    union
    select t.assignee_id from public.tasks t where t.project_id = coalesce(new.id, old.id)
    union
    select d.assignee_id from public.deliverables d where d.project_id = coalesce(new.id, old.id)
  loop
    perform private.refresh_user_access_hygiene_state(v_user_id);
  end loop;
  return null;
end;
$function$;

drop trigger if exists s10_access_hygiene_project_members_trg on public.project_members;
create trigger s10_access_hygiene_project_members_trg
after insert or update or delete on public.project_members
for each row execute function private.refresh_access_hygiene_from_assignment_change();

drop trigger if exists s10_access_hygiene_tasks_trg on public.tasks;
create trigger s10_access_hygiene_tasks_trg
after insert or update or delete on public.tasks
for each row execute function private.refresh_access_hygiene_from_assignment_change();

drop trigger if exists s10_access_hygiene_deliverables_trg on public.deliverables;
create trigger s10_access_hygiene_deliverables_trg
after insert or update or delete on public.deliverables
for each row execute function private.refresh_access_hygiene_from_assignment_change();

drop trigger if exists s10_access_hygiene_projects_trg on public.projects;
create trigger s10_access_hygiene_projects_trg
after update of archived_at, deleted_at on public.projects
for each row execute function private.refresh_access_hygiene_from_project_change();

insert into public.user_access_hygiene_state (
  user_id,
  inactivity_period_started_at,
  notified_for_period_started_at,
  observed_qualifying_access,
  initialized_at,
  updated_at
)
select
  p.id,
  case when private.user_has_qualifying_access(p.id) then null else now() end,
  null,
  private.user_has_qualifying_access(p.id),
  now(),
  now()
from public.profiles p
where p.deleted_at is null
on conflict (user_id) do nothing;

-- =============================================================================
-- SECTION 3. Trusted S10-04 account, administration, reminder, and bug-report routines
-- =============================================================================

create or replace function public.get_own_account_settings()
returns table (
  user_id uuid,
  full_name text,
  preferred_locale text,
  timezone text,
  email_notifications_enabled boolean,
  role public.app_role
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  return query
  select p.id, p.full_name, p.preferred_locale, p.timezone, p.email_notifications_enabled, p.role
  from public.profiles p
  where p.id = v_user_id and p.is_active and p.deleted_at is null;
end;
$function$;

create or replace function public.update_own_account_settings(
  p_full_name text,
  p_preferred_locale text,
  p_timezone text,
  p_email_notifications_enabled boolean
)
returns table (success boolean, code text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_name text := nullif(btrim(p_full_name), '');
  v_timezone text := nullif(btrim(p_timezone), '');
begin
  if v_user_id is null or not exists (
    select 1 from public.profiles p where p.id = v_user_id and p.is_active and p.deleted_at is null
  ) then
    raise exception 'Active authenticated profile required';
  end if;
  if v_name is null or char_length(v_name) > 120
    or p_preferred_locale not in ('en-US', 'es-MX')
    or v_timezone is null
    or not exists (select 1 from pg_catalog.pg_timezone_names where name = v_timezone)
    or p_email_notifications_enabled is null then
    raise exception 'Account settings input is invalid';
  end if;

  update public.profiles
  set full_name = v_name,
      preferred_locale = p_preferred_locale,
      timezone = v_timezone,
      email_notifications_enabled = p_email_notifications_enabled,
      updated_at = now()
  where id = v_user_id;

  return query select true, 'updated';
end;
$function$;

create or replace function public.list_user_access_directory(
  p_before_created_at timestamptz default null,
  p_before_user_id uuid default null,
  p_limit integer default 25
)
returns table (
  user_id uuid,
  full_name text,
  application_role public.app_role,
  is_active boolean,
  last_successful_auth_at timestamptz,
  active_project_membership_count integer,
  active_task_assignment_count integer,
  active_deliverable_assignment_count integer,
  pending_invitation_count integer,
  last_access_action text,
  last_access_action_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
begin
  perform private.assert_s10_operational_manager();
  if (p_before_created_at is null) <> (p_before_user_id is null) then
    raise exception 'Directory cursor must be complete';
  end if;

  return query
  select
    p.id,
    p.full_name,
    p.role,
    p.is_active,
    u.last_sign_in_at,
    (select count(*)::integer from public.project_members pm join public.projects pr on pr.id = pm.project_id
      where pm.user_id = p.id and pm.deleted_at is null and pr.deleted_at is null and pr.archived_at is null),
    (select count(*)::integer from public.tasks t join public.projects pr on pr.id = t.project_id
      where t.assignee_id = p.id and t.deleted_at is null and t.archived_at is null and pr.deleted_at is null and pr.archived_at is null),
    (select count(*)::integer from public.deliverables d join public.tasks t on t.id = d.task_id join public.projects pr on pr.id = d.project_id
      where d.assignee_id = p.id and d.deleted_at is null and d.archived_at is null and t.deleted_at is null and t.archived_at is null and pr.deleted_at is null and pr.archived_at is null),
    (select count(*)::integer from public.invite_tokens i
      where lower(i.email::text) = lower(u.email) and i.role in ('client', 'operator')
        and i.status = 'pending' and i.revoked_at is null and i.expires_at > now()),
    a.action,
    a.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  left join lateral (
    select ua.action, ua.created_at from public.user_access_actions ua
    where ua.target_user_id = p.id order by ua.created_at desc, ua.id desc limit 1
  ) a on true
  where p.deleted_at is null
    and (p_before_created_at is null or p.created_at < p_before_created_at
      or (p.created_at = p_before_created_at and p.id < p_before_user_id))
  order by p.created_at desc, p.id desc
  limit v_limit;
end;
$function$;

create or replace function public.set_user_access_state(p_target_user_id uuid, p_is_active boolean)
returns table (success boolean, code text)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  v_actor_id uuid := private.assert_s10_operational_manager();
  v_actor_role public.app_role := private.current_user_role();
  v_target public.profiles%rowtype;
  v_target_email text;
  v_active_manager_count integer;
begin
  if p_target_user_id is null or p_is_active is null then raise exception 'Access-state input is invalid'; end if;
  if p_target_user_id = v_actor_id then return query select false, 'self_lockout_forbidden'; return; end if;

  select * into v_target
  from public.profiles
  where id = p_target_user_id and deleted_at is null for update;
  if not found then return query select false, 'not_found'; return; end if;

  select email into v_target_email
  from auth.users
  where id = p_target_user_id;

  if v_target.is_active = p_is_active then return query select true, 'already_in_requested_state'; return; end if;

  if not p_is_active and v_target.role in ('admin', 'pm') then
    select count(*) into v_active_manager_count from public.profiles
    where is_active and deleted_at is null and role in ('admin', 'pm');
    if v_active_manager_count <= 1 then return query select false, 'last_management_account_forbidden'; return; end if;
  end if;

  update public.profiles set is_active = p_is_active, updated_at = now()
  where id = p_target_user_id;

  if not p_is_active then
    update public.invite_tokens
    set status = 'revoked', revoked_at = now()
    where role in ('client', 'operator')
      and status = 'pending'
      and revoked_at is null
      and expires_at > now()
      and lower(email::text) = lower(v_target_email);
  end if;

  insert into public.user_access_actions(target_user_id, action, actor_id, actor_role)
  values (p_target_user_id, case when p_is_active then 'reactivated' else 'deactivated' end, v_actor_id, v_actor_role);
  insert into public.audit_logs(entity_type, entity_id, action, changed_fields, actor_id, actor_role)
  values ('profile', p_target_user_id, case when p_is_active then 'profile_reactivated' else 'profile_deactivated' end,
    jsonb_build_object('pending_ordinary_invites_revoked', not p_is_active), v_actor_id, v_actor_role);

  perform private.refresh_user_access_hygiene_state(p_target_user_id);
  return query select true, case when p_is_active then 'reactivated' else 'deactivated' end;
end;
$function$;

create or replace function public.list_stale_access_reminder_candidates()
returns table (user_id uuid, full_name text, application_role public.app_role, inactivity_period_started_at timestamptz)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $function$
begin
  perform private.assert_s10_operational_manager();
  return query
  select p.id, p.full_name, p.role, hs.inactivity_period_started_at
  from public.user_access_hygiene_state hs
  join public.profiles p on p.id = hs.user_id
  join auth.users u on u.id = p.id
  where p.is_active and p.deleted_at is null
    and p.role in ('client', 'operator')
    and hs.inactivity_period_started_at is not null
    and hs.notified_for_period_started_at is null
    and not private.user_has_qualifying_access(p.id)
    and greatest(hs.inactivity_period_started_at, coalesce(u.last_sign_in_at, hs.inactivity_period_started_at))
      <= now() - interval '45 days'
  order by hs.inactivity_period_started_at asc, p.id asc;
end;
$function$;

create or replace function public.record_stale_access_reminder(p_target_user_id uuid)
returns table (success boolean, code text)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  v_actor_id uuid := private.assert_s10_operational_manager();
  v_period timestamptz;
begin
  select hs.inactivity_period_started_at into v_period
  from public.user_access_hygiene_state hs
  join public.profiles p on p.id = hs.user_id
  join auth.users u on u.id = p.id
  where hs.user_id = p_target_user_id
    and p.is_active and p.deleted_at is null and p.role in ('client', 'operator')
    and hs.inactivity_period_started_at is not null
    and hs.notified_for_period_started_at is null
    and not private.user_has_qualifying_access(p.id)
    and greatest(hs.inactivity_period_started_at, coalesce(u.last_sign_in_at, hs.inactivity_period_started_at))
      <= now() - interval '45 days'
  for update of hs;

  if not found then return query select false, 'not_eligible_or_already_recorded'; return; end if;
  insert into public.stale_access_reminders(subject_user_id, inactivity_period_started_at, decided_by)
  values (p_target_user_id, v_period, v_actor_id)
  on conflict (subject_user_id, inactivity_period_started_at) do nothing;
  update public.user_access_hygiene_state
  set notified_for_period_started_at = v_period, updated_at = now()
  where user_id = p_target_user_id and inactivity_period_started_at = v_period;
  insert into public.audit_logs(entity_type, entity_id, action, changed_fields, actor_id, actor_role)
  values ('profile', p_target_user_id, 'stale_access_reminder_recorded',
    jsonb_build_object('inactivity_period_started_at', v_period), v_actor_id, private.current_user_role());
  return query select true, 'recorded';
end;
$function$;

create or replace function public.submit_bug_report(p_title text, p_description text)
returns table (report_id uuid, status public.bug_report_status)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role public.app_role := private.current_user_role();
  v_report_id uuid;
begin
  if v_user_id is null or v_role is null then raise exception 'Active authenticated profile required'; end if;
  if nullif(btrim(p_title), '') is null or char_length(btrim(p_title)) > 160
    or nullif(btrim(p_description), '') is null or char_length(btrim(p_description)) > 5000 then
    raise exception 'Bug-report input is invalid';
  end if;
  insert into public.bug_reports(reporter_id, reporter_role, title, description)
  values (v_user_id, v_role, btrim(p_title), btrim(p_description)) returning id into v_report_id;
  return query select v_report_id, 'open'::public.bug_report_status;
end;
$function$;

create or replace function public.list_bug_reports(p_before_created_at timestamptz default null, p_before_report_id uuid default null, p_limit integer default 25)
returns table (report_id uuid, title text, description text, status public.bug_report_status, reporter_role public.app_role, created_at timestamptz, status_changed_at timestamptz)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
declare v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
begin
  perform private.assert_s10_operational_manager();
  if (p_before_created_at is null) <> (p_before_report_id is null) then raise exception 'Bug-report cursor must be complete'; end if;
  return query select b.id, b.title, b.description, b.status, b.reporter_role, b.created_at, b.status_changed_at
  from public.bug_reports b
  where p_before_created_at is null or b.created_at < p_before_created_at
    or (b.created_at = p_before_created_at and b.id < p_before_report_id)
  order by b.created_at desc, b.id desc limit v_limit;
end;
$function$;

create or replace function public.set_bug_report_status(p_report_id uuid, p_status public.bug_report_status)
returns table (success boolean, code text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare v_actor_id uuid := private.assert_s10_operational_manager();
begin
  if p_report_id is null or p_status is null then raise exception 'Bug-report status input is invalid'; end if;
  update public.bug_reports
  set status = p_status,
      status_changed_by = case when p_status = 'open' then null else v_actor_id end,
      status_changed_at = case when p_status = 'open' then null else now() end,
      updated_at = now()
  where id = p_report_id and status is distinct from p_status;
  if found then return query select true, 'updated'; else return query select false, 'not_found_or_unchanged'; end if;
end;
$function$;

-- Retire generic profile soft-delete/restore as an access-management bypass.
-- Deactivation is now only set_user_access_state; generic history actions remain
-- restricted to their non-profile legacy allowlist.
create or replace function public.soft_delete_entity(p_entity_type public.entity_type, p_entity_id uuid, p_reason text default null)
returns boolean language plpgsql security definer set search_path = pg_catalog, public
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_table_name text;
  v_row_count integer;
begin
  if not private.is_admin() then raise exception 'Only Admin can soft delete entities'; end if;
  if p_entity_type in ('profile', 'project', 'task', 'deliverable', 'milestone') then
    raise exception 'This entity uses its dedicated lifecycle command';
  end if;
  case p_entity_type
    when 'client' then v_table_name := 'clients';
    when 'project_member' then v_table_name := 'project_members';
    when 'calendar_event' then v_table_name := 'calendar_events';
    when 'collaboration_comment' then v_table_name := 'collaboration_comments';
    else raise exception 'Entity type is not supported for legacy soft delete';
  end case;
  execute format('update public.%I set deleted_at = now(), updated_at = now() where id = $1 and deleted_at is null', v_table_name) using p_entity_id;
  get diagnostics v_row_count = row_count;
  if v_row_count = 0 then return false; end if;
  insert into public.audit_logs(entity_type, entity_id, action, changed_fields, actor_id, actor_role)
  values (p_entity_type, p_entity_id, 'entity_soft_deleted', jsonb_build_object('reason', p_reason), v_actor_id, 'admin');
  return true;
end;
$function$;

create or replace function public.restore_entity(p_entity_type public.entity_type, p_entity_id uuid, p_reason text default null)
returns boolean language plpgsql security definer set search_path = pg_catalog, public
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_table_name text;
  v_row_count integer;
begin
  if not private.is_admin() then raise exception 'Only Admin can restore soft deleted entities'; end if;
  if p_entity_type in ('profile', 'project', 'task', 'deliverable', 'milestone') then
    raise exception 'This entity uses its dedicated lifecycle command';
  end if;
  case p_entity_type
    when 'client' then v_table_name := 'clients';
    when 'project_member' then v_table_name := 'project_members';
    when 'calendar_event' then v_table_name := 'calendar_events';
    when 'collaboration_comment' then v_table_name := 'collaboration_comments';
    else raise exception 'Entity type is not supported for legacy restore';
  end case;
  execute format('update public.%I set deleted_at = null, updated_at = now() where id = $1 and deleted_at is not null', v_table_name) using p_entity_id;
  get diagnostics v_row_count = row_count;
  if v_row_count = 0 then return false; end if;
  insert into public.audit_logs(entity_type, entity_id, action, changed_fields, actor_id, actor_role)
  values (p_entity_type, p_entity_id, 'entity_restored', jsonb_build_object('reason', p_reason), v_actor_id, 'admin');
  return true;
end;
$function$;

-- Direct profile updates must not permit role/activation/consent/metadata mutation.
drop policy if exists profiles_update_policy on public.profiles;
revoke update on table public.profiles from authenticated;

-- =============================================================================
-- SECTION 4. S10-03 forward closure: trusted helpers, validation triggers,
--            views, and operational RPCs
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 4.1. Private authorization and readiness helpers (Group 5.7)
-- -----------------------------------------------------------------------------

create or replace function private.is_task_assignee(task_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select exists (
    select 1
    from public.tasks t
    join public.projects p on p.id = t.project_id
    join public.profiles pr on pr.id = t.assignee_id
    where t.id = task_uuid
      and t.assignee_id = (select auth.uid())
      and t.deleted_at is null
      and t.archived_at is null
      and p.deleted_at is null
      and p.archived_at is null
      and pr.is_active = true
      and pr.deleted_at is null
  );
$function$;

create or replace function private.is_client_task_assignee(task_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select exists (
    select 1
    from public.tasks t
    join public.projects p on p.id = t.project_id
    join public.profiles pr on pr.id = t.assignee_id
    where t.id = task_uuid
      and t.task_type = 'client_request'
      and t.assignee_id = (select auth.uid())
      and t.deleted_at is null
      and t.archived_at is null
      and p.deleted_at is null
      and p.archived_at is null
      and pr.role = 'client'
      and pr.is_active = true
      and pr.deleted_at is null
  );
$function$;

create or replace function private.is_deliverable_assignee(deliverable_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select exists (
    select 1
    from public.deliverables d
    join public.tasks t on t.id = d.task_id
    join public.projects p on p.id = d.project_id
    join public.profiles pr on pr.id = d.assignee_id
    where d.id = deliverable_uuid
      and d.assignee_id = (select auth.uid())
      and d.deleted_at is null
      and d.archived_at is null
      and t.deleted_at is null
      and t.archived_at is null
      and p.deleted_at is null
      and p.archived_at is null
      and pr.is_active = true
      and pr.deleted_at is null
  );
$function$;

create or replace function private.is_client_submission_assignee(deliverable_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select exists (
    select 1
    from public.deliverables d
    join public.tasks t on t.id = d.task_id
    join public.projects p on p.id = d.project_id
    join public.profiles pr on pr.id = d.assignee_id
    where d.id = deliverable_uuid
      and d.workflow_type = 'client_submission'
      and d.assignee_id = (select auth.uid())
      and d.deleted_at is null
      and d.archived_at is null
      and t.deleted_at is null
      and t.archived_at is null
      and p.deleted_at is null
      and p.archived_at is null
      and pr.role = 'client'
      and pr.is_active = true
      and pr.deleted_at is null
  );
$function$;

create or replace function private.project_has_client_readiness(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
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
      and project_row.archived_at is null
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

-- -----------------------------------------------------------------------------
-- 4.2. Validation triggers (Groups 5.8 & 5.9)
-- -----------------------------------------------------------------------------

create or replace function private.validate_task()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_project record;
  v_assignee_member_type public.project_member_type;
begin
  select p.project_type, p.deleted_at, p.archived_at
  into v_project
  from public.projects p
  where p.id = NEW.project_id;

  if not found or v_project.deleted_at is not null or v_project.archived_at is not null then
    raise exception 'Task project % not found, deleted, or archived', NEW.project_id;
  end if;

  select pm.member_type
  into v_assignee_member_type
  from public.project_members pm
  join public.profiles pr on pr.id = pm.user_id
  where pm.project_id = NEW.project_id
    and pm.user_id = NEW.assignee_id
    and pm.deleted_at is null
    and pr.deleted_at is null
    and pr.is_active = true;

  if not found then
    raise exception 'Assignee % is not an active member of project %', NEW.assignee_id, NEW.project_id;
  end if;

  if NEW.task_type = 'client_request' then
    if v_project.project_type <> 'client' then
      raise exception 'Client request tasks are only permitted on client projects';
    end if;
    if v_assignee_member_type <> 'client' then
      raise exception 'Client request tasks must be assigned to an active Client member';
    end if;
  else
    if v_assignee_member_type not in ('pm_lead', 'pm_watcher', 'operator') then
      raise exception 'Internal work tasks must be assigned to a PM or Operator';
    end if;
  end if;

  return NEW;
end;
$function$;

create or replace function private.sync_and_validate_deliverable()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_task record;
  v_project record;
  v_assignee_member_type public.project_member_type;
begin
  select t.project_id, t.task_type, t.deleted_at, t.archived_at
  into v_task
  from public.tasks t
  where t.id = new.task_id;

  if not found or v_task.deleted_at is not null or v_task.archived_at is not null then
    raise exception 'Deliverable task % not found, deleted, or archived', new.task_id;
  end if;
  new.project_id := v_task.project_id;

  select p.project_type, p.status, p.deleted_at, p.archived_at
  into v_project
  from public.projects p
  where p.id = new.project_id;
  if not found or v_project.deleted_at is not null or v_project.archived_at is not null then
    raise exception 'Deliverable project % not found, deleted, or archived', new.project_id;
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

create or replace function private.validate_milestone_task_link()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_scope text;
  v_milestone_project_id uuid;
  v_milestone_deleted_at timestamptz;
  v_milestone_archived_at timestamptz;
  v_task_project_id uuid;
  v_task_deleted_at timestamptz;
  v_task_archived_at timestamptz;
  v_project_deleted_at timestamptz;
  v_project_archived_at timestamptz;
  v_project_status public.project_status;
begin
  select m.scope, m.project_id, m.deleted_at, m.archived_at
    into v_scope, v_milestone_project_id, v_milestone_deleted_at, v_milestone_archived_at
  from public.milestones m
  where m.id = new.milestone_id;

  if not found or v_milestone_deleted_at is not null or v_milestone_archived_at is not null then
    raise exception 'Milestone must exist and be active';
  end if;

  select t.project_id, t.deleted_at, t.archived_at, p.deleted_at, p.archived_at, p.status
    into v_task_project_id, v_task_deleted_at, v_task_archived_at, v_project_deleted_at, v_project_archived_at, v_project_status
  from public.tasks t
  join public.projects p on p.id = t.project_id
  where t.id = new.task_id;

  if not found
    or v_task_deleted_at is not null
    or v_task_archived_at is not null
    or v_project_deleted_at is not null
    or v_project_archived_at is not null
    or v_project_status = 'cancelled' then
    raise exception 'Milestone task must belong to an active non-cancelled project';
  end if;

  if v_scope = 'project' and v_task_project_id <> v_milestone_project_id then
    raise exception 'A project milestone may only contain tasks from its own project';
  end if;

  return new;
end;
$function$;

create or replace function private.validate_calendar_event_task_scope()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_project_deleted_at timestamptz;
  v_project_archived_at timestamptz;
  v_task_project_id uuid;
  v_task_deleted_at timestamptz;
  v_task_archived_at timestamptz;
begin
  select p.deleted_at, p.archived_at
  into v_project_deleted_at, v_project_archived_at
  from public.projects p
  where p.id = new.project_id;

  if not found or v_project_deleted_at is not null or v_project_archived_at is not null then
    raise exception 'Calendar event project must exist and be active';
  end if;

  if new.task_id is null then
    return new;
  end if;

  select t.project_id, t.deleted_at, t.archived_at
  into v_task_project_id, v_task_deleted_at, v_task_archived_at
  from public.tasks t
  where t.id = new.task_id;

  if not found or v_task_deleted_at is not null or v_task_archived_at is not null then
    raise exception 'Calendar milestone task must exist and be active';
  end if;

  if v_task_project_id <> new.project_id then
    raise exception 'Calendar milestone task must belong to the milestone project';
  end if;

  return new;
end;
$function$;

create or replace function private.validate_production_google_drive_submission_url()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_deliv record;
begin
  select d.workflow_type, d.deleted_at, d.archived_at, t.deleted_at as task_deleted_at, t.archived_at as task_archived_at, p.deleted_at as project_deleted_at, p.archived_at as project_archived_at
  into v_deliv
  from public.deliverables d
  join public.tasks t on t.id = d.task_id
  join public.projects p on p.id = d.project_id
  where d.id = new.deliverable_id;

  if not found
    or v_deliv.deleted_at is not null
    or v_deliv.archived_at is not null
    or v_deliv.task_deleted_at is not null
    or v_deliv.task_archived_at is not null
    or v_deliv.project_deleted_at is not null
    or v_deliv.project_archived_at is not null then
    raise exception 'Deliverable % not found or inactive for submitted version', new.deliverable_id;
  end if;

  if v_deliv.workflow_type = 'production' then
    if new.submission_provider <> 'google_drive' then
      raise exception 'Production deliverable versions must use Google Drive';
    end if;

    if not private.is_valid_production_google_drive_submission_url(new.submission_url) then
      raise exception 'Production deliverable submission URL must be a valid Google Drive HTTPS link';
    end if;
  end if;

  return new;
end;
$function$;

-- -----------------------------------------------------------------------------
-- 4.3. Role-facing and operational views (Groups 5.1, 5.2, 5.10)
-- -----------------------------------------------------------------------------

create or replace view public.calendar_feed_view with (security_invoker = true) as
select p.id as entity_id,
  p.id as project_id,
  p.name as title,
  'project_deadline'::public.calendar_event_type as event_type,
  p.deadline_at as starts_at,
  p.deadline_at as ends_at,
  true as is_all_day,
  null::text as color_override
from public.projects p
where p.deleted_at is null and p.archived_at is null
union all
select t.id as entity_id,
  t.project_id,
  t.title,
  'task_deadline'::public.calendar_event_type as event_type,
  t.deadline_at as starts_at,
  t.deadline_at as ends_at,
  true as is_all_day,
  null::text as color_override
from public.tasks t
join public.projects p on p.id = t.project_id
where t.deleted_at is null and t.archived_at is null and p.deleted_at is null and p.archived_at is null
union all
select d.id as entity_id,
  d.project_id,
  d.title || ' (Internal Review)'::text as title,
  'internal_review_deadline'::public.calendar_event_type as event_type,
  d.internal_review_deadline_at as starts_at,
  d.internal_review_deadline_at as ends_at,
  true as is_all_day,
  null::text as color_override
from public.deliverables d
join public.projects p on p.id = d.project_id
join public.tasks t on t.id = d.task_id
where d.workflow_type = 'production'::public.deliverable_workflow_type
  and d.internal_review_deadline_at is not null
  and d.deleted_at is null and d.archived_at is null
  and t.deleted_at is null and t.archived_at is null
  and p.deleted_at is null and p.archived_at is null
union all
select d.id as entity_id,
  d.project_id,
  d.title || ' (Client Delivery)'::text as title,
  'client_delivery_deadline'::public.calendar_event_type as event_type,
  d.client_delivery_deadline_at as starts_at,
  d.client_delivery_deadline_at as ends_at,
  true as is_all_day,
  null::text as color_override
from public.deliverables d
join public.projects p on p.id = d.project_id
join public.tasks t on t.id = d.task_id
where d.workflow_type = 'production'::public.deliverable_workflow_type
  and d.client_delivery_deadline_at is not null
  and d.deleted_at is null and d.archived_at is null
  and t.deleted_at is null and t.archived_at is null
  and p.deleted_at is null and p.archived_at is null
union all
select d.id as entity_id,
  d.project_id,
  d.title || ' (Client Submission)'::text as title,
  'task_deadline'::public.calendar_event_type as event_type,
  d.submission_deadline_at as starts_at,
  d.submission_deadline_at as ends_at,
  true as is_all_day,
  null::text as color_override
from public.deliverables d
join public.projects p on p.id = d.project_id
join public.tasks t on t.id = d.task_id
where d.workflow_type = 'client_submission'::public.deliverable_workflow_type
  and d.submission_deadline_at is not null
  and d.deleted_at is null and d.archived_at is null
  and t.deleted_at is null and t.archived_at is null
  and p.deleted_at is null and p.archived_at is null
union all
select ce.id as entity_id,
  ce.project_id,
  ce.title,
  ce.event_type,
  ce.starts_at,
  ce.ends_at,
  ce.is_all_day,
  ce.color_override
from public.calendar_events ce
join public.projects p on p.id = ce.project_id and p.deleted_at is null and p.archived_at is null
left join public.tasks t on t.id = ce.task_id and t.project_id = ce.project_id and t.deleted_at is null and t.archived_at is null
where ce.deleted_at is null
  and (ce.task_id is null or t.id is not null);

create or replace view public.deliverable_cycle_metrics_view with (security_invoker = true) as
select d.id as deliverable_id,
  d.project_id,
  d.title,
  d.workflow_type,
  d.status,
  d.current_version_number,
  min(a_sub.created_at) as first_submitted_at,
  min(a_client_start.created_at) as client_review_started_at,
  min(a_client_act.created_at) as client_acted_at,
  extract(epoch from min(a_client_act.created_at) - min(a_client_start.created_at)) / 3600.0 as client_review_hours,
  d.delivered_at
from public.deliverables d
join public.projects p on p.id = d.project_id and p.deleted_at is null and p.archived_at is null
join public.tasks t on t.id = d.task_id and t.deleted_at is null and t.archived_at is null
left join public.audit_logs a_sub on a_sub.entity_type = 'deliverable'::public.entity_type and a_sub.entity_id = d.id and (a_sub.action = any (array['deliverable_version_submitted'::text, 'client_deliverable_submitted'::text]))
left join public.audit_logs a_client_start on a_client_start.entity_type = 'deliverable'::public.entity_type and a_client_start.entity_id = d.id and a_client_start.new_status = 'awaiting_client_review'::text
left join public.audit_logs a_client_act on a_client_act.entity_type = 'deliverable'::public.entity_type and a_client_act.entity_id = d.id and (a_client_act.new_status = any (array['approved'::text, 'changes_requested'::text]))
where d.deleted_at is null and d.archived_at is null
group by d.id, d.project_id, d.title, d.workflow_type, d.status, d.current_version_number, d.delivered_at;

create or replace view public.project_completion_cycles_view with (security_invoker = true) as
with completions as (
  select a.id as audit_id,
    a.project_id,
    a.created_at as completed_at,
    a.actor_id as completed_by,
    (a.changed_fields ->> 'unfinished_task_count'::text)::integer as unfinished_task_count,
    (a.changed_fields ->> 'unfinished_deliverable_count'::text)::integer as unfinished_deliverable_count,
    (a.changed_fields ->> 'override_confirmed'::text)::boolean as override_confirmed,
    row_number() over (partition by a.project_id order by a.created_at) as cycle_number
  from public.audit_logs a
  where a.entity_type = 'project'::public.entity_type and a.action = 'project_completed'::text
), reopenings as (
  select a.id as audit_id,
    a.project_id,
    a.created_at as reopened_at,
    a.actor_id as reopened_by,
    a.changed_fields ->> 'reopen_reason'::text as reopen_reason,
    row_number() over (partition by a.project_id order by a.created_at) as cycle_number
  from public.audit_logs a
  where a.entity_type = 'project'::public.entity_type and a.action = 'project_reopened'::text
)
select p.id as project_id,
  p.name as project_name,
  c.cycle_number,
  c.completed_at,
  c.completed_by,
  c.unfinished_task_count,
  c.unfinished_deliverable_count,
  c.override_confirmed,
  r.reopened_at,
  r.reopened_by,
  r.reopen_reason,
  case
    when r.reopened_at is not null then extract(epoch from r.reopened_at - c.completed_at) / 86400.0
    else extract(epoch from now() - c.completed_at) / 86400.0
  end as cycle_duration_days,
  p.completed_at as current_completed_at,
  p.status as current_project_status
from public.projects p
join completions c on c.project_id = p.id
left join reopenings r on r.project_id = p.id and r.cycle_number = c.cycle_number
where p.deleted_at is null and p.archived_at is null;

create or replace view public.client_deliverable_view with (security_invoker = true) as
select d.id,
  d.project_id,
  p.name as project_name,
  d.task_id,
  d.title,
  d.specifications,
  d.status,
  d.current_version_number,
  d.client_delivery_deadline_at,
  d.approved_at,
  d.delivered_at,
  v.submission_url as current_submission_url,
  v.submission_provider as current_submission_provider,
  v.submission_note as current_submission_note,
  v.submitted_at as current_submitted_at,
  (
    select coalesce(jsonb_agg(jsonb_build_object('id', df.id, 'version_id', df.version_id, 'decision', df.decision, 'comments', df.comments, 'reviewed_at', df.reviewed_at) order by df.reviewed_at desc), '[]'::jsonb)
    from public.deliverable_feedback df
    where df.deliverable_id = d.id and df.stage = 'client'::public.review_stage
  ) as client_feedback_history,
  d.created_at
from public.deliverables d
join public.projects p on p.id = d.project_id
join public.tasks t on t.id = d.task_id
left join public.deliverable_versions v on v.deliverable_id = d.id and v.version_number = d.current_version_number
where d.workflow_type = 'production'::public.deliverable_workflow_type
  and (d.status in ('awaiting_client_review'::public.deliverable_status, 'approved'::public.deliverable_status, 'delivered'::public.deliverable_status, 'changes_requested'::public.deliverable_status))
  and d.deleted_at is null and d.archived_at is null
  and t.deleted_at is null and t.archived_at is null
  and p.deleted_at is null and p.archived_at is null;

create or replace view public.client_project_view with (security_invoker = true) as
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
    join public.tasks t on t.id = d.task_id and t.deleted_at is null and t.archived_at is null
    where d.project_id = p.id
      and d.deleted_at is null
      and d.archived_at is null
  ) as last_deliverable_activity_at,
  p.created_at
from public.projects p
left join public.clients c on c.id = p.client_id and c.deleted_at is null
where p.project_type = 'client'::public.project_type
  and p.deleted_at is null
  and p.archived_at is null;

create or replace view public.client_submission_view with (security_invoker = true) as
select
  d.id,
  d.project_id,
  p.name as project_name,
  d.task_id,
  t.title as task_title,
  d.assignee_id,
  d.title,
  d.specifications,
  d.status,
  d.current_version_number,
  d.submission_deadline_at,
  d.last_activity_at,
  v.submission_url as current_submission_url,
  v.submission_provider as current_submission_provider,
  v.submission_note as current_submission_note,
  v.submitted_at as current_submitted_at,
  d.created_at,
  private.get_client_submission_correction_history(d.id) as correction_history
from public.deliverables d
join public.projects p on p.id = d.project_id and p.deleted_at is null and p.archived_at is null
join public.tasks t on t.id = d.task_id and t.deleted_at is null and t.archived_at is null
left join public.deliverable_versions v on v.deliverable_id = d.id and v.version_number = d.current_version_number
where d.workflow_type = 'client_submission'::public.deliverable_workflow_type
  and d.deleted_at is null
  and d.archived_at is null;

create or replace view public.client_task_view with (security_invoker = true) as
select
  t.id,
  t.project_id,
  p.name as project_name,
  t.assignee_id,
  t.title,
  t.description,
  t.status,
  t.priority,
  t.deadline_at,
  t.started_at,
  t.completed_at,
  t.created_at,
  (
    select coalesce(jsonb_agg(jsonb_build_object('id', tr.id, 'name', tr.name, 'url', tr.url, 'sort_order', tr.sort_order) order by tr.sort_order), '[]'::jsonb)
    from public.task_resources tr
    where tr.task_id = t.id and tr.deleted_at is null
  ) as resources,
  (
    select count(*)::bigint
    from public.deliverables d
    where d.task_id = t.id
      and d.workflow_type = 'client_submission'::public.deliverable_workflow_type
      and d.deleted_at is null
      and d.archived_at is null
  ) as child_submission_count
from public.tasks t
join public.projects p on p.id = t.project_id and p.deleted_at is null and p.archived_at is null
where t.task_type = 'client_request'::public.task_type
  and t.deleted_at is null
  and t.archived_at is null;

create or replace view public.operator_agenda_view with (security_invoker = true) as
select
  t.id as task_id,
  t.project_id,
  p.name as project_name,
  t.title as task_title,
  t.description as task_description,
  t.status as task_status,
  t.priority as task_priority,
  t.deadline_at as task_deadline_at,
  t.started_at as task_started_at,
  d.id as deliverable_id,
  d.title as deliverable_title,
  d.status as deliverable_status,
  d.workflow_type as deliverable_workflow_type,
  d.current_version_number,
  d.internal_review_deadline_at,
  d.client_delivery_deadline_at,
  case
    when t.status = 'completed'::public.task_status then 'completed'::text
    when t.deadline_at < now() then 'overdue'::text
    when t.deadline_at <= (now() + '24:00:00'::interval) then 'urgent'::text
    when t.assigned_at > (now() - '24:00:00'::interval) then 'new'::text
    when t.deadline_at <= (now() + '72:00:00'::interval) then 'upcoming'::text
    else 'normal'::text
  end as urgency_category,
  t.assigned_at,
  coalesce((
    select jsonb_agg(jsonb_build_object('id', tr.id, 'name', tr.name, 'url', tr.url, 'sort_order', tr.sort_order) order by tr.sort_order, tr.id)
    from public.task_resources tr
    where tr.task_id = t.id and tr.deleted_at is null
  ), '[]'::jsonb) as task_resources,
  d.specifications as deliverable_specifications,
  d.submission_deadline_at
from public.tasks t
join public.projects p on p.id = t.project_id and p.deleted_at is null and p.archived_at is null
join public.profiles assignee_profile on assignee_profile.id = t.assignee_id
left join public.deliverables d on d.task_id = t.id and d.deleted_at is null and d.archived_at is null
where t.assignee_id = ((select auth.uid()))
  and t.deleted_at is null
  and t.archived_at is null
  and (
    t.status <> 'completed'::public.task_status
    or (
      t.completed_at is not null
      and (t.completed_at at time zone assignee_profile.timezone)::date = (now() at time zone assignee_profile.timezone)::date
    )
  );

-- -----------------------------------------------------------------------------
-- 4.4. Calendar and metrics/reporting RPCs (Groups 5.1 & 5.2)
-- -----------------------------------------------------------------------------

create or replace function public.list_role_safe_calendar_events(
  p_from timestamp with time zone,
  p_to timestamp with time zone,
  p_project_id uuid default null::uuid
)
returns table (
  entity_id uuid,
  project_id uuid,
  project_name text,
  task_id uuid,
  title text,
  event_type public.calendar_event_type,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  is_all_day boolean,
  color_override text
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role public.app_role := (select private.current_user_role());
  v_is_manager boolean;
begin
  if v_user_id is null or v_role is null then
    raise exception 'Authentication with an active profile is required';
  end if;

  if p_from is null or p_to is null or p_from >= p_to then
    raise exception 'Calendar range must have p_from before p_to';
  end if;

  if p_to - p_from > interval '93 days' then
    raise exception 'Calendar range must not exceed 93 days';
  end if;

  v_is_manager := v_role in ('admin', 'pm');

  return query
  with permitted_events as (
    select
      p.id as entity_id,
      p.id as project_id,
      p.name as project_name,
      null::uuid as task_id,
      p.name as title,
      'project_deadline'::public.calendar_event_type as event_type,
      p.deadline_at as starts_at,
      p.deadline_at as ends_at,
      true as is_all_day,
      null::text as color_override
    from public.projects p
    where p.deleted_at is null
      and p.archived_at is null
      and (p_project_id is null or p.id = p_project_id)
      and (v_is_manager or (v_role = 'client' and (select private.is_project_client(p.id))))

    union all

    select
      t.id, 
      case when v_role = 'operator' then null::uuid else t.project_id end,
      case when v_role = 'client' and not (select private.is_project_client(t.project_id)) then null::text else p.name end,
      t.id,
      t.title,
      'task_deadline'::public.calendar_event_type,
      t.deadline_at,
      t.deadline_at,
      true,
      null::text
    from public.tasks t
    join public.projects p on p.id = t.project_id and p.deleted_at is null and p.archived_at is null
    where t.deleted_at is null
      and t.archived_at is null
      and (p_project_id is null or t.project_id = p_project_id)
      and (
        v_is_manager
        or (v_role = 'operator' and t.assignee_id = v_user_id)
        or (v_role = 'client' and t.task_type = 'client_request' and t.assignee_id = v_user_id)
      )

    union all

    select
      d.id, d.project_id, p.name, d.task_id,
      d.title || ' (Internal Review)',
      'internal_review_deadline'::public.calendar_event_type,
      d.internal_review_deadline_at, d.internal_review_deadline_at, true, null::text
    from public.deliverables d
    join public.projects p on p.id = d.project_id and p.deleted_at is null and p.archived_at is null
    join public.tasks t on t.id = d.task_id and t.deleted_at is null and t.archived_at is null
    where d.deleted_at is null
      and d.archived_at is null
      and d.workflow_type = 'production'
      and d.internal_review_deadline_at is not null
      and (p_project_id is null or d.project_id = p_project_id)
      and v_is_manager

    union all

    select
      d.id,
      case when v_role = 'operator' then null::uuid else d.project_id end,
      p.name,
      d.task_id,
      d.title || ' (Client Delivery)',
      'client_delivery_deadline'::public.calendar_event_type,
      d.client_delivery_deadline_at, d.client_delivery_deadline_at, true, null::text
    from public.deliverables d
    join public.projects p on p.id = d.project_id and p.deleted_at is null and p.archived_at is null
    join public.tasks t on t.id = d.task_id and t.deleted_at is null and t.archived_at is null
    where d.deleted_at is null
      and d.archived_at is null
      and d.workflow_type = 'production'
      and d.client_delivery_deadline_at is not null
      and (p_project_id is null or d.project_id = p_project_id)
      and (
        v_is_manager
        or (v_role = 'operator' and d.assignee_id = v_user_id)
        or (v_role = 'client' and (select private.is_project_client(d.project_id)))
      )

    union all

    select
      d.id,
      case when v_role = 'client' and not (select private.is_project_client(d.project_id)) then null::uuid else d.project_id end,
      case when v_role = 'client' and not (select private.is_project_client(d.project_id)) then null::text else p.name end,
      d.task_id,
      d.title || ' (Client Submission)',
      'task_deadline'::public.calendar_event_type,
      d.submission_deadline_at, d.submission_deadline_at, true, null::text
    from public.deliverables d
    join public.projects p on p.id = d.project_id and p.deleted_at is null and p.archived_at is null
    join public.tasks t on t.id = d.task_id and t.deleted_at is null and t.archived_at is null
    where d.deleted_at is null
      and d.archived_at is null
      and d.workflow_type = 'client_submission'
      and d.submission_deadline_at is not null
      and (p_project_id is null or d.project_id = p_project_id)
      and (v_is_manager or (v_role = 'client' and d.assignee_id = v_user_id))

    union all

    select
      m.id,
      m.project_id,
      p.name,
      null::uuid,
      m.title,
      'milestone'::public.calendar_event_type,
      (m.target_date::timestamp at time zone 'America/Mexico_City'),
      (m.target_date::timestamp at time zone 'America/Mexico_City'),
      true,
      m.color_override
    from public.milestones m
    left join public.projects p on p.id = m.project_id and p.deleted_at is null and p.archived_at is null
    where v_is_manager
      and m.deleted_at is null
      and m.archived_at is null
      and (
        p_project_id is null
        or (m.scope = 'project' and m.project_id = p_project_id and p.id is not null)
        or (
          m.scope = 'company'
          and exists (
            select 1
            from public.milestone_tasks mt
            join public.tasks t on t.id = mt.task_id and t.deleted_at is null and t.archived_at is null
            join public.projects tp on tp.id = t.project_id and tp.deleted_at is null and tp.archived_at is null
            where mt.milestone_id = m.id and t.project_id = p_project_id
          )
        )
      )
  )
  select pe.entity_id, pe.project_id, pe.project_name, pe.task_id, pe.title,
         pe.event_type, pe.starts_at, pe.ends_at, pe.is_all_day, pe.color_override
  from permitted_events pe
  where pe.starts_at < p_to
    and coalesce(pe.ends_at, pe.starts_at) >= p_from
  order by pe.starts_at asc, pe.event_type asc, pe.entity_id asc;
end;
$function$;

create or replace function public.get_scoped_operations_metrics(
  p_project_id uuid default null::uuid,
  p_from timestamp with time zone default null::timestamp with time zone,
  p_to timestamp with time zone default null::timestamp with time zone
)
returns table (
  project_counts_by_status jsonb,
  active_task_count bigint,
  overdue_task_count bigint,
  deadline_attention_count bigint,
  production_deliverable_counts_by_status jsonb,
  finalized_deliverable_count bigint,
  client_review_cycle_count bigint,
  average_client_review_hours numeric,
  completion_cycle_count bigint,
  reopening_cycle_count bigint,
  average_completion_cycle_duration_days numeric,
  unread_in_app_queue_count bigint,
  suppressed_external_queue_count bigint,
  unresolved_link_report_count bigint,
  range_from timestamp with time zone,
  range_to timestamp with time zone
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_is_metrics_authorized boolean;
  v_queue_authorized boolean;
  v_from timestamptz;
  v_to timestamptz;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_user_id
      and p.is_active = true
      and p.deleted_at is null
  ) then
    raise exception 'Active profile required';
  end if;

  if p_from is null and p_to is null then
    v_from := statement_timestamp() - interval '90 days';
    v_to := statement_timestamp();
  elsif p_from is null or p_to is null then
    raise exception 'Metrics range requires both p_from and p_to';
  else
    v_from := p_from;
    v_to := p_to;
  end if;

  if v_from >= v_to then
    raise exception 'Metrics range start must precede its end';
  end if;

  if v_to - v_from > interval '93 days' then
    raise exception 'Metrics range must not exceed 93 days';
  end if;

  v_is_metrics_authorized := exists (
    select 1
    from public.profiles p
    where p.id = v_user_id
      and p.role in ('admin', 'pm')
      and p.is_active = true
      and p.deleted_at is null
  );

  if not v_is_metrics_authorized then
    raise exception 'Metrics access required';
  end if;

  -- Active Admin and PM company-owner accounts both have global metrics scope.
  -- A supplied project ID narrows the read projection; an omitted ID is global.
  v_queue_authorized := true;

  return query
  with scoped_projects as (
    select p.id, p.status
    from public.projects p
    where p.deleted_at is null
      and p.archived_at is null
      and (p_project_id is null or p.id = p_project_id)
  ),
  project_statuses as (
    select sp.status::text as status, count(*)::bigint as count_value
    from scoped_projects sp
    group by sp.status
  ),
  task_attention as (
    select
      count(*) filter (where t.status <> 'completed')::bigint as active_task_count,
      count(*) filter (
        where t.status <> 'completed'
          and t.deadline_at < statement_timestamp()
      )::bigint as overdue_task_count,
      count(*) filter (
        where t.status <> 'completed'
          and t.deadline_at >= v_from
          and t.deadline_at < v_to
      )::bigint as deadline_attention_count
    from public.tasks t
    join scoped_projects sp on sp.id = t.project_id
    where t.deleted_at is null
      and t.archived_at is null
  ),
  production_statuses as (
    select d.status::text as status, count(*)::bigint as count_value
    from public.deliverables d
    join scoped_projects sp on sp.id = d.project_id
    join public.tasks t on t.id = d.task_id and t.deleted_at is null and t.archived_at is null
    where d.deleted_at is null
      and d.archived_at is null
      and d.workflow_type = 'production'
    group by d.status
  ),
  finalized_deliverables as (
    select count(*)::bigint as count_value
    from public.deliverables d
    join scoped_projects sp on sp.id = d.project_id
    join public.tasks t on t.id = d.task_id and t.deleted_at is null and t.archived_at is null
    where d.deleted_at is null
      and d.archived_at is null
      and d.workflow_type = 'production'
      and d.status in ('approved', 'delivered')
      and coalesce(d.delivered_at, d.approved_at) >= v_from
      and coalesce(d.delivered_at, d.approved_at) < v_to
  ),
  client_review_cycles as (
    select
      count(*) filter (where m.client_review_hours is not null)::bigint as cycle_count,
      avg(m.client_review_hours) filter (
        where m.client_review_hours is not null
      ) as average_hours
    from public.deliverable_cycle_metrics_view m
    join scoped_projects sp on sp.id = m.project_id
    where m.workflow_type = 'production'
      and m.client_acted_at >= v_from
      and m.client_acted_at < v_to
  ),
  completion_cycles as (
    select
      count(*)::bigint as completion_count,
      count(*) filter (where c.reopened_at is not null)::bigint as reopening_count,
      avg(c.cycle_duration_days) as average_duration_days
    from public.project_completion_cycles_view c
    join scoped_projects sp on sp.id = c.project_id
    where c.completed_at >= v_from
      and c.completed_at < v_to
  ),
  queue_state as (
    select
      case when v_queue_authorized then
        count(*) filter (
          where nr.channel = 'in_app' and nr.read_at is null
        )::bigint
      else null::bigint end as unread_in_app_count,
      case when v_queue_authorized then
        count(*) filter (
          where nr.channel in ('email', 'whatsapp')
            and nr.delivery_status = 'suppressed'
            and nr.suppressed_at >= v_from
            and nr.suppressed_at < v_to
        )::bigint
      else null::bigint end as suppressed_external_count
    from public.notification_recipients nr
    join public.notification_events ne on ne.id = nr.event_id
    join scoped_projects sp on sp.id = ne.project_id
    where v_queue_authorized
  ),
  unresolved_link_reports as (
    select count(*)::bigint as count_value
    from public.deliverable_link_reports lr
    join public.deliverables d on d.id = lr.deliverable_id
    join public.tasks t on t.id = d.task_id and t.deleted_at is null and t.archived_at is null
    join scoped_projects sp on sp.id = d.project_id
    where d.deleted_at is null
      and d.archived_at is null
      and lr.status = 'open'
  )
  select
    coalesce((select jsonb_object_agg(ps.status, ps.count_value) from project_statuses ps), '{}'::jsonb),
    coalesce((select ta.active_task_count from task_attention ta), 0)::bigint,
    coalesce((select ta.overdue_task_count from task_attention ta), 0)::bigint,
    coalesce((select ta.deadline_attention_count from task_attention ta), 0)::bigint,
    coalesce((select jsonb_object_agg(ps.status, ps.count_value) from production_statuses ps), '{}'::jsonb),
    coalesce((select fd.count_value from finalized_deliverables fd), 0)::bigint,
    coalesce((select crc.cycle_count from client_review_cycles crc), 0)::bigint,
    (select crc.average_hours from client_review_cycles crc),
    coalesce((select cc.completion_count from completion_cycles cc), 0)::bigint,
    coalesce((select cc.reopening_count from completion_cycles cc), 0)::bigint,
    (select cc.average_duration_days from completion_cycles cc),
    (select qs.unread_in_app_count from queue_state qs),
    (select qs.suppressed_external_count from queue_state qs),
    coalesce((select ulr.count_value from unresolved_link_reports ulr), 0)::bigint,
    v_from,
    v_to;
end;
$function$;

create or replace function public.list_scoped_operations_metric_trend(
  p_project_id uuid default null::uuid,
  p_from timestamp with time zone default null::timestamp with time zone,
  p_to timestamp with time zone default null::timestamp with time zone
)
returns table (
  period_start timestamp with time zone,
  period_end timestamp with time zone,
  finalized_deliverable_count bigint,
  client_review_cycle_count bigint,
  completion_cycle_count bigint,
  reopening_cycle_count bigint
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_is_metrics_authorized boolean;
  v_from timestamptz;
  v_to timestamptz;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_user_id and p.is_active = true and p.deleted_at is null
  ) then
    raise exception 'Active profile required';
  end if;

  if p_from is null and p_to is null then
    v_from := statement_timestamp() - interval '90 days';
    v_to := statement_timestamp();
  elsif p_from is null or p_to is null then
    raise exception 'Metrics range requires both p_from and p_to';
  else
    v_from := p_from;
    v_to := p_to;
  end if;

  if v_from >= v_to then
    raise exception 'Metrics range start must precede its end';
  end if;

  if v_to - v_from > interval '93 days' then
    raise exception 'Metrics range must not exceed 93 days';
  end if;

  v_is_metrics_authorized := exists (
    select 1
    from public.profiles p
    where p.id = v_user_id
      and p.role in ('admin', 'pm')
      and p.is_active = true
      and p.deleted_at is null
  );

  if not v_is_metrics_authorized then
    raise exception 'Metrics access required';
  end if;

  -- Active Admin and PM company-owner accounts both have global metrics scope.
  -- A supplied project ID narrows the trend; an omitted ID is global.

  return query
  with scoped_projects as (
    select p.id
    from public.projects p
    where p.deleted_at is null
      and p.archived_at is null
      and (p_project_id is null or p.id = p_project_id)
  ),
  periods as (
    select
      series.bucket_start as period_start,
      least(series.bucket_start + interval '7 days', v_to) as period_end
    from generate_series(v_from, v_to, interval '7 days') as series(bucket_start)
    where series.bucket_start < v_to
  )
  select
    periods.period_start,
    periods.period_end,
    coalesce(finalized.count_value, 0)::bigint,
    coalesce(reviewed.count_value, 0)::bigint,
    coalesce(completed.count_value, 0)::bigint,
    coalesce(completed.reopening_count, 0)::bigint
  from periods
  left join lateral (
    select count(*)::bigint as count_value
    from public.deliverables d
    join scoped_projects sp on sp.id = d.project_id
    join public.tasks t on t.id = d.task_id and t.deleted_at is null and t.archived_at is null
    where d.deleted_at is null
      and d.archived_at is null
      and d.workflow_type = 'production'
      and d.status in ('approved', 'delivered')
      and coalesce(d.delivered_at, d.approved_at) >= periods.period_start
      and coalesce(d.delivered_at, d.approved_at) < periods.period_end
  ) finalized on true
  left join lateral (
    select count(*)::bigint as count_value
    from public.deliverable_cycle_metrics_view m
    join scoped_projects sp on sp.id = m.project_id
    where m.workflow_type = 'production'
      and m.client_review_hours is not null
      and m.client_acted_at >= periods.period_start
      and m.client_acted_at < periods.period_end
  ) reviewed on true
  left join lateral (
    select
      count(*)::bigint as count_value,
      count(*) filter (where c.reopened_at is not null)::bigint as reopening_count
    from public.project_completion_cycles_view c
    join scoped_projects sp on sp.id = c.project_id
    where c.completed_at >= periods.period_start
      and c.completed_at < periods.period_end
  ) completed on true
  order by periods.period_start asc;
end;
$function$;

create or replace function public.list_scoped_user_operations_metrics(
  p_project_id uuid default null::uuid,
  p_user_id uuid default null::uuid,
  p_from timestamp with time zone default null::timestamp with time zone,
  p_to timestamp with time zone default null::timestamp with time zone
)
returns table (
  user_id uuid,
  full_name text,
  application_role public.app_role,
  is_active boolean,
  current_active_task_count bigint,
  task_assigned_count bigint,
  task_started_count bigint,
  task_completed_count bigint,
  average_assignment_to_start_hours numeric,
  unstarted_task_count_at_range_end bigint,
  production_deliverable_submission_count bigint,
  client_submission_count bigint,
  deliverable_review_count bigint,
  deliverable_delivered_count bigint,
  in_app_notification_received_count bigint,
  in_app_notification_read_count bigint,
  in_app_notification_unread_count_at_range_end bigint,
  in_app_notification_unread_over_24h_count_at_range_end bigint,
  average_in_app_notification_read_hours numeric,
  last_workflow_action_at timestamp with time zone,
  range_from timestamp with time zone,
  range_to timestamp with time zone
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_is_metrics_authorized boolean;
  v_from timestamptz;
  v_to timestamptz;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_user_id and p.is_active = true and p.deleted_at is null
  ) then
    raise exception 'Active profile required';
  end if;

  v_is_metrics_authorized := exists (
    select 1 from public.profiles p
    where p.id = v_user_id and p.role in ('admin', 'pm')
      and p.is_active = true and p.deleted_at is null
  );
  if not v_is_metrics_authorized then
    raise exception 'Metrics access required';
  end if;

  if p_from is null and p_to is null then
    v_from := statement_timestamp() - interval '90 days';
    v_to := statement_timestamp();
  elsif p_from is null or p_to is null then
    raise exception 'Metrics range requires both p_from and p_to';
  else
    v_from := p_from;
    v_to := p_to;
  end if;
  if v_from >= v_to then
    raise exception 'Metrics range start must precede its end';
  end if;
  if v_to - v_from > interval '93 days' then
    raise exception 'Metrics range must not exceed 93 days';
  end if;

  return query
  with scoped_projects as (
    select p.id from public.projects p
    where p.deleted_at is null and p.archived_at is null and (p_project_id is null or p.id = p_project_id)
  ),
  eligible_users as (
    select pm.user_id
    from public.project_members pm join scoped_projects sp on sp.id = pm.project_id
    where pm.deleted_at is null
    union
    select a.actor_id
    from public.audit_logs a join scoped_projects sp on sp.id = a.project_id
    where a.actor_id is not null and a.created_at >= v_from and a.created_at < v_to
    union
    select t.assignee_id
    from public.tasks t join scoped_projects sp on sp.id = t.project_id
    where t.deleted_at is null and t.archived_at is null
    union
    select d.assignee_id
    from public.deliverables d
    join public.tasks t on t.id = d.task_id and t.deleted_at is null and t.archived_at is null
    join scoped_projects sp on sp.id = d.project_id
    where d.deleted_at is null and d.archived_at is null
    union
    select nr.user_id
    from public.notification_recipients nr
    join public.notification_events ne on ne.id = nr.event_id
    join scoped_projects sp on sp.id = ne.project_id
    where nr.channel = 'in_app' and nr.created_at >= v_from and nr.created_at < v_to
  ),
  workflow_actions as (
    select a.actor_id as metric_user_id,
      count(*) filter (where a.entity_type = 'task' and a.action = 'task_status_changed' and a.new_status = 'in_progress')::bigint as task_started_count,
      count(*) filter (where a.entity_type = 'task' and a.action = 'task_status_changed' and a.new_status = 'completed')::bigint as task_completed_count,
      count(*) filter (where a.entity_type = 'deliverable' and a.action = 'deliverable_version_submitted')::bigint as production_deliverable_submission_count,
      count(*) filter (where a.entity_type = 'deliverable' and a.action = 'client_deliverable_submitted')::bigint as client_submission_count,
      count(*) filter (where a.entity_type = 'deliverable' and a.action = 'deliverable_reviewed')::bigint as deliverable_review_count,
      count(*) filter (where a.entity_type = 'deliverable' and a.action = 'deliverable_delivered')::bigint as deliverable_delivered_count,
      max(a.created_at) as last_workflow_action_at
    from public.audit_logs a join scoped_projects sp on sp.id = a.project_id
    where a.actor_id is not null and a.created_at >= v_from and a.created_at < v_to
    group by a.actor_id
  ),
  task_response as (
    select t.assignee_id as metric_user_id,
      count(*) filter (where t.assigned_at >= v_from and t.assigned_at < v_to)::bigint as task_assigned_count,
      count(*) filter (where t.assigned_at < v_to and first_assignee_start.started_at is null)::bigint as unstarted_task_count_at_range_end,
      avg(extract(epoch from (first_assignee_start.started_at - t.assigned_at)) / 3600.0) filter (
        where t.assigned_at >= v_from and t.assigned_at < v_to and first_assignee_start.started_at is not null
      ) as average_assignment_to_start_hours
    from public.tasks t join scoped_projects sp on sp.id = t.project_id
    left join lateral (
      select min(a.created_at) as started_at from public.audit_logs a
      where a.entity_type = 'task' and a.entity_id = t.id and a.actor_id = t.assignee_id
        and a.action = 'task_status_changed' and a.new_status = 'in_progress'
        and a.created_at >= t.assigned_at and a.created_at < v_to
    ) first_assignee_start on true
    where t.deleted_at is null and t.archived_at is null
    group by t.assignee_id
  ),
  current_tasks as (
    select t.assignee_id as metric_user_id,
      count(*) filter (where t.status <> 'completed')::bigint as current_active_task_count
    from public.tasks t join scoped_projects sp on sp.id = t.project_id
    where t.deleted_at is null and t.archived_at is null group by t.assignee_id
  ),
  notification_acknowledgements as (
    select nr.user_id as metric_user_id,
      count(*)::bigint as in_app_notification_received_count,
      count(*) filter (where nr.read_at is not null and nr.read_at >= nr.created_at and nr.read_at < v_to)::bigint as in_app_notification_read_count,
      count(*) filter (where nr.read_at is null or nr.read_at >= v_to)::bigint as in_app_notification_unread_count_at_range_end,
      count(*) filter (where (nr.read_at is null or nr.read_at >= v_to) and nr.created_at <= v_to - interval '24 hours')::bigint as in_app_notification_unread_over_24h_count_at_range_end,
      avg(extract(epoch from (nr.read_at - nr.created_at)) / 3600.0) filter (
        where nr.read_at is not null and nr.read_at >= nr.created_at and nr.read_at < v_to
      ) as average_in_app_notification_read_hours
    from public.notification_recipients nr
    join public.notification_events ne on ne.id = nr.event_id
    join scoped_projects sp on sp.id = ne.project_id
    where nr.channel = 'in_app' and nr.created_at >= v_from and nr.created_at < v_to
    group by nr.user_id
  )
  select p.id, p.full_name, p.role, p.is_active,
    coalesce(ct.current_active_task_count, 0)::bigint,
    coalesce(tr.task_assigned_count, 0)::bigint,
    coalesce(wa.task_started_count, 0)::bigint,
    coalesce(wa.task_completed_count, 0)::bigint,
    tr.average_assignment_to_start_hours,
    coalesce(tr.unstarted_task_count_at_range_end, 0)::bigint,
    coalesce(wa.production_deliverable_submission_count, 0)::bigint,
    coalesce(wa.client_submission_count, 0)::bigint,
    coalesce(wa.deliverable_review_count, 0)::bigint,
    coalesce(wa.deliverable_delivered_count, 0)::bigint,
    coalesce(na.in_app_notification_received_count, 0)::bigint,
    coalesce(na.in_app_notification_read_count, 0)::bigint,
    coalesce(na.in_app_notification_unread_count_at_range_end, 0)::bigint,
    coalesce(na.in_app_notification_unread_over_24h_count_at_range_end, 0)::bigint,
    na.average_in_app_notification_read_hours,
    wa.last_workflow_action_at, v_from, v_to
  from eligible_users eu
  join public.profiles p on p.id = eu.user_id
  left join workflow_actions wa on wa.metric_user_id = p.id
  left join task_response tr on tr.metric_user_id = p.id
  left join current_tasks ct on ct.metric_user_id = p.id
  left join notification_acknowledgements na on na.metric_user_id = p.id
  where p_user_id is null or p.id = p_user_id
  order by coalesce(tr.unstarted_task_count_at_range_end, 0) desc,
    coalesce(na.in_app_notification_unread_over_24h_count_at_range_end, 0) desc,
    p.full_name asc, p.id asc;
end;
$function$;

create or replace function public.list_scoped_metrics_project_filter_options()
returns table (project_id uuid, project_name text)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_user_id
      and p.role in ('admin', 'pm')
      and p.is_active = true
      and p.deleted_at is null
  ) then
    raise exception 'Metrics access required';
  end if;

  return query
  select p.id, p.name
  from public.projects p
  where p.deleted_at is null
    and p.archived_at is null
  order by p.name asc, p.id asc;
end;
$function$;

-- -----------------------------------------------------------------------------
-- 4.5. Milestone selectors, management projections, and operator context (Group 5.3)
-- -----------------------------------------------------------------------------

create or replace function public.get_milestone_detail(p_milestone_id uuid)
returns table (
  milestone_id uuid,
  scope text,
  project_id uuid,
  project_name text,
  title text,
  description text,
  target_date date,
  color_override text,
  active_task_count integer,
  completed_task_count integer,
  in_progress_task_count integer,
  in_review_task_count integer,
  blocked_task_count integer
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role public.app_role := (select private.current_user_role());
begin
  if v_user_id is null or v_role not in ('admin', 'pm') then
    raise exception 'Milestone detail is not permitted';
  end if;

  return query
  select
    m.id,
    m.scope,
    m.project_id,
    p.name,
    m.title,
    m.description,
    m.target_date,
    m.color_override,
    count(t.id)::integer as active_task_count,
    count(t.id) filter (where t.status = 'completed')::integer as completed_task_count,
    count(t.id) filter (where t.status = 'in_progress')::integer as in_progress_task_count,
    count(t.id) filter (where t.status = 'in_review')::integer as in_review_task_count,
    count(t.id) filter (where t.status = 'blocked')::integer as blocked_task_count
  from public.milestones m
  left join public.projects p on p.id = m.project_id and p.deleted_at is null and p.archived_at is null
  left join public.milestone_tasks mt on mt.milestone_id = m.id
  left join public.tasks t on t.id = mt.task_id and t.deleted_at is null and t.archived_at is null
    and exists (select 1 from public.projects tp where tp.id = t.project_id and tp.deleted_at is null and tp.archived_at is null)
  where m.id = p_milestone_id
    and m.deleted_at is null
    and m.archived_at is null
    and (m.scope = 'company' or p.id is not null)
  group by m.id, p.name;
end;
$function$;

create or replace function public.list_project_milestone_summaries(p_project_id uuid)
returns table (
  milestone_id uuid,
  scope text,
  title text,
  target_date date,
  color_override text,
  active_task_count integer,
  completed_task_count integer,
  in_progress_task_count integer,
  in_review_task_count integer,
  blocked_task_count integer
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role public.app_role := (select private.current_user_role());
begin
  if v_user_id is null or v_role not in ('admin', 'pm') then
    raise exception 'Milestone summary is not permitted';
  end if;

  if not exists (
    select 1 from public.projects p
    where p.id = p_project_id and p.deleted_at is null and p.archived_at is null
  ) then
    raise exception 'Project not found';
  end if;

  return query
  select
    m.id,
    m.scope,
    m.title,
    m.target_date,
    m.color_override,
    count(t.id)::integer,
    count(t.id) filter (where t.status = 'completed')::integer,
    count(t.id) filter (where t.status = 'in_progress')::integer,
    count(t.id) filter (where t.status = 'in_review')::integer,
    count(t.id) filter (where t.status = 'blocked')::integer
  from public.milestones m
  left join public.milestone_tasks mt on mt.milestone_id = m.id
  left join public.tasks t on t.id = mt.task_id and t.deleted_at is null and t.archived_at is null
    and exists (select 1 from public.projects tp where tp.id = t.project_id and tp.deleted_at is null and tp.archived_at is null)
  where m.deleted_at is null
    and m.archived_at is null
    and (
      (m.scope = 'project' and m.project_id = p_project_id)
      or (
        m.scope = 'company'
        and exists (
          select 1
          from public.milestone_tasks contribution
          join public.tasks contribution_task
            on contribution_task.id = contribution.task_id
            and contribution_task.deleted_at is null
            and contribution_task.archived_at is null
          join public.projects contribution_proj
            on contribution_proj.id = contribution_task.project_id
            and contribution_proj.deleted_at is null
            and contribution_proj.archived_at is null
          where contribution.milestone_id = m.id
            and contribution_task.project_id = p_project_id
        )
      )
    )
  group by m.id
  order by m.target_date asc, m.title asc, m.id asc;
end;
$function$;

create or replace function public.list_milestone_tasks(p_milestone_id uuid)
returns table (
  task_id uuid,
  project_id uuid,
  project_name text,
  title text,
  status public.task_status,
  priority public.task_priority,
  deadline_at timestamp with time zone
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role public.app_role := (select private.current_user_role());
begin
  if v_user_id is null or v_role not in ('admin', 'pm') then
    raise exception 'Milestone detail is not permitted';
  end if;

  if not exists (
    select 1 from public.milestones m
    left join public.projects mp on mp.id = m.project_id and mp.deleted_at is null and mp.archived_at is null
    where m.id = p_milestone_id
      and m.deleted_at is null
      and m.archived_at is null
      and (m.scope = 'company' or mp.id is not null)
  ) then
    return;
  end if;

  return query
  select t.id, p.id, p.name, t.title, t.status, t.priority, t.deadline_at
  from public.milestone_tasks mt
  join public.tasks t on t.id = mt.task_id and t.deleted_at is null and t.archived_at is null
  join public.projects p on p.id = t.project_id and p.deleted_at is null and p.archived_at is null
  where mt.milestone_id = p_milestone_id
  order by p.name asc, t.deadline_at asc, t.title asc, t.id asc;
end;
$function$;

create or replace function public.list_task_milestone_options(p_project_id uuid)
returns table (
  milestone_id uuid,
  scope text,
  project_id uuid,
  project_name text,
  title text,
  target_date date,
  color_override text
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role public.app_role := (select private.current_user_role());
begin
  if v_user_id is null or v_role not in ('admin', 'pm') then
    raise exception 'Milestone planning is not permitted';
  end if;

  if not exists (
    select 1 from public.projects p
    where p.id = p_project_id and p.deleted_at is null and p.archived_at is null
  ) then
    raise exception 'Project not found';
  end if;

  return query
  select
    m.id,
    m.scope,
    m.project_id,
    p.name,
    m.title,
    m.target_date,
    m.color_override
  from public.milestones m
  left join public.projects p on p.id = m.project_id and p.deleted_at is null and p.archived_at is null
  where m.deleted_at is null
    and m.archived_at is null
    and (
      m.scope = 'company'
      or (m.scope = 'project' and m.project_id = p_project_id and p.id is not null)
    )
  order by m.target_date asc, m.title asc, m.id asc;
end;
$function$;

create or replace function public.list_milestone_management_targets()
returns table (
  project_id uuid,
  project_name text,
  task_id uuid,
  task_title text,
  task_status public.task_status
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role public.app_role := (select private.current_user_role());
begin
  if v_user_id is null or v_role not in ('admin', 'pm') then
    raise exception 'Milestone planning is not permitted';
  end if;

  return query
  select p.id, p.name, t.id, t.title, t.status
  from public.projects p
  join public.tasks t on t.project_id = p.id and t.deleted_at is null and t.archived_at is null
  where p.deleted_at is null
    and p.archived_at is null
    and p.status <> 'cancelled'
  order by p.name asc, t.deadline_at asc, t.title asc, t.id asc;
end;
$function$;

create or replace function public.list_operator_task_milestone_context(p_task_id uuid)
returns table (
  title text,
  scope text,
  target_date date
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role public.app_role := (select private.current_user_role());
begin
  if v_user_id is null or v_role <> 'operator' then
    raise exception 'Operator task milestone context is not permitted';
  end if;

  if not exists (
    select 1
    from public.tasks t
    join public.projects p on p.id = t.project_id and p.deleted_at is null and p.archived_at is null
    where t.id = p_task_id
      and t.assignee_id = v_user_id
      and t.deleted_at is null
      and t.archived_at is null
  ) then
    raise exception 'Operator task milestone context is not permitted';
  end if;

  return query
  select m.title, m.scope, m.target_date
  from public.milestone_tasks mt
  join public.milestones m
    on m.id = mt.milestone_id
    and m.deleted_at is null
    and m.archived_at is null
  left join public.projects mp
    on mp.id = m.project_id
    and mp.deleted_at is null
    and mp.archived_at is null
  where mt.task_id = p_task_id
    and (m.scope = 'company' or mp.id is not null)
  order by m.target_date asc, m.title asc;
end;
$function$;

-- -----------------------------------------------------------------------------
-- 4.6. Active mutation commands: create/update/association/comment (Group 5.4)
-- -----------------------------------------------------------------------------

create or replace function public.create_milestone(
  p_scope text,
  p_project_id uuid default null::uuid,
  p_title text default null::text,
  p_description text default null::text,
  p_target_date date default null::date,
  p_color_override text default null::text,
  p_task_ids uuid[] default '{}'::uuid[]
)
returns table (
  milestone_id uuid,
  scope text,
  project_id uuid,
  title text,
  target_date date,
  color_override text
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_role public.app_role := (select private.current_user_role());
  v_title text := btrim(p_title);
  v_description text := nullif(btrim(p_description), '');
  v_task_id uuid;
  v_milestone public.milestones%rowtype;
begin
  if v_actor_id is null or v_role not in ('admin', 'pm') then
    raise exception 'Milestone planning is not permitted';
  end if;

  if p_scope not in ('project', 'company') then
    raise exception 'Milestone scope must be project or company';
  end if;

  if (p_scope = 'project' and p_project_id is null)
    or (p_scope = 'company' and p_project_id is not null) then
    raise exception 'Milestone scope and project relation are inconsistent';
  end if;

  if p_scope = 'project' and not exists (
    select 1 from public.projects p
    where p.id = p_project_id and p.deleted_at is null and p.archived_at is null
  ) then
    raise exception 'Milestone project not found';
  end if;

  if v_title is null or char_length(v_title) not between 1 and 160 then
    raise exception 'Milestone title must contain 1 to 160 trimmed characters';
  end if;

  if v_description is not null and char_length(v_description) > 2000 then
    raise exception 'Milestone description must not exceed 2000 trimmed characters';
  end if;

  if p_target_date is null then
    raise exception 'Milestone target date is required';
  end if;

  if p_color_override is not null
    and p_color_override not in ('chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5') then
    raise exception 'Milestone color_override is invalid';
  end if;

  if p_task_ids is null or cardinality(p_task_ids) > 100 then
    raise exception 'A milestone may contain at most 100 task associations';
  end if;

  if cardinality(p_task_ids) <> (
    select count(distinct task_id) from unnest(p_task_ids) as task_id
  ) then
    raise exception 'Milestone task associations must be unique';
  end if;

  if exists (
    select 1
    from unnest(p_task_ids) as requested(task_id)
    left join public.tasks t on t.id = requested.task_id and t.deleted_at is null and t.archived_at is null
    left join public.projects p on p.id = t.project_id and p.deleted_at is null and p.archived_at is null
    where t.id is null or p.id is null or p.status = 'cancelled'
  ) then
    raise exception 'Milestone task must belong to an active non-cancelled project';
  end if;

  if p_scope = 'project' and exists (
    select 1
    from unnest(p_task_ids) as requested(task_id)
    join public.tasks t on t.id = requested.task_id and t.deleted_at is null and t.archived_at is null
    where t.project_id <> p_project_id
  ) then
    raise exception 'A project milestone may only contain tasks from its own project';
  end if;

  insert into public.milestones (
    scope, project_id, title, description, target_date, color_override, created_by, updated_by
  ) values (
    p_scope, p_project_id, v_title, v_description, p_target_date, p_color_override, v_actor_id, v_actor_id
  ) returning * into v_milestone;

  foreach v_task_id in array p_task_ids loop
    insert into public.milestone_tasks (milestone_id, task_id, created_by)
    values (v_milestone.id, v_task_id, v_actor_id);
  end loop;

  insert into public.audit_logs (
    entity_type, entity_id, project_id, action, changed_fields, actor_id, actor_role
  ) values (
    'milestone', v_milestone.id, v_milestone.project_id, 'milestone_created',
    jsonb_build_object(
      'scope', v_milestone.scope,
      'target_date', v_milestone.target_date,
      'task_association_count', cardinality(p_task_ids),
      'has_description', v_milestone.description is not null,
      'has_color_override', v_milestone.color_override is not null
    ),
    v_actor_id, v_role
  );

  return query select
    v_milestone.id, v_milestone.scope, v_milestone.project_id,
    v_milestone.title, v_milestone.target_date, v_milestone.color_override;
end;
$function$;

create or replace function public.update_milestone(
  p_milestone_id uuid,
  p_scope text,
  p_project_id uuid default null::uuid,
  p_title text default null::text,
  p_description text default null::text,
  p_target_date date default null::date,
  p_color_override text default null::text,
  p_task_ids uuid[] default '{}'::uuid[]
)
returns table (
  milestone_id uuid,
  scope text,
  project_id uuid,
  title text,
  target_date date,
  color_override text
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_role public.app_role := (select private.current_user_role());
  v_title text := btrim(p_title);
  v_description text := nullif(btrim(p_description), '');
  v_task_id uuid;
  v_previous public.milestones%rowtype;
  v_milestone public.milestones%rowtype;
begin
  if v_actor_id is null or v_role not in ('admin', 'pm') then
    raise exception 'Milestone planning is not permitted';
  end if;

  select * into v_previous
  from public.milestones
  where id = p_milestone_id and deleted_at is null and archived_at is null
  for update;

  if not found then
    raise exception 'Milestone not found';
  end if;

  if p_scope not in ('project', 'company') then
    raise exception 'Milestone scope must be project or company';
  end if;

  if (p_scope = 'project' and p_project_id is null)
    or (p_scope = 'company' and p_project_id is not null) then
    raise exception 'Milestone scope and project relation are inconsistent';
  end if;

  if p_scope = 'project' and not exists (
    select 1 from public.projects p
    where p.id = p_project_id and p.deleted_at is null and p.archived_at is null
  ) then
    raise exception 'Milestone project not found';
  end if;

  if v_title is null or char_length(v_title) not between 1 and 160 then
    raise exception 'Milestone title must contain 1 to 160 trimmed characters';
  end if;

  if v_description is not null and char_length(v_description) > 2000 then
    raise exception 'Milestone description must not exceed 2000 trimmed characters';
  end if;

  if p_target_date is null then
    raise exception 'Milestone target date is required';
  end if;

  if p_color_override is not null
    and p_color_override not in ('chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5') then
    raise exception 'Milestone color_override is invalid';
  end if;

  if p_task_ids is null or cardinality(p_task_ids) > 100 then
    raise exception 'A milestone may contain at most 100 task associations';
  end if;

  if cardinality(p_task_ids) <> (
    select count(distinct task_id) from unnest(p_task_ids) as task_id
  ) then
    raise exception 'Milestone task associations must be unique';
  end if;

  -- Validate all replacement associations before removing existing ones.
  if exists (
    select 1
    from unnest(p_task_ids) as requested(task_id)
    left join public.tasks t on t.id = requested.task_id and t.deleted_at is null and t.archived_at is null
    left join public.projects p on p.id = t.project_id and p.deleted_at is null and p.archived_at is null
    where t.id is null or p.id is null or p.status = 'cancelled'
  ) then
    raise exception 'Milestone task must belong to an active non-cancelled project';
  end if;

  if p_scope = 'project' and exists (
    select 1
    from unnest(p_task_ids) as requested(task_id)
    join public.tasks t on t.id = requested.task_id and t.deleted_at is null and t.archived_at is null
    where t.project_id <> p_project_id
  ) then
    raise exception 'A project milestone may only contain tasks from its own project';
  end if;

  update public.milestones
  set scope = p_scope,
      project_id = p_project_id,
      title = v_title,
      description = v_description,
      target_date = p_target_date,
      color_override = p_color_override,
      updated_by = v_actor_id,
      updated_at = now()
  where id = v_previous.id
  returning * into v_milestone;

  delete from public.milestone_tasks where milestone_id = v_milestone.id;

  foreach v_task_id in array p_task_ids loop
    insert into public.milestone_tasks (milestone_id, task_id, created_by)
    values (v_milestone.id, v_task_id, v_actor_id);
  end loop;

  insert into public.audit_logs (
    entity_type, entity_id, project_id, action, changed_fields, actor_id, actor_role
  ) values (
    'milestone', v_milestone.id, v_milestone.project_id, 'milestone_updated',
    jsonb_build_object(
      'scope_changed', v_previous.scope is distinct from v_milestone.scope,
      'project_changed', v_previous.project_id is distinct from v_milestone.project_id,
      'title_changed', v_previous.title is distinct from v_milestone.title,
      'description_changed', v_previous.description is distinct from v_milestone.description,
      'target_date_changed', v_previous.target_date is distinct from v_milestone.target_date,
      'color_override_changed', v_previous.color_override is distinct from v_milestone.color_override,
      'task_association_count', cardinality(p_task_ids)
    ),
    v_actor_id, v_role
  );

  return query select
    v_milestone.id, v_milestone.scope, v_milestone.project_id,
    v_milestone.title, v_milestone.target_date, v_milestone.color_override;
end;
$function$;

create or replace function public.create_task_with_deliverables(
  p_project_id uuid,
  p_title text,
  p_description text,
  p_task_type public.task_type,
  p_priority public.task_priority,
  p_deadline_at timestamp with time zone,
  p_assignee_id uuid,
  p_deliverables jsonb default '[]'::jsonb,
  p_milestone_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_task public.tasks%rowtype;
  v_deliverable jsonb;
  v_deliverable_id uuid;
  v_milestone_id uuid;
  v_created_deliverable_ids jsonb := '[]'::jsonb;
  v_is_authorized boolean := false;
begin
  if v_actor_id is null then
    raise exception 'Authentication required';
  end if;

  if p_deliverables is null or jsonb_typeof(p_deliverables) <> 'array' then
    raise exception 'p_deliverables must be a JSON array';
  end if;

  if jsonb_array_length(p_deliverables) > 20 then
    raise exception 'A task may be created with at most 20 deliverables';
  end if;

  if p_milestone_ids is null or cardinality(p_milestone_ids) > 20 then
    raise exception 'A task may be associated with at most 20 milestones at creation';
  end if;

  if cardinality(p_milestone_ids) <> (
    select count(distinct milestone_id) from unnest(p_milestone_ids) as milestone_id
  ) then
    raise exception 'Task milestone associations must be unique';
  end if;

  if not exists (
    select 1 from public.projects p
    where p.id = p_project_id and p.deleted_at is null and p.archived_at is null
  ) then
    raise exception 'Project not found or inactive';
  end if;

  if exists (
    select 1
    from unnest(p_milestone_ids) as requested(milestone_id)
    left join public.milestones m on m.id = requested.milestone_id and m.deleted_at is null and m.archived_at is null
    left join public.projects mp on mp.id = m.project_id and mp.deleted_at is null and mp.archived_at is null
    where m.id is null
      or (m.scope = 'project' and (m.project_id <> p_project_id or mp.id is null))
  ) then
    raise exception 'Milestone association is invalid or inactive';
  end if;

  select (private.is_admin() or private.is_project_lead(p_project_id))
    into v_is_authorized;

  if not coalesce(v_is_authorized, false) then
    raise exception 'Only an Admin or active project PM Lead can create tasks and deliverables';
  end if;

  insert into public.tasks (
    project_id, assignee_id, task_type, title, description, priority,
    deadline_at, has_deliverables, created_by
  ) values (
    p_project_id, p_assignee_id, p_task_type, p_title, p_description, p_priority,
    p_deadline_at, jsonb_array_length(p_deliverables) > 0, v_actor_id
  ) returning * into v_task;

  foreach v_milestone_id in array p_milestone_ids loop
    insert into public.milestone_tasks (milestone_id, task_id, created_by)
    values (v_milestone_id, v_task.id, v_actor_id);
  end loop;

  for v_deliverable in select value from jsonb_array_elements(p_deliverables)
  loop
    if jsonb_typeof(v_deliverable) <> 'object' then
      raise exception 'Each deliverable must be a JSON object';
    end if;

    if coalesce(nullif(btrim(v_deliverable->>'title'), ''), '') = ''
      or char_length(btrim(v_deliverable->>'title')) > 180 then
      raise exception 'Deliverable title is required and must not exceed 180 characters';
    end if;

    if coalesce(nullif(btrim(v_deliverable->>'specifications'), ''), '') = ''
      or char_length(btrim(v_deliverable->>'specifications')) > 30000 then
      raise exception 'Deliverable specifications are required and must not exceed 30000 characters';
    end if;

    insert into public.deliverables (
      project_id, task_id, assignee_id, workflow_type, title, specifications,
      submission_deadline_at, internal_review_deadline_at, client_delivery_deadline_at, created_by
    ) values (
      p_project_id, v_task.id, (v_deliverable->>'assignee_id')::uuid,
      (v_deliverable->>'workflow_type')::public.deliverable_workflow_type,
      btrim(v_deliverable->>'title'), btrim(v_deliverable->>'specifications'),
      nullif(v_deliverable->>'submission_deadline_at', '')::timestamptz,
      nullif(v_deliverable->>'internal_review_deadline_at', '')::timestamptz,
      nullif(v_deliverable->>'client_delivery_deadline_at', '')::timestamptz,
      v_actor_id
    ) returning id into v_deliverable_id;

    v_created_deliverable_ids := v_created_deliverable_ids || to_jsonb(v_deliverable_id);
  end loop;

  return jsonb_build_object(
    'task', to_jsonb(v_task),
    'deliverable_ids', v_created_deliverable_ids
  );
end;
$function$;

create or replace function public.create_collaboration_comment(
  p_project_id uuid,
  p_target_type public.collaboration_target_type,
  p_target_id uuid,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role public.app_role;
  v_capacity public.collaboration_author_capacity;
  v_comment_id uuid;
  v_target_project_id uuid;
begin
  if p_body is null or char_length(btrim(p_body)) = 0 then
    raise exception 'Comment body cannot be empty';
  end if;

  v_role := (select private.current_user_role());

  if v_role = 'client' then
    raise exception 'Client users cannot post internal collaboration comments';
  end if;

  if not exists (
    select 1 from public.projects p
    where p.id = p_project_id and p.deleted_at is null and p.archived_at is null
  ) then
    raise exception 'Project % not found or inactive', p_project_id;
  end if;

  -- Validate target belongs to p_project_id
  if p_target_type = 'project' then
    if p_target_id <> p_project_id then
      raise exception 'Target project ID mismatch';
    end if;
  elsif p_target_type = 'task' then
    select project_id into v_target_project_id
    from public.tasks
    where id = p_target_id and deleted_at is null and archived_at is null;
    if v_target_project_id is null or v_target_project_id <> p_project_id then
      raise exception 'Task target % does not belong to project %', p_target_id, p_project_id;
    end if;
  elsif p_target_type = 'deliverable' then
    select d.project_id into v_target_project_id
    from public.deliverables d
    join public.tasks t on t.id = d.task_id and t.deleted_at is null and t.archived_at is null
    where d.id = p_target_id and d.deleted_at is null and d.archived_at is null;
    if v_target_project_id is null or v_target_project_id <> p_project_id then
      raise exception 'Deliverable target % does not belong to project %', p_target_id, p_project_id;
    end if;
  end if;

  -- Derive author capacity
  if (select private.is_admin()) then
    v_capacity := 'admin';
  elsif (select private.is_project_lead(p_project_id)) then
    v_capacity := 'pm_lead';
  elsif (select private.is_project_watcher(p_project_id)) then
    v_capacity := 'pm_watcher';
  elsif p_target_type = 'task' and (select private.is_task_assignee(p_target_id)) then
    v_capacity := 'operator';
  elsif p_target_type = 'deliverable' and (select private.is_deliverable_assignee(p_target_id)) then
    v_capacity := 'operator';
  else
    raise exception 'Not authorized to comment on % % in project %', p_target_type, p_target_id, p_project_id;
  end if;

  insert into public.collaboration_comments (
    project_id,
    target_type,
    target_id,
    author_id,
    author_capacity_snapshot,
    body
  ) values (
    p_project_id,
    p_target_type,
    p_target_id,
    v_user_id,
    v_capacity,
    p_body
  ) returning id into v_comment_id;

  return jsonb_build_object(
    'id', v_comment_id,
    'project_id', p_project_id,
    'target_type', p_target_type,
    'target_id', p_target_id,
    'author_id', v_user_id,
    'author_capacity_snapshot', v_capacity
  );
end;
$function$;

-- -----------------------------------------------------------------------------
-- 4.7. Active mutation commands: project/task/deliverable workflow (Groups 5.5 & 5.6 readiness helper)
-- -----------------------------------------------------------------------------

create or replace function public.get_project_completion_readiness(p_project_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_unfinished_tasks jsonb;
  v_unfinished_deliverables jsonb;
  v_task_count integer;
  v_deliverable_count integer;
begin
  if not ((select private.is_admin()) or (select private.is_project_pm(p_project_id))) then
    raise exception 'Not authorized to check project readiness';
  end if;

  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'title', t.title,
        'status', t.status,
        'assignee_id', t.assignee_id
      ) order by t.deadline_at asc
    ), '[]'::jsonb),
    count(*)
  into v_unfinished_tasks, v_task_count
  from public.tasks t
  where t.project_id = p_project_id
    and t.deleted_at is null
    and t.archived_at is null
    and t.status <> 'completed';

  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'id', d.id,
        'title', d.title,
        'status', d.status,
        'workflow_type', d.workflow_type,
        'assignee_id', d.assignee_id
      ) order by d.created_at asc
    ), '[]'::jsonb),
    count(*)
  into v_unfinished_deliverables, v_deliverable_count
  from public.deliverables d
  join public.tasks t on t.id = d.task_id and t.deleted_at is null and t.archived_at is null
  where d.project_id = p_project_id
    and d.deleted_at is null
    and d.archived_at is null
    and d.status <> 'delivered';

  return jsonb_build_object(
    'project_id', p_project_id,
    'is_ready', (v_task_count = 0 and v_deliverable_count = 0),
    'unfinished_task_count', v_task_count,
    'unfinished_tasks', v_unfinished_tasks,
    'unfinished_deliverable_count', v_deliverable_count,
    'unfinished_deliverables', v_unfinished_deliverables
  );
end;
$function$;

create or replace function public.transition_project_status(
  p_project_id uuid,
  p_next_status public.project_status,
  p_confirm_unfinished boolean default false,
  p_reopen_reason text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_proj record;
  v_readiness jsonb;
  v_old_status public.project_status;
  v_user_id uuid := auth.uid();
  v_actor_role public.app_role;
  v_prior_completed_at timestamptz;
begin
  if not ((select private.is_admin()) or (select private.is_project_lead(p_project_id))) then
    raise exception 'Only an active PM Lead or Admin can transition project status';
  end if;

  select * into v_proj
  from public.projects
  where id = p_project_id and deleted_at is null and archived_at is null
  for update;

  if not found then
    raise exception 'Project % not found or deleted', p_project_id;
  end if;

  v_old_status := v_proj.status;
  v_actor_role := (select private.current_user_role());

  -- Transition Validation
  if v_old_status = 'cancelled' then
    raise exception 'Cancelled project cannot be transitioned directly; use recover_project_status';
  elsif v_old_status = 'completed' then
    if p_next_status <> 'in_progress' then
      raise exception 'Completed project can only transition to in_progress (reopen)';
    end if;
    if p_reopen_reason is null or char_length(btrim(p_reopen_reason)) = 0 then
      raise exception 'Reopening a completed project requires a non-empty reason';
    end if;
  else
    if p_next_status = v_old_status then
      return jsonb_build_object('project_id', p_project_id, 'status', v_old_status);
    end if;
  end if;

  -- Handle Completion
  if p_next_status = 'completed' then
    v_readiness := public.get_project_completion_readiness(p_project_id);
    if not (v_readiness->>'is_ready')::boolean and not p_confirm_unfinished then
      raise exception 'Project has % unfinished tasks and % unfinished deliverables; explicit confirm_unfinished required',
        v_readiness->>'unfinished_task_count',
        v_readiness->>'unfinished_deliverable_count';
    end if;

    update public.projects
    set status = 'completed',
        completed_at = now(),
        updated_by = v_user_id,
        updated_at = now()
    where id = p_project_id;

    -- Audit log
    insert into public.audit_logs (
      entity_type,
      entity_id,
      project_id,
      action,
      old_status,
      new_status,
      changed_fields,
      actor_id,
      actor_role
    ) values (
      'project',
      p_project_id,
      p_project_id,
      'project_completed',
      v_old_status::text,
      'completed',
      jsonb_build_object(
        'unfinished_task_count', v_readiness->'unfinished_task_count',
        'unfinished_deliverable_count', v_readiness->'unfinished_deliverable_count',
        'override_confirmed', p_confirm_unfinished
      ),
      v_user_id,
      v_actor_role
    );

    -- Notification event
    insert into public.notification_events (
      trigger,
      entity_type,
      entity_id,
      project_id,
      actor_id,
      payload,
      deduplication_key
    ) values (
      'system',
      'project',
      p_project_id,
      p_project_id,
      v_user_id,
      jsonb_build_object('action', 'project_completed', 'project_name', v_proj.name),
      'project_completed:' || p_project_id || ':' || extract(epoch from now())::bigint
    ) on conflict do nothing;

  -- Handle Reopening
  elsif v_old_status = 'completed' and p_next_status = 'in_progress' then
    v_prior_completed_at := v_proj.completed_at;

    update public.projects
    set status = 'in_progress',
        completed_at = null,
        updated_by = v_user_id,
        updated_at = now()
    where id = p_project_id;

    insert into public.audit_logs (
      entity_type,
      entity_id,
      project_id,
      action,
      old_status,
      new_status,
      changed_fields,
      actor_id,
      actor_role
    ) values (
      'project',
      p_project_id,
      p_project_id,
      'project_reopened',
      'completed',
      'in_progress',
      jsonb_build_object(
        'reopen_reason', p_reopen_reason,
        'prior_completed_at', v_prior_completed_at
      ),
      v_user_id,
      v_actor_role
    );

    insert into public.notification_events (
      trigger,
      entity_type,
      entity_id,
      project_id,
      actor_id,
      payload,
      deduplication_key
    ) values (
      'system',
      'project',
      p_project_id,
      p_project_id,
      v_user_id,
      jsonb_build_object('action', 'project_reopened', 'reopen_reason', p_reopen_reason),
      'project_reopened:' || p_project_id || ':' || extract(epoch from now())::bigint
    ) on conflict do nothing;

  -- Other Transitions
  else
    update public.projects
    set status = p_next_status,
        updated_by = v_user_id,
        updated_at = now()
    where id = p_project_id;

    insert into public.audit_logs (
      entity_type,
      entity_id,
      project_id,
      action,
      old_status,
      new_status,
      changed_fields,
      actor_id,
      actor_role
    ) values (
      'project',
      p_project_id,
      p_project_id,
      'project_status_changed',
      v_old_status::text,
      p_next_status::text,
      '{}'::jsonb,
      v_user_id,
      v_actor_role
    );
  end if;

  return jsonb_build_object(
    'project_id', p_project_id,
    'old_status', v_old_status,
    'new_status', p_next_status
  );
end;
$function$;

create or replace function public.recover_project_status(p_project_id uuid, p_target_status public.project_status, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_proj record;
  v_user_id uuid := auth.uid();
  v_old_status public.project_status;
begin
  if not (select private.is_admin()) then
    raise exception 'Only Admin can recover project status';
  end if;

  if p_reason is null or char_length(btrim(p_reason)) = 0 then
    raise exception 'Recovery reason is mandatory';
  end if;

  if p_target_status not in ('planning', 'in_progress', 'paused') then
    raise exception 'Target status % is not an allowed recovery status. Allowed: planning, in_progress, paused', p_target_status;
  end if;

  select * into v_proj
  from public.projects
  where id = p_project_id and deleted_at is null and archived_at is null
  for update;

  if not found then
    raise exception 'Project % not found or deleted', p_project_id;
  end if;

  v_old_status := v_proj.status;
  update public.projects
  set status = p_target_status,
      completed_at = null,
      updated_by = v_user_id,
      updated_at = now()
  where id = p_project_id;

  insert into public.audit_logs (
    entity_type, entity_id, project_id, action, old_status, new_status, changed_fields, actor_id, actor_role
  ) values (
    'project', p_project_id, p_project_id, 'admin_project_recovered',
    v_old_status::text, p_target_status::text,
    jsonb_build_object('recovery', true, 'reason', p_reason),
    v_user_id, 'admin'
  );

  return jsonb_build_object(
    'project_id', p_project_id,
    'old_status', v_old_status,
    'target_status', p_target_status,
    'recovered', true
  );
end;
$function$;

create or replace function public.transition_task_status(
  p_task_id uuid,
  p_next_status public.task_status,
  p_reopen_reason text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_task record;
  v_user_id uuid := auth.uid();
  v_actor_role public.app_role;
  v_is_lead boolean;
  v_is_client_assignee boolean;
  v_is_operator_assignee boolean;
  v_pending_submissions integer;
begin
  select t.*
  into v_task
  from public.tasks t
  join public.projects p on p.id = t.project_id and p.deleted_at is null and p.archived_at is null
  where t.id = p_task_id and t.deleted_at is null and t.archived_at is null
  for update of t;

  if not found then
    raise exception 'Task % not found or deleted', p_task_id;
  end if;

  v_actor_role := (select private.current_user_role());
  v_is_lead := (select private.is_admin()) or (select private.is_project_lead(v_task.project_id));
  v_is_client_assignee := (v_task.task_type = 'client_request' and v_task.assignee_id = v_user_id and v_actor_role = 'client');
  v_is_operator_assignee := (v_task.assignee_id = v_user_id and v_actor_role = 'operator');

  if v_is_client_assignee then
    -- Client assignee constrained transitions
    if v_task.status = 'pending' and p_next_status in ('in_progress', 'completed') then
      null;
    elsif v_task.status = 'in_progress' and p_next_status = 'completed' then
      null;
    else
      raise exception 'Client assignees can only transition pending -> in_progress/completed or in_progress -> completed';
    end if;

    if p_next_status = 'completed' then
      select count(*)
      into v_pending_submissions
      from public.deliverables
      where task_id = p_task_id
        and workflow_type = 'client_submission'
        and status <> 'submitted'
        and deleted_at is null
        and archived_at is null;

      if v_pending_submissions > 0 then
        raise exception 'Cannot complete client request task while % client submissions remain unsubmitted', v_pending_submissions;
      end if;
    end if;
  elsif v_is_lead or v_is_operator_assignee then
    -- Valid state machine transitions
    if v_task.status = 'pending' and p_next_status in ('in_progress', 'blocked') then
      null;
    elsif v_task.status = 'in_progress' and p_next_status in ('pending', 'in_review', 'blocked') then
      null;
    elsif v_task.status = 'in_review' and p_next_status in ('in_progress', 'completed') then
      null;
    elsif v_task.status = 'blocked' and p_next_status in ('pending', 'in_progress') then
      null;
    elsif v_task.status = 'completed' and p_next_status in ('in_progress') then
      if not v_is_lead then
        raise exception 'Only PM Lead/Admin can reopen completed task';
      end if;
      if p_reopen_reason is null or char_length(btrim(p_reopen_reason)) = 0 then
        raise exception 'Reopening a completed task requires a non-empty reason';
      end if;
    elsif v_task.status = p_next_status then
      return jsonb_build_object('task_id', p_task_id, 'status', v_task.status);
    else
      raise exception 'Illegal transition from % to % for task %', v_task.status, p_next_status, p_task_id;
    end if;
  else
    raise exception 'Not authorized to transition task %', p_task_id;
  end if;

  update public.tasks
  set status = p_next_status,
      started_at = case when p_next_status = 'in_progress' and started_at is null then now() else started_at end,
      completed_at = case when p_next_status = 'completed' then now() else null end,
      updated_by = v_user_id,
      updated_at = now()
  where id = p_task_id;

  -- Audit log
  insert into public.audit_logs (
    entity_type,
    entity_id,
    project_id,
    action,
    old_status,
    new_status,
    changed_fields,
    actor_id,
    actor_role
  ) values (
    'task',
    p_task_id,
    v_task.project_id,
    'task_status_changed',
    v_task.status::text,
    p_next_status::text,
    case when p_reopen_reason is not null then jsonb_build_object('reopen_reason', p_reopen_reason) else '{}'::jsonb end,
    v_user_id,
    v_actor_role
  );

  -- Notification Event
  insert into public.notification_events (
    trigger,
    entity_type,
    entity_id,
    project_id,
    actor_id,
    payload,
    deduplication_key
  ) values (
    'task_status_changed',
    'task',
    p_task_id,
    v_task.project_id,
    v_user_id,
    jsonb_build_object('task_title', v_task.title, 'old_status', v_task.status, 'new_status', p_next_status),
    'task_status_changed:' || p_task_id || ':' || p_next_status || ':' || extract(epoch from now())::bigint
  ) on conflict do nothing;

  return jsonb_build_object(
    'task_id', p_task_id,
    'old_status', v_task.status,
    'new_status', p_next_status
  );
end;
$function$;

create or replace function public.mark_deliverable_delivered(p_deliverable_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_deliv record;
  v_user_id uuid := auth.uid();
  v_event_id uuid;
  v_recipient record;
begin
  select d.*
  into v_deliv
  from public.deliverables d
  join public.tasks t on t.id = d.task_id and t.deleted_at is null and t.archived_at is null
  join public.projects p on p.id = d.project_id and p.deleted_at is null and p.archived_at is null
  where d.id = p_deliverable_id and d.deleted_at is null and d.archived_at is null
  for update of d;

  if not found then
    raise exception 'Deliverable % not found or deleted', p_deliverable_id;
  end if;

  if not ((select private.is_admin()) or (select private.is_project_lead(v_deliv.project_id))) then
    raise exception 'Only active PM Lead or Admin can mark deliverable delivered';
  end if;

  if v_deliv.status <> 'approved' then
    raise exception 'Deliverable must be approved before marking delivered (current status: %)', v_deliv.status;
  end if;

  update public.deliverables
  set status = 'delivered',
      delivered_at = now(),
      last_activity_at = now(),
      updated_by = v_user_id,
      updated_at = now()
  where id = p_deliverable_id;

  -- Audit Log
  insert into public.audit_logs (
    entity_type,
    entity_id,
    project_id,
    action,
    old_status,
    new_status,
    changed_fields,
    actor_id,
    actor_role
  ) values (
    'deliverable',
    p_deliverable_id,
    v_deliv.project_id,
    'deliverable_delivered',
    'approved',
    'delivered',
    '{}'::jsonb,
    v_user_id,
    (select private.current_user_role())
  );

  -- Notification Event
  insert into public.notification_events (
    trigger,
    entity_type,
    entity_id,
    project_id,
    actor_id,
    payload,
    deduplication_key
  ) values (
    'deliverable_delivered',
    'deliverable',
    p_deliverable_id,
    v_deliv.project_id,
    v_user_id,
    jsonb_build_object('deliverable_title', v_deliv.title),
    'deliverable_delivered:' || p_deliverable_id || ':' || extract(epoch from now())::bigint
  ) on conflict do nothing
  returning id into v_event_id;

  if v_event_id is not null then
    for v_recipient in
      select pm.user_id
      from public.project_members pm
      where pm.project_id = v_deliv.project_id
        and pm.receives_notifications = true
        and pm.deleted_at is null
    loop
      insert into public.notification_recipients (
        event_id,
        user_id,
        channel,
        delivery_status
      ) values (
        v_event_id,
        v_recipient.user_id,
        'in_app',
        'pending'
      ) on conflict do nothing;
    end loop;
  end if;

  return jsonb_build_object(
    'deliverable_id', p_deliverable_id,
    'status', 'delivered',
    'delivered_at', now()
  );
end;
$function$;

create or replace function public.reopen_client_deliverable(p_deliverable_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_deliv record;
  v_user_id uuid := auth.uid();
  v_event_id uuid;
begin
  select d.*
  into v_deliv
  from public.deliverables d
  join public.tasks t on t.id = d.task_id and t.deleted_at is null and t.archived_at is null
  join public.projects p on p.id = d.project_id and p.deleted_at is null and p.archived_at is null
  where d.id = p_deliverable_id and d.deleted_at is null and d.archived_at is null
  for update of d;

  if not found then
    raise exception 'Deliverable % not found or deleted', p_deliverable_id;
  end if;

  if not ((select private.is_admin()) or (select private.is_project_lead(v_deliv.project_id))) then
    raise exception 'Only an active PM Lead or Admin can reopen a client submission';
  end if;

  if v_deliv.workflow_type <> 'client_submission' then
    raise exception 'Deliverable % is not a client_submission workflow', p_deliverable_id;
  end if;

  if v_deliv.status <> 'submitted' then
    raise exception 'Deliverable % is not currently submitted (status: %)', p_deliverable_id, v_deliv.status;
  end if;

  if p_reason is null or char_length(btrim(p_reason)) = 0 then
    raise exception 'A non-empty reason is required to reopen a client submission';
  end if;

  update public.deliverables
  set status = 'pending',
      last_activity_at = now(),
      updated_by = v_user_id,
      updated_at = now()
  where id = p_deliverable_id;

  insert into public.audit_logs (
    entity_type, entity_id, project_id, action, old_status, new_status, changed_fields, actor_id, actor_role
  ) values (
    'deliverable', p_deliverable_id, v_deliv.project_id, 'client_submission_reopened',
    'submitted', 'pending', jsonb_build_object('reason', p_reason),
    v_user_id, (select private.current_user_role())
  );

  insert into public.notification_events (
    trigger, entity_type, entity_id, project_id, actor_id, payload, deduplication_key
  ) values (
    'client_submission_reopened', 'deliverable', p_deliverable_id, v_deliv.project_id,
    v_user_id, jsonb_build_object('deliverable_title', v_deliv.title, 'reason', p_reason),
    'client_submission_reopened:' || p_deliverable_id || ':' || extract(epoch from now())::bigint
  ) on conflict (deduplication_key) do nothing
  returning id into v_event_id;

  if v_event_id is not null then
    insert into public.notification_recipients (
      event_id, user_id, channel, delivery_status
    ) values (
      v_event_id, v_deliv.assignee_id, 'in_app', 'pending'
    ) on conflict do nothing;
  end if;

  return jsonb_build_object('deliverable_id', p_deliverable_id, 'status', 'pending', 'reason', p_reason);
end;
$function$;

create or replace function public.review_deliverable(
  p_deliverable_id uuid,
  p_stage public.review_stage,
  p_decision public.review_decision,
  p_comments text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_deliv record;
  v_version record;
  v_user_id uuid := auth.uid();
  v_actor_role public.app_role;
  v_next_status public.deliverable_status;
  v_feedback_id uuid;
  v_event_id uuid;
  v_trigger public.notification_trigger;
  v_recipient record;
begin
  select d.*
  into v_deliv
  from public.deliverables d
  join public.tasks t on t.id = d.task_id and t.deleted_at is null and t.archived_at is null
  join public.projects p on p.id = d.project_id and p.deleted_at is null and p.archived_at is null
  where d.id = p_deliverable_id and d.deleted_at is null and d.archived_at is null
  for update of d;

  if not found then
    raise exception 'Deliverable % not found or deleted', p_deliverable_id;
  end if;

  if v_deliv.workflow_type <> 'production' then
    raise exception 'Deliverable % is not a production workflow', p_deliverable_id;
  end if;

  v_actor_role := (select private.current_user_role());

  -- Current version record
  select * into v_version
  from public.deliverable_versions
  where deliverable_id = p_deliverable_id
    and version_number = v_deliv.current_version_number;

  if not found then
    raise exception 'No current version found for deliverable %', p_deliverable_id;
  end if;

  -- Stage & Role validation
  if p_stage = 'internal' then
    if v_deliv.status <> 'awaiting_internal_review' then
      raise exception 'Deliverable % is not in awaiting_internal_review (status: %)', p_deliverable_id, v_deliv.status;
    end if;
    if not ((select private.is_admin()) or (select private.is_project_lead(v_deliv.project_id))) then
      raise exception 'Only an active PM Lead or Admin can perform internal review';
    end if;

    if p_decision = 'approved' then
      v_next_status := 'awaiting_client_review';
      v_trigger := 'internal_review_approved';
    else
      if p_comments is null or char_length(btrim(p_comments)) = 0 then
        raise exception 'Comments are mandatory when requesting internal changes';
      end if;
      v_next_status := 'pending';
      v_trigger := 'internal_changes_requested';
    end if;

  elsif p_stage = 'client' then
    if v_deliv.status <> 'awaiting_client_review' then
      raise exception 'Deliverable % is not in awaiting_client_review (status: %)', p_deliverable_id, v_deliv.status;
    end if;
    if not (select private.is_project_client(v_deliv.project_id)) then
      raise exception 'Only an active Client member of project % can perform client review', v_deliv.project_id;
    end if;

    if p_decision = 'approved' then
      v_next_status := 'approved';
      v_trigger := 'client_review_approved';
    else
      if p_comments is null or char_length(btrim(p_comments)) = 0 then
        raise exception 'Comments are mandatory when requesting client changes';
      end if;
      v_next_status := 'changes_requested';
      v_trigger := 'client_changes_requested';
    end if;
  end if;

  -- Insert Feedback
  insert into public.deliverable_feedback (
    deliverable_id,
    version_id,
    stage,
    decision,
    comments,
    reviewed_by
  ) values (
    p_deliverable_id,
    v_version.id,
    p_stage,
    p_decision,
    p_comments,
    v_user_id
  ) returning id into v_feedback_id;

  -- Update Deliverable
  update public.deliverables
  set status = v_next_status,
      approved_at = case when v_next_status = 'approved' then now() else approved_at end,
      last_activity_at = now(),
      is_stalled = false,
      stalled_at = null,
      updated_by = v_user_id,
      updated_at = now()
  where id = p_deliverable_id;

  -- Audit Log
  insert into public.audit_logs (
    entity_type,
    entity_id,
    project_id,
    action,
    old_status,
    new_status,
    changed_fields,
    actor_id,
    actor_role
  ) values (
    'deliverable',
    p_deliverable_id,
    v_deliv.project_id,
    'deliverable_reviewed',
    v_deliv.status::text,
    v_next_status::text,
    jsonb_build_object(
      'stage', p_stage,
      'decision', p_decision,
      'version_id', v_version.id,
      'feedback_id', v_feedback_id
    ),
    v_user_id,
    v_actor_role
  );

  -- Notification Event
  insert into public.notification_events (
    trigger,
    entity_type,
    entity_id,
    project_id,
    actor_id,
    payload,
    deduplication_key
  ) values (
    v_trigger,
    'deliverable',
    p_deliverable_id,
    v_deliv.project_id,
    v_user_id,
    jsonb_build_object(
      'deliverable_title', v_deliv.title,
      'stage', p_stage,
      'decision', p_decision,
      'comments', p_comments
    ),
    'deliverable_reviewed:' || p_deliverable_id || ':' || v_version.id || ':' || p_stage || ':' || extract(epoch from now())::bigint
  ) on conflict (deduplication_key) do nothing
  returning id into v_event_id;

  if v_event_id is not null then
    -- Fan out notification to Assignee and PMs
    for v_recipient in
      select pm.user_id
      from public.project_members pm
      where pm.project_id = v_deliv.project_id
        and (
          pm.user_id = v_deliv.assignee_id
          or pm.member_type in ('pm_lead', 'pm_watcher')
        )
        and pm.receives_notifications = true
        and pm.deleted_at is null
    loop
      insert into public.notification_recipients (
        event_id,
        user_id,
        channel,
        delivery_status
      ) values (
        v_event_id,
        v_recipient.user_id,
        'in_app',
        'pending'
      ) on conflict do nothing;
    end loop;
  end if;

  return jsonb_build_object(
    'deliverable_id', p_deliverable_id,
    'stage', p_stage,
    'decision', p_decision,
    'next_status', v_next_status,
    'feedback_id', v_feedback_id
  );
end;
$function$;

create or replace function public.submit_client_deliverable(
  p_deliverable_id uuid,
  p_submission_url text,
  p_submission_note text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_deliv record;
  v_user_id uuid := auth.uid();
  v_provider public.submission_provider;
  v_submission_note text := nullif(btrim(p_submission_note), '');
  v_new_version integer;
  v_version_id uuid;
  v_event_id uuid;
  v_pm record;
begin
  select d.*
  into v_deliv
  from public.deliverables d
  join public.tasks t on t.id = d.task_id and t.deleted_at is null and t.archived_at is null
  join public.projects p on p.id = d.project_id and p.deleted_at is null and p.archived_at is null
  where d.id = p_deliverable_id and d.deleted_at is null and d.archived_at is null
  for update of d;

  if not found then
    raise exception 'Deliverable % not found or deleted', p_deliverable_id;
  end if;

  if v_deliv.workflow_type <> 'client_submission' then
    raise exception 'Deliverable % is not a client_submission workflow', p_deliverable_id;
  end if;

  if v_deliv.assignee_id <> v_user_id then
    raise exception 'Only the direct Client assignee can submit this deliverable';
  end if;

  if v_deliv.status <> 'pending' then
    raise exception 'Deliverable % is not pending (status: %)', p_deliverable_id, v_deliv.status;
  end if;

  if not private.is_valid_client_submission_url(p_submission_url) then
    raise exception 'Submission URL must be a valid public HTTPS URL';
  end if;

  if v_submission_note is not null and char_length(v_submission_note) > 1000 then
    raise exception 'Submission note must be 1000 characters or fewer';
  end if;

  v_provider := private.classify_client_submission_provider(p_submission_url);
  v_new_version := v_deliv.current_version_number + 1;

  insert into public.deliverable_versions (
    deliverable_id,
    version_number,
    submission_url,
    submission_provider,
    submitted_by,
    submission_note
  ) values (
    p_deliverable_id,
    v_new_version,
    p_submission_url,
    v_provider,
    v_user_id,
    v_submission_note
  ) returning id into v_version_id;

  update public.deliverables
  set status = 'submitted',
      current_version_number = v_new_version,
      last_activity_at = now(),
      updated_by = v_user_id,
      updated_at = now()
  where id = p_deliverable_id;

  insert into public.audit_logs (
    entity_type,
    entity_id,
    project_id,
    action,
    old_status,
    new_status,
    changed_fields,
    actor_id,
    actor_role
  ) values (
    'deliverable',
    p_deliverable_id,
    v_deliv.project_id,
    'client_deliverable_submitted',
    'pending',
    'submitted',
    jsonb_build_object(
      'version_number', v_new_version,
      'version_id', v_version_id,
      'provider', v_provider
    ),
    v_user_id,
    'client'
  );

  insert into public.notification_events (
    trigger,
    entity_type,
    entity_id,
    project_id,
    actor_id,
    payload,
    deduplication_key
  ) values (
    'client_submission_received',
    'deliverable',
    p_deliverable_id,
    v_deliv.project_id,
    v_user_id,
    jsonb_build_object(
      'deliverable_title', v_deliv.title,
      'version_number', v_new_version,
      'version_id', v_version_id
    ),
    'client_submission_received:' || p_deliverable_id || ':v' || v_new_version
  ) on conflict (deduplication_key) do nothing
  returning id into v_event_id;

  if v_event_id is not null then
    for v_pm in
      select pm.user_id
      from public.project_members pm
      where pm.project_id = v_deliv.project_id
        and pm.member_type in ('pm_lead', 'pm_watcher')
        and pm.receives_notifications = true
        and pm.deleted_at is null
    loop
      insert into public.notification_recipients (
        event_id,
        user_id,
        channel,
        delivery_status
      ) values (
        v_event_id,
        v_pm.user_id,
        'in_app',
        'pending'
      ) on conflict do nothing;
    end loop;
  end if;

  return jsonb_build_object(
    'deliverable_id', p_deliverable_id,
    'version_id', v_version_id,
    'version_number', v_new_version,
    'provider', v_provider,
    'status', 'submitted'
  );
end;
$function$;

create or replace function public.submit_deliverable_version(
  p_deliverable_id uuid,
  p_submission_url text,
  p_submission_note text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_deliv record;
  v_user_id uuid := auth.uid();
  v_new_version integer;
  v_version_id uuid;
  v_event_id uuid;
  v_pm record;
begin
  select d.*
  into v_deliv
  from public.deliverables d
  join public.tasks t on t.id = d.task_id and t.deleted_at is null and t.archived_at is null
  join public.projects p on p.id = d.project_id and p.deleted_at is null and p.archived_at is null
  where d.id = p_deliverable_id and d.deleted_at is null and d.archived_at is null
  for update of d;

  if not found then
    raise exception 'Deliverable % not found or deleted', p_deliverable_id;
  end if;

  if v_deliv.workflow_type <> 'production' then
    raise exception 'Deliverable % is not a production workflow; use submit_client_deliverable', p_deliverable_id;
  end if;

  if not (
    v_deliv.assignee_id = v_user_id
    or (select private.is_admin())
    or (select private.is_project_lead(v_deliv.project_id))
  ) then
    raise exception 'Not authorized to submit version for deliverable %', p_deliverable_id;
  end if;

  if v_deliv.status not in ('pending', 'changes_requested') then
    raise exception 'Cannot submit version while deliverable status is % (must be pending or changes_requested)', v_deliv.status;
  end if;

  -- Keep the direct command aligned with the authoritative version trigger.
  if not private.is_valid_production_google_drive_submission_url(p_submission_url) then
    raise exception 'Production deliverable submission URL must be a valid Google Drive link';
  end if;

  v_new_version := v_deliv.current_version_number + 1;

  -- Insert Version
  insert into public.deliverable_versions (
    deliverable_id,
    version_number,
    submission_url,
    submission_provider,
    submitted_by,
    submission_note
  ) values (
    p_deliverable_id,
    v_new_version,
    p_submission_url,
    'google_drive',
    v_user_id,
    p_submission_note
  ) returning id into v_version_id;

  -- Update Deliverable
  update public.deliverables
  set status = 'awaiting_internal_review',
      current_version_number = v_new_version,
      is_stalled = false,
      stalled_at = null,
      last_activity_at = now(),
      updated_by = v_user_id,
      updated_at = now()
  where id = p_deliverable_id;

  -- Audit Log
  insert into public.audit_logs (
    entity_type,
    entity_id,
    project_id,
    action,
    old_status,
    new_status,
    changed_fields,
    actor_id,
    actor_role
  ) values (
    'deliverable',
    p_deliverable_id,
    v_deliv.project_id,
    'deliverable_version_submitted',
    v_deliv.status::text,
    'awaiting_internal_review',
    jsonb_build_object('version_number', v_new_version, 'version_id', v_version_id),
    v_user_id,
    (select private.current_user_role())
  );

  -- Notification Event
  insert into public.notification_events (
    trigger,
    entity_type,
    entity_id,
    project_id,
    actor_id,
    payload,
    deduplication_key
  ) values (
    'deliverable_submitted',
    'deliverable',
    p_deliverable_id,
    v_deliv.project_id,
    v_user_id,
    jsonb_build_object(
      'deliverable_title', v_deliv.title,
      'version_number', v_new_version,
      'version_id', v_version_id
    ),
    'deliverable_submitted:' || p_deliverable_id || ':v' || v_new_version
  ) on conflict (deduplication_key) do nothing
  returning id into v_event_id;

  -- Fan-out notification recipients to PM Leads and Watchers
  if v_event_id is not null then
    for v_pm in
      select pm.user_id
      from public.project_members pm
      where pm.project_id = v_deliv.project_id
        and pm.member_type in ('pm_lead', 'pm_watcher')
        and pm.receives_notifications = true
        and pm.deleted_at is null
    loop
      insert into public.notification_recipients (
        event_id,
        user_id,
        channel,
        delivery_status
      ) values (
        v_event_id,
        v_pm.user_id,
        'in_app',
        'pending'
      ) on conflict do nothing;
    end loop;
  end if;

  return jsonb_build_object(
    'deliverable_id', p_deliverable_id,
    'version_id', v_version_id,
    'version_number', v_new_version,
    'status', 'awaiting_internal_review'
  );
end;
$function$;

create or replace function public.report_broken_link(
  p_deliverable_id uuid,
  p_version_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_deliv record;
  v_version record;
  v_user_id uuid := auth.uid();
  v_report_id uuid;
  v_event_id uuid;
begin
  select d.*
  into v_deliv
  from public.deliverables d
  join public.tasks t on t.id = d.task_id and t.deleted_at is null and t.archived_at is null
  join public.projects p on p.id = d.project_id and p.deleted_at is null and p.archived_at is null
  where d.id = p_deliverable_id and d.deleted_at is null and d.archived_at is null;

  if not found then
    raise exception 'Deliverable % not found or deleted', p_deliverable_id;
  end if;

  if not (
    (select private.is_admin())
    or (select private.is_project_pm(v_deliv.project_id))
    or (select private.is_project_client(v_deliv.project_id))
  ) then
    raise exception 'Not authorized to report broken link for deliverable %', p_deliverable_id;
  end if;

  select * into v_version
  from public.deliverable_versions
  where id = p_version_id and deliverable_id = p_deliverable_id;

  if not found then
    raise exception 'Version % does not belong to deliverable %', p_version_id, p_deliverable_id;
  end if;

  insert into public.deliverable_link_reports (
    deliverable_id,
    version_id,
    reported_by,
    reason,
    status
  ) values (
    p_deliverable_id,
    p_version_id,
    v_user_id,
    p_reason,
    'open'
  ) returning id into v_report_id;

  -- Emit notification to version submitter
  insert into public.notification_events (
    trigger,
    entity_type,
    entity_id,
    project_id,
    actor_id,
    payload,
    deduplication_key
  ) values (
    'link_reported_broken',
    'link_report',
    v_report_id,
    v_deliv.project_id,
    v_user_id,
    jsonb_build_object(
      'deliverable_title', v_deliv.title,
      'version_number', v_version.version_number,
      'reason', p_reason
    ),
    'link_reported_broken:' || p_deliverable_id || ':' || p_version_id || ':' || extract(epoch from now())::bigint
  ) on conflict (deduplication_key) do nothing
  returning id into v_event_id;

  if v_event_id is not null then
    insert into public.notification_recipients (
      event_id,
      user_id,
      channel,
      delivery_status
    ) values (
      v_event_id,
      v_version.submitted_by,
      'in_app',
      'pending'
    ) on conflict do nothing;
  end if;

  return jsonb_build_object(
    'report_id', v_report_id,
    'status', 'open',
    'deliverable_id', p_deliverable_id,
    'version_id', p_version_id
  );
end;
$function$;

-- -----------------------------------------------------------------------------
-- 4.8. Incident, notification, and invitation projections (Group 5.6)
-- -----------------------------------------------------------------------------

create or replace function public.list_role_safe_link_incidents(
  p_project_id uuid default null::uuid,
  p_status public.link_report_status default null::public.link_report_status,
  p_from timestamp with time zone default (now() - '90 days'::interval),
  p_to timestamp with time zone default now(),
  p_before_reported_at timestamp with time zone default null::timestamp with time zone,
  p_before_incident_id uuid default null::uuid,
  p_limit integer default 25
)
returns table (
  incident_id uuid,
  deliverable_id uuid,
  project_id uuid,
  deliverable_title text,
  project_name text,
  incident_status public.link_report_status,
  reported_at timestamp with time zone,
  resolved_at timestamp with time zone,
  reason text,
  resolution_note text
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role public.app_role := (select private.current_user_role());
  v_is_admin boolean := (select private.is_admin());
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
begin
  if v_user_id is null or v_role is null then
    raise exception 'Authentication with an active profile is required';
  end if;

  if v_role not in ('admin', 'pm') then
    raise exception 'Only Admin or an active PM project member can list link incidents';
  end if;

  if p_from is null or p_to is null then
    raise exception 'Link incident date range is required';
  end if;

  if p_from >= p_to then
    raise exception 'Link incident date range must have p_from before p_to';
  end if;

  if p_to - p_from > interval '93 days' then
    raise exception 'Link incident date range cannot exceed 93 days';
  end if;

  if (
    (p_before_reported_at is null and p_before_incident_id is not null)
    or (
      p_before_reported_at is not null
      and p_before_incident_id is null
    )
  ) then
    raise exception 'Link incident cursor must be complete';
  end if;

  return query
  select
    lr.id as incident_id,
    d.id as deliverable_id,
    d.project_id,
    d.title as deliverable_title,
    p.name as project_name,
    lr.status as incident_status,
    lr.created_at as reported_at,
    lr.resolved_at,
    lr.reason,
    lr.resolution_note
  from public.deliverable_link_reports lr
  join public.deliverables d
    on d.id = lr.deliverable_id
    and d.deleted_at is null
    and d.archived_at is null
  join public.tasks t
    on t.id = d.task_id
    and t.deleted_at is null
    and t.archived_at is null
  join public.projects p
    on p.id = d.project_id
    and p.deleted_at is null
    and p.archived_at is null
  where (p_project_id is null or d.project_id = p_project_id)
    and (p_status is null or lr.status = p_status)
    and lr.created_at >= p_from
    and lr.created_at < p_to
    and (
      v_is_admin
      or (select private.is_project_pm(d.project_id))
    )
    and (
      p_before_reported_at is null
      or lr.created_at < p_before_reported_at
      or (
        lr.created_at = p_before_reported_at
        and lr.id < p_before_incident_id
      )
    )
  order by lr.created_at desc, lr.id desc
  limit v_limit;
end;
$function$;

create or replace function public.list_finalized_production_archive(
  p_project_id uuid default null::uuid,
  p_status public.deliverable_status default null::public.deliverable_status,
  p_from timestamp with time zone default (now() - '90 days'::interval),
  p_to timestamp with time zone default now(),
  p_before_finalized_at timestamp with time zone default null::timestamp with time zone,
  p_before_deliverable_id uuid default null::uuid,
  p_limit integer default 25
)
returns table (
  deliverable_id uuid,
  project_id uuid,
  deliverable_title text,
  final_status public.deliverable_status,
  current_version_number integer,
  finalized_at timestamp with time zone,
  project_name text,
  project_drive_folder_url text,
  current_submission_url text
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role public.app_role := (select private.current_user_role());
  v_is_admin boolean := (select private.is_admin());
  v_is_operator boolean;
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
begin
  if v_user_id is null or v_role is null then
    raise exception 'Authentication with an active profile is required';
  end if;

  v_is_operator := v_role = 'operator';

  if p_from is null or p_to is null then
    raise exception 'Finalized archive date range is required';
  end if;

  if p_from >= p_to then
    raise exception 'Finalized archive date range must have p_from before p_to';
  end if;

  if p_to - p_from > interval '93 days' then
    raise exception 'Finalized archive date range cannot exceed 93 days';
  end if;

  if p_status is not null and p_status not in ('approved', 'delivered') then
    raise exception 'Finalized archive status must be approved or delivered';
  end if;

  if (
    (p_before_finalized_at is null and p_before_deliverable_id is not null)
    or (
      p_before_finalized_at is not null
      and p_before_deliverable_id is null
    )
  ) then
    raise exception 'Finalized archive cursor must be complete';
  end if;

  return query
  with authorized_archive as (
    select
      d.id as deliverable_id,
      d.project_id as source_project_id,
      d.title as deliverable_title,
      d.status as final_status,
      d.current_version_number,
      coalesce(d.delivered_at, d.approved_at) as finalized_at,
      p.name as project_name,
      p.drive_folder_url as project_drive_folder_url,
      v.submission_url as current_submission_url,
      (
        v_is_admin
        or (select private.is_project_pm(d.project_id))
        or (select private.is_project_client(d.project_id))
      ) as can_navigate_project
    from public.deliverables d
    join public.tasks t
      on t.id = d.task_id
      and t.deleted_at is null
      and t.archived_at is null
    join public.projects p
      on p.id = d.project_id
      and p.deleted_at is null
      and p.archived_at is null
    left join public.deliverable_versions v
      on v.deliverable_id = d.id
      and v.version_number = d.current_version_number
    where d.deleted_at is null
      and d.archived_at is null
      and d.workflow_type = 'production'
      and d.status in ('approved', 'delivered')
      and coalesce(d.delivered_at, d.approved_at) is not null
      and (p_project_id is null or d.project_id = p_project_id)
      and (p_status is null or d.status = p_status)
      and coalesce(d.delivered_at, d.approved_at) >= p_from
      and coalesce(d.delivered_at, d.approved_at) < p_to
      and (
        v_is_admin
        or (select private.is_project_pm(d.project_id))
        or (select private.is_project_client(d.project_id))
        or (v_is_operator and d.assignee_id = v_user_id)
      )
  )
  select
    a.deliverable_id,
    case
      when a.can_navigate_project then a.source_project_id
      else null::uuid
    end as project_id,
    a.deliverable_title,
    a.final_status,
    a.current_version_number,
    a.finalized_at,
    a.project_name,
    case
      when a.can_navigate_project then a.project_drive_folder_url
      else null::text
    end as project_drive_folder_url,
    a.current_submission_url
  from authorized_archive a
  where p_before_finalized_at is null
     or a.finalized_at < p_before_finalized_at
     or (
       a.finalized_at = p_before_finalized_at
       and a.deliverable_id < p_before_deliverable_id
     )
  order by a.finalized_at desc, a.deliverable_id desc
  limit v_limit;
end;
$function$;

create or replace function public.list_my_in_app_notifications(
  p_limit integer default 25,
  p_from timestamp with time zone default null::timestamp with time zone,
  p_to timestamp with time zone default null::timestamp with time zone,
  p_read_state boolean default null::boolean,
  p_before_created_at timestamp with time zone default null::timestamp with time zone,
  p_before_recipient_id uuid default null::uuid
)
returns table (
  recipient_id uuid,
  trigger public.notification_trigger,
  created_at timestamp with time zone,
  occurred_at timestamp with time zone,
  read_at timestamp with time zone,
  subject_kind text,
  subject_title text,
  project_name text,
  context_kind text,
  context_value text,
  navigation_kind text,
  navigation_project_id uuid,
  navigation_task_id uuid,
  navigation_deliverable_id uuid
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role public.app_role;
  v_from timestamptz;
  v_to timestamptz;
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
begin
  -- An Auth session alone is insufficient for this recipient history surface.
  select p.role
  into v_role
  from public.profiles p
  where p.id = v_user_id
    and p.is_active = true
    and p.deleted_at is null;

  if v_user_id is null or v_role is null then
    raise exception 'Authentication with an active profile is required';
  end if;

  -- Preserve M4's server-owned default and bounded explicit history contract.
  if p_from is null and p_to is null then
    v_to := statement_timestamp();
    v_from := v_to - interval '90 days';
  elsif p_from is null or p_to is null then
    raise exception 'Notification history range requires both bounds';
  else
    v_from := p_from;
    v_to := p_to;
  end if;

  if v_from >= v_to then
    raise exception 'Notification history range start must precede its end';
  end if;

  if v_to - v_from > interval '93 days' then
    raise exception 'Notification history range cannot exceed 93 days';
  end if;

  -- Cursor values are a complete ordered pair; timestamp-only continuation
  -- would omit same-timestamp recipient records at a page boundary.
  if (p_before_created_at is null) <> (p_before_recipient_id is null) then
    raise exception 'Notification history cursor is incomplete';
  end if;

  return query
  with inbox_rows as (
    select
      nr.id as resolved_recipient_id,
      nr.created_at as resolved_created_at,
      nr.read_at as resolved_read_at,
      ne.trigger as resolved_trigger,
      ne.entity_type as resolved_entity_type,
      ne.entity_id as resolved_entity_id,
      ne.project_id as resolved_event_project_id,
      ne.occurred_at as resolved_occurred_at,
      direct_task.id as direct_task_id,
      direct_task.project_id as direct_task_project_id,
      direct_task.assignee_id as direct_task_assignee_id,
      direct_task.task_type as direct_task_type,
      direct_task.title as direct_task_title,
      direct_task.deadline_at as direct_task_deadline_at,
      direct_deliverable.id as direct_deliverable_id,
      direct_deliverable.project_id as direct_deliverable_project_id,
      direct_deliverable.task_id as direct_deliverable_task_id,
      direct_deliverable.assignee_id as direct_deliverable_assignee_id,
      direct_deliverable.workflow_type as direct_deliverable_workflow_type,
      direct_deliverable.status as direct_deliverable_status,
      direct_deliverable.title as direct_deliverable_title,
      link_deliverable.id as link_deliverable_id,
      link_deliverable.project_id as link_deliverable_project_id,
      link_deliverable.task_id as link_deliverable_task_id,
      link_deliverable.assignee_id as link_deliverable_assignee_id,
      link_deliverable.workflow_type as link_deliverable_workflow_type,
      link_deliverable.status as link_deliverable_status,
      link_deliverable.title as link_deliverable_title
    from public.notification_recipients nr
    join public.notification_events ne
      on ne.id = nr.event_id
    left join public.tasks direct_task
      on ne.entity_type = 'task'
      and direct_task.id = ne.entity_id
      and direct_task.deleted_at is null
      and direct_task.archived_at is null
    left join public.deliverables direct_deliverable
      on ne.entity_type = 'deliverable'
      and direct_deliverable.id = ne.entity_id
      and direct_deliverable.deleted_at is null
      and direct_deliverable.archived_at is null
    left join public.tasks direct_deliv_task
      on direct_deliv_task.id = direct_deliverable.task_id
      and direct_deliv_task.deleted_at is null
      and direct_deliv_task.archived_at is null
    left join public.deliverable_link_reports link_report
      on ne.entity_type = 'link_report'
      and link_report.id = ne.entity_id
    left join public.deliverables link_deliverable
      on link_deliverable.id = link_report.deliverable_id
      and link_deliverable.deleted_at is null
      and link_deliverable.archived_at is null
    left join public.tasks link_deliv_task
      on link_deliv_task.id = link_deliverable.task_id
      and link_deliv_task.deleted_at is null
      and link_deliv_task.archived_at is null
    where nr.user_id = v_user_id
      and nr.channel = 'in_app'
      and nr.created_at >= v_from
      and nr.created_at < v_to
      and (p_read_state is null or (nr.read_at is not null) = p_read_state)
      and (
        p_before_created_at is null
        or nr.created_at < p_before_created_at
        or (
          nr.created_at = p_before_created_at
          and nr.id < p_before_recipient_id
        )
      )
    order by nr.created_at desc, nr.id desc
    limit v_limit
  ), resolved_targets as (
    select
      ir.*,
      case
        when ir.resolved_entity_type = 'project'
          and ir.resolved_entity_id = ir.resolved_event_project_id
          then ir.resolved_event_project_id
        when ir.resolved_entity_type = 'task'
          and ir.direct_task_id is not null
          and ir.direct_task_project_id = ir.resolved_event_project_id
          then ir.direct_task_project_id
        when ir.resolved_entity_type = 'deliverable'
          and ir.direct_deliverable_id is not null
          and ir.direct_deliverable_project_id = ir.resolved_event_project_id
          then ir.direct_deliverable_project_id
        when ir.resolved_entity_type = 'link_report'
          and ir.link_deliverable_id is not null
          and ir.link_deliverable_project_id = ir.resolved_event_project_id
          then ir.link_deliverable_project_id
        else null
      end as resolved_project_id,
      case
        when ir.resolved_entity_type = 'task'
          and ir.direct_task_id is not null
          and ir.direct_task_project_id = ir.resolved_event_project_id
          then ir.direct_task_id
        when ir.resolved_entity_type = 'deliverable'
          and ir.direct_deliverable_id is not null
          and ir.direct_deliverable_project_id = ir.resolved_event_project_id
          then ir.direct_deliverable_task_id
        when ir.resolved_entity_type = 'link_report'
          and ir.link_deliverable_id is not null
          and ir.link_deliverable_project_id = ir.resolved_event_project_id
          then ir.link_deliverable_task_id
        else null
      end as resolved_task_id,
      case
        when ir.resolved_entity_type = 'deliverable'
          and ir.direct_deliverable_id is not null
          and ir.direct_deliverable_project_id = ir.resolved_event_project_id
          then ir.direct_deliverable_id
        when ir.resolved_entity_type = 'link_report'
          and ir.link_deliverable_id is not null
          and ir.link_deliverable_project_id = ir.resolved_event_project_id
          then ir.link_deliverable_id
        else null
      end as resolved_deliverable_id,
      case
        when ir.resolved_entity_type = 'task'
          and ir.direct_task_id is not null
          and ir.direct_task_project_id = ir.resolved_event_project_id
          then ir.direct_task_title
        when ir.resolved_entity_type = 'deliverable'
          and ir.direct_deliverable_id is not null
          and ir.direct_deliverable_project_id = ir.resolved_event_project_id
          then ir.direct_deliverable_title
        when ir.resolved_entity_type = 'link_report'
          and ir.link_deliverable_id is not null
          and ir.link_deliverable_project_id = ir.resolved_event_project_id
          then ir.link_deliverable_title
        else null
      end as resolved_subject_title,
      case
        when ir.resolved_entity_type = 'task'
          and ir.direct_task_id is not null
          and ir.direct_task_project_id = ir.resolved_event_project_id
          then ir.direct_task_assignee_id
        when ir.resolved_entity_type = 'deliverable'
          and ir.direct_deliverable_id is not null
          and ir.direct_deliverable_project_id = ir.resolved_event_project_id
          then ir.direct_deliverable_assignee_id
        when ir.resolved_entity_type = 'link_report'
          and ir.link_deliverable_id is not null
          and ir.link_deliverable_project_id = ir.resolved_event_project_id
          then ir.link_deliverable_assignee_id
        else null
      end as resolved_assignee_id,
      case
        when ir.resolved_entity_type = 'task'
          and ir.direct_task_id is not null
          and ir.direct_task_project_id = ir.resolved_event_project_id
          then ir.direct_task_type
        else null
      end as resolved_task_type,
      case
        when ir.resolved_entity_type = 'deliverable'
          and ir.direct_deliverable_id is not null
          and ir.direct_deliverable_project_id = ir.resolved_event_project_id
          then ir.direct_deliverable_workflow_type
        when ir.resolved_entity_type = 'link_report'
          and ir.link_deliverable_id is not null
          and ir.link_deliverable_project_id = ir.resolved_event_project_id
          then ir.link_deliverable_workflow_type
        else null
      end as resolved_deliverable_workflow_type,
      case
        when ir.resolved_entity_type = 'deliverable'
          and ir.direct_deliverable_id is not null
          and ir.direct_deliverable_project_id = ir.resolved_event_project_id
          then ir.direct_deliverable_status
        when ir.resolved_entity_type = 'link_report'
          and ir.link_deliverable_id is not null
          and ir.link_deliverable_project_id = ir.resolved_event_project_id
          then ir.link_deliverable_status
        else null
      end as resolved_deliverable_status,
      case
        when ir.resolved_entity_type = 'task'
          and ir.direct_task_id is not null
          and ir.direct_task_project_id = ir.resolved_event_project_id
          then ir.direct_task_deadline_at
        else null
      end as resolved_task_deadline_at
    from inbox_rows ir
  ), authorized_context as (
    select
      rt.*,
      project_row.name as resolved_project_name,
      project_row.project_type as resolved_project_type,
      case
        when rt.resolved_project_id is null
          or project_row.id is null then false
        when v_role = 'admin' then true
        when v_role = 'pm' then exists (
          select 1
          from public.project_members pm
          where pm.project_id = rt.resolved_project_id
            and pm.user_id = v_user_id
            and pm.member_type in ('pm_lead', 'pm_watcher')
            and pm.deleted_at is null
        )
        when v_role = 'operator' then rt.resolved_assignee_id = v_user_id
        when v_role = 'client' then exists (
          select 1
          from public.project_members cm
          where cm.project_id = rt.resolved_project_id
            and cm.user_id = v_user_id
            and cm.member_type = 'client'
            and cm.deleted_at is null
        )
        else false
      end as may_view_context
    from resolved_targets rt
    left join public.projects project_row
      on project_row.id = rt.resolved_project_id
      and project_row.deleted_at is null
      and project_row.archived_at is null
  ), projected as (
    select
      ac.*,
      case
        when ac.may_view_context and ac.resolved_deliverable_id is not null
          then 'deliverable'
        when ac.may_view_context and ac.resolved_task_id is not null
          then 'task'
        when ac.may_view_context and ac.resolved_project_id is not null
          then 'project'
        when ac.resolved_trigger in ('user_invited', 'invite_expiring')
          then 'invitation'
        else 'system'
      end as safe_subject_kind,
      case
        when ac.may_view_context and ac.resolved_subject_title is not null
          then ac.resolved_subject_title
        when ac.may_view_context and ac.resolved_project_id is not null
          then ac.resolved_project_name
        else null
      end as safe_subject_title,
      case
        when ac.may_view_context then ac.resolved_project_name
        else null
      end as safe_project_name,
      case
        when ac.may_view_context
          and ac.resolved_trigger in (
            'deadline_24h',
            'deadline_12h',
            'deadline_6h',
            'deadline_overdue'
          )
          and ac.resolved_task_deadline_at is not null
          then 'task_deadline'
        else 'none'
      end as safe_context_kind,
      case
        when ac.may_view_context
          and ac.resolved_trigger in (
            'deadline_24h',
            'deadline_12h',
            'deadline_6h',
            'deadline_overdue'
          )
          and ac.resolved_task_deadline_at is not null
          then ac.resolved_task_deadline_at::text
        else null
      end as safe_context_value
    from authorized_context ac
  )
  select
    projected.resolved_recipient_id as recipient_id,
    projected.resolved_trigger as trigger,
    projected.resolved_created_at as created_at,
    projected.resolved_occurred_at as occurred_at,
    projected.resolved_read_at as read_at,
    projected.safe_subject_kind as subject_kind,
    projected.safe_subject_title as subject_title,
    projected.safe_project_name as project_name,
    projected.safe_context_kind as context_kind,
    projected.safe_context_value as context_value,
    case
      when not projected.may_view_context then 'none'
      when v_role = 'admin' and projected.resolved_deliverable_id is not null
        then 'admin_project_deliverables'
      when v_role = 'admin' and projected.resolved_task_id is not null
        then 'admin_project_tasks'
      when v_role = 'admin' and projected.resolved_project_id is not null
        then 'admin_project_overview'
      when v_role = 'pm' and projected.resolved_deliverable_id is not null
        then 'pm_project_deliverables'
      when v_role = 'pm' and projected.resolved_task_id is not null
        then 'pm_project_tasks'
      when v_role = 'pm' and projected.resolved_project_id is not null
        then 'pm_project_overview'
      when v_role = 'operator'
        and projected.resolved_task_id is not null
        and projected.resolved_assignee_id = v_user_id
        then 'operator_task'
      when v_role = 'client'
        and projected.resolved_task_id is not null
        and projected.resolved_task_type = 'client_request'
        and projected.resolved_assignee_id = v_user_id
        then 'client_task'
      when v_role = 'client'
        and projected.resolved_deliverable_id is not null
        and projected.resolved_deliverable_workflow_type = 'production'
        and projected.resolved_deliverable_status in (
          'awaiting_client_review',
          'approved',
          'delivered',
          'changes_requested'
        )
        and projected.resolved_project_type = 'client'
        then 'client_deliverable_review'
      when v_role = 'client'
        and projected.resolved_project_id is not null
        and projected.resolved_project_type = 'client'
        and projected.resolved_deliverable_id is null
        and not (
          projected.resolved_task_id is not null
          and projected.resolved_task_type = 'client_request'
          and projected.resolved_assignee_id = v_user_id
        )
        then 'client_project'
      else 'none'
    end as navigation_kind,
    case
      when projected.may_view_context
        and v_role in ('admin', 'pm')
        and projected.resolved_project_id is not null
        then projected.resolved_project_id
      when projected.may_view_context
        and v_role = 'client'
        and projected.resolved_project_type = 'client'
        and projected.resolved_deliverable_id is null
        and not (
          projected.resolved_task_id is not null
          and projected.resolved_task_type = 'client_request'
          and projected.resolved_assignee_id = v_user_id
        )
        and projected.resolved_project_id is not null
        then projected.resolved_project_id
      else null
    end as navigation_project_id,
    case
      when projected.may_view_context
        and (
          (v_role = 'operator' and projected.resolved_assignee_id = v_user_id)
          or (
            v_role = 'client'
            and projected.resolved_task_type = 'client_request'
            and projected.resolved_assignee_id = v_user_id
          )
        )
        and projected.resolved_task_id is not null
        then projected.resolved_task_id
      else null
    end as navigation_task_id,
    case
      when projected.may_view_context
        and v_role = 'client'
        and projected.resolved_deliverable_id is not null
        and projected.resolved_deliverable_workflow_type = 'production'
        and projected.resolved_deliverable_status in (
          'awaiting_client_review',
          'approved',
          'delivered',
          'changes_requested'
        )
        and projected.resolved_project_type = 'client'
        then projected.resolved_deliverable_id
      else null
    end as navigation_deliverable_id
  from projected
  order by projected.resolved_created_at desc, projected.resolved_recipient_id desc;
end;
$function$;

create or replace function public.list_suppressed_notification_operations(
  p_limit integer default 50,
  p_before_suppressed_at timestamp with time zone default null::timestamp with time zone,
  p_before_event_id uuid default null::uuid,
  p_before_channel public.notification_channel default null::public.notification_channel
)
returns table (
  event_id uuid,
  trigger public.notification_trigger,
  project_id uuid,
  project_name text,
  channel public.notification_channel,
  delivery_status public.notification_delivery_status,
  suppression_reason text,
  recipient_count bigint,
  first_created_at timestamp with time zone,
  last_suppressed_at timestamp with time zone
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_is_admin boolean := (select private.is_admin());
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if (
    (p_before_suppressed_at is null
      and (p_before_event_id is not null or p_before_channel is not null))
    or
    (p_before_suppressed_at is not null
      and (p_before_event_id is null or p_before_channel is null))
  ) then
    raise exception 'Suppressed notification operations cursor must be complete';
  end if;

  if p_before_channel is not null
     and p_before_channel not in ('email', 'whatsapp') then
    raise exception 'Suppressed notification operations cursor channel is invalid';
  end if;

  return query
  with authorized_operations as (
    select e.id as event_id,
           e.trigger,
           e.project_id,
           p.name as project_name,
           nr.channel,
           nr.delivery_status,
           nr.suppression_reason,
           count(*)::bigint as recipient_count,
           min(nr.created_at) as first_created_at,
           max(nr.suppressed_at) as last_suppressed_at
    from public.notification_recipients nr
    join public.notification_events e on e.id = nr.event_id
    left join public.projects p on p.id = e.project_id and p.deleted_at is null and p.archived_at is null
    where nr.delivery_status = 'suppressed'
      and nr.channel in ('email', 'whatsapp')
      and (
        v_is_admin
        or (
          e.project_id is not null
          and p.id is not null
          and exists (
            select 1
            from public.project_members pm
            join public.profiles profile on profile.id = pm.user_id
            where pm.project_id = e.project_id
              and pm.user_id = v_user_id
              and pm.member_type = 'pm_lead'
              and pm.deleted_at is null
              and profile.role = 'pm'
              and profile.is_active = true
              and profile.deleted_at is null
          )
        )
      )
    group by e.id,
             e.trigger,
             e.project_id,
             p.name,
             nr.channel,
             nr.delivery_status,
             nr.suppression_reason
  )
  select o.event_id,
         o.trigger,
         o.project_id,
         o.project_name,
         o.channel,
         o.delivery_status,
         o.suppression_reason,
         o.recipient_count,
         o.first_created_at,
         o.last_suppressed_at
  from authorized_operations o
  where p_before_suppressed_at is null
     or o.last_suppressed_at < p_before_suppressed_at
     or (
       o.last_suppressed_at = p_before_suppressed_at
       and o.event_id < p_before_event_id
     )
     or (
       o.last_suppressed_at = p_before_suppressed_at
       and o.event_id = p_before_event_id
       and o.channel < p_before_channel
     )
  order by o.last_suppressed_at desc, o.event_id desc, o.channel desc
  limit v_limit;
end;
$function$;

create or replace function public.list_admin_user_invitation_state(
  p_before_created_at timestamp with time zone default null::timestamp with time zone,
  p_before_profile_id uuid default null::uuid,
  p_limit integer default 25
)
returns table (
  record_id uuid,
  record_kind text,
  created_at timestamp with time zone,
  profile_id uuid,
  full_name text,
  application_role public.app_role,
  is_active boolean,
  preferred_locale text,
  email_notifications_enabled boolean,
  whatsapp_opt_in boolean,
  last_seen_at timestamp with time zone,
  invitation_id uuid,
  invitation_status public.invite_status,
  project_id uuid,
  project_name text,
  invitation_expires_at timestamp with time zone,
  invitation_accepted_at timestamp with time zone,
  invitation_revoked_at timestamp with time zone
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not (select private.is_admin()) then
    raise exception 'Admin access required';
  end if;

  if (
    (p_before_created_at is null and p_before_profile_id is not null)
    or (
      p_before_created_at is not null
      and p_before_profile_id is null
    )
  ) then
    raise exception 'User and invitation state cursor must be complete';
  end if;

  return query
  with state_rows as (
    select
      p.id as record_id,
      'profile'::text as record_kind,
      p.created_at,
      p.id as profile_id,
      p.full_name,
      p.role as application_role,
      p.is_active,
      p.preferred_locale,
      p.email_notifications_enabled,
      p.whatsapp_opt_in,
      p.last_seen_at,
      null::uuid as invitation_id,
      null::public.invite_status as invitation_status,
      null::uuid as project_id,
      null::text as project_name,
      null::timestamptz as invitation_expires_at,
      null::timestamptz as invitation_accepted_at,
      null::timestamptz as invitation_revoked_at
    from public.profiles p
    where p.deleted_at is null

    union all

    select
      i.id as record_id,
      'invitation'::text as record_kind,
      i.created_at,
      null::uuid as profile_id,
      null::text as full_name,
      i.role as application_role,
      null::boolean as is_active,
      null::text as preferred_locale,
      null::boolean as email_notifications_enabled,
      null::boolean as whatsapp_opt_in,
      null::timestamptz as last_seen_at,
      i.id as invitation_id,
      i.status as invitation_status,
      case
        when p.id is not null then i.project_id
        else null
      end as project_id,
      case
        when p.id is not null then p.name
        else null
      end as project_name,
      i.expires_at as invitation_expires_at,
      i.accepted_at as invitation_accepted_at,
      i.revoked_at as invitation_revoked_at
    from public.invite_tokens i
    left join public.projects p
      on p.id = i.project_id
     and p.deleted_at is null
     and p.archived_at is null
  )
  select
    sr.record_id,
    sr.record_kind,
    sr.created_at,
    sr.profile_id,
    sr.full_name,
    sr.application_role,
    sr.is_active,
    sr.preferred_locale,
    sr.email_notifications_enabled,
    sr.whatsapp_opt_in,
    sr.last_seen_at,
    sr.invitation_id,
    sr.invitation_status,
    sr.project_id,
    sr.project_name,
    sr.invitation_expires_at,
    sr.invitation_accepted_at,
    sr.invitation_revoked_at
  from state_rows sr
  where p_before_created_at is null
    or sr.created_at < p_before_created_at
    or (
      sr.created_at = p_before_created_at
      and sr.record_id < p_before_profile_id
    )
  order by sr.created_at desc, sr.record_id desc
  limit v_limit;
end;
$function$;

create or replace function public.list_ordinary_invitation_administration(
  p_before_created_at timestamp with time zone default null::timestamp with time zone,
  p_before_invitation_id uuid default null::uuid,
  p_limit integer default 50
)
returns table (
  invitation_id uuid,
  role public.app_role,
  status public.invite_status,
  recipient_label text,
  contact_id uuid,
  project_id uuid,
  project_name text,
  created_at timestamp with time zone,
  expires_at timestamp with time zone,
  accepted_at timestamp with time zone,
  revoked_at timestamp with time zone
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  perform private.assert_s10_invitation_manager();

  if p_limit not between 1 and 100 then
    raise exception 'Invitation page limit is unavailable';
  end if;
  if (p_before_created_at is null) <> (p_before_invitation_id is null) then
    raise exception 'Invitation cursor is unavailable';
  end if;

  return query
  select
    i.id,
    i.role,
    case
      when i.status = 'pending' and i.revoked_at is not null then 'revoked'::public.invite_status
      when i.status = 'pending' and i.expires_at <= now() then 'expired'::public.invite_status
      else i.status
    end as status,
    case
      when i.role = 'client' and contact_row.id is not null then contact_row.full_name
      when i.role = 'operator' then 'Operator invitation'
      else 'Invitation'
    end as recipient_label,
    i.contact_id,
    case
      when project_row.id is not null then i.project_id
      else null
    end as project_id,
    case
      when project_row.id is not null then project_row.name
      else null
    end as project_name,
    i.created_at,
    i.expires_at,
    i.accepted_at,
    i.revoked_at
  from public.invite_tokens i
  left join public.client_contacts contact_row
    on contact_row.id = i.contact_id
    and contact_row.deleted_at is null
  left join public.projects project_row
    on project_row.id = i.project_id
    and project_row.deleted_at is null
    and project_row.archived_at is null
  where i.role in ('client', 'operator')
    and (
      p_before_created_at is null
      or (i.created_at, i.id) < (p_before_created_at, p_before_invitation_id)
    )
  order by i.created_at desc, i.id desc
  limit p_limit;
end;
$function$;

-- =============================================================================
-- SECTION 5. Ownership, revokes, and grants
-- =============================================================================

-- S10-04 function ownership
alter function private.user_has_qualifying_access(uuid) owner to postgres;
alter function private.refresh_user_access_hygiene_state(uuid) owner to postgres;
alter function private.refresh_access_hygiene_from_assignment_change() owner to postgres;
alter function private.refresh_access_hygiene_from_project_change() owner to postgres;
alter function public.get_own_account_settings() owner to postgres;
alter function public.update_own_account_settings(text, text, text, boolean) owner to postgres;
alter function public.list_user_access_directory(timestamptz, uuid, integer) owner to postgres;
alter function public.set_user_access_state(uuid, boolean) owner to postgres;
alter function public.list_stale_access_reminder_candidates() owner to postgres;
alter function public.record_stale_access_reminder(uuid) owner to postgres;
alter function public.submit_bug_report(text, text) owner to postgres;
alter function public.list_bug_reports(timestamptz, uuid, integer) owner to postgres;
alter function public.set_bug_report_status(uuid, public.bug_report_status) owner to postgres;
alter function public.soft_delete_entity(public.entity_type, uuid, text) owner to postgres;
alter function public.restore_entity(public.entity_type, uuid, text) owner to postgres;

-- S10-03 repaired function ownership
alter function private.is_task_assignee(uuid) owner to postgres;
alter function private.is_client_task_assignee(uuid) owner to postgres;
alter function private.is_deliverable_assignee(uuid) owner to postgres;
alter function private.is_client_submission_assignee(uuid) owner to postgres;
alter function private.project_has_client_readiness(uuid) owner to postgres;
alter function private.validate_task() owner to postgres;
alter function private.sync_and_validate_deliverable() owner to postgres;
alter function private.validate_milestone_task_link() owner to postgres;
alter function private.validate_calendar_event_task_scope() owner to postgres;
alter function private.validate_production_google_drive_submission_url() owner to postgres;
alter function public.list_role_safe_calendar_events(timestamptz, timestamptz, uuid) owner to postgres;
alter function public.get_scoped_operations_metrics(uuid, timestamptz, timestamptz) owner to postgres;
alter function public.list_scoped_operations_metric_trend(uuid, timestamptz, timestamptz) owner to postgres;
alter function public.list_scoped_user_operations_metrics(uuid, uuid, timestamptz, timestamptz) owner to postgres;
alter function public.list_scoped_metrics_project_filter_options() owner to postgres;
alter function public.get_milestone_detail(uuid) owner to postgres;
alter function public.list_project_milestone_summaries(uuid) owner to postgres;
alter function public.list_milestone_tasks(uuid) owner to postgres;
alter function public.list_task_milestone_options(uuid) owner to postgres;
alter function public.list_milestone_management_targets() owner to postgres;
alter function public.list_operator_task_milestone_context(uuid) owner to postgres;
alter function public.create_milestone(text, uuid, text, text, date, text, uuid[]) owner to postgres;
alter function public.update_milestone(uuid, text, uuid, text, text, date, text, uuid[]) owner to postgres;
alter function public.create_task_with_deliverables(uuid, text, text, public.task_type, public.task_priority, timestamptz, uuid, jsonb, uuid[]) owner to postgres;
alter function public.create_collaboration_comment(uuid, public.collaboration_target_type, uuid, text) owner to postgres;
alter function public.get_project_completion_readiness(uuid) owner to postgres;
alter function public.transition_project_status(uuid, public.project_status, boolean, text) owner to postgres;
alter function public.recover_project_status(uuid, public.project_status, text) owner to postgres;
alter function public.transition_task_status(uuid, public.task_status, text) owner to postgres;
alter function public.mark_deliverable_delivered(uuid) owner to postgres;
alter function public.reopen_client_deliverable(uuid, text) owner to postgres;
alter function public.review_deliverable(uuid, public.review_stage, public.review_decision, text) owner to postgres;
alter function public.submit_client_deliverable(uuid, text, text) owner to postgres;
alter function public.submit_deliverable_version(uuid, text, text) owner to postgres;
alter function public.report_broken_link(uuid, uuid, text) owner to postgres;
alter function public.list_role_safe_link_incidents(uuid, public.link_report_status, timestamptz, timestamptz, timestamptz, uuid, integer) owner to postgres;
alter function public.list_finalized_production_archive(uuid, public.deliverable_status, timestamptz, timestamptz, timestamptz, uuid, integer) owner to postgres;
alter function public.list_my_in_app_notifications(integer, timestamptz, timestamptz, boolean, timestamptz, uuid) owner to postgres;
alter function public.list_suppressed_notification_operations(integer, timestamptz, uuid, public.notification_channel) owner to postgres;
alter function public.list_admin_user_invitation_state(timestamptz, uuid, integer) owner to postgres;
alter function public.list_ordinary_invitation_administration(timestamptz, uuid, integer) owner to postgres;

-- S10-04 and S10-03 revokes
revoke all on function private.user_has_qualifying_access(uuid) from public, anon, authenticated, service_role;
revoke all on function private.refresh_user_access_hygiene_state(uuid) from public, anon, authenticated, service_role;
revoke all on function private.refresh_access_hygiene_from_assignment_change() from public, anon, authenticated, service_role;
revoke all on function private.refresh_access_hygiene_from_project_change() from public, anon, authenticated, service_role;
revoke all on function private.validate_task() from public, anon, authenticated, service_role;
revoke all on function private.sync_and_validate_deliverable() from public, anon, authenticated, service_role;
revoke all on function private.validate_milestone_task_link() from public, anon, authenticated, service_role;
revoke all on function private.validate_calendar_event_task_scope() from public, anon, authenticated, service_role;
revoke all on function private.validate_production_google_drive_submission_url() from public, anon, authenticated, service_role;
revoke all on function private.project_has_client_readiness(uuid) from public, anon, authenticated, service_role;
revoke all on function private.is_task_assignee(uuid) from public, anon, service_role;
revoke all on function private.is_client_task_assignee(uuid) from public, anon, service_role;
revoke all on function private.is_deliverable_assignee(uuid) from public, anon, service_role;
revoke all on function private.is_client_submission_assignee(uuid) from public, anon, service_role;

revoke all on function public.get_own_account_settings() from public, anon, service_role;
revoke all on function public.update_own_account_settings(text, text, text, boolean) from public, anon, service_role;
revoke all on function public.list_user_access_directory(timestamptz, uuid, integer) from public, anon, service_role;
revoke all on function public.set_user_access_state(uuid, boolean) from public, anon, service_role;
revoke all on function public.list_stale_access_reminder_candidates() from public, anon, service_role;
revoke all on function public.record_stale_access_reminder(uuid) from public, anon, service_role;
revoke all on function public.submit_bug_report(text, text) from public, anon, service_role;
revoke all on function public.list_bug_reports(timestamptz, uuid, integer) from public, anon, service_role;
revoke all on function public.set_bug_report_status(uuid, public.bug_report_status) from public, anon, service_role;
revoke all on function public.soft_delete_entity(public.entity_type, uuid, text) from public, anon, service_role;
revoke all on function public.restore_entity(public.entity_type, uuid, text) from public, anon, service_role;

revoke all on function public.list_role_safe_calendar_events(timestamptz, timestamptz, uuid) from public, anon, service_role;
revoke all on function public.get_scoped_operations_metrics(uuid, timestamptz, timestamptz) from public, anon, service_role;
revoke all on function public.list_scoped_operations_metric_trend(uuid, timestamptz, timestamptz) from public, anon, service_role;
revoke all on function public.list_scoped_user_operations_metrics(uuid, uuid, timestamptz, timestamptz) from public, anon, service_role;
revoke all on function public.list_scoped_metrics_project_filter_options() from public, anon, service_role;
revoke all on function public.get_milestone_detail(uuid) from public, anon, service_role;
revoke all on function public.list_project_milestone_summaries(uuid) from public, anon, service_role;
revoke all on function public.list_milestone_tasks(uuid) from public, anon, service_role;
revoke all on function public.list_task_milestone_options(uuid) from public, anon, service_role;
revoke all on function public.list_milestone_management_targets() from public, anon, service_role;
revoke all on function public.list_operator_task_milestone_context(uuid) from public, anon, service_role;
revoke all on function public.create_milestone(text, uuid, text, text, date, text, uuid[]) from public, anon, service_role;
revoke all on function public.update_milestone(uuid, text, uuid, text, text, date, text, uuid[]) from public, anon, service_role;
revoke all on function public.create_task_with_deliverables(uuid, text, text, public.task_type, public.task_priority, timestamptz, uuid, jsonb, uuid[]) from public, anon, service_role;
revoke all on function public.create_collaboration_comment(uuid, public.collaboration_target_type, uuid, text) from public, anon, service_role;
revoke all on function public.get_project_completion_readiness(uuid) from public, anon, service_role;
revoke all on function public.transition_project_status(uuid, public.project_status, boolean, text) from public, anon, service_role;
revoke all on function public.recover_project_status(uuid, public.project_status, text) from public, anon, service_role;
revoke all on function public.transition_task_status(uuid, public.task_status, text) from public, anon, service_role;
revoke all on function public.mark_deliverable_delivered(uuid) from public, anon, service_role;
revoke all on function public.reopen_client_deliverable(uuid, text) from public, anon, service_role;
revoke all on function public.review_deliverable(uuid, public.review_stage, public.review_decision, text) from public, anon, service_role;
revoke all on function public.submit_client_deliverable(uuid, text, text) from public, anon, service_role;
revoke all on function public.submit_deliverable_version(uuid, text, text) from public, anon, service_role;
revoke all on function public.report_broken_link(uuid, uuid, text) from public, anon, service_role;
revoke all on function public.list_role_safe_link_incidents(uuid, public.link_report_status, timestamptz, timestamptz, timestamptz, uuid, integer) from public, anon, service_role;
revoke all on function public.list_finalized_production_archive(uuid, public.deliverable_status, timestamptz, timestamptz, timestamptz, uuid, integer) from public, anon, service_role;
revoke all on function public.list_my_in_app_notifications(integer, timestamptz, timestamptz, boolean, timestamptz, uuid) from public, anon, service_role;
revoke all on function public.list_suppressed_notification_operations(integer, timestamptz, uuid, public.notification_channel) from public, anon, service_role;
revoke all on function public.list_admin_user_invitation_state(timestamptz, uuid, integer) from public, anon, service_role;
revoke all on function public.list_ordinary_invitation_administration(timestamptz, uuid, integer) from public, anon, service_role;

-- Grants
grant execute on function private.is_task_assignee(uuid) to authenticated;
grant execute on function private.is_client_task_assignee(uuid) to authenticated;
grant execute on function private.is_deliverable_assignee(uuid) to authenticated;
grant execute on function private.is_client_submission_assignee(uuid) to authenticated;

grant execute on function public.get_own_account_settings() to authenticated;
grant execute on function public.update_own_account_settings(text, text, text, boolean) to authenticated;
grant execute on function public.submit_bug_report(text, text) to authenticated;
grant execute on function public.list_user_access_directory(timestamptz, uuid, integer) to authenticated;
grant execute on function public.set_user_access_state(uuid, boolean) to authenticated;
grant execute on function public.list_stale_access_reminder_candidates() to authenticated;
grant execute on function public.record_stale_access_reminder(uuid) to authenticated;
grant execute on function public.list_bug_reports(timestamptz, uuid, integer) to authenticated;
grant execute on function public.set_bug_report_status(uuid, public.bug_report_status) to authenticated;
grant execute on function public.soft_delete_entity(public.entity_type, uuid, text) to authenticated;
grant execute on function public.restore_entity(public.entity_type, uuid, text) to authenticated;

grant execute on function public.list_role_safe_calendar_events(timestamptz, timestamptz, uuid) to authenticated;
grant execute on function public.get_scoped_operations_metrics(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.list_scoped_operations_metric_trend(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.list_scoped_user_operations_metrics(uuid, uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.list_scoped_metrics_project_filter_options() to authenticated;
grant execute on function public.get_milestone_detail(uuid) to authenticated;
grant execute on function public.list_project_milestone_summaries(uuid) to authenticated;
grant execute on function public.list_milestone_tasks(uuid) to authenticated;
grant execute on function public.list_task_milestone_options(uuid) to authenticated;
grant execute on function public.list_milestone_management_targets() to authenticated;
grant execute on function public.list_operator_task_milestone_context(uuid) to authenticated;
grant execute on function public.create_milestone(text, uuid, text, text, date, text, uuid[]) to authenticated;
grant execute on function public.update_milestone(uuid, text, uuid, text, text, date, text, uuid[]) to authenticated;
grant execute on function public.create_task_with_deliverables(uuid, text, text, public.task_type, public.task_priority, timestamptz, uuid, jsonb, uuid[]) to authenticated;
grant execute on function public.create_collaboration_comment(uuid, public.collaboration_target_type, uuid, text) to authenticated;
grant execute on function public.get_project_completion_readiness(uuid) to authenticated;
grant execute on function public.transition_project_status(uuid, public.project_status, boolean, text) to authenticated;
grant execute on function public.recover_project_status(uuid, public.project_status, text) to authenticated;
grant execute on function public.transition_task_status(uuid, public.task_status, text) to authenticated;
grant execute on function public.mark_deliverable_delivered(uuid) to authenticated;
grant execute on function public.reopen_client_deliverable(uuid, text) to authenticated;
grant execute on function public.review_deliverable(uuid, public.review_stage, public.review_decision, text) to authenticated;
grant execute on function public.submit_client_deliverable(uuid, text, text) to authenticated;
grant execute on function public.submit_deliverable_version(uuid, text, text) to authenticated;
grant execute on function public.report_broken_link(uuid, uuid, text) to authenticated;
grant execute on function public.list_role_safe_link_incidents(uuid, public.link_report_status, timestamptz, timestamptz, timestamptz, uuid, integer) to authenticated;
grant execute on function public.list_finalized_production_archive(uuid, public.deliverable_status, timestamptz, timestamptz, timestamptz, uuid, integer) to authenticated;
grant execute on function public.list_my_in_app_notifications(integer, timestamptz, timestamptz, boolean, timestamptz, uuid) to authenticated;
grant execute on function public.list_suppressed_notification_operations(integer, timestamptz, uuid, public.notification_channel) to authenticated;
grant execute on function public.list_admin_user_invitation_state(timestamptz, uuid, integer) to authenticated;
grant execute on function public.list_ordinary_invitation_administration(timestamptz, uuid, integer) to authenticated;

commit;
