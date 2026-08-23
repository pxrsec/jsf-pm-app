---
document_id: S07-01-E09-CAPABILITY-MAP-01
sprint_id: S07
work_item: S07-01
status: completed
source_plan: dev-docs/specs/s07/s07-e09-visibility-reporting-and-operational-administration-demo-completion-sprint-plan.md
reconciled_at: 2026-08-23T15:06:08-06:00
target_environment: jsf-pm-dev
---

# S07 E09 Capability Contract Mapping Reference

## 1. Purpose and authority

This is the repository-local implementation map required by S07-01. It reconciles the S07 plan against the current repository migration chain, committed generated types, and read-only `jsf-pm-dev` catalog inspection. It is the controlling handoff for authoring S07-M1, S07-M2, and S07-M3; it does not apply migrations or alter remote state.

Authority remains: Project Owner direction, accepted E08 provider-deferral posture, repository migration sources/current applied catalog, repository OpenAPI contract, and the S07 plan. The current OpenAPI file contains legacy/unimplemented calendar and operations declarations; the reconciliation disposition appears in Section 8. When a later migration or route contract conflicts with this map, stop and update the governing contract rather than silently changing application behavior.

## 2. Baseline and resolved migration order

### 2.1 Current database baseline

`jsf-pm-dev` has all existing E09 source entities with RLS enabled: calendar events, projects, tasks, deliverables, immutable versions, link reports, audit logs, notification records, profiles, invitations, and memberships. Existing `calendar_feed_view`, `deliverable_cycle_metrics_view`, and `project_completion_cycles_view` are `security_invoker` views.

The latest applied S07 migration is:

```text
20260823130000_s07_m0_security_definer_command_hardening
```

The original M1–M3 proposed filenames sorted before that already-applied source. They are superseded by the following forward-only filenames:

```text
supabase/migrations/20260823140000_s07_e09_calendar-role-safe-feed-and-milestones.sql
supabase/migrations/20260823141000_s07_e09_finalized-production-archive-and-link-incidents.sql
supabase/migrations/20260823142000_s07_e09_scoped-operations-metrics-and-admin-projections.sql
```

### 2.2 Required application order

1. Review committed M1 source, apply only to `jsf-pm-dev`, generate types unchanged, and record provenance.
2. Repeat for M2.
3. Repeat for M3.
4. Dependent application work consumes only the generated types and functions actually applied.

M1–M3 do not create provider activation, scheduler, Realtime, materialized metrics, browser service-role access, external URL dereferencing, or public table access.

## 3. Shared role and data-boundary facts

| Capability | Existing authoritative predicate | S07 interpretation |
| --- | --- | --- |
| Admin | `private.is_admin()` | Global read/mutation only where the command permits it. |
| PM Lead | `private.is_project_lead(project_id)` | Active lead of the target project; mutation-capable only for explicitly permitted commands. |
| PM Watcher | `private.is_project_pm(project_id)` plus membership capacity check | Project-scoped read-only. Never receives milestone, queue, user, or administrative mutation authority. |
| Operator | direct `tasks.assignee_id = auth.uid()` / `deliverables.assignee_id = auth.uid()` | Own-work only; no project-wide visibility inferred from membership. |
| Client | `private.is_project_client(project_id)` and direct client-task/client-submission assignment where required | Client-safe project context only; no internal review, operations, queue, or another client’s direct work. |

All new public RPCs must be postgres-owned `SECURITY DEFINER`, fix `search_path = pg_catalog, public`, revoke `PUBLIC` and `anon`, grant `authenticated` only where the user-facing contract needs it, use caller-derived authorization before privileged effects, and expose only purpose-limited output. `service_role` is not a substitute for session authorization and is not required for ordinary S07 UI reads.

## 4. Calendar and milestones — M1 map

### 4.1 Existing source inventory

`public.calendar_feed_view` currently unions these non-deleted records without a bounded range or role-specific composition:

