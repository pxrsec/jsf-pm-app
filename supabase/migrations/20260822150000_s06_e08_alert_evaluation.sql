-- Sprint 06 / Epic 08 final required schema boundary.
-- ADR-024 capability track: authoritative reminder evaluation for the manual
-- development demonstration path and future signed scheduler consumption.
-- This migration performs no provider dispatch, webhook work, schedule creation,
-- or external HTTP activity.

begin;

-- -----------------------------------------------------------------------------
-- 1. Shared internal evaluator
-- -----------------------------------------------------------------------------
-- The evaluator is intentionally database-authoritative: it reads persisted
-- deadlines/lifecycle/audit facts, writes immutable notification events, and
-- relies on the applied in-app fan-out trigger for eligible disabled external
-- suppression. It never accepts browser-selected time, recipients, channels,
-- trigger names, or delivery state.

create or replace function private.evaluate_notification_alerts(
  p_project_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := now();
  v_task record;
  v_review record;
  v_trigger public.notification_trigger;
  v_deduplication_key text;
  v_event_id uuid;
  v_recipient_id uuid;
  v_reminder_number integer;
  v_events_created integer := 0;
  v_in_app_recipients integer := 0;
  v_suppressed_external integer := 0;
  v_tasks_evaluated integer := 0;
  v_reviews_evaluated integer := 0;
  v_before_external_count integer;
  v_after_external_count integer;
  v_rows integer;
begin
  -- Deadline reminders: one event per accepted threshold and deadline value.
  -- Windows are disjoint so a single evaluation cannot create 24h/12h/6h for
  -- the same target simultaneously. The overdue event is emitted once.
  for v_task in
    select t.id,
           t.project_id,
           t.assignee_id,
           t.title,
           t.deadline_at
    from public.tasks t
    join public.projects p on p.id = t.project_id
    join public.profiles assignee on assignee.id = t.assignee_id
    join public.project_members pm
      on pm.project_id = t.project_id
      and pm.user_id = t.assignee_id
      and pm.deleted_at is null
      and pm.receives_notifications = true
    where t.deleted_at is null
      and t.status <> 'completed'
      and p.deleted_at is null
      and p.archived_at is null
      and p.status not in ('completed', 'cancelled')
      and assignee.is_active = true
      and assignee.deleted_at is null
      and (p_project_id is null or t.project_id = p_project_id)
  loop
    v_tasks_evaluated := v_tasks_evaluated + 1;

    v_trigger := case
      when v_task.deadline_at > v_now + interval '12 hours'
       and v_task.deadline_at <= v_now + interval '24 hours' then 'deadline_24h'
      when v_task.deadline_at > v_now + interval '6 hours'
       and v_task.deadline_at <= v_now + interval '12 hours' then 'deadline_12h'
      when v_task.deadline_at > v_now
       and v_task.deadline_at <= v_now + interval '6 hours' then 'deadline_6h'
      when v_task.deadline_at <= v_now then 'deadline_overdue'
      else null
    end;

    if v_trigger is null then
      continue;
    end if;

    v_deduplication_key := v_trigger::text
      || ':task:' || v_task.id
      || ':deadline:' || extract(epoch from v_task.deadline_at)::bigint;

    select count(*)
    into v_before_external_count
    from public.notification_recipients nr
    where nr.event_id in (
      select e.id
      from public.notification_events e
      where e.deduplication_key = v_deduplication_key
    )
      and nr.channel in ('email', 'whatsapp')
      and nr.delivery_status = 'suppressed';

    insert into public.notification_events (
      trigger,
      entity_type,
      entity_id,
      project_id,
      actor_id,
      payload,
      deduplication_key
    ) values (
      v_trigger,
      'task',
      v_task.id,
      v_task.project_id,
      null,
      jsonb_build_object(
        'task_title', v_task.title,
        'deadline_at', v_task.deadline_at
      ),
      v_deduplication_key
    )
    on conflict (deduplication_key) do nothing
    returning id into v_event_id;

    if v_event_id is null then
      continue;
    end if;

    insert into public.notification_recipients (
      event_id,
      user_id,
      channel,
      delivery_status
    ) values (
      v_event_id,
      v_task.assignee_id,
      'in_app',
      'pending'
    )
    on conflict (event_id, user_id, channel) do nothing;

    get diagnostics v_rows = row_count;
    v_in_app_recipients := v_in_app_recipients + v_rows;

    select count(*)
    into v_after_external_count
    from public.notification_recipients nr
    where nr.event_id = v_event_id
      and nr.channel in ('email', 'whatsapp')
      and nr.delivery_status = 'suppressed';

    v_suppressed_external := v_suppressed_external
      + greatest(v_after_external_count - v_before_external_count, 0);
    v_events_created := v_events_created + 1;
  end loop;

  -- Review-inactivity reminders apply only to production deliverables. Client
  -- submissions intentionally never enter review-inactivity handling.
  for v_review in
    select d.id,
           d.project_id,
           d.title,
           d.status,
           d.current_version_number,
           d.internal_review_deadline_at,
           d.client_delivery_deadline_at,
           review_started.created_at as review_started_at,
           case
             when d.status = 'awaiting_internal_review' then 'internal'
             when d.status = 'awaiting_client_review' then 'client'
           end as review_stage,
           case
             when d.status = 'awaiting_internal_review' then interval '3 hours'
             when d.status = 'awaiting_client_review' then interval '2 hours'
           end as reminder_interval
    from public.deliverables d
    join public.projects p on p.id = d.project_id
    join lateral (
      select a.created_at
      from public.audit_logs a
      where a.entity_type = 'deliverable'
        and a.entity_id = d.id
        and a.new_status = d.status::text
      order by a.created_at desc, a.id desc
      limit 1
    ) review_started on true
    where d.deleted_at is null
      and d.workflow_type = 'production'
      and d.status in ('awaiting_internal_review', 'awaiting_client_review')
      and d.is_stalled = false
      and p.deleted_at is null
      and p.archived_at is null
      and p.status not in ('completed', 'cancelled')
      and (p_project_id is null or d.project_id = p_project_id)
  loop
    v_reviews_evaluated := v_reviews_evaluated + 1;
    v_reminder_number := floor(
      extract(epoch from (v_now - v_review.review_started_at))
      / extract(epoch from v_review.reminder_interval)
    )::integer;

    if v_reminder_number < 1 then
      continue;
    end if;

    -- Five reminders are the hard cap. The next eligible evaluation makes the
    -- production deliverable visibly stalled and emits no sixth reminder.
    if v_reminder_number > 5 then
      update public.deliverables
      set is_stalled = true,
          stalled_at = coalesce(stalled_at, v_now),
          last_activity_at = v_now,
          updated_at = v_now
      where id = v_review.id
        and is_stalled = false;
      continue;
    end if;

    v_deduplication_key := 'review_inactivity_reminder:deliverable:'
      || v_review.id
      || ':stage:' || v_review.review_stage
      || ':version:' || v_review.current_version_number
      || ':started:' || extract(epoch from v_review.review_started_at)::bigint
      || ':reminder:' || v_reminder_number;

    insert into public.notification_events (
      trigger,
      entity_type,
      entity_id,
      project_id,
      actor_id,
      payload,
      deduplication_key
    ) values (
      'review_inactivity_reminder',
      'deliverable',
      v_review.id,
      v_review.project_id,
      null,
      jsonb_build_object(
        'deliverable_title', v_review.title,
        'review_stage', v_review.review_stage,
        'reminder_number', v_reminder_number,
        'internal_review_deadline_at', v_review.internal_review_deadline_at,
        'client_delivery_deadline_at', v_review.client_delivery_deadline_at
      ),
      v_deduplication_key
    )
    on conflict (deduplication_key) do nothing
    returning id into v_event_id;

    if v_event_id is null then
      continue;
    end if;

    if v_review.review_stage = 'internal' then
      for v_recipient_id in
        select pm.user_id
        from public.project_members pm
        join public.profiles profile on profile.id = pm.user_id
        where pm.project_id = v_review.project_id
          and pm.member_type in ('pm_lead', 'pm_watcher')
          and pm.receives_notifications = true
          and pm.deleted_at is null
          and profile.is_active = true
          and profile.deleted_at is null
      loop
        insert into public.notification_recipients (
          event_id,
          user_id,
          channel,
          delivery_status
        ) values (
          v_event_id,
          v_recipient_id,
          'in_app',
          'pending'
        )
        on conflict (event_id, user_id, channel) do nothing;

        get diagnostics v_rows = row_count;
        v_in_app_recipients := v_in_app_recipients + v_rows;
      end loop;
    else
      for v_recipient_id in
        select pm.user_id
        from public.project_members pm
        join public.profiles profile on profile.id = pm.user_id
        where pm.project_id = v_review.project_id
          and pm.member_type = 'client'
          and pm.receives_notifications = true
          and pm.deleted_at is null
          and profile.is_active = true
          and profile.deleted_at is null
      loop
        insert into public.notification_recipients (
          event_id,
          user_id,
          channel,
          delivery_status
        ) values (
          v_event_id,
          v_recipient_id,
          'in_app',
          'pending'
        )
        on conflict (event_id, user_id, channel) do nothing;

        get diagnostics v_rows = row_count;
        v_in_app_recipients := v_in_app_recipients + v_rows;
      end loop;
    end if;

    select count(*)
    into v_after_external_count
    from public.notification_recipients nr
    where nr.event_id = v_event_id
      and nr.channel in ('email', 'whatsapp')
      and nr.delivery_status = 'suppressed';

    v_suppressed_external := v_suppressed_external + v_after_external_count;
    v_events_created := v_events_created + 1;
  end loop;

  return jsonb_build_object(
    'tasks_evaluated', v_tasks_evaluated,
    'reviews_evaluated', v_reviews_evaluated,
    'events_created', v_events_created,
    'in_app_recipients_created', v_in_app_recipients,
    'external_suppressions_created', v_suppressed_external
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Authorized public command
-- -----------------------------------------------------------------------------
-- A manual caller is either Admin (global or project-scoped) or an active PM
-- Lead for the explicitly selected project. A future signed scheduler may call
-- the exact same internal evaluator through an authenticated service-role
-- boundary; no unauthenticated or browser-selected bypass exists.

create or replace function public.evaluate_notification_alerts(
  p_project_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_service_role boolean := auth.role() = 'service_role';
begin
  if v_is_service_role then
    return private.evaluate_notification_alerts(p_project_id);
  end if;

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if (select private.is_admin()) then
    return private.evaluate_notification_alerts(p_project_id);
  end if;

  if p_project_id is null then
    raise exception 'PM Lead evaluation requires an explicit project';
  end if;

  if not (select private.is_project_lead(p_project_id)) then
    raise exception 'Only an active PM Lead or Admin can evaluate project alerts';
  end if;

  return private.evaluate_notification_alerts(p_project_id);
end;
$$;

revoke all on function public.evaluate_notification_alerts(uuid) from public;
grant execute on function public.evaluate_notification_alerts(uuid) to authenticated;
grant execute on function public.evaluate_notification_alerts(uuid) to service_role;

commit;
