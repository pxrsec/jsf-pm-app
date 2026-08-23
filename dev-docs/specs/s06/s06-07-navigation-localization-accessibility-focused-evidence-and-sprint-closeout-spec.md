---
title: S06-07 Navigation, Localization, Accessibility, Focused Evidence, and Sprint Closeout Specification
status: implementation-ready
version: 1.0
sprint_id: S06
epic_id: E08
work_item_id: S06-07
feature_slug: s06-07-navigation-localization-accessibility-focused-evidence-and-sprint-closeout
project: Joya Star Films Project Management App
branch: feature/s06-e08-notification-scheduling-and-external-providers-capability-track
risk: high
implementation_scope: application navigation, localized presentation, API-contract reconciliation, test/evidence integration, and closeout documentation only; no migration; no provider operation; no scheduler
created: 2026-08-23
updated: 2026-08-23
author_profile: engineering-manager
authority:
  - Project Owner direction
  - ADR-024 Deferred External Provider Activation and Epic 08 Capability Delivery
  - dev-docs/specs/s06/s06-e08-notification-scheduling-and-external-providers-capability-track-sprint-plan.md
  - dev-docs/specs/s06/s06-e08-notification-capability-contract-mapping-reference.md
  - dev-docs/specs/s06/s06-03-notification-recipient-inbox-read-state-spec.md
  - dev-docs/specs/s06/s06-04-authorized-internal-notification-queue-suppressed-delivery-diagnostics-spec.md
  - dev-docs/specs/s06/s06-05-shared-alert-evaluation-development-only-manual-control-spec.md
  - dev-docs/specs/s06/s06-06-inactive-provider-facing-routes-activation-safe-boundaries-spec.md
  - supabase/migrations/20260822140000_s06_e08_notification_capability_suppression.sql
  - supabase/migrations/20260822150000_s06_e08_alert_evaluation.sql
  - supabase/migrations/20260822160000_s06_e08_notification_inbox_keyset_pagination.sql
  - supabase/migrations/20260822170000_s06_e08_notification_operations_queue_keyset_pagination.sql
  - contracts/openapi/jsf-pm-api.openapi.yaml
  - AGENTS.md
prerequisites:
  - S06-01 through S06-06 are complete on the declared feature branch
  - all four listed S06 migrations are already applied to jsf-pm-dev and src/lib/database.types.ts is the unchanged generated result
  - recipient inbox route exists at /notificaciones and /en/notificaciones
  - authorized operations routes exist at /admin/notificaciones, /en/admin/notificaciones, /pm/notificaciones, and /en/pm/notificaciones
  - S06-06 inactive provider-facing operation blocks already return the documented uniform 404 ApiError envelope
successor_work_items: []
---

# S06-07 — Integrate Navigation, Localization, Accessibility, Focused Evidence, and Sprint Closeout

## 1. Objective

Close Sprint 06 as one coherent **development capability**. Integrate the implemented recipient inbox and authorized internal operations routes into the existing authenticated navigation without changing their security model; repair the one outstanding OpenAPI enum drift; verify locale, accessibility, responsive, role-isolation, and route behavior; and create a factual closeout record.

This item is not a provider activation slice. It must not convert any completed S06 boundary into an external email, WhatsApp, QStash, Workflow, webhook, receipt, scheduler, deployment, DNS, or production claim.

At completion:

1. Every active authenticated application role has one real locale-aware navigation path to their own `/notificaciones` inbox.
2. Only an Admin or a currently eligible PM Lead sees a real locale-aware navigation path to the already-authorized internal operations route.
3. Operator, Client, PM Watcher, unauthorized PM, inactive, unauthenticated, and forged callers remain unable to obtain operations data. Navigation visibility is an affordance; server route checks, Server Action gates, and database authorization remain authoritative.
4. Desktop and mobile navigation expose the same authorized destinations and preserve the existing role-home link, existing secondary route, language switcher, theme control, notification unread badge, sign-out behavior, Escape behavior, and drawer focus restoration.
5. The OpenAPI `NotificationDeliveryStatus` enum matches the applied database status vocabulary by adding exactly `suppressed`.
6. The Sprint 06 closeout record distinguishes source-backed development capability evidence from provider, hosted, production, and deployment evidence that does not exist.

---

## 2. Database and migration determination

### 2.1 No migration is required or authorized

**S06-07 requires no migration. Do not create a migration file.**

The applied S06 database baseline already contains the required notification status, suppression facts, safe read functions, evaluator, and keyset pagination boundaries. This work item changes no table, enum, constraint, function, view, RLS policy, grant, index, Realtime publication, trigger, seed, or generated type.

In particular, do not modify:

- `notification_events`, `notification_recipients`, `notification_delivery_status`, or the terminal `suppressed/provider_disabled` database behavior;
- `private.fan_out_disabled_external_notifications`, `private.claim_notification_batch`, `private.record_provider_receipt`, or either public notification list function;
- `public.mark_notification_read`, `public.mark_all_notifications_read`, or `public.evaluate_notification_alerts`;
- any S06 migration source or `src/lib/database.types.ts`; or
- `jsf-pm-dev`, Supabase MCP state, direct SQL, dashboard state, or hosted configuration.

The required OpenAPI enum repair is a contract-source reconciliation only. It does not alter the database enum, generate types, create an HTTP implementation, or authorize a new API consumer.

### 2.2 Applied database facts this item preserves

The closeout must preserve these exact facts:

- An eligible external `email` or `whatsapp` recipient becomes terminal `suppressed/provider_disabled` in the disabled S06 posture; an ineligible external channel creates no external recipient row.
- A suppressed row has no provider attempt, claim, retry, message ID, receipt, or automatic later-send behavior.
- The ordinary inbox reads only caller-owned `in_app` rows. It does not receive external status, suppression reasons, queue records, provider information, contact data, raw payloads, or another user’s data.
- The operations queue reads only the aggregate authorized suppression representation. It never shows recipient identity/contact information, raw payloads, provider/configuration values, or retry controls.
- The manual evaluator is available only to an authorized Admin or active PM Lead when the exact server-only local-development predicate is true. It evaluates through the applied public database RPC and does not schedule or dispatch externally.

A navigation or catalog change must not weaken any of these boundaries.

---

## 3. Authority and scope reconciliation

### 3.1 Authority order

Apply this order to every decision:

1. Direct Project Owner instruction and accepted ADR-024.
2. Applied migration sources and the unchanged generated database type artifact for database behavior.
3. The Sprint 06 plan for scope, Definition of Done, exclusions, and evidence requirements.
4. S06-01 mapping reference for exact route, authorization, projection, and no-replay facts.
5. S06-03 through S06-06 specifications for already-owned implementation contracts.
6. This specification for final integration, contract reconciliation, verification, and closeout.
7. `contracts/openapi/jsf-pm-api.openapi.yaml` for interface vocabulary.
8. `AGENTS.md`, installed Next.js documentation, package scripts, and established repository patterns.

A lower source must not silently broaden a higher source. If the current implementation contradicts a governing S06 rule, correct the smallest proven defect and re-run the affected focused tests before closeout. Do not hide a defect in closeout prose.

### 3.2 Ownership reconciliation

| Subject | S06-07 responsibility | Explicit non-responsibility |
| --- | --- | --- |
| Shared inbox navigation | Connect the real shared inbox route to desktop/mobile navigation for all active roles. | Do not redesign the inbox, add deep links from inbox items, or change inbox RPC/action behavior. |
| Operations navigation | Compute a server-authorized boolean and show operations navigation only to Admin or active PM Lead. | Do not make `role === "pm"` sufficient; do not move operations authorization into a client component. |
| Shared shell | Extend the existing `AppNav` and `MobileNavToggle`; preserve one authenticated header/drawer system. | Do not create a second header, sidebar, notifications shell, or role-specific competing nav. |
| Localization/accessibility | Close any proven catalog, label, focus, mobile, theme, or semantic interaction gaps caused by S06 integration. | Do not add user-visible provider/configuration detail or change stored enum values. |
| API contract | Add `suppressed` to `NotificationDeliveryStatus` and correct stale provider-operation descriptions so they truthfully describe the existing inactive 404 contract. | Do not add routes, payloads, success responses, schemas, server URLs, authentication schemes, API versions, or provider operation semantics. |
| Closeout | Record exact artifacts and actual evidence after implementation. | Do not claim an unexecuted test, manual journey, provider operation, hosted behavior, deployment, or production fact. |

### 3.3 Resolved information-architecture decisions

The following decisions are binding for implementation:

1. **Inbox destination:** every active authenticated role receives the same locale-aware `Notifications` link to `/notificaciones`. The `@/i18n/routing` helper supplies `/en/notificaciones` in English; no code manually constructs `/en`.
2. **Operations destination:** Admin receives `/admin/notificaciones`. A PM receives `/pm/notificaciones` only when a fresh server-side `hasActivePmLeadMembership` check succeeds for the authenticated user. The boolean is computed in the protected server layout and passed down as presentation data.
3. **No unavailable operations stub:** Client, Operator, PM Watcher, and a PM without an active PM Lead membership render no operations item at all. They do not receive an `aria-disabled` operations placeholder, a tooltip explaining access, an empty menu group, or a route hint.
4. **Inbox entry affordance:** the existing unread badge becomes part of a single named inbox link. The link itself has the localized accessible name for navigation; the nested badge is visual-only count presentation and must not create a nested interactive control or an in-link live/status announcement.
5. **Unread zero state:** the inbox link remains visible and keyboard-reachable when unread count is zero. Preserve the zero-count announcement as one visually hidden status node that is a sibling of—not a descendant of—the inbox link, so assistive technology receives the count without duplicate link announcement.
6. **Navigation order:** desktop and mobile order is exactly role home, existing role-specific secondary route, inbox, then operations when authorized. Language, theme, unread count, profile, and sign-out retain their established positions in their respective desktop/mobile shell regions.

---

## 4. Navigation and authorization contract

### 4.1 Existing route inventory

| Surface | Default Spanish path | English path | Authorized caller |
| --- | --- | --- | --- |
| Recipient inbox | `/notificaciones` | `/en/notificaciones` | Any active authenticated Admin, PM, Operator, or Client; self-only data remains enforced by the existing RPC/RLS/action boundary. |
| Admin operations queue | `/admin/notificaciones` | `/en/admin/notificaciones` | Active application-role Admin. |
| PM operations queue | `/pm/notificaciones` | `/en/pm/notificaciones` | Active application-role PM with current active PM Lead membership; the existing queue RPC additionally limits rows by project. |

No link grants access. Direct-route and Server Action checks remain required and unchanged.

### 4.2 Protected-layout capability derivation

Modify the existing protected layout, rather than `AppNav` or a Client Component, to determine operations navigation eligibility.

Required order in the layout:

1. Preserve its existing session requirement, normalized locale-aware pathname check, shared-authenticated inbox exception, and role-scoped route enforcement.
2. Reuse the existing cookie-authenticated Supabase client already needed for shell data/unread count; do not construct a browser client or service-role client.
3. Derive `canAccessNotificationOperations` exactly as follows:

```text
session.role === "admin"                         => true
session.role === "pm" and hasActivePmLeadMembership(...) => true
all other roles                                   => false
membership-query error                            => false
```

4. For a PM, call the existing server-only `hasActivePmLeadMembership(supabase, session.user.id)` helper. Do not duplicate its `project_members` query in the layout and do not expose its result, queried membership rows, project IDs, or error state to the browser.
5. Pass only the boolean to `AppNav`.
6. A false result may hide a valid operations link temporarily if the membership probe fails; that is the required fail-closed presentation behavior. It must not block the ordinary inbox or other shell rendering.

The layout must not query the operations queue, evaluator, provider configuration, event tables, recipient tables, or provider-facing routes merely to render navigation.

### 4.3 `AppNav` and desktop contract

Extend `AppNav` with the boolean prop from §4.2 and pass it unchanged to `MobileNavToggle`.

Desktop must:

1. retain the existing role-home link and existing real secondary route unchanged;
2. render one locale-aware `Link` to `/notificaciones` using `shell.nav.links.notifications`;
3. make that link the sole interactive wrapper for `NotificationBadge` and its count presentation;
4. render the operations link only when `canAccessNotificationOperations === true`;
5. derive the operations href from the authoritative application role only:
   - Admin: `/admin/notificaciones`;
   - PM with `canAccessNotificationOperations === true`: `/pm/notificaciones`;
   - no other value is legal;
6. use a new localized `shell.nav.links.notificationOperations` label for the operations link;
7. use `@/i18n/routing` `Link` for every new link;
8. use visible text and a programmatic link name. Badge count is supplementary status, not the only way to identify the inbox destination;
9. preserve existing `nav` landmark label and avoid nested `<a>`, nested `<button>`, duplicate link names, or a role-status control that relies on color alone.

Do not add a notification route as the post-auth default, alter `ROLE_DEFAULT_PATHS`, add an `aria-disabled` inbox item, or display a generic `/pm/notificaciones` item to every PM.

### 4.4 `MobileNavToggle` contract

The mobile drawer receives the same boolean and renders the same destination matrix in the same order.

For every live inbox/operations link:

1. Use the locale-aware `Link` helper.
2. Invoke the existing `setIsOpen(false)` transition in the link’s click handler before navigation, exactly as role-home and secondary links do.
3. Use one full-width or otherwise clearly tappable link target of at least 44 by 44 CSS pixels. The count badge is not a separate target.
4. Retain native link keyboard behavior. Enter activates the link; the drawer closes; the navigation route loads.
5. Retain existing Escape behavior: when the drawer is open, Escape closes it and restores focus to the menu toggle.
6. Do not use client-side membership discovery, an operations route probe, browser storage, a feature flag, an environment value, or a hidden link.

When the operations item is absent, no blank vertical gap or inaccessible hidden interactive node may remain.

### 4.5 Navigation test matrix

Extend the established `__tests__/app-shell/navigation.test.ts` rather than introducing a second navigation test harness. It must prove each row in this matrix for both desktop shell and mobile drawer presentation.

| Fixture | Inbox link | Operations link | Operations href if shown |
| --- | --- | --- | --- |
| Admin | Present, active, locale-aware | Present, active | `/admin/notificaciones` |
| PM Lead | Present, active, locale-aware | Present, active | `/pm/notificaciones` |
| PM Watcher / PM with false capability | Present, active, locale-aware | Absent | n/a |
| Operator | Present, active, locale-aware | Absent | n/a |
| Client | Present, active, locale-aware | Absent | n/a |

Also prove:

- inbox destination is usable when `unreadCount` is zero and when it exceeds the visual overflow threshold;
- links preserve locale routing in the English fixture without manually embedding `/en` in component code;
- inbox and operations drawer selections close the drawer;
- Escape still restores focus to the menu toggle after the new links exist;
- existing role-home, secondary navigation, language switcher, theme toggle, sign-out, and notification count behavior remain present;
- no unavailable operations string, operations href, or route hint renders for the denied fixtures; and
- a `canAccessNotificationOperations: true` value paired with a non-Admin/non-PM fixture is not a legal production route. The implementation must not create such a branch; the test fixture must not normalize it into a third operations destination.

The test proves presentation/wiring only. Existing route, action, RPC, and RLS tests remain the evidence for authorization enforcement.

---

## 5. Localization, semantics, and accessibility contract

### 5.1 Catalog changes

Both `messages/es-MX.json` and `messages/en-US.json` must contain the following new leaf keys with exactly identical nesting:

```text
shell.nav.links.notifications
shell.nav.links.notificationOperations
shell.nav.notifications.inboxLinkAria
shell.nav.notifications.inboxLinkAriaWithCount
```

`notifications` and `notificationOperations` already exist and must retain their complete existing trees. This item must not rename, flatten, duplicate, or remove their existing keys.

Copy requirements:

- `shell.nav.links.notifications` names the inbox destination only; it does not claim an email, WhatsApp, provider, real-time feed, delivery, or unread guarantee.
- `shell.nav.links.notificationOperations` names the internal operational history only; it must not say provider health, queue processor, external delivery, scheduler, configuration, or send.
- `inboxLinkAria` identifies a link to the recipient inbox without a count.
- `inboxLinkAriaWithCount` identifies the same link and interpolates only `{count}`. It must not interpolate user names, IDs, provider/channel status, project names, or raw notification content.
- Spanish is the default visible locale; English is semantically equivalent. Stored enum values remain English and are never used as display copy.

