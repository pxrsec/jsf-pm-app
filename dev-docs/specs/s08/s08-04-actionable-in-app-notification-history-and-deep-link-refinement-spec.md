---
document_id: S08-04-ACTIONABLE-IN-APP-NOTIFICATION-HISTORY-AND-DEEP-LINK-REFINEMENT-SPEC-01
sprint_id: S08
work_item: S08-04
status: implementation-ready-after-migration-application
created_at: 2026-08-25T13:55:15-06:00
schema_prerequisite:
  migration_source: supabase/migrations/20260825140000_s08_04_notification_inbox_context_and_deep_links.sql
  required_state: applied to jsf-pm-dev through Supabase MCP and reflected unchanged in src/lib/database.types.ts
predecessors:
  - dev-docs/specs/s07/s07-03-s07-04-archive-link-operations-and-notification-history-implementation-spec.md
  - dev-docs/specs/s08/s08-03-desktop-drawer-content-reflow-and-collapsed-notification-badge-spec.md
supersedes:
  - S07-04 ordinary-inbox prohibition on entity/project deep links only
implementation_scope: recipient-owned in-app notification history, role-safe contextual detail, deep navigation, and automatic read acknowledgement
out_of_scope:
  - external providers, dispatch, retries, replay, scheduling, polling, Realtime, email, WhatsApp, webhooks, and provider activation
  - notification generation lifecycle changes, recipient fan-out changes, or mutation of immutable notification events
  - notification operations queue behavior or authorization
  - new project, task, deliverable, review, invitation, or incident routes
  - permanent/all-time retention, unbounded history, full-text search, category/project filters, or browser-side broad-feed filtering
  - changes to the existing 90-day default window, 93-day bounded explicit range rule, read filters, or composite keyset pagination semantics
  - VSDD-Lite, dependency, broad shell/navigation, or unrelated UX refactors
verification_level: focused migration/query/action/component regression checks plus role-specific manual journeys
---

# S08-04 — Actionable In-App Notification History and Deep-Link Refinement

## 1. Purpose

The current `/notificaciones` screen is technically a recipient-owned 90-day history, but it is not a usable notification center. It deliberately returns only `trigger`, timestamps, and read state; the UI consequently renders generic category copy such as “Task Assignment” without identifying the task, deliverable, or project, and the only per-row action is “Mark as read.” A user cannot use a notification to inspect the work that caused it.

S08-04 makes the ordinary in-app inbox actionable while preserving its self-only security boundary:

1. Every current-window notification shows a concise, localized description of the actual relevant work context when that context is still safely available to the recipient.
2. A notification with a safely resolved destination is a keyboard-accessible navigation control. Activating it marks an unread notification read and takes the user to the correct existing role-safe item route.
3. A notification without a safe destination remains a historical record, displays its safe contextual text when available, and does not invent a route or expose an identifier.
4. Read notifications remain visible in the default **All** history; marking a notification read never deletes it, archives it, or removes it from the current 90-day history.
5. The existing explicit latest-90-day window, All/Unread/Read filter, bounded historical period, and keyset pagination remain intact.

This is not a cosmetic client-only refinement. The currently applied M4 RPC intentionally withholds every field needed to identify and authorize a destination. The required forward migration now exists at `supabase/migrations/20260825140000_s08_04_notification_inbox_context_and_deep_links.sql`. **No application implementation governed by this specification may begin until the Project Owner applies that exact migration to `jsf-pm-dev` through Supabase MCP and regenerates `src/lib/database.types.ts` from the applied schema.**

## 2. Authority and reconciliation

### 2.1 Preserved S07-04 boundaries

The following S07-04 decisions remain authoritative:

- `/notificaciones` is one shared route for every active authenticated application role.
- The ordinary inbox is self-owned: only `notification_recipients.user_id = auth.uid()` and `channel = 'in_app'` rows qualify.
- The default visible interval is the latest 90 days. Explicit historical intervals require both bounds, use `[from, to)`, and cannot exceed 93 days.
- Sorting and continuation are exactly `notification_recipients.created_at DESC, notification_recipients.id DESC`; the cursor remains a complete `(created_at, recipient_id)` pair.
- Read state remains recipient-owned. `mark_notification_read` and `mark_all_notifications_read` remain idempotent server-mediated mutations.
- Notification events are immutable. The implementation must not update, delete, backfill, reinterpret, or overwrite `notification_events.payload` to manufacture context.
- The ordinary inbox remains separate from `/admin/notificaciones` and `/pm/notificaciones`. The latter remains the restricted suppressed-delivery operations surface.
- Provider state, external channel, contact target, provider errors, attempts, queue state, suppression data, raw payload, raw event IDs, raw entity IDs, raw recipient IDs, actor identity, and audit data remain forbidden in ordinary inbox presentation.

