-- S07 E09 calendar forward reconciliation: task-scoped milestones, all-PM
-- calendar authority, and purpose-limited calendar display/management contracts.
--
-- Prerequisites: applied M1 20260823140000 and direct-read remediation
-- 20260823143000. This is append-only. It deliberately does not modify those
-- applied migration sources, add an HTTP route, alter OpenAPI, add a scheduler,
-- enable Realtime, or change deadline source records.

begin;

-- A manual milestone always belongs to a project. It may additionally target
-- exactly one task in that same project. Project-scoped milestones retain a
-- NULL task_id; task-scoped milestones are visible to an Operator only when
-- that task is directly assigned to that Operator.
alter table public.calendar_events
  add column task_id uuid references public.tasks(id) on delete restrict;

create or replace function private.validate_calendar_event_task_scope()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_task_project_id uuid;
  v_task_deleted_at timestamptz;
begin
  if new.task_id is null then
    return new;
  end if;

  select t.project_id, t.deleted_at
  into v_task_project_id, v_task_deleted_at
  from public.tasks t
  where t.id = new.task_id;

  if not found or v_task_deleted_at is not null then
    raise exception 'Calendar milestone task must exist and be active';
  end if;

  if v_task_project_id <> new.project_id then
    raise exception 'Calendar milestone task must belong to the milestone project';
  end if;

  return new;
end;
$function$;

create trigger calendar_events_task_scope_trg
  before insert or update of project_id, task_id on public.calendar_events
  for each row execute function private.validate_calendar_event_task_scope();

-- Base-table reads are not an application contract. All authenticated calendar
-- reads now flow through the purpose-limited SECURITY DEFINER functions below.
revoke select on table public.calendar_events from authenticated;
drop policy if exists calendar_events_select_policy on public.calendar_events;

-- The M1 feed has a different return contract after this forward migration, so
-- PostgreSQL requires replacing the function through a drop/create cycle.
drop function public.list_role_safe_calendar_events(timestamptz, timestamptz, uuid);

