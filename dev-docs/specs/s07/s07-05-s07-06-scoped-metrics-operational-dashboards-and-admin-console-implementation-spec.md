---
document_id: S07-05-S07-06-SCOPED-METRICS-OPERATIONS-ADMIN-CONSOLE-IMPLEMENTATION-SPEC-01
sprint_id: S07
work_items: [S07-05, S07-06]
status: ready-for-m5-application-and-implementation-plan
created_at: 2026-08-24T11:00:00-06:00
source_plan: dev-docs/specs/s07/s07-e09-visibility-reporting-and-operational-administration-demo-completion-sprint-plan.md
mapping_reference: dev-docs/specs/s07/s07-e09-capability-contract-mapping-reference.md
target_environment: jsf-pm-dev
required_applied_migrations:
  - 20260823142000_s07_e09_scoped-operations-metrics-and-admin-projections.sql
  - 20260824110000_s07_e09_scoped-operations-metrics-trend-projection.sql
---

# S07-05 and S07-06 — Scoped Metrics, Accessible Operational Dashboards, and Safe Administration Implementation Specification

## 1. Purpose, scope, and implementation baseline

This repository-local implementation specification completes the final two S07 feature items in the persistent `jsf-pm-dev` localhost demonstration environment:

1. **S07-05 — Scoped metrics and accessible operational dashboards.** Admin receives a global, range-bounded operational dashboard. PM users receive the same class of read-only dashboard only for one active project selected from their already-authorized project scope. The dashboard turns the applied authoritative aggregate contracts into useful operational summaries without fabricating trends, browser-owned metric authority, an unbounded history query, or a client-side all-project data load.
2. **S07-06 — Admin console, safe user/invitation state, and diagnostics.** Admin receives one read-only operational console for safe operational state: attention metrics, bounded audit history, profile/invitation state, existing suppressed-delivery operations, link-incident and archive entry points, and a closed server-derived local capability posture. PM receives a limited operations summary that reuses only the metrics and existing queue destinations it is independently authorized to access. No screen becomes a Supabase Auth console, provider console, role editor, lifecycle bypass, or configuration editor.

This specification is the complete direct input for an implementation plan. It deliberately defines exact data sources, route authority, DTOs, filters, pagination, rendering states, navigation, accessibility, diagnostics, and minimal verification so no implementation planner has to infer a security or product decision.

At implementation time, these migrations are assumed **already applied to `jsf-pm-dev`**, with `src/lib/database.types.ts` regenerated unchanged via Supabase MCP and committed:

```text
20260823142000_s07_e09_scoped-operations-metrics-and-admin-projections.sql  (M3)
20260824110000_s07_e09_scoped-operations-metrics-trend-projection.sql      (M5)
```

M5 is a required forward migration authored with this specification at:

```text
supabase/migrations/20260824110000_s07_e09_scoped-operations-metrics-trend-projection.sql
```

### 1.1 Why M5 is required

M3 supplies one range aggregate row through `get_scoped_operations_metrics`. It is sufficient for cards, status distributions, review/completion summaries, and attention counts, but it cannot truthfully produce the sprint-plan-required trend visualization because it contains no time series. M5 adds exactly one bounded, read-only trend RPC. It does **not** change M3, create a table/view/index, mutate a record, expose raw audit history, broaden role scope, or introduce a scheduler/materialized metric store.

M5 returns at most 14 deterministic seven-day buckets for the allowed maximum 93-day range. Its buckets are half-open and anchored to the explicit selected range rather than a database session time zone. This makes the displayed trend stable for the selected range and prevents an unapproved browser/calendar-week metric authority.

No additional migration is required for S07-06. M3 already provides the required safe read contracts. S07-06 is deliberately a **read-only administration and diagnostics surface**; it does not add invitation creation, revocation, resend, profile activation/deactivation, user deletion, role editing, membership editing, or Auth administration.

### 1.2 Authority order

Apply authority in this order:

1. Direct Project Owner direction, including the explicit instruction to minimize test overhead.
2. This S07-05/S07-06 specification.
3. The reconciled S07 sprint plan and mapping reference.
4. The applied M3/M5 contracts and untouched MCP-generated `src/lib/database.types.ts`.
5. `AGENTS.md`, `GEMINI.md`, and current nearby repository conventions.
6. General framework guidance.

A migration signature, generated type, grant, view field, or route convention that differs from this specification is a stop condition. Do not compensate with direct table access, a service-role client, guessed casts, a browser query, or a hidden UI control.

## 2. Non-negotiable boundaries and explicit exclusions

### 2.1 Shared boundaries

- Spanish is canonical on unprefixed protected routes; English is under `/en/`. Every visible string, table heading, chart summary, status, validation error, live announcement, empty/error state, tooltip, and accessible name requires exact semantic-key parity in `messages/es-MX.json` and `messages/en-US.json`.
- Use App Router, RSC-first pages, `@supabase/ssr`, `requireSession`, typed server-only feature modules, Zod at untrusted server boundaries, and locale-preserving `@/i18n/routing` links.
- `profiles.role` is the application role. `pm_lead` and `pm_watcher` are project membership capacities. The S07-02 calendar-only PM exception does not apply here.
- M3/M5 `SECURITY DEFINER` RPC actor derivation and database authorization are the data authority. Route checks, navigation visibility, and project selectors are defense in depth only.
- Do not use `select("*")`, raw generated database rows in presentation, browser Supabase clients, service-role access, direct base-table/view access for metrics/audit/user state, raw RPC errors, raw audit JSON, or console logging of returned operational rows.
- The implementation must stay below the repository 400-line file guideline. Split by contract, query, presentational section, and interaction leaf rather than creating one large dashboard component.

### 2.2 Explicitly out of scope

Do not add or imply:

- external email/WhatsApp dispatch, Resend/Meta/QStash/Workflow activation, provider account setup, webhook, receipt, retry, replay, requeue, sender/template management, scheduler, polling, Realtime, or provider health check;
- public or same-origin API routes, OpenAPI changes, CORS changes, browser PostgREST/base-table access, service workers, caching, offline queueing, CSV export, or arbitrary reporting;
- a materialized view, persisted aggregate table, background refresh, cron job, browser-derived source-of-truth computation, or client loading of raw audit rows to calculate metrics;
- Admin or PM mutation through these dashboards: no project/task/deliverable lifecycle command, no incident resolution, no notification replay, no manual alert evaluator relocation, and no archive mutation;
- an invitation create/revoke/resend action, profile activation/deactivation, password/session management, user deletion, role change, project membership change, client-contact visibility, phone/email display, raw authentication metadata, or Supabase Auth Admin API use;
- environment-variable names, raw values, secret presence/length, provider response/error text, endpoint URL, recipient address/phone, deployment/provider availability, or a diagnostic control that changes configuration;
- broad new TDD ceremony, Playwright, snapshots, fake provider fixtures, or duplicate RLS/component test matrices.

## 3. Applied database contracts

Application code consumes only the following RPCs through narrow server-only adapters. It does not query source tables or views directly.

### 3.1 M3 aggregate metrics: `get_scoped_operations_metrics`

```text
get_scoped_operations_metrics(
  p_project_id uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null
)
```

M3 returns one row with:

```text
project_counts_by_status jsonb,
active_task_count bigint,
overdue_task_count bigint,
deadline_attention_count bigint,
production_deliverable_counts_by_status jsonb,
finalized_deliverable_count bigint,
client_review_cycle_count bigint,
average_client_review_hours numeric nullable,
completion_cycle_count bigint,
reopening_cycle_count bigint,
average_completion_cycle_duration_days numeric nullable,
unread_in_app_queue_count bigint nullable,
suppressed_external_queue_count bigint nullable,
unresolved_link_report_count bigint,
range_from timestamptz,
range_to timestamptz
```

#### M3 authorization and scope

| Caller | Required inputs | Database result | UI consequence |
| --- | --- | --- | --- |
| Admin | Explicit `p_from`, `p_to`; `p_project_id` omitted | Global non-deleted project scope. | Admin dashboard is global. Do not render an Admin project selector because M3 is global by design. |
| PM Lead | Explicit project UUID from an already-authorized selector plus explicit range. | One permitted project only when `private.is_project_pm(projectId)` succeeds. | Read-only PM project dashboard. |
| PM Watcher | Same as PM Lead. | One permitted project only when `private.is_project_pm(projectId)` succeeds. Queue aggregate values are null unless the caller independently has lead authority. | Same metrics read view; do not show queue counts as zero. |
| Operator / Client | Any inputs. | Database denial. | No route, selector, navigation item, or server-action access. |

An input project UUID is a filter candidate, never permission. PM may not treat membership-query output as authorization proof; M3 proves scope on every call.

#### M3 metric semantics — render exactly, do not reinterpret

| Output | Meaning | Required display rule |
| --- | --- | --- |
| `project_counts_by_status` | Current count of non-deleted scoped projects grouped by current project status. It is not historical status movement. | Render a current-status distribution with zero omitted from the returned JSON, plus accessible table rows for every known project status including zero. |
| `active_task_count` | Current scoped non-deleted tasks where status is not `completed`, evaluated at query execution. It is a snapshot, not a range total. | Render as current attention summary; never label it “tasks created in range.” |
| `overdue_task_count` | Current non-completed scoped tasks whose deadline is before database `statement_timestamp()`. | Render as current overdue attention, not historical overdue events. |
| `deadline_attention_count` | Current non-completed scoped tasks whose deadline falls in `[range_from, range_to)`. | Render as upcoming/in-range attention. Do not add client-side time calculations. |
| `production_deliverable_counts_by_status` | Current scoped non-deleted production deliverables grouped by current status. | Render as current status distribution, separate from finalized-in-range count. |
| `finalized_deliverable_count` | Scoped production deliverables in status `approved`/`delivered` with `coalesce(delivered_at, approved_at)` in `[range_from, range_to)`. | Render as range finalizations. It is not all-time finalized inventory. |
| `client_review_cycle_count` | Production cycle-metric rows with non-null client-review duration and `client_acted_at` in range. | Render together with the average only when count is nonzero. |
| `average_client_review_hours` | Arithmetic average of non-null client-review hours for the above count; null when there is no eligible denominator. | Null is **no completed review cycle data**, never 0 hours or “instant.” |
| `completion_cycle_count` | Completion-cycle rows whose `completed_at` falls in range. | Render as completed project cycles in range. |
| `reopening_cycle_count` | Of the completion-cycle rows counted above, rows with a non-null `reopened_at`. | Label “completed cycles later reopened”; do not label it “reopen events in range.” |
| `average_completion_cycle_duration_days` | Average duration of completion-cycle rows counted above; null when no eligible row exists. | Null is **no completed-cycle duration data**, never 0 days. |
| `unread_in_app_queue_count` | Current unread in-app notification-recipient count only when queue authority succeeds. | `null` means unavailable by authority, not zero. Render “Not available for this access level” for PM Watcher. |
| `suppressed_external_queue_count` | External recipient rows suppressed in range only when queue authority succeeds. | `null` means unavailable by authority, not zero. When non-null, preserve terminal-suppression wording; it does not mean failed/pending delivery. |
| `unresolved_link_report_count` | Current scoped link reports with status `open`. | Render current unresolved incident count and link only to independently authorized incident screens. |

The adapter must project JSON distributions into a **closed finite status record**. It must reject any unknown key, negative/non-safe integer, non-object JSON, array JSON, or malformed numeric return. Missing known keys normalize to `0`; this is valid because PostgreSQL `jsonb_object_agg` omits groups with no records. Unknown keys fail closed because they indicate contract drift.