Update `__tests__/i18n/message-catalogs.test.ts` to assert the four required leaves, recursive parity, non-empty string values, and matching interpolation parameter sets for the two new aria keys. Replace the obsolete test description calling `shell.nav.links.notifications` “future-only”; it is now active navigation.

### 5.2 Badge and link semantics

`NotificationBadge` remains the single component that formats count and overflow state. Do not duplicate its count arithmetic in `AppNav` or `MobileNavToggle`.

The linked inbox affordance must satisfy all conditions:

1. It is one `<a>` rendered by the locale-aware `Link` helper, not a button that calls `router.push`.
2. It has a localized accessible name. For a positive count, use the count-aware label. For zero, use the no-count label.
3. The inner `NotificationBadge` is non-interactive and `aria-hidden="true"` visual presentation. Render exactly one visually hidden sibling `role="status" aria-live="polite"` count node outside the link; it preserves the zero-count announcement and announces later server-rendered count changes without becoming part of the link’s accessible name.
4. The visual count remains text, not color alone.
5. The inbox link has a visible focus indicator in both themes and a minimum 44 by 44 CSS-pixel target when its compact desktop/mobile composition would otherwise be smaller.
6. The count does not expose notification titles, payloads, external-channel state, suppression details, queue status, or other users’ data.

### 5.3 Existing route recovery treatment

S06-03 already owns inbox `loading.tsx` and `error.tsx`; S06-04/05 rely on the established protected-route recovery surface. S06-07 must inspect each concrete notification route and add or amend a route-level recovery file only for a demonstrated gap.

Required behavior for every affected notification page:

- loading presentation exposes a localized busy/status state and contains no provider/configuration/recipient detail;
- error presentation exposes only localized generic recovery copy and an explicit retry that invokes a fresh online request;
- retry never queues, persists, replays, polls, or auto-retries a mutation;
- denied operations callers are redirected by the existing role/capacity route behavior before operations data is queried or rendered;
- no route error/not-found surface displays an exception message, error digest, UUID, project ID, recipient ID, event ID, raw RPC error, provider detail, or authorization rationale.

Do not create artificial `not-found.tsx` files solely for symmetry. If a real route-specific not-found state is required by installed Next.js behavior or an exercised denial/recovery gap, it must use the established localized safe recovery pattern and locale-aware return navigation. It must not disclose whether an operations record, membership, or provider route exists.

### 5.4 Accessibility and responsive acceptance

The integrated route/navigation experience must meet all of the following:

1. One `nav` landmark retains its localized name; links have meaningful localized text/name.
2. Desktop and mobile support keyboard Tab order, Enter activation, visible focus, and no keyboard trap.
3. Mobile drawer Escape closes and returns focus to the toggle after the added links exist.
4. Notification inbox mark-one, mark-all, load-more/retry, queue load-more/retry, and evaluator trigger/confirmation preserve their prior native controls, localized status/alert regions, pending disabled states, and focus behavior.
5. Operations terminal state/reason, inbox read/unread state, and evaluator result remain understandable through text and programmatic semantics, never color alone.
6. All primary interactive targets affected by this work remain at least 44 by 44 CSS pixels.
7. At a 375px viewport, Spanish and English labels do not clip, overlap, create page-level horizontal scrolling, or hide a required confirmation/cancel/retry action. Existing truncation is permitted only for non-essential decorative text, never the sole accessible name.
8. Light and dark themes retain readable contrast and visible focus for navigation, badges, statuses, queue rows, dialogs, and recovery controls.
9. This is focused application accessibility evidence, not a WCAG certification, assistive-technology compatibility guarantee, or real-device audit.

---

## 6. OpenAPI contract reconciliation

### 6.1 Required enum repair

Modify only this schema line in `contracts/openapi/jsf-pm-api.openapi.yaml`:

```yaml
NotificationDeliveryStatus:
  type: string
  enum: [pending, processing, sent, delivered, read, failed, cancelled, suppressed]
```

Rules:

- Add `suppressed` exactly once, at the end of the existing enum sequence.
- Do not rename, delete, reorder, or infer additional database statuses.
- Do not add `suppression_reason` to a public HTTP response because no approved S06 API consumer/route contract requires it.
- Do not implement `/api/v1/admin/notification-recipients`, change its query parameters, or claim that its documented response is a live S06 application surface.

This exact change resolves the S06-06-recorded discrepancy between the applied database enum and the canonical OpenAPI enum.

### 6.2 Required stale-description repair

The four already-inactive reserved provider operations still contain stale descriptions referring to “Sprint 02” and future operational behavior. In this closeout item, update only their `description` text so it is accurate to the existing S06 contract:

- `/api/webhooks/whatsapp` `GET` / `verifyWhatsappWebhook`;
- `/api/webhooks/whatsapp` `POST` / `receiveWhatsappWebhook`;
- `/api/workflows/notification-processor` `POST` / `runNotificationProcessor`; and
- `/api/workflows/alert-scheduler` `POST` / `runAlertScheduler`.

Each updated description must state, in contract-appropriate language, that the operation is reserved but inactive in Sprint 06 and uniformly returns the documented generic 404 API error without request parsing, signature verification, configuration inspection, provider/client construction, database command, receipt, scheduling, or dispatch.

Do not alter these operation IDs, paths, methods, tags, `security` declarations, request schemas, `x-provider-status: inactive`, or their only `404` response. Do not add a 200/202/401/403/503 response, challenge behavior, endpoint health behavior, provider payload, SDK reference, or activation date.

