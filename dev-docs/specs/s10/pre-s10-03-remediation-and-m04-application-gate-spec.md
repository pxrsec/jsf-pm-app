---
document_id: PRE-S10-03-REMEDIATION-AND-M04-APPLICATION-GATE-SPEC-01
sprint_id: S10
work_items: [S10-03, S10-04]
status: implementation-required-before-m04-application
updated_at: 2026-09-02T07:00:25-06:00
target_environment: jsf-pm-dev
owner: Project Owner
implementation_consumer: Antigravity
remote_schema_mutation: prohibited
schema_baseline:
  - supabase/migrations/20260901140000_s10-03-archive-recycle-bin-and-admin-permanent-deletion.sql
candidate_forward_migration:
  - supabase/migrations/20260902090000_s10-04-account-access-hygiene-bug-triage-and-s10-03-closure.sql
---

# Pre-S10-03 Remediation and M04 Application Gate

## 1. Authority, objective, and hard stop

This is the execution authority for the **required forward remediation of the already-applied S10-03 database contract** before the candidate S10-04/M04 migration may be considered ready for application.

The S10-03 migration `20260901140000_s10-03-archive-recycle-bin-and-admin-permanent-deletion.sql` is already applied to `jsf-pm-dev`. It added archive metadata, archive/recovery/deletion lifecycle RPCs, and base-table RLS. It did **not** update every existing trusted view, `SECURITY DEFINER` function, and trigger function that reads or writes projects, tasks, deliverables, or milestones. Those objects can bypass the otherwise-correct base-table archive visibility rules.

The required outcome is exact:

1. Every active operational projection excludes archived projects, tasks, deliverables, and milestones according to the active ancestry rules in this document.
2. Every existing trusted command rejects archived targets and archived parents before mutating state.
3. Every private authorization/readiness helper returns false for archived targets or archived ancestry.
4. Every validation trigger rejects creation or update of active operational children under archived parents, and rejects new active associations/version/calendar content on archived targets.
5. The candidate M04 migration becomes a complete **forward-only** source artifact that performs this S10-03 closure alongside its S10-04 account/access-hygiene/bug-triage contract.
6. No already-applied migration is edited, no remote migration is applied, and no generated database type file is changed during this work.

**Hard stop:** Antigravity must not apply a migration, use `supabase db push`, modify hosted Supabase state, regenerate `src/lib/database.types.ts`, commit, push, or open a PR unless the Project Owner separately authorizes that action. The only requested output is the corrected, reviewable, local M04 migration source and factual implementation evidence.

## 2. Why this is a migration-source remediation, not a UI refactor

Do not attempt to solve this issue by hiding buttons, filtering route-level queries, adding client-side predicates, changing only application TypeScript, weakening/replacing RLS, or editing the applied M03 file.

The live audit proved that public views and authenticated-callable `SECURITY DEFINER` routines can read or mutate archived operational context despite base table RLS. A trusted database routine runs with privileged rights; a UI condition and a base-table RLS predicate do not repair its internal SQL.

The required repair is therefore to replace the affected routine/view definitions in the **unapplied forward M04 migration**. Any required TypeScript refactor is limited to preserving source compatibility if a deliberately unchanged SQL return shape requires it. No UI behavior change is requested in this remediation.

## 3. Definitions and active-ancestry invariant

### 3.1 Canonical active state

An operational row is active only when:

```sql
deleted_at is null
and archived_at is null
```

For every entity with operational ancestry, the required parent chain must also be active:

| Entity / context | Required active chain |
| --- | --- |
| Project | `project.deleted_at IS NULL AND project.archived_at IS NULL` |
| Task | task active **and** parent project active |
| Deliverable | deliverable active **and** parent task active **and** parent project active |
| Project-scoped milestone | milestone active **and** parent project active |
| Company milestone | milestone active; no project parent condition |
| Calendar event | active project always; if `task_id` is set, active task in that project |
| Task/resource/assignment/context | active task and active parent project |
| Deliverable version/feedback/link report/context | active deliverable, active parent task, active parent project |

`deleted_at` is not interchangeable with `archived_at`. M03 archive behavior must never write `deleted_at`; M04 remediation must never treat a non-null `deleted_at` row as active merely because `archived_at` is null.