Known project statuses must be taken from the current generated `project_status` enum. Known production deliverable statuses must be taken from the generated `deliverable_status` enum, while the dashboard only displays the statuses returned for production records. Do not hand-maintain an expanded enum list that can drift from generated types.

### 3.2 M5 metric trend: `list_scoped_operations_metric_trend`

```text
list_scoped_operations_metric_trend(
  p_project_id uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null
)
```

M5 returns zero or more ordered rows:

```text
period_start timestamptz,
period_end timestamptz,
finalized_deliverable_count bigint,
client_review_cycle_count bigint,
completion_cycle_count bigint,
reopening_cycle_count bigint
```

For every valid non-empty range, M5 returns one row for each seven-day bucket and therefore never uses a missing row to communicate a zero. The final bucket can be shorter than seven days. Every bucket is `[period_start, period_end)`; the first starts at explicit `p_from`, the last ends exactly at explicit `p_to`. The maximum 93-day query returns at most 14 rows.

M5 scope/authorization is intentionally the same as M3: active non-deleted application profile required; Admin global with omitted project; PM requires one database-authorized project; Client/Operator denied. M5 is read-only, `STABLE`, `SECURITY DEFINER`, `postgres`-owned, uses `search_path = pg_catalog, public`, revokes `PUBLIC`/`anon`, and grants only `authenticated` execution.

Trend semantics are deliberately narrow:

- `finalized_deliverable_count`: terminal production deliverables finalized in the bucket;
- `client_review_cycle_count`: production review cycles with non-null client-review duration where client action is in the bucket;
- `completion_cycle_count`: completion cycles completed in the bucket;
- `reopening_cycle_count`: among completion cycles completed in that bucket, cycles that later have a non-null `reopened_at`.

Do not call `reopening_cycle_count` “reopen events during this week.” It is a completion-cohort property. Do not extrapolate a rate from it when `completion_cycle_count = 0`.

### 3.3 M3 Admin audit history: `list_admin_audit_history`

```text
list_admin_audit_history(
  p_from timestamptz,
  p_to timestamptz,
  p_before_created_at timestamptz default null,
  p_before_audit_id bigint default null,
  p_limit integer default 25
)
```

Only Admin is authorized. It returns only:

```text
audit_id, created_at, action, entity_type, entity_id nullable,
project_id nullable, project_name nullable, actor_role nullable,
old_status nullable, new_status nullable, changed_field_summary nullable
```

The adapter sends explicit range values, requests 26 rows, retains 25, validates every row, and derives the next cursor from retained row 25 only. It validates a complete paired `{ beforeCreatedAt, beforeAuditId }` cursor or no cursor, IDs/timestamps/enums, nullable safe strings, and a nonnegative safe-integer audit ID. It exposes no raw `changed_fields`, `actor_id`, IP, user agent, request ID, contact information, token/hash, provider data, or arbitrary entity detail.

Audit history is a bounded accountability stream, not a reporting export or a general event browser. It has no text search, actor filter, entity filter, project filter, raw-ID copy control, or mutable action. Search-state is only `from` and `to`; cursors are server-action payload only. Apply the same explicit `[from, to)` / max-93-day normalizer as metrics. Initial default is an explicit latest 90-day interval. Invalid URL state normalizes to that canonical default.

The display may show only localized action category, localized entity category, project name if supplied, actor role if supplied, old/new status if supplied, and the safe changed-field summary if supplied. It must not link an entity merely because M3 returned an ID. Project name is plain text in this release; no deep links are required from audit history.

### 3.4 M3 Admin profile/invitation operational state: `list_admin_user_invitation_state`

```text
list_admin_user_invitation_state(
  p_before_created_at timestamptz default null,
  p_before_profile_id uuid default null,
  p_limit integer default 25
)
```

Only Admin is authorized. It returns a unified descending keyset stream, with exactly two allowed `record_kind` values:

```text
profile | invitation
```

Its purpose-limited output is:

```text
record_id, record_kind, created_at,
profile_id nullable, full_name nullable, application_role,
is_active nullable, preferred_locale nullable,
email_notifications_enabled nullable, whatsapp_opt_in nullable,
last_seen_at nullable,
invitation_id nullable, invitation_status nullable,
project_id nullable, project_name nullable,
invitation_expires_at nullable, invitation_accepted_at nullable,
invitation_revoked_at nullable
```

The server adapter requests 26, retains 25, validates the discriminated shape, and projects one of these DTOs:

```ts
export type AdminProfileStateItem = Readonly<{
  kind: "profile";
  recordId: string;
  createdAt: string;
  profileId: string;
  fullName: string;
  applicationRole: AppRole;
  isActive: boolean;
  preferredLocale: "es-MX" | "en-US" | null;
  emailNotificationsEnabled: boolean;
  whatsappOptIn: boolean;
  lastSeenAt: string | null;
}>;

export type AdminInvitationStateItem = Readonly<{
  kind: "invitation";
  recordId: string;
  createdAt: string;
  invitationId: string;
  applicationRole: AppRole;
  invitationStatus: "pending" | "accepted" | "expired" | "revoked";
  projectName: string | null;
  invitationExpiresAt: string | null;
  invitationAcceptedAt: string | null;
  invitationRevokedAt: string | null;
}>;

export type AdminUserInvitationStateItem =
  | AdminProfileStateItem
  | AdminInvitationStateItem;
```

The adapter must fail closed when the row does not match its discriminator exactly. In particular:

- a `profile` row requires non-null `profile_id`, `full_name`, `is_active`, both preference booleans, and no invitation-only fields in the projected DTO;
- an `invitation` row requires non-null `invitation_id` and recognized invitation status, and must not project profile-only fields;
- `project_id` is cursor/data-contract internal only and must not reach presentation. `project_name` may reach presentation only for invitation rows;
- unknown role, locale, invitation status, record kind, malformed UUID/timestamp, or raw row shape is a generic unavailable error, not a partially rendered record.

