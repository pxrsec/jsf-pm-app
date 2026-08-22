---
title: S06-04 Authorized Internal Notification Queue and Suppressed-Delivery Diagnostics Specification
status: implementation-ready-after-migration
sprint_id: S06
epic_id: E08
work_item_id: S06-04
feature_slug: s06-04-authorized-internal-notification-queue-suppressed-delivery-diagnostics
project: Joya Star Films Project Management App
authority:
  - Project Owner direction
  - ADR-024 Deferred External Provider Activation and Epic 08 Capability Delivery
  - dev-docs/specs/s06/s06-e08-notification-scheduling-and-external-providers-capability-track-sprint-plan.md
  - dev-docs/specs/s06/s06-e08-notification-capability-contract-mapping-reference.md
  - supabase/migrations/20260822140000_s06_e08_notification_capability_suppression.sql
  - supabase/migrations/20260822150000_s06_e08_alert_evaluation.sql
  - supabase/migrations/20260822160000_s06_e08_notification_inbox_keyset_pagination.sql
  - supabase/migrations/20260822170000_s06_e08_notification_operations_queue_keyset_pagination.sql
  - src/lib/database.types.ts
prerequisites:
  - S06-01, S06-02, and S06-03 complete
  - 20260822170000_s06_e08_notification_operations_queue_keyset_pagination.sql applied to jsf-pm-dev through Supabase MCP
  - post-migration src/lib/database.types.ts regenerated unchanged through Supabase MCP and committed
scope: authorized read-only suppressed-delivery operations queue; safe inline suppression explanation; no alert evaluation or provider operation
---

# S06-04 — Authorized Internal Notification Queue and Suppressed-Delivery Diagnostics

## 1. Objective

Deliver a read-only, localized, accessible internal operational queue that lets only:

- an active `admin` inspect all authorized terminal external-delivery suppression records; and
- an active application-role `pm` who has at least one active `pm_lead` membership inspect only the projects that the applied database function authorizes.

The queue proves only this S06 fact: an otherwise eligible external channel was **not sent** because external delivery is disabled, and that terminal record will **not auto-send, retry, or requeue later**. It must not expose recipient identity, contact data, provider/configuration detail, raw payloads, raw errors, or an external-send claim.

This work item adds no notification producer, no external dispatch, no provider client/SDK/network request, no evaluator invocation, no schedule, no webhook, no RLS policy, no base-table read, no queue mutation, and no retry/requeue control.

## 2. Required migration and implementation start gate

### 2.1 Why a migration is required

The applied pre-S06-04 `public.list_suppressed_notification_operations(integer, timestamptz)` function orders grouped operations by `max(suppressed_at) DESC, event_id DESC` but accepts only a timestamp continuation. A page boundary shared by multiple aggregated event/channel records can omit records. Client-side deduplication cannot correct an omitted row and is forbidden.

The required forward migration is:

```text
supabase/migrations/20260822170000_s06_e08_notification_operations_queue_keyset_pagination.sql
```

It replaces only the queue read-function overload with a lossless composite cursor. It does not change notification rows, suppression invariants, fan-out eligibility, RLS policies, grants other than the replacement function signature, provider posture, alert evaluator, Realtime publication, or ordinary recipient inbox behavior.

### 2.2 Application work may begin only after all three facts are true

1. The exact migration source above is applied once to `jsf-pm-dev` through Supabase MCP.
2. `src/lib/database.types.ts` is regenerated from that applied database through Supabase MCP and written unchanged.
3. The generated public function argument shape is verified as:

```ts
type ListSuppressedNotificationOperationsArgs = {
  p_limit?: number;
  p_before_suppressed_at?: string;
  p_before_event_id?: string;
  p_before_channel?: Database["public"]["Enums"]["notification_channel"];
};
```

Do not start S06-04 against the superseded two-argument function. Do not hand-edit generated types, alter prior migration history, use dashboard SQL, or compensate in the browser.

## 3. Governing boundaries and explicit reconciliation

### 3.1 Authority precedence

1. Direct Project Owner direction and ADR-024.
2. Applied migration source and generated types derived from it.
3. Sprint 06 plan and S06-01 mapping reference.
4. This specification.
5. `AGENTS.md` and established repository patterns.

Any disagreement with a higher authority is a stop condition. Do not widen data exposure, infer authorization in a component, or add a provider behavior to work around a UI limitation.

