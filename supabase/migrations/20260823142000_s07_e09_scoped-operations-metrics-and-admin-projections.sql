-- S07 E09 M3: scoped operations metrics and Admin-safe projections.
-- Candidate only; reviewed source for:
-- supabase/migrations/20260823142000_s07_e09_scoped-operations-metrics-and-admin-projections.sql
--
-- Creates only authenticated, SECURITY DEFINER read RPCs. It creates no tables,
-- indexes, views, policies, diagnostics data, provider behavior, or mutations.
-- The existing list_suppressed_notification_operations RPC is intentionally
-- unchanged.

begin;

-- -----------------------------------------------------------------------------
-- 1. Role-safe scoped operational metrics
-- -----------------------------------------------------------------------------
create function public.get_scoped_operations_metrics(
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
  v_is_admin boolean := (select private.is_admin());
  v_queue_authorized boolean;
  v_from timestamptz;
  v_to timestamptz;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
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

  if not v_is_admin then
    if p_project_id is null then
      raise exception 'A permitted project is required for PM metrics';
    end if;

    if not (select private.is_project_pm(p_project_id)) then
      raise exception 'Project metrics are not permitted for this caller';
    end if;
  end if;

  -- Notification-operation aggregates remain unavailable to PM Watchers,
  -- matching the existing Admin/active-PM-Lead queue boundary.
  v_queue_authorized :=
    v_is_admin
    or (
      p_project_id is not null
      and (select private.is_project_lead(p_project_id))
    );

  return query
  with scoped_projects as (
    select p.id,
           p.status
    from public.projects p
    where p.deleted_at is null
      and (
        v_is_admin
        or p.id = p_project_id
      )
  ),
  project_statuses as (
    select sp.status::text as status,
           count(*)::bigint as count_value
    from scoped_projects sp
    group by sp.status
  ),
  task_attention as (
    select
      count(*) filter (
        where t.status <> 'completed'
      )::bigint as active_task_count,
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
    select d.status::text as status,
           count(*)::bigint as count_value
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
      count(*) filter (
        where m.client_review_hours is not null
      )::bigint as cycle_count,
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
      count(*) filter (
        where c.reopened_at is not null
      )::bigint as reopening_count,
      avg(c.cycle_duration_days) as average_duration_days
    from public.project_completion_cycles_view c
    join scoped_projects sp on sp.id = c.project_id
    where c.completed_at >= v_from
      and c.completed_at < v_to
  ),
  queue_state as (
    select
      case
        when v_queue_authorized then
          count(*) filter (
            where nr.channel = 'in_app'
              and nr.read_at is null
          )::bigint
        else null::bigint
      end as unread_in_app_count,
      case
        when v_queue_authorized then
          count(*) filter (
            where nr.channel in ('email', 'whatsapp')
              and nr.delivery_status = 'suppressed'
              and nr.suppressed_at >= v_from
              and nr.suppressed_at < v_to
          )::bigint
        else null::bigint
      end as suppressed_external_count
    from public.notification_recipients nr
    join public.notification_events ne on ne.id = nr.event_id
    where v_queue_authorized
      and (
        v_is_admin
        or exists (
          select 1
          from scoped_projects sp
          where sp.id = ne.project_id
        )
      )
  ),
  unresolved_link_reports as (
    select count(*)::bigint as count_value
    from public.deliverable_link_reports lr
    join public.deliverables d on d.id = lr.deliverable_id
    join scoped_projects sp on sp.id = d.project_id
    where d.deleted_at is null
      and lr.status = 'open'
  )
  select
    coalesce(
      (
        select jsonb_object_agg(ps.status, ps.count_value)
        from project_statuses ps
      ),
      '{}'::jsonb
    ) as project_counts_by_status,
    coalesce((select ta.active_task_count from task_attention ta), 0)::bigint,
    coalesce((select ta.overdue_task_count from task_attention ta), 0)::bigint,
    coalesce((select ta.deadline_attention_count from task_attention ta), 0)::bigint,
    coalesce(
      (
        select jsonb_object_agg(ps.status, ps.count_value)
        from production_statuses ps
      ),
      '{}'::jsonb
    ) as production_deliverable_counts_by_status,
    coalesce(
      (select fd.count_value from finalized_deliverables fd),
      0
    )::bigint,
    coalesce(
      (select crc.cycle_count from client_review_cycles crc),
      0
    )::bigint,
    (select crc.average_hours from client_review_cycles crc) as average_client_review_hours,
    coalesce(
      (select cc.completion_count from completion_cycles cc),
      0
    )::bigint,
    coalesce(
      (select cc.reopening_count from completion_cycles cc),
      0
    )::bigint,
    (select cc.average_duration_days from completion_cycles cc)
      as average_completion_cycle_duration_days,
    (select qs.unread_in_app_count from queue_state qs),
    (select qs.suppressed_external_count from queue_state qs),
    coalesce(
      (select ulr.count_value from unresolved_link_reports ulr),
      0
    )::bigint,
    v_from,
    v_to;
end;
$function$;

alter function public.get_scoped_operations_metrics(uuid, timestamptz, timestamptz)
  owner to postgres;

revoke all on function public.get_scoped_operations_metrics(
  uuid,
  timestamptz,
  timestamptz
) from public;

revoke all on function public.get_scoped_operations_metrics(
  uuid,
  timestamptz,
  timestamptz
) from anon;

grant execute on function public.get_scoped_operations_metrics(
  uuid,
  timestamptz,
  timestamptz
) to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Admin-only bounded audit history
-- -----------------------------------------------------------------------------
create function public.list_admin_audit_history(
  p_from timestamptz,
  p_to timestamptz,
  p_before_created_at timestamptz default null,
  p_before_audit_id bigint default null,
  p_limit integer default 25
)
returns table (
  audit_id bigint,
  created_at timestamptz,
  action text,
  entity_type public.entity_type,
  entity_id uuid,
  project_id uuid,
  project_name text,
  actor_role public.app_role,
  old_status text,
  new_status text,
  changed_field_summary text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_from timestamptz;
  v_to timestamptz;
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not (select private.is_admin()) then
    raise exception 'Admin access required';
  end if;

  if p_from is null and p_to is null then
    v_from := statement_timestamp() - interval '90 days';
    v_to := statement_timestamp();
  elsif p_from is null or p_to is null then
    raise exception 'Audit range requires both p_from and p_to';
  else
    v_from := p_from;
    v_to := p_to;
  end if;

  if v_from >= v_to then
    raise exception 'Audit range start must precede its end';
  end if;

  if v_to - v_from > interval '93 days' then
    raise exception 'Audit range must not exceed 93 days';
  end if;

  if (
    (p_before_created_at is null and p_before_audit_id is not null)
    or (
      p_before_created_at is not null
      and p_before_audit_id is null
    )
  ) then
    raise exception 'Audit history cursor must be complete';
  end if;

  return query
  select
    a.id as audit_id,
    a.created_at,
    a.action,
    a.entity_type,
    case
      when a.entity_type in (
        'project',
        'task',
        'deliverable',
        'calendar_event',
        'link_report'
      ) then a.entity_id
      else null
    end as entity_id,
    case
      when p.id is not null then a.project_id
      else null
    end as project_id,
    case
      when p.id is not null then p.name
      else null
    end as project_name,
    a.actor_role,
    a.old_status,
    a.new_status,
    case
      when a.old_status is distinct from a.new_status
        then 'Status changed'
      when a.action in (
        'project_completed',
        'project_reopened',
        'project_status_recovered'
      ) then 'Project lifecycle changed'
      when a.action in (
        'entity_soft_deleted',
        'entity_restored'
      ) then 'Record lifecycle changed'
      when a.action in (
        'invite_accepted',
        'invite_created',
        'invite_revoked'
      ) then 'Invitation lifecycle changed'
      when a.action like 'deliverable_%'
        then 'Deliverable operation recorded'
      when a.action like 'task_%'
        then 'Task operation recorded'
      when a.action like 'calendar_%'
        then 'Calendar operation recorded'
      when a.action like 'link_%'
        then 'Link incident operation recorded'
      else null
    end as changed_field_summary
  from public.audit_logs a
  left join public.projects p
    on p.id = a.project_id
   and p.deleted_at is null
  where a.created_at >= v_from
    and a.created_at < v_to
    and (
      p_before_created_at is null
      or a.created_at < p_before_created_at
      or (
        a.created_at = p_before_created_at
        and a.id < p_before_audit_id
      )
    )
  order by a.created_at desc, a.id desc
  limit v_limit;
end;
$function$;

alter function public.list_admin_audit_history(
  timestamptz,
  timestamptz,
  timestamptz,
  bigint,
  integer
) owner to postgres;

revoke all on function public.list_admin_audit_history(
  timestamptz,
  timestamptz,
  timestamptz,
  bigint,
  integer
) from public;

revoke all on function public.list_admin_audit_history(
  timestamptz,
  timestamptz,
  timestamptz,
  bigint,
  integer
) from anon;

grant execute on function public.list_admin_audit_history(
  timestamptz,
  timestamptz,
  timestamptz,
  bigint,
  integer
) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Admin-only profile and invitation operational-state stream
-- -----------------------------------------------------------------------------
create function public.list_admin_user_invitation_state(
  p_before_created_at timestamptz default null,
  p_before_profile_id uuid default null,
  p_limit integer default 25
)
returns table (
  record_id uuid,
  record_kind text,
  created_at timestamptz,
  profile_id uuid,
  full_name text,
  application_role public.app_role,
  is_active boolean,
  preferred_locale text,
  email_notifications_enabled boolean,
  whatsapp_opt_in boolean,
  last_seen_at timestamptz,
  invitation_id uuid,
  invitation_status public.invite_status,
  project_id uuid,
  project_name text,
  invitation_expires_at timestamptz,
  invitation_accepted_at timestamptz,
  invitation_revoked_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
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

alter function public.list_admin_user_invitation_state(
  timestamptz,
  uuid,
  integer
) owner to postgres;

revoke all on function public.list_admin_user_invitation_state(
  timestamptz,
  uuid,
  integer
) from public;

revoke all on function public.list_admin_user_invitation_state(
  timestamptz,
  uuid,
  integer
) from anon;

grant execute on function public.list_admin_user_invitation_state(
  timestamptz,
  uuid,
  integer
) to authenticated;

commit;
