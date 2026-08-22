-- Migration: S05-01 Operator Agenda Assigned-At and Completed-Task Semantics
-- Reference: dev-docs/specs/s05/s05-e06-e07-contract-mapping-reference.md
-- Scope: introduce an authoritative current-assignment timestamp and revise the
-- security-invoker Operator agenda projection. This migration does not change
-- Client projections, project membership, task authorization, or lifecycle RPCs.

begin;

-- Existing task rows have no historical assignment event. Their creation time is
-- the deterministic baseline for the first assignment-time value; all future
-- task creation and reassignment are maintained by the trigger below.
alter table public.tasks
  add column assigned_at timestamptz;

update public.tasks
set assigned_at = created_at
where assigned_at is null;

alter table public.tasks
  alter column assigned_at set default now(),
  alter column assigned_at set not null;

-- A task has one current assignee. Protect assigned_at from caller-controlled
-- values: set it on insert and refresh it only when the assignee actually changes.
create or replace function private.set_task_assigned_at()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' then
    new.assigned_at := now();
  elsif new.assignee_id is distinct from old.assignee_id then
    new.assigned_at := now();
  else
    new.assigned_at := old.assigned_at;
  end if;

  return new;
end;
$$;

revoke all on function private.set_task_assigned_at() from public, anon, authenticated;

drop trigger if exists task_set_assigned_at_trg on public.tasks;

create trigger task_set_assigned_at_trg
  before insert or update on public.tasks
  for each row execute function private.set_task_assigned_at();

-- Active agenda rows retain the existing deadline-oriented precedence. A task
-- completed in the assignee's stored IANA timezone is retained only through that
-- local calendar day and takes the completed category. "new" applies after
-- overdue/urgent checks so imminent deadlines remain visibly urgent.
create or replace view public.operator_agenda_view
with (security_invoker = true)
as
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
    when t.status = 'completed' then 'completed'
    when t.deadline_at < now() then 'overdue'
    when t.deadline_at <= now() + interval '24 hours' then 'urgent'
    when t.assigned_at > now() - interval '24 hours' then 'new'
    when t.deadline_at <= now() + interval '72 hours' then 'upcoming'
    else 'normal'
  end as urgency_category,
  t.assigned_at
from public.tasks t
join public.projects p on p.id = t.project_id
join public.profiles assignee_profile on assignee_profile.id = t.assignee_id
left join public.deliverables d on d.task_id = t.id and d.deleted_at is null
where t.assignee_id = (select auth.uid())
  and t.deleted_at is null
  and p.deleted_at is null
  and (
    t.status <> 'completed'
    or (
      t.completed_at is not null
      and (t.completed_at at time zone assignee_profile.timezone)::date
        = (now() at time zone assignee_profile.timezone)::date
    )
  );

-- The existing active-task agenda index remains valid. Completed rows now need a
-- separate access path because the local-day predicate is evaluated per assignee.
create index tasks_operator_agenda_completed_idx
  on public.tasks (assignee_id, completed_at desc)
  where deleted_at is null and status = 'completed';

commit;