### 3.2 S06 work-item separation

| Work item | S06-04 treatment |
| --- | --- |
| S06-02 configuration/adapters | Preserve; do not import `config.ts`, provider capability, adapter, or configuration-result code into the queue. Queue state is persisted terminal suppression, not a live configuration inspection surface. |
| S06-03 recipient inbox | Preserve. The recipient inbox contains only caller-owned `in_app` history. No queue field, operational explanation, or queue navigation is added there. |
| S06-04 | This specification. Read-only authorized queue, bounded continuation, and safe inline terminal explanation. |
| S06-05 manual evaluator | Deferred completely. It alone owns the manual confirmation dialog, demo-flag/posture checks, `evaluate_notification_alerts` action, aggregate evaluator result, and any action-issued toast. |
| S06-06 provider endpoints | No endpoint, webhook, receipt, or provider guard work. |
| S06-07 navigation/closeout | No desktop/mobile navigation links or menus. Route reachability is sufficient. |

### 3.3 Sprint-plan module-list inconsistency — resolved for S06-04

The S06-04 expected-module list names `manual-alert-evaluation-dialog.tsx`, while S06-05 explicitly owns creating the manual control and its evaluator action. The S06-04 scope contains no authorized mutation that creates suppression records. Therefore S06-04 **must not create a manual-evaluation dialog, evaluator action, demo-flag read, or toast**. The S06-04 “diagnostic” is the localized, role-safe, inline terminal state rendered from the persisted safe queue projection. Action-issued diagnostics remain S06-05 work.

This resolution prevents an unused dialog, duplicate evaluator ownership, and a false implication that queue inspection sent anything.

## 4. Applied database contract after the required migration

### 4.1 Sole operations read boundary

Use only:

```text
public.list_suppressed_notification_operations(
  p_limit integer default 50,
  p_before_suppressed_at timestamptz default null,
  p_before_event_id uuid default null,
  p_before_channel public.notification_channel default null
)
```

The function is `security definer`, requires `auth.uid()`, clamps `p_limit` to 1–100, and returns only authorized aggregate rows. It accepts either a wholly null cursor for the first page or all three continuation values. A partial cursor and an `in_app` channel cursor are rejected by the database.

The database orders results exactly by:

```sql
last_suppressed_at DESC, event_id DESC, channel DESC
```

The continuation predicate is the corresponding lexicographic “older than” condition:

```sql
last_suppressed_at < p_before_suppressed_at
OR (
  last_suppressed_at = p_before_suppressed_at
  AND event_id < p_before_event_id
)
OR (
  last_suppressed_at = p_before_suppressed_at
  AND event_id = p_before_event_id
  AND channel < p_before_channel
)
```

The database is the authorization authority:

- **Admin:** all suppressed external aggregates, including project-null events.
- **PM:** only event rows with a non-null project where the caller has an active non-deleted `pm_lead` project membership, the caller profile is active/non-deleted, and `profiles.role = 'pm'`.
- **PM Watcher, Operator, Client, unauthenticated, inactive, or deleted profiles:** no authorized operational data.

The application must independently require its cookie-authenticated active session and route-level role/capacity eligibility; it must never rely on a browser role claim.

### 4.2 Safe projection and browser DTO

The raw function return includes opaque `event_id` and `project_id` only for server-side cursor and projection handling. It does not expose recipient rows, contact values, raw payloads, or provider state.

The browser receives only this DTO:

```ts
export type NotificationOperationsChannel = "email" | "whatsapp";
export type NotificationOperationsStatus = "suppressed";
export type NotificationSuppressionReason = "provider_disabled";

export type SuppressedNotificationOperation = Readonly<{
  eventId: string; // opaque cursor-only value; never rendered, routed, logged, or labelled
  channel: NotificationOperationsChannel;
  status: NotificationOperationsStatus;
  reason: NotificationSuppressionReason;
  trigger: NotificationTrigger;
  projectName: string | null;
  recipientCount: number;
  firstCreatedAt: string;
  lastSuppressedAt: string;
}>;

export type SuppressedNotificationOperationsCursor = Readonly<{
  beforeSuppressedAt: string;
  beforeEventId: string;
  beforeChannel: NotificationOperationsChannel;
}>;

export type SuppressedNotificationOperationsPage = Readonly<{
  operations: readonly SuppressedNotificationOperation[];
  nextCursor: SuppressedNotificationOperationsCursor | null;
  hasMore: boolean;
}>;
```

