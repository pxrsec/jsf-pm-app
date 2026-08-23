-- Sprint 06 / Epic 08 capability track.
-- ADR-024: external provider activation remains disabled; eligible external
-- recipients are terminally suppressed and are never dispatched or replayed.
--
-- `ALTER TYPE ... ADD VALUE` must be committed before the new enum value can
-- be referenced by constraints or function bodies. Keep this statement outside
-- the transaction below.
alter type public.notification_delivery_status add value if not exists 'suppressed';

begin;

-- -----------------------------------------------------------------------------
-- 1. Terminal suppression state
-- -----------------------------------------------------------------------------

alter table public.notification_recipients
  add column suppression_reason text,
  add column suppressed_at timestamptz;

alter table public.notification_recipients
  add constraint notification_recipients_suppression_state_ck check (
    (
      delivery_status = 'suppressed'
      and suppression_reason = 'provider_disabled'
      and suppressed_at is not null
      and attempt_count = 0
      and next_attempt_at is null
      and claimed_at is null
      and claim_token is null
      and provider_message_id is null
      and provider_error_code is null
      and provider_error_message is null
      and sent_at is null
      and delivered_at is null
      and read_at is null
      and failed_at is null
    )
    or
    (
      delivery_status <> 'suppressed'
      and suppression_reason is null
      and suppressed_at is null
    )
  ),
  add constraint notification_recipients_suppressed_channel_ck check (
    delivery_status <> 'suppressed'
    or channel in ('email', 'whatsapp')
  );

create index notification_recipients_suppressed_queue_idx
  on public.notification_recipients (suppressed_at desc, created_at desc)
  where channel in ('email', 'whatsapp') and delivery_status = 'suppressed';

-- -----------------------------------------------------------------------------
-- 2. Transactional disabled-provider fan-out
-- -----------------------------------------------------------------------------

-- Only mapped, active, metadata-approved templates make a WhatsApp recipient
-- eligible. S06 does not invent templates for triggers that lack one.
create or replace function private.notification_whatsapp_template_for_trigger(
  p_trigger public.notification_trigger
)
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select wt.id
  from public.whatsapp_templates wt
  where wt.logical_name = case p_trigger
    when 'deliverable_submitted' then 'new_deliverable_review'
    when 'internal_review_approved' then 'new_deliverable_review'
    when 'internal_changes_requested' then 'changes_requested_alert'
    when 'client_changes_requested' then 'changes_requested_alert'
    when 'deliverable_delivered' then 'final_delivery_confirmation'
    else null
  end
    and wt.status = 'approved'
    and wt.is_active = true
    and wt.deleted_at is null
  order by wt.version desc
  limit 1;
$$;

-- This trigger consumes the already-authoritative in-app fan-out. It therefore
-- preserves each lifecycle command's recipient selection and deduplication.
-- It adds an external row only when that same recipient meets the applicable
-- channel eligibility rules, then writes the terminal disabled-provider state.
create or replace function private.fan_out_disabled_external_notifications()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_event record;
  v_profile record;
  v_project_notifications_enabled boolean;
  v_whatsapp_template_id uuid;
begin
  if new.channel <> 'in_app' then
    return new;
  end if;

  select e.id, e.trigger, e.project_id
  into v_event
  from public.notification_events e
  where e.id = new.event_id;

  if not found then
    raise exception 'Notification event % was not found', new.event_id;
  end if;

  select p.id,
         p.is_active,
         p.deleted_at,
         p.email_notifications_enabled,
         p.whatsapp_opt_in,
         p.whatsapp_consent_at,
         p.phone_e164
  into v_profile
  from public.profiles p
  where p.id = new.user_id;

  if not found or not v_profile.is_active or v_profile.deleted_at is not null then
    return new;
  end if;

  -- Project-scoped delivery requires an active opted-in project membership.
  -- Non-project events retain the existing authoritative in-app recipient set.
  if v_event.project_id is null then
    v_project_notifications_enabled := true;
  else
    select exists (
      select 1
      from public.project_members pm
      where pm.project_id = v_event.project_id
        and pm.user_id = new.user_id
        and pm.deleted_at is null
        and pm.receives_notifications = true
    ) into v_project_notifications_enabled;
  end if;

  if not v_project_notifications_enabled then
    return new;
  end if;

  if v_profile.email_notifications_enabled then
    insert into public.notification_recipients (
      event_id,
      user_id,
      channel,
      delivery_status,
      suppression_reason,
      suppressed_at,
      next_attempt_at
    ) values (
      new.event_id,
      new.user_id,
      'email',
      'suppressed',
      'provider_disabled',
      now(),
      null
    )
    on conflict (event_id, user_id, channel) do nothing;
  end if;

  if v_profile.whatsapp_opt_in
     and v_profile.whatsapp_consent_at is not null
     and v_profile.phone_e164 is not null then
    v_whatsapp_template_id := private.notification_whatsapp_template_for_trigger(v_event.trigger);

    if v_whatsapp_template_id is not null then
      insert into public.notification_recipients (
        event_id,
        user_id,
        channel,
        template_id,
        delivery_status,
        suppression_reason,
        suppressed_at,
        next_attempt_at
      ) values (
        new.event_id,
        new.user_id,
        'whatsapp',
        v_whatsapp_template_id,
        'suppressed',
        'provider_disabled',
        now(),
        null
      )
      on conflict (event_id, user_id, channel) do nothing;
    end if;
  end if;

  return new;
end;
$$;