This is **state visibility only**. Do not add a “resend,” “revoke,” “activate,” “deactivate,” “edit,” “invite,” “delete,” “reset password,” or “change role” button. Existing invitation redemption continues unchanged and is not an administration operation. The console must not display an email address, phone, token/hash, client identity, Auth provider identity, session value, consent data, `last_seen_at` raw telemetry, or raw profile metadata. `last_seen_at` may be shown only as a localized relative/absolute “last active” date with no time-zone inference beyond the shared formatter; omit the row’s value if null.

## 4. Required application architecture

```text
RSC route
  -> requireSession + route role redirect
  -> server-only normalized search state and narrow query adapters
  -> authenticated @supabase/ssr RPC calls (M3/M5 or pre-existing S06 queue adapter)
  -> validated purpose-limited DTO props
  -> server presentation + small client filter/chart/pagination leaves
```

No client component creates a Supabase client. A client component may update a locale-preserving URL, render a Recharts visual from already validated DTO props, or ask a server action for a validated continuation page. It must not derive metrics, call an RPC, receive raw response rows, or receive environment/configuration details.

### 4.1 New server-only modules

Follow nearby archive/notification conventions; exact filenames may be refined to avoid a collision, but preserve this responsibility split:

| Module | Required responsibility |
| --- | --- |
| `src/lib/operations-metrics/types.ts` | Narrow metric summary, closed status distributions, trend point, dashboard query, errors, and page/continuation DTOs. Never export generated rows. |
| `src/lib/operations-metrics/schemas.ts` | Strict Zod date-range/search/PM project/cursor schemas. Offset-bearing ISO values only; paired cursor validation; `[from,to)`, `from < to`, max 93 days. |
| `src/lib/operations-metrics/date-utils.ts` | Reuse `CALENDAR_TIME_ZONE` and `formatIsoWithOffset`; derive one explicit latest-90-day range on server; normalize raw URL state; format safe query strings. Do not create an alternate time-zone policy. |
| `src/lib/operations-metrics/queries.ts` | `server-only`; call M3/M5, validate every return value, map to safe DTOs, and use generic unavailable errors. |
| `src/lib/operations-metrics/actions.ts` | `"use server"`; continuation only if client-side Load more is used. Validate complete query/cursor; call `requireSession`; return safe `ok/data` or finite error code. No mutation and no broad revalidation. |
| `src/lib/admin-operations/types.ts` | Narrow Admin audit/user-invitation DTOs, cursors/pages, finite errors. |
| `src/lib/admin-operations/schemas.ts` | Audit date range and paired keyset cursor schemas; user/invitation paired cursor schema. |
| `src/lib/admin-operations/queries.ts` | `server-only`; typed M3 audit/user state calls, 25+1 processing, discriminated row validation, generic failure. |
| `src/lib/admin-operations/actions.ts` | `"use server"`; validated audit/state continuation only. No Admin mutation action. |
| `src/lib/admin-operations/diagnostics.ts` | `server-only`; maps existing notification capability result to the closed browser-safe diagnostics DTO defined below. It is the only S07-06 diagnostic configuration bridge. |

Do not create a generic module that merges archive, incidents, notification queue, metrics, audit, identity state, and diagnostics into one broad DTO. These surfaces have different least-privilege contracts.

### 4.2 Safe diagnostics DTO and mapping

The diagnostic module may call the existing server-only `getExternalDeliveryCapability()` from `src/lib/notifications/config.ts`. It must immediately map the internal discriminated result to this closed public DTO and return nothing else:

```ts
export type AdminDiagnosticItem = Readonly<{
  capability: "localDemoPosture" | "externalDelivery";
  state:
    | "local_demo"
    | "inactive"
    | "activation_prerequisites_incomplete"
    | "configuration_requires_review";
}>;

export type AdminDiagnostics = readonly [
  AdminDiagnosticItem,
  AdminDiagnosticItem,
];
```

Mapping:

| Existing internal result | Safe rendered item |
| --- | --- |
| Static application posture for this work | `{ capability: "localDemoPosture", state: "local_demo" }` always. |
| `getExternalDeliveryCapability().kind === "disabled"` | `{ capability: "externalDelivery", state: "inactive" }` |
| `.kind === "invalid"` | `{ capability: "externalDelivery", state: "activation_prerequisites_incomplete" }` |
| `.kind === "active-ready"` | `{ capability: "externalDelivery", state: "configuration_requires_review" }` |

`active-ready` must **not** be displayed as “active,” “enabled,” “working,” “configured,” or proof of real provider delivery. The sprint is intentionally provider-inactive. `configuration_requires_review` tells an Admin only that the local capability posture requires separate approved review; it does not reveal which provider/category/variable produced the state.

The browser receives only the two fixed capability labels and their four safe state tokens. Never serialize an internal code, provider sub-state, variable name, environment object, raw boolean flag, endpoint, error, secret, or diagnostic stack. This module performs no network call and never invokes an adapter, manual evaluator, or scheduler.

## 5. Routes, guards, navigation, and search state

### 5.1 Canonical routes

| Capability | Route | Eligible role | Required data |
| --- | --- | --- | --- |
| Admin operational dashboard | `/admin/metricas` | Admin only | M3 global aggregate + M5 global trend. |
| PM project dashboard | `/pm/metricas` | PM Lead and PM Watcher | M3/M5 one permitted project. |
| Admin operations console | `/admin/operaciones` | Admin only | M3 aggregate, M3 audit/state, server diagnostics, and entry links. |

Do not add an Operator/Client metrics or operations route. Do not use `/admin` or `/pm` home pages as hidden aliases. Existing `/admin/notificaciones`, `/pm/notificaciones`, `/admin/archivo`, `/pm/archivo`, `/admin/incidentes-enlaces`, and `/pm/incidentes-enlaces` remain their own independent routes and contracts.