`eventId` is permitted only because it is required to form the opaque continuation cursor. It must not appear in a DOM attribute, visible string, URL, `aria-*` label, log, analytics event, test snapshot assertion, route target, or client-side filter key. Do not forward `project_id` at all. A null `projectName` is displayed through one generic localized “no project context” label and does not distinguish an absent/deleted/unauthorized project.

Reject unexpected enum values at the server boundary. The only accepted S06 values are `email`, `whatsapp`, `suppressed`, and `provider_disabled`. An impossible applied-database value is a safe server failure, not a raw fallback label.

### 4.3 Terminal suppression rules to preserve in UI

A queue record means exactly:

- channel: `email` or `whatsapp`;
- status: `suppressed`;
- reason: `provider_disabled`;
- no provider attempt, claim, retry, provider message, provider error, receipt, or send occurred; and
- this historic terminal record will not automatically deliver if configuration is enabled later.

The queue must not label `suppressed` as pending, failed, delayed, queued for later, retriable, or successfully sent. It must offer no edit, delete, mark-read, resend, retry, requeue, copy-recipient, provider-details, or configuration-details control.

### 4.4 Filters and search are explicitly excluded

Do not add channel/status/trigger/date filters, URL search parameters, arbitrary search, export, or analytics. The applied safe function has no filter contract; a client-side filter would either hide authorized evidence incompletely or require loading unbounded history. S06-04 is a bounded newest-first operational history with explicit load-more only.

## 5. Route and authorization contract

### 5.1 Required routes

Create both role-scoped entry points:

```text
src/app/[locale]/(protected)/pm/notificaciones/page.tsx
src/app/[locale]/(protected)/admin/notificaciones/page.tsx
```

Their concrete localized paths are:

| Application role | Spanish/default | English |
| --- | --- | --- |
| PM | `/pm/notificaciones` | `/en/pm/notificaciones` |
| Admin | `/admin/notificaciones` | `/en/admin/notificaciones` |

Do not add `/notificaciones/operaciones`, `/operations`, `/admin/pm/notificaciones`, a shared authenticated prefix, a public route, or navigation links. The existing protected layout already preserves `/pm/*` and `/admin/*` role-prefix enforcement. Do not modify `src/lib/auth/routes.ts` or the protected layout for S06-04.

### 5.2 Server-route checks

Each route must await `cookies()` and call `requireSession(cookieStore)` before its operations query.

- `/admin/notificaciones`: require `session.role === 'admin'`; otherwise redirect to the caller’s existing role default path. It must not render an access-denied page that confirms queue existence.
- `/pm/notificaciones`: require `session.role === 'pm'`; otherwise redirect to the caller’s existing role default path. Then call a server-only `hasActivePmLeadMembership` helper with the authenticated cookie client and `session.user.id`. It queries only the caller’s own active `project_members` rows for `member_type = 'pm_lead'` and requires an active non-deleted joined profile. If false, redirect to `/pm` (or `/en/pm` under the existing normalized locale convention) before querying/rendering the queue.

This app-level capacity check deliberately distinguishes PM Lead from PM Watcher even if both have application role `pm`. The queue RPC remains the final per-row authorization boundary and limits a PM Lead to their actual projects. Do not accept a project ID, membership type, role, locale, or user ID from the browser.

### 5.3 Server Action authorization

Continuation is the only S06-04 action. It must repeat active session and role/capacity authorization before calling the queue query. A forged action call by a PM Watcher, Operator, Client, inactive profile, or unauthenticated caller must receive only a closed generic result; it must not reveal whether the queue contains rows or whether a particular cursor was valid.

## 6. File contract

### 6.1 Create

