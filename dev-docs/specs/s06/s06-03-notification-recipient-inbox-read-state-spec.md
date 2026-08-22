---
title: S06-03 Notification Recipient Inbox, History, and Read State Specification
status: implementation-ready-pending-migration-application-and-type-regeneration
sprint_id: S06
epic_id: E08
work_item_id: S06-03
feature_slug: s06-03-notification-recipient-inbox-read-state
project: Joya Star Films Project Management App
authority:
  - Project Owner direction
  - ADR-024 Deferred External Provider Activation and Epic 08 Capability Delivery
  - dev-docs/specs/s06/s06-e08-notification-scheduling-and-external-providers-capability-track-sprint-plan.md
  - dev-docs/specs/s06/s06-e08-notification-capability-contract-mapping-reference.md
  - supabase/migrations/20260822140000_s06_e08_notification_capability_suppression.sql
  - src/lib/database.types.ts
prerequisites:
  - S06-01 complete; both required S06 database migrations applied and generated types regenerated
  - S06-02 committed; server-only configuration and disabled adapters remain unchanged
  - supabase/migrations/20260822160000_s06_e08_notification_inbox_keyset_pagination.sql applied to jsf-pm-dev through Supabase MCP
  - src/lib/database.types.ts regenerated unchanged from the post-migration schema and committed before S06-03 implementation starts
scope: recipient-owned in-app notification history and read state only
---

# S06-03 — Notification Recipient Inbox, History, and Read State

## 1. Readiness and required schema prerequisite

This specification is implementation-ready once the new keyset-pagination migration is applied to `jsf-pm-dev` through Supabase MCP and the generated database types are written unchanged to `src/lib/database.types.ts` and committed. Those steps occur **before** S06-03 application implementation begins.

Migration source:

```text
supabase/migrations/20260822160000_s06_e08_notification_inbox_keyset_pagination.sql
```

It replaces the timestamp-only cursor with a complete `(created_at, recipient_id)` keyset cursor. It changes only the `public.list_my_in_app_notifications` RPC signature and continuation predicate; it does not alter notification rows, RLS policies, read RPCs, provider behavior, external suppression, or any other S06 boundary.

All remaining design choices in this document are resolved. In particular, S06-03 creates a **shared authenticated inbox route** at `/notificaciones` for every active application role, but it does **not** add a desktop/mobile navigation link; that navigation integration remains S06-07.

## 2. Objective

Deliver a role-neutral, authenticated, accessible, localized recipient inbox that:

1. reads only the caller's safe `in_app` notification projection;
2. displays bounded, newest-first notification history without provider, suppression, recipient-contact, event-payload, or operational data;
3. supports idempotent mark-one-read and mark-all-read mutations through the existing self-only database RPCs;
4. refreshes the inbox and protected-shell unread count from authoritative server state; and
5. remains correct for `admin`, `pm`, `operator`, and `client` users without creating a new notification producer, any database change beyond the required pre-implementation keyset migration, an external delivery operation, or a notification queue.

This item is a recipient experience only. It does not implement the Admin/PM Lead operational suppression queue, notification diagnostics, alert evaluation, provider endpoints, external dispatch, Realtime subscription, polling, or navigation-link work.

## 3. Governing boundaries

### 3.1 Authority precedence

1. Direct Project Owner instruction and accepted ADR-024 decisions.
2. Applied database migration source and the generated database types derived from it.
3. The accepted S06 sprint plan and S06-01 contract mapping reference.
4. This S06-03 specification.
5. `AGENTS.md` and existing repository patterns.

If a lower authority conflicts with a higher authority, stop the affected implementation and report the exact conflict. Do not reinterpret RLS, add a direct base-table query, invent a cursor, or widen notification data because a UI is inconvenient to implement.

### 3.2 Non-negotiable privacy and security rules

- The browser must never query `notification_events` or `notification_recipients` for the inbox.
- S06-03 must call only `public.list_my_in_app_notifications`, `public.mark_notification_read`, and `public.mark_all_notifications_read` for notification persistence behavior.
- Server queries/actions must use the cookie-authenticated `@supabase/ssr` client under RLS. Do not use a service-role client, runtime Prisma, direct SQL, `DATABASE_URL`, or admin client.
- The ordinary inbox must never render an external channel, `suppressed`, `provider_disabled`, provider-message ID, provider error, template ID, contact value, raw payload, audit field, other user's notification, queue aggregate, configuration state, or a future-provider diagnostic.
- The UI may receive raw UUID fields only inside a server-returned typed record required to execute the self-owned read RPC. It must not render them, put them in a URL, log them, use them as a route target, or expose them in labels.
- Do not use a client-side cache, optimistic state that presents a successful read before RPC success, interval/polling, a notification subscription, service worker, local storage, offline queue, or replay mechanism.
- UI code maps only a closed `notification_trigger` union to localized semantic keys. Unknown/future values must map to one localized generic category and must not render the raw enum value.

### 3.3 S06 scope separation