Every RSC page must call `requireSession`. Admin pages redirect a non-Admin authenticated session to `ROLE_DEFAULT_PATHS[session.role]`. PM metrics redirects non-PM similarly. Neither route assumes a URL proves project authorization; M3/M5 are always called with session-bound credentials.

Add the route prefixes to the existing auth role-route configuration using the established convention. Do not add any to an authentication redirect allowlist.

### 5.2 Navigation rules

Desktop and mobile navigation must remain role-real and locale preserving:

- Admin gets **Metrics** (`/admin/metricas`) and **Operations** (`/admin/operaciones`).
- PM gets **Metrics** (`/pm/metricas`) only. It does not get the Admin operations console.
- Existing notification-operations navigation remains conditional on the already-established `canAccessNotificationOperations` flag. PM Watcher must never receive the PM operations-queue link solely because it receives metrics.
- Existing Archive, Link Incidents, Calendar, project, and personal Notification links retain their current role rules.
- Operations page cards can link to existing Admin destinations: metrics, archive, link incidents, and notification operations. Each card link must be omitted rather than disabled if the destination is unavailable. No audit/user record produces a newly invented deep link.
- PM metrics may link to the PM archive/incidents destinations only when a project filter is selected and the existing destination accepts that project filter. It must not create a project-detail or queue deep link from a metric count. To avoid URL-contract coupling and accidental scope leak, the baseline PM dashboard renders count cards as summaries and provides only generic navigation links to `/pm/archivo` and `/pm/incidentes-enlaces`.

### 5.3 Canonical metrics search state

Admin:

```text
/admin/metricas?from=<offset ISO>&to=<offset ISO>
```

PM:

```text
/pm/metricas?projectId=<uuid>&from=<offset ISO>&to=<offset ISO>
```

Rules:

1. `from` and `to` are both present after server normalization, are offset-bearing ISO timestamps, form `[from,to)`, and span no more than 93 days.
2. Omitted/malformed/offsetless/partial/inverted/oversized range state becomes one canonical latest-90-day range created once per RSC request using the shared Mexico City date utility.
3. Admin has no `projectId` query state or project selector. Ignore/remove any raw `projectId` from its canonical navigation; do not pass it to M3/M5.
4. PM requires a `projectId` after normalization. The page obtains a narrow server-fed `{ id, name }` selector list by reusing `fetchArchiveProjectFilterOptionsForPm(supabase, session.user.id)`, which already returns active membership-scoped, non-deleted projects. It must not create a broad project query.
5. If PM has no options, render a localized no-permitted-project state and do not call M3/M5 with an invented ID.
6. If raw `projectId` is absent, malformed, or not present in the server-fed selector list, select the first server-fed option in its deterministic name order and normalize the URL on the next user filter interaction; do not redirect solely to polish a URL.
7. Changing project or range is a locale-preserving RSC navigation and resets every page/continuation. No metric cursor is exposed in the URL.
8. Provide only compact current/latest-30/latest-90 presets and two native accessible date-time inputs or one existing date-range pattern that yields explicit offset-bearing values. No all-time query, free-text filter, arbitrary bucket size, local storage, or remembered preferences.

### 5.4 Canonical Admin operations search state

```text
/admin/operaciones?auditFrom=<offset ISO>&auditTo=<offset ISO>
```

- Audit range follows the same 90-day default/93-day maximum normalization but uses namespaced keys so it cannot collide with a future metrics card link.
- Profile/invitation state has no date/status/role/project search filter in S07. It is a newest-first keyset stream only.
- Audit and user/invitation cursors are server-action payload only; they are never visible in URLs.
- The page may load M3 aggregate metrics and the first page of audit/state concurrently with `Promise.all`. Failure isolation is required: a failed audit/state/queue-preview must not discard successfully validated metrics or diagnostics. Render each failed section’s generic local error independently.

## 6. S07-05 dashboard presentation

### 6.1 Page composition and states

Each metrics route is RSC-owned and renders, in this order:

1. one H1 and concise localized scope description;
2. filter bar (range; PM project selector where eligible);
3. visible selected scope/range summary using localized project name or “All projects” for Admin;
4. metric cards;
5. current distributions and accessible data equivalents;
6. trend visualization and equivalent accessible table;
7. review/completion-cycle summary;
8. operational attention/links section;
9. explicit empty/no-cycle/access-limited/error content as needed.

Keep these states distinct:

- **zero**: an authoritative count is `0`; render zero honestly;
- **no review-cycle data**: count is zero and corresponding average is null; render an explanatory no-data state, never a 0-hour average;
- **no completion-duration data**: count is zero and average is null; render an explanatory no-data state, never 0 days;
- **authority-limited queue data**: `null` queue aggregate for PM Watcher; render not-available-for-access, never zero;
- **empty status distribution**: no scoped current records; render status table with all known rows at zero and explanatory empty copy;
- **unavailable**: validated RPC call fails or return contract is malformed; generic recoverable error, never an empty dashboard;
- **loading**: no fabricated cards/charts; use skeletons that preserve heading/section landmarks.

### 6.2 Required metrics cards

Cards must contain a label, visible textual value, short semantic description, and non-color state. The baseline cards are:

1. Active tasks (M3 `active_task_count`);
2. Overdue tasks (M3 `overdue_task_count`);
3. Deadlines in selected range (M3 `deadline_attention_count`);
4. Finalized production deliverables in selected range (M3 `finalized_deliverable_count`);
5. Unresolved link incidents (M3 `unresolved_link_report_count`);
6. Completed project cycles in selected range (M3 `completion_cycle_count`);
7. Completed cycles later reopened (M3 `reopening_cycle_count`);
8. External delivery suppressions in selected range **only when non-null** (M3 `suppressed_external_queue_count`).

Do not display `unread_in_app_queue_count` as an ordinary inbox unread badge or a per-user count. If non-null, it may be a small internal operations card titled “Unread in-app recipients (operational aggregate).” If null for PM Watcher, show the authority-limited message rather than an empty/zero card.