| File | Responsibility | Hard boundary |
| --- | --- | --- |
| `src/lib/notifications/operations-contracts.ts` | Pure browser-safe DTOs, cursor types, and closed display unions. | Type-only imports only. No Supabase, server-only, config, actions, environment, provider, or generated-types runtime import. It may import `NotificationTrigger` as a type from `inbox-contracts.ts`. |
| `src/lib/notifications/operations-schemas.ts` | Zod input schemas for the complete load-more cursor. | No database access and no user-visible text. |
| `src/lib/notifications/operations-authorization.ts` | Server-only route/action authorization helper for Admin and active PM Lead capacity. | Cookie-authenticated typed client only; narrow membership projection; no queue data and no client import. |
| `src/lib/notifications/operations-queries.ts` | Server-only typed call to the applied aggregate RPC and raw-to-safe DTO narrowing. | Calls only `list_suppressed_notification_operations`; no base notification table/event query and no provider/config imports. |
| `src/lib/notifications/operations-actions.ts` | Server Action for continuation only. | No evaluator, mutation, toast, provider, or direct-table behavior. |
| `src/app/[locale]/(protected)/pm/notificaciones/page.tsx` | PM Lead server entry: session/capacity check, first-page query, localized heading, queue render. | Redirects denied callers before queue query. |
| `src/app/[locale]/(protected)/admin/notificaciones/page.tsx` | Thin Admin server entry using the same query/screen contract. | Admin check first; no duplicated query/authorization implementation. |
| `src/app/[locale]/(protected)/pm/notificaciones/_components/notification-operations-queue.tsx` | Client interaction leaf for initial data, load-more, retry, and one localized live status region. | No Supabase client, config, adapters, evaluator, URL cursor, or optimistic/fabricated records. Admin route may reuse this exact role-neutral safe component. |
| `src/app/[locale]/(protected)/pm/notificaciones/_components/suppressed-delivery-status.tsx` | Present controlled terminal status, reason, channel, trigger category, safe project context, aggregate count, and timestamps. | No recipient/provider/config/raw payload/id rendering and no action buttons. |
| `src/app/[locale]/(protected)/pm/notificaciones/_components/notification-operations-empty-state.tsx` | Localized empty state. | Does not state that delivery is configured, sent, or healthy. |
| `src/lib/notifications/__tests__/operations-queries.test.ts` | Query DTO, cursor, aggregate/RPC argument, and no-leak contract. | Mocked server client only; no live-RLS claim. |
| `src/lib/notifications/__tests__/operations-actions.test.ts` | Continuation authorization/schema/safe-result contract. | Mock auth/client/query boundary. |
| `src/app/[locale]/(protected)/pm/notificaciones/_components/notification-operations-queue.test.tsx` | Queue presentation, terminal copy, load-more/retry, live status, and no-leak behavior. | jsdom only under the repository’s existing focused convention. |

### 6.2 Modify

| File | Required change | Explicitly forbidden |
| --- | --- | --- |
| `messages/es-MX.json` | Add `notificationOperations` namespace. | Any raw configuration/provider/recipient copy or S06-05 evaluator/dialog copy. |
| `messages/en-US.json` | Exact semantic-key parity with Spanish. | Different nesting or an English-only fallback. |
| `__tests__/i18n/message-catalogs.test.ts` | Extend the existing parity test to include `notificationOperations`. | A new broad i18n test harness. |
| `__tests__/app-shell/route-guard.test.ts` | Add only the minimal role-scoped route assertions if current tests own route-guard behavior. | A client-only substitute for server/database authorization evidence. |

Do not modify in S06-04:

- `src/lib/notifications/actions.ts`, `queries.ts`, `schemas.ts`, or `inbox-contracts.ts` except a type-only import if required by the new pure contract;
- `src/lib/notifications/config.ts`, `types.ts`, `channel-adapters.ts`, or `errors.ts`;
- any lifecycle command, event producer, fan-out trigger, receipt/claim function, evaluator, provider endpoint, environment file, app navigation, middleware, protected-layout logic, base-table policy, or generated type file;
- the ordinary `/notificaciones` route tree;
- any migration other than the required `20260822170000` source already supplied with this specification.

## 7. Server-module design

### 7.1 `operations-contracts.ts`

This must be a pure shared contract module. Define the exact DTOs in §4.2 and export:

```ts
export const NOTIFICATION_OPERATIONS_PAGE_SIZE = 25;
```

The constant is a server-owned request bound. The client never selects a page size. No runtime import from `database.types.ts` is allowed in this module.

### 7.2 `operations-schemas.ts`

Define one strict schema only:

```ts
export const LoadSuppressedNotificationOperationsPageSchema = z.object({
  beforeSuppressedAt: z.string().datetime({ offset: true }),
  beforeEventId: z.string().uuid(),
  beforeChannel: z.enum(["email", "whatsapp"]),
}).strict();
```

No filter, project, recipient, trigger, status, reason, date range, user, role, locale, configuration, evaluator, or provider input is accepted.