| S06 item | Ownership | S06-03 treatment |
| --- | --- | --- |
| S06-02 | Server-only configuration and disabled provider adapters | Preserve its modules. Do not import configuration, adapters, capability state, or diagnostic mapping into the inbox. |
| S06-03 | Recipient inbox/history/read state | This specification. |
| S06-04 | Admin/PM Lead safe suppression queue and diagnostics | No queue route, queue query, diagnostic toast, suppression status, retry/requeue, or operational authorization in S06-03. |
| S06-05 | Manual alert evaluator | No evaluator control, flag check, dialog, or alert evaluation call. |
| S06-06 | Inactive provider endpoints | No route handler, webhook, receipt, or provider-facing endpoint. |
| S06-07 | Navigation, final localization/accessibility integration, closeout | Do not add `<Link>` controls to `AppNav` or `MobileNavToggle`; only perform the minimal protected-route guard correction needed for a real S06-03 page. |

## 4. Applied database contract

### 4.1 Approved read surface

`public.list_my_in_app_notifications(p_limit integer default 50, p_before_created_at timestamptz default null, p_before_recipient_id uuid default null)` becomes the sole inbox list source after the required pre-implementation migration.

The cursor is a complete pair. The first page passes both cursor values as `null`; every continuation passes both final-row values unchanged. The function rejects a partial pair, preserves `created_at DESC, recipient_id DESC` ordering, and selects the next page only where:

```sql
created_at < p_before_created_at
or (created_at = p_before_created_at and recipient_id < p_before_recipient_id)
```

It is a `security definer` function that requires `auth.uid()` and returns only:

```ts
type ListMyInAppNotificationsRow = {
  recipient_id: string;
  event_id: string;
  trigger: Database["public"]["Enums"]["notification_trigger"];
  entity_type: Database["public"]["Enums"]["entity_type"];
  entity_id: string;
  project_id: string;
  occurred_at: string;
  created_at: string;
  read_at: string;
  delivery_status: Database["public"]["Enums"]["notification_delivery_status"];
};
```

Database enforcement already guarantees each returned row belongs to the authenticated caller and `channel = 'in_app'`. S06-03 must still use the authenticated server client and must not treat this database rule as permission to remove the application session requirement.

The UI contract narrows that result to:

```ts
type RecipientInboxNotification = Readonly<{
  recipientId: string; // action-only opaque identifier; never displayed or routed
  trigger: NotificationTrigger;
  createdAt: string;
  occurredAt: string;
  readAt: string | null;
}>;
```

Do **not** forward `event_id`, `entity_type`, `entity_id`, `project_id`, or `delivery_status` to route-local client components. They are not needed for S06-03's safe non-linking presentation. Keep the safe mapping in the server-only query module.

### 4.2 Approved read mutations

| RPC | Input | Result | Required S06-03 behavior |
| --- | --- | --- | --- |
| `public.mark_notification_read(p_notification_recipient_id uuid)` | One UUID | `boolean` | Self-only, in-app-only, idempotent. `true` means this call made an unread row read; `false` means the row was already read, inaccessible, absent, or not in-app. Both are safe terminal outcomes; the next authoritative refresh decides display state. |
| `public.mark_all_notifications_read()` | No argument | `number` | Self-only, in-app-only bulk update count. Zero is a valid idempotent result. |

No S06-03 code may set `read_at`, `delivery_status`, or timestamps directly. No action may accept user ID, channel, status, locale, route, timestamp, event ID, or project ID from the browser.

### 4.3 Current trigger universe and display policy

The generated `notification_trigger` union currently includes:

```text
user_invited
project_assigned
task_assigned
task_status_changed
client_task_blocking
client_submission_received
client_submission_reopened
deliverable_submitted
internal_changes_requested
internal_review_approved
client_changes_requested
client_review_approved
deliverable_delivered
deadline_24h
deadline_12h
deadline_6h
deadline_overdue
review_inactivity_reminder
link_reported_broken
invite_expiring
system
```

S06-03 must declare a `satisfies Record<NotificationTrigger, NotificationCategoryKey>` mapping that covers each value above. The mapping may collapse multiple triggers into one semantic category only where user-facing meaning is deliberately identical. It must not derive copy from payload fields or display the enum itself.

Required display categories:

| Trigger(s) | Required semantic key |
| --- | --- |
| `user_invited`, `invite_expiring` | `invitation` |
| `project_assigned` | `projectAssignment` |
| `task_assigned` | `taskAssignment` |
| `task_status_changed` | `taskStatusChanged` |
| `client_task_blocking` | `clientTaskBlocking` |
| `client_submission_received`, `client_submission_reopened` | `clientSubmission` |
| `deliverable_submitted` | `deliverableSubmitted` |
| `internal_changes_requested`, `client_changes_requested` | `changesRequested` |
| `internal_review_approved`, `client_review_approved` | `reviewApproved` |
| `deliverable_delivered` | `deliverableDelivered` |
| `deadline_24h`, `deadline_12h`, `deadline_6h` | `deadlineReminder` |
| `deadline_overdue` | `deadlineOverdue` |
| `review_inactivity_reminder` | `reviewInactivityReminder` |
| `link_reported_broken` | `linkReportedBroken` |
| `system` | `system` |

Each category uses exactly a localized title and generic description. Neither string interpolates titles, comments, reasons, project names, recipients, entity IDs, routes, deadlines, or raw payload values. This is intentional minimization: S06-03 must be useful without becoming an indirect payload disclosure surface.

