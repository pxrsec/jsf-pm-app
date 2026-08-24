-- S07 E09 M4: bounded, self-only notification history window and filters.
--
-- Replaces the S06 three-argument inbox RPC with a purpose-limited read contract
-- that owns the default 90-day visibility window, explicit bounded historical
-- ranges, optional read-state filtering, and the existing composite keyset order.
--
-- Scope is intentionally limited to the authenticated recipient's in-app history.
-- It does not change notification generation, delivery/suppression semantics,
-- operations-queue authorization, recipient mutations, RLS policies, provider
-- activity, scheduler behavior, or external delivery configuration.

begin;

-- PostgreSQL cannot change a function's argument list or TABLE return shape via
-- CREATE OR REPLACE. Remove only the superseded S06 self-inbox overload.
drop function public.list_my_in_app_notifications(integer, timestamptz, uuid);

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
  read_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role public.app_role := (select private.current_user_role());
  v_from timestamptz;
  v_to timestamptz;
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
begin
  -- current_user_role() is null when the authenticated user has no active,
  -- non-deleted application profile. Do not make Auth-session existence alone
  -- sufficient for this private history surface.
  if v_user_id is null or v_role is null then
    raise exception 'Authentication with an active profile is required';
  end if;

  -- Omitted range means the visible inbox is exactly the latest 90 days.
  -- An older-history view must pass a complete explicit bounded range.
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

  -- Keyset continuations are valid only as a complete pair. The cursor remains
  -- tied to the same server-validated range/read-state query by the application
  -- contract; it never substitutes for recipient authorization.
  if (p_before_created_at is null) <> (p_before_recipient_id is null) then
    raise exception 'Notification history cursor is incomplete';
  end if;

  return query
  select
    nr.id as recipient_id,
    ne.trigger,
    nr.created_at,
    ne.occurred_at,
    nr.read_at
  from public.notification_recipients nr
  join public.notification_events ne
    on ne.id = nr.event_id
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
  limit v_limit;
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

-- Supports the exact self-owned channel/range/keyset history query, including
-- the all/read states not covered by the existing unread-only partial index.
-- The prior unread index remains useful and is intentionally preserved.
create index if not exists notification_recipients_in_app_history_keyset_idx
  on public.notification_recipients (user_id, created_at desc, id desc)
  where channel = 'in_app';

commit;