### 3.2 Required behavior for unavailable archived data

- Read projections: omit the row, or preserve immutable recipient/history rows only after nulling every archived target title, project context, navigation identifier, and actionable affordance as defined below.
- Boolean helpers: return `false`.
- Authoritative commands: return the routine’s existing safe not-found/unavailable result or raise its existing generic safe boundary error. Do not introduce raw SQL exceptions into browser-visible paths.
- Validation triggers: use the existing validation-style error contract; do not silently accept a new active relation/content under archived ancestry.
- No routine may automatically restore an archived record, rewrite archive metadata, or substitute a different record.

## 4. Source-of-truth and reconstruction procedure

### 4.1 Do not hand-reconstruct trusted SQL from assumptions

The live database—not a shortened audit summary—is the authoritative source for every existing routine/view/trigger function being replaced. Before editing the candidate M04 source, obtain the full current definition for each object from `jsf-pm-dev` using a **read-only** catalog query, or receive an equivalent complete catalog artifact from the Project Owner/Athena.

Required source extraction pattern:

```sql
-- Functions and trigger functions
select
  n.nspname as schema_name,
  p.proname,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  pg_get_functiondef(p.oid) as definition,
  pg_get_userbyid(p.proowner) as owner,
  p.prosecdef as security_definer,
  p.provolatile,
  p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private')
  and p.proname = any (array[
    -- Populate one exact object-name batch from Section 5.
  ])
order by n.nspname, p.proname, identity_arguments;

-- Views
select
  n.nspname as schema_name,
  c.relname as view_name,
  pg_get_viewdef(c.oid, true) as definition,
  c.reloptions
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'v'
  and c.relname = any (array[
    -- Populate exact view names from Section 5.
  ])
order by c.relname;

-- Trigger bindings; do not recreate a trigger unless its event binding changes.
select
  tgrelid::regclass::text as table_name,
  tgname,
  pg_get_triggerdef(oid) as trigger_definition
from pg_trigger
where not tgisinternal
  and tgname = any (array[
    'task_validate_trg',
    'deliverable_sync_and_validate_trg',
    'milestone_tasks_validate_scope_trg',
    'calendar_events_task_scope_trg',
    'deliverable_versions_validate_production_google_drive_url_trg'
  ])
order by table_name, tgname;
```

For each replacement, preserve exactly unless this specification expressly requires a change:

- function identity signature, argument names/types/defaults, `RETURNS` shape, `RETURNS TABLE` column order and types;
- `LANGUAGE`, `SECURITY DEFINER`, volatility (`STABLE`/volatile), `search_path`, owner, and current grants/revokes;
- current actor authorization, role-safe nulling, cursor/range bounds, pagination/order semantics, canonical lock order, audit/event writes, and error/result-code contracts;
- trigger timing, events, `WHEN` condition, target table, and existing `NEW` synchronization/validation behavior;
- view column names, expression types, ordering, and downstream-compatible shape.

Do not replace source by abbreviated pseudo-SQL. Do not change `SECURITY DEFINER` to invoker mode merely to avoid repairing the routine. Do not grant new access. Do not broaden an existing role’s scope. Do not alter `auth.users`, provider state, or existing retention/dependency semantics.

### 4.2 Candidate migration ownership

All remediation statements belong in:

```text
supabase/migrations/20260902090000_s10-04-account-access-hygiene-bug-triage-and-s10-03-closure.sql
```

Keep the migration’s existing `BEGIN`/`COMMIT` transactional structure. Preserve its independent S10-04 account settings, access hygiene, stale reminder, deactivation, and bug triage contract unless an actual SQL compatibility defect is found and documented.

The filename/timestamp is intentional. Do **not** rename it to the obsolete epic-planned `20260830112000` timestamp: that would sort before applied M03 and violate forward migration order.

If the M04 file contains an incomplete-scope warning, replace it only after every Section 5 object is resolved and verification succeeds. Do not claim completeness while an object remains unreviewed.

## 5. Mandatory exact remediation inventory

The following inventory is mandatory. It comes from a read-only live catalog audit of `jsf-pm-dev` after M03 application. An object not appearing in an abbreviated local search is not authority to omit it.