### 2.2 Narrowly superseded S07-04 clause

S07-04 section 6.1 said the ordinary inbox must not add entity/project deep links because M4 deliberately returned no navigation authority. That restriction is superseded **only** after the S08-04 replacement RPC returns a recipient-specific, authorization-proven safe presentation projection.

This specification does not authorize UI construction of a route from raw event/entity/project IDs, payload values, title matching, a browser lookup, or a role guess. If a destination is not returned by the replacement database projection, the UI must render no navigation affordance.

### 2.3 Why a migration is required

The applied `list_my_in_app_notifications(...)` function returns only:

```text
recipient_id, trigger, created_at, occurred_at, read_at
```

Its query module intentionally discards all event context. The application cannot safely identify a project, task, deliverable, client review, or link-report target from this DTO. Returning a broad event row or `payload` to the browser would break the M4 least-privilege contract. Therefore S08-04 requires a new forward migration which replaces only the inbox read projection/function signature and its generated database type.

Do not attempt a client-only workaround, an additional base-table query, a service-role query, browser Supabase access, a payload parser, or a second per-row authorization fetch.

## 3. Product and UX contract

### 3.1 Historical inbox behavior

The default route remains:

```text
/notificaciones?from=<offset ISO>&to=<offset ISO>&read=all
```

The default **All** filter displays both unread and read notifications in the selected bounded window. It is the default historical view. A successful read acknowledgement changes only `read_at` and the unread badge/count; it does not remove the row from All.

The **Unread** filter naturally stops displaying a row after it is marked read, because the server result no longer matches the selected filter. This is correct filter behavior, not deletion. The client must refresh/query-reset after acknowledgement; it must not retain a locally stale unread row.

The **Read** filter displays acknowledged history. Mark All Read retains its existing semantics: it changes all self-owned unread in-app recipients, not only the first loaded page or selected date range. Its confirmation copy must accurately say “all unread notifications,” not imply only visible rows changed.

No UI surface promises permanent retention or all-time history. The current 90-day default and existing explicit previous 90-day range remain the product boundary.

### 3.2 Notification row hierarchy

Each row is a real list item with a single primary content/action region and a separate secondary Mark-as-read control when unread. It must show, in this order:

1. textual read/unread state; do not communicate state only with a color or pulse;
2. localized event/action title;
3. an event-specific, localized sentence that names the safe primary subject;
4. a labeled context line identifying the related project when a project name is safely returned;
5. an optional localized secondary detail such as deadline, version, review stage, or status transition only when returned by the safe projection;
6. the notification occurrence/creation time in a `<time>` element;
7. a visible “View details” affordance only when `destination.kind !== 'none'`.

The row must not show a raw UUID, raw enum, raw payload JSON, actor/user identity, client contact, comment/review body, submission URL, provider data, or an unverified external link.

The subject is substantive context, not a generic category label. Examples of required outcome quality:

| Trigger family | Required subject/context outcome | Safe navigation destination when authorized |
| --- | --- | --- |
| `project_assigned`, project-related `system` | “You were assigned to **{projectName}**.” | Role-safe project route. |
| `task_assigned`, `task_status_changed`, `client_task_blocking`, deadline triggers | “**{taskTitle}** in **{projectName}** …” | Operator/client task detail when recipient is the authorized direct assignee; otherwise Admin/PM workspace Tasks tab. |
| `deliverable_submitted`, review outcomes, deliverable delivery, inactivity | “**{deliverableTitle}** in **{projectName}** …” with version/stage when safely returned. | Client review detail for a client recipient where that existing detail is authorized; otherwise Admin/PM workspace Deliverables tab; operator task detail for the direct assignee. |
| `client_submission_received`, `client_submission_reopened` | Name the client-submission deliverable and project. Do not expose a client identity or submission URL. | Client task detail for the direct client assignee; Admin/PM workspace Deliverables tab for authorized PM/Admin. |
| `link_reported_broken` | Name the affected deliverable/project and state that a link issue was reported. Do not render report reason or reporter. | Owner’s existing task/workspace destination only when safely authorized. |
| `user_invited`, `invite_expiring`, unknown/legacy `system` | Use a localized generic historical message; no fabricated subject or link. | `none`. |

The English and Spanish catalogs must use semantic messages with interpolation, not concatenation in a query/action module. The actual copy may be refined, but it must make the related subject clear enough that a user understands what will open.

### 3.3 Click and acknowledgement behavior

For an unread notification with a valid destination:

1. User activates the row’s primary “View details” control by mouse, touch, Enter, or Space as appropriate to the semantic control.
2. The client invokes a new dedicated acknowledgement-and-navigation server action with only the opaque self-owned recipient identifier. It must not accept an href, role, entity ID, project ID, task ID, deliverable ID, locale, or destination kind from the browser.
3. The action validates the UUID, requires an active authenticated session, calls a new self-owned database command, revalidates the inbox and protected-shell unread count only after a successful command result, and returns a narrow result `{ ok, changed }` or a safe error code.
4. After `ok`, the client performs locale-preserving navigation using the destination previously supplied by the safe RSC projection. It may navigate whether `changed` is true or false; `changed: false` means the row was already read, not an error.
5. The destination route independently enforces its normal session/role/RLS/data authorization. A notification acknowledgement is not authorization to access the destination.

For a read notification with a valid destination, navigate directly without a read mutation. For an unread notification with no destination, keep the explicit Mark-as-read control. The row itself must not pretend to be navigable.

**Failure rule:** if the acknowledgement action returns a validation, authentication, or unavailable error, do not navigate. Preserve the current inbox state, focus, and render a localized alert. This prevents a user from being sent away while the acknowledgement silently fails.

**Race/idempotency rule:** concurrent clicks, a stale browser tab, a manually marked row, or multiple recipient sessions may yield `changed: false`. Treat this as successful acknowledgement and navigate once. Do not retry the mutation in a loop.

### 3.4 Interaction and visual requirements

- Use an actual `Link` for a read row’s safe destination. For an unread row, use a button-like primary control only if the action must complete before navigation; do not nest a `<button>` in an `<a>` or an `<a>` in a `<button>`.
- A simple robust composition is an interactive primary content control plus a sibling Mark-as-read button. The primary control must contain title/context and visible “View details” cue; the sibling may only mark read. Do not make the entire `<li>` clickable while also placing a button inside it.
- The primary detail action and standalone mark-read action must each meet the established `min-h-[44px] min-w-[44px]` target. At narrow widths they may stack; neither may overlap or obscure subject text.
- Use an obvious non-color affordance for navigable rows: visible “View details” text plus a directional icon. Hover/focus treatments are supplementary only.
- A read row remains visually quieter than an unread row but retains the same context and navigation affordance.
- Use `aria-label` for the detail control that combines the localized action, event/action title, primary subject, and project context where available. Do not include raw IDs or repeat decorative icon names.
- The list remains an ordered list with its existing localized label. Item content must be announced coherently without duplicate interactive names.
- Preserve the existing status live region, alert region, focus restoration for a row removed by the Unread filter, and reduced mobile layout. Add a pending indicator and disable only the activated row’s controls while its acknowledgement is in flight; do not block pagination/filtering/other rows globally solely because one acknowledgement is pending.
- Do not add a confirmation dialog. Opening a notification is a direct, expected action.

## 4. Role-safe destination model

### 4.1 Database-owned destination enum

Introduce a narrow browser-safe destination union in the replacement RPC. The database determines whether a destination is authorized at query time. The browser maps a finite kind to an existing local route pattern; it cannot invent a route from arbitrary data.

```ts
export type NotificationDestination =
  | Readonly<{ kind: "none" }>
  | Readonly<{ kind: "admin_project_tasks"; projectId: string }>
  | Readonly<{ kind: "admin_project_deliverables"; projectId: string }>
  | Readonly<{ kind: "admin_project_overview"; projectId: string }>
  | Readonly<{ kind: "pm_project_tasks"; projectId: string }>
  | Readonly<{ kind: "pm_project_deliverables"; projectId: string }>
  | Readonly<{ kind: "pm_project_overview"; projectId: string }>
  | Readonly<{ kind: "operator_task"; taskId: string }>
  | Readonly<{ kind: "client_task"; taskId: string }>
  | Readonly<{ kind: "client_deliverable_review"; deliverableId: string }>
  | Readonly<{ kind: "client_project"; projectId: string }>;
```

The implementation may use a database text enum/check or return a validated text discriminator. It must not return an arbitrary `href`, absolute URL, redirect target, raw entity type, raw entity ID, raw event ID, or route supplied by JSON payload. The application owns the finite kind-to-route map.

### 4.2 Existing route map

The route map is fixed for this slice:

| Destination kind | Existing application path emitted by the client route builder |
| --- | --- |
| `admin_project_overview` | `/admin/proyectos/{projectId}` |
| `admin_project_tasks` | `/admin/proyectos/{projectId}?tab=tasks` |
| `admin_project_deliverables` | `/admin/proyectos/{projectId}?tab=deliverables` |
| `pm_project_overview` | `/pm/proyectos/{projectId}` |
| `pm_project_tasks` | `/pm/proyectos/{projectId}?tab=tasks` |
| `pm_project_deliverables` | `/pm/proyectos/{projectId}?tab=deliverables` |
| `operator_task` | `/operador/tareas/{taskId}` |
| `client_task` | `/cliente/tareas/{taskId}` |
| `client_deliverable_review` | `/cliente/entregables/{deliverableId}` |
| `client_project` | `/cliente/proyectos/{projectId}` |

