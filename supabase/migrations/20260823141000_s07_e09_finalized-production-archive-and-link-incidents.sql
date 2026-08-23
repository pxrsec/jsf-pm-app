-- Candidate migration: S07 M2 finalized production archive and link incidents.
-- Target: supabase/migrations/20260823141000_s07_e09_finalized-production-archive-and-link-incidents.sql
-- Scope: purpose-limited SECURITY DEFINER read RPCs only; no tables, indexes,
-- data mutations, RLS-policy changes, provider activity, or URL dereferencing.

begin;

create function public.list_finalized_production_archive(
  p_project_id uuid default null,
  p_status public.deliverable_status default null,
  p_from timestamptz default (now() - interval '90 days'),
  p_to timestamptz default now(),
  p_before_finalized_at timestamptz default null,
  p_before_deliverable_id uuid default null,
  p_limit integer default 25
)
returns table (
  deliverable_id uuid,
  project_id uuid,
  deliverable_title text,
  final_status public.deliverable_status,
  current_version_number integer,
  finalized_at timestamptz,
  project_name text,
  project_drive_folder_url text,
  current_submission_url text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role public.app_role := (select private.current_user_role());
  v_is_admin boolean := (select private.is_admin());
  v_is_operator boolean;
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
begin
  if v_user_id is null or v_role is null then
    raise exception 'Authentication with an active profile is required';
  end if;

  v_is_operator := v_role = 'operator';

  if p_from is null or p_to is null then
    raise exception 'Finalized archive date range is required';
  end if;

  if p_from >= p_to then
    raise exception 'Finalized archive date range must have p_from before p_to';
  end if;

  if p_to - p_from > interval '93 days' then
    raise exception 'Finalized archive date range cannot exceed 93 days';
  end if;

  if p_status is not null and p_status not in ('approved', 'delivered') then
    raise exception 'Finalized archive status must be approved or delivered';
  end if;

  if (
    (p_before_finalized_at is null and p_before_deliverable_id is not null)
    or (
      p_before_finalized_at is not null
      and p_before_deliverable_id is null
    )
  ) then
    raise exception 'Finalized archive cursor must be complete';
  end if;

  return query
  with authorized_archive as (
    select
      d.id as deliverable_id,
      d.project_id as source_project_id,
      d.title as deliverable_title,
      d.status as final_status,
      d.current_version_number,
      coalesce(d.delivered_at, d.approved_at) as finalized_at,
      p.name as project_name,
      p.drive_folder_url as project_drive_folder_url,
      v.submission_url as current_submission_url,
      (
        v_is_admin
        or (select private.is_project_pm(d.project_id))
        or (select private.is_project_client(d.project_id))
      ) as can_navigate_project
    from public.deliverables d
    join public.projects p
      on p.id = d.project_id
      and p.deleted_at is null
    left join public.deliverable_versions v
      on v.deliverable_id = d.id
      and v.version_number = d.current_version_number
    where d.deleted_at is null
      and d.workflow_type = 'production'
      and d.status in ('approved', 'delivered')
      and coalesce(d.delivered_at, d.approved_at) is not null
      and (p_project_id is null or d.project_id = p_project_id)
      and (p_status is null or d.status = p_status)
      and coalesce(d.delivered_at, d.approved_at) >= p_from
      and coalesce(d.delivered_at, d.approved_at) < p_to
      and (
        v_is_admin
        or (select private.is_project_pm(d.project_id))
        or (select private.is_project_client(d.project_id))
        or (v_is_operator and d.assignee_id = v_user_id)
      )
  )
  select
    a.deliverable_id,
    case
      when a.can_navigate_project then a.source_project_id
      else null::uuid
    end as project_id,
    a.deliverable_title,
    a.final_status,
    a.current_version_number,
    a.finalized_at,
    a.project_name,
    case
      when a.can_navigate_project then a.project_drive_folder_url
      else null::text
    end as project_drive_folder_url,
    a.current_submission_url
  from authorized_archive a
  where p_before_finalized_at is null
     or a.finalized_at < p_before_finalized_at
     or (
       a.finalized_at = p_before_finalized_at
       and a.deliverable_id < p_before_deliverable_id
     )
  order by a.finalized_at desc, a.deliverable_id desc
  limit v_limit;
end;
$function$;

revoke all on function public.list_finalized_production_archive(
  uuid,
  public.deliverable_status,
  timestamptz,
  timestamptz,
  timestamptz,
  uuid,
  integer
) from public;

revoke all on function public.list_finalized_production_archive(
  uuid,
  public.deliverable_status,
  timestamptz,
  timestamptz,
  timestamptz,
  uuid,
  integer
) from anon;

grant execute on function public.list_finalized_production_archive(
  uuid,
  public.deliverable_status,
  timestamptz,
  timestamptz,
  timestamptz,
  uuid,
  integer
) to authenticated;


create function public.list_role_safe_link_incidents(
  p_project_id uuid default null,
  p_status public.link_report_status default null,
  p_from timestamptz default (now() - interval '90 days'),
  p_to timestamptz default now(),
  p_before_reported_at timestamptz default null,
  p_before_incident_id uuid default null,
  p_limit integer default 25
)
returns table (
  incident_id uuid,
  deliverable_id uuid,
  project_id uuid,
  deliverable_title text,
  project_name text,
  incident_status public.link_report_status,
  reported_at timestamptz,
  resolved_at timestamptz,
  reason text,
  resolution_note text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role public.app_role := (select private.current_user_role());
  v_is_admin boolean := (select private.is_admin());
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
begin
  if v_user_id is null or v_role is null then
    raise exception 'Authentication with an active profile is required';
  end if;

  if v_role not in ('admin', 'pm') then
    raise exception 'Only Admin or an active PM project member can list link incidents';
  end if;

  if p_from is null or p_to is null then
    raise exception 'Link incident date range is required';
  end if;

  if p_from >= p_to then
    raise exception 'Link incident date range must have p_from before p_to';
  end if;

  if p_to - p_from > interval '93 days' then
    raise exception 'Link incident date range cannot exceed 93 days';
  end if;

  if (
    (p_before_reported_at is null and p_before_incident_id is not null)
    or (
      p_before_reported_at is not null
      and p_before_incident_id is null
    )
  ) then
    raise exception 'Link incident cursor must be complete';
  end if;

  return query
  select
    lr.id as incident_id,
    d.id as deliverable_id,
    d.project_id,
    d.title as deliverable_title,
    p.name as project_name,
    lr.status as incident_status,
    lr.created_at as reported_at,
    lr.resolved_at,
    lr.reason,
    lr.resolution_note
  from public.deliverable_link_reports lr
  join public.deliverables d
    on d.id = lr.deliverable_id
    and d.deleted_at is null
  join public.projects p
    on p.id = d.project_id
    and p.deleted_at is null
  where (p_project_id is null or d.project_id = p_project_id)
    and (p_status is null or lr.status = p_status)
    and lr.created_at >= p_from
    and lr.created_at < p_to
    and (
      v_is_admin
      or (select private.is_project_pm(d.project_id))
    )
    and (
      p_before_reported_at is null
      or lr.created_at < p_before_reported_at
      or (
        lr.created_at = p_before_reported_at
        and lr.id < p_before_incident_id
      )
    )
  order by lr.created_at desc, lr.id desc
  limit v_limit;
end;
$function$;

revoke all on function public.list_role_safe_link_incidents(
  uuid,
  public.link_report_status,
  timestamptz,
  timestamptz,
  timestamptz,
  uuid,
  integer
) from public;

revoke all on function public.list_role_safe_link_incidents(
  uuid,
  public.link_report_status,
  timestamptz,
  timestamptz,
  timestamptz,
  uuid,
  integer
) from anon;

grant execute on function public.list_role_safe_link_incidents(
  uuid,
  public.link_report_status,
  timestamptz,
  timestamptz,
  timestamptz,
  uuid,
  integer
) to authenticated;

commit;
