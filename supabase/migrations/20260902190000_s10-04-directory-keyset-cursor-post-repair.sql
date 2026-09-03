-- S10-04 directory keyset-cursor projection post-repair.
--
-- 20260902180000_s10-04-access-hygiene-completeness-repair recreates the
-- role-safe directory function after the earlier cursor projection repair's
-- timestamp. A fresh chronological migration replay would therefore replace
-- the created_at projection required for the documented composite keyset
-- cursor (profiles.created_at DESC, profiles.id DESC).
--
-- Reapply only that projection after the completeness repair. Authorization,
-- scope, ordering, cursor predicate, counts, limits, owner, search path, and
-- authenticated-only execute posture remain unchanged.

begin;

drop function public.list_user_access_directory(timestamptz, uuid, integer);

create function public.list_user_access_directory(
  p_before_created_at timestamptz default null,
  p_before_user_id uuid default null,
  p_limit integer default 25
)
returns table(
  user_id uuid,
  created_at timestamptz,
  full_name text,
  application_role public.app_role,
  is_active boolean,
  last_successful_auth_at timestamptz,
  active_project_membership_count integer,
  active_task_assignment_count integer,
  active_deliverable_assignment_count integer,
  pending_invitation_count integer,
  last_access_action text,
  last_access_action_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
begin
  perform private.assert_s10_operational_manager();
  if (p_before_created_at is null) <> (p_before_user_id is null) then
    raise exception 'Directory cursor must be complete';
  end if;

  return query
  select
    p.id,
    p.created_at,
    p.full_name,
    p.role,
    p.is_active,
    u.last_sign_in_at,
    (
      select count(*)::integer
      from public.project_members pm
      join public.projects pr on pr.id = pm.project_id
      where pm.user_id = p.id
        and pm.deleted_at is null
        and pr.deleted_at is null
        and pr.archived_at is null
        and pr.status <> 'cancelled'
    ),
    (
      select count(*)::integer
      from public.tasks t
      join public.projects pr on pr.id = t.project_id
      where t.assignee_id = p.id
        and t.deleted_at is null
        and t.archived_at is null
        and pr.deleted_at is null
        and pr.archived_at is null
        and pr.status <> 'cancelled'
    ),
    (
      select count(*)::integer
      from public.deliverables d
      join public.tasks t on t.id = d.task_id
      join public.projects pr on pr.id = d.project_id
      where d.assignee_id = p.id
        and d.deleted_at is null
        and d.archived_at is null
        and t.deleted_at is null
        and t.archived_at is null
        and pr.deleted_at is null
        and pr.archived_at is null
        and pr.status <> 'cancelled'
    ),
    (
      select count(*)::integer
      from public.invite_tokens i
      where lower(i.email::text) = lower(u.email)
        and i.role in ('client', 'operator')
        and i.status = 'pending'
        and i.revoked_at is null
        and i.expires_at > now()
    ),
    a.action,
    a.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  left join lateral (
    select ua.action, ua.created_at
    from public.user_access_actions ua
    where ua.target_user_id = p.id
    order by ua.created_at desc, ua.id desc
    limit 1
  ) a on true
  where p.deleted_at is null
    and (
      p_before_created_at is null
      or p.created_at < p_before_created_at
      or (p.created_at = p_before_created_at and p.id < p_before_user_id)
    )
  order by p.created_at desc, p.id desc
  limit v_limit;
end;
$function$;

alter function public.list_user_access_directory(timestamptz, uuid, integer) owner to postgres;
revoke all on function public.list_user_access_directory(timestamptz, uuid, integer)
  from public, anon;
grant execute on function public.list_user_access_directory(timestamptz, uuid, integer)
  to authenticated;

commit;