Use the existing `@/i18n/routing` navigation helpers. Do not prepend `/en` manually, stringify arbitrary query values, or use `window.location`.

### 4.3 Authorization rules for destination derivation

The RPC must derive destination only after it establishes the current recipient’s active role/profile and verifies the current target. The returned destination is a convenience projection, not an authorization grant.

| Recipient role/current authorization | Eligible destination rules |
| --- | --- |
| Admin | A non-deleted referenced project may resolve to an Admin project overview/tasks/deliverables tab according to notification subject. No destination for a record lacking a current safe project/subject. |
| PM | A current, non-deleted PM membership in the referenced project is required. Both PM Lead and PM Watcher may receive the existing read-oriented workspace destination. Do not infer PM operations-queue authority. |
| Operator | Only a non-deleted task where `tasks.assignee_id = auth.uid()` may resolve to `operator_task`. Deliverable events resolve through their current non-deleted parent task only when that task is directly assigned to the operator. Never return a project workspace destination to an operator. |
| Client | A client destination requires current active client membership/role-safe data access in the referenced project. A client-submission task directly assigned to the client can resolve to `client_task`; a production review deliverable that the existing client detail query currently authorizes can resolve to `client_deliverable_review`; otherwise a safe existing `client_project` may be used only when it truthfully helps the user inspect the referenced current project. Never return internal PM/Admin workspace paths. |
| Any role where event target/project/task/deliverable is deleted, absent, no longer accessible, legacy-unresolvable, or not authorized | `none`; the event remains in history with no link. |

The database must not grant a link merely because `notification_events.project_id`, `entity_id`, title, or a payload field is populated. It must join/verify the live target and current recipient scope. Visibility changes after the notification was created must be respected; a historic notification may remain visible while its destination is correctly unavailable.

### 4.4 Trigger-to-subject/destination resolution

The replacement query must resolve current context by relational data, never by trusting `payload`. `payload` can provide no browser-visible field in this slice.

| Trigger(s) | Primary subject source | Destination source | If source does not resolve safely |
| --- | --- | --- | --- |
| `project_assigned`; `system` with a currently resolvable project event | `projects.name` | `notification_events.project_id` plus current membership/role check | Safe generic message; `none`. |
| `task_assigned`, `task_status_changed`, `client_task_blocking`, `deadline_24h`, `deadline_12h`, `deadline_6h`, `deadline_overdue` | `tasks.title`, `projects.name`; current task deadline/status when necessary | Event task entity joined to current non-deleted task/project | Generic category context; `none`. |
| `deliverable_submitted`, `internal_changes_requested`, `internal_review_approved`, `client_changes_requested`, `client_review_approved`, `deliverable_delivered`, `review_inactivity_reminder`, `client_submission_received`, `client_submission_reopened` | `deliverables.title`, parent `tasks.title` when allowed for role routing, `projects.name`, current version/status/stage only when it is a safe generic workflow fact | Event deliverable entity joined to current non-deleted deliverable/task/project | Generic category context; `none`. |
| `link_reported_broken` | Resolve `deliverable_link_reports.id = entity_id`, then current non-deleted deliverable/task/project | Same linked target chain and role checks | Generic link-issue message; `none`. |
| `user_invited`, `invite_expiring` | No current app subject is required | none | Localized generic invitation history; `none`. |
| all other `system`, unknown future trigger, malformed legacy event | No invented entity/title | none | Localized generic system history; `none`. |

For status/review context, use only finite localized semantic values (for example `oldStatus`, `newStatus`, `reviewStage`, `deadlineAt`, `versionNumber`) validated by the query adapter. Do not pass arbitrary free text such as comments, reopen reasons, report reasons, actor names, internal description, specifications, submission notes, or external URLs.

## 5. Required data contract and forward migration

### 5.1 Applied-schema prerequisite and authored migration

The required candidate migration has been authored at:

```text
supabase/migrations/20260825140000_s08_04_notification_inbox_context_and_deep_links.sql
```

**Hard gate:** this specification is executable only after the Project Owner applies that exact reviewed source to `jsf-pm-dev` through Supabase MCP and regenerates `src/lib/database.types.ts` unchanged from the resulting schema. The migration is repository source only at the time of this specification update; it is not evidence that the development database has changed.