1. project deadline — `projects.deadline_at`;
2. task deadline — `tasks.deadline_at`;
3. production internal-review deadline — `deliverables.internal_review_deadline_at`;
4. production client-delivery deadline — `deliverables.client_delivery_deadline_at`;
5. direct client-submission deadline — `deliverables.submission_deadline_at`;
6. manual milestone — `calendar_events`.

`calendar_events` is the correct manual-milestone table. It has title, description, range timestamps, all-day flag, color override, actor/timestamps, and soft deletion. Its current RLS allows every active project member to select manual events and allows Admin/PM Lead direct insert/update. That is broader than the new Operator/Client feed and insufficient for input constraints/audit-only mutation behavior.

No calendar route, query module, action, or calendar-specific tests exist. Existing safe project/task/deliverable routes and the operator agenda are the source-route baseline, not reusable calendar authorization.

### 4.2 M1 contract to implement

Replace application consumption of `calendar_feed_view` with an authenticated, range-bounded RPC. The exact public function name is `list_role_safe_calendar_events` and its contract is:

```text
Inputs:
- p_from timestamptz, required
- p_to timestamptz, required
- p_project_id uuid, nullable project filter

Output columns:
- entity_id uuid
- project_id uuid, nullable only when the caller cannot navigate safely
- title text
- event_type calendar_event_type
- starts_at timestamptz
- ends_at timestamptz
- is_all_day boolean
- color_override text

Validation:
- authenticated active caller required;
- p_from < p_to;
- range must be at most 93 days;
- overlap semantics: starts_at < p_to and coalesce(ends_at, starts_at) >= p_from;
- deterministic order: starts_at ASC, event_type ASC, entity_id ASC.
```

The function must compose every allowed event exactly once. It must not copy a deadline into `calendar_events`.

| Caller | Included calendar rows | Explicit exclusions |
| --- | --- | --- |
| Admin | all non-deleted project, task, production review/delivery, client-submission, and manual-milestone rows | none beyond deleted/out-of-range rows |
| PM Lead | same sources only for active lead projects | other projects |
| PM Watcher | same sources only for active watcher/lead projects, read-only | milestone mutation and other projects |
| Operator | task deadlines for `tasks.assignee_id = auth.uid()` and deadline rows for production deliverables assigned to the caller | project deadline, other assignees, all manual milestones, client submissions not assigned to caller, membership roster/context |
| Client | project deadline for active client-member projects; direct assigned `client_request` task deadlines; direct assigned `client_submission` deadlines; production client-delivery deadlines already visible to that client-project membership | internal-review deadlines, manual milestones, other clients’ direct tasks/submissions, provider/queue details |

`project_id` is returned only when the same row policy permits navigation to that project. The application must independently enforce destination authorization before deep linking.

### 4.3 Milestone command boundary

M1 creates three authenticated, actor-derived commands:

```text
create_calendar_milestone(project_id, title, description, starts_at, ends_at, is_all_day, color_override)
update_calendar_milestone(event_id, title, description, starts_at, ends_at, is_all_day, color_override)
soft_delete_calendar_milestone(event_id)
```

They must:

- permit only Admin or active PM Lead on the target event/project;
- force `event_type = 'milestone'` and reject updates to another event type;
- require trimmed title length 1–160;
- accept nullable trimmed description up to 2,000 characters;
- require non-null start and `ends_at >= starts_at` when supplied;
- constrain color override to `NULL` or the finite design-system token set `chart-1`, `chart-2`, `chart-3`, `chart-4`, `chart-5`; the application maps these tokens to theme-aware styles and never accepts CSS/color literals;
- derive `created_by`/`updated_by` from `auth.uid()`;
- soft delete only; never hard delete;
- insert safe audit facts for create/update/delete without descriptions or provider-facing effects;
- return a safe event DTO or boolean/no-op outcome; and
- revoke direct authenticated DML on `calendar_events` after the command boundary is in place, while preserving required table access for controlled server/operational use.

### 4.4 M1 index contract

Candidate index, subject to exact applied-function `EXPLAIN (ANALYZE, BUFFERS)` on a representative sandbox range:

```sql
(project_id, starts_at) where deleted_at is null
```

The existing `calendar_events(project_id)` index does not cover project-plus-range ordering. No other calendar index may be added without the applied query shape and plan evidence.

## 5. Finalized production archive and link incidents — M2 map

### 5.1 Existing source inventory

`deliverables`, `deliverable_versions`, and `deliverable_link_reports` are existing authoritative records. A finalized archive table must not be created. The current `client_deliverable_view` is not archive-safe because it includes `awaiting_client_review` and `changes_requested`, feedback history, specifications, and fields beyond the S07 archive contract.

Current row access already supports the base fact pattern: production deliverables are visible to an authorized Client at eligible review/final states; a direct assignee can see their own deliverable; project PM access includes Watchers; and link-report RLS permits Admin/PM read with a narrower report/assignee rule. These policies do not provide the required purpose-limited archive or incident response DTOs.

### 5.2 Project Owner decision — Operator archive

**Accepted for M2:** Operators may view a standalone archive only for finalized production deliverables assigned directly to them. The archive must not reveal project-wide delivery history, other assignees, feedback, audit data, client data, or operations incidents.

### 5.3 M2 contracts to implement

Create `list_finalized_production_archive` with bounded project/status/date filters and keyset pagination. It returns only:

```text
- deliverable_id
- project_id only when the caller can navigate to the project
- deliverable_title
- final_status: approved | delivered
- current_version_number
- finalized_at: coalesce(delivered_at, approved_at)
- project_name
- project_drive_folder_url only where current project context makes it legitimate
- current_submission_url as deliberate outbound/copy value
```

It excludes all soft-deleted rows, all `client_submission` workflow rows, and every non-final status. It must reject a requested status other than `approved` or `delivered`, constrain a supplied date range, and sort keyset rows by `finalized_at DESC, deliverable_id DESC`.

Authorization is:

- Admin: all final production records.
- PM Lead/Watcher: final production records in active project scope, read-only for Watcher.
- Client: final production records in active client-member project scope that are already client-safe.
- Operator: only `deliverables.assignee_id = auth.uid()` final production records; no project-wide archive.

Create a distinct `list_role_safe_link_incidents` contract for Admin and active PM project scope, including PM Watchers read-only. It returns safe deliverable/project context, incident status, reported/resolved timestamps, reason, and resolution note. It does not return reporter identity, contact information, raw version metadata, or provider data. Client and Operator are denied.

No resolution mutation is included in M2: no existing constrained resolution RPC was found, and direct table updates would be a new operations policy. S07-03 may consume the read model only unless a later approved scope adds an audited command.

### 5.4 M2 index contract

Potential indexes require applied function plans. The existing indexes do not cover the final-status date keyset shape. Candidate review targets are:

- non-deleted production finalized deliverables by project and terminal timestamp;
- unresolved link-report joins through existing `deliverable_id` index.

No index is authorized purely for an Advisor suggestion or current small demo-cardinality assumption.

## 6. Metrics, administration, audit, and user/invitation projections — M3 map

### 6.1 Existing source inventory

- `deliverable_cycle_metrics_view` derives review-cycle data from deliverable/audit facts and correctly returns null when a client-action denominator is absent.
- `project_completion_cycles_view` derives completion/reopen cycles from audit facts.
- `list_suppressed_notification_operations` already provides an Admin/active-PM-Lead-only safe, keyset-paginated queue summary. M3 must consume it, not recreate it.
- `list_my_in_app_notifications` is self-only; M3 must not repurpose it as an operations feed.
- Audit table RLS is Admin-only but direct table shape contains IP, user agent, request ID, raw JSON, and actor IDs, so it cannot be exposed directly.
- Existing profile/invitation tables contain fields deliberately outside S07 safe output: phone, consent/IP/source, token hash, invitation email, and other raw state. Direct table exposure is prohibited.
- `src/lib/notifications/config.ts` is server-only and returns typed capability state without returning values. It is the existing basis for later Admin diagnostics.

