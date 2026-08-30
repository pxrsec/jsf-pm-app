-- Migration: S09-06 milestone goals, cross-project task associations, and progress
-- Reference: dev-docs/specs/s09/s09-06-milestone-goals-and-task-progress-implementation-spec.md
-- Status: SOURCE ONLY. Review, commit, and explicitly authorize application to
-- jsf-pm-dev before remote mutation. Do not edit this migration after application.
--
-- This is an append-only replacement of the legacy manual calendar-event
-- milestone model. Milestones become first-class planning goals; the calendar
-- remains a role-safe projection of those goals and existing deadline records.

-- PostgreSQL does not allow a newly-added enum value to be used until the
-- surrounding transaction commits. Add the audit entity value before the main
-- transactional migration body.
alter type public.entity_type add value if not exists 'milestone';

begin;

-- -----------------------------------------------------------------------------
-- 1. Canonical milestone domain
-- -----------------------------------------------------------------------------

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('project', 'company')),
  project_id uuid references public.projects(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  description text check (description is null or char_length(btrim(description)) <= 2000),
  target_date date not null,
  color_override text check (
    color_override is null
    or color_override in ('chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5')
  ),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint milestones_scope_project_ck check (
    (scope = 'project' and project_id is not null)
    or (scope = 'company' and project_id is null)
  )
);

