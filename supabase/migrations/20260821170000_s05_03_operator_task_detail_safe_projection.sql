-- Migration: S05-03 Operator Task Detail Safe Projection
-- Reference: dev-docs/specs/s05/s05-03-operator-task-detail-and-production-submission-spec.md
-- Scope: extend the security-invoker Operator agenda projection with only the
-- task-resource and production-deliverable detail fields required by S05-03.
-- This migration does not alter RLS, task/deliverable lifecycle commands,
-- assignment semantics, urgency semantics, or any Client-safe projection.

begin;

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
  t.assigned_at,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', tr.id,
          'name', tr.name,
          'url', tr.url,
          'sort_order', tr.sort_order
        )
        order by tr.sort_order asc, tr.id asc
      )
      from public.task_resources tr
      where tr.task_id = t.id
        and tr.deleted_at is null
    ),
    '[]'::jsonb
  ) as task_resources,
  d.specifications as deliverable_specifications,
  d.submission_deadline_at
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

commit;