The suppression card must include the existing terminal wording in adjacent supporting copy or linked operations surface:

> External delivery was suppressed because providers are inactive in this local demonstration. It was not sent, is not pending, and will not be automatically queued, retried, or replayed.

Do not turn any metric card into an action button. A card can contain a conventional text link only where section 5.2 authorizes the destination.

### 6.3 Current status distributions

Render two read-only distributions:

1. **Current project status distribution** from `project_counts_by_status`.
2. **Current production deliverable status distribution** from `production_deliverable_counts_by_status`.

Each distribution requires both:

- a visual Recharts chart (a simple bar chart is preferred over a pie/donut because category names and zero states remain understandable); and
- an always-visible semantic `<table>` containing localized status, count, and percentage of the distribution total.

The table is the authoritative accessible alternative. It must not be visually hidden, require JavaScript interaction, or simply duplicate an inaccessible tooltip. If the total is zero, percentage renders as an em dash with a localized “No current records” explanation rather than `NaN`, `Infinity`, or `0%` inferred as a rate.

Chart requirements:

- No color-only meaning. Use localized axis labels, visible legend/series title, and table equivalent.
- Do not display raw enum values. Map generated enum values to exact message keys.
- Tooltips must be supplemental, localized, and must not contain data unavailable in the table.
- Use a responsive container with a meaningful fixed minimum height and a non-chart fallback table at narrow widths. Do not use canvas-only rendering.
- Do not add a chart click handler, entity ID payload, project drilldown, or an unapproved deep link.

### 6.4 Trend visualization

Render one M5 **Operational activity by selected seven-day period** grouped bar chart. Each bucket shows:

- finalized production deliverables;
- client review cycles with measured duration;
- project completion cycles;
- completed cycles later reopened.

The chart is a representation of M5 only. Do not calculate rolling averages, conversion rates, projections, trend direction labels, deltas from prior range, or bucket totals in the browser as an operational source of truth.

The accessible equivalent is an always-visible table with columns:

```text
Period | Finalized production deliverables | Client review cycles | Completion cycles | Completed cycles later reopened
```

Format bucket start/end in `CALENDAR_TIME_ZONE` and describe them as half-open display intervals in the localized caption. The chart/table must show zero-valued M5 buckets. A selected range with only zeros is a valid zero-activity trend, not an error. If M5 fails, show the generic trend unavailable state and retain any working M3 summary sections.

### 6.5 Cycle-duration summary

Render a small semantic definition list or table, not another chart:

| Measure | Value rule |
| --- | --- |
| Client review cycles measured | M3 count. |
| Average client review time | Localized hours when M3 average is non-null; otherwise localized no-measured-cycle state. |
| Completion cycles measured | M3 count. |
| Average completion cycle duration | Localized days when M3 average is non-null; otherwise localized no-measured-cycle state. |
| Completed cycles later reopened | M3 count with the completion-cohort label. |

Use sensible localized number formatting; no more fractional precision than one decimal for hours/days. Never round an internal raw database value into a false zero. Do not expose individual cycle/project history from aggregate data.

## 7. S07-06 operations console presentation

### 7.1 Admin console structure

`/admin/operaciones` is a read-only overview, not a replacement for specialized routes. It contains these sections:

1. **Operational attention** — validated M3 cards for overdue tasks, deadlines in range, unresolved link incidents, finalized production in range, and queue aggregate values where non-null.
2. **Operational destinations** — conventional links to `/admin/metricas`, `/admin/archivo`, `/admin/incidentes-enlaces`, and `/admin/notificaciones`. Each link explains its bounded purpose; no count authorizes access.
3. **Development capability posture** — exactly the two diagnostics DTO items from section 4.2. Use text labels and neutral/warning treatment, never a green “provider healthy” indicator.
4. **Recent audit history** — first M3 page, bounded date filter, keyset Load more, safe table/cards.
5. **User and invitation state** — first M3 page, keyset Load more, two discriminated visual row types, state only.

The initial operational attention range uses the same current explicit latest-90-day range as metrics but is not an exposed independent filter in this work item. It may contain a text link to `/admin/metricas` for changing range. Audit range is independently controlled by `auditFrom/auditTo` as section 5.4 defines.

Do not embed the existing suppressed-notification queue table in this page. Use an entry link. The queue has its own existing pagination and authorized manual demonstration control; copying it risks a duplicated data/action boundary. Do not embed archive/incident lists or user/profile direct tables either.

### 7.2 PM operations summary

No `/pm/operaciones` route is created. The PM scope for S07-06 is deliberately bounded to:

- `/pm/metricas` for a selected authorized project;
- existing `/pm/notificaciones` only when the existing `assertNotificationOperationsAccess` permits active PM Lead capacity;
- existing `/pm/archivo` and `/pm/incidentes-enlaces` under their independent database scope.

PM Watcher may see selected-project metrics but receives no Admin console, diagnostics, audit history, profile/invitation stream, or notification-queue link. Do not infer broader PM operations authority from `private.is_project_pm`.

### 7.3 Audit presentation

Use a semantic desktop table with mobile-equivalent labeled cards. Permitted columns/fields:

```text
When | Action | Entity type | Project | Actor role | Status change | Safe summary
```

Rules:

- `When` uses `<time>` with localized human display and machine-readable ISO `dateTime`.
- Status change renders old → new only if one/both values are supplied; otherwise an em dash and no fabricated status.
- Project, action, entity type, actor role, and summary use message mappings. Unknown action strings are not rendered raw; map them to a localized generic “Operational event recorded” label while retaining no internal name.
- Do not display audit ID/entity ID/project ID; retain them only inside server continuation cursors where applicable.
- “Load more audit history” uses a 44px keyboard-accessible button, local pending state, polite outcome live region, and a generic error alert with retry. It does not revalidate the whole route.

### 7.4 User/invitation state presentation

Use one section with a visible explanatory boundary: “Operational state only; user and invitation management is not available from this console.”

