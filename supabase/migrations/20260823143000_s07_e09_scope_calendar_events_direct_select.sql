-- Sprint 07 E09: close the direct manual-milestone read bypass.
--
-- M1 intentionally replaced generic calendar consumption with
-- list_role_safe_calendar_events() and revoked direct authenticated DML on
-- public.calendar_events. The legacy SELECT policy still admitted every active
-- project member, including Operators and Clients, to non-deleted manual
-- milestones. That bypasses M1's role-safe feed contract.
--
-- This forward-only migration narrows direct SELECT to the same audience that
-- may receive manual milestones in the M1 feed: Admins and active PM Leads or
-- PM Watchers. The existing private.is_project_pm(project_id) predicate is
-- active-membership-aware and includes Admins. Operators and Clients receive
-- no direct calendar_events row access.
--
-- It does not change M1 RPC signatures, grants, direct-DML revocations,
-- calendar event data, audit history, functions, views, Realtime, providers,
-- schedulers, or generated TypeScript declarations.

begin;

-- Replace the legacy active-project-member read policy rather than adding a
-- second policy: PostgreSQL OR-combines permissive SELECT policies, so leaving
-- the legacy policy in place would retain the Operator/Client bypass.
drop policy if exists calendar_events_select_policy on public.calendar_events;

create policy calendar_events_select_policy on public.calendar_events
for select to authenticated
using (
  deleted_at is null
  and (select private.is_project_pm(project_id))
);

commit;
