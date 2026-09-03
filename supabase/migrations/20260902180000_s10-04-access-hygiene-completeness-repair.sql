-- S10-04 access-hygiene completeness repair.
--
-- The applied M04 schema supplies the account, access-management, stale-reminder,
-- and bug-triage contract. This is its single forward correction. It closes three
-- trusted-state gaps without changing any public RPC signature or expanding any
-- browser-facing privilege:
--   1. a successful Auth sign-in was not a tracked stale-period reset event;
--   2. cancelled projects, which the accepted S10 readiness model defines as
--      inactive, were still counted as qualifying assignment/membership access;
--   3. a project status transition did not refresh hygiene state or the directory's
--      returned active-assignment counts.
--
-- Historical rule: no pre-M04 Auth timestamp or ended assignment history is
-- reconstructed. Existing active profiles are reconciled at this correction's
-- application point; only a real sign-in after that profile's M04 initialization
-- can supply a more precise post-M04 period start.
--
-- No auth user, profile role/activation state, invitation, reminder/action/audit
-- history, direct table grant, RLS policy, public RPC signature, or public RPC
-- grant is deleted, broadened, or newly created here.

begin;

-- A qualifying active assignment/membership must have active, non-deleted,
-- non-archived, non-cancelled project ancestry. M02-R1 defines cancelled as an
-- inactive project state; planning, in_progress, paused, and completed remain
-- eligible while otherwise active.
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
      and p.status <> 'cancelled'
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
      and p.status <> 'cancelled'
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
      and p.status <> 'cancelled'
  );
$function$;

alter function private.user_has_qualifying_access(uuid) owner to postgres;
revoke all on function private.user_has_qualifying_access(uuid)
  from public, anon, authenticated, service_role;

-- Keep hygiene state synchronized for all lifecycle changes that can make project
-- membership/task/deliverable access qualifying or non-qualifying. The binding is
-- replaced because PostgreSQL cannot alter an existing trigger's UPDATE column set.
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
    and new.deleted_at is not distinct from old.deleted_at
    and new.status is not distinct from old.status then
    return null;
  end if;

  for v_user_id in
    select pm.user_id
    from public.project_members pm
    where pm.project_id = coalesce(new.id, old.id)
    union
    select t.assignee_id
    from public.tasks t
    where t.project_id = coalesce(new.id, old.id)
    union
    select d.assignee_id
    from public.deliverables d
    where d.project_id = coalesce(new.id, old.id)
  loop
    perform private.refresh_user_access_hygiene_state(v_user_id);
  end loop;

  return null;
end;
$function$;

alter function private.refresh_access_hygiene_from_project_change() owner to postgres;
revoke all on function private.refresh_access_hygiene_from_project_change()
  from public, anon, authenticated, service_role;

drop trigger if exists s10_access_hygiene_projects_trg on public.projects;
create trigger s10_access_hygiene_projects_trg
  after update of status, archived_at, deleted_at on public.projects
  for each row
  execute function private.refresh_access_hygiene_from_project_change();