Profile row/card permitted fields:

```text
Full name | Application role | Active/inactive state | Preferred language
Email-notification preference | WhatsApp opt-in preference | Last active date when present
```

Invitation row/card permitted fields:

```text
Invitation status | Intended application role | Project name when returned
Created | Expires | Accepted or revoked date when returned
```

Rules:

- Display profile/invitation state badges as text plus visual styling; never color alone.
- `email_notifications_enabled` and `whatsapp_opt_in` mean preference state only; they do not indicate a working provider, consent record, contact target, dispatch ability, or invitation delivery outcome.
- Pending/accepted/expired/revoked invitation statuses are state facts only. Do not say an invitation was emailed, delivered, resent, or usable without an existing authoritative flow proving that separate fact.
- For invitation rows, project name is descriptive text only. No project destination/deep link is produced from it.
- For profile rows, full name is text only. No profile page, role editing menu, contact action, or client identity linkage is introduced.
- Do not show `recordId`, `profileId`, `invitationId`, `projectId`, last activity telemetry precision beyond normal localized date/time display, or null placeholders as raw technical values.
- Load-more behavior matches the audit section but has independent state/cursor/error feedback.

### 7.5 Diagnostics presentation

Render the two capability items in a semantic list or table:

```text
Capability | Safe state | Meaning
```

Required meaning:

- Local demonstration posture / Local demonstration: this application is in a local feature demonstration posture; it is not a release/deployment statement.
- External delivery / Inactive: external providers are inactive; delivery was not sent and is not queued for automatic replay.
- External delivery / Activation prerequisites incomplete: this local posture cannot be treated as an enabled integration; separate approved activation work is required.
- External delivery / Configuration requires review: a separate approved review is required before any activation claim; this is not a readiness or delivery claim.

There is no “test connection,” “recheck,” “configure,” “activate,” or “copy diagnostic” control. No detail drawer, tooltip, source code, variable name, provider/channel-specific result, network request, or raw config message is permitted.

## 8. Interaction, localization, accessibility, and security requirements

### 8.1 Filters and pagination

- Filter controls are client interaction leaves that use locale-preserving URL navigation. They validate locally only for usability; RSC normalizers and action schemas remain authoritative.
- All date/date-time controls have visible localized labels, valid min/max or validation feedback, and explicit Reset/Latest 90 days action. Do not trap the user in a malformed URL state.
- PM project selector includes a text label and only narrow `{ id, name }` server-fed options. It has no client-side search against a broad dataset.
- Load-more controls only accept their complete validated query/cursor payload. If the selected metrics/audit state changes, discard previously loaded continuation data rather than combining results from different state.
- Read-only continuation server actions must not call `revalidatePath`; they return the next validated DTO page only.

### 8.2 Localization keys

Use coherent namespaces, following existing catalog ordering. At minimum add semantic coverage for:

```text
metrics.*
adminOperations.*
shell.nav.links.metrics
shell.nav.links.operations
```

Coverage includes all titles, descriptions, role/scope labels, range presets, project selection/no-project state, every metric label/semantic description, known status labels, chart/table captions, zero/no-data/unavailable/authority-limited state, audit headers/action/entity/role labels, profile/invitation state fields, diagnostics capability/state/meaning, links, pagination, retry, and all ARIA/live-region text.

No server adapter/error/config module contains user-facing fallback strings. Presentation resolves all display text through `next-intl`.

### 8.3 Accessibility

- One logical H1 and semantic landmarks per route; every dashboard section has a real heading.
- Charts have a visible heading and description, are supplemental to an always-visible semantic table, and do not depend on color or hover.
- Tables use `caption` or an associated heading, real header cells/scope, and responsive labeled cards at narrow width without dropping data.
- Metric cards use text labels/values; warning emphasis does not rely on color alone.
- Filters, navigation links, chart alternatives, Load more/retry buttons, and operations destination links are keyboard accessible and meet the established 44px primary target requirement where applicable.
- Use `aria-live="polite"` for successful continuation/filter feedback and `role="alert"` for recoverable errors. Preserve focus when a Load more button changes/disappears.
- Verify core paths at 375px, keyboard-only, both themes, canonical Spanish, and `/en/` English. This is practical product evidence, not a claim of formal accessibility certification.

### 8.4 Security checklist

1. M3/M5 and the existing S06 operations queue adapter are the only operational data sources. No direct table/view reads occur in feature modules.
2. URL/filter/cursor inputs are untrusted; all server use validates them. UUID validity never authorizes a project.
3. Admin routes have route guards, PM route has PM guard, but data scope remains enforced by RPC actor derivation.
4. PM Watcher’s null queue aggregates remain authority-limited nulls. The UI never converts null to zero or uses it to grant a queue destination.
5. No profile/invitation operation exposes an email, phone, token/hash, session, password, contact, Auth metadata, raw invitation state, role mutation, or direct Auth API call.
6. No audit presentation exposes raw changed fields, internal IDs, actor identity, IP, UA, request ID, provider payload/error, or links derived solely from an entity ID.
7. The diagnostics adapter maps internal config capability immediately to closed safe tokens and never serializes internal codes/substates/environment details.
8. All external-delivery wording preserves terminal suppression semantics: not sent, not pending, no automatic retry/replay.
9. No M3/M5 output becomes client-side authority for a navigation route or a mutation command.

## 9. Minimal essential verification

The Project Owner explicitly requires low test overhead. Add **only** the following focused evidence. Do not add component test matrices, chart snapshots, broad mock data factories, Playwright, provider fixtures, or tests that re-prove database RLS with application mocks.

### 9.1 Required focused automated changes