### 5.1 Calendar RPC and calendar view

**Objects**

- `public.list_role_safe_calendar_events(p_from timestamptz, p_to timestamptz, p_project_id uuid)`
- `public.calendar_feed_view`

**Defect**

Existing project/task/deliverable/milestone branches filter `deleted_at` but not `archived_at`. The view can emit `calendar_events` without proving active project/task ancestry.

**Required repair**

- Add active predicates to every emitted project, task, deliverable, and milestone.
- Deliverables require active task and project ancestry.
- Project-scoped milestones require an active project; company milestones remain eligible only when the milestone itself is active.
- Every calendar event requires an active project. If `task_id` is non-null, require an active task belonging to that same active project.
- Preserve role-safe nulling behavior and the RPC’s complete `RETURNS TABLE`, authorization, range, and ordering contract.

### 5.2 Metrics/reporting RPCs and views

**Objects**

- `public.get_scoped_operations_metrics(...)`
- `public.list_scoped_operations_metric_trend(...)`
- `public.list_scoped_user_operations_metrics(...)`
- `public.list_scoped_metrics_project_filter_options()`
- `public.deliverable_cycle_metrics_view`
- `public.project_completion_cycles_view`

**Defect**

`scoped_projects`, task/deliverable CTEs, and metric views allow rows with only `deleted_at IS NULL`. This contaminates active counts, deadlines, finalized counts, review/completion cycles, user metrics, notification queues, and project filter options.

**Required repair**

- Every `scoped_projects` / project candidate definition must require project active state.
- Every independent task/deliverable CTE/read must require target active state plus active parent chain.
- `deliverable_cycle_metrics_view` must require active deliverable + active task + active project.
- `project_completion_cycles_view` must require active project.
- Preserve CTE names, columns, order semantics, metric formulas, default arguments, pagination/bounds, and view shape.

### 5.3 Milestone selectors, management projections, and operator context

**Objects**

- `public.get_milestone_detail(uuid)`
- `public.list_project_milestone_summaries(uuid)`
- `public.list_milestone_tasks(uuid)`
- `public.list_task_milestone_options(uuid)`
- `public.list_milestone_management_targets()`
- `public.list_operator_task_milestone_context(uuid)`

**Defect**

Milestones, linked tasks, and parent projects are constrained only by `deleted_at`. Archived milestones can be selected, and archived tasks can be counted or linked into active milestone work.

**Required repair**

- Require active milestones.
- Require active linked tasks and active parent projects.
- Return no rows / existing safe unavailable behavior when the requested project, task, or milestone is archived.
- Company milestones retain their existing semantics but only include active company milestones and active contributing tasks.

### 5.4 Active mutation commands: create/update/association/comment

**Objects**

- `public.create_milestone(...)`
- `public.update_milestone(...)`
- `public.create_task_with_deliverables(...)`
- `public.create_collaboration_comment(uuid, collaboration_target_type, uuid, text)`

**Defect**

Existing lookups validate only non-deleted targets or rely on an insert path that does not establish active ancestry.

**Required repair**

- Creation requires an active project parent.
- Milestone task arrays may contain only active tasks belonging to active projects and valid scope.
- Updates must reject archived project/task/milestone targets before mutation.
- Task-with-deliverables creation must reject archived project context before it reaches task/deliverable triggers.
- Collaboration comments require an active project and active task/deliverable target.
- Preserve JSON/table return contracts, audit writes, authorization, canonical locks, and existing error behavior.

### 5.5 Active mutation commands: project/task/deliverable workflow

**Objects**

- `public.transition_project_status(...)`
- `public.recover_project_status(uuid, project_status, text)`
- `public.transition_task_status(...)`
- `public.mark_deliverable_delivered(uuid)`
- `public.reopen_client_deliverable(uuid, text)`
- `public.review_deliverable(uuid, review_stage, review_decision, text)`
- `public.submit_client_deliverable(uuid, text, text)`
- `public.submit_deliverable_version(uuid, text, text)`
- `public.report_broken_link(uuid, uuid, text)`

**Defect**

Target lookups check `deleted_at IS NULL` while omitting `archived_at`, and several task/deliverable operations do not consistently establish active parent chain.

**Required repair**

