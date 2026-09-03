-- S10-03: make the recycle-bin parent-state contract complete for archived
-- deliverables. An archived deliverable is not restorable while either its
-- project or task parent remains archived. The existing function previously
-- reported only the project state, which could enable a restore control that
-- the trusted restore command correctly rejects.
--
-- This is a narrow forward correction. It preserves the RPC signature, result
-- shape, authority, sorting, and all retention/lifecycle behavior.

begin;

create or replace function public.list_operational_recycle_bin(
  p_project_id uuid default null
)
returns table (
  entity_type public.entity_type,
  entity_id uuid,
  project_id uuid,
  title text,
  archived_at timestamptz,
  archived_by uuid,
  archive_reason text,
  parent_is_archived boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
begin
  perform private.assert_s10_operational_manager();

  return query
  select
    'project'::public.entity_type,
    p.id,
    p.id,
    p.name,
    p.archived_at,
    p.archived_by,
    p.archive_reason,
    false
  from public.projects p
  where p.deleted_at is null
    and p.archived_at is not null
    and (p_project_id is null or p.id = p_project_id)

  union all

  select
    'task'::public.entity_type,
    t.id,
    t.project_id,
    t.title,
    t.archived_at,
    t.archived_by,
    t.archive_reason,
    p.archived_at is not null
  from public.tasks t
  join public.projects p on p.id = t.project_id
  where t.deleted_at is null
    and t.archived_at is not null
    and (p_project_id is null or t.project_id = p_project_id)

  union all

  select
    'deliverable'::public.entity_type,
    d.id,
    d.project_id,
    d.title,
    d.archived_at,
    d.archived_by,
    d.archive_reason,
    p.archived_at is not null or t.archived_at is not null
  from public.deliverables d
  join public.tasks t on t.id = d.task_id
  join public.projects p on p.id = d.project_id
  where d.deleted_at is null
    and d.archived_at is not null
    and (p_project_id is null or d.project_id = p_project_id)

  union all

  select
    'milestone'::public.entity_type,
    m.id,
    m.project_id,
    m.title,
    m.archived_at,
    m.archived_by,
    m.archive_reason,
    coalesce(p.archived_at is not null, false)
  from public.milestones m
  left join public.projects p on p.id = m.project_id
  where m.deleted_at is null
    and m.archived_at is not null
    and (p_project_id is null or m.project_id = p_project_id)

  order by archived_at desc, entity_type asc, entity_id asc;
end;
$function$;

alter function public.list_operational_recycle_bin(uuid) owner to postgres;
revoke all on function public.list_operational_recycle_bin(uuid)
  from public, anon, service_role;
grant execute on function public.list_operational_recycle_bin(uuid) to authenticated;

commit;
