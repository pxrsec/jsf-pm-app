-- Migration: S05-05 Harden Client Submission URLs and Safe Correction History
-- Reference: dev-docs/specs/s05/s05-05-client-submission-planning-consumption-url-submission-and-correction-loop-spec.md
-- Scope: lexical public-HTTPS validation, authoritative provider classification,
-- optional immutable Client note policy, and a direct-assignee-safe correction
-- history projection. This migration never fetches, resolves, previews, proxies,
-- downloads, scans, hosts, or authenticates against a submitted URL.

begin;

-- Raw URL validation only. The host grammar accepts public DNS names and rejects
-- localhost and every IP literal without a network lookup. An empty path is valid
-- for Client-submission URLs; normal path/query/fragment suffixes are accepted.
create function private.is_valid_client_submission_url(
  p_submission_url text
)
returns boolean
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select
    octet_length(p_submission_url) <= 2048
    and p_submission_url !~ '[[:space:][:cntrl:]]'
    and strpos(p_submission_url, chr(92)) = 0
    and p_submission_url ~* '^https://([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]([a-z0-9-]{0,61}[a-z0-9])?([/?#][^[:space:][:cntrl:]]*)?$'
$$;

-- This function is called only after private.is_valid_client_submission_url().
-- It classifies hostname suffixes lexically and never reaches out to a provider.
create function private.classify_client_submission_provider(
  p_submission_url text
)
returns public.submission_provider
language plpgsql
immutable
strict
set search_path = pg_catalog, public
as $$
declare
  v_host text;
begin
  if not private.is_valid_client_submission_url(p_submission_url) then
    raise exception 'Submission URL must be a valid public HTTPS URL';
  end if;

  v_host := lower((regexp_match(p_submission_url, '^https://([^/?#]+)'))[1]);

  if v_host in ('drive.google.com', 'docs.google.com') then
    return 'google_drive';
  end if;

  if v_host = 'dropbox.com' or v_host like '%.dropbox.com' then
    return 'dropbox';
  end if;

  if v_host = 'onedrive.live.com'
    or v_host like '%.onedrive.live.com'
    or v_host = '1drv.ms'
    or v_host like '%.1drv.ms' then
    return 'onedrive';
  end if;

  if v_host = 'wetransfer.com'
    or v_host like '%.wetransfer.com'
    or v_host = 'we.tl'
    or v_host like '%.we.tl' then
    return 'wetransfer';
  end if;

  if v_host = 'frame.io'
    or v_host like '%.frame.io'
    or v_host = 'f.io'
    or v_host like '%.f.io' then
    return 'frame_io';
  end if;

  return 'other_https';
end;
$$;