### 4.4 Read-state presentation policy

- `readAt === null`: unread. Display the localized unread state, an accessible non-color indicator, and a mark-read control.
- `readAt !== null`: read. Display the localized read state; do not offer mark-read control.
- The application must not infer unread/read from `delivery_status`. `read_at` is canonical for presentation. The query currently returns `delivery_status` only as database-projection evidence and it is intentionally removed from the UI model.
- A mark-one action returning `false` is not an error message. It is a stale/idempotent result; refresh the route so the UI follows database truth.

## 5. Required route and authorization correction

### 5.1 Required shared route

Create:

```text
src/app/[locale]/(protected)/notificaciones/page.tsx
src/app/[locale]/(protected)/notificaciones/loading.tsx
src/app/[locale]/(protected)/notificaciones/error.tsx
```

The route exists at:

- Spanish/default: `/notificaciones`
- English: `/en/notificaciones`

It is available to every authenticated, active profile (`admin`, `pm`, `operator`, `client`) because recipient ownership, not application role, governs the inbox.

### 5.2 Existing protected-layout conflict — required resolution

The existing shared protected layout rejects any pathname that does not start with the user's role home prefix. Therefore it currently redirects `/notificaciones` for every role before the requested page can render. `src/lib/auth/routes.ts` also omits `/notificaciones` from `PROTECTED_PATH_PREFIXES`.

S06-03 must make the smallest coherent routing change:

1. Add `"/notificaciones"` to `PROTECTED_PATH_PREFIXES` in `src/lib/auth/routes.ts` so middleware/session policy treats the route as protected.
2. Add a server-safe constant in the same module:

   ```ts
   export const SHARED_AUTHENTICATED_PATH_PREFIXES = ["/notificaciones"] as const;
   ```

3. In `src/app/[locale]/(protected)/layout.tsx`, preserve existing role-prefix enforcement for all role-scoped routes. Amend the guard so the role-prefix condition is bypassed only when `pathname` equals `/notificaciones` or begins with `/notificaciones/`.
4. Do not add shared route exceptions for `/pm/notificaciones`, `/admin/notificaciones`, `/api`, or any future path. S06-04 owns its own role-sensitive route authorization.
5. Preserve English path detection: the guard must compare the normalized non-English-prefixed pathname, exactly as the current layout does.
6. Do not alter `ROLE_DEFAULT_PATHS`, sign-in default redirects, invite redirects, or safe redirect allowlists in this work item. The inbox is a first-class protected destination but not a post-auth default destination.

This correction is not S06-07 navigation work. It makes the specified protected recipient route reachable; it adds no app-navigation link or menu item.

## 6. File contract

### 6.1 Create

| File | Responsibility | Hard boundary |
| --- | --- | --- |
| `src/lib/notifications/queries.ts` | Server-only typed inbox RPC call and server-safe row narrowing. | Imports `server-only`; calls only `list_my_in_app_notifications`; exports no raw Supabase rows. |
| `src/lib/notifications/schemas.ts` | Closed Zod schemas/input types for mark-one and mark-all actions. | No database access; no user-facing copy. |
| `src/lib/notifications/actions.ts` | Server Actions: session, input validation, RPC invocation, safe result mapping, path revalidation. | Uses cookie-authenticated server client only; never accepts identity/status/timestamp/channel. |
| `src/app/[locale]/(protected)/notificaciones/page.tsx` | Server route: require active session, retrieve first bounded inbox page, pass safe model to presentation. | No role check; no direct table query; no raw payload/ID display. |
| `src/app/[locale]/(protected)/notificaciones/loading.tsx` | Localized route skeleton. | Accessible busy status; no hard-coded Spanish text. |
| `src/app/[locale]/(protected)/notificaciones/error.tsx` | Localized route error boundary and retry. | Client boundary; no error message/digest rendering. |
| `src/app/[locale]/(protected)/notificaciones/_components/notification-inbox.tsx` | Client interaction leaf for list state, read controls, pagination control, action result status. | Receives only narrowed safe records and server actions; no Supabase client. |
| `src/app/[locale]/(protected)/notificaciones/_components/notification-inbox-item.tsx` | Present one safe notification. | No links or route construction in S06-03. |
| `src/app/[locale]/(protected)/notificaciones/_components/notification-empty-state.tsx` | Localized empty state. | No operations/provider content. |
| `src/lib/notifications/__tests__/queries.test.ts` | Query narrowing, RPC argument, ordering/cursor contract, safe-data boundary tests. | Node tests, mock server client; no live database claim. |
| `src/lib/notifications/__tests__/actions.test.ts` | Action schema/session/RPC/revalidation/safe result tests. | Node tests, mock `next/headers`, RPC and cache boundary. |
| `src/app/[locale]/(protected)/notificaciones/_components/notification-inbox.test.tsx` | Component behavior, keyboard/action status, safe rendering, and locale tests. | Establish jsdom test configuration locally only if required by the existing test setup; do not add Playwright. |

### 6.2 Modify

