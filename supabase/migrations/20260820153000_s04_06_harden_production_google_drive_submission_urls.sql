-- Migration: S04-06 Harden Production Google Drive Submission URLs
-- Reference: dev-docs/specs/s04/s04-specs/s04-06-production-deliverable-planning-submission-and-immutable-history-spec.md
-- Scope: lexical validation only. Never fetches, resolves, previews, proxies,
-- downloads, scans, stores, or authenticates against the submitted URL.

begin;

-- Accept only the exact production Google Drive URL shape. This helper is called
-- by the version-insert trigger below, including inserts made by
-- public.submit_deliverable_version(). It is intentionally not applied to the
-- client_submission workflow, whose provider policy is broader.
create function private.is_valid_production_google_drive_submission_url(
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
    and strpos(p_submission_url, E'\\') = 0
    and p_submission_url ~* '^https://(drive\.google\.com|docs\.google\.com)/[^[:space:][:cntrl:]]*$'
$$;

create function private.validate_production_google_drive_submission_url()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_workflow_type public.deliverable_workflow_type;
begin
  select d.workflow_type
  into v_workflow_type
  from public.deliverables d
  where d.id = new.deliverable_id;

  if not found then
    raise exception 'Deliverable % not found for submitted version', new.deliverable_id;
  end if;

  if v_workflow_type = 'production' then
    if new.submission_provider <> 'google_drive' then
      raise exception 'Production deliverable versions must use Google Drive';
    end if;

    if not private.is_valid_production_google_drive_submission_url(new.submission_url) then
      raise exception 'Production deliverable submission URL must be a valid Google Drive HTTPS link';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.is_valid_production_google_drive_submission_url(text)
  from public, anon, authenticated;

revoke all on function private.validate_production_google_drive_submission_url()
  from public, anon, authenticated;

create trigger deliverable_versions_validate_production_google_drive_url_trg
  before insert on public.deliverable_versions
  for each row
  execute function private.validate_production_google_drive_submission_url();

commit;