create table public.milestone_tasks (
  milestone_id uuid not null references public.milestones(id) on delete restrict,
  task_id uuid not null references public.tasks(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (milestone_id, task_id)
);

create index milestones_active_target_date_idx
  on public.milestones (target_date asc, id asc)
  where deleted_at is null;

create index milestones_active_project_target_date_idx
  on public.milestones (project_id, target_date asc, id asc)
  where deleted_at is null and scope = 'project';

create index milestone_tasks_task_id_idx
  on public.milestone_tasks (task_id, milestone_id);

create trigger set_milestones_updated_at
  before update on public.milestones
  for each row execute function private.set_updated_at();

-- A project milestone may contain only active tasks from its owning project.
-- A company milestone may contain active tasks from any active, non-cancelled
-- project. The relation is deliberately many-to-many.
create or replace function private.validate_milestone_task_link()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_scope text;
  v_milestone_project_id uuid;
  v_milestone_deleted_at timestamptz;
  v_task_project_id uuid;
  v_task_deleted_at timestamptz;
  v_project_deleted_at timestamptz;
  v_project_status public.project_status;
begin
  select m.scope, m.project_id, m.deleted_at
    into v_scope, v_milestone_project_id, v_milestone_deleted_at
  from public.milestones m
  where m.id = new.milestone_id;

  if not found or v_milestone_deleted_at is not null then
    raise exception 'Milestone must exist and be active';
  end if;

  select t.project_id, t.deleted_at, p.deleted_at, p.status
    into v_task_project_id, v_task_deleted_at, v_project_deleted_at, v_project_status
  from public.tasks t
  join public.projects p on p.id = t.project_id
  where t.id = new.task_id;

  if not found
    or v_task_deleted_at is not null
    or v_project_deleted_at is not null
    or v_project_status = 'cancelled' then
    raise exception 'Milestone task must belong to an active non-cancelled project';
  end if;

  if v_scope = 'project' and v_task_project_id <> v_milestone_project_id then
    raise exception 'A project milestone may only contain tasks from its own project';
  end if;

  return new;
end;
$$;

create trigger milestone_tasks_validate_scope_trg
  before insert or update of milestone_id, task_id on public.milestone_tasks
  for each row execute function private.validate_milestone_task_link();

-- No browser/table access is a contract for milestones. All reads and mutations
-- flow through purpose-limited SECURITY DEFINER functions below.
alter table public.milestones enable row level security;
alter table public.milestone_tasks enable row level security;
revoke all on table public.milestones from anon, authenticated;
revoke all on table public.milestone_tasks from anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Preserve active legacy milestones before retiring calendar-event ownership
-- -----------------------------------------------------------------------------

-- Existing manual milestones always have a project. Copy them as project goals;
-- preserve their title/description/color and map the recorded start into the
-- company business date. Existing task-scoped milestones retain their one task
-- association when the task remains active. Legacy source rows are then soft
-- deleted so no stale direct/read path can display a duplicate.
do $$
declare
  v_legacy record;
  v_milestone_id uuid;
begin
  for v_legacy in
    select ce.*
    from public.calendar_events ce
    where ce.event_type = 'milestone'
      and ce.deleted_at is null
    order by ce.created_at asc, ce.id asc
  loop
    insert into public.milestones (
      scope,
      project_id,
      title,
      description,
      target_date,
      color_override,
      created_by,
      updated_by,
      created_at,
      updated_at
    ) values (
      'project',
      v_legacy.project_id,
      v_legacy.title,
      v_legacy.description,
      (v_legacy.starts_at at time zone 'America/Mexico_City')::date,
      v_legacy.color_override,
      v_legacy.created_by,
      v_legacy.updated_by,
      v_legacy.created_at,
      v_legacy.updated_at
    ) returning id into v_milestone_id;

    if v_legacy.task_id is not null
      and exists (
        select 1
        from public.tasks t
        join public.projects p on p.id = t.project_id
        where t.id = v_legacy.task_id
          and t.deleted_at is null
          and p.deleted_at is null
          and p.status <> 'cancelled'
      ) then
      insert into public.milestone_tasks (milestone_id, task_id, created_by, created_at)
      values (v_milestone_id, v_legacy.task_id, v_legacy.created_by, v_legacy.created_at);
    end if;

    update public.calendar_events
    set deleted_at = now(), updated_at = now()
    where id = v_legacy.id and deleted_at is null;

    insert into public.audit_logs (
      entity_type, entity_id, project_id, action, changed_fields, actor_id, actor_role
    ) values (
      'milestone',
      v_milestone_id,
      v_legacy.project_id,
      'milestone_migrated_from_calendar_event',
      jsonb_build_object(
        'legacy_calendar_event_id', v_legacy.id,
        'legacy_task_id', v_legacy.task_id,
        'legacy_ends_at_discarded', v_legacy.ends_at is not null,
        'legacy_is_all_day_discarded', v_legacy.is_all_day
      ),
      v_legacy.created_by,
      'admin'
    );
  end loop;
end;
$$;

-- Retire the legacy manual-milestone command surface. The application must move
-- to the new commands in this migration before users can mutate milestones.
drop function if exists public.create_calendar_milestone(uuid, uuid, text, text, timestamptz, timestamptz, boolean, text);
drop function if exists public.update_calendar_milestone(uuid, uuid, uuid, text, text, timestamptz, timestamptz, boolean, text);
drop function if exists public.soft_delete_calendar_milestone(uuid);
drop function if exists public.get_calendar_milestone_for_edit(uuid);
drop function if exists public.list_calendar_milestone_targets();

-- -----------------------------------------------------------------------------
-- 3. Role-safe read projections
-- -----------------------------------------------------------------------------

-- Manager-only form options for task creation. Project tasks can contribute to
-- their own project goals and to any active company goal; they cannot link to a
-- different project's local goal.
create function public.list_task_milestone_options(p_project_id uuid)
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
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role public.app_role := (select private.current_user_role());
begin
  if v_user_id is null or v_role not in ('admin', 'pm') then
    raise exception 'Milestone planning is not permitted';
  end if;

  if not exists (
    select 1 from public.projects p
    where p.id = p_project_id and p.deleted_at is null
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
  left join public.projects p on p.id = m.project_id and p.deleted_at is null
  where m.deleted_at is null
    and (
      m.scope = 'company'
      or (m.scope = 'project' and m.project_id = p_project_id)
    )
  order by m.target_date asc, m.title asc, m.id asc;
end;
$$;

-- Manager-only options for milestone create/edit. Task data is purpose-limited:
-- it contains only the identifiers and labels required to choose associations.
create function public.list_milestone_management_targets()
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
set search_path = pg_catalog, public
as $$
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
  join public.tasks t on t.project_id = p.id and t.deleted_at is null
  where p.deleted_at is null
    and p.status <> 'cancelled'
  order by p.name asc, t.deadline_at asc, t.title asc, t.id asc;
end;
$$;

-- Progress counts only active associated tasks. Soft-deleted tasks remain in the
-- association table for audit/history but do not distort the live denominator.
create function public.get_milestone_detail(p_milestone_id uuid)
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
set search_path = pg_catalog, public
as $$
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
  left join public.projects p on p.id = m.project_id and p.deleted_at is null
  left join public.milestone_tasks mt on mt.milestone_id = m.id
  left join public.tasks t on t.id = mt.task_id and t.deleted_at is null
  where m.id = p_milestone_id
    and m.deleted_at is null
  group by m.id, p.name;
end;
$$;

create function public.list_milestone_tasks(p_milestone_id uuid)
returns table (
  task_id uuid,
  project_id uuid,
  project_name text,
  title text,
  status public.task_status,
  priority public.task_priority,
  deadline_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role public.app_role := (select private.current_user_role());
begin
  if v_user_id is null or v_role not in ('admin', 'pm') then
    raise exception 'Milestone detail is not permitted';
  end if;

  if not exists (
    select 1 from public.milestones m
    where m.id = p_milestone_id and m.deleted_at is null
  ) then
    return;
  end if;

  return query
  select t.id, p.id, p.name, t.title, t.status, t.priority, t.deadline_at
  from public.milestone_tasks mt
  join public.tasks t on t.id = mt.task_id and t.deleted_at is null
  join public.projects p on p.id = t.project_id and p.deleted_at is null
  where mt.milestone_id = p_milestone_id
  order by p.name asc, t.deadline_at asc, t.title asc, t.id asc;
end;
$$;

-- Project Overview receives all local goals plus company goals to which this
-- project contributes. Company-goal progress remains global by design.
create function public.list_project_milestone_summaries(p_project_id uuid)
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
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role public.app_role := (select private.current_user_role());
begin
  if v_user_id is null or v_role not in ('admin', 'pm') then
    raise exception 'Milestone summary is not permitted';
  end if;

  if not exists (
    select 1 from public.projects p
    where p.id = p_project_id and p.deleted_at is null
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
  left join public.tasks t on t.id = mt.task_id and t.deleted_at is null
  where m.deleted_at is null
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
          where contribution.milestone_id = m.id
            and contribution_task.project_id = p_project_id
        )
      )
    )
  group by m.id
  order by m.target_date asc, m.title asc, m.id asc;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Manager-only mutations
-- -----------------------------------------------------------------------------

create function public.create_milestone(
  p_scope text,
  p_project_id uuid default null,
  p_title text default null,
  p_description text default null,
  p_target_date date default null,
  p_color_override text default null,
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
set search_path = pg_catalog, public
as $$
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
    where p.id = p_project_id and p.deleted_at is null
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
$$;

create function public.update_milestone(
  p_milestone_id uuid,
  p_scope text,
  p_project_id uuid default null,
  p_title text default null,
  p_description text default null,
  p_target_date date default null,
  p_color_override text default null,
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
set search_path = pg_catalog, public
as $$
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
  where id = p_milestone_id and deleted_at is null
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
    where p.id = p_project_id and p.deleted_at is null
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
    left join public.tasks t on t.id = requested.task_id and t.deleted_at is null
    left join public.projects p on p.id = t.project_id and p.deleted_at is null
    where t.id is null or p.id is null or p.status = 'cancelled'
  ) then
    raise exception 'Milestone task must belong to an active non-cancelled project';
  end if;

  if p_scope = 'project' and exists (
    select 1
    from unnest(p_task_ids) as requested(task_id)
    join public.tasks t on t.id = requested.task_id and t.deleted_at is null
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
$$;

create function public.soft_delete_milestone(p_milestone_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_role public.app_role := (select private.current_user_role());
  v_milestone public.milestones%rowtype;
begin
  if v_actor_id is null or v_role not in ('admin', 'pm') then
    raise exception 'Milestone planning is not permitted';
  end if;

  select * into v_milestone
  from public.milestones
  where id = p_milestone_id and deleted_at is null
  for update;

  if not found then
    return false;
  end if;

  update public.milestones
  set deleted_at = now(), updated_by = v_actor_id, updated_at = now()
  where id = v_milestone.id and deleted_at is null;

  insert into public.audit_logs (
    entity_type, entity_id, project_id, action, changed_fields, actor_id, actor_role
  ) values (
    'milestone', v_milestone.id, v_milestone.project_id, 'milestone_soft_deleted',
    jsonb_build_object('scope', v_milestone.scope), v_actor_id, v_role
  );

  return true;
end;
$$;

-- Extend the accepted S09-04 atomic task bundle command. A task created with
-- selected milestones is linked inside the same transaction as its optional
-- deliverables. The existing task-only direct insert path remains valid when no
-- milestone is selected.
drop function public.create_task_with_deliverables(
  uuid, text, text, public.task_type, public.task_priority, timestamptz, uuid, jsonb
);

create function public.create_task_with_deliverables(
  p_project_id uuid,
  p_title text,
  p_description text,
  p_task_type public.task_type,
  p_priority public.task_priority,
  p_deadline_at timestamptz,
  p_assignee_id uuid,
  p_deliverables jsonb default '[]'::jsonb,
  p_milestone_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
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
$$;

-- -----------------------------------------------------------------------------
-- 5. Calendar projection replacement
-- -----------------------------------------------------------------------------

-- Preserve the established feed DTO and all non-milestone deadline visibility.
-- Manual milestones now come exclusively from public.milestones. Operators and
-- Clients do not receive company/project goals through Calendar; an Operator's
-- goal context is presented only in their assigned-task detail surface.
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
as $$
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
    join public.projects p on p.id = t.project_id and p.deleted_at is null
    where t.deleted_at is null
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
    join public.projects p on p.id = d.project_id and p.deleted_at is null
    where d.deleted_at is null
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

    select
      d.id,
      case when v_role = 'client' and not (select private.is_project_client(d.project_id)) then null::uuid else d.project_id end,
      case when v_role = 'client' and not (select private.is_project_client(d.project_id)) then null::text else p.name end,
      d.task_id,
      d.title || ' (Client Submission)',
      'task_deadline'::public.calendar_event_type,
      d.submission_deadline_at, d.submission_deadline_at, true, null::text
    from public.deliverables d
    join public.projects p on p.id = d.project_id and p.deleted_at is null
    where d.deleted_at is null
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
    left join public.projects p on p.id = m.project_id and p.deleted_at is null
    where v_is_manager
      and m.deleted_at is null
      and (
        p_project_id is null
        or (m.scope = 'project' and m.project_id = p_project_id)
        or (
          m.scope = 'company'
          and exists (
            select 1
            from public.milestone_tasks mt
            join public.tasks t on t.id = mt.task_id and t.deleted_at is null
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
$$;

-- -----------------------------------------------------------------------------
-- 6. Privileges
-- -----------------------------------------------------------------------------

revoke all on function public.list_task_milestone_options(uuid) from public, anon;
revoke all on function public.list_milestone_management_targets() from public, anon;
revoke all on function public.get_milestone_detail(uuid) from public, anon;
revoke all on function public.list_milestone_tasks(uuid) from public, anon;
revoke all on function public.list_project_milestone_summaries(uuid) from public, anon;
revoke all on function public.create_milestone(text, uuid, text, text, date, text, uuid[]) from public, anon;
revoke all on function public.update_milestone(uuid, text, uuid, text, text, date, text, uuid[]) from public, anon;
revoke all on function public.soft_delete_milestone(uuid) from public, anon;
revoke all on function public.create_task_with_deliverables(uuid, text, text, public.task_type, public.task_priority, timestamptz, uuid, jsonb, uuid[]) from public, anon;
revoke all on function public.list_role_safe_calendar_events(timestamptz, timestamptz, uuid) from public, anon;

grant execute on function public.list_task_milestone_options(uuid) to authenticated;
grant execute on function public.list_milestone_management_targets() to authenticated;
grant execute on function public.get_milestone_detail(uuid) to authenticated;
grant execute on function public.list_milestone_tasks(uuid) to authenticated;
grant execute on function public.list_project_milestone_summaries(uuid) to authenticated;
grant execute on function public.create_milestone(text, uuid, text, text, date, text, uuid[]) to authenticated;
grant execute on function public.update_milestone(uuid, text, uuid, text, text, date, text, uuid[]) to authenticated;
grant execute on function public.soft_delete_milestone(uuid) to authenticated;
grant execute on function public.create_task_with_deliverables(uuid, text, text, public.task_type, public.task_priority, timestamptz, uuid, jsonb, uuid[]) to authenticated;
grant execute on function public.list_role_safe_calendar_events(timestamptz, timestamptz, uuid) to authenticated;

commit;
