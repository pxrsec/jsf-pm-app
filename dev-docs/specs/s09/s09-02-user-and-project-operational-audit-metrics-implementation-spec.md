---
document_id: S09-02-USER-PROJECT-OPERATIONAL-AUDIT-METRICS-IMPLEMENTATION-SPEC-01
sprint_id: S09
work_item: S09-02
status: ready-for-owner-migration-application-and-implementation
created_at: 2026-08-26T00:00:00-06:00
branch: feature/metrics-expansion
target_environment: jsf-pm-dev
required_applied_migrations:
  - supabase/migrations/20260826110000_s09_user-scoped-operations-metrics.sql
---

# S09-02 — User and Project Operational Audit Metrics

## 1. Objective

Extend the existing Admin/PM metrics dashboard so authorized operations leaders can identify measurable operational friction by **user**, **project**, or **project plus user**. The dashboard remains an audit and supervision tool: it reports timestamped workflow and notification evidence already owned by the database. It does not infer motivation, “laziness,” productivity quality, attendance, external-message readership, or client satisfaction.

The dashboard must let a permitted Admin or PM answer, with explicit scope and time-range labels:

1. Which users have tasks still unstarted after assignment?
2. How long did assigned users take to make their first recorded task start?
3. How many workflow actions did each user actually perform: task starts/completions, production submissions, client submissions, reviews, and delivery handoffs?
4. How many in-app notifications did each user receive, mark read, leave unread at the selected range endpoint, or leave unread for at least 24 hours?
5. Which projects contain the strongest observable bottleneck signals?
6. For one selected user in one selected project, what was actually recorded without exposing raw audit rows, contact data, provider data, or identifiers?

This work supplements S07 M3/M5; it does not replace, reinterpret, or weaken their existing aggregate/dashboard contracts.

## 2. Authoritative decisions

### 2.1 Roles and project capacities

The only application roles are exactly:

```text
admin | pm | operator | client
```

`pm_lead` and `pm_watcher` are **not** application roles and must never be added to `profiles.role`, invitation-role handling, route guards, navigation-role types, generated-type substitutes, message catalog role labels, or database enums.

They remain `project_members.member_type` capacities held by a `profiles.role = 'pm'` account:

- `pm_lead`: project-level management/review authority already defined by the lifecycle contract.
- `pm_watcher`: project-level supervisory/read capacity. It does not gain lifecycle, review, queue, or administrative mutation authority from access to metrics.

Both PM capacities receive the same read-only metrics dashboard for a project the database proves they may access. This item must not turn Watchers into a fifth role or imply that every PM is a Lead.

### 2.2 Access and scope matrix

| Caller | Project filter | User filter | Permitted result |
| --- | --- | --- | --- |
| Admin | Optional. Omitted means all non-deleted projects; selected means that one project. | Optional. | Global or selected-project user rows. |
| PM Lead | Required. | Optional, limited by the selected project result set. | One database-authorized project only. |
| PM Watcher | Required. | Optional, limited by the selected project result set. | Same read-only project metrics as PM Lead. No queue mutation authority. |
| Operator | None. | None. | Route and RPC denied. |
| Client | None. | None. | Route and RPC denied. |

The browser-provided project/user values are filter candidates only. Route checks, selector option lists, and navigation are defense in depth. The database RPC derives the caller from `auth.uid()` and independently enforces the PM project check using `private.is_project_pm(projectId)`.

Admin selection of a project is permitted for this new user-metrics capability. This intentionally differs from the legacy S07 aggregate M3/M5 Admin dashboard, which remains global-only and unchanged.

## 3. Database migration: required

A database migration is required. Existing M3/M5 projections cannot return person-level operational evidence, cannot accept a user filter, and intentionally make the Admin dashboard global-only. Application-side aggregation or direct base-table access would violate the established RLS/least-privilege boundary and would make the browser an unauthorized metric authority.

### 3.1 Candidate migration

Apply exactly this committed source first:

```text
supabase/migrations/20260826110000_s09_user-scoped-operations-metrics.sql
```

The migration creates one authenticated, `STABLE`, `SECURITY DEFINER`, `postgres`-owned read RPC:

```text
list_scoped_user_operations_metrics(
  p_project_id uuid default null,
  p_user_id uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null
)
```

