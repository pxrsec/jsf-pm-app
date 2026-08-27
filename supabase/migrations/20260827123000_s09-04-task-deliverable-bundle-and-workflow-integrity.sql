-- Migration: S09-04 Task-deliverable bundle creation and workflow integrity
-- Reference: dev-docs/specs/s09/s09-04-task-deliverables-refinement-implementation-spec.md
-- Status: SOURCE ONLY. Review, commit, and explicitly authorize application to jsf-pm-dev
-- before any remote mutation. Do not edit this migration after application.

begin;

-- Production deliverables are internal-work outputs. They always require an
-- internal-review deadline. A client-delivery deadline is required only by the
-- trigger when their project is client-facing; it is forbidden for internal
-- projects. Client submissions have their independent client-owned deadline.
alter table public.deliverables
  drop constraint deliverables_production_ck;

alter table public.deliverables
  add constraint deliverables_production_ck check (
    workflow_type <> 'production'
    or (
      internal_review_deadline_at is not null
      and (
        client_delivery_deadline_at is null
        or client_delivery_deadline_at >= internal_review_deadline_at
      )
      and submission_deadline_at is null
      and status <> 'submitted'
    )
  );

-- Parent-task type is the canonical discriminator for deliverable workflow and
-- assignee capacity. `has_deliverables` becomes a positive denormalized marker:
-- it must never prevent an otherwise authorized later deliverable from being
-- added to a task created without one.
create or replace function private.sync_and_validate_deliverable()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
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

  select p.project_type, p.status, p.client_id, p.deleted_at
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
    if v_project.project_type <> 'client' or v_project.client_id is null then
      raise exception 'Client-request deliverables require a client project with a linked client organization';
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
      if v_project.client_id is null then
        raise exception 'Client-project production deliverables require a linked client organization';
      end if;

      if new.client_delivery_deadline_at is null
        or new.client_delivery_deadline_at < new.internal_review_deadline_at then
        raise exception 'Client-project production deliverables require client_delivery_deadline_at on or after internal_review_deadline_at';
      end if;
    elsif new.client_delivery_deadline_at is not null then
      raise exception 'Internal-project production deliverables cannot have client_delivery_deadline_at';
    end if;
  end if;

  update public.tasks
  set has_deliverables = true
  where id = new.task_id
    and has_deliverables = false;

  return new;
end;
$$;

-- One transactional command creates the task plus zero or more child
-- deliverables. It is intentionally the only path used by the combined dialog.
-- Existing standalone deliverable creation remains supported through the table
-- command and the trigger above.
create or replace function public.create_task_with_deliverables(
  p_project_id uuid,
  p_title text,
  p_description text,
  p_task_type public.task_type,
  p_priority public.task_priority,
  p_deadline_at timestamptz,
  p_assignee_id uuid,
  p_deliverables jsonb default '[]'::jsonb
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

  select (private.is_admin() or private.is_project_lead(p_project_id))
  into v_is_authorized;

  if not coalesce(v_is_authorized, false) then
    raise exception 'Only an Admin or active project PM Lead can create tasks and deliverables';
  end if;

  insert into public.tasks (
    project_id,
    assignee_id,
    task_type,
    title,
    description,
    priority,
    deadline_at,
    has_deliverables,
    created_by
  ) values (
    p_project_id,
    p_assignee_id,
    p_task_type,
    p_title,
    p_description,
    p_priority,
    p_deadline_at,
    jsonb_array_length(p_deliverables) > 0,
    v_actor_id
  )
  returning * into v_task;

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
      project_id,
      task_id,
      assignee_id,
      workflow_type,
      title,
      specifications,
      submission_deadline_at,
      internal_review_deadline_at,
      client_delivery_deadline_at,
      created_by
    ) values (
      p_project_id,
      v_task.id,
      (v_deliverable->>'assignee_id')::uuid,
      (v_deliverable->>'workflow_type')::public.deliverable_workflow_type,
      btrim(v_deliverable->>'title'),
      btrim(v_deliverable->>'specifications'),
      nullif(v_deliverable->>'submission_deadline_at', '')::timestamptz,
      nullif(v_deliverable->>'internal_review_deadline_at', '')::timestamptz,
      nullif(v_deliverable->>'client_delivery_deadline_at', '')::timestamptz,
      v_actor_id
    )
    returning id into v_deliverable_id;

    v_created_deliverable_ids := v_created_deliverable_ids || to_jsonb(v_deliverable_id);
  end loop;

  return jsonb_build_object(
    'task', to_jsonb(v_task),
    'deliverable_ids', v_created_deliverable_ids
  );
end;
$$;

revoke all on function public.create_task_with_deliverables(
  uuid, text, text, public.task_type, public.task_priority, timestamptz, uuid, jsonb
) from public;

grant execute on function public.create_task_with_deliverables(
  uuid, text, text, public.task_type, public.task_priority, timestamptz, uuid, jsonb
) to authenticated;

commit;