-- The helper runs as definer because audit_logs is Admin-readable only. It still
-- checks the current caller through the existing direct-Client-assignee helper and
-- returns a fixed, least-privilege JSON shape. It is consumed by the safe view.
create function private.get_client_submission_correction_history(
  p_deliverable_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select case
    when private.is_client_submission_assignee(p_deliverable_id) then coalesce(
      (
        select jsonb_agg(history.entry order by history.occurred_at asc, history.sort_order asc)
        from (
          select
            v.submitted_at as occurred_at,
            0 as sort_order,
            jsonb_build_object(
              'kind', 'version',
              'version_number', v.version_number,
              'submission_url', v.submission_url,
              'submission_provider', v.submission_provider,
              'submission_note', v.submission_note,
              'submitted_at', v.submitted_at
            ) as entry
          from public.deliverable_versions v
          where v.deliverable_id = p_deliverable_id

          union all

          select
            a.created_at as occurred_at,
            1 as sort_order,
            jsonb_build_object(
              'kind', 'reopened',
              'reopened_at', a.created_at,
              'reason', a.changed_fields ->> 'reason'
            ) as entry
          from public.audit_logs a
          where a.entity_type = 'deliverable'
            and a.entity_id = p_deliverable_id
            and a.action = 'client_submission_reopened'
        ) history
      ),
      '[]'::jsonb
    )
    else '[]'::jsonb
  end;
$$;

revoke all on function private.is_valid_client_submission_url(text)
  from public, anon, authenticated;
revoke all on function private.classify_client_submission_provider(text)
  from public, anon, authenticated;
revoke all on function private.get_client_submission_correction_history(uuid)
  from public, anon;
grant execute on function private.get_client_submission_correction_history(uuid)
  to authenticated;

create or replace function public.submit_client_deliverable(
  p_deliverable_id uuid,
  p_submission_url text,
  p_submission_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_deliv record;
  v_user_id uuid := auth.uid();
  v_provider public.submission_provider;
  v_submission_note text := nullif(btrim(p_submission_note), '');
  v_new_version integer;
  v_version_id uuid;
  v_event_id uuid;
  v_pm record;
begin
  select * into v_deliv
  from public.deliverables
  where id = p_deliverable_id and deleted_at is null
  for update;

  if not found then
    raise exception 'Deliverable % not found or deleted', p_deliverable_id;
  end if;

  if v_deliv.workflow_type <> 'client_submission' then
    raise exception 'Deliverable % is not a client_submission workflow', p_deliverable_id;
  end if;

  if v_deliv.assignee_id <> v_user_id then
    raise exception 'Only the direct Client assignee can submit this deliverable';
  end if;

  if v_deliv.status <> 'pending' then
    raise exception 'Deliverable % is not pending (status: %)', p_deliverable_id, v_deliv.status;
  end if;

  if not private.is_valid_client_submission_url(p_submission_url) then
    raise exception 'Submission URL must be a valid public HTTPS URL';
  end if;

  if v_submission_note is not null and char_length(v_submission_note) > 1000 then
    raise exception 'Submission note must be 1000 characters or fewer';
  end if;

  v_provider := private.classify_client_submission_provider(p_submission_url);
  v_new_version := v_deliv.current_version_number + 1;

  insert into public.deliverable_versions (
    deliverable_id,
    version_number,
    submission_url,
    submission_provider,
    submitted_by,
    submission_note
  ) values (
    p_deliverable_id,
    v_new_version,
    p_submission_url,
    v_provider,
    v_user_id,
    v_submission_note
  ) returning id into v_version_id;

  update public.deliverables
  set status = 'submitted',
      current_version_number = v_new_version,
      last_activity_at = now(),
      updated_by = v_user_id,
      updated_at = now()
  where id = p_deliverable_id;

  insert into public.audit_logs (
    entity_type,
    entity_id,
    project_id,
    action,
    old_status,
    new_status,
    changed_fields,
    actor_id,
    actor_role
  ) values (
    'deliverable',
    p_deliverable_id,
    v_deliv.project_id,
    'client_deliverable_submitted',
    'pending',
    'submitted',
    jsonb_build_object(
      'version_number', v_new_version,
      'version_id', v_version_id,
      'provider', v_provider
    ),
    v_user_id,
    'client'
  );

  insert into public.notification_events (
    trigger,
    entity_type,
    entity_id,
    project_id,
    actor_id,
    payload,
    deduplication_key
  ) values (
    'client_submission_received',
    'deliverable',
    p_deliverable_id,
    v_deliv.project_id,
    v_user_id,
    jsonb_build_object(
      'deliverable_title', v_deliv.title,
      'version_number', v_new_version,
      'version_id', v_version_id
    ),
    'client_submission_received:' || p_deliverable_id || ':v' || v_new_version
  )
  on conflict (deduplication_key) do nothing
  returning id into v_event_id;

  if v_event_id is not null then
    for v_pm in
      select pm.user_id
      from public.project_members pm
      where pm.project_id = v_deliv.project_id
        and pm.member_type in ('pm_lead', 'pm_watcher')
        and pm.receives_notifications = true
        and pm.deleted_at is null
    loop
      insert into public.notification_recipients (
        event_id,
        user_id,
        channel,
        delivery_status
      ) values (
        v_event_id,
        v_pm.user_id,
        'in_app',
        'pending'
      ) on conflict do nothing;
    end loop;
  end if;

  return jsonb_build_object(
    'deliverable_id', p_deliverable_id,
    'version_id', v_version_id,
    'version_number', v_new_version,
    'provider', v_provider,
    'status', 'submitted'
  );
end;
$$;

create or replace view public.client_submission_view
with (security_invoker = true)
as
select
  d.id,
  d.project_id,
  p.name as project_name,
  d.task_id,
  t.title as task_title,
  d.assignee_id,
  d.title,
  d.specifications,
  d.status,
  d.current_version_number,
  d.submission_deadline_at,
  d.last_activity_at,
  v.submission_url as current_submission_url,
  v.submission_provider as current_submission_provider,
  v.submission_note as current_submission_note,
  v.submitted_at as current_submitted_at,
  d.created_at,
  private.get_client_submission_correction_history(d.id) as correction_history
from public.deliverables d
join public.projects p on p.id = d.project_id
join public.tasks t on t.id = d.task_id
left join public.deliverable_versions v
  on v.deliverable_id = d.id
  and v.version_number = d.current_version_number
where d.workflow_type = 'client_submission'
  and d.deleted_at is null
  and p.deleted_at is null
  and t.deleted_at is null;

commit;