It also adds only supporting read indexes. It creates no event table, mutable metric snapshot, materialized view, provider integration, scheduler, polling process, RLS bypass in browser code, lifecycle mutation, or role enum change.

### 3.2 Application sequence

1. Project Owner applies the exact committed migration to **`jsf-pm-dev`** through Supabase MCP `apply_migration`.
2. Regenerate `src/lib/database.types.ts` through Supabase MCP and commit the generated artifact unchanged.
3. Only after those two steps, implement this specification against the generated RPC type. Do not hand-edit generated types or compensate for a missing type/RPC with `as`, `any`, direct SQL, direct table reads, or a service-role client.
4. If application or generation fails, stop. Correct only with a reviewed, new forward migration; never modify an applied migration.

## 4. Metric contract and exact semantics

All ranges are explicit half-open intervals: `[from, to)`. Both endpoints are required after server normalization; `from < to`; maximum length is 93 days; canonical default remains latest 90 days in `CALENDAR_TIME_ZONE`. A historical/snapshot distinction must be displayed in supporting copy and must not be blurred.

The RPC returns one row per eligible user. An eligible user is an active project member or a user with scoped task/deliverable assignment, in-app notification, or immutable audit evidence. This preserves auditable historical contributors after a membership change without exposing users outside the selected project scope.

| Returned field | Source and exact meaning | Required display rule |
| --- | --- | --- |
| `user_id` | Internal DTO/filter identity only. | Never render, copy, or log. It may travel only as the opaque, validated `userId` filter value in the canonical metrics URL and selector control; it must never be presented as user-visible content. |
| `full_name` | `profiles.full_name` for a user with permitted scoped evidence. | Render as user label only. Never add email, phone, avatar, Auth identity, or contact data. |
| `application_role` | `profiles.role`; only four canonical roles. | Render localized application role. Never render PM capacities as roles. |
| `is_active` | Current profile activity state. | Render “active” / “inactive” in a non-color-only label. It is not an attendance measurement. |
| `current_active_task_count` | Current non-deleted scoped tasks assigned to the user where current task status is not `completed`, evaluated at query execution. | Label current snapshot, never as a range-created/assigned count. |
| `task_assigned_count` | Current task assignments whose protected `assigned_at` falls inside `[from,to)`. | Label assignment cohort. It is not a complete reassignment-history ledger. |
| `task_started_count` | Immutable `task_status_changed` actions performed by the user in range with `new_status = in_progress`. | Label recorded starts/actions, not “tasks worked.” A Lead/Admin may legitimately perform a transition. |
| `task_completed_count` | Immutable `task_status_changed` actions performed by the user in range with `new_status = completed`. | Label recorded completions/actions, not all tasks currently completed by that user. |
| `average_assignment_to_start_hours` | Average elapsed hours for tasks assigned in range where the current direct assignee performed a first `in_progress` action after `assigned_at` and before `to`. | Null means no eligible assignee-start observation, never 0 hours. Do not call this “time spent working.” |
| `unstarted_task_count_at_range_end` | Current scoped tasks assigned before `to` for which no direct-assignee `in_progress` audit action exists in `[assigned_at,to)`. | Label “no recorded direct-assignee start by range end.” It is a bottleneck signal, not proof that no offline work occurred. |
| `production_deliverable_submission_count` | User-performed immutable `deliverable_version_submitted` actions in range. | Label production submissions recorded. |
| `client_submission_count` | User-performed immutable `client_deliverable_submitted` actions in range. | Label client submissions recorded. |
| `deliverable_review_count` | User-performed immutable `deliverable_reviewed` actions in range. | Label recorded review decisions. This is the PM-facing review workload signal. |
| `deliverable_delivered_count` | User-performed immutable `deliverable_delivered` actions in range. | Label recorded delivery handoffs. |
| `in_app_notification_received_count` | Project-scoped `in_app` recipient rows created in range. | Label in-app notifications received. It excludes email/WhatsApp delivery and does not prove an external provider sent/read a message. |
| `in_app_notification_read_count` | Those recipients with a nonnegative `read_at` before `to`. | Label marked read by range end. It is not proof the contents were understood or work was started. |
| `in_app_notification_unread_count_at_range_end` | Those recipients whose `read_at` is null or not before `to`. | Label unread at range end. Do not substitute “ignored.” |
| `in_app_notification_unread_over_24h_count_at_range_end` | The prior unread cohort created at least 24 hours before `to`. | Label unread for 24+ hours at range end. This is the primary notification-attention bottleneck signal. |
| `average_in_app_notification_read_hours` | Average `read_at - created_at` for valid in-app reads before `to`. | Null is no eligible read observation, never 0 hours. It does not measure notification delivery, push receipt, or work start. |
| `last_workflow_action_at` | Latest scoped immutable audit action performed by user within selected range. | Optional localized “last recorded workflow action” only. Do not turn into presence/attendance score. |