- Project workflow commands require an active project.
- Task workflow commands require an active task and active parent project.
- Deliverable workflow/link-report/version commands require active deliverable, active task, and active project.
- Reuse existing safe not-found/authorization result behavior; do not expose whether another user’s archived target exists.
- Preserve all side effects, including audit/event writes, version state, feedback/review semantics, and lock order.

### 5.6 Completion, incident, notification, and invitation projections

**Objects**

- `public.get_project_completion_readiness(uuid)`
- `public.list_role_safe_link_incidents(...)`
- `public.list_finalized_production_archive(...)`
- `public.list_my_in_app_notifications(...)`
- `public.list_suppressed_notification_operations(...)`
- `public.list_admin_user_invitation_state(...)`
- `public.list_ordinary_invitation_administration(...)`

**Defect**

Completion readiness counts archived tasks/deliverables. Incident/finalized views admit archived deliverables/projects. Notification resolver joins can expose live-looking archived titles/navigation. Suppression/invitation administration can expose archived project context.

**Required repair**

- Active readiness/reporting excludes every archived operational target and archived project context.
- Notification history may retain a recipient row, but an archived target must resolve as non-viewable: no title, project context, navigation identifiers, or actionable affordance.
- Invitation administration may retain historical invitation rows, but an archived project must never be presented as active selectable context. Use null/non-actionable project projection if the current contract preserves the historical invitation row.
- Preserve range/cursor contracts, role-safe data shaping, return columns, and role boundaries.

### 5.7 Private authorization and readiness helpers

**Objects**

- `private.is_task_assignee(uuid)`
- `private.is_client_task_assignee(uuid)`
- `private.is_deliverable_assignee(uuid)`
- `private.is_client_submission_assignee(uuid)`
- `private.project_has_client_readiness(uuid)`

**Defect**

These trusted booleans determine assignee/readiness eligibility using only `deleted_at`, allowing archived contexts to remain eligible.

**Required repair**

- Return `false` for archived target or ancestry.
- Task helpers require active task + project.
- Deliverable helpers require active deliverable + task + project.
- Project readiness requires active project.
- Preserve boolean semantics for non-archived rows, owner, security-definer posture, fixed search path, and revoked public execution.

### 5.8 Task and deliverable validation triggers

**Trigger functions and bindings**

- `private.validate_task()` bound by `public.task_validate_trg`
- `private.sync_and_validate_deliverable()` bound by `public.deliverable_sync_and_validate_trg`

**Defect**

The functions accept a non-deleted parent while not rejecting an archived parent. A privileged path could insert/update operational children below archived ancestry.

**Required repair**

- `validate_task`: retrieve project archive state with deletion state and reject an archived parent using the current validation style.
- `sync_and_validate_deliverable`: require active task and active project before synchronization/validation completes.
- Do not recreate either trigger unless its current binding must actually change. Preserve trigger event list, timing, owner, `SECURITY DEFINER`, search path, `NEW` synchronization, and error contract.

### 5.9 Milestone-link, calendar-scope, and version-validation triggers

**Trigger functions and bindings**

- `private.validate_milestone_task_link()` bound by `public.milestone_tasks_validate_scope_trg`
- `private.validate_calendar_event_task_scope()` bound by `public.calendar_events_task_scope_trg`
- `private.validate_production_google_drive_submission_url()` bound by `public.deliverable_versions_validate_production_google_drive_url_trg`

**Defect**

Milestone-task validation omits archive state. Calendar validation checks only non-deleted task and does not require an active project for a task-less event. Deliverable-version validation reads deliverables without archive state.

**Required repair**

- Milestone links require active milestone, active task, and active project.
- Calendar events always require active project; an event with `task_id` requires active task belonging to that project.
- Deliverable version validation requires active deliverable, task, and project before URL/version validation can pass.
- Preserve current trigger binding and existing validation-specific safe error text/shape.

### 5.10 Role-facing views

**Objects**

- `public.client_deliverable_view`
- `public.client_project_view`
- `public.client_submission_view`
- `public.client_task_view`
- `public.operator_agenda_view`

**Defect**

Each filters `deleted_at` but omits `archived_at` for rows and/or parent chain. `client_project_view` exposes archived projects and includes archived deliverable activity; `operator_agenda_view` includes archived task/project/deliverable context.

