---
document_id: S07-03-S07-04-ARCHIVE-LINK-OPERATIONS-NOTIFICATION-HISTORY-IMPLEMENTATION-SPEC-01
sprint_id: S07
work_items: [S07-03, S07-04]
status: ready-for-m4-application-and-implementation-plan
created_at: 2026-08-24T08:00:00-06:00
source_plan: dev-docs/specs/s07/s07-e09-visibility-reporting-and-operational-administration-demo-completion-sprint-plan.md
mapping_reference: dev-docs/specs/s07/s07-e09-capability-contract-mapping-reference.md
target_environment: jsf-pm-dev
required_applied_migrations:
  - 20260823141000_s07_e09_finalized-production-archive-and-link-incidents.sql
  - 20260824080000_s07_e09_notification_history_window_and_filters.sql
---

# S07-03 and S07-04 — Finalized Archive, Link Operations, and Notification History Implementation Specification

## 1. Purpose and execution baseline

This combined execution specification completes two bounded E09 capabilities in the persistent `jsf-pm-dev` localhost demonstration environment:

1. **S07-03:** a role-safe, finalized-production archive and internal broken-link incident visibility. It makes already-finalized production work discoverable without changing a deliverable lifecycle, mutating immutable versions, or treating `client_submission` records as production history.
2. **S07-04:** a complete recipient-owned in-app notification history and a consolidated internal suppressed-delivery operations view. It makes the local notification posture understandable without activating, retrying, replaying, or representing external providers as operational.

This document is the repository-local implementation baseline for Antigravity. It is intentionally concrete so implementation planning does not need to infer routes, database authority, pagination semantics, role rules, URL shapes, safe fields, or test scope.

At application implementation time, the following migrations are assumed **already applied to `jsf-pm-dev`**, with `src/lib/database.types.ts` regenerated through MCP and committed unchanged:

```text
20260823141000_s07_e09_finalized-production-archive-and-link-incidents.sql
20260824080000_s07_e09_notification_history_window_and_filters.sql
```

M3 (`20260823142000_s07_e09_scoped-operations-metrics-and-admin-projections.sql`) is outside these two work items and is not a prerequisite for this implementation.

The new M4 source is:

```text
supabase/migrations/20260824080000_s07_e09_notification_history_window_and_filters.sql
```

M4 replaces only the old three-argument S06 `list_my_in_app_notifications` overload. It adds a server-owned default 90-day window, explicit bounded historical ranges, optional read-state filtering, a narrow recipient DTO, active-profile enforcement, and a query-specific partial keyset index. It does **not** alter notification generation, recipient read commands, queue authority, RLS policies, provider suppression, provider configuration, scheduling, external delivery, or any M2 archive contract.

No implementation worker may edit/apply any migration, use Supabase MCP, regenerate database types, alter remote state, use a service-role client, read environment values, or compensate for a missing/mismatched database contract in application code.

## 2. Authority, reconciliation, and non-negotiable boundaries

Apply authority in this order:

1. Direct Project Owner direction.
2. This S07-03/S07-04 implementation specification.
3. The S07 sprint plan and capability-contract mapping reference.
4. Applied migration contracts and untouched MCP-generated database types.
5. `AGENTS.md`, `GEMINI.md`, and established repository conventions.
6. General framework guidance.

This specification reconciles the following implementation facts:

- M2 is applied and is the sole new source for archive and incident reads. Do not create a duplicate archive table, view, REST endpoint, or direct-table archive query.
- M3 is not a S07-03/S07-04 data dependency. Do not opportunistically consume it merely because it may exist in the migration chain.
- M4 is required before S07-04 application work. The old S06 inbox function signature is no longer valid after M4. Application query/action/tests must use the regenerated six-argument declaration.
- The existing S06 suppressed-delivery operations projection, access rules, and terminal provider-disabled wording remain authoritative. S07-04 consolidates presentation and server-only query reuse; it does not broaden PM Lead scope to PM Watchers or ordinary users.
- `profiles.role` is application authority. `pm_lead` and `pm_watcher` are project-membership capacities, never alternative application roles.
- The calendar-only all-PM exception from S07-02 does not apply to archive, incidents, notification operations, or any other S07 feature.

### 2.1 Permanent exclusions

Do not introduce any of the following:

- external email, WhatsApp, Resend, QStash, Workflow, provider account, sender, template, webhook, receipt, retry, replay, requeue, or scheduler behavior;
- a public or same-origin `/api` route, OpenAPI change, CORS work, SDK, browser PostgREST call, or direct browser base-table access;
- full-text/archive URL search, CSV export, file preview, proxy, scanner, downloader, server-side URL dereference, reachability check, cache, polling, Realtime, service worker, persistent mutation queue, or offline behavior;
- archive write, deliverable status transition, immutable-version modification, broken-link resolve/dismiss command, incident deletion, or any new user/invitation/admin mutation;
- role changes, membership changes, project visibility changes, client- or operator-wide project browsing, or archive access inferred from a UUID;
- provider/channel/recipient/contact/phone/raw payload/provider error/attempt count data in the ordinary notification inbox;
- Playwright or broad new TDD ceremony.