If a later migration has already landed before application, create a newly reviewed, timestamp-correct candidate rather than renaming an already committed source. Do not reorder applied history.

The migration is transactional and must:

1. drop only the current six-argument `public.list_my_in_app_notifications(integer, timestamptz, timestamptz, boolean, timestamptz, uuid)` overload;
2. recreate the same function name/signature, pagination/range/read-state behavior, owner, `STABLE`, `SECURITY DEFINER`, and `search_path = pg_catalog, public` hardening;
3. preserve revocation from `PUBLIC`/`anon` and grant execution only to `authenticated`;
4. preserve the existing exact keyset predicate/order and `notification_recipients_in_app_history_keyset_idx` unless an explain-backed schema review proves a narrow additional index is required;
5. add only the recipient-safe contextual projection defined below;
6. create `public.acknowledge_notification_and_navigate(uuid)` as the new recipient-owned read command, with equivalent security hardening and ACL posture to `mark_notification_read`;
7. leave `mark_notification_read` and `mark_all_notifications_read` behavior available for their existing controls;
8. avoid any update to `notification_events`, notification generation functions, recipient fan-out triggers, RLS policies, external delivery, or queue functions.

Regenerate `src/lib/database.types.ts` through the approved Supabase type-generation workflow after application. Never manually edit the generated file.

### 5.2 Replacement RPC return shape

The SQL function returns one narrow row per self-owned in-app recipient. The exact SQL aliases must match generated types and adapter validation.

```text
recipient_id uuid
trigger notification_trigger
created_at timestamptz
occurred_at timestamptz
read_at timestamptz null
subject_kind text             -- finite: project | task | deliverable | invitation | system
subject_title text null       -- safe current project/task/deliverable title only
project_name text null        -- safe current project name only
context_kind text             -- finite semantic presentation key, never arbitrary prose
context_value text null       -- finite/safe value only: status, stage, bounded version integer, deadline timestamp
navigation_kind text          -- finite union discriminator above
navigation_project_id uuid null
navigation_task_id uuid null
navigation_deliverable_id uuid null
```

The migration must guarantee the following projection invariants:

- exactly one navigation ID is non-null for a non-`none` kind, and it matches the kind;
- all navigation IDs are null for `navigation_kind = 'none'`;
- a title/project name may be returned only from a current row whose access check succeeded for the recipient;
- `subject_title`, `project_name`, and `context_value` never derive from `payload` or free-text fields;
- no `entity_id`, `event_id`, `actor_id`, raw `entity_type`, payload, recipient delivery status, channel, provider/suppression field, user/contact data, comments, external URL, or report reason is returned;
- unknown trigger/source mismatch returns a valid generic no-destination row instead of leaking an exception;
- a missing/deleted target never removes the history recipient row merely because its context cannot resolve.

The existing adapter’s `25 + 1` behavior remains: request 26 rows, validate all rows needed for continuation, retain 25, and derive the cursor from returned row 25. A malformed response must fail closed with the existing generic unavailable result; it must not silently create an unsafe fallback link.

### 5.3 Acknowledgement command

Create:

```text
public.acknowledge_notification_and_navigate(p_notification_recipient_id uuid)
returns boolean
```

The function must:

- bind `auth.uid()` into a local variable and explicitly reject a null unauthenticated actor;
- confirm an active, non-deleted application profile as the existing inbox function does;
- update only `notification_recipients` where `id = p_notification_recipient_id`, `user_id = auth.uid()`, `channel = 'in_app'`, and `read_at IS NULL`;
- set `read_at = now()`, `delivery_status = 'read'`, and `updated_at = now()`;
- return `true` exactly when it changed one self-owned unread in-app row; return `false` when already read/not owned/not in-app;
- have no parameter or return field involving destination or entity data;
- be idempotent and safe under repeat calls;
- be `SECURITY DEFINER`, postgres-owned, use `search_path = pg_catalog, public`, revoke `PUBLIC`/`anon`, and grant only `authenticated`.

The command is deliberately separate from the generic mark-one function so the UI/action intent is explicit and testable. It must not delete, archive, hide, or otherwise alter history.

## 6. Application architecture and file responsibilities

Use the existing RSC-first flow:

```text
Notification RSC route
  -> authenticated server-only inbox query
  -> safe contextual inbox RPC projection
  -> client inbox/item interaction leaf
  -> dedicated acknowledgement server action (only for unread navigation)
  -> locale-preserving client route transition
  -> independently authorized target RSC route
```

No client component creates a Supabase client. No direct table/view select enters route/component code.

### 6.1 Contracts and schemas