The dashboard must never calculate or label a metric as a percentage, compliance score, productivity score, SLA breach, ranking, “lazy,” “ignored,” or time worked. It may sort a table by the returned counts/durations to triage operational attention. It must preserve null versus zero without coercion.

## 5. Required application architecture

### 5.1 Server-only contract boundary

Add a narrow feature module under:

```text
src/lib/user-operations-metrics/
  types.ts
  schemas.ts
  date-utils.ts
  queries.ts
```

Responsibilities:

- `types.ts`: safe DTOs only; no generated Supabase row type is allowed beyond the server adapter.
- `schemas.ts`: strict UUID and offset-bearing ISO schemas; project/user optionality differs by role; validate `[from,to)` and max 93 days.
- `date-utils.ts`: reuse the established operations-metrics Mexico City range utilities. Do not create a second date/time-zone policy.
- `queries.ts`: `server-only`; call only `list_scoped_user_operations_metrics`, validate every returned row, reject malformed/unknown role/negative count/non-finite numeric/invalid timestamp values, and map to a purpose-limited DTO. Return one generic unavailable state on contract/RPC error; do not log rows or raw RPC errors.

Do not query `audit_logs`, `profiles`, `tasks`, `deliverables`, `notification_events`, or `notification_recipients` from a browser or RSC route. The new RPC is the sole operational-data source for this feature.

### 5.2 Route and URL state

Retain legacy S07 routes and UI intact. Add the new scope to the existing pages rather than creating an unprotected duplicate dashboard:

```text
/admin/metricas?projectId=<optional UUID>&userId=<optional UUID>&from=<ISO>&to=<ISO>
/pm/metricas?projectId=<required UUID>&userId=<optional UUID>&from=<ISO>&to=<ISO>
```

Rules:

1. Admin’s absent `projectId` means all non-deleted projects. An Admin project selector is now required for this user-metrics section; it must use an existing narrow Admin project-option query or a new reviewed role-safe projection, never a broad `select('*')`.
2. PM retains one required project selected from the established membership-scoped `{ id, name }` option list. PM URL state with a project not in that list normalizes to the first deterministic option; database authorization remains decisive.
3. `userId` is optional and may only be offered from the already validated RPC result for the current project/range scope. It is never a free-text UUID field and never persisted as a preference.
4. User selection is cleared whenever project selection changes. Range change retains a selected user only if that ID remains in the newly returned permitted result; otherwise clear it in the next filter navigation.
5. Explicit filter state uses locale-preserving RSC navigation. No client RPC, base-table query, local metric derivation, local storage, all-time option, arbitrary bucket size, CSV export, or background refresh.

### 5.3 Presentation layout

Below existing aggregate M3/M5 sections, add one clearly titled **User operational audit** section with:

1. scope/range statement; Admin: “All projects” or selected project; PM: selected permitted project;
2. project/range/user filter bar, with filters carrying precise accessible labels;
3. attention summary using only these returned fields: unstarted-at-end count and unread-24+-hours count; no new synthetic KPI;
4. sortable user table on desktop and equivalent stacked user cards at narrow widths;
5. selected-user detail panel when `userId` is valid;
6. zero, no-measurement, authority/error, and inactive-person states distinguished truthfully.

The table must show at minimum:

```text
User | Application role | Active state | Current active tasks |
Assigned in range | Recorded starts | Recorded completions |
Avg assignment → direct start | Unstarted by range end |
Production submissions | Client submissions | Review decisions | Delivery handoffs |
In-app received | Marked read | Unread at range end | Unread 24+ hours |
Avg in-app read time | Last recorded workflow action
```