1. **Extend the existing `__tests__/database/s07-e09-migrations.test.ts` only.** Add M5 assertions for the one RPC signature, explicit active-profile and Admin/PM scope checks, 93-day/paired-range validation, deterministic bounded bucket generation, purpose-limited fields, `SECURITY DEFINER` search-path/owner/grant posture, and absence of table/index/mutation/provider/scheduler statements. Do not create a second migration contract file.
2. **One focused server-adapter test file** under the new metrics/admin server-module test convention. It must prove only: explicit M3/M5 arguments; Admin omitted-project versus PM required-project query construction; 25+1 audit/state keyset behavior; null-versus-zero handling; malformed/unknown RPC data fails closed; profile/invitation discriminator projection; and diagnostics closed-token mapping. It must not emulate RLS or test Recharts rendering.
3. **Update the existing localization parity test/catalog expectations** only as required by new catalog keys. Do not create a separate i18n harness.
4. **Update existing app-shell/navigation test only if role-route/navigation declarations change**. Assert only Admin sees Admin metrics/operations destinations, PM sees metrics, and Operator/Client see neither.

No new UI test is required unless an existing component test fails because a changed prop contract requires update. Application mocks cannot prove M3/M5 deployed authorization; migration application and generated types are the authoritative schema evidence.

### 9.2 Required concise manual localhost evidence

Use protected reference data for read-only inspection and `Acme Sandbox Campaign` only if any existing mutable demo scenario is needed. Record factual outcomes only.

1. **Admin metrics:** choose latest 30 and latest 90 ranges; verify global status tables/charts agree, zero/no-cycle/unavailable states are distinct where scenarios permit, and no project selector appears.
2. **PM Lead and PM Watcher metrics:** select an authorized project; confirm project-scoped data only. Confirm PM Watcher receives no queue-operation destination and queue-null is not rendered as zero.
3. **Unauthorized roles:** verify Operator and Client have no metrics/operations navigation and a direct route attempt is redirected/denied without data disclosure.
4. **Trend truthfulness:** verify each table row matches the chart’s four values and that the displayed period boundaries match the selected explicit range. Confirm a zero bucket remains visible as zero.
5. **Admin operations:** inspect safe attention cards, destination links, two closed diagnostics states, bounded audit history, and profile/invitation state. Confirm no secret/variable/provider/contact/token/session/raw-audit data or management control appears.
6. **Suppression truthfulness:** open existing Admin notification operations from the console link and verify terminal inactive-provider language, not failed/pending/retry language.
7. **Accessibility/localization:** repeat primary filters, chart tables, audit/state Load more, and navigation at 375px, keyboard-only, both themes, Spanish, and English.

## 10. Completion criteria

S07-05/S07-06 are complete only when all statements are true:

1. M3 and M5 are applied to `jsf-pm-dev`, generated types are regenerated unchanged, and M5 application/type provenance exists before dependent application acceptance.
2. Admin receives global range-bounded metrics from M3/M5; PM receives only one database-authorized project scope; Operator/Client receive neither route nor data.
3. Cards, distributions, trend, and cycle summaries follow the exact M3/M5 semantics. Null/no-data/zero/authority-limited/error states are never conflated.
4. Every chart has an always-visible equivalent semantic table; no chart adds a hidden dataset, drilldown, browser authority, or color-only meaning.
5. Admin operations consumes only M3 safe audit/user-state and the closed server-derived diagnostics DTO; it is read-only and contains no Auth/provider/configuration/identity control.
6. User/invitation state never reveals email, phone, tokens, Auth/session data, contacts, raw metadata, or an unapproved mutation.
7. Audit history never reveals raw audit JSON, IDs, actor identity, IP/UA/request data, or unapproved entity deep links.
8. Diagnostics show only fixed safe capability/state tokens and never claim active provider delivery or expose internal configuration detail.
9. Navigation, guards, locale preservation, Spanish/English key parity, responsive layouts, keyboard paths, live feedback, and mobile table equivalents are complete.
10. Only the focused automated/manual verification in section 9 is added/performed; no excluded provider/API/scheduler/mutation/test-expansion scope enters the change set.

## 11. Stop conditions

| Condition | Required response |
| --- | --- |
| Applied M3/M5 function signatures, grants, result fields, generated types, or scope differ from this specification | Stop. Reconcile through a reviewed forward migration and regenerated types; do not direct-query a table/view or cast around the mismatch. |
| M5 returns a bucket outside selected range, more than 14 rows for 93 days, unknown field semantics, or lacks active-profile/PM authorization | Treat as database security/contract defect. Fix with a reviewed forward migration before application work. |
| Product asks for Admin project filtering | Stop for a new M3-forward contract decision. M3’s Admin dashboard is intentionally global; do not pretend `p_project_id` filters Admin scope. |
| Product asks for daily/monthly/custom buckets, rates, forecasts, trend deltas, export, raw history, materialization, or dashboard caching | Out of scope. Requires a new metric contract/architecture decision. |
| PM project selector exposes unauthorized projects or a PM request receives another project’s data | Stop as a security defect. Narrow the selector/query/RPC; never hide a leaked row only in UI. |
| User/invitation console needs invite send/resend/revoke, activation, role/membership change, password/session control, deletion, email/phone, or Auth admin | Out of scope and requires explicit identity-lifecycle authority plus a constrained audited command; do not add UI/direct client workarounds. |
| Diagnostics proposal exposes an environment/provider detail or permits test/configure/activate behavior | Block as a security defect. Retain only section 4.2’s closed mapping. |
| A metric count is used to infer a deep link/mutation authority | Omit the action. Existing route/RPC authorization must independently succeed. |
| Proposed plan adds REST/OpenAPI, provider behavior, scheduler, Realtime, broad tests, or Playwright | Out of scope; remove it from the plan. |

## 12. Implementation readiness

After the Project Owner applies M5 through Supabase MCP and regenerates the database types unchanged, this file is ready for implementation planning. The implementation plan must inspect exact local component/test names and generated declarations, and must not alter migration SQL, generated types, remote state, provider posture, or any excluded identity/administration behavior.

There are no unresolved product decisions blocking this scope. The sole prerequisite is successful M5 application followed by exact generated-type reconciliation.