## 3. Applied database contract

### 3.1 M2 finalized-production archive read RPC

The only archive read boundary is:

```text
list_finalized_production_archive(
  p_project_id uuid default null,
  p_status public.deliverable_status default null,
  p_from timestamptz default now() - interval '90 days',
  p_to timestamptz default now(),
  p_before_finalized_at timestamptz default null,
  p_before_deliverable_id uuid default null,
  p_limit integer default 25
)
```

The application calls it only through a server-only typed adapter. The adapter always passes explicit, validated `p_from` and `p_to`; it must not rely on moving database defaults for an initial page or continuation. This preserves one stable range across keyset pages.

#### Archive inclusion invariant

A returned archive row is exactly one non-deleted deliverable meeting every condition below:

- its project is non-deleted;
- `workflow_type = 'production'`;
- its current `status` is exactly `approved` or `delivered`;
- `coalesce(delivered_at, approved_at)` exists and falls in `[p_from, p_to)`;
- it satisfies the requested optional project/status filter; and
- the database has proven the caller’s role-safe archive scope.

The archive must exclude, without client-side post-filtering:

- all `client_submission` workflow rows, including a client-submission row whose status happens to resemble a terminal production state;
- `pending`, `awaiting_internal_review`, `awaiting_client_review`, `changes_requested`, `submitted`, deleted, no-finalized-at, or out-of-range production rows;
- records in a project the caller cannot view; and
- another Operator’s deliverable.

`approved` and `delivered` are distinct terminal presentation values. Do not collapse them into one generic “complete” label, infer a missing delivered timestamp, or manufacture a finalization time.

#### Required adapter DTO

Generated types may declare M2 nullable runtime values as strings. Do not edit generated types. Normalize and validate M2’s runtime result in one server-only module before it reaches a component.

```ts
export type FinalizedArchiveStatus = "approved" | "delivered";

export type FinalizedArchiveItem = Readonly<{
  deliverableId: string;
  projectId: string | null;
  deliverableTitle: string;
  finalStatus: FinalizedArchiveStatus;
  currentVersionNumber: number;
  finalizedAt: string;
  projectName: string;
  projectDriveFolderUrl: string | null;
  currentSubmissionUrl: string | null;
}>;

export type FinalizedArchiveCursor = Readonly<{
  beforeFinalizedAt: string;
  beforeDeliverableId: string;
}>;

export type FinalizedArchivePage = Readonly<{
  items: readonly FinalizedArchiveItem[];
  nextCursor: FinalizedArchiveCursor | null;
  hasMore: boolean;
}>;
```

Rules for the adapter:

- Use a page size of `25`, request `26`, retain at most 25, and derive the next cursor from the final retained row only.
- Validate UUIDs, offset-bearing timestamps, final status, nonnegative safe integer version number, and strings before projection. A malformed RPC row fails closed as a generic unavailable archive error; it is never partially rendered.
- Normalize `project_id`, `project_drive_folder_url`, and `current_submission_url` to `null` when absent at runtime.
- Preserve the database order exactly: `finalized_at DESC, deliverable_id DESC`.
- Never return `event_id`, assignee ID, feedback, audit fields, project/client contacts, description, version history, submission note, reporter identity, raw provider fields, or an unfiltered `Database` row.

#### Archive input, date, filter, and cursor contract

Use strict Zod schemas in a server-only archive module and at every server-action boundary.

| Input | Allowed value | Server rule |
| --- | --- | --- |
| `projectId` | omitted or UUID | Optional filter only; never authorization proof. |
| `status` | omitted, `approved`, or `delivered` | Reject any other deliverable status. |
| `from` and `to` | both offset-bearing ISO timestamps or both absent in raw URL input | Normalize absent/invalid URL state to the canonical latest-90-day range. After normalization they are always explicit. |
| Range | `[from, to)` | `from < to`; maximum 93 days. |
| Cursor | both `beforeFinalizedAt` and `beforeDeliverableId`, or neither | Reject a partial/malformed cursor. |
| Limit | not user-controlled in UI | Adapter fixes it at 26 for continuation detection; RPC still clamps 1–100. |

The canonical initial range is `to = current server timestamp` and `from = to - 90 days`, with offset-bearing values produced once by a shared date utility. A continuation action receives and validates the original explicit range/filter object; it never recomputes “now.”

