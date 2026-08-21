-- Migration: S04-06 Allow Incomplete Client Project Planning
-- Reference: ADR-023 consolidated S02 closeout and S04 reconciliation
-- Scope: permit a client project to remain un-onboarded only while planning.
-- No data changes, remote calls, or changes to membership/production-deliverable
-- enforcement are made here.

begin;

-- The original constraint requires a client organization for every client project,
-- which prevents the approved planning-only exception. Replacing it atomically
-- preserves the invariant for internal projects and every non-planning client state.
alter table public.projects
  drop constraint projects_type_client_ck;

alter table public.projects
  add constraint projects_type_client_ck check (
    (
      project_type = 'client'
      and (status = 'planning' or client_id is not null)
    )
    or (
      project_type = 'internal'
      and client_id is null
    )
  );

commit;