create function public.list_role_safe_calendar_events(
  p_from timestamptz,
  p_to timestamptz,
  p_project_id uuid default null
)
returns table (
  entity_id uuid,
  project_id uuid,
  project_name text,
  task_id uuid,
  title text,
  event_type public.calendar_event_type,
  starts_at timestamptz,
  ends_at timestamptz,
  is_all_day boolean,
  color_override text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
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
    -- Admin and every active PM profile receive the complete project calendar.
    -- Clients receive only their existing project-safe project deadlines.
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
      and (p_project_id is null or p.id = p_project_id)
      and (
        v_is_manager
        or (v_role = 'client' and (select private.is_project_client(p.id)))
      )

    union all

    -- Managers receive all task deadlines. Operators receive direct work only;
    -- Clients retain direct client_request task visibility only.
    select
      t.id as entity_id,
      case
        when v_role = 'operator' then null::uuid
        when v_role = 'client'
          and not (select private.is_project_client(t.project_id)) then null::uuid
        else t.project_id
      end as project_id,
      case
        when v_role = 'client'
          and not (select private.is_project_client(t.project_id)) then null::text
        else p.name
      end as project_name,
      t.id as task_id,
      t.title,
      'task_deadline'::public.calendar_event_type as event_type,
      t.deadline_at as starts_at,
      t.deadline_at as ends_at,
      true as is_all_day,
      null::text as color_override
    from public.tasks t
    join public.projects p on p.id = t.project_id and p.deleted_at is null
    where t.deleted_at is null
      and (p_project_id is null or t.project_id = p_project_id)
      and (
        v_is_manager
        or (v_role = 'operator' and t.assignee_id = v_user_id)
        or (
          v_role = 'client'
          and t.task_type = 'client_request'
          and t.assignee_id = v_user_id
        )
      )

    union all

    -- Internal review remains an internal manager-only deadline.
    select
      d.id as entity_id,
      d.project_id,
      p.name as project_name,
      d.task_id,
      d.title || ' (Internal Review)' as title,
      'internal_review_deadline'::public.calendar_event_type as event_type,
      d.internal_review_deadline_at as starts_at,
      d.internal_review_deadline_at as ends_at,
      true as is_all_day,
      null::text as color_override
    from public.deliverables d
    join public.projects p on p.id = d.project_id and p.deleted_at is null
    where d.deleted_at is null
      and d.workflow_type = 'production'
      and d.internal_review_deadline_at is not null
      and (p_project_id is null or d.project_id = p_project_id)
      and v_is_manager

    union all

    -- Production delivery deadlines are manager-wide, direct-operator work,
    -- and existing client-project-safe context.
    select
      d.id as entity_id,
      case when v_role = 'operator' then null::uuid else d.project_id end as project_id,
      p.name as project_name,
      d.task_id,
      d.title || ' (Client Delivery)' as title,
      'client_delivery_deadline'::public.calendar_event_type as event_type,
      d.client_delivery_deadline_at as starts_at,
      d.client_delivery_deadline_at as ends_at,
      true as is_all_day,
      null::text as color_override
    from public.deliverables d
    join public.projects p on p.id = d.project_id and p.deleted_at is null
    where d.deleted_at is null
      and d.workflow_type = 'production'
      and d.client_delivery_deadline_at is not null
      and (p_project_id is null or d.project_id = p_project_id)
      and (
        v_is_manager
        or (v_role = 'operator' and d.assignee_id = v_user_id)
        or (v_role = 'client' and (select private.is_project_client(d.project_id)))
      )

    union all

    -- Client submissions preserve their established task_deadline classification.
    select
      d.id as entity_id,
      case
        when v_role = 'client'
          and not (select private.is_project_client(d.project_id)) then null::uuid
        else d.project_id
      end as project_id,
      case
        when v_role = 'client'
          and not (select private.is_project_client(d.project_id)) then null::text
        else p.name
      end as project_name,
      d.task_id,
      d.title || ' (Client Submission)' as title,
      'task_deadline'::public.calendar_event_type as event_type,
      d.submission_deadline_at as starts_at,
      d.submission_deadline_at as ends_at,
      true as is_all_day,
      null::text as color_override
    from public.deliverables d
    join public.projects p on p.id = d.project_id and p.deleted_at is null
    where d.deleted_at is null
      and d.workflow_type = 'client_submission'
      and d.submission_deadline_at is not null
      and (p_project_id is null or d.project_id = p_project_id)
      and (
        v_is_manager
        or (v_role = 'client' and d.assignee_id = v_user_id)
      )

    union all

    -- Managers receive every manual milestone. Operators receive a manual
    -- milestone only when it is task-scoped to a task assigned directly to them.
    -- Clients never receive manual milestones.
    select
      ce.id as entity_id,
      case when v_role = 'operator' then null::uuid else ce.project_id end as project_id,
      p.name as project_name,
      ce.task_id,
      ce.title,
      ce.event_type,
      ce.starts_at,
      ce.ends_at,
      ce.is_all_day,
      ce.color_override
    from public.calendar_events ce
    join public.projects p on p.id = ce.project_id and p.deleted_at is null
    left join public.tasks t on t.id = ce.task_id and t.deleted_at is null
    where ce.deleted_at is null
      and (p_project_id is null or ce.project_id = p_project_id)
      and (
        v_is_manager
        or (
          v_role = 'operator'
          and ce.task_id is not null
          and t.assignee_id = v_user_id
        )
      )
  )
  select
    pe.entity_id,
    pe.project_id,
    pe.project_name,
    pe.task_id,
    pe.title,
    pe.event_type,
    pe.starts_at,
    pe.ends_at,
    pe.is_all_day,
    pe.color_override
  from permitted_events pe
  where pe.starts_at < p_to
    and coalesce(pe.ends_at, pe.starts_at) >= p_from
  order by pe.starts_at asc, pe.event_type asc, pe.entity_id asc;
end;
$function$;