### 3.2 M2 broken-link incident read RPC

The only S07-03 incident read boundary is:

```text
list_role_safe_link_incidents(
  p_project_id uuid default null,
  p_status public.link_report_status default null,
  p_from timestamptz default now() - interval '90 days',
  p_to timestamptz default now(),
  p_before_reported_at timestamptz default null,
  p_before_incident_id uuid default null,
  p_limit integer default 25
)
```

It is read-only. No M2 constrained resolve/dismiss command exists. Therefore S07-03 does **not** add a resolve, dismiss, edit, delete, or status-transition UI/action, even though base-table RLS has unrelated legacy update policy. Do not bypass this boundary with a direct table update.

The server-only adapter exposes only:

```ts
export type LinkIncidentStatus = "open" | "resolved" | "dismissed";

export type LinkIncidentItem = Readonly<{
  incidentId: string;
  deliverableId: string;
  projectId: string;
  deliverableTitle: string;
  projectName: string;
  incidentStatus: LinkIncidentStatus;
  reportedAt: string;
  resolvedAt: string | null;
  reason: string | null;
  resolutionNote: string | null;
}>;
```

The adapter uses the same `25 + 1` keyset pattern with a complete `{ beforeReportedAt, beforeIncidentId }` cursor. It validates the 93-day range, project/status enum, UUIDs, timestamps, and nullable safe text values. It fails closed if an unexpected status or malformed row arrives.

M2 authorization is authoritative:

| Caller | Archive RPC | Incident RPC |
| --- | --- | --- |
| Admin | All permitted final production rows; project ID and Drive folder may be returned where present. | All incident rows in the requested bounded range. |
| PM Lead | Final production rows in active PM project scope only; read-only. | Incidents in active PM project scope only; read-only. |
| PM Watcher | Same scoped archive reads as PM Lead; read-only. | Same scoped incident reads as PM Lead; read-only. |
| Operator | Only directly assigned finalized production deliverables. M2 returns no navigable project ID/Drive folder for this case. | Denied; no route or component. |
| Client | Finalized production records in active client project scope only; read-only. | Denied; no route or component. |

Neither an optional `projectId`, a deliverable ID, an incident ID, nor a rendered project name proves permission. The RPC determines scope for every call.

### 3.3 M4 recipient notification history RPC

After M4 the only general recipient-history read boundary is:

```text
list_my_in_app_notifications(
  p_limit integer default 25,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_read_state boolean default null,
  p_before_created_at timestamptz default null,
  p_before_recipient_id uuid default null
)
```

M4 enforces the following inside a `STABLE`, `SECURITY DEFINER`, `postgres`-owned function with `search_path = pg_catalog, public`:

- an authenticated user must also resolve to an active, non-deleted application profile;
- omission of both bounds yields a server-owned latest-90-day default;
- an explicit historical view requires both bounds, `from < to`, and no more than 93 days;
- the date interval is half-open: `notification_recipients.created_at >= from AND < to`;
- `p_read_state = null` means all rows, `true` means only rows where `read_at IS NOT NULL`, and `false` means only rows where `read_at IS NULL`;
- only `notification_recipients.user_id = auth.uid()` and `channel = 'in_app'` rows are returned;
- the cursor must be complete or absent; order is exactly `created_at DESC, id DESC`;
- the function returns only `recipient_id`, `trigger`, `created_at`, `occurred_at`, and `read_at`;
- `PUBLIC` and `anon` receive no execute grant; `authenticated` alone receives execute;
- the existing unread-only index remains untouched; M4 adds `notification_recipients_in_app_history_keyset_idx` for the exact self-owned channel/range/keyset query.

M4 intentionally does **not** permit client/category filtering. Categories remain a presentation mapping from the returned trigger; filtering by a category would require an accepted new database predicate/contract and is out of scope.

#### Required notification-history DTOs and query state

```ts
export type NotificationReadFilter = "all" | "unread" | "read";

export type RecipientInboxNotification = Readonly<{
  recipientId: string;
  trigger: NotificationTrigger;
  createdAt: string;
  occurredAt: string;
  readAt: string | null;
}>;

export type RecipientInboxCursor = Readonly<{
  beforeCreatedAt: string;
  beforeRecipientId: string;
}>;

export type RecipientInboxQuery = Readonly<{
  from: string;
  to: string;
  readFilter: NotificationReadFilter;
}>;
```

Map `readFilter` to RPC `p_read_state` exactly as follows: `all -> null`, `unread -> false`, `read -> true`.

All application calls, including the initial RSC request, pass explicit normalized `from` and `to`. Thus the user sees an exact stable 90-day window rather than a continuation with a newly calculated database `now()` value.