| File | Required modification | Explicitly forbidden |
| --- | --- | --- |
| `src/lib/auth/routes.ts` | Add the one shared authenticated prefix and `SHARED_AUTHENTICATED_PATH_PREFIXES` as described in §5.2. | Changing role defaults, broad redirect allowlists, or adding S06-04 paths. |
| `src/app/[locale]/(protected)/layout.tsx` | Allow only `SHARED_AUTHENTICATED_PATH_PREFIXES` through the existing role-prefix guard while retaining session enforcement and unread shell query. | Removing role-prefix authorization generally; duplicating session logic; client-side protection. |
| `messages/es-MX.json` | Add `notifications` namespace and add a `shell.nav.links.notifications` label only as catalog readiness. | Changing existing copy or adding S06-04 operations copy. |
| `messages/en-US.json` | Exact semantic-key parity with Spanish. | Divergent nesting or missing keys. |

Do **not** modify in S06-03:

- `src/components/shared/app-nav/app-nav.tsx`
- `src/components/shared/app-nav/_components/mobile-nav-toggle.tsx`
- `src/components/shared/app-nav/_components/notification-badge.tsx`
- `.env.example`
- `src/lib/notifications/config.ts`
- `src/lib/notifications/channel-adapters.ts`
- `src/lib/notifications/errors.ts`
- any migration, generated database type, Supabase policy, provider adapter, API route, or S06-04+ path.

The catalog-only addition to `shell.nav.links` permits S06-07 to attach navigation later without duplicating translation work; it must not itself cause any nav rendering change.

## 7. Server module design

### 7.1 `src/lib/notifications/queries.ts`

Begin the module exactly with:

```ts
import "server-only";
```

Use a typed `SupabaseClient<Database>` parameter to keep the query independently testable. Export:

```ts
export const NOTIFICATION_INBOX_PAGE_SIZE = 25;

export type NotificationTrigger =
  Database["public"]["Enums"]["notification_trigger"];

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

export type RecipientInboxPage = Readonly<{
  notifications: readonly RecipientInboxNotification[];
  nextCursor: RecipientInboxCursor | null;
  hasMore: boolean;
}>;
```

`NOTIFICATION_INBOX_PAGE_SIZE` is exactly `25`; the server requests exactly `26` rows to determine a truthful continuation. The browser cannot select a page size.

Export one function:

```ts
export async function listRecipientInboxPage(
  supabase: TypedSupabase,
  cursor?: RecipientInboxCursor | null,
): Promise<RecipientInboxPage>
```

Rules:

1. Validate `cursor` before RPC invocation. It is either `null`/`undefined` or a complete object with `beforeCreatedAt` as `z.string().datetime({ offset: true })` and `beforeRecipientId` as `z.string().uuid()`.
2. Call exactly:

   ```ts
   supabase.rpc("list_my_in_app_notifications", {
     p_limit: NOTIFICATION_INBOX_PAGE_SIZE + 1,
     p_before_created_at: cursor?.beforeCreatedAt ?? null,
     p_before_recipient_id: cursor?.beforeRecipientId ?? null,
   })
   ```

3. If Supabase returns an error, log only bounded server diagnostics and throw `new Error("Failed to fetch notification inbox")`. Do not return an empty list on an error, because that would falsely communicate an empty inbox.
4. Map raw rows to `RecipientInboxNotification` and discard all fields except `recipient_id`, `trigger`, `created_at`, `occurred_at`, and `read_at`.
5. Preserve database order. Do not re-sort, client-deduplicate, merge pages by UUID, filter a trigger, or use `event_id` to infer a destination.
6. Retain at most 25 rows. `hasMore` is true only when the RPC returns a 26th row. When true, `nextCursor` is the `createdAt` and `recipientId` of the 25th retained row; otherwise it is `null`.

### 7.2 `src/lib/notifications/schemas.ts`

Define no more input surface than the two existing RPCs require:

```ts
export const MarkNotificationReadSchema = z.object({
  notificationRecipientId: z.string().uuid(),
});

export const MarkAllNotificationsReadSchema = z.object({}).strict();

export const LoadRecipientInboxPageSchema = z.object({
  beforeCreatedAt: z.string().datetime({ offset: true }),
  beforeRecipientId: z.string().uuid(),
}).strict();
```

The mark-all action accepts `undefined` at its public TypeScript boundary and validates a literal empty object internally if the action framework needs a schema target. It must reject unexpected keys. The load-more action accepts only the complete opaque cursor pair above. Never add user ID, return URL, project ID, event ID, channel, status, read timestamp, or locale to any S06-03 action schema.

### 7.3 `src/lib/notifications/actions.ts`

Start with `"use server";`.

Define a narrow closed error/result contract, independent of the generic project command error mapper:

```ts
export type NotificationActionErrorCode =
  | "VALIDATION_FAILED"
  | "UNAUTHENTICATED"
  | "UNAVAILABLE";

export type NotificationActionResult =
  | { ok: true; changed: boolean; changedCount?: number }
  | { ok: false; error: { code: NotificationActionErrorCode } };
```

Do not return a raw message, database error, RPC function name, or ID. The client maps this closed code to localized copy.

#### `markNotificationReadAction`

```ts
export async function markNotificationReadAction(
  rawInput: unknown,
): Promise<NotificationActionResult>
```

Required order:

1. Parse `rawInput` with `MarkNotificationReadSchema`; invalid input returns `VALIDATION_FAILED` without creating a client or calling an RPC.
2. Obtain `cookies()` and call `requireSession(cookieStore)`. Translate only the known `AuthError` cases into `UNAUTHENTICATED`; do not reveal inactive/missing-profile distinction to the component. Unexpected errors remain thrown for the route boundary/server telemetry.
3. Create the cookie-authenticated Supabase server client.
4. Call `mark_notification_read` with only `{ p_notification_recipient_id: parsed.data.notificationRecipientId }`.
5. If the RPC returns an error, log bounded server-only metadata and return `{ ok: false, error: { code: "UNAVAILABLE" } }`.
6. If the RPC succeeds, revalidate both locale route variants and the protected layout path used by the badge:

   ```ts
   revalidatePath("/notificaciones");
   revalidatePath("/en/notificaciones");
   revalidatePath("/[locale]/(protected)", "layout");
   ```

   Verify the exact Next.js 16 `revalidatePath` layout semantics against installed local documentation before implementation. If the literal route-group layout path is unsupported, use only the specific concrete paths required to refresh shell data; do not create a broad cache invalidation.
7. Return `{ ok: true, changed: data === true }`.

#### `markAllNotificationsReadAction`

```ts
export async function markAllNotificationsReadAction(
  rawInput?: unknown,
): Promise<NotificationActionResult>
```

Use the same order and error policy. It calls `mark_all_notifications_read` with no RPC arguments. On success, validate `data` is a non-negative finite integer before returning it as `changedCount`; otherwise return `UNAVAILABLE` and log server-side. Revalidate exactly the same inbox and shell paths.

#### `loadRecipientInboxPageAction`

```ts
export async function loadRecipientInboxPageAction(
  rawInput: unknown,
): Promise<
  | { ok: true; data: RecipientInboxPage }
  | { ok: false; error: { code: NotificationActionErrorCode } }
>
```

This is the sole permitted action-side read. It validates `LoadRecipientInboxPageSchema`, requires the active session, creates the cookie-authenticated client, and calls `listRecipientInboxPage` with the validated composite cursor. It returns the narrowed safe `RecipientInboxPage` only. It performs no path revalidation, does not mutate notification state, and maps malformed input to `VALIDATION_FAILED` and safe query failure to `UNAVAILABLE`.

### 7.4 Action-side data boundary

The load-more action above is the sole action-side read. Mark-read actions do not re-fetch the inbox, query base tables, calculate badge counts, infer entity authorization, or derive notification text. A successful mark action returns only the safe outcome above; `router.refresh()` obtains authoritative page and shell state.

## 8. Required pre-implementation keyset migration

### 8.1 Migration purpose and scope

The original timestamp-only continuation could skip rows that share a page-boundary timestamp. The Project Owner has selected the direct correction: apply the checked-in forward migration before application implementation.

```text
supabase/migrations/20260822160000_s06_e08_notification_inbox_keyset_pagination.sql
```

The migration performs exactly these operations in one transaction:

1. drops only the superseded `public.list_my_in_app_notifications(integer, timestamptz)` overload;
2. creates `public.list_my_in_app_notifications(integer, timestamptz, uuid)` with the same self-only response projection, authentication requirement, 1–100 limit clamp, order, `security definer`, and search path;
3. requires the two cursor values to be either both null or both non-null;
4. applies a lossless composite keyset predicate matching `created_at DESC, id DESC`; and
5. restores authenticated-only execution on the new function signature.

It must not change notification data, trigger/event creation, recipient fan-out, direct table policies, read-state RPCs, external suppression, provider configuration, queues, alerts, scheduler behavior, or public HTTP routes.

### 8.2 Required sequence before S06-03 application work

1. Commit the migration source as normal repository schema source.
2. Apply the exact migration to `jsf-pm-dev` through Supabase MCP `apply_migration`; do not use dashboard DDL, generic SQL, reset, or a different SQL copy.
3. Regenerate TypeScript types from the post-migration database through Supabase MCP and write `src/lib/database.types.ts` unchanged.
4. Commit the generated type artifact.
5. Confirm the generated `Functions.list_my_in_app_notifications.Args` shape is:

   ```ts
   {
     p_limit?: number;
     p_before_created_at?: string;
     p_before_recipient_id?: string;
   }
   ```

6. Record the migration path, target (`jsf-pm-dev`), MCP application result, generated-types path, and resulting source commits in S06-03 handoff evidence.
7. Only then begin S06-03 application implementation.

A failed or partial migration is a stop condition. Preserve the factual result and repair only with a new reviewed forward migration; never alter existing migration history or hand-edit the generated type output.

### 8.3 Application cursor contract

Use this exact safe continuation type after regenerated types are available:

```ts
export type RecipientInboxCursor = Readonly<{
  beforeCreatedAt: string;
  beforeRecipientId: string;
}>;
```

- First-page request: no cursor.
- Each later request: cursor values from the final row of the prior successful page.
- The cursor remains in component state only. Do not write it to a URL, cookie, local storage, log, analytics event, or user-visible element.
- The client never fabricates/reorders either value. A malformed, partial, or stale cursor produces a safe closed action error and preserves existing displayed history.
- Fetch `NOTIFICATION_INBOX_PAGE_SIZE + 1` rows (`26`) through the function. Retain the first 25, set `hasMore` when row 26 exists, and use the 25th retained row—not the sentinel—as the next cursor.