### 7.3 `operations-authorization.ts`

Start with `import "server-only";`. Export narrow helpers with a typed `SupabaseClient<Database>` parameter:

```ts
export async function hasActivePmLeadMembership(
  supabase: TypedSupabase,
  userId: string,
): Promise<boolean>;

export async function assertNotificationOperationsAccess(
  supabase: TypedSupabase,
  session: SessionContext,
): Promise<"admin" | "pm_lead">;
```

Rules:

1. `admin` succeeds without a membership query.
2. Any non-`pm` non-admin throws/returns a closed internal authorization failure.
3. For `pm`, `hasActivePmLeadMembership` performs a minimal own-membership query: `project_members` filtered by caller `user_id`, `member_type = 'pm_lead'`, `deleted_at is null`, joined `profiles!inner(is_active, deleted_at, role)` restricted to active/non-deleted `role = 'pm'`; use `limit(1)` or equivalent existence shape.
4. A query error is fail-closed. It is not interpreted as an empty authorized queue.
5. This helper proves only route/action eligibility. It never replaces the RPC’s project-scoped authorization and never returns project IDs to the browser.

### 7.4 `operations-queries.ts`

Start with `import "server-only";`. Use a typed `SupabaseClient<Database>` argument and export only:

```ts
export async function listSuppressedNotificationOperationsPage(
  supabase: TypedSupabase,
  cursor?: SuppressedNotificationOperationsCursor | null,
): Promise<SuppressedNotificationOperationsPage>;
```

Required behavior:

1. Validate a non-null cursor with `LoadSuppressedNotificationOperationsPageSchema` before an RPC call. A malformed cursor throws `new Error("Failed to fetch notification operations")` without RPC invocation.
2. Call exactly:

```ts
supabase.rpc("list_suppressed_notification_operations", {
  p_limit: NOTIFICATION_OPERATIONS_PAGE_SIZE + 1,
  p_before_suppressed_at: cursor?.beforeSuppressedAt ?? undefined,
  p_before_event_id: cursor?.beforeEventId ?? undefined,
  p_before_channel: cursor?.beforeChannel ?? undefined,
});
```

3. On RPC error, log only a bounded server diagnostic such as `operation: "list-suppressed-notification-operations"`; throw the generic error above. Do not return an empty page and do not log arguments, IDs, project names, recipients, errors, environment state, or provider data.
4. Validate/narrow every returned row to the permitted S06 union. `project_name` maps to `string | null`; `recipient_count` must be a finite non-negative safe integer. An invalid row is a generic server failure.
5. Preserve database order exactly. Do not re-sort, deduplicate, filter, aggregate, or client-merge records by event ID.
6. Request 26 rows, retain at most 25, set `hasMore` only when row 26 exists, and set the next cursor from row 25’s `lastSuppressedAt`, opaque `eventId`, and `channel`—never from the sentinel.
7. Return no raw RPC type, `projectId`, recipient identifier/contact, provider field, configuration code, payload, or raw status/reason string outside the closed DTO.

### 7.5 `operations-actions.ts`

Start with `"use server";`. Define a closed result:

```ts
export type NotificationOperationsActionErrorCode =
  | "VALIDATION_FAILED"
  | "UNAUTHORIZED"
  | "UNAVAILABLE";

export type LoadSuppressedNotificationOperationsPageActionResult =
  | { ok: true; data: SuppressedNotificationOperationsPage }
  | { ok: false; error: { code: NotificationOperationsActionErrorCode } };
```

Export one action:

```ts
export async function loadSuppressedNotificationOperationsPageAction(
  rawInput: unknown,
): Promise<LoadSuppressedNotificationOperationsPageActionResult>;
```

Required order:

1. Validate the strict composite cursor. Invalid input returns `VALIDATION_FAILED` without reading cookies, creating a client, performing an authorization query, or calling an RPC.
2. Obtain `cookies()`, require active session, and map known `AuthError` to `UNAUTHORIZED`.
3. Create the cookie-authenticated server client, call `assertNotificationOperationsAccess`, and map a denied/fail-closed authorization outcome to `UNAUTHORIZED` without queue detail.
4. Invoke `listSuppressedNotificationOperationsPage` with the validated cursor.
5. Map its generic failure to `UNAVAILABLE`. Do not return exception messages, function names, identifiers, or row counts from failures.
6. Do not call `revalidatePath`: continuation is read-only and must preserve the current page until its successful safe response is appended.