The adapter requests 26 rows, projects only the DTO above, and derives `{ beforeCreatedAt, beforeRecipientId }` from row 25 when there is a 26th row. It must validate every returned UUID/timestamp/trigger before projection and issue a generic safe unavailable error on any invalid response. It must never expose event ID, entity ID/type, project ID, delivery status, channel, recipient target, provider state, suppression reason, payload, provider error, or attempt data.

### 3.4 Existing S06 recipient mutation and operations contracts

Preserve existing actions unchanged except for query input propagation/revalidation needed by the new history state:

```text
mark_notification_read(p_notification_recipient_id)
mark_all_notifications_read()
list_suppressed_notification_operations(...)
```

`mark_notification_read` and `mark_all_notifications_read` remain recipient-owned, server-action mediated, and return safe idempotent outcomes. They do not become queue operations.

`list_suppressed_notification_operations` remains the only internal suppressed-delivery operations read boundary. It is accessible to Admin globally and PM users only where the existing S06 PM Lead authorization succeeds. PM Watchers, Operators, and Clients are not authorized. S07-04 must reuse `src/lib/notifications/operations-queries.ts`, `operations-actions.ts`, `operations-authorization.ts`, and existing queue contracts rather than copy their RPC/query logic.

Terminal wording is mandatory wherever the queue is visible:

> External delivery was suppressed because providers are inactive in this local demonstration. It was not sent, is not pending, and will not be automatically queued, retried, or replayed.

Do not say “failed delivery,” “waiting to send,” “retry later,” “integration enabled,” or any wording that implies a live provider.

## 4. Application architecture and exact route responsibilities

Use the existing App Router and RSC-first architecture:

```text
Browser interaction leaf
  -> protected server action or locale-preserving URL transition
  -> server-only feature query/action module
  -> authenticated @supabase/ssr RPC call
  -> applied SECURITY DEFINER database contract
```

No client component creates a Supabase client. No page performs direct base-table reads for archive, incidents, inbox history, or notification operations.

### 4.1 Required route inventory

Create these routes only if the exact route does not already exist; do not create duplicate aliases.

| Capability | Canonical route | Eligible users | Data source |
| --- | --- | --- | --- |
| Global finalized archive | `/admin/archivo` | Admin | M2 archive RPC without project filter. |
| Scoped finalized archive | `/pm/archivo` | PM Lead and PM Watcher | M2 archive RPC; database restricts active PM scope. |
| Client finalized archive | `/cliente/archivo` | Client | M2 archive RPC; database restricts active client project scope. |
| Own-work finalized archive | `/operador/archivo` | Operator | M2 archive RPC; no project browse/link semantics. |
| Project archive convenience | Existing Admin/PM project workspace | Admin or PM authorized for that existing workspace | M2 archive RPC with the route project ID as an untrusted filter. |
| Global link incidents | `/admin/incidentes-enlaces` | Admin | M2 incidents RPC without project filter. |
| Scoped link incidents | `/pm/incidentes-enlaces` | PM Lead and PM Watcher | M2 incidents RPC; database restricts active PM scope. |
| Personal notification history | `/notificaciones` | Every authenticated active role | M4 self-only inbox RPC. |
| Suppressed-delivery operations | Preserve `/admin/notificaciones` and `/pm/notificaciones` | Admin; existing authorized PM Lead only | Existing S06 operations query/RPC. |

Route guards and navigation must reflect this table:

- Add every newly created route prefix to the correct protected and role route declarations in `src/lib/auth/routes.ts` using existing convention. Do not place archive/incident routes on an auth redirect allowlist.
- Desktop/mobile navigation shows the archive destination only for the role where it is a real authorized route. Admin, PM, Client, and Operator labels may be localized differently but must point only to their own canonical route.
- Link-incident routes are internal operational destinations: render navigation only for Admin/PM. They may be grouped under the existing operations/navigation affordance rather than creating a top-level item if that is the established shell pattern.
- `/notificaciones` remains one shared authenticated route. It never links an ordinary user to the operations queue.
- Preserve existing `/admin/notificaciones` and `/pm/notificaciones` paths and their guards. “Consolidation” means shared query/presentation modules and truthful cross-navigation, not collapsing their role boundaries into `/notificaciones`.

Every role-specific RSC page calls `requireSession`, verifies the route-level application role before fetching, and redirects to the role’s existing locale-preserving default if wrong. Database authorization still remains mandatory; route gating is not a substitute.

### 4.2 Required server-only modules

Follow nearby naming conventions. Keep each implementation file at or below 400 lines; split by responsibility rather than creating oversized route components.