No Admin user directory, bounded Admin audit route, operational metric route, safe invitation-state projection, or configuration diagnostics route currently exists. Existing Admin/PM work is limited to project and notification-operations routes.

### 6.2 M3 read contracts

M3 creates these authenticated read boundaries:

1. `get_scoped_operations_metrics(p_project_id uuid default null, p_from timestamptz default null, p_to timestamptz default null)`
   - Admin: global, or a requested project.
   - PM Lead/Watcher: only a requested active-member project; no global aggregate.
   - Client/Operator: denied.
   - Returns only aggregate cards/series required by S07: project count by status; active task/deadline attention; production deliverable count by status; finalized count; null-safe client-review duration aggregate; completion/reopen count and duration aggregate; unread/suppressed queue aggregates only in the existing authorized scope; unresolved link-report count.
   - Distinguishes no denominator/null cycle data from zero. No raw audit rows, recipient data, or browser-owned calculation.

2. `list_admin_audit_history(p_from timestamptz, p_to timestamptz, p_before_created_at timestamptz default null, p_before_audit_id bigint default null, p_limit integer default 25)`
   - Admin only; defaults to a 90-day window and rejects ranges over 93 days.
   - Keyset order: `created_at DESC, id DESC`.
   - Returns safe audit ID, timestamp, action, entity type, route-safe entity identifier, project-safe context, actor role, old/new status, and a whitelist-generated changed-field summary.
   - Never returns actor ID, IP, user agent, request ID, raw JSON, contact data, secret-related data, or arbitrary JSON keys.

3. `list_admin_user_invitation_state(p_before_created_at timestamptz default null, p_before_profile_id uuid default null, p_limit integer default 25)`
   - Admin only; keyset-paginated user operational state.
   - Profile output: profile ID, full name, application role, active flag, preferred locale, email-notification preference, WhatsApp opt-in boolean, and created/last-seen timestamps.
   - Invitation output: opaque invitation ID, application role, project-safe context only where applicable, invitation status, created/expiry/accepted/revoked timestamps.
   - Excludes every email/phone value, raw token/hash, accepted-by identity, consent/IP/source, session/authentication value, provider field, and arbitrary metadata.

### 6.3 Explicit M3 mutation disposition

S07 user/invitation administration is **state-only**. No profile activation/deactivation, role edit, deletion, password/session control, token display, raw email disclosure, invite resend claim, or direct Supabase Auth administration command is authorized in M3.

There is no current constrained activation/deactivation RPC and no accepted reason to introduce one in S07. Existing invite acceptance remains unchanged. Any future activation/deactivation or invitation-lifecycle mutation needs its own accepted operation contract, audit behavior, and security review.

### 6.4 M3 index and diagnostic disposition

- Existing `audit_logs_project_idx`, `audit_logs_entity_idx`, S06 notification keyset indexes, deliverable/task project-status indexes, and link-report/deliverable indexes are baseline candidates.
- M3 may add an audit-history `(created_at DESC, id DESC)` index or aggregate-supporting index only after the exact functions are applied to a representative sandbox corpus and `EXPLAIN (ANALYZE, BUFFERS)` demonstrates it is needed.
- The configuration-presence diagnostic is application-only and server-only. It consumes a closed DTO derived from `getExternalDeliveryCapability()` and demo posture; database migration M3 does not read environment variables, add configuration tables, or activate anything.

## 7. Route, module, and test inventory

| Area | Existing baseline | S07 destination |
| --- | --- | --- |
| Calendar | no route/module; generic view only | S07-02 adds calendar query/action/route families backed exclusively by M1 RPCs |
| Archive | project deliverable views and client deliverable routes; no archive surface | S07-03 consumes M2 archive RPC; no reused broad `select` query |
| Link incidents | report dialog/action and base table; no operations list | S07-03 consumes M2 read-only incidents projection |
| Notification history | `/notificaciones`, self-only keyset RPC/actions | S07-04 adds default 90-day filter without exposing queue data |
| Notification operations | `/admin/notificaciones`, `/pm/notificaciones`, server authorization + S06 RPC | S07-04 consolidates existing modules; M3 does not duplicate queue logic |
| Metrics | existing views, project completion display | S07-05 consumes M3 aggregate RPC and builds accessible table alternatives |
| Admin state/audit | Admin project routes only | S07-06 consumes M3 safe audit/user/invitation RPCs and server-only diagnostics |
| Locale/accessibility | `next-intl` protected route structure and existing RTL/Vitest suites | each S07 route requires `es-MX`/`en-US` parity, accessible non-chart alternative, and denied-role coverage |