Modify `src/lib/notifications/inbox-contracts.ts` to replace the primitive history item with strict finite presentation types. Required fields include recipient ID, trigger, timestamps/read state, subject/context, and validated `NotificationDestination`.

Create or extend strict Zod schemas in `src/lib/notifications/schemas.ts` for:

- every finite navigation kind;
- destination ID/kind consistency;
- supported subject/context kinds;
- nullable safe titles with bounded length consistent with source constraints;
- timestamp and bounded integer/version validation;
- `AcknowledgeNotificationNavigationSchema` accepting exactly `{ notificationRecipientId: uuid }`.

Do not use `any`, broad type casts, or trust generated RPC rows without validation.

### 6.2 Query adapter

Modify `src/lib/notifications/queries.ts` only to call and validate the replacement RPC projection. It must preserve explicit normalized date range/read state/cursor mapping and 25+1 pagination.

The adapter maps only validated fields into `RecipientInboxNotification`; it does not localize text, create an href, expose raw SQL errors, or inspect raw payload. Use the existing generic failure/logging pattern without logging full database rows containing potentially sensitive data.

### 6.3 Route builder

Create one small pure helper under the notification feature, for example:

```text
src/lib/notifications/destination-routes.ts
```

It accepts a validated `NotificationDestination` and returns an internal `Href | null` using the finite table in section 4.2. It may add only the fixed `tab=tasks`/`tab=deliverables` query value. It must reject impossible kind/ID combinations defensively and return `null`; it must never accept arbitrary URLs, paths, query strings, locale values, or raw entity types.

Keep locale handling in the existing `@/i18n/routing` Link/router layer. The builder emits canonical unprefixed internal paths only.

### 6.4 Server actions

Modify `src/lib/notifications/actions.ts`:

- retain `markNotificationReadAction`, `markAllNotificationsReadAction`, and continuation behavior;
- add `acknowledgeNotificationNavigationAction(rawInput)` that validates input, calls the new RPC, maps errors to the current safe action-error union, revalidates the same exact inbox/shell paths after a successful RPC invocation, and returns `{ ok: true, changed }`;
- never accept destination data from the browser;
- do not call a client route transition, redirect, or target query inside the action;
- do not revalidate after a failed database call.

### 6.5 Client components

Modify these existing files without converting the RSC page to a client component:

| File | Required responsibility |
| --- | --- |
| `src/app/[locale]/(protected)/notificaciones/_components/notification-inbox.tsx` | Own per-recipient pending/error state; receive navigation intent from an item; invoke acknowledgement action for unread valid destinations; after success use the existing locale router to navigate; preserve list/filter/continuation behavior and focus recovery. |
| `src/app/[locale]/(protected)/notificaciones/_components/notification-inbox-item.tsx` | Present the new contextual row; calculate `href` from the validated route helper; render safe navigation versus no-destination/read-only behavior; preserve a separate explicit Mark-as-read control for unread records. |
| `src/app/[locale]/(protected)/notificaciones/_components/types.ts` | Retire category-only presentation as the sole message model; retain trigger-category mapping only if needed for finite event semantics, and add an explicit trigger/context-to-localization-key map with exhaustiveness. |
| `src/app/[locale]/(protected)/notificaciones/_components/notification-inbox.test.tsx` | Update existing fixtures and add only focused contract regressions in section 9. |

Do not change the `/notificaciones` search-state URL schema, filters, date utility, mobile navigation, notification operations pages, generic archive routes, or target route authorization for this item.

## 7. Localization and accessibility

### 7.1 Localization

Extend `notifications` in both `messages/en-US.json` and `messages/es-MX.json` with identical key structure. Required semantic coverage:

- detail action label and aria label;
- unavailable/no-longer-accessible historical context label, if shown;
- event-specific sentence templates for every current trigger family;
- project-context label;
- safe finite status/stage/deadline/version labels;
- navigation-in-progress state;
- acknowledgement failure copy separate from generic load-more failure;
- all existing read/unread/history/filter/empty/error wording preserved.

Use the existing `next-intl` formatter for dates. Dates must include a localized label where event context makes them meaningful (for example deadline) and use a semantic `<time dateTime>`.

Message catalog parity is mandatory. Do not leave Spanish/English placeholders or retain the current generic category descriptions as the primary user-facing notification body for a resolved notification.

### 7.2 Accessibility requirements