| Module responsibility | Required behavior |
| --- | --- |
| `src/lib/archive/types.ts` | Narrow archive/incident DTOs, finite status unions, query/cursor/page types. Never re-export broad generated rows. |
| `src/lib/archive/schemas.ts` | Strict URL/query, filter, cursor, continuation, and date-range Zod schemas. UUID, offset-bearing date, 93-day, enum, and paired-cursor checks. |
| `src/lib/archive/queries.ts` | `server-only`; typed M2 RPC calls, row validation/nullable normalization, 25+1 keyset processing, safe generic failures. |
| `src/lib/archive/actions.ts` | `"use server"`; only continuation-page actions if client load-more is used. Validate full query/cursor, require session, call query adapter, return safe `ok/data` or generic error. No archive/incidents mutation action. |
| `src/lib/archive/errors.ts` | Stable internal categories such as validation, unauthenticated, unavailable. Never surface PostgreSQL/RPC text, function names, or existence facts. |
| Existing `src/lib/notifications/*` modules | Update the inbox query/schema/contracts/actions to M4’s explicit range/read-filter/cursor contract; preserve existing operation modules as shared authority. |
| Date/search-state utility | Derive latest-90-day ranges once on server, parse canonical search state, produce locale-preserving query strings, and avoid browser-time authority for authorization. |

A new generic “operations data” module is not required. Keep archive and notification data contracts separate; their roles, projections, and security boundaries differ.

### 4.3 Canonical URL state

All URLs are presentation/filter state only. They are untrusted and are validated/normalized by RSC routes before a database call.

#### Archive route query state

```text
?from=<offset ISO>&to=<offset ISO>&status=approved|delivered&projectId=<uuid>
```

- Default: latest explicit 90-day range; omitted `status` and `projectId`.
- `status` and `projectId` may be absent. Do not use “all” as an RPC enum value.
- Only Admin/PM archive surfaces render a project filter control. Client and Operator must not receive a broad project selector or project-ID labels.
- A project filter UI must be populated from an already authorized server-fed source. It must never issue a client-side all-project query. If a safe existing project-selector data source is unavailable, omit the control; the RPC’s role scope remains sufficient.
- Invalid/malformed/offsetless/inverted/oversized query state normalizes to the canonical default rather than being reflected raw.
- Keyset cursors are server-action payload only. Do not expose opaque cursor values in URL state.

#### Notification history query state

```text
?from=<offset ISO>&to=<offset ISO>&read=all|unread|read
```

- Default: latest explicit 90-day range and `read=all`.
- Provide a visible read-state control with exactly All, Unread, and Read.
- Provide a compact date-range control/presets sufficient for the demo. It may select a new explicit range no larger than 93 days, including an older 90-day interval. It must not provide an unbounded “all history” option.
- Do not provide category/project/channel/provider/recipient filters.
- Any query-state change resets the first page and makes a fresh RSC request. A continuation action carries the complete normalized query plus cursor so it cannot accidentally combine a cursor from one range/read filter with another.

### 4.4 Project workspace archive integration

Add a first-class **Archive** tab only to the existing Admin and PM project workspace shell. It is a convenience projection of the same M2 archive contract, not a replacement for the Deliverables tab or a new lifecycle surface.

Required behavior:

- Server prefetch the project-filtered first archive page in the already-authorized Admin/PM project RSC pages. Do not fetch from the workspace client shell.
- Thread narrow `FinalizedArchivePage` props to a new `ProjectArchiveTab` client/presentation leaf as necessary.
- The tab’s active state is URL-synchronized using the existing workspace `tab` convention: `tab=archive`. Archive filter state uses the canonical `from`, `to`, and optional `status` names only if it cannot collide with established workspace calendar state; if collision exists, namespace the archive keys as `archiveFrom`, `archiveTo`, and `archiveStatus` and use them consistently. Inspect the current shell before choosing; do not silently overwrite calendar state.
- It contains only finalized production rows for the workspace project and has no project selector.
- It remains read-only for PM Lead and PM Watcher. No archive-management control appears based on role.
- For archived/cancelled projects, render the same safe read-only result if M2 returns rows; do not infer that a project lifecycle state removes legitimate historical visibility.
- Do not add this tab to Client or Operator surfaces unless a separately existing workspace architecture makes it genuinely authoritative. Their standalone role-safe archive routes are sufficient for this work item.

## 5. S07-03 presentation requirements

### 5.1 Archive screen and record presentation

Each archive route renders an RSC page with these states, never conflated:

1. loading skeleton with no fabricated records;
2. populated, deterministic keyset-ordered archive;
3. empty filtered range; distinguish this from a query failure;
4. generic recoverable unavailable error;
5. continuation loading and continuation failure with retry;
6. external-link action status (copied/opened/unavailable/blocked by browser) in a localized live region.

Each row/card may show only:

- deliverable title;
- localized `approved` or `delivered` status badge with text, not color alone;
- current version number;
- localized finalization date/time;
- project name when returned;
- external actions permitted by the returned values and role rules below.

