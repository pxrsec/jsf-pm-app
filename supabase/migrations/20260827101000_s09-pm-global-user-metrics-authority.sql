-- S09: give active PM company-owner accounts global user-metrics authority.
--
-- Prerequisites: 20260826110000_s09_user-scoped-operations-metrics.sql and
-- 20260827100000_s09-project-metrics-scope-filter.sql.
--
-- Forward-only replacement. This preserves the RPC signature, returned DTO
-- shape, owner, fixed search path, and authenticated-only execute grant. It
-- replaces the former PM project-membership gate with an active-role gate:
-- only active `admin` and `pm` profiles may query all projects or one project.

begin;

create or replace function public.list_scoped_user_operations_metrics(
  p_project_id uuid default null,
  p_user_id uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table (
  user_id uuid, full_name text, application_role public.app_role, is_active boolean,
  current_active_task_count bigint, task_assigned_count bigint, task_started_count bigint,
  task_completed_count bigint, average_assignment_to_start_hours numeric,
  unstarted_task_count_at_range_end bigint, production_deliverable_submission_count bigint,
  client_submission_count bigint, deliverable_review_count bigint,
  deliverable_delivered_count bigint, in_app_notification_received_count bigint,
  in_app_notification_read_count bigint, in_app_notification_unread_count_at_range_end bigint,
  in_app_notification_unread_over_24h_count_at_range_end bigint,
  average_in_app_notification_read_hours numeric, last_workflow_action_at timestamptz,
  range_from timestamptz, range_to timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
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
    where p.deleted_at is null and (p_project_id is null or p.id = p_project_id)
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
    where t.deleted_at is null
    union
    select d.assignee_id
    from public.deliverables d join scoped_projects sp on sp.id = d.project_id
    where d.deleted_at is null
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
    where t.deleted_at is null
    group by t.assignee_id
  ),
  current_tasks as (
    select t.assignee_id as metric_user_id,
      count(*) filter (where t.status <> 'completed')::bigint as current_active_task_count
    from public.tasks t join scoped_projects sp on sp.id = t.project_id
    where t.deleted_at is null group by t.assignee_id
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

alter function public.list_scoped_user_operations_metrics(uuid, uuid, timestamptz, timestamptz)
  owner to postgres;
revoke all on function public.list_scoped_user_operations_metrics(uuid, uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.list_scoped_user_operations_metrics(uuid, uuid, timestamptz, timestamptz) to authenticated;

commit;
