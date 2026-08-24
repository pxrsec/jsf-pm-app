-- S07 E09 M5: bounded role-safe operational metric trend projection.
--
-- Prerequisite: 20260823142000_s07_e09_scoped-operations-metrics-and-admin-projections.sql.
-- This forward migration adds one authenticated, read-only SECURITY DEFINER RPC.
-- It does not alter M3's aggregate metric contract, create tables/views/indexes,
-- mutate application data, enable providers, schedule work, or expose diagnostics.

begin;

create function public.list_scoped_operations_metric_trend(
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
  v_is_admin boolean;
  v_from timestamptz;
  v_to timestamptz;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  -- Do not rely on a browser route guard or a valid Auth session alone. An
  -- inactive/soft-deleted application profile has no operations-metrics access.
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

  v_is_admin := (select private.is_admin());

  -- Admin receives the global trend only. PM callers must select one project
  -- that the database proves is in their active PM scope. This preserves the
  -- same global-Admin / single-project-PM distinction as M3.
  if not v_is_admin then
    if p_project_id is null then
      raise exception 'A permitted project is required for PM metrics';
    end if;

    if not (select private.is_project_pm(p_project_id)) then
      raise exception 'Project metrics are not permitted for this caller';
    end if;
  end if;

  return query
  with scoped_projects as (
    select p.id
    from public.projects p
    where p.deleted_at is null
      and (
        v_is_admin
        or p.id = p_project_id
      )
  ),
  -- Buckets are deterministic half-open seven-day intervals anchored to the
  -- caller's validated explicit range. The final bucket may be shorter. This
  -- intentionally avoids a session-time-zone-dependent calendar-week boundary.
  periods as (
    select
      series.bucket_start as period_start,
      least(series.bucket_start + interval '7 days', v_to) as period_end
    from generate_series(
      v_from,
      v_to,
      interval '7 days'
    ) as series(bucket_start)
    where series.bucket_start < v_to
  )
  select
    periods.period_start,
    periods.period_end,
    coalesce(finalized.count_value, 0)::bigint as finalized_deliverable_count,
    coalesce(reviewed.count_value, 0)::bigint as client_review_cycle_count,
    coalesce(completed.count_value, 0)::bigint as completion_cycle_count,
    coalesce(completed.reopening_count, 0)::bigint as reopening_cycle_count
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

alter function public.list_scoped_operations_metric_trend(uuid, timestamptz, timestamptz)
  owner to postgres;

revoke all on function public.list_scoped_operations_metric_trend(
  uuid,
  timestamptz,
  timestamptz
) from public;

revoke all on function public.list_scoped_operations_metric_trend(
  uuid,
  timestamptz,
  timestamptz
) from anon;

grant execute on function public.list_scoped_operations_metric_trend(
  uuid,
  timestamptz,
  timestamptz
) to authenticated;

commit;