## 9. Page and component behavior

### 9.1 Server page

`page.tsx` must:

1. await `cookies()`;
2. call `requireSession(cookieStore)` so the page refuses unauthenticated, inactive, or deleted profiles exactly as the shared protected layout does;
3. create the cookie-authenticated Supabase client;
4. invoke `listRecipientInboxPage(supabase)` for the first page;
5. retrieve `getTranslations("notifications")` only if the server page needs to compose static heading metadata; route-local interactive strings live in client components; and
6. render a semantic page landmark and `NotificationInbox` with the narrowed first page.

It must not redirect by role, query unread-count view, query base tables, invoke mark-read RPCs, or invoke external-adapter/configuration modules.

The page heading is localized and uses one `h1`. The page has a short localized description that states this is the user's in-app history, without implying external delivery or a guaranteed real-time stream.

### 9.2 `NotificationInbox`

This is the only S06-03 client interaction owner. It receives:

```ts
{
  initialPage: RecipientInboxPage;
}
```

It imports `useRouter` from `next/navigation`, `useTranslations`, the two action functions, route-local child components, and standard UI primitives. It does not import Supabase, config, adapters, server-only modules, database types, or `NotificationBadge`.

State rules:

- Initialize `notifications`, `nextCursor`, and `hasMore` from `initialPage`.
- One pending state serializes all mutation/load-more interactions. While any action is pending, disable mark-one, mark-all, and load-more controls.
- Do not mutate `readAt` optimistically.
- Do not retain a local completed action state after `router.refresh()` changes props. Reconcile the list from the new authoritative server props.
- A successful mark-one or mark-all invokes `router.refresh()` exactly once after the action resolves.
- A stale/idempotent mark-one result (`changed: false`) invokes the same refresh without displaying a failure.
- A successful mark-all with `changedCount: 0` is valid and displays the same localized “up to date” status as an already-read inbox.
- An action failure displays the closed-code localized inline status with `role="alert"` and `aria-live="polite"`; it never displays a raw exception.

Load-more calls `loadRecipientInboxPageAction` with only `nextCursor`. On success it appends the returned safe page in authoritative order, replaces `nextCursor` and `hasMore`, and does not deduplicate/alter prior records. It must not place cursor components in the URL.

### 9.3 `NotificationInboxItem`

Each item must be an `<li>` inside a semantic `<ol aria-label={t("listLabel")}>`.

Required content, in order:

1. A text/icon state indicator with localized unread/read text. Icon alone and color alone are insufficient.
2. Localized category title from the closed trigger mapping.
3. Localized generic category description from the same mapping.
4. A `<time dateTime={createdAt}>` with a `useFormatter().dateTime(...)` value using the repository's established date/time format (short month, numeric day/year, 2-digit hour/minute). Use `createdAt`, not `occurredAt`, for the displayed inbox-arrival chronology. `occurredAt` remains intentionally unrendered in S06-03.
5. For unread items only, one button invoking mark-one-read. Its accessible name identifies the action and category but does not contain UUIDs or raw trigger strings.

Do not render a `<Link>`, `router.push`, target URL, project title, task title, deliverable title, event payload, category raw enum, ID, channel, provider status, suppression state, or reason. Destination authorization cannot be proved from the safe projection alone; deferring deep links is the correct S06-03 behavior.

### 9.4 Header, bulk action, empty and error states

- When any unread row exists in the rendered page, show one **Mark all as read** button. It marks all caller-owned unread in-app rows in the database, not merely the current page.
- When no rendered row is unread, omit or disable the bulk control with a concise localized non-actionable explanation. Do not submit an unnecessary mutation merely to demonstrate a button.
- Empty state: a neutral localized illustration/icon with heading and description. It must say there are no in-app notifications, not “all messages delivered” or anything about providers.
- Loading state: skeleton rows with `role="status"`, `aria-busy="true"`, `aria-live="polite"`, and a localized screen-reader loading label. No hard-coded Spanish text.
- Route error state: client component using the repository recovery pattern, calls `reset`, sends the exception to existing Sentry helper if the existing route error component does, and displays only localized generic retry copy. It must not show `error.message` or `error.digest`.
- Load-more failure: preserve already displayed rows, show a localized inline retry action, and make a fresh online request only when the user activates it. Do not duplicate prior rows or mark read state locally.

### 9.5 Accessibility requirements

- All touch/click targets must be at least 44×44 CSS pixels.
- Keyboard operation: Tab reaches mark-one, mark-all, load-more/retry in a logical order; Enter/Space works through native buttons; focus remains on the activated control after success unless the control disappears, in which case move focus to the page's status region.
- The list has one concise live region for mutation/load-more outcomes. Do not announce every historic list item on initial load.
- Read/unread is conveyed in text and programmatic label, not color alone.
- `<time>` labels use localized human-readable text and machine-readable ISO `dateTime`.
- The route must be usable at 375px width and in light/dark themes without clipped action labels or inaccessible hover-only controls.

