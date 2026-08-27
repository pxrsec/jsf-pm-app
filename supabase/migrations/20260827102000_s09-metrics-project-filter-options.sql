-- S09: expose narrow all-project metrics filter options to active company owners.
--
-- Prerequisites: S09 metrics authority migrations through
-- 20260827101000_s09-pm-global-user-metrics-authority.sql.
--
-- The projects table RLS intentionally limits a PM's direct project listing to
-- membership. Metrics authority is global for active PM company owners, so this
-- read-only SECURITY DEFINER projection supplies only the selected-filter data
-- required by the metrics routes: non-deleted project UUID and name.

begin;

create function public.list_scoped_metrics_project_filter_options()
returns table (
  project_id uuid,
  project_name text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_user_id
      and p.role in ('admin', 'pm')
      and p.is_active = true
      and p.deleted_at is null
  ) then
    raise exception 'Metrics access required';
  end if;

  return query
  select p.id, p.name
  from public.projects p
  where p.deleted_at is null
  order by p.name asc, p.id asc;
end;
$function$;

alter function public.list_scoped_metrics_project_filter_options()
  owner to postgres;

revoke all on function public.list_scoped_metrics_project_filter_options() from public, anon;
grant execute on function public.list_scoped_metrics_project_filter_options() to authenticated;

commit;
