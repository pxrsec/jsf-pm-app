-- supabase/migrations/20260823140000_s07_e09_calendar-role-safe-feed-and-milestones.sql
-- Sprint 07 E09 M1: bounded role-safe calendar feed and audited milestone commands.
-- Candidate only; no index is included because applied query-plan evidence is required first.

begin;

-- Do not silently discard or misclassify an existing legacy hex override. A
-- deliberate data-remediation migration is required before this contract can
-- narrow the accepted stored values to design-system tokens.
do $$
begin
  if exists (
    select 1
    from public.calendar_events
    where color_override is not null
      and color_override not in ('chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5')
  ) then
    raise exception using
      message = 'calendar_events contains legacy color_override values outside the S07 token contract',
      hint = 'Remediate or explicitly null the legacy values in a separately reviewed forward migration before applying M1.';
  end if;
end;
$$;

alter table public.calendar_events
  drop constraint calendar_events_color_override_check;

alter table public.calendar_events
  add constraint calendar_events_color_override_token_ck
  check (
    color_override is null
    or color_override in ('chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5')
  );

-- The authenticated calendar feed is purpose-limited and range-bounded. It
-- deliberately composes deadlines from their authoritative source tables and
-- never materializes/copies them into calendar_events.
create function public.list_role_safe_calendar_events(
  p_from timestamptz,
  p_to timestamptz,
  p_project_id uuid default null
)
returns table (
  entity_id uuid,
  project_id uuid,
  title text,
  event_type public.calendar_event_type,
  starts_at timestamptz,
  ends_at timestamptz,
  is_all_day boolean,
  color_override text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_actor_role public.app_role;
  v_is_admin boolean;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  v_actor_role := (select private.current_user_role());

  if v_actor_role is null then
    raise exception 'An active authenticated profile is required';
  end if;

  if p_from is null or p_to is null or p_from >= p_to then
    raise exception 'p_from must be earlier than p_to';
  end if;

  if p_to - p_from > interval '93 days' then
    raise exception 'Calendar range must not exceed 93 days';
  end if;

  v_is_admin := (select private.is_admin());

  return query
  with permitted_events as (
    -- Project deadlines: Admin, active PM project scope, and active client
    -- project membership. Operators do not receive project-wide deadlines.
    select
      p.id as entity_id,
      p.id as project_id,
      p.name as title,
      'project_deadline'::public.calendar_event_type as event_type,
      p.deadline_at as starts_at,
      p.deadline_at as ends_at,
      true as is_all_day,
      null::text as color_override
    from public.projects p
    where p.deleted_at is null
      and (p_project_id is null or p.id = p_project_id)
      and (
        v_is_admin
        or (
          v_actor_role = 'pm'
          and (select private.is_project_pm(p.id))
        )
        or (
          v_actor_role = 'client'
          and (select private.is_project_client(p.id))
        )
      )

    union all

    -- Task deadlines: direct operator work, direct client_request work, and
    -- otherwise only Admin/active PM project scope.
    select
      t.id as entity_id,
      case
        when v_actor_role = 'operator' then null::uuid
        when v_actor_role = 'client'
          and not (select private.is_project_client(t.project_id)) then null::uuid
        else t.project_id
      end as project_id,
      t.title,
      'task_deadline'::public.calendar_event_type as event_type,
      t.deadline_at as starts_at,
      t.deadline_at as ends_at,
      true as is_all_day,
      null::text as color_override
    from public.tasks t
    where t.deleted_at is null
      and (p_project_id is null or t.project_id = p_project_id)
      and (
        v_is_admin
        or (
          v_actor_role = 'pm'
          and (select private.is_project_pm(t.project_id))
        )
        or (
          v_actor_role = 'operator'
          and t.assignee_id = v_user_id
        )
        or (
          v_actor_role = 'client'
          and t.task_type = 'client_request'
          and t.assignee_id = v_user_id
        )
      )

    union all

    -- Internal review dates remain internal: Admin and active PM project scope.
    select
      d.id as entity_id,
      d.project_id,
      d.title || ' (Internal Review)' as title,
      'internal_review_deadline'::public.calendar_event_type as event_type,
      d.internal_review_deadline_at as starts_at,
      d.internal_review_deadline_at as ends_at,
      true as is_all_day,
      null::text as color_override
    from public.deliverables d
    where d.deleted_at is null
      and d.workflow_type = 'production'
      and d.internal_review_deadline_at is not null
      and (p_project_id is null or d.project_id = p_project_id)
      and (
        v_is_admin
        or (
          v_actor_role = 'pm'
          and (select private.is_project_pm(d.project_id))
        )
      )

    union all

    -- Production client-delivery dates: active client project members may see
    -- the delivery context, while operators receive only their assigned work
    -- and never a project navigation identifier.
    select
      d.id as entity_id,
      case
        when v_actor_role = 'operator' then null::uuid
        else d.project_id
      end as project_id,
      d.title || ' (Client Delivery)' as title,
      'client_delivery_deadline'::public.calendar_event_type as event_type,
      d.client_delivery_deadline_at as starts_at,
      d.client_delivery_deadline_at as ends_at,
      true as is_all_day,
      null::text as color_override
    from public.deliverables d
    where d.deleted_at is null
      and d.workflow_type = 'production'
      and d.client_delivery_deadline_at is not null
      and (p_project_id is null or d.project_id = p_project_id)
      and (
        v_is_admin
        or (
          v_actor_role = 'pm'
          and (select private.is_project_pm(d.project_id))
        )
        or (
          v_actor_role = 'operator'
          and d.assignee_id = v_user_id
        )
        or (
          v_actor_role = 'client'
          and (select private.is_project_client(d.project_id))
        )
      )

    union all

    -- The existing enum has no client-submission-specific member; preserve the
    -- established calendar_feed_view classification as task_deadline.
    select
      d.id as entity_id,
      case
        when v_actor_role = 'client'
          and not (select private.is_project_client(d.project_id)) then null::uuid
        else d.project_id
      end as project_id,
      d.title || ' (Client Submission)' as title,
      'task_deadline'::public.calendar_event_type as event_type,
      d.submission_deadline_at as starts_at,
      d.submission_deadline_at as ends_at,
      true as is_all_day,
      null::text as color_override
    from public.deliverables d
    where d.deleted_at is null
      and d.workflow_type = 'client_submission'
      and d.submission_deadline_at is not null
      and (p_project_id is null or d.project_id = p_project_id)
      and (
        v_is_admin
        or (
          v_actor_role = 'pm'
          and (select private.is_project_pm(d.project_id))
        )
        or (
          v_actor_role = 'client'
          and d.assignee_id = v_user_id
        )
      )

    union all

    -- Manual milestones are intentionally excluded from Operator and Client
    -- feeds. PM Watchers receive read-only project-scoped visibility.
    select
      ce.id as entity_id,
      ce.project_id,
      ce.title,
      ce.event_type,
      ce.starts_at,
      ce.ends_at,
      ce.is_all_day,
      ce.color_override
    from public.calendar_events ce
    where ce.deleted_at is null
      and (p_project_id is null or ce.project_id = p_project_id)
      and (
        v_is_admin
        or (
          v_actor_role = 'pm'
          and (select private.is_project_pm(ce.project_id))
        )
      )
  )
  select
    pe.entity_id,
    pe.project_id,
    pe.title,
    pe.event_type,
    pe.starts_at,
    pe.ends_at,
    pe.is_all_day,
    pe.color_override
  from permitted_events pe
  where pe.starts_at < p_to
    and coalesce(pe.ends_at, pe.starts_at) >= p_from
  order by pe.starts_at asc, pe.event_type asc, pe.entity_id asc;
end;
$function$;

revoke all on function public.list_role_safe_calendar_events(timestamptz, timestamptz, uuid) from public;
revoke all on function public.list_role_safe_calendar_events(timestamptz, timestamptz, uuid) from anon;
grant execute on function public.list_role_safe_calendar_events(timestamptz, timestamptz, uuid) to authenticated;

create function public.create_calendar_milestone(
  p_project_id uuid,
  p_title text,
  p_description text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_is_all_day boolean,
  p_color_override text
)
returns table (
  entity_id uuid,
  project_id uuid,
  title text,
  event_type public.calendar_event_type,
  starts_at timestamptz,
  ends_at timestamptz,
  is_all_day boolean,
  color_override text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_actor_role public.app_role;
  v_title text := btrim(p_title);
  v_description text := nullif(btrim(p_description), '');
  v_event public.calendar_events%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  v_actor_role := (select private.current_user_role());

  if v_actor_role is null then
    raise exception 'An active authenticated profile is required';
  end if;

  if p_project_id is null
    or not (
      (select private.is_admin())
      or (select private.is_project_lead(p_project_id))
    ) then
    raise exception 'Only an active PM Lead or Admin can create a calendar milestone';
  end if;

  if char_length(v_title) not between 1 and 160 then
    raise exception 'Milestone title must contain 1 to 160 trimmed characters';
  end if;

  if v_description is not null and char_length(v_description) > 2000 then
    raise exception 'Milestone description must not exceed 2000 trimmed characters';
  end if;

  if p_starts_at is null then
    raise exception 'Milestone starts_at is required';
  end if;

  if p_ends_at is not null and p_ends_at < p_starts_at then
    raise exception 'Milestone ends_at must not precede starts_at';
  end if;

  if p_color_override is not null
    and p_color_override not in ('chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5') then
    raise exception 'Milestone color_override must be null or a supported chart token';
  end if;

  insert into public.calendar_events (
    project_id,
    event_type,
    title,
    description,
    starts_at,
    ends_at,
    is_all_day,
    color_override,
    created_by,
    updated_by
  )
  values (
    p_project_id,
    'milestone',
    v_title,
    v_description,
    p_starts_at,
    p_ends_at,
    p_is_all_day,
    p_color_override,
    v_user_id,
    v_user_id
  )
  returning * into v_event;

  insert into public.audit_logs (
    entity_type,
    entity_id,
    project_id,
    action,
    changed_fields,
    actor_id,
    actor_role
  )
  values (
    'calendar_event',
    v_event.id,
    v_event.project_id,
    'calendar_milestone_created',
    jsonb_build_object(
      'event_type', 'milestone',
      'has_description', v_event.description is not null,
      'has_ends_at', v_event.ends_at is not null,
      'is_all_day', v_event.is_all_day,
      'has_color_override', v_event.color_override is not null
    ),
    v_user_id,
    v_actor_role
  );

  return query
  select
    v_event.id,
    v_event.project_id,
    v_event.title,
    v_event.event_type,
    v_event.starts_at,
    v_event.ends_at,
    v_event.is_all_day,
    v_event.color_override;
end;
$function$;

revoke all on function public.create_calendar_milestone(uuid, text, text, timestamptz, timestamptz, boolean, text) from public;
revoke all on function public.create_calendar_milestone(uuid, text, text, timestamptz, timestamptz, boolean, text) from anon;
grant execute on function public.create_calendar_milestone(uuid, text, text, timestamptz, timestamptz, boolean, text) to authenticated;

create function public.update_calendar_milestone(
  p_event_id uuid,
  p_title text,
  p_description text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_is_all_day boolean,
  p_color_override text
)
returns table (
  entity_id uuid,
  project_id uuid,
  title text,
  event_type public.calendar_event_type,
  starts_at timestamptz,
  ends_at timestamptz,
  is_all_day boolean,
  color_override text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_actor_role public.app_role;
  v_title text := btrim(p_title);
  v_description text := nullif(btrim(p_description), '');
  v_previous public.calendar_events%rowtype;
  v_event public.calendar_events%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  v_actor_role := (select private.current_user_role());

  if v_actor_role is null then
    raise exception 'An active authenticated profile is required';
  end if;

  if char_length(v_title) not between 1 and 160 then
    raise exception 'Milestone title must contain 1 to 160 trimmed characters';
  end if;

  if v_description is not null and char_length(v_description) > 2000 then
    raise exception 'Milestone description must not exceed 2000 trimmed characters';
  end if;

  if p_starts_at is null then
    raise exception 'Milestone starts_at is required';
  end if;

  if p_ends_at is not null and p_ends_at < p_starts_at then
    raise exception 'Milestone ends_at must not precede starts_at';
  end if;

  if p_color_override is not null
    and p_color_override not in ('chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5') then
    raise exception 'Milestone color_override must be null or a supported chart token';
  end if;

  select *
  into v_previous
  from public.calendar_events
  where id = p_event_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Calendar milestone not found';
  end if;

  if v_previous.event_type <> 'milestone' then
    raise exception 'Only milestone calendar events may be updated';
  end if;

  if not (
    (select private.is_admin())
    or (select private.is_project_lead(v_previous.project_id))
  ) then
    raise exception 'Only an active PM Lead or Admin can update a calendar milestone';
  end if;

  update public.calendar_events
  set title = v_title,
      description = v_description,
      starts_at = p_starts_at,
      ends_at = p_ends_at,
      is_all_day = p_is_all_day,
      color_override = p_color_override,
      event_type = 'milestone',
      updated_by = v_user_id,
      updated_at = now()
  where id = v_previous.id
  returning * into v_event;

  insert into public.audit_logs (
    entity_type,
    entity_id,
    project_id,
    action,
    changed_fields,
    actor_id,
    actor_role
  )
  values (
    'calendar_event',
    v_event.id,
    v_event.project_id,
    'calendar_milestone_updated',
    jsonb_build_object(
      'title_changed', v_previous.title is distinct from v_event.title,
      'description_changed', v_previous.description is distinct from v_event.description,
      'schedule_changed',
        v_previous.starts_at is distinct from v_event.starts_at
        or v_previous.ends_at is distinct from v_event.ends_at,
      'is_all_day_changed', v_previous.is_all_day is distinct from v_event.is_all_day,
      'color_override_changed', v_previous.color_override is distinct from v_event.color_override
    ),
    v_user_id,
    v_actor_role
  );

  return query
  select
    v_event.id,
    v_event.project_id,
    v_event.title,
    v_event.event_type,
    v_event.starts_at,
    v_event.ends_at,
    v_event.is_all_day,
    v_event.color_override;
end;
$function$;

revoke all on function public.update_calendar_milestone(uuid, text, text, timestamptz, timestamptz, boolean, text) from public;
revoke all on function public.update_calendar_milestone(uuid, text, text, timestamptz, timestamptz, boolean, text) from anon;
grant execute on function public.update_calendar_milestone(uuid, text, text, timestamptz, timestamptz, boolean, text) to authenticated;

create function public.soft_delete_calendar_milestone(p_event_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_actor_role public.app_role;
  v_event public.calendar_events%rowtype;
  v_row_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  v_actor_role := (select private.current_user_role());

  if v_actor_role is null then
    raise exception 'An active authenticated profile is required';
  end if;

  select *
  into v_event
  from public.calendar_events
  where id = p_event_id
    and deleted_at is null
  for update;

  if not found then
    return false;
  end if;

  if v_event.event_type <> 'milestone' then
    raise exception 'Only milestone calendar events may be deleted';
  end if;

  if not (
    (select private.is_admin())
    or (select private.is_project_lead(v_event.project_id))
  ) then
    raise exception 'Only an active PM Lead or Admin can delete a calendar milestone';
  end if;

  update public.calendar_events
  set deleted_at = now(),
      updated_by = v_user_id,
      updated_at = now()
  where id = v_event.id
    and deleted_at is null;

  get diagnostics v_row_count = row_count;

  if v_row_count = 0 then
    return false;
  end if;

  insert into public.audit_logs (
    entity_type,
    entity_id,
    project_id,
    action,
    changed_fields,
    actor_id,
    actor_role
  )
  values (
    'calendar_event',
    v_event.id,
    v_event.project_id,
    'calendar_milestone_soft_deleted',
    jsonb_build_object('event_type', 'milestone'),
    v_user_id,
    v_actor_role
  );

  return true;
end;
$function$;

revoke all on function public.soft_delete_calendar_milestone(uuid) from public;
revoke all on function public.soft_delete_calendar_milestone(uuid) from anon;
grant execute on function public.soft_delete_calendar_milestone(uuid) to authenticated;

-- The new command boundary is the only authenticated mutation surface. Keep
-- SELECT unchanged for existing controlled operational read paths; postgres and
-- service_role retain their pre-existing table privileges.
revoke insert, update, delete on table public.calendar_events from authenticated;

drop policy calendar_events_insert_policy on public.calendar_events;
drop policy calendar_events_update_policy on public.calendar_events;

commit;
