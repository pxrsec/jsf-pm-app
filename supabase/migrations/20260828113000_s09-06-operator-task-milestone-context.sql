-- Migration: S09-06 operator-safe milestone context projection
-- Reference: dev-docs/specs/s09/s09-06-milestone-goals-and-task-progress-implementation-spec.md
-- Status: SOURCE ONLY. Review, commit, and explicitly authorize application to
-- jsf-pm-dev before remote mutation. Do not edit this migration after application.
--
-- The first S09-06 migration correctly revokes direct milestone-table access.
-- This forward migration supplies the narrow operator-owned projection required
-- to render only goal context for a directly assigned task.

begin;

create function public.list_operator_task_milestone_context(p_task_id uuid)
returns table (
  title text,
  scope text,
  target_date date
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role public.app_role := (select private.current_user_role());
begin
  if v_user_id is null or v_role <> 'operator' then
    raise exception 'Operator task milestone context is not permitted';
  end if;

  if not exists (
    select 1
    from public.tasks t
    where t.id = p_task_id
      and t.assignee_id = v_user_id
      and t.deleted_at is null
  ) then
    raise exception 'Operator task milestone context is not permitted';
  end if;

  return query
  select m.title, m.scope, m.target_date
  from public.milestone_tasks mt
  join public.milestones m
    on m.id = mt.milestone_id
    and m.deleted_at is null
  where mt.task_id = p_task_id
  order by m.target_date asc, m.title asc;
end;
$$;

revoke all on function public.list_operator_task_milestone_context(uuid) from public, anon;
grant execute on function public.list_operator_task_milestone_context(uuid) to authenticated;

commit;