1. One logical H1, existing list semantics, and existing filters remain unchanged.
2. Read/unread state remains textual.
3. Every destination-capable notification provides a visible, localized detail action and an accessible name that names the subject/context.
4. The user can Tab to primary detail action, then Mark-as-read when available, without nested/interleaved interactive semantics.
5. When an unread navigation acknowledgement succeeds, normal route navigation changes focus according to the destination page’s existing App Router behavior. Do not attempt a stale inbox focus restoration after navigation.
6. When acknowledgement succeeds while Unread filtering removes a row without navigating (standalone Mark-as-read), retain the current status-region focus recovery behavior.
7. Use `aria-busy` or equivalent pending semantics on the activated control; icons are `aria-hidden` unless they carry unique text alternative value.
8. Preserve minimum 44px targets, keyboard operation, light/dark contrast, 375px layout, and both supported locales.

## 8. Security and data invariants

1. Only the replacement self-owned RPC may supply browser notification context/destination fields.
2. The database, not the browser, decides whether current recipient authorization permits a destination.
3. A valid UUID, notification event field, payload field, or prior recipient status never establishes authority.
4. Every destination target route independently validates role and scope. The inbox deep link adds no bypass.
5. Never expose provider/channel/suppression/operations data in `/notificaciones`.
6. Never display comments, review feedback, report reasons, submission notes/URLs, actor identity, or raw JSON as contextual notification detail.
7. A missing, deleted, revoked, or no-longer-authorized target produces `navigation_kind = 'none'`, not a guessed redirect, unauthorized path, or target-existence error.
8. History is not hidden when its target becomes unavailable. The event remains a self-owned notification receipt within the selected history window.
9. Acknowledgement can mutate only the caller’s own unread in-app recipient row. It cannot mark an arbitrary recipient, external-channel row, or event read.
10. The migration retains the complete composite cursor contract. A timestamp-only cursor is forbidden.
11. Do not create additional per-row server actions/data queries. The list RPC must amortize contextual resolution without an N+1 application query pattern.
12. Do not use the `notification_events.payload` object as a public application contract. It is historical internal metadata and may contain free text not appropriate for this surface.

## 9. Minimal essential verification

The Project Owner has not requested broad ceremony. Implement focused contract tests plus the smallest manual role matrix required to prove the changed behavior.

### 9.1 Required automated evidence

1. **Migration/static contract update** — extend the existing notification migration/database contract test to assert:
   - the six-argument inbox function replacement preserves range/read-state/composite cursor/access/ACL clauses;
   - the new safe projection fields are present;
   - forbidden event/payload/provider identifiers are absent from the return contract;
   - `acknowledge_notification_and_navigate(uuid)` has active-auth/self-owned/in-app/read-at/ACL hardening;
   - the migration does not mutate notification-event rows or dispatch/provider functions.
2. **Notification query tests** — update `src/lib/notifications/__tests__/queries.test.ts` to verify valid projection mapping, malformed/unsafe destination rejection, `none` destination behavior, retained 25+1 cursor, all/read/unread mapping, and generic failure handling.
3. **Notification action tests** — update `src/lib/notifications/__tests__/actions.test.ts` to verify acknowledgement accepts only the UUID envelope, calls only the new RPC with that ID, revalidates on success, handles `changed: false` as success, and does not accept/forward destination fields.
4. **Inbox component tests** — update the existing component test file to verify:
   - resolved task/deliverable/project context is visible and raw IDs/payload remain absent;
   - read destination uses the correct existing route;
   - unread detail activation calls acknowledgement once and navigates only after successful result;
   - failed acknowledgement does not navigate;
   - standalone read mutation remains available and All retains the refreshed read record while Unread removes it through normal refresh;
   - no-destination historical row has no link/detail action but remains readable and markable;
   - accessible names, semantic list items, and 44px controls remain present.
5. **Localization parity** — extend the existing catalog parity test for every new `notifications` key.
6. **Type/lint/format** — run the current focused commands:

```bash
npm test -- src/lib/notifications/__tests__/queries.test.ts src/lib/notifications/__tests__/actions.test.ts "src/app/[locale]/(protected)/notificaciones/_components/notification-inbox.test.tsx" __tests__/database/s07-e09-migrations.test.ts __tests__/i18n/message-catalogs.test.ts
npm run typecheck
npm run lint
npm run format:check
```

If migration application is in scope, perform the approved live schema/type-generation workflow and add a direct database boundary check using real authenticated identities. Application mocks do not prove self-only RPC enforcement.

### 9.2 Required manual journeys

Use only `Acme Sandbox Campaign` for any mutable data.