This action must not call `evaluate_notification_alerts`, `mark_*`, a lifecycle command, an adapter, `fetch`, `toast`, a provider SDK, or a table mutation.

## 8. Page and component behavior

### 8.1 Shared server-screen behavior

Both role pages may use one shared server-only screen helper to avoid duplicate first-page fetch/render code, but each page retains its explicit route role check in §5.2. The screen must render:

1. one localized `h1` (`notificationOperations.title`);
2. a concise localized description that identifies it as internal terminal delivery history and explicitly avoids a claim of live delivery/provider health;
3. `NotificationOperationsQueue` with the narrowed first page; and
4. no app-navigation change, provider/configuration detail, or evaluator control.

The first page query occurs only after route authorization succeeds. A route query failure propagates to the existing protected route error boundary; do not add a new `error.tsx` merely for symmetry unless a repository-grounded route-specific recovery gap is demonstrated during implementation.

### 8.2 `NotificationOperationsQueue`

This is the single client interaction owner. Its input is exactly:

```ts
{ initialPage: SuppressedNotificationOperationsPage }
```

State rules:

- initialize records, cursor, and `hasMore` from `initialPage`;
- retain one pending state for load-more/retry only;
- preserve current displayed records on any failure;
- append a successful continuation in returned authoritative order, replace cursor/`hasMore`, and do not locally deduplicate or transform prior rows;
- disable load-more/retry while pending;
- keep the cursor in component memory only: never URL, local storage, cookie, log, analytics, or visible DOM;
- on failure, show only closed-code localized copy in one inline `role="alert" aria-live="polite"` status region;
- retry is a new online request initiated by the user. It is not replay, polling, a timer, or a persistent queue.

The queue must not use `router.refresh()` for load-more, because it would replace the accumulated bounded history. There is no optimistic state because no state mutation exists.

### 8.3 `SuppressedDeliveryStatus`

Render each operation as an `<li>` in a semantic `<ol aria-label={t("listLabel")}>`.

Required display order:

1. a textual/icon terminal state indicator using `status.suppressed`;
2. localized channel label (`email` or `whatsapp`);
3. a localized safe event category derived from the same closed 21-trigger mapping already established for S06-03; reuse the mapping/type-only contract rather than duplicate it;
4. localized controlled reason (`providerDisabled`);
5. a dedicated localized explanatory sentence: it was not sent in this environment and it will not auto-send later;
6. aggregate recipient count only, formatted with the localized count key; never enumerate recipients;
7. project-safe context: `projectName` when non-null, otherwise the generic localized no-project-context label; and
8. two localized `<time>` values: first queue creation and latest suppression time, each with the ISO source in `dateTime` and the repository-established localized short month/day/year/hour/minute formatter.

Do not expose `eventId`, project ID, trigger enum, template/provider/configuration state, recipient names/count breakdown, emails, telephone numbers, variable names, event payload, actor, error, attempt metadata, or any interactive control.

### 8.4 Empty, load-more, and responsive/accessibility behavior

- Empty state says there are no authorized suppressed external-delivery records. It must not say all messages were delivered, no provider is configured, or there are no notifications globally.
- The load-more button appears only when `hasMore`; it has a localized visible label and accessible name, native button semantics, and a minimum 44×44 CSS-pixel target.
- State, terminality, and reason use text plus icons/badges; color alone is never the only indicator.
- The one live region announces only explicit load/retry outcomes; do not announce historic queue records on initial render.
- Native buttons provide Enter/Space behavior. On a failed retry, focus remains on retry. On a successful load, focus remains on load-more when it remains; if it disappears because history ends, move focus to the status region.
- At 375px width, content stacks without clipping long translated explanation/count labels. Both light and dark themes preserve text contrast and readable terminal indicators.

## 9. Localization contract

Add `notificationOperations` to both `messages/es-MX.json` and `messages/en-US.json` with exact nested semantic-key parity.

```text
notificationOperations.title
notificationOperations.description
notificationOperations.listLabel
notificationOperations.empty.title
notificationOperations.empty.description
notificationOperations.loadMore
notificationOperations.loadMoreAria
notificationOperations.loadingMore
notificationOperations.retry
notificationOperations.errors.validation
notificationOperations.errors.unauthorized
notificationOperations.errors.unavailable
notificationOperations.status.suppressed
notificationOperations.channels.email
notificationOperations.channels.whatsapp
notificationOperations.reasons.providerDisabled
notificationOperations.terminalExplanation
notificationOperations.recipientCount
notificationOperations.projectContext
notificationOperations.noProjectContext
notificationOperations.firstCreatedAt
notificationOperations.lastSuppressedAt
```