On mobile, headings and values must remain explicit; do not compress field meaning into icon-only cards. All controls must meet the project’s accepted 44px primary target rule. Tables remain semantic; do not use a chart as the sole representation. If a small chart is added, provide an always-visible equivalent table and do not add chart click/drilldown behavior.

### 5.4 Sorting and bottleneck triage

Default row order must match the RPC: unstarted tasks descending, unread-24+-hours descending, then deterministic user name/ID. Client-side sorting is allowed only over already validated, returned DTO fields and only for table presentation. It must not compute a ranking, score, rate, or inferred status.

Permitted sort fields:

```text
name, role, currentActiveTaskCount, unstartedTaskCountAtRangeEnd,
inAppNotificationUnreadOver24hCountAtRangeEnd,
averageAssignmentToStartHours, averageInAppNotificationReadHours,
taskCompletedCount, deliverableReviewCount, lastWorkflowActionAt
```

Null averages sort after numeric values and render “No measured observations.” Zero values are real zero values.

## 6. Privacy, security, and explicit exclusions

- Existing Admin/PM-only route and navigation rules remain mandatory. PM Watcher access is project-scoped read access only.
- No Operator or Client dashboard route, action, navigation item, or RPC adapter call is allowed.
- Do not expose email, phone, auth provider, session state, IP, user agent, request ID, raw audit ID, raw entity IDs, changed-fields JSON, notification payload, delivery channel/provider status, provider error, external recipient data, URLs, token/hash, or project identifiers.
- Do not add mutations: no task/deliverable command, assignment, review, notification marking, resend, escalation, user activation/deactivation, role edit, membership edit, invitation action, or configuration action.
- Do not alter notification provider behavior. In-app `read_at` is the only acknowledgement evidence used here; external delivery remains governed by the existing notification contract.
- Do not modify `profiles.role`, `app_role`, `project_member_type`, invitations, or existing PM Lead/Watcher lifecycle permissions.
- Do not add a raw audit viewer or an arbitrary reporting/export surface.

## 7. Focused verification

### 7.1 Migration application checks (Project Owner)

After MCP application and generated type regeneration, verify from Supabase MCP/catalog evidence:

1. function signature, `STABLE`, `SECURITY DEFINER`, owner `postgres`, and fixed `search_path`;
2. `PUBLIC` and `anon` execute are revoked; only `authenticated` execute is granted;
3. indexes exist with exact predicates;
4. unauthenticated, inactive-profile, Operator, and Client calls are denied;
5. PM Lead and PM Watcher calls succeed only with an authorized selected project and deny absent/foreign projects;
6. Admin succeeds globally and with a selected project;
7. 93-day maximum, partial range, and inverted range are rejected;
8. no mutation occurs after read calls.

### 7.2 Application-focused tests

Add focused tests only for the new contract:

1. server adapter calls exact RPC parameter shape for Admin global, Admin project, PM project, and optional user filter;
2. adapter rejects malformed rows, unknown roles, negative counts, invalid/null-required numeric values, malformed timestamps, and range mismatch;
3. null average remains null; zero count remains zero; unread counts are never rendered as “ignored”;
4. PM Watcher is treated as `role === 'pm'` and needs a permitted project—never a `pm_watcher` app role;
5. URL normalization clears invalid user/project state and preserves valid range state;
6. route tests deny Client/Operator and redirect wrong authenticated roles;
7. Spanish/English message catalogs contain exact semantic parity for every new key;
8. table/card rendering covers zero, no-observation, inactive user, selected-user, and generic unavailable states.

Run only focused tests plus the current repository typecheck/lint commands required by `package.json`. Do not claim database authorization proof from mocked application tests. Record exact commands and real results in the implementation evidence.

## 8. Completion criteria

This item is complete only when:

1. the approved migration is applied to `jsf-pm-dev` and types are MCP-regenerated;
2. Admin can audit all users globally or filter the user audit section by project and optionally by user;
3. PM Lead and PM Watcher can audit one database-authorized project and optionally one user in that scope;
4. PM Lead/Watcher remain PM application users; no distinct watcher/lead role exists;
5. all metrics follow the exact semantics and limitations in Section 4;
6. every UI state is localized, accessible, and truthful about zero/null/snapshot/range evidence;
7. browser code receives only validated purpose-limited DTOs;
8. no raw audit/provider/identity details or unauthorized role capability is introduced;
9. focused migration and application verification evidence is recorded with actual outputs.