| Journey | Required outcome |
| --- | --- |
| Operator receives task assignment/deadline notification | Row names task/project; unread detail action marks it read then opens `/operador/tareas/{taskId}`; returning to All shows it Read; Unread no longer shows it. |
| Admin receives deliverable/project notification | Row names deliverable/project; opens the existing Admin workspace with correct `tab`; no raw IDs/payload/provider data. |
| PM Watcher receives a project/deliverable notification | Opens only the existing read-safe PM workspace route; no notification-operations authority appears. |
| Client receives a client request/submission or production review notification | Opens only an authorized existing client task/deliverable/project route; no internal workspace or PM/Admin route is emitted. |
| Read notification | Detail action navigates without another acknowledgement mutation; history persists in All/Read. |
| Deleted/revoked/legacy/unresolvable target fixture | Notification remains in history, shows safe fallback context, has no detail link, and can be marked read. |
| Acknowledgement failure | User remains in inbox; visible localized error occurs; no navigation. |
| 375px, keyboard-only, light/dark, Spanish and `/en/` English | Detail/mark controls are reachable, names/context are intelligible, no overlap/nested control issue, and locale route prefix is preserved. |

## 10. Acceptance criteria

### A. Useful notification history

- [ ] Default All view retains read and unread records inside the explicit latest-90-day window.
- [ ] Read acknowledgement never deletes, hides, archives, or otherwise removes a record from All history.
- [ ] Each resolvable task, deliverable, or project notification identifies meaningful safe subject and project context rather than only a generic category.
- [ ] Unresolvable/legacy records stay visible as historical entries without fabricated context or routes.

### B. Deep navigation

- [ ] Every returned destination is a finite validated kind and route-safe ID combination.
- [ ] A detail action opens the correct existing role-safe route and tab for each eligible role.
- [ ] Unread detail activation acknowledges first and navigates only after successful acknowledgement result.
- [ ] Read detail activation navigates directly.
- [ ] No-destination rows have no deceptive click target.
- [ ] No browser input can choose a destination, role, path, entity ID, project ID, task ID, or deliverable ID for the acknowledgement mutation.

### C. Database and security

- [ ] A reviewed forward migration replaces the M4 projection without weakening its self-only range/read/keyset/ACL contract.
- [ ] Generated database types are regenerated through the approved workflow.
- [ ] Context/destination are relationally resolved and current-recipient-authorized in the database.
- [ ] Raw payload/event/entity/provider/contact/comment/external-link data remain excluded from ordinary inbox DTO/UI.
- [ ] `acknowledge_notification_and_navigate` can change only caller-owned unread in-app recipient state and is idempotent.
- [ ] Operations queue authority and provider posture are unchanged.

### D. Accessibility and localization

- [ ] Detail and mark-read interactions are semantic, keyboard reachable, non-nested, and at least 44px.
- [ ] Read/unread state and navigation purpose are textual and accessible.
- [ ] Errors prevent navigation and are announced safely.
- [ ] English/Spanish notification keys have exact structural parity.
- [ ] Existing filters, pagination, focus recovery, mobile layout, and desktop shell behavior regressions are absent.

## 11. Stop conditions and decisions

| Condition | Required response |
| --- | --- |
| Applied database signature/types differ from the reviewed S08-04 migration | Stop. Reconcile through a newly reviewed forward migration and regenerate types; do not use casts or direct tables to force implementation. |
| The S08-04 migration has not been applied to `jsf-pm-dev` or generated types are absent/drifted | Do not begin application implementation. Apply the reviewed migration through Supabase MCP, regenerate `src/lib/database.types.ts`, and verify the resulting signature first. |
| A required trigger cannot be relationally resolved to a current safe subject/destination | Return safe generic context and `none`; do not inspect payload or invent a route. |
| A role-safe target route does not currently exist or its route query cannot select the required view | Use an existing safe project/task/deliverable destination or `none`. Do not create a new route in this slice. |
| Destination would expose a PM/Admin/internal route to client/operator or expand PM Watcher authority | Stop as a security defect; return `none` until the database projection/route mapping is corrected. |
| Current target access is revoked/deleted | Preserve historical inbox record with `none`; do not make a target-existence distinction visible. |
| Implementation proposes a browser payload parser, N+1 authorization query, arbitrary href, service role, direct base table access, Realtime, polling, provider work, or retention expansion | Reject as out of scope. |
| A new migration has landed and makes the candidate timestamp stale | Renumber only the new candidate migration timestamp after confirming the current migration inventory. |

## 12. Implementation completion report

The implementation report must include:

1. exact changed files and applied migration/type-generation provenance;
2. the final return projection and explicit forbidden fields confirmation;
3. destination kind-to-route table actually implemented;
4. confirmation that unknown/deleted/unauthorized targets remain history with no link;
5. acknowledgement idempotency/revalidation behavior;
6. focused test commands and factual outcomes;
7. manual role journeys performed, including an unavailable-target case;
8. any deviation, migration application blocker, or unresolved route authorization issue.

Do not claim universal historical retention, provider delivery, target existence, broad end-to-end coverage, or formal accessibility certification.