### 6.3 Static contract test

Extend the established S06-06 OpenAPI test location; if no separate test exists, add one focused co-located contract assertion under the existing route-contract test convention. It must prove:

1. `NotificationDeliveryStatus` contains every pre-existing value plus exactly one `suppressed` value;
2. no unrelated enum or path block is changed by the test target;
3. the four reserved operations retain their exact IDs, `x-provider-status: inactive`, and only `404` `ApiError` response;
4. their descriptions no longer claim “Sprint 02” or operational provider processing; and
5. no S06 test describes that enum reconciliation as live API, provider, or deployment evidence.

---

## 7. File contract

### 7.1 Modify

| Path | Required bounded change | Prohibited change |
| --- | --- | --- |
| `src/app/[locale]/(protected)/layout.tsx` | Derive fail-closed `canAccessNotificationOperations` using the existing server-only PM Lead helper and pass it to `AppNav`. Preserve all existing session, locale, shared-route, role-route, unread-count, and shell behavior. | Browser capability query, service role, operations queue/evaluator/provider query, broad route-guard rewrite. |
| `src/components/shared/app-nav/app-nav.tsx` | Add locale-aware inbox link/badge wrapper and conditional authorized operations link; accept/pass the boolean capability prop. | Second navigation system, raw `next/link`, manual `/en` concatenation, client membership query, all-PM operations link. |
| `src/components/shared/app-nav/_components/mobile-nav-toggle.tsx` | Render mobile parity for inbox and conditional operations links; close drawer before route navigation. | Client authorization/configuration query, unavailable operations stub, drawer behavior regression. |
| `src/components/shared/app-nav/_components/notification-badge.tsx` | Adjust only if required to avoid duplicate/invalid accessible announcement once nested in the inbox link. | Count-source/query change, provider/operations data, browser persistence, new navigation. |
| `messages/es-MX.json` | Add only §5.1 navigation/accessibility keys with truthful Spanish copy. | Provider/configuration/recipient/secret/status-detail copy. |
| `messages/en-US.json` | Exact §5.1 structural counterpart with truthful English copy. | Locale-only key drift or English fallback. |
| `__tests__/app-shell/navigation.test.ts` | Add §4.5 focused desktop/mobile role/capability/link/drawer coverage. | Replacing route/RLS tests with presentation-only claims. |
| `__tests__/i18n/message-catalogs.test.ts` | Add exact key/interpolation/parity assertions and update the stale “future-only” wording. | New parallel catalog test framework. |
| existing S06-06 contract/route test location | Add §6.3 enum/description reconciliation assertions. | Fake provider/webhook/workflow test. |
| `contracts/openapi/jsf-pm-api.openapi.yaml` | Make exactly §6.1 and §6.2 contract repairs. | New API surface, version/security/server/schema rewrite, provider activation semantics. |
| `CHANGELOG.md` | Add one factual chronological S06-07 entry after all actual implementation/evidence is complete. | Claiming sends, provider configuration, scheduling, receipt, deployment, DNS, or production behavior. |

### 7.2 Create after evidence exists

| Path | Required content |
| --- | --- |
| `dev-docs/specs/s06/s06-sprint-06-closeout-verification.md` | Factual closeout record conforming exactly to §9. It must be written after the final commands and manual evidence are known; it must not use placeholders, predicted outcomes, or copied assertions as results. |

### 7.3 Explicitly do not modify

Do not modify:

- `supabase/migrations/**`, `src/lib/database.types.ts`, Supabase policies/functions/views/triggers/grants/indexes, or any hosted database state;
- `src/lib/notifications/config.ts`, `types.ts`, `channel-adapters.ts`, `errors.ts`, provider-endpoint guard, endpoint route handlers, evaluator semantics, inbox query/action schemas, operations query/action schemas, or lifecycle fan-out code, except when a focused test identifies an actual defect directly caused by S06 integration;
- provider credentials, `.env*`, app configuration, package dependencies, lockfile, deployment configuration, DNS/domain/mail configuration, or external account state;
- routes, provider endpoints, API request/response payloads, schedules, webhooks, receipt behavior, polling, timers, service workers, offline queues, or browser storage; and
- unrelated E9/E10 documentation or historical evidence.

If a proposed change is outside this table, stop and record the exact authority needed before expanding scope.

---

## 8. Focused verification contract

### 8.1 Test ownership and truthfulness

The Hermes test-engineer owns the test-first contract. Preserve all supplied VC identifiers. Do not weaken existing S06 negative coverage, replace a database/RLS assertion with a UI assertion, or add provider fixtures to make the sprint look complete.

Mocked tests prove module composition, presentation, safe projection, and invocation boundaries. They do not prove applied database RLS, database-time evaluator semantics, terminal suppression constraints, real provider behavior, hosted routing, deployment, or production state.

### 8.2 Required focused automated coverage

The final focused set must include the already-owned S06 tests plus the changed integration tests. At minimum, execute and report the actual outcome of:

```bash
npm run test -- __tests__/app-shell/navigation.test.ts __tests__/i18n/message-catalogs.test.ts src/lib/notifications/__tests__/queries.test.ts src/lib/notifications/__tests__/actions.test.ts src/lib/notifications/__tests__/operations-queries.test.ts src/lib/notifications/__tests__/operations-actions.test.ts src/lib/notifications/__tests__/alert-evaluator.test.ts src/lib/notifications/__tests__/alert-evaluator-actions.test.ts "src/app/[locale]/(protected)/notificaciones/_components/notification-inbox.test.tsx" "src/app/[locale]/(protected)/notificaciones/error.test.tsx" "src/app/[locale]/(protected)/pm/notificaciones/_components/notification-operations-queue.test.tsx" "src/app/[locale]/(protected)/pm/notificaciones/_components/manual-alert-evaluation-dialog.test.tsx" "src/app/[locale]/(protected)/pm/notificaciones/notification-operations-routes.test.tsx" src/lib/notifications/__tests__/provider-endpoint-guards.test.ts src/app/api/webhooks/whatsapp/route.test.ts src/app/api/workflows/notification-processor/route.test.ts src/app/api/workflows/alert-scheduler/route.test.ts
```

If the established S06-06 static OpenAPI test has a different existing path, append that exact path to the command. Do not omit it.

The focused tests must cover:

- all desktop/mobile role/capability navigation matrix rows in §4.5;
- locale routing, count-zero/count-overflow semantics, drawer close, Escape/focus return, and no denied-operations leak;
- exact catalog key parity, non-empty values, and matching interpolation contracts;
- ordinary inbox safe projection/read actions and absence of external/operations data;
- Admin/PM Lead operations access and PM Watcher/Operator/Client denial;
- manual evaluator gating, truthful no-send copy, safe aggregate result, and no duplicate-submit behavior;
- inactive routes remaining uniform and side-effect free; and
- OpenAPI `suppressed` enum plus provider-operation description reconciliation.

### 8.3 Final repository verification

After focused tests, manual journeys, and all code/configuration/documentation changes **except the factual closeout record** are complete, run the repository’s final integrated gate exactly once:

```bash
npm run verify
```

The command is the authoritative final repository gate because it executes format checking, lint, typecheck, production build, full tests, coverage, and production dependency audit according to `package.json`.

Rules:

1. Run `npm run verify` before authoring the final closeout record so that the record can contain its actual outcome rather than a prediction.
2. If it fails, record the failed stage and factual safe error summary, correct only the verified defect under proper authority, then run it again only after the correction.
3. Do not claim the sprint is ready for review while the final gate is failing or unexecuted.
4. Do not substitute partial successful commands for `npm run verify`.
5. Do not run provider commands, Supabase mutation commands, scheduler commands, local webhooks, deployment commands, or external account operations as part of final verification.
6. After `npm run verify` passes, write the factual closeout record and run `npx prettier --check dev-docs/specs/s06/s06-sprint-06-closeout-verification.md` plus `git diff --check`. These post-gate documentation checks validate the closeout artifact; they do not replace or rerun the final application gate.

### 8.4 Formatter scope

Before the final gate, run a targeted format check for every changed implementation artifact and the OpenAPI source. After the final gate, run the narrow closeout-document format check required by Rule 6. Use quoted route paths in the shell where parentheses are present. The implementation report must list each exact command and factual result.

---

## 9. Manual localhost evidence and required closeout document

### 9.1 Manual journey rules

Run manual journeys only after the focused automated suite is green. Use the approved mutable `jsf-pm-dev` sandbox and real authenticated accounts. Do not use direct table inserts to simulate notification behavior, real external providers, a local scheduler, provider credentials, fake receipts, public URLs, deployment, or production data.

Record persona/role, locale, viewport, entry route, action, observed result, verdict, and limitation for every journey below.

| ID | Required journey | Required result |
| --- | --- | --- |
| J-01 | Active Admin, Spanish desktop: use shared header inbox navigation from an Admin route. | Opens `/notificaciones`; inbox is usable; unread link/count is meaningful; no provider or operations detail appears. |
| J-02 | Active PM Lead, Spanish desktop: use inbox navigation, then operations navigation. | Inbox opens at `/notificaciones`; operations opens at `/pm/notificaciones`; queue remains project-authorized and terminal/no-send wording remains truthful. |
| J-03 | Active PM Watcher, Spanish desktop: inspect header/drawer and attempt direct `/pm/notificaciones`. | Inbox link is present; operations navigation is absent; direct route follows existing safe redirect/denial without queue data or capability explanation. |
| J-04 | Active Operator and active Client, Spanish desktop: inspect header/drawer and use inbox navigation. | Inbox link is present and usable; operations navigation is absent; no provider/queue data is exposed. |
| J-05 | Recipient inbox state: create a known real sandbox lifecycle event, then as its authorized recipient mark one read and mark all remaining reads. | Authoritative refresh updates inbox/badge behavior; no optimistic fabricated state; ordinary inbox remains free of operations/provider data. |
| J-06 | Operations/manual evaluator, authorized local posture: use the existing deliberate confirmation once and repeat in the same database window. | Safe aggregate only; no send/receipt/schedule claim; database-authoritative idempotency evidence is recorded separately; queue/inbox refresh truthfully. |
| J-07 | Manual-control denial: flag disabled and denied PM Watcher/Operator/Client fixtures. | Control is absent; a forged action is closed safely; no evaluator outcome, environment reason, provider/configuration detail, or queue data leaks. |
| J-08 | Inactive endpoint regression: invoke each of the four documented operations while inactive using the existing safe test/manual method. | Uniform generic 404 rejection; no event, receipt, queue, evaluator, provider, or database effect is claimed. |
| J-09 | English locale: repeat Admin inbox/operations and a denied role route in English. | Locale-aware links preserve `/en`; English copy is semantically equivalent; no manual locale path construction or raw enum/configuration text appears. |
| J-10 | Narrow accessibility/theme: at 375px, keyboard-only, light and dark themes, open drawer, use inbox and authorized operations links, exercise inbox read and evaluator dialog controls, then Escape the drawer/dialog where no action is pending. | Targets are usable and named; links close drawer; Escape/focus behavior works; no clipping/page horizontal scroll; state is textual/non-color; existing safe feedback remains legible. |