Required future tests are database-contract/static function tests plus live development RLS/role evidence. Component tests alone cannot prove the database role boundary.

## 8. OpenAPI reconciliation and contract-adoption trigger

The repository contract at `contracts/openapi/jsf-pm-api.openapi.yaml` is authoritative for public/server interface vocabulary but predates the reconciled S07 data boundary. It must be reconciled before any S07 HTTP route/action vocabulary is implemented; it does **not** authorize a browser to call raw PostgREST tables or change the database migration boundary.

| Existing declaration | Reconciliation disposition |
| --- | --- |
| `GET/POST /api/v1/projects/{project_id}/calendar-events` | Retain the concept, but revise its response/request schemas to M1’s 93-day range, 1–160 title, 2,000-character description, nullable `chart-1`–`chart-5` token, role-safe event composition, and actor-derived mutation semantics. The existing 180-character, 10,000-character, hex-color schema is superseded for S07. |
| `GET /api/v1/metrics/projects` | Retain as the possible M3 metrics vocabulary only after its schema is revised to the scoped aggregate DTO, null/no-data semantics, and Admin versus PM project-scope authorization in this mapping. |
| `GET /api/v1/admin/health` | Retain as the possible S07-06 diagnostics vocabulary only after it maps the existing server-only capability parser to the closed display states. It must not expose lower-level configuration codes, variable names, or values. |
| S07 finalized archive, link incidents, Admin audit history, and safe user/invitation state | No current OpenAPI operation defines these contracts. Add operations and schemas only when S07 implementation introduces actual same-origin API endpoints. If S07 uses server actions/RSC-only modules instead, retain the DB function and TypeScript server contracts without inventing public HTTP endpoints. |

**Adoption trigger:** before S07-02 through S07-06 adds or changes a same-origin route/action endpoint. The migration author may proceed with M1–M3 database contracts because they are internal role-safe RPC boundaries; any later API route must consume the applied generated types and the reconciled OpenAPI declaration.

## 9. Known conflicts resolved and remaining stop conditions

### Resolved

- **Migration timestamps:** superseded with forward filenames after M0.
- **Operator archive:** approved own-assigned finalized production records only.
- **User administration scope:** state-only; no new profile activation/deactivation or Auth admin control.
- **Current generic calendar feed:** not consumed by new S07 routes; M1 provides the role-safe replacement.

### Remaining stop conditions

1. **Color-token contract: resolved.** M1 accepts only `NULL`, `chart-1`, `chart-2`, `chart-3`, `chart-4`, or `chart-5`; no CSS or arbitrary color literal is stored or returned as a user-controlled style.
2. Each candidate index requires the exact function query and `EXPLAIN (ANALYZE, BUFFERS)` evidence in `jsf-pm-dev`; do not pre-add index guesses.
3. If any archive safe field or deep link cannot be independently authorized by the application route, omit that identifier/link from the DTO.
4. If M3 metrics needs any fact outside the defined existing views/current-state/approved aggregate sources, stop for an authority decision; do not create a materialized store or raw audit export.

## 10. Migration-authoring readiness

M1, M2, and M3 have deterministic read/mutation boundaries, exact forward source paths, resolved Operator archive scope, and a finite milestone color-token contract. Candidate sources were authored on 2026-08-23 and remain unapplied pending independent exact-SQL review, static source-contract coverage, live baseline reconciliation, and an explicit development-application decision. No generated types or application code may consume these contracts until they are applied to `jsf-pm-dev` and generated types are regenerated.