Do not render a deliverable description, client identity, assignee identity, task title, feedback, reviewer identity, submission note, audit data, raw UUID label, external URL as visible body text, or a status-control affordance.

Use a semantic list or table with mobile card adaptation. A table is preferred when all five fields remain legible; at narrow widths, preserve equivalent labeled information in cards. Heading hierarchy, status text, date `<time>` elements, empty/error states, and pagination controls must remain keyboard reachable.

### 5.2 Deliberate external URL operations

The application stores an external URL. It does not verify, preview, proxy, download, inspect, dereference, or validate reachability of it.

Implement exactly these client interaction leaves:

| Returned value and caller | Allowed interaction | Required behavior |
| --- | --- | --- |
| `currentSubmissionUrl` for any archive row | Copy external link | `navigator.clipboard.writeText` only after explicit user activation; localized success/failure status. No server action. |
| `currentSubmissionUrl` for any archive row | Open external link | Explicit button/link with visible external-link icon/text; open only in a new browsing context with `noopener,noreferrer`; no prefetch or server request. |
| `projectDriveFolderUrl` for Admin, PM, or Client row where non-null | Copy/open project folder | Same deliberate interaction pattern. |
| `projectDriveFolderUrl` for Operator | Never render | M2 returns null in own-work-only scope; UI treats this as an invariant and exposes no fallback. |
| Any absent/malformed safe DTO URL | No action | Render no disabled fake action and no raw value. |

The UI copy must state that opening/copying uses a stored external link and does not verify availability. Opening a link is navigation by the user’s explicit action, not an application claim that the resource exists.

### 5.3 Archive deep links

- Admin/PM rows may link to an existing same-role project workspace only when the returned `projectId` is non-null and that exact route is independently protected for that role.
- Client rows may link only to an existing independently authorized Client project destination. If no such route is presently authoritative, render project name as text.
- Operator archive rows are non-navigable project context. Do not invent a project workspace/deep link from the deliverable or project title.
- A deliverable ID does not authorize a deliverable detail link. Do not add a new detail route merely for archive navigation.

### 5.4 Link incident screen

Incident screens are internal, read-only operational lists. Each item may show:

- deliverable title;
- project name;
- localized status (`open`, `resolved`, `dismissed`);
- reported date/time;
- resolved date/time when non-null;
- safe reason and safe resolution note when non-null.

Use text status plus non-color visual treatment. Empty, error, date/status filtering, and 25+1 continuation behavior follow the archive conventions. The fixed filter set is project (Admin/PM only), incident status, and bounded reported date range. There is no free-text/URL search.

Never show `reported_by`, `resolved_by`, phone/email/contact, version ID, raw audit data, direct external submission URL, or an editable status. Do not render an “Resolve,” “Dismiss,” or “Fix link” button. The incident’s existence does not alter a deliverable status or archive inclusion.

## 6. S07-04 presentation and consolidation requirements

### 6.1 Recipient-owned notification history

Preserve the existing `/notificaciones` composition and notification category mapping. Refactor it only as needed to accept the M4 `RecipientInboxQuery`, explicit history range, read filter, and continuation payload.

Each inbox item continues to render only a localized category title/description, creation date/time, and read/unread state. It must not add an entity/project deep link because the M4 DTO deliberately does not return navigation authority.

Required interaction behavior:

- Mark-one and mark-all read behavior remains as implemented through existing server actions.
- After a successful mark action, revalidate `/notificaciones`, `/en/notificaciones`, and the protected-shell notification badge layout using existing exact revalidation patterns.
- Preserve idempotent feedback: an already-read item/empty mark-all result is “already up to date,” not an error.
- When the selected filter no longer contains the record after a read mutation (for example, the Unread view), refresh/query-reset rather than optimistically retaining a row that no longer matches the server filter.
- A generic unavailable error remains distinct from an empty selected date/read state.
- The list’s `aria-label`, live feedback, focus restoration, load-more control, retry, touch-target sizing, and reduced mobile layout remain equivalent to the existing inbox behavior.

History screen copy must make the default visible window clear, for example “Showing notifications from the last 90 days.” When an explicit older range is selected, display its localized selected range. Do not promise permanent retention, all-time search, provider delivery history, or a provider activation path.

### 6.2 Operations consolidation

S07-04 does not merge operation rows into an ordinary user’s inbox. The two surfaces have different audiences and data contracts:

| Surface | Audience | Allowed data | Forbidden data |
| --- | --- | --- | --- |
| `/notificaciones` | Every active authenticated user | Self-owned in-app category, dates, read state | external channel, suppression, provider, queue, recipients, projects, entity IDs, payloads |
| `/admin/notificaciones` | Admin | Existing safe suppressed operation aggregation | recipient identity/contact, provider payload/error, retry/replay control |
| `/pm/notificaciones` | Existing authorized PM Lead only | Existing PM Lead-safe suppressed operation aggregation | PM Watcher/ordinary-user access, global scope, replay/control |