**Required repair**

- All emitted project/task/deliverable rows must meet active state + parent chain rules.
- `client_project_view`: active project and only active deliverable activity.
- `client_submission_view`: active deliverable + task + project.
- `client_task_view`: active task + project and only active counted deliverables.
- `operator_agenda_view`: active task + project and only active joined deliverables.
- Use `CREATE OR REPLACE VIEW` from exact live definitions; preserve every output column and dependent consumer compatibility.

## 6. M04-specific compatibility requirements

The M04 candidate introduces S10-04 tables/RPCs for bounded account settings, user access administration, exact post-M04 stale-access state, reminder decision evidence, and bug triage. Do not delete, weaken, or silently reinterpret that contract while adding the S10-03 repair.

Required compatibility checks:

1. Existing M04 trusted functions must use `SECURITY DEFINER`, `search_path = pg_catalog, public`, explicit role verification, explicit allowlists, and restrictive grants as written/required.
2. `profiles.is_active = false` is application access deactivation only. No work in this remediation deletes, bans, disables, or otherwise mutates `auth.users`.
3. The stale-access historical baseline remains: every existing profile’s first inactivity period begins at M04 application. Pre-M04 ended membership/assignment history must not be fabricated.
4. The exact post-M04 qualifying events must remain tracked through the migration’s trigger/state design. Do not replace it with a one-time query based on guessed historical timestamps.
5. New M04 tables retain RLS enabled with no direct table grants to browser roles; public access is only through narrow role-safe functions.
6. The S10-03 closure cannot alter permanent-deletion dependency behavior, archive cascade semantics, restore semantics, or the four-item entity allowlist.

## 7. Required implementation sequence

1. Inspect the working tree. Preserve unrelated changes. Confirm whether the candidate M04 file is still untracked and report its status without staging it.
2. Read this specification, `AGENTS.md`, `GEMINI.md`, the full M03 source migration, and the complete candidate M04 source.
3. Build a checklist containing every Section 5 object. Each row must identify: exact signature/view name, local source location, live-source evidence location, applied defect, repaired predicate, and verification result.
4. Obtain exact full current live definitions and trigger bindings by read-only catalog extraction. If Antigravity cannot access the live catalog, it must stop before editing trusted SQL and request the exported source artifact from the Project Owner/Athena. It must not reconstruct definitions from names or this prose specification.
5. Compare live definitions with local migration-chain definitions. Reconcile a difference deliberately; do not overwrite a later deployed correction.
6. Edit only the candidate forward M04 migration to add complete `CREATE OR REPLACE FUNCTION` / `CREATE OR REPLACE VIEW` repairs and any necessary unchanged trigger-function replacement definitions.
7. Preserve transaction ordering: any helper replacement must exist before a dependent function/view is created. Use `CREATE OR REPLACE` for existing functions/views. Do not issue `DROP ... CASCADE`, change an existing function identity signature, or recreate triggers absent a binding change.
8. Review all M04 S10-04 functions for name collisions, relation/type ordering, and object dependencies created by the new remediation statements.
9. Perform local, non-remote SQL validation. If a local Supabase database is available, run an isolated local migration reset/start path only after confirming it cannot touch `jsf-pm-dev`. If unavailable, report the blocker; do not claim parse/application validation.
10. Run the minimum repository verification commands specified in Section 8.
11. Update the candidate file’s scope/status comment only after all checklist rows pass. Do not alter its filename/timestamp.
12. Return the required evidence bundle. Do not apply M04 or regenerate types.

## 8. Required verification and acceptance evidence

### 8.1 Minimum commands

Run only focused checks relevant to this source/documentation work:

```bash
git diff --check
git diff -- supabase/migrations/20260902090000_s10-04-account-access-hygiene-bug-triage-and-s10-03-closure.sql
npm run typecheck
npm run lint
```

If local Supabase is intentionally available and isolated from the remote environment, additionally run the repository’s safe local migration validation/lint path. Report exact commands and actual results. A missing local database is a blocked validation, not a passing result.

### 8.2 Required static SQL review

For every Section 5 object, prove all of the following in the review report:

- archive predicate added for the emitted/mutated direct target;
- active ancestry predicate added wherever applicable;
- no `deleted_at`-only active lookup remains in the targeted operational path;
- existing signature/view-column contract remains compatible;
- `SECURITY DEFINER`, `search_path`, ownership/grant posture, and role check remain at least as restrictive;
- no archived record receives a new comment, status transition, review, submission, version, link report, calendar link, task/deliverable, or milestone link;
- archived context is absent/non-actionable in notification and invitation projections;
- no unrelated function, table, RLS policy, trigger binding, application route, type declaration, or migration history was changed.

### 8.3 Acceptance criteria

This work is complete only when all are true:

- [ ] All 10 Section 5 groups have complete, exact-definition replacements in M04.
- [ ] The M04 source has no `TODO`, `FIXME`, “partial”, “remaining callable”, or “not apply-ready” language relating to unresolved S10-03 archive closure.
- [ ] The M04 source does not edit or depend on changing the already-applied M03 migration.
- [ ] No remote state was changed.
- [ ] No generated database types were changed.
- [ ] `git diff --check` passes.
- [ ] `npm run typecheck` passes, or an unrelated pre-existing failure is shown with exact evidence.
- [ ] `npm run lint` passes, or an unrelated pre-existing failure is shown with exact evidence.
- [ ] The completion report includes the Section 5 checklist and exact live-definition provenance.
- [ ] Athena has independently reviewed the final M04 diff against this specification and the live schema before the Project Owner applies it.

## 9. Explicit non-goals and prohibitions

Do not:

- apply a migration, generate types, modify hosted Supabase state, or use service-role browser access;
- edit, rename, reorder, or delete applied migrations;
- add a separate migration to bypass M04 without Project Owner direction;
- add direct browser access to `profiles`, `user_access_actions`, `user_access_hygiene_state`, `stale_access_reminders`, or `bug_reports`;
- add a generic entity/table name escape hatch;
- make archive or restore a project-status transition;
- change permanent-deletion dependency rules, lifecycle allowlist, retention, audit evidence, or immutable history;
- refactor unrelated TypeScript/UI routes, localizations, dependency versions, configuration, providers, or authentication;
- suppress errors with `any`, broad TypeScript suppressions, disabled lint rules, raw database messages, or broad grants;
- commit, push, merge, or alter branches without separately granted authority.

## 10. Required Antigravity completion report

Return a factual report with these exact sections:

1. **Scope and preserved boundaries** — confirm no remote state, generated types, applied migration, or unrelated implementation changed.
2. **Changed files** — full paths and one-line reason each.
3. **Section 5 remediation checklist** — all 10 groups, exact objects, active predicates/ancestry added, and live source provenance.
4. **M04 compatibility review** — what S10-04 portions were preserved and any fixed compatibility defect.
5. **Verification** — exact command, exit code, and output summary; explicitly distinguish unrun/blocked checks.
6. **Diff review** — `git diff --check` outcome and confirmation that no unexplained source replacement, grant change, signature change, or trigger rebinding occurred.
7. **Known limitations/blockers** — especially lack of full live catalog source or local SQL execution. Do not call the migration ready if either leaves a Section 5 item unresolved.
8. **Athena review request** — identify the final candidate migration path and Git diff range/file so it can be independently reviewed before owner application.

## 11. Handoff and next steps after Antigravity

1. Antigravity completes this specification locally and returns the evidence bundle; it does not apply M04.
2. Athena reads the complete final candidate migration and compares every replacement to current `jsf-pm-dev` definitions with read-only Supabase MCP catalog queries.
3. Athena confirms one of two states:
   - **Ready for owner application:** all mandatory objects are closed, no incompatible change exists, and verification evidence is complete; or
   - **Blocked:** exact remaining object/SQL defect and required correction are stated.
4. Only after an explicit Ready-for-application decision does the Project Owner apply M04 through Supabase MCP.
5. After application, the Project Owner regenerates `src/lib/database.types.ts`, then verifies the migration/version and generated RPC/table types before S10-03 implementation begins.
6. S10-03 implementation uses the applied M03+M04 schema baseline. S10-04 implementation receives its own accepted implementation specification after S10-03 work establishes the intended application seams.