create trigger fan_out_disabled_external_notifications
  after insert on public.notification_recipients
  for each row
  when (new.channel = 'in_app')
  execute function private.fan_out_disabled_external_notifications();

-- -----------------------------------------------------------------------------
-- 3. Preserve terminality in existing read/claim/receipt boundaries
-- -----------------------------------------------------------------------------

-- A browser recipient may mark only their own in-app row read. External rows
-- are not receipt records in S06 and cannot be advanced from the browser.
create or replace function public.mark_notification_read(
  p_notification_recipient_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_count integer;
begin
  update public.notification_recipients
  set read_at = now(),
      delivery_status = 'read',
      updated_at = now()
  where id = p_notification_recipient_id
    and user_id = (select auth.uid())
    and channel = 'in_app'
    and read_at is null;

  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

-- A later provider callback must never promote a record that S06 intentionally
-- did not send. Existing monotonic receipt behavior remains unchanged otherwise.
create or replace function private.record_provider_receipt(
  p_provider_message_id text,
  p_status public.notification_delivery_status,
  p_error_code text default null,
  p_error_message text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_rec record;
begin
  select * into v_rec
  from public.notification_recipients
  where provider_message_id = p_provider_message_id
  for update;

  if not found or v_rec.delivery_status = 'suppressed' then
    return false;
  end if;

  if v_rec.delivery_status = 'read' and p_status in ('sent', 'delivered') then
    return true;
  end if;

  update public.notification_recipients
  set delivery_status = p_status,
      delivered_at = case when p_status = 'delivered' and delivered_at is null then now() else delivered_at end,
      read_at = case when p_status = 'read' and read_at is null then now() else read_at end,
      failed_at = case when p_status = 'failed' and failed_at is null then now() else failed_at end,
      provider_error_code = coalesce(p_error_code, provider_error_code),
      provider_error_message = coalesce(p_error_message, provider_error_message),
      updated_at = now()
  where id = v_rec.id;

  return true;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Role-safe notification read surfaces
-- -----------------------------------------------------------------------------

-- Ordinary recipients must not select their external rows directly. Their
-- in-app feed below is the sole supported application read representation.
drop policy notification_recipients_select_policy on public.notification_recipients;

create policy notification_recipients_select_policy on public.notification_recipients
for select to authenticated
using (
  (channel = 'in_app' and user_id = (select auth.uid()))
  or (select private.is_admin())
);

create or replace function public.list_my_in_app_notifications(
  p_limit integer default 50,
  p_before timestamptz default null
)
returns table (
  recipient_id uuid,
  event_id uuid,
  trigger public.notification_trigger,
  entity_type public.entity_type,
  entity_id uuid,
  project_id uuid,
  occurred_at timestamptz,
  created_at timestamptz,
  read_at timestamptz,
  delivery_status public.notification_delivery_status
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  return query
  select nr.id,
         e.id,
         e.trigger,
         e.entity_type,
         e.entity_id,
         e.project_id,
         e.occurred_at,
         nr.created_at,
         nr.read_at,
         nr.delivery_status
  from public.notification_recipients nr
  join public.notification_events e on e.id = nr.event_id
  where nr.user_id = v_user_id
    and nr.channel = 'in_app'
    and (p_before is null or nr.created_at < p_before)
  order by nr.created_at desc, nr.id desc
  limit v_limit;
end;
$$;

-- The operational queue intentionally aggregates recipients. It exposes no
-- contact values, raw event payload, provider payload, or configuration detail.
create or replace function public.list_suppressed_notification_operations(
  p_limit integer default 50,
  p_before timestamptz default null
)
returns table (
  event_id uuid,
  trigger public.notification_trigger,
  project_id uuid,
  project_name text,
  channel public.notification_channel,
  delivery_status public.notification_delivery_status,
  suppression_reason text,
  recipient_count bigint,
  first_created_at timestamptz,
  last_suppressed_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_admin boolean := (select private.is_admin());
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  return query
  select e.id,
         e.trigger,
         e.project_id,
         p.name,
         nr.channel,
         nr.delivery_status,
         nr.suppression_reason,
         count(*)::bigint,
         min(nr.created_at),
         max(nr.suppressed_at)
  from public.notification_recipients nr
  join public.notification_events e on e.id = nr.event_id
  left join public.projects p on p.id = e.project_id
  where nr.delivery_status = 'suppressed'
    and nr.channel in ('email', 'whatsapp')
    and (p_before is null or nr.suppressed_at < p_before)
    and (
      v_is_admin
      or (
        e.project_id is not null
        and exists (
          select 1
          from public.project_members pm
          join public.profiles profile on profile.id = pm.user_id
          where pm.project_id = e.project_id
            and pm.user_id = v_user_id
            and pm.member_type = 'pm_lead'
            and pm.deleted_at is null
            and profile.role = 'pm'
            and profile.is_active = true
            and profile.deleted_at is null
        )
      )
    )
  group by e.id,
           e.trigger,
           e.project_id,
           p.name,
           nr.channel,
           nr.delivery_status,
           nr.suppression_reason
  order by max(nr.suppressed_at) desc, e.id desc
  limit v_limit;
end;
$$;

revoke all on function public.list_my_in_app_notifications(integer, timestamptz) from public;
revoke all on function public.list_suppressed_notification_operations(integer, timestamptz) from public;
grant execute on function public.list_my_in_app_notifications(integer, timestamptz) to authenticated;
grant execute on function public.list_suppressed_notification_operations(integer, timestamptz) to authenticated;

commit;
