-- Sprint 06 / Epic 08 capability track.
-- Lossless keyset pagination for the safe aggregated suppressed-delivery queue.
--
-- The prior queue function ordered aggregates by (last_suppressed_at DESC,
-- event_id DESC) while accepting only a timestamp cursor. A page boundary on a
-- shared suppression timestamp could omit later event/channel aggregates. This
-- forward migration replaces only that public RPC signature and continuation
-- predicate. It changes no notification rows, RLS policies, fan-out behavior,
-- provider behavior, evaluator behavior, or Realtime publication.

begin;

-- Remove only the superseded timestamp-only overload before introducing the
-- order-aligned composite cursor contract.
drop function if exists public.list_suppressed_notification_operations(
  integer,
  timestamptz
);

create function public.list_suppressed_notification_operations(
  p_limit integer default 50,
  p_before_suppressed_at timestamptz default null,
  p_before_event_id uuid default null,
  p_before_channel public.notification_channel default null
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

  if (
    (p_before_suppressed_at is null
      and (p_before_event_id is not null or p_before_channel is not null))
    or
    (p_before_suppressed_at is not null
      and (p_before_event_id is null or p_before_channel is null))
  ) then
    raise exception 'Suppressed notification operations cursor must be complete';
  end if;

  if p_before_channel is not null
     and p_before_channel not in ('email', 'whatsapp') then
    raise exception 'Suppressed notification operations cursor channel is invalid';
  end if;

  return query
  with authorized_operations as (
    select e.id as event_id,
           e.trigger,
           e.project_id,
           p.name as project_name,
           nr.channel,
           nr.delivery_status,
           nr.suppression_reason,
           count(*)::bigint as recipient_count,
           min(nr.created_at) as first_created_at,
           max(nr.suppressed_at) as last_suppressed_at
    from public.notification_recipients nr
    join public.notification_events e on e.id = nr.event_id
    left join public.projects p on p.id = e.project_id
    where nr.delivery_status = 'suppressed'
      and nr.channel in ('email', 'whatsapp')
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
  )
  select o.event_id,
         o.trigger,
         o.project_id,
         o.project_name,
         o.channel,
         o.delivery_status,
         o.suppression_reason,
         o.recipient_count,
         o.first_created_at,
         o.last_suppressed_at
  from authorized_operations o
  where p_before_suppressed_at is null
     or o.last_suppressed_at < p_before_suppressed_at
     or (
       o.last_suppressed_at = p_before_suppressed_at
       and o.event_id < p_before_event_id
     )
     or (
       o.last_suppressed_at = p_before_suppressed_at
       and o.event_id = p_before_event_id
       and o.channel < p_before_channel
     )
  order by o.last_suppressed_at desc, o.event_id desc, o.channel desc
  limit v_limit;
end;
$$;

revoke all on function public.list_suppressed_notification_operations(
  integer,
  timestamptz,
  uuid,
  public.notification_channel
) from public;
grant execute on function public.list_suppressed_notification_operations(
  integer,
  timestamptz,
  uuid,
  public.notification_channel
) to authenticated;

commit;