-- The global role-safe directory must report the same active-assignment predicate
-- as stale eligibility. Its public signature, projection, pagination, and grant
-- are intentionally unchanged.
create or replace function public.list_user_access_directory(
  p_before_created_at timestamptz default null,
  p_before_user_id uuid default null,
  p_limit integer default 25
)
returns table(
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
    (
      select count(*)::integer
      from public.project_members pm
      join public.projects pr on pr.id = pm.project_id
      where pm.user_id = p.id
        and pm.deleted_at is null
        and pr.deleted_at is null
        and pr.archived_at is null
        and pr.status <> 'cancelled'
    ),
    (
      select count(*)::integer
      from public.tasks t
      join public.projects pr on pr.id = t.project_id
      where t.assignee_id = p.id
        and t.deleted_at is null
        and t.archived_at is null
        and pr.deleted_at is null
        and pr.archived_at is null
        and pr.status <> 'cancelled'
    ),
    (
      select count(*)::integer
      from public.deliverables d
      join public.tasks t on t.id = d.task_id
      join public.projects pr on pr.id = d.project_id
      where d.assignee_id = p.id
        and d.deleted_at is null
        and d.archived_at is null
        and t.deleted_at is null
        and t.archived_at is null
        and pr.deleted_at is null
        and pr.archived_at is null
        and pr.status <> 'cancelled'
    ),
    (
      select count(*)::integer
      from public.invite_tokens i
      where lower(i.email::text) = lower(u.email)
        and i.role in ('client', 'operator')
        and i.status = 'pending'
        and i.revoked_at is null
        and i.expires_at > now()
    ),
    a.action,
    a.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  left join lateral (
    select ua.action, ua.created_at
    from public.user_access_actions ua
    where ua.target_user_id = p.id
    order by ua.created_at desc, ua.id desc
    limit 1
  ) a on true
  where p.deleted_at is null
    and (
      p_before_created_at is null
      or p.created_at < p_before_created_at
      or (p.created_at = p_before_created_at and p.id < p_before_user_id)
    )
  order by p.created_at desc, p.id desc
  limit v_limit;
end;
$function$;

alter function public.list_user_access_directory(timestamptz, uuid, integer) owner to postgres;
revoke all on function public.list_user_access_directory(timestamptz, uuid, integer)
  from public, anon;
grant execute on function public.list_user_access_directory(timestamptz, uuid, integer)
  to authenticated;

-- Observe the Auth-owned successful sign-in timestamp at its source. A missing,
-- inactive, or deleted profile deliberately receives no manufactured state;
-- profile/M04 lifecycle paths remain its state-creation authority.
create or replace function private.refresh_access_hygiene_from_successful_auth()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_qualifying_access boolean;
begin
  if new.last_sign_in_at is not distinct from old.last_sign_in_at then
    return new;
  end if;

  if new.last_sign_in_at is null
    or not exists (
      select 1
      from public.profiles p
      where p.id = new.id
        and p.is_active
        and p.deleted_at is null
    ) then
    return new;
  end if;

  v_qualifying_access := private.user_has_qualifying_access(new.id);

  insert into public.user_access_hygiene_state (
    user_id,
    inactivity_period_started_at,
    notified_for_period_started_at,
    observed_qualifying_access,
    initialized_at,
    updated_at
  ) values (
    new.id,
    case when v_qualifying_access then null else new.last_sign_in_at end,
    null,
    v_qualifying_access,
    now(),
    now()
  )
  on conflict (user_id) do update
  set inactivity_period_started_at = case
        when v_qualifying_access then null
        else excluded.inactivity_period_started_at
      end,
      notified_for_period_started_at = null,
      observed_qualifying_access = v_qualifying_access,
      updated_at = now();

  return new;
end;
$function$;

alter function private.refresh_access_hygiene_from_successful_auth() owner to postgres;
revoke all on function private.refresh_access_hygiene_from_successful_auth()
  from public, anon, authenticated, service_role;

drop trigger if exists s10_access_hygiene_successful_auth_trg on auth.users;
create trigger s10_access_hygiene_successful_auth_trg
  after update of last_sign_in_at on auth.users
  for each row
  when (old.last_sign_in_at is distinct from new.last_sign_in_at)
  execute function private.refresh_access_hygiene_from_successful_auth();

-- First reconcile current active profiles through the corrected trusted predicate.
-- This does not reconstruct unknown earlier state; an observed loss of qualifying
-- access starts at migration application time, consistent with M04's baseline.
do $block$
declare
  v_user_id uuid;
begin
  for v_user_id in
    select p.id
    from public.profiles p
    where p.is_active
      and p.deleted_at is null
  loop
    perform private.refresh_user_access_hygiene_state(v_user_id);
  end loop;
end;
$block$;

-- Then retain a real, more precise successful-auth reset that happened after a
-- profile's M04 initialization and before this trigger existed. A pre-M04 Auth
-- timestamp remains intentionally unusable as historical activity evidence.
update public.user_access_hygiene_state hs
set inactivity_period_started_at = case
      when private.user_has_qualifying_access(hs.user_id) then null
      else u.last_sign_in_at
    end,
    notified_for_period_started_at = null,
    observed_qualifying_access = private.user_has_qualifying_access(hs.user_id),
    updated_at = now()
from public.profiles p
join auth.users u on u.id = p.id
where p.id = hs.user_id
  and p.is_active
  and p.deleted_at is null
  and u.last_sign_in_at is not null
  and u.last_sign_in_at > hs.initialized_at;

commit;