### 9.2 Database evidence boundary

The closeout must distinguish these direct authoritative facts from application-level tests:

- migration source and MCP application/type-generation provenance for all four S06 migrations;
- self-only inbox and mark-read enforcement;
- Admin/PM Lead operational queue authorization and denial of PM Watcher/Operator/Client;
- suppression terminality/eligibility/no-replay/claim-receipt exclusion;
- evaluator database time, reminder-window idempotency, trigger coverage, and client-submission exclusion; and
- Realtime publication remaining limited to `notification_recipients`.

If this evidence was obtained earlier in the sprint, cite its actual source/command/report and date. Do not rerun database operations merely to make closeout prose look fresh. If a required fact lacks authoritative evidence, state it as a blocker; do not infer it from UI tests.

### 9.3 Closeout document structure

Create `dev-docs/specs/s06/s06-sprint-06-closeout-verification.md` only after the final repository gate and manual journeys are complete. It must contain these exact sections:

1. **Identity, authority, evidence basis, and verdict** — branch/integration status only when directly verified; distinguish “ready for review,” “blocked,” and “not recorded.”
2. **Sprint Definition-of-Done traceability** — all 13 Sprint 06 DoD criteria, each marked Met, Blocked, or Not demonstrated, with exact evidence and limitations.
3. **Implemented route, command, projection, and navigation map** — inbox, Admin operations, PM Lead operations, manual evaluator, inactive provider endpoints, shared navigation, and their authoritative boundaries.
4. **Changed-artifact inventory and migration/type provenance** — group every actual S06 artifact by work item. List all four migration paths and state that S06-07 itself created/applied no migration and did not modify generated types.
5. **Automated verification record** — exact commands, actual exit/result, file/test totals when returned, and one final `npm run verify` result. Never copy anticipated pass numbers.
6. **Manual localhost evidence** — J-01 through J-10 in the format required by §9.1. Clearly label observations as localhost/sandbox evidence.
7. **Localization, theme, accessibility, security, and truthfulness** — exact parity/navigation/focus/status findings plus the explicit limit that this is not formal conformance, provider, deployment, or production evidence.
8. **OpenAPI reconciliation** — `NotificationDeliveryStatus` includes `suppressed`; four reserved provider operations remain inactive/404; no provider endpoint activation claim.
9. **Environment and operational status** — `jsf-pm-dev` provenance, no S06-07 database/provider/hosted mutation, and no production/preproduction/deployment claim.
10. **Deferred activation scope and known limitations** — every item in §10 below.
11. **Closeout sign-off and next owner action** — no Git integration, merge, push, or deployment claim unless separately and directly verified.

A closeout sentence may state only an executed command result, a directly observed local journey, a cited applied-migration/type provenance record, or a bounded source inspection. It must never turn a route shell, mocked test, local browser observation, or enum update into proof of provider dispatch, sender/domain validation, Meta verification, signature verification, QStash operation, scheduling, receipt, DNS, deployment, hosted reachability, production RLS, or production readiness.

### 9.4 Changelog entry

After the closeout outcome is known, add one chronological S06-07 entry to `CHANGELOG.md`. It must state only implemented facts:

- inbox and role-safe operations navigation were integrated into the existing desktop/mobile shell;
- Spanish/English navigation/catalog parity and focused accessibility behavior were completed;
- `NotificationDeliveryStatus` OpenAPI reconciliation added `suppressed` and inactive endpoint descriptions were made truthful;
- closeout document path and actual final verification result; and
- external provider activation and hosted/production work remain deferred.

Do not use “sent,” “delivered,” “provider integrated,” “webhook implemented,” “scheduled,” “QStash active,” “receipt processed,” “deployed,” or “production-ready.”

---

## 10. Deferred scope and prohibited claims

The closeout must explicitly retain all of the following as deferred:

- Resend account/sender/domain/DNS/API-key configuration and real email dispatch;
- Meta business, phone, template, webhook registration, signature verification, receipt handling, and real WhatsApp delivery;
- Upstash QStash signing, schedule creation, Workflow operation, and externally signed invocation;
- provider configuration activation, browser exposure, health/status UI, provider SDK construction, network dispatch, and queue processing;
- webhook body parsing, challenge response, receipt persistence, replay policy, or future active endpoint behavior;
- automatic send, replay, migration, requeue, or retry of historical suppressed records;
- Vercel, Cloudflare, Hostinger, DNS, domain/mailbox, deployment, preproduction, production Supabase, or hosted smoke-test work;
- real-device accessibility assessment, formal WCAG certification, legal/privacy approval, backup/restore, and E9/E10 operations; and
- any new notification trigger, deep link from inbox items, archive/search/filter/export/preferences, broad Realtime expansion, service worker, offline cache, polling, timer, or local scheduler.

---

## 11. Acceptance criteria

S06-07 is complete only when every condition is true:

1. No migration, generated type, Supabase state, provider state, schedule, webhook, deployment, or hosted-environment operation was created, modified, applied, or claimed by S06-07.
2. The protected server layout derives a fail-closed `canAccessNotificationOperations` boolean from the authenticated role and current existing PM Lead helper, then passes only that boolean to navigation presentation.
3. Every active role sees one real locale-aware inbox link in desktop/mobile navigation, including when unread count is zero.
4. Only Admin and an active PM Lead see a real operations link; PM Watcher, non-lead PM, Operator, and Client see no operations navigation or route hint.
5. Desktop and mobile use the same role/capability matrix; each live mobile selection closes the drawer; Escape/focus restoration, language switcher, theme, sign-out, unread badge, role-home, and secondary navigation are preserved.
6. The inbox link has a localized accessible name, non-duplicative count/status semantics, visible focus, and a compliant touch target. Existing badge count behavior is preserved without duplicate count logic.
7. All new catalog keys have exact Spanish/English structural parity, non-empty values, and matching interpolation parameters.
8. Notification recovery, retry, pending, status, dialog, queue, and route behavior remain safe, localized, online-only, keyboard-operable, non-color-dependent, theme-readable, and usable at 375px.
9. `NotificationDeliveryStatus` in the canonical OpenAPI source contains exactly one additional `suppressed` value; the four reserved provider operations retain their inactive/404 contract and truthful S06 descriptions.
10. No new HTTP API behavior, provider signature/body/configuration processing, provider SDK/network call, delivery, receipt, queue processing, scheduler, retry, or provider activation is introduced.
11. The focused automated command in §8.2 passes with actual reported results, including changed navigation/catalog/OpenAPI assertions and all owned S06 regression coverage.
12. Final `npm run verify` passes after all S06-07 artifacts are present, with actual outcome recorded. If it does not pass, closeout is blocked.
13. J-01 through J-10 are recorded factually, and database-authoritative evidence is separated from mocked/local UI evidence.
14. `CHANGELOG.md` and `s06-sprint-06-closeout-verification.md` accurately state completed capability, applied migration/type provenance, limitations, and deferred activation work without unsupported claims.

---

## 12. Stop conditions

| Discovery | Required response |
| --- | --- |
| The protected layout cannot derive PM Lead eligibility using the existing cookie-authenticated server boundary. | Stop. Do not show operations navigation to all PM users or query it in the client. Record the exact missing server boundary. |
| A navigation change exposes an operations link/data/route hint to PM Watcher, non-lead PM, Operator, Client, inactive, or unauthenticated callers. | Block integration. Correct the server capability derivation and presentation matrix; preserve route/RPC enforcement. |
| A proposed change needs provider configuration, secrets, provider SDK, fetch, webhook parsing, signature verification, queue claim, evaluator invocation, scheduler, or database mutation. | Stop. It is activation or data-boundary work outside S06-07. |
| An inbox or operations link is dead, manually constructs locale prefixes, bypasses `@/i18n/routing`, or produces nested interactive controls. | Block until the existing locale-aware navigation pattern is restored. |
| An accessibility change removes a localized name, focus behavior, native semantics, 44px target, non-color indicator, drawer Escape behavior, or safe error state. | Block until the regression is corrected and affected tests/manual evidence are repeated. |
| A provider-operation OpenAPI change alters paths, IDs, methods, security declarations, request schemas, inactive status, or 404 response shape. | Stop. Restore the bounded enum/description-only reconciliation. |
| The OpenAPI enum differs from the actual applied status vocabulary after adding `suppressed`, or another enum/path must change to make the contract coherent. | Stop and request a governing API/data decision; do not expand this closeout patch silently. |
| Required database/RLS/evaluator evidence is absent or contradictory. | Mark closeout blocked and report the exact missing/contradictory source. Do not infer it from components, navigation, or local UI. |
| A manual journey or documentation asks for provider send, receipt, signature, schedule, deployment, DNS, external reachability, or production proof. | State it as deferred. Do not manufacture evidence or broaden the sprint. |
| Final `npm run verify` fails. | Record the actual failed stage, correct only the verified cause with appropriate authority, rerun the final gate, and keep the sprint blocked until it passes. |

---

## 13. Completion handoff requirements

The implementation handoff must include:

1. exact changed paths, including navigation, layout, badge if changed, catalogs, tests, OpenAPI, changelog, and closeout record;
2. explicit confirmation that no migration was required or created and no generated type, Supabase state, provider, scheduler, endpoint behavior, deployment, DNS, or production system was changed;
3. the exact server-side operations-navigation derivation and Admin/PM Lead/denied-role matrix;
4. desktop/mobile locale-aware navigation evidence, including zero/overflow unread states, drawer close, Escape/focus return, and no denied-role operations leak;
5. localization/accessibility evidence, including catalog parity, localized link names, non-color status, 44px targets, 375px, keyboard, and both themes;
6. OpenAPI evidence showing the exact `suppressed` enum repair and preserved inactive 404 contract for all four operations;
7. exact focused-test, formatter, and final `npm run verify` commands with factual outcomes;
8. manual J-01 through J-10 results, with database-authoritative evidence clearly distinguished from local/mocked application evidence;
9. the completed closeout document and changelog paths; and
10. the explicit deferred activation list from §10.

The only correct completion statement is:

> **Sprint 06 now provides a role-safe, localized, accessible development notification capability: recipients can navigate to their own in-app inbox; Admin and active PM Lead users can navigate to the already-authorized terminal-suppression operations surface; the manual evaluator remains local-development-only; and provider-facing routes remain inert. External provider activation, dispatch, receipt processing, scheduling, deployment, and production verification remain deferred.**

---

*This specification closes integration and evidence gaps without converting reserved interfaces or disabled provider capability into provider operation. It deliberately treats authenticated navigation, application presentation, database enforcement, inactive endpoint behavior, OpenAPI vocabulary, and later activation as separate boundaries.*
