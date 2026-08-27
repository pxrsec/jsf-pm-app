-- S09: permit Admin project scope in the existing aggregate metrics projections.
--
-- Prerequisite: S07 E09 aggregate metrics migrations and
-- 20260826110000_s09_user-scoped-operations-metrics.sql.
--
-- This is a forward-only replacement of two read-only RPC bodies. It preserves
-- their signatures, returned row shapes, grants, and owners. It changes the S07
-- project-membership restriction: active Admin and PM company-owner accounts may
-- query all non-deleted projects or one selected non-deleted project.

begin;

create or replace function public.get_scoped_operations_metrics(
  p_project_id uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null
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
  range_from timestamptz,
  range_to timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
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
  ),
  production_statuses as (
    select d.status::text as status, count(*)::bigint as count_value
    from public.deliverables d
    join scoped_projects sp on sp.id = d.project_id
    where d.deleted_at is null
      and d.workflow_type = 'production'
    group by d.status
  ),
  finalized_deliverables as (
    select count(*)::bigint as count_value
    from public.deliverables d
    join scoped_projects sp on sp.id = d.project_id
    where d.deleted_at is null
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
    join scoped_projects sp on sp.id = d.project_id
    where d.deleted_at is null and lr.status = 'open'
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
  p_project_id uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table (
  period_start timestamptz,
  period_end timestamptz,
  finalized_deliverable_count bigint,
  client_review_cycle_count bigint,
  completion_cycle_count bigint,
  reopening_cycle_count bigint
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
    where d.deleted_at is null
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

alter function public.get_scoped_operations_metrics(uuid, timestamptz, timestamptz)
  owner to postgres;
alter function public.list_scoped_operations_metric_trend(uuid, timestamptz, timestamptz)
  owner to postgres;

revoke all on function public.get_scoped_operations_metrics(uuid, timestamptz, timestamptz) from public, anon;
revoke all on function public.list_scoped_operations_metric_trend(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.get_scoped_operations_metrics(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.list_scoped_operations_metric_trend(uuid, timestamptz, timestamptz) to authenticated;

commit;