Reuse the existing `NotificationOperationsScreen`, `NotificationOperationsQueue`, operations query/action/contracts, and authorization helper. A small shared `NotificationOperationsEntryLink` or role-aware cross-navigation component is permitted only if it does not fetch data in the browser or expose a destination to an unauthorized role.

The queue must remain read-only except for the separately existing development-only manual alert evaluator control, which remains governed by its existing local-posture and authorized-role checks. S07-04 must not move that evaluator into the ordinary inbox, archive pages, or a generic operations dashboard.

## 7. Localization, accessibility, and security

### 7.1 Localization

Add coherent namespaces or extend established namespaces with exact semantic-key parity in `messages/es-MX.json` and `messages/en-US.json`. Use the repository’s existing JSON ordering/style. Required semantic coverage includes:

- archive titles/descriptions, final statuses, version/finalization labels, empty/error/loading/pagination states, date/status/project controls, external-link explanation, copy/open outcome, and safe no-link states;
- link incident titles/descriptions, statuses, reason/resolution labels, filters, empty/error/loading/pagination states, and explicit read-only wording;
- notification 90-day/default/range wording, read-filter labels, empty selected-state copy, invalid/reset message, and continuation feedback;
- terminal operations-suppression wording exactly consistent with S06; and
- all visible labels, tooltips, dialog/button text, error messages, table headers, live-region messages, and accessible names.

No query/action/adapter module contains user-facing English/Spanish fallback text. Presentation code resolves display strings with `next-intl`.

### 7.2 Accessibility

- Use semantic landmarks and one logical H1 per route.
- Archive and incident lists/tables use real headings/column labels; each status has text, not color alone.
- Date/status/read controls are native or accessible controls with localized labels and associated validation feedback.
- Copy/open/load-more/mark-read controls are keyboard reachable and meet the established 44px primary touch-target expectation where applicable.
- Use a polite live region for successful copy/open/load-more/read feedback and an alert region for recoverable errors.
- Do not make an external-link icon the only indicator; state that it opens an external stored link.
- Preserve focus after a row disappears due to a read-filter mutation or after a pagination control disappears.
- Verify primary paths at 375px, keyboard-only, both themes, canonical Spanish and `/en/` English. Do not claim formal accessibility certification.

### 7.3 Security checklist

1. M2/M4 RPCs and existing S06 queue RPC are the only data sources. No direct archive/incident/notification table or view query enters feature code.
2. Server route checks are defense in depth. RPC actor derivation and role/project scope remain the actual data boundary.
3. URL/filter/cursor/form/action input is untrusted. Validate it at the server boundary; UUID validity does not prove access.
4. Do not use `select("*")`, service-role access, browser Supabase, raw generated rows, raw SQL errors, console logging of RPC rows, or optimistic authorization.
5. Archive external URLs are output-only values used only after explicit browser interaction. They are never fetched server-side or passed to an image/preview component.
6. Operator archive has no project ID/deep link/Drive folder workaround. Client and Operator cannot access incident queues.
7. Ordinary inbox does not receive any operations/provider data. PM Watcher does not receive PM Lead queue authority.
8. Preserve immutable deliverable/version history, link report integrity, recipient read ownership, and terminal suppression semantics.
9. Revalidate only after successful recipient read mutations. Read-only archive/incidents/operations pagination must not call broad invalidation paths.

## 8. Minimal essential verification

The Project Owner has explicitly directed that this work avoid broad new test suites and TDD overhead. Add **only the minimum focused test changes necessary to protect the new contract wiring**. Do not create duplicate migration/RLS/component matrices, Playwright tests, provider fixtures, broad snapshot tests, or tests merely for ceremony.

### 8.1 Required minimal automated evidence

1. **M4 static migration contract test or existing database-contract test update:** assert only the replacement inbox signature, active-profile/range/read-state/keyset clauses, purpose-limited returned fields, grant disposition, and new history index. Extend an existing relevant migration contract test rather than create a parallel suite.
2. **Notification query/action test update:** verify the M4 adapter passes explicit `p_from`, `p_to`, `p_read_state`, and complete cursor; maps the three read filters; preserves 25+1 keyset behavior; and fails safely on invalid continuation input. Update existing notification query/action tests.
3. **One archive query adapter test file:** verify M2 call argument mapping, approved/delivered-only filter validation, nullable Operator-safe normalization, 25+1 cursor behavior, and generic failure handling for both archive and incidents. Do not emulate RLS in component tests.
4. **One narrow route/navigation regression update only if required by changed guards/navigation:** prove a new role route is registered and ordinary inbox does not link to operations. Reuse app-shell/route test conventions.
5. **Localization parity:** update the existing parity mechanism or its closest focused test; do not create a separate i18n harness.