Rules:

- Spanish (`es-MX`) is the visible default and English (`en-US`) is semantically equivalent.
- `terminalExplanation` must state both no send in the current environment and no future automatic send. It must not name environment variables, a provider, a configuration setting, or imply a delivery failure/attempt.
- `recipientCount` interpolates only the aggregate numeric count.
- No locale includes a provider configuration status, secret state, contact value, raw enum, raw error, or lifecycle payload.
- S06-04 does not add manual-evaluator, confirmation-dialog, toast, or navigation catalog keys; those belong to S06-05/S06-07.

## 10. Minimal focused verification contract

Do not add a new broad suite, database fixture framework, Playwright project, browser E2E setup, provider mock, or full manual regression matrix. Tests here prove application projection/wiring and closed UI behavior; the applied migration/database remain the authority for RLS and terminal suppression enforcement.

### 10.1 Required focused tests

| Test target | Essential coverage only |
| --- | --- |
| `operations-queries.test.ts` | Exact three-part RPC cursor arguments; 26-to-25 sentinel behavior; next cursor comes from retained row 25; preserved order; malformed cursor rejects before RPC; unsafe/malformed channel/status/reason/count data fails closed; returned DTO excludes project ID, contact/provider/payload/config fields. |
| `operations-actions.test.ts` | Invalid cursor rejects before session/client/RPC; unauthenticated and PM Watcher/non-PM authorization return only `UNAUTHORIZED`; authorized Admin and PM Lead call the safe query once; query failure maps to `UNAVAILABLE`; action performs no revalidation/mutation/evaluator/provider call and returns no raw errors/IDs on failure. |
| `notification-operations-queue.test.tsx` | Controlled terminal state/reason/explanation and aggregate count render; no recipient/provider/configuration/ID/raw-trigger content; empty state; successful load-more appends in order; failure preserves rows and offers retry; native button/live-status behavior; Spanish/English semantic DOM behavior. |
| existing message-catalog test | Exact `notificationOperations` tree parity in both catalogs. |
| existing route-guard test, only if it owns route checks | Admin route stays Admin-only; PM route stays PM-only; shared `/notificaciones` behavior and unrelated cross-role denial remain unchanged. |

Do not create separate tests for a manual dialog, evaluator, provider dispatch, config parser, lifecycle fan-out, queue filters, or direct RLS SQL. They are not S06-04 behavior.

### 10.2 Targeted implementation commands

Run only after application code exists and the required migration/types prerequisite is complete:

```bash
npm run test -- src/lib/notifications/__tests__/operations-queries.test.ts src/lib/notifications/__tests__/operations-actions.test.ts "src/app/[locale]/(protected)/pm/notificaciones/_components/notification-operations-queue.test.tsx" __tests__/i18n/message-catalogs.test.ts __tests__/app-shell/route-guard.test.ts
npm run typecheck
npm run lint
npx prettier --check src/lib/notifications/operations-contracts.ts src/lib/notifications/operations-schemas.ts src/lib/notifications/operations-authorization.ts src/lib/notifications/operations-queries.ts src/lib/notifications/operations-actions.ts "src/app/[locale]/(protected)/pm/notificaciones" "src/app/[locale]/(protected)/admin/notificaciones" messages/es-MX.json messages/en-US.json __tests__/i18n/message-catalogs.test.ts __tests__/app-shell/route-guard.test.ts
```

Do not run `npm run build` solely for S06-04. S06-03 has already supplied build evidence; S06-07 owns capability-track final integration/build evidence. Report exact actual outcomes only.

### 10.3 Required narrow manual acceptance

Use the approved mutable local sandbox only after focused automation is green:

1. With delivery disabled, cause an existing lifecycle event that yields an eligible external suppression. Sign in as Admin and visit `/admin/notificaciones`; verify only safe aggregate terminal records, no send/retry control, and the ordinary recipient inbox remains operationally silent.
2. Sign in as a PM user with an active `pm_lead` membership for that project. Visit `/pm/notificaciones`; verify only authorized project rows appear.
3. Sign in as a PM Watcher, Operator, and Client. Attempt their applicable operations route and a forged load-more action. Verify redirect/closed denial with no queue record, recipient, provider, configuration, or authorization detail.
4. Establish or identify a same-`last_suppressed_at` page-boundary case that also includes two channel aggregates for the same event. Verify database/RPC continuation returns every record once across pages. This is function evidence; it is not a client deduplication claim.
5. Repeat the authorized queue page in `/en/admin/notificaciones` or `/en/pm/notificaciones`, at 375px width, keyboard-only, and both themes. Verify terminal explanation, count, and timestamps are legible and status is not color-only.

## 11. Acceptance criteria

S06-04 is complete only when all conditions hold:

1. The required `20260822170000` migration is applied and generated types are regenerated before implementation; the queue uses the resulting four-argument composite keyset RPC.
2. Admin can inspect authorized safe aggregate suppression history at `/admin/notificaciones`; an active PM Lead can inspect only database-authorized project history at `/pm/notificaciones`.
3. PM Watcher, Operator, Client, unauthenticated, inactive, deleted, and forged-action callers cannot obtain queue data or queue-existence detail.
4. Application code queries only the applied safe aggregate function for operations data; it never reads notification/event base tables for this feature.
5. Browser data contains only the closed safe DTO. No project ID, recipient/contact value, provider/template/configuration information, raw payload, raw error, raw enum fallback, or visible opaque ID leaks.
6. Each record truthfully presents terminal `suppressed/provider_disabled`, channel, safe category, aggregate recipient count, safe project context, and timestamps, including no-send/no-auto-send-later explanation.
7. There is no retry, resend, requeue, delete, edit, mark-read, filter, search, export, provider/evaluator, dialog, toast, schedule, webhook, polling, local cache, or navigation work.
8. Load-more is bounded, lossless, server-authorized, cursor-private, and does not skip same-time/event/channel aggregates.
9. Every new user-visible string has exact Spanish/English semantic-key parity and supports keyboard, screen reader, narrow-width, and theme usage.
10. Only the targeted tests/commands and manual acceptance facts in §10 are reported, with actual outcomes and database/RLS evidence clearly distinguished from mocked application tests.

## 12. Stop conditions

| Discovery | Required response |
| --- | --- |
| Migration is unapplied, generated function args do not match §2.2, or types are stale | Do not implement S06-04. Apply the exact migration and regenerate types first. |
| Queue continuation skips/duplicates rows at a same-time/event/channel boundary | Block until the applied RPC and generated types satisfy §4.1; do not patch it in client state. |
| A screen/action requires a base-table query, service role, provider config, adapter, direct SQL, or environment variable to render queue data | Stop; this violates the safe aggregate/read-only boundary. |
| PM Watcher can render queue data or invoke a continuation action successfully | Block as authorization defect. Correct both app-level capacity check and/or database boundary as indicated by factual evidence. |
| A requested diagnostic needs identity/contact/configuration/provider/error/payload detail | Reject it; only channel, safe event category, aggregate count, controlled reason, safe project context, and timestamps are permitted. |
| An implementation adds manual evaluator control or action-issued toast | Stop and defer to S06-05. |
| A proposed UI suggests a suppressed record will send later, has failed after a provider attempt, or is retriable | Block until terminal wording and controls are corrected. |
| A filter/search requirement appears | Stop and obtain a separately approved applied function contract; do not invent client-side filtering. |

## 13. Handoff requirements

The implementation handoff must include:

- exact migration path, MCP application result, and unchanged generated-types provenance before app work;
- changed application/document/test paths;
- confirmed non-changes: no recipient inbox mutation, provider/config/adapters, evaluator/dialog/toast, endpoints, navigation, lifecycle/fan-out, policy, or generated-types hand-edit;
- exact targeted verification commands and factual outcomes;
- explicit separation of mocked query/action/component coverage from database/RLS/keyset manual evidence;
- localization/accessibility evidence, including terminal wording, keyboard/live status, Spanish/English parity, 375px, and themes;
- PM Lead versus PM Watcher route/action evidence;
- known limitation: no filters, search, recipient detail, retry/requeue, provider status, or manual alert evaluation; and
- an explicit statement that no email, WhatsApp, provider dispatch, receipt, scheduling, webhook, DNS, deployment, or production evidence was claimed.