## 10. Localization contract

Add a top-level `notifications` namespace to **both** catalogs with exact structural parity.

Required keys:

```text
notifications.title
notifications.description
notifications.listLabel
notifications.unreadState
notifications.readState
notifications.markRead
notifications.markReadAria
notifications.markAllRead
notifications.markAllReadAria
notifications.markAllUnavailable
notifications.readSuccess
notifications.allReadSuccess
notifications.alreadyUpToDate
notifications.loadMore
notifications.loadMoreAria
notifications.loading
notifications.empty.title
notifications.empty.description
notifications.error.title
notifications.error.description
notifications.error.retry
notifications.errors.validation
notifications.errors.unauthenticated
notifications.errors.unavailable
notifications.categories.invitation.title
notifications.categories.invitation.description
notifications.categories.projectAssignment.title
notifications.categories.projectAssignment.description
notifications.categories.taskAssignment.title
notifications.categories.taskAssignment.description
notifications.categories.taskStatusChanged.title
notifications.categories.taskStatusChanged.description
notifications.categories.clientTaskBlocking.title
notifications.categories.clientTaskBlocking.description
notifications.categories.clientSubmission.title
notifications.categories.clientSubmission.description
notifications.categories.deliverableSubmitted.title
notifications.categories.deliverableSubmitted.description
notifications.categories.changesRequested.title
notifications.categories.changesRequested.description
notifications.categories.reviewApproved.title
notifications.categories.reviewApproved.description
notifications.categories.deliverableDelivered.title
notifications.categories.deliverableDelivered.description
notifications.categories.deadlineReminder.title
notifications.categories.deadlineReminder.description
notifications.categories.deadlineOverdue.title
notifications.categories.deadlineOverdue.description
notifications.categories.reviewInactivityReminder.title
notifications.categories.reviewInactivityReminder.description
notifications.categories.linkReportedBroken.title
notifications.categories.linkReportedBroken.description
notifications.categories.system.title
notifications.categories.system.description
```

Also add `shell.nav.links.notifications` to both catalogs for future S06-07 use. It is catalog-only in S06-03.

Spanish is visible default (`es-MX`); English is the exact semantic equivalent (`en-US`). Do not translate stored enum values, use a fall-through raw key, or vary the JSON nesting between catalogs. Add a parity test that recursively compares `notifications` keys and validates the one shell label exists in both locales.

## 11. Verification contract

Do not run verification in preparation of this specification; the Project Owner expressly stated current S06-02 verification already passed and no repository verification command is requested now. The implementation worker must run the following only after the required keyset migration is applied and types are regenerated.

### 11.1 Focused unit and component tests

| Test target | Required cases |
| --- | --- |
| `queries.test.ts` | Calls only the inbox RPC with bounded arguments; correctly narrows safe fields; throws safe server error on RPC error; preserves returned order; rejects malformed cursor before RPC; asserts result contains none of `eventId`, `entityId`, `projectId`, `deliveryStatus`, provider/suppression fields. |
| `actions.test.ts` | Invalid UUID rejects before session/client/RPC; unauthenticated returns only closed error; mark-one uses only recipient UUID; mark-all sends no arguments; RPC error maps to `UNAVAILABLE`; `false` and zero are successful idempotent results; only required paths are revalidated; no action returns raw error/ID. |
| `notification-inbox.test.tsx` | Generic localized categories for every trigger mapping; no raw trigger/IDs/provider/suppression/payload text; unread/read text indicator; mark-one pending and outcome; mark-all semantics; keyboard button use; empty state; composite-keyset load-more and retry behavior; error/retry state; narrow semantic DOM assertions. |
| catalog parity test | Exact `notifications` key-tree parity, required category coverage, and `shell.nav.links.notifications` in both catalogs. |
| protected-route guard test | Each active role can reach normalized `/notificaciones`; role-scoped cross-role paths still redirect; an arbitrary shared-looking path remains denied. |

A UI component test is permitted to use jsdom. The current Vitest default is Node; configure jsdom narrowly through a test-file annotation or a focused project configuration only if that is the repository's accepted convention. Do not change every test to jsdom and do not add Playwright.

### 11.2 Required manual acceptance journey

After focused automation is green, use real authenticated mutable-sandbox accounts:

1. Create/trigger a known existing lifecycle event that produces an authorized `in_app` recipient row for User A. Do not use direct database inserts to simulate inbox behavior.
2. Sign in as User A, open `/notificaciones`, and verify Spanish default page heading, generic safe category, arrival timestamp, unread text, and unread shell count.
3. Mark one unread notification. Verify the button pending state, authoritative server refresh, read label, and changed protected-shell badge count.
4. Mark all remaining unread notifications. Verify only User A's in-app rows are affected, zero is a safe outcome on repeat, and no external notification is touched.
5. Sign in as User B. Attempt a forged User A recipient UUID through the Server Action boundary. Verify User B's UI cannot make User A's row read and receives no raw authorization/database detail.
6. Verify an ordinary inbox does not render an external channel, `suppressed`, `provider_disabled`, provider name, configuration status, recipient contact data, event payload, project/entity ID, queue data, retry, resend, or external-delivery claim.
7. Repeat the primary journey in `/en/notificaciones`, dark/light themes, 375px viewport, keyboard-only navigation, and a screen-reader inspection of labels/status.
8. Before application implementation begins, apply the keyset migration and regenerate types. Then create/seed a deterministic valid scenario with records at the same `created_at` boundary and prove no skipped/duplicated row across continuation. This must be database/function evidence, not a client deduplication test.