Database/RLS enforcement is proven by the applied migration/manual workflow, not by application mocks. No additional UI unit tests are required unless an existing test breaks due to the new required props/query contract.

### 8.2 Required minimal manual localhost evidence

Use only `Acme Sandbox Campaign` for any mutable demonstration.

1. As Admin, view the global archive filtered to both statuses and confirm only finalized production rows appear; client submissions do not appear. Copy and explicitly open one stored submission URL without any preview/reachability claim.
2. As PM Lead and PM Watcher, view only their permitted archive and link incidents. Confirm both are read-only and no incident resolve/dismiss control appears.
3. As Operator, view own directly assigned finalized production history only. Confirm there is no project workspace link or Drive-folder action.
4. As Client, view authorized final production archive only. Confirm no incident route/control exists.
5. As any ordinary role, use `/notificaciones`: switch All/Unread/Read, use the 90-day default and one explicit older bounded window, mark one/all read, and confirm no provider/queue data appears.
6. As Admin and an authorized PM Lead, view the existing operations queue and verify terminal suppression wording. Confirm PM Watcher cannot reach the PM queue.
7. Repeat archive/history primary controls at 375px, keyboard-only, both themes, Spanish, and English.

Record factual outcomes; do not claim provider, hosted, production, external-URL validity, or formal accessibility evidence.

## 9. Completion criteria

S07-03 and S07-04 are implementation-complete only when all statements below are true:

1. M2 and M4 are applied and types are regenerated unchanged with recorded manual provenance before dependent application code is accepted.
2. Archive data comes only from M2 and includes only finalized production `approved`/`delivered` rows. `client_submission` rows never appear.
3. Admin, PM Lead, PM Watcher, Client, and Operator archive visibility matches the M2 database scope; Operator remains own-work-only with no project browse expansion.
4. Incidents are visible only to Admin/authorized PM scope and remain read-only. No workaround mutation enters the change set.
5. Archive/incident filters are bounded server-side, range windows are at most 93 days, keyset cursors are complete, and continuation preserves the selected query.
6. Stored external URL interactions are explicit user actions and never server-verify/proxy/preview/download a link.
7. `/notificaciones` uses M4’s explicit latest-90-day default, read-state filter, bounded older-history ranges, self-only keyset pagination, and preserved mark-read behavior.
8. Ordinary users receive no operations/provider/channel/recipient data. Existing operations queue authority stays Admin + authorized PM Lead only.
9. Localization parity, loading/empty/error states, semantic presentation, keyboard behavior, focus handling, mobile layout, and locale-preserving navigation are complete.
10. The minimal verification described in section 8 has factual results, and no excluded API/provider/lifecycle/admin scope was added.

## 10. Stop conditions and decisions

| Condition | Required response |
| --- | --- |
| The applied M2/M4 signature, generated types, grants, return shape, or live catalog differs from this specification | Stop. Reconcile through a reviewed forward migration and regenerated types; do not adapt with direct table access or guessed casts. |
| M2 fails to hide Operator project ID/Drive URL or expands Client/PM scope unexpectedly | Stop as a security defect. Narrow the database projection; do not hide only in UI. |
| An archive route needs a deliverable/project detail destination that is not independently authorized | Render non-interactive text. Do not invent a route or infer access from an ID. |
| Product asks to resolve/dismiss an incident | Stop for a reviewed narrow command contract with lifecycle/audit authorization. Do not use legacy table update policy from application code. |
| A notification category/project/provider filter is requested | Stop unless a reviewed safe database projection supports it. Do not browser-filter a broad feed. |
| A continuation request lacks its complete normalized query or paired cursor | Reject safely; do not recompute broad defaults or combine state. |
| A stored external URL needs validation, preview, download, proxy, or virus/reachability scan | Out of scope; requires separate architecture/security approval. |
| Any implementation proposal adds REST/OpenAPI, polling, Realtime, scheduler, provider behavior, broad test overhead, or provider activation | Out of scope; do not include it in the plan. |

## 11. Implementation readiness

After M4 is manually applied and types regenerated unchanged, this file is the complete S07-03/S07-04 implementation-plan input. Antigravity must inspect the current checkout for exact nearby component/test names, implement only the server/RSC/client-leaf boundaries specified here, preserve existing S06 queue modules, and keep the change set limited to S07-03/S07-04.

No unresolved Project Owner decision blocks implementation. The only mandatory prerequisite is successful M4 application and exact generated-type reconciliation.
