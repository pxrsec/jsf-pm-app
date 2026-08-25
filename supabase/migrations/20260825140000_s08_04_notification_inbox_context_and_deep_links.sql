-- Sprint 08 / S08-04: actionable recipient-owned in-app notification history.
--
-- This forward migration replaces only the M4 inbox read projection and adds a
-- self-owned acknowledgement command for unread detail navigation. It preserves
-- the 90-day/93-day range policy, read filtering, composite keyset pagination,
-- immutable event history, and external-delivery/operations isolation.
--
-- It does not mutate notification_events, notification generation/fan-out,
-- recipient delivery providers, RLS policies, operations-queue functions, or
-- any project/task/deliverable lifecycle command.

begin;

-- PostgreSQL cannot change a function's TABLE return shape with CREATE OR
-- REPLACE. Drop only the applied M4 six-argument overload before recreating it.
drop function public.list_my_in_app_notifications(
  integer,
  timestamptz,
  timestamptz,
  boolean,
  timestamptz,
  uuid
);

-- The ordinary inbox is still a recipient-owned in-app history. Context and
-- destination are resolved relationally from current safe state; event payload
-- is deliberately not part of the browser contract.
create function public.list_my_in_app_notifications(
  p_limit integer default 25,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_read_state boolean default null,
  p_before_created_at timestamptz default null,
  p_before_recipient_id uuid default null
)
returns table (
  recipient_id uuid,
  trigger public.notification_trigger,
  created_at timestamptz,
  occurred_at timestamptz,
  read_at timestamptz,
  subject_kind text,
  subject_title text,
  project_name text,
  context_kind text,
  context_value text,
  navigation_kind text,
  navigation_project_id uuid,
  navigation_task_id uuid,
  navigation_deliverable_id uuid
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role public.app_role;
  v_from timestamptz;
  v_to timestamptz;
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
begin
  -- An Auth session alone is insufficient for this recipient history surface.
  select p.role
  into v_role
  from public.profiles p
  where p.id = v_user_id
    and p.is_active = true
    and p.deleted_at is null;

  if v_user_id is null or v_role is null then
    raise exception 'Authentication with an active profile is required';
  end if;

  -- Preserve M4's server-owned default and bounded explicit history contract.
  if p_from is null and p_to is null then
    v_to := statement_timestamp();
    v_from := v_to - interval '90 days';
  elsif p_from is null or p_to is null then
    raise exception 'Notification history range requires both bounds';
  else
    v_from := p_from;
    v_to := p_to;
  end if;

  if v_from >= v_to then
    raise exception 'Notification history range start must precede its end';
  end if;

  if v_to - v_from > interval '93 days' then
    raise exception 'Notification history range cannot exceed 93 days';
  end if;

  -- Cursor values are a complete ordered pair; timestamp-only continuation
  -- would omit same-timestamp recipient records at a page boundary.
  if (p_before_created_at is null) <> (p_before_recipient_id is null) then
    raise exception 'Notification history cursor is incomplete';
  end if;

  return query
  with inbox_rows as (
    select
      nr.id as resolved_recipient_id,
      nr.created_at as resolved_created_at,
      nr.read_at as resolved_read_at,
      ne.trigger as resolved_trigger,
      ne.entity_type as resolved_entity_type,
      ne.entity_id as resolved_entity_id,
      ne.project_id as resolved_event_project_id,
      ne.occurred_at as resolved_occurred_at,
      direct_task.id as direct_task_id,
      direct_task.project_id as direct_task_project_id,
      direct_task.assignee_id as direct_task_assignee_id,
      direct_task.task_type as direct_task_type,
      direct_task.title as direct_task_title,
      direct_task.deadline_at as direct_task_deadline_at,
      direct_deliverable.id as direct_deliverable_id,
      direct_deliverable.project_id as direct_deliverable_project_id,
      direct_deliverable.task_id as direct_deliverable_task_id,
      direct_deliverable.assignee_id as direct_deliverable_assignee_id,
      direct_deliverable.workflow_type as direct_deliverable_workflow_type,
      direct_deliverable.status as direct_deliverable_status,
      direct_deliverable.title as direct_deliverable_title,
      link_deliverable.id as link_deliverable_id,
      link_deliverable.project_id as link_deliverable_project_id,
      link_deliverable.task_id as link_deliverable_task_id,
      link_deliverable.assignee_id as link_deliverable_assignee_id,
      link_deliverable.workflow_type as link_deliverable_workflow_type,
      link_deliverable.status as link_deliverable_status,
      link_deliverable.title as link_deliverable_title
    from public.notification_recipients nr
    join public.notification_events ne
      on ne.id = nr.event_id
    left join public.tasks direct_task
      on ne.entity_type = 'task'
      and direct_task.id = ne.entity_id
      and direct_task.deleted_at is null
    left join public.deliverables direct_deliverable
      on ne.entity_type = 'deliverable'
      and direct_deliverable.id = ne.entity_id
      and direct_deliverable.deleted_at is null
    left join public.deliverable_link_reports link_report
      on ne.entity_type = 'link_report'
      and link_report.id = ne.entity_id
    left join public.deliverables link_deliverable
      on link_deliverable.id = link_report.deliverable_id
      and link_deliverable.deleted_at is null
    where nr.user_id = v_user_id
      and nr.channel = 'in_app'
      and nr.created_at >= v_from
      and nr.created_at < v_to
      and (p_read_state is null or (nr.read_at is not null) = p_read_state)
      and (
        p_before_created_at is null
        or nr.created_at < p_before_created_at
        or (
          nr.created_at = p_before_created_at
          and nr.id < p_before_recipient_id
        )
      )
    order by nr.created_at desc, nr.id desc
    limit v_limit
  ), resolved_targets as (
    select
      ir.*,
      case
        when ir.resolved_entity_type = 'project'
          and ir.resolved_entity_id = ir.resolved_event_project_id
          then ir.resolved_event_project_id
        when ir.resolved_entity_type = 'task'
          and ir.direct_task_id is not null
          and ir.direct_task_project_id = ir.resolved_event_project_id
          then ir.direct_task_project_id
        when ir.resolved_entity_type = 'deliverable'
          and ir.direct_deliverable_id is not null
          and ir.direct_deliverable_project_id = ir.resolved_event_project_id
          then ir.direct_deliverable_project_id
        when ir.resolved_entity_type = 'link_report'
          and ir.link_deliverable_id is not null
          and ir.link_deliverable_project_id = ir.resolved_event_project_id
          then ir.link_deliverable_project_id
        else null
      end as resolved_project_id,
      case
        when ir.resolved_entity_type = 'task'
          and ir.direct_task_id is not null
          and ir.direct_task_project_id = ir.resolved_event_project_id
          then ir.direct_task_id
        when ir.resolved_entity_type = 'deliverable'
          and ir.direct_deliverable_id is not null
          and ir.direct_deliverable_project_id = ir.resolved_event_project_id
          then ir.direct_deliverable_task_id
        when ir.resolved_entity_type = 'link_report'
          and ir.link_deliverable_id is not null
          and ir.link_deliverable_project_id = ir.resolved_event_project_id
          then ir.link_deliverable_task_id
        else null
      end as resolved_task_id,
      case
        when ir.resolved_entity_type = 'deliverable'
          and ir.direct_deliverable_id is not null
          and ir.direct_deliverable_project_id = ir.resolved_event_project_id
          then ir.direct_deliverable_id
        when ir.resolved_entity_type = 'link_report'
          and ir.link_deliverable_id is not null
          and ir.link_deliverable_project_id = ir.resolved_event_project_id
          then ir.link_deliverable_id
        else null
      end as resolved_deliverable_id,
      case
        when ir.resolved_entity_type = 'task'
          and ir.direct_task_id is not null
          and ir.direct_task_project_id = ir.resolved_event_project_id
          then ir.direct_task_title
        when ir.resolved_entity_type = 'deliverable'
          and ir.direct_deliverable_id is not null
          and ir.direct_deliverable_project_id = ir.resolved_event_project_id
          then ir.direct_deliverable_title
        when ir.resolved_entity_type = 'link_report'
          and ir.link_deliverable_id is not null
          and ir.link_deliverable_project_id = ir.resolved_event_project_id
          then ir.link_deliverable_title
        else null
      end as resolved_subject_title,
      case
        when ir.resolved_entity_type = 'task'
          and ir.direct_task_id is not null
          and ir.direct_task_project_id = ir.resolved_event_project_id
          then ir.direct_task_assignee_id
        when ir.resolved_entity_type = 'deliverable'
          and ir.direct_deliverable_id is not null
          and ir.direct_deliverable_project_id = ir.resolved_event_project_id
          then ir.direct_deliverable_assignee_id
        when ir.resolved_entity_type = 'link_report'
          and ir.link_deliverable_id is not null
          and ir.link_deliverable_project_id = ir.resolved_event_project_id
          then ir.link_deliverable_assignee_id
        else null
      end as resolved_assignee_id,
      case
        when ir.resolved_entity_type = 'task'
          and ir.direct_task_id is not null
          and ir.direct_task_project_id = ir.resolved_event_project_id
          then ir.direct_task_type
        else null
      end as resolved_task_type,
      case
        when ir.resolved_entity_type = 'deliverable'
          and ir.direct_deliverable_id is not null
          and ir.direct_deliverable_project_id = ir.resolved_event_project_id
          then ir.direct_deliverable_workflow_type
        when ir.resolved_entity_type = 'link_report'
          and ir.link_deliverable_id is not null
          and ir.link_deliverable_project_id = ir.resolved_event_project_id
          then ir.link_deliverable_workflow_type
        else null
      end as resolved_deliverable_workflow_type,
      case
        when ir.resolved_entity_type = 'deliverable'
          and ir.direct_deliverable_id is not null
          and ir.direct_deliverable_project_id = ir.resolved_event_project_id
          then ir.direct_deliverable_status
        when ir.resolved_entity_type = 'link_report'
          and ir.link_deliverable_id is not null
          and ir.link_deliverable_project_id = ir.resolved_event_project_id
          then ir.link_deliverable_status
        else null
      end as resolved_deliverable_status,
      case
        when ir.resolved_entity_type = 'task'
          and ir.direct_task_id is not null
          and ir.direct_task_project_id = ir.resolved_event_project_id
          then ir.direct_task_deadline_at
        else null
      end as resolved_task_deadline_at
    from inbox_rows ir
  ), authorized_context as (
    select
      rt.*,
      project_row.name as resolved_project_name,
      project_row.project_type as resolved_project_type,
      case
        when rt.resolved_project_id is null
          or project_row.id is null then false
        when v_role = 'admin' then true
        when v_role = 'pm' then exists (
          select 1
          from public.project_members pm
          where pm.project_id = rt.resolved_project_id
            and pm.user_id = v_user_id
            and pm.member_type in ('pm_lead', 'pm_watcher')
            and pm.deleted_at is null
        )
        when v_role = 'operator' then rt.resolved_assignee_id = v_user_id
        when v_role = 'client' then exists (
          select 1
          from public.project_members cm
          where cm.project_id = rt.resolved_project_id
            and cm.user_id = v_user_id
            and cm.member_type = 'client'
            and cm.deleted_at is null
        )
        else false
      end as may_view_context
    from resolved_targets rt
    left join public.projects project_row
      on project_row.id = rt.resolved_project_id
      and project_row.deleted_at is null
  ), projected as (
    select
      ac.*,
      case
        when ac.may_view_context and ac.resolved_deliverable_id is not null
          then 'deliverable'
        when ac.may_view_context and ac.resolved_task_id is not null
          then 'task'
        when ac.may_view_context and ac.resolved_project_id is not null
          then 'project'
        when ac.resolved_trigger in ('user_invited', 'invite_expiring')
          then 'invitation'
        else 'system'
      end as safe_subject_kind,
      case
        when ac.may_view_context and ac.resolved_subject_title is not null
          then ac.resolved_subject_title
        when ac.may_view_context and ac.resolved_project_id is not null
          then ac.resolved_project_name
        else null
      end as safe_subject_title,
      case
        when ac.may_view_context then ac.resolved_project_name
        else null
      end as safe_project_name,
      case
        when ac.may_view_context
          and ac.resolved_trigger in (
            'deadline_24h',
            'deadline_12h',
            'deadline_6h',
            'deadline_overdue'
          )
          and ac.resolved_task_deadline_at is not null
          then 'task_deadline'
        else 'none'
      end as safe_context_kind,
      case
        when ac.may_view_context
          and ac.resolved_trigger in (
            'deadline_24h',
            'deadline_12h',
            'deadline_6h',
            'deadline_overdue'
          )
          and ac.resolved_task_deadline_at is not null
          then ac.resolved_task_deadline_at::text
        else null
      end as safe_context_value
    from authorized_context ac
  )
  select
    projected.resolved_recipient_id as recipient_id,
    projected.resolved_trigger as trigger,
    projected.resolved_created_at as created_at,
    projected.resolved_occurred_at as occurred_at,
    projected.resolved_read_at as read_at,
    projected.safe_subject_kind as subject_kind,
    projected.safe_subject_title as subject_title,
    projected.safe_project_name as project_name,
    projected.safe_context_kind as context_kind,
    projected.safe_context_value as context_value,
    case
      when not projected.may_view_context then 'none'
      when v_role = 'admin' and projected.resolved_deliverable_id is not null
        then 'admin_project_deliverables'
      when v_role = 'admin' and projected.resolved_task_id is not null
        then 'admin_project_tasks'
      when v_role = 'admin' and projected.resolved_project_id is not null
        then 'admin_project_overview'
      when v_role = 'pm' and projected.resolved_deliverable_id is not null
        then 'pm_project_deliverables'
      when v_role = 'pm' and projected.resolved_task_id is not null
        then 'pm_project_tasks'
      when v_role = 'pm' and projected.resolved_project_id is not null
        then 'pm_project_overview'
      when v_role = 'operator'
        and projected.resolved_task_id is not null
        and projected.resolved_assignee_id = v_user_id
        then 'operator_task'
      when v_role = 'client'
        and projected.resolved_task_id is not null
        and projected.resolved_task_type = 'client_request'
        and projected.resolved_assignee_id = v_user_id
        then 'client_task'
      when v_role = 'client'
        and projected.resolved_deliverable_id is not null
        and projected.resolved_deliverable_workflow_type = 'production'
        and projected.resolved_deliverable_status in (
          'awaiting_client_review',
          'approved',
          'delivered',
          'changes_requested'
        )
        and projected.resolved_project_type = 'client'
        then 'client_deliverable_review'
      when v_role = 'client'
        and projected.resolved_project_id is not null
        and projected.resolved_project_type = 'client'
        and projected.resolved_deliverable_id is null
        and not (
          projected.resolved_task_id is not null
          and projected.resolved_task_type = 'client_request'
          and projected.resolved_assignee_id = v_user_id
        )
        then 'client_project'
      else 'none'
    end as navigation_kind,
    case
      when projected.may_view_context
        and v_role in ('admin', 'pm')
        and projected.resolved_project_id is not null
        then projected.resolved_project_id
      when projected.may_view_context
        and v_role = 'client'
        and projected.resolved_project_type = 'client'
        and projected.resolved_deliverable_id is null
        and not (
          projected.resolved_task_id is not null
          and projected.resolved_task_type = 'client_request'
          and projected.resolved_assignee_id = v_user_id
        )
        and projected.resolved_project_id is not null
        then projected.resolved_project_id
      else null
    end as navigation_project_id,
    case
      when projected.may_view_context
        and (
          (v_role = 'operator' and projected.resolved_assignee_id = v_user_id)
          or (
            v_role = 'client'
            and projected.resolved_task_type = 'client_request'
            and projected.resolved_assignee_id = v_user_id
          )
        )
        and projected.resolved_task_id is not null
        then projected.resolved_task_id
      else null
    end as navigation_task_id,
    case
      when projected.may_view_context
        and v_role = 'client'
        and projected.resolved_deliverable_id is not null
        and projected.resolved_deliverable_workflow_type = 'production'
        and projected.resolved_deliverable_status in (
          'awaiting_client_review',
          'approved',
          'delivered',
          'changes_requested'
        )
        and projected.resolved_project_type = 'client'
        then projected.resolved_deliverable_id
      else null
    end as navigation_deliverable_id
  from projected
  order by projected.resolved_created_at desc, projected.resolved_recipient_id desc;
end;
$function$;

alter function public.list_my_in_app_notifications(
  integer,
  timestamptz,
  timestamptz,
  boolean,
  timestamptz,
  uuid
) owner to postgres;

revoke all on function public.list_my_in_app_notifications(
  integer,
  timestamptz,
  timestamptz,
  boolean,
  timestamptz,
  uuid
) from public;

revoke all on function public.list_my_in_app_notifications(
  integer,
  timestamptz,
  timestamptz,
  boolean,
  timestamptz,
  uuid
) from anon;

grant execute on function public.list_my_in_app_notifications(
  integer,
  timestamptz,
  timestamptz,
  boolean,
  timestamptz,
  uuid
) to authenticated;

-- Dedicated acknowledgement command for unread notification detail navigation.
-- It accepts only a recipient ID; destination selection remains read-only and
-- database-derived by the inbox projection, never browser supplied.
create function public.acknowledge_notification_and_navigate(
  p_notification_recipient_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
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

  update public.notification_recipients nr
  set read_at = now(),
      delivery_status = 'read',
      updated_at = now()
  where nr.id = p_notification_recipient_id
    and nr.user_id = v_user_id
    and nr.channel = 'in_app'
    and nr.read_at is null;

  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$function$;

alter function public.acknowledge_notification_and_navigate(uuid)
  owner to postgres;

revoke all on function public.acknowledge_notification_and_navigate(uuid)
  from public;

revoke all on function public.acknowledge_notification_and_navigate(uuid)
  from anon;

grant execute on function public.acknowledge_notification_and_navigate(uuid)
  to authenticated;

commit;