revoke all on function public.list_role_safe_calendar_events(timestamptz, timestamptz, uuid) from public;
revoke all on function public.list_role_safe_calendar_events(timestamptz, timestamptz, uuid) from anon;
grant execute on function public.list_role_safe_calendar_events(timestamptz, timestamptz, uuid) to authenticated;

-- Manager-only form targets. A NULL task_id row represents the project-scoped
-- milestone option; non-NULL rows represent active task-scoped options.
create function public.list_calendar_milestone_targets()
returns table (
  project_id uuid,
  project_name text,
  task_id uuid,
  task_title text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role public.app_role := (select private.current_user_role());
begin
  if v_user_id is null or v_role not in ('admin', 'pm') then
    raise exception 'Calendar milestone management is not permitted';
  end if;

  return query
  select p.id, p.name, null::uuid, null::text
  from public.projects p
  where p.deleted_at is null
  union all
  select p.id, p.name, t.id, t.title
  from public.projects p
  join public.tasks t on t.project_id = p.id and t.deleted_at is null
  where p.deleted_at is null
  order by 2 asc, 4 asc nulls first, 3 asc nulls first;
end;
$function$;

revoke all on function public.list_calendar_milestone_targets() from public;
revoke all on function public.list_calendar_milestone_targets() from anon;
grant execute on function public.list_calendar_milestone_targets() to authenticated;

-- Manager-only edit detail. Descriptions are deliberately absent from all feed
-- DTOs and are returned only here to preserve an existing description on edit.
create function public.get_calendar_milestone_for_edit(p_event_id uuid)
returns table (
  entity_id uuid,
  project_id uuid,
  project_name text,
  task_id uuid,
  title text,
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  is_all_day boolean,
  color_override text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role public.app_role := (select private.current_user_role());
begin
  if v_user_id is null or v_role not in ('admin', 'pm') then
    raise exception 'Calendar milestone management is not permitted';
  end if;

  return query
  select
    ce.id,
    ce.project_id,
    p.name,
    ce.task_id,
    ce.title,
    ce.description,
    ce.starts_at,
    ce.ends_at,
    ce.is_all_day,
    ce.color_override
  from public.calendar_events ce
  join public.projects p on p.id = ce.project_id and p.deleted_at is null
  where ce.id = p_event_id
    and ce.deleted_at is null
    and ce.event_type = 'milestone';
end;
$function$;

revoke all on function public.get_calendar_milestone_for_edit(uuid) from public;
revoke all on function public.get_calendar_milestone_for_edit(uuid) from anon;
grant execute on function public.get_calendar_milestone_for_edit(uuid) to authenticated;

-- Replace M1 command signatures so task scope is supplied explicitly. Existing
-- callers must regenerate types and use these exact signatures after application.
drop function public.create_calendar_milestone(uuid, text, text, timestamptz, timestamptz, boolean, text);
drop function public.update_calendar_milestone(uuid, text, text, timestamptz, timestamptz, boolean, text);
drop function public.soft_delete_calendar_milestone(uuid);

create function public.create_calendar_milestone(
  p_project_id uuid,
  p_task_id uuid default null,
  p_title text default null,
  p_description text default null,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_is_all_day boolean default null,
  p_color_override text default null
)
returns table (
  entity_id uuid,
  project_id uuid,
  project_name text,
  task_id uuid,
  title text,
  event_type public.calendar_event_type,
  starts_at timestamptz,
  ends_at timestamptz,
  is_all_day boolean,
  color_override text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role public.app_role := (select private.current_user_role());
  v_title text := btrim(p_title);
  v_description text := nullif(btrim(p_description), '');
  v_event public.calendar_events%rowtype;
  v_project_name text;
begin
  if v_user_id is null or v_role not in ('admin', 'pm') then
    raise exception 'Calendar milestone management is not permitted';
  end if;

  if p_project_id is null then
    raise exception 'Calendar milestone project is required';
  end if;

  select p.name into v_project_name
  from public.projects p
  where p.id = p_project_id and p.deleted_at is null;

  if not found then
    raise exception 'Calendar milestone project not found';
  end if;

  if v_title is null or char_length(v_title) not between 1 and 160 then
    raise exception 'Milestone title must contain 1 to 160 trimmed characters';
  end if;

  if v_description is not null and char_length(v_description) > 2000 then
    raise exception 'Milestone description must not exceed 2000 trimmed characters';
  end if;

  if p_starts_at is null then
    raise exception 'Milestone starts_at is required';
  end if;

  if p_ends_at is not null and p_ends_at < p_starts_at then
    raise exception 'Milestone ends_at must not precede starts_at';
  end if;

  if p_is_all_day is null then
    raise exception 'Milestone is_all_day is required';
  end if;

  if p_color_override is not null
    and p_color_override not in ('chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5') then
    raise exception 'Milestone color_override must be null or a supported chart token';
  end if;

  insert into public.calendar_events (
    project_id, task_id, event_type, title, description, starts_at, ends_at,
    is_all_day, color_override, created_by, updated_by
  ) values (
    p_project_id, p_task_id, 'milestone', v_title, v_description, p_starts_at,
    p_ends_at, p_is_all_day, p_color_override, v_user_id, v_user_id
  ) returning * into v_event;

  insert into public.audit_logs (
    entity_type, entity_id, project_id, action, changed_fields, actor_id, actor_role
  ) values (
    'calendar_event', v_event.id, v_event.project_id,
    'calendar_milestone_created',
    jsonb_build_object(
      'event_type', 'milestone',
      'scope', case when v_event.task_id is null then 'project' else 'task' end,
      'task_id', v_event.task_id,
      'has_description', v_event.description is not null,
      'has_ends_at', v_event.ends_at is not null,
      'is_all_day', v_event.is_all_day,
      'has_color_override', v_event.color_override is not null
    ),
    v_user_id, v_role
  );

  return query select
    v_event.id, v_event.project_id, v_project_name, v_event.task_id,
    v_event.title, v_event.event_type, v_event.starts_at, v_event.ends_at,
    v_event.is_all_day, v_event.color_override;
end;
$function$;

create function public.update_calendar_milestone(
  p_event_id uuid,
  p_project_id uuid,
  p_task_id uuid default null,
  p_title text default null,
  p_description text default null,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_is_all_day boolean default null,
  p_color_override text default null
)
returns table (
  entity_id uuid,
  project_id uuid,
  project_name text,
  task_id uuid,
  title text,
  event_type public.calendar_event_type,
  starts_at timestamptz,
  ends_at timestamptz,
  is_all_day boolean,
  color_override text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role public.app_role := (select private.current_user_role());
  v_title text := btrim(p_title);
  v_description text := nullif(btrim(p_description), '');
  v_previous public.calendar_events%rowtype;
  v_event public.calendar_events%rowtype;
  v_project_name text;
begin
  if v_user_id is null or v_role not in ('admin', 'pm') then
    raise exception 'Calendar milestone management is not permitted';
  end if;

  select * into v_previous
  from public.calendar_events
  where id = p_event_id and deleted_at is null
  for update;

  if not found or v_previous.event_type <> 'milestone' then
    raise exception 'Calendar milestone not found';
  end if;

  if p_project_id is null then
    raise exception 'Calendar milestone project is required';
  end if;

  select p.name into v_project_name
  from public.projects p
  where p.id = p_project_id and p.deleted_at is null;

  if not found then
    raise exception 'Calendar milestone project not found';
  end if;

  if v_title is null or char_length(v_title) not between 1 and 160 then
    raise exception 'Milestone title must contain 1 to 160 trimmed characters';
  end if;

  if v_description is not null and char_length(v_description) > 2000 then
    raise exception 'Milestone description must not exceed 2000 trimmed characters';
  end if;

  if p_starts_at is null then
    raise exception 'Milestone starts_at is required';
  end if;

  if p_ends_at is not null and p_ends_at < p_starts_at then
    raise exception 'Milestone ends_at must not precede starts_at';
  end if;

  if p_is_all_day is null then
    raise exception 'Milestone is_all_day is required';
  end if;

  if p_color_override is not null
    and p_color_override not in ('chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5') then
    raise exception 'Milestone color_override must be null or a supported chart token';
  end if;

  update public.calendar_events
  set project_id = p_project_id,
      task_id = p_task_id,
      title = v_title,
      description = v_description,
      starts_at = p_starts_at,
      ends_at = p_ends_at,
      is_all_day = p_is_all_day,
      color_override = p_color_override,
      updated_by = v_user_id,
      updated_at = now()
  where id = v_previous.id
  returning * into v_event;

  insert into public.audit_logs (
    entity_type, entity_id, project_id, action, changed_fields, actor_id, actor_role
  ) values (
    'calendar_event', v_event.id, v_event.project_id,
    'calendar_milestone_updated',
    jsonb_build_object(
      'title_changed', v_previous.title is distinct from v_event.title,
      'description_changed', v_previous.description is distinct from v_event.description,
      'project_changed', v_previous.project_id is distinct from v_event.project_id,
      'task_scope_changed', v_previous.task_id is distinct from v_event.task_id,
      'schedule_changed', v_previous.starts_at is distinct from v_event.starts_at
        or v_previous.ends_at is distinct from v_event.ends_at,
      'is_all_day_changed', v_previous.is_all_day is distinct from v_event.is_all_day,
      'color_override_changed', v_previous.color_override is distinct from v_event.color_override
    ),
    v_user_id, v_role
  );

  return query select
    v_event.id, v_event.project_id, v_project_name, v_event.task_id,
    v_event.title, v_event.event_type, v_event.starts_at, v_event.ends_at,
    v_event.is_all_day, v_event.color_override;
end;
$function$;

create function public.soft_delete_calendar_milestone(p_event_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role public.app_role := (select private.current_user_role());
  v_event public.calendar_events%rowtype;
  v_row_count integer;
begin
  if v_user_id is null or v_role not in ('admin', 'pm') then
    raise exception 'Calendar milestone management is not permitted';
  end if;

  select * into v_event
  from public.calendar_events
  where id = p_event_id and deleted_at is null
  for update;

  if not found then
    return false;
  end if;

  if v_event.event_type <> 'milestone' then
    raise exception 'Only milestone calendar events may be deleted';
  end if;

  update public.calendar_events
  set deleted_at = now(), updated_by = v_user_id, updated_at = now()
  where id = v_event.id and deleted_at is null;

  get diagnostics v_row_count = row_count;
  if v_row_count = 0 then
    return false;
  end if;

  insert into public.audit_logs (
    entity_type, entity_id, project_id, action, changed_fields, actor_id, actor_role
  ) values (
    'calendar_event', v_event.id, v_event.project_id,
    'calendar_milestone_soft_deleted',
    jsonb_build_object(
      'event_type', 'milestone',
      'scope', case when v_event.task_id is null then 'project' else 'task' end,
      'task_id', v_event.task_id
    ),
    v_user_id, v_role
  );

  return true;
end;
$function$;

revoke all on function public.create_calendar_milestone(uuid, uuid, text, text, timestamptz, timestamptz, boolean, text) from public;
revoke all on function public.create_calendar_milestone(uuid, uuid, text, text, timestamptz, timestamptz, boolean, text) from anon;
grant execute on function public.create_calendar_milestone(uuid, uuid, text, text, timestamptz, timestamptz, boolean, text) to authenticated;

revoke all on function public.update_calendar_milestone(uuid, uuid, uuid, text, text, timestamptz, timestamptz, boolean, text) from public;
revoke all on function public.update_calendar_milestone(uuid, uuid, uuid, text, text, timestamptz, timestamptz, boolean, text) from anon;
grant execute on function public.update_calendar_milestone(uuid, uuid, uuid, text, text, timestamptz, timestamptz, boolean, text) to authenticated;

revoke all on function public.soft_delete_calendar_milestone(uuid) from public;
revoke all on function public.soft_delete_calendar_milestone(uuid) from anon;
grant execute on function public.soft_delete_calendar_milestone(uuid) to authenticated;

commit;