### 11.3 Required implementation commands

Run only after code exists:

```bash
npm run test -- src/lib/notifications/__tests__/queries.test.ts src/lib/notifications/__tests__/actions.test.ts src/app/[locale]/(protected)/notificaciones/_components/notification-inbox.test.tsx
npm run typecheck
npm run lint
npx prettier --check src/lib/notifications src/app/[locale]/(protected)/notificaciones src/lib/auth/routes.ts src/app/[locale]/(protected)/layout.tsx messages/es-MX.json messages/en-US.json
npm run build
```

If the repository test path requires quoting due to the route-group parentheses, use the shell's appropriate quoting. Report actual outcomes exactly; do not claim a database/RLS proof from mocked tests.

## 12. Acceptance criteria

S06-03 is complete only when all criteria are met:

1. Every active authenticated role can reach `/notificaciones` and `/en/notificaciones`; unrelated cross-role routes retain existing denial/redirect behavior.
2. The inbox reads only `list_my_in_app_notifications` through a server-only typed module and a cookie-authenticated client.
3. The browser receives only `recipientId`, `trigger`, `createdAt`, `occurredAt`, and `readAt`; it displays no raw IDs or unneeded fields.
4. The UI maps the complete current trigger union to generic localized copy and exposes no raw payload-derived text.
5. Mark-one and mark-all use only the existing self-only RPCs. They are idempotent, reject forged/malformed input safely, and never mutate an external row or another recipient's row.
6. After a successful or stale mark action, `router.refresh()` obtains authoritative list and badge state; no optimistic read state is fabricated.
7. The inbox has correct loading, empty, action-error, load-more error/retry, read/unread, keyboard, screen-reader, narrow-width, and theme behavior.
8. Exact Spanish/English semantic-key parity exists for all S06-03 visible content.
9. No provider, suppression, queue, operational diagnostic, external channel, external dispatch, scheduler, API endpoint, realtime subscription, polling loop, cache/queue, or app-nav link is added.
10. The keyset migration is applied and generated types are regenerated before application work; same-timestamp continuation has explicit database-level proof.
11. Focused tests, typecheck, lint, Prettier check, build, and manual acceptance journeys have factual recorded outcomes.

## 13. Out of scope and stop conditions

### Out of scope

- S06-04 suppressed operations queue and authorized diagnostics.
- S06-05 manual alert evaluation and its flag.
- S06-06 endpoint guards/webhooks.
- S06-07 desktop/mobile navigation links and sprint closeout.
- Deep links from notification item to project/task/deliverable/entity destinations.
- Event payload rendering, notification search, filtering, archive/delete, preference editing, exports, bulk selection, notification settings, realtime updates, infinite polling, or offline behavior.
- Any provider activation, SDK/import, fetch, provider message/receipt, provider template operation, schedule, QStash/Workflow action, deployment, DNS, or domain/email configuration.

### Stop conditions

| Discovery | Required response |
| --- | --- |
| Keyset migration is not applied to `jsf-pm-dev`, generated types are absent/stale, or generated function arguments differ from §8.2 | Do not implement or dispatch S06-03; apply the exact migration and regenerate types first. |
| A proposed UI needs raw event payload or a deep-link target | Keep it out of S06-03; create a separate authorization/projection decision. |
| A non-owner can read/mutate a recipient row through test or live evidence | Block as authorization defect; correct database/action path, not client filtering. |
| Any disabled adapter/config/provider module becomes necessary for inbox display | Stop; that violates item separation and server-only capability boundary. |
| A query/action requires a base-table select or service role | Stop; use the approved RPC or seek an accepted database decision. |
| Same-timestamp cursor continuation skips or duplicates a record | Block until the applied keyset function and regenerated types are verified against the exact continuation contract. |
| An implementation proposes a timer, polling, websocket, local cache, or optimistic read transition | Reject as out of scope and contrary to online-only behavior. |
| An action/error UI exposes an exception, Supabase message, function name, UUID, recipient, payload, configuration, or provider detail | Block until the safe closed result mapping is restored. |

## 14. Handoff requirements

The implementation handoff must report:

- Exact migration path, `jsf-pm-dev` MCP application result, and unchanged generated-types provenance before application implementation.
- Confirmed non-changes after the prerequisite migration: no adapter/config/provider, queue, evaluator, endpoint, or app-nav link mutation.
- Test files and each verification command with factual result.
- Authorization evidence distinguishing database/RPC enforcement from mocked component coverage.
- Localization and accessibility evidence, including locale parity and keyboard/live-region behavior.
- Manual authenticated acceptance results, including User A/User B ownership isolation.
- Known limitation: notification items intentionally do not deep-link in S06-03 because the safe feed projection does not provide an independently authorized destination.
- Any residual blocker or deviation. No claim of external email, WhatsApp, scheduling, receipt, provider, or deployment functionality is permitted.
