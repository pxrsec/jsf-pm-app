-- Sprint 06 / Epic 08 / S06-03 recipient inbox history.
--
-- Replace the timestamp-only notification-feed cursor with a complete keyset
-- cursor matching the established deterministic order:
--   notification_recipients.created_at DESC, notification_recipients.id DESC.
--
-- A timestamp-only continuation can skip unread rows sharing a page boundary
-- timestamp. The composite continuation below is lossless and duplicate-free
-- when callers pass the final row's (created_at, recipient_id) pair unchanged.

begin;

-- PostgreSQL cannot change a function's argument list with CREATE OR REPLACE.
-- Remove only the superseded two-argument public RPC; no other notification
-- read, mutation, RLS, grant, or provider-suppression boundary is changed.
drop function public.list_my_in_app_notifications(integer, timestamptz);

create function public.list_my_in_app_notifications(
  p_limit integer default 50,
  p_before_created_at timestamptz default null,
  p_before_recipient_id uuid default null
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

  -- A keyset continuation is valid only as a complete pair. Reject a partial
  -- browser/server input rather than silently widening, narrowing, or corrupting
  -- the recipient-owned history sequence.
  if (p_before_created_at is null) <> (p_before_recipient_id is null) then
    raise exception 'Notification cursor is incomplete';
  end if;

  return query
  select
    nr.id,
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
    and (
      p_before_created_at is null
      or nr.created_at < p_before_created_at
      or (
        nr.created_at = p_before_created_at
        and nr.id < p_before_recipient_id
      )
    )
  order by nr.created_at desc, nr.id desc
  limit v_limit;
end;
$$;

revoke all on function public.list_my_in_app_notifications(integer, timestamptz, uuid) from public;
grant execute on function public.list_my_in_app_notifications(integer, timestamptz, uuid) to authenticated;

commit;
