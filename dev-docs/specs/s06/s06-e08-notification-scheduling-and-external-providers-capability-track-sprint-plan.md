# Sprint 06 — E08 Notification, Scheduling, and External-Provider Capability Track

## 1. Sprint purpose

Sprint 06 delivers the **capability track** of Epic 08 under ADR-024. It makes notification behavior demonstrable in `jsf-pm-dev` without activating Resend, Meta WhatsApp, Upstash QStash/Workflow, Vercel, Cloudflare, Hostinger domain/email administration, or production Supabase.

**Sprint goal:** A stakeholder can cause an existing lifecycle event, observe a real authorized in-app notification in the recipient's inbox and unread badge, inspect the resulting eligible external-channel recipient records as terminal `suppressed` records through an authorized internal operational view, and—when enabled only for the development demonstration posture—run alert evaluation through the same internal command intended for future scheduling. No provider HTTP request, provider SDK dispatch, schedule creation, webhook receipt, fake provider success, or local scheduler occurs.

This is not a production-provider sprint. It implements the data, server, UI, authorization, localization, and test boundaries that make later activation bounded and safe. It does not claim live email, WhatsApp, scheduled workflow, webhook, delivery receipt, deployment, DNS, or production evidence.

---

## 2. Authority, starting baseline, and non-negotiable constraints

### 2.1 Authority order

1. Project Owner direction and ADR-024: `Deferred External Provider Activation and Epic 08 Capability Delivery`.
2. Repository-tracked Supabase migration source for final database shape, policy, functions, views, and grants.
3. Repository OpenAPI source (`contracts/openapi/jsf-pm-api.openapi.yaml`) for public/interface vocabulary when a revision is in scope.
4. Existing accepted lifecycle, RLS, immutable-history, and role-safe projection decisions.
5. This sprint plan for S06 sequencing, application scope, acceptance evidence, and explicit exclusions.

This plan does not authorize a provider operation or silently supersede ADR-024. If the repository baseline, accepted decision, current migration source, generated types, or API contract disagree, stop the affected work item and resolve the conflict at its governing source.

### 2.2 Confirmed baseline

- `jsf-pm-dev` is the persistent local-development and stakeholder-demonstration environment.
- The current branch is `feature/s06-e08-notification-scheduling-and-external-providers-capability-track` and was clean when this plan was created.
- Existing lifecycle commands already create immutable `notification_events` and in-app `notification_recipients` inside their transactional boundaries.
- The current notification data model has `notification_events`, `notification_recipients`, `whatsapp_templates`, the `notification_unread_counts_view`, `mark_notification_read(uuid)`, and `mark_all_notifications_read()`.
- `notification_recipients` is the sole approved initial Realtime publication. The current shell already reads the unread-count view and renders a localized `NotificationBadge`; it does not yet provide the complete inbox/history/read experience.
- The current `notification_delivery_status` enum is `pending`, `processing`, `sent`, `delivered`, `read`, `failed`, and `cancelled`. It lacks ADR-024’s terminal `suppressed` state.
- Existing preference/eligibility facts are not to be replaced: `project_members.receives_notifications`, `profiles.email_notifications_enabled`, `profiles.whatsapp_opt_in`, `profiles.whatsapp_consent_at`, `profiles.phone_e164`, active profile status, active project membership, and the existing WhatsApp-template relationship remain authoritative inputs.
- `src/components/ui/sonner.tsx` is already mounted at the application root. S06 may use its toast capability for authorized, localized development diagnostics; it must not use a toast as the durable notification system.

### 2.3 Platform rules carried forward

- Spanish (`es-MX`) is the default visible locale; English (`en-US`) is secondary. Protected Spanish paths are unprefixed; English equivalents are under `/en/`. Every new user-visible message, aria label, empty state, confirmation, error, status label, and diagnostic must have semantic-key parity in both catalogs.
- `profiles.role` remains the application-role authority. `admin` and `pm` are application roles; `pm_lead` and `pm_watcher` are project capacities. Authorization must derive from the authenticated server session and relevant project membership, never from browser input.
- App Router and Server Components remain the default. Use client components only for interaction leaves: mark-read controls, filter controls, dialogs, confirmation, manual alert evaluation, and toast presentation.
- Use typed `@supabase/ssr`, server-only modules, narrow projections, Zod at browser/server mutation boundaries, safe error mapping, and concrete path revalidation. No browser privilege, direct base-table mutation, optimistic fabricated state, broad `select("*")`, runtime Prisma, or runtime `DATABASE_URL` access.
- Notifications are online-only. No service worker, browser cache, persistent local queue, background sync, polling loop, retry replay, or local process scheduler is allowed.
- Existing lifecycle commands remain authoritative for lifecycle transition, recipient determination, locking, audit evidence, event creation, and idempotency. S06 must extend the authoritative data boundary rather than re-create notification logic in a Server Action or component.

---

## 3. Scope and explicit exclusions

### 3.1 In scope

1. A complete role-safe in-app notification experience: unread badge/count, notification inbox/history, pagination or bounded incremental loading, unread/read state, mark-one-read, mark-all-read, empty/loading/error/retry states, accessible interactions, and Spanish/English parity.
2. Transactional lifecycle-event fan-out into in-app and eligible external recipient rows without duplicate domain events or duplicate recipient/channel rows.
3. A terminal `suppressed` external-delivery state, safe finite suppression reason, no automatic historical replay, and authorized queue/recipient visibility.
4. Strict server-only provider configuration posture with explicit inactive/active mode, provider-specific validation, no browser-visible secrets, and fail-closed behavior for missing, placeholder, partial, malformed, or inactive configuration.
5. Authorized Admin/PM Lead development diagnostics that identify only channel, event category, and recipient count; diagnostics must never disclose recipient identity/contact data, raw variable names, secrets, provider payloads, or internal stack/error details.
6. An Admin/PM Lead-only manual **evaluate alerts now** operation available only in `jsf-pm-dev` when a dedicated server-side demonstration flag is enabled. It uses the same internal alert-evaluation command planned for future signed scheduling.
7. Provider-ready interfaces and inactive provider-facing routes that safely reject requests without any effect or simulated provider receipt.
8. Alert evaluation for the existing accepted reminder triggers and cadence semantics, executed manually only in S06. It creates ordinary event/fan-out records and terminal suppression where eligible external delivery is disabled.
9. Focused database, server, UI, localization, accessibility, RLS/role-isolation, and localhost demonstration evidence.
10. A Sprint 06 closeout record and accurate CHANGELOG update after implementation is complete.

### 3.2 Explicitly excluded

- Resend account, sender, domain, DNS, API-key, or live email activation.
- Meta business verification, WhatsApp phone/display-name/template approval, webhook registration, live message delivery, live receipt handling, or provider-console configuration.
- Upstash QStash schedule creation, Upstash Workflow execution, public endpoint configuration, external signed invocation, or durable workflow operation.
- Vercel deployment, Cloudflare DNS, Hostinger domain/mailbox work, production/preproduction Supabase provisioning, migrations, generated types, or hosted smoke tests.
- Local timer processes, cron substitutes, `setInterval` dispatch loops, browser timers used as a scheduler, worker daemons, and simulated provider webhooks/receipts.
- Automatic replay, migration, or requeue of historic `suppressed` records after configuration becomes active.
- New notification triggers or product lifecycle changes beyond the existing committed trigger vocabulary. The manual evaluator consumes the established reminder triggers; it does not invent new product events.
- Calendar, broad archive/search, reporting/metrics dashboards, user administration, backup/restore, legal/privacy work, provider activation runbooks, or general E9/E10 operations.
- Broad Realtime publication beyond the existing `notification_recipients` publication.

---

## 4. Required pre-sprint database preparation

### 4.1 Hard prerequisite

**No S06 application work item may begin until the reviewed S06 notification-capability migration has been created, applied to `jsf-pm-dev` through Supabase MCP, and its generated `src/lib/database.types.ts` output has been regenerated unchanged through Supabase MCP.**

This plan specifies the migration; it does not create or apply it. The applied migration source and generated types become the implementation baseline. If their resulting names/types differ from this specification, update the S06 implementation references before coding. Do not compensate with manual generated-type edits, direct DDL, a dashboard edit, generic SQL, or a client-only state model.

### 4.2 Required migration scope

The migration is deliberately narrow. It must reconcile ADR-024’s external-delivery suppression semantics with the existing notification model while preserving current event immutability, fan-out uniqueness, RLS, receipt/lease semantics for a later active-provider path, and the sole Realtime publication.

#### A. Delivery status and suppression facts

1. Add `suppressed` to `public.notification_delivery_status` as a terminal value. Do not rename or reorder existing values.
2. Add `notification_recipients.suppression_reason` as a nullable finite machine-readable value.
   - S06 supports exactly `provider_disabled`.
   - Do not use raw environment-variable names, provider error text, secret fragments, phone numbers, email addresses, stack traces, or free-form browser content as a reason.
   - Do not add speculative reasons for activated-provider failures; those belong to later activation work.
3. Add `notification_recipients.suppressed_at timestamptz` as a nullable state timestamp.
4. Add database constraints that enforce all of the following:
   - only `email` and `whatsapp` rows may become `suppressed`;
   - `suppressed` requires `suppression_reason = 'provider_disabled'` and non-null `suppressed_at`;
   - a non-suppressed row has null suppression facts;
   - a suppressed row has no claim token/claim timestamp, no provider message ID, no provider error payload, no sent/delivered/read/failed timestamp, and no pending retry timestamp;
   - a suppressed row has `attempt_count = 0` because no provider attempt occurred;
   - normal in-app read behavior remains unchanged.
5. Preserve the existing unique `(event_id, user_id, channel)` fan-out index. A suppression path is an update of an eligible external recipient record, not a second recipient row.
6. Add only indexes required by actual new queries—for example, a partial authorized-queue index for external `suppressed` rows ordered by `suppressed_at desc`. Do not create redundant indexes that overlap existing fan-out, pending, provider-message, unread, or user indexes.

#### B. Authoritative suppression transition

1. Create one narrowly scoped private or server-invoked database boundary that transitions an eligible, newly created external recipient row from its initial pending state to `suppressed` in the same transaction that creates the notification event/fan-out.
2. It must be idempotent under the existing event deduplication and fan-out uniqueness constraints. Repeated lifecycle-command invocation must neither duplicate the domain event nor increment attempts nor create another external recipient row.
3. It must be unavailable to ordinary browser clients. A browser cannot select the channel, status, reason, provider, recipient, event, or suppression timestamp.
4. It must not alter `private.claim_notification_batch` so that suppressed rows are candidates. The batch claim query must continue to select only pending/expired-processing external rows, never suppressed rows.
5. It must not modify `private.record_provider_receipt` to allow a receipt to advance a suppressed row. A later provider receipt for a suppressed record is non-authoritative and must have no state-changing effect.

#### C. Recipient eligibility and fan-out

The authoritative fan-out path must create an external recipient row **only** where the recipient is otherwise eligible for that channel:

| Channel | Required eligibility before an S06 suppressed row exists |
| --- | --- |
| `in_app` | Existing eligible application recipient rules; in-app delivery is not dependent on provider configuration. |
| `email` | Active eligible recipient, active applicable project membership/notification preference where the event is project-scoped, and `profiles.email_notifications_enabled = true`. |
| `whatsapp` | All relevant project/application preference rules plus `profiles.whatsapp_opt_in = true`, non-null consent fact, a valid non-null `phone_e164`, and an applicable active approved template under the existing model. |

Rules:

- Do not create external rows for an opted-out, consent-missing, inactive, non-member, template-ineligible, or otherwise ineligible user merely to make a demo queue look populated.
- Deduplicate a user who holds multiple relevant capacities before recipient/channel insertion.
- Preserve existing direct-assignee and PM Lead/Watcher recipient semantics. S06 must map every current trigger producer before changing it; it may not widen recipients because the channel is suppressed.
- The event payload remains purpose-limited. It is not a vehicle for secret/configuration diagnostics or contact details.

#### D. Safe recipient read surfaces and commands

1. Preserve self-only in-app notification reads for ordinary users. A recipient can read their own in-app inbox/history and mark only their own in-app row(s) read.
2. Add a narrow self-only `security_invoker` notification feed view or equally narrow role-safe projection for in-app history. It must expose only fields needed for the recipient UI: recipient ID, event/trigger category, title/body or safe display payload fields, route key/target context when already authorized, created timestamp, read timestamp, and in-app delivery status.
3. Do not expose external recipient rows, external channel state, suppression reason, provider fields, full payloads, audit records, another user’s notifications, or queue diagnostics through the ordinary recipient feed.
4. Add a narrow internal operational queue projection for Admin/PM Lead only. It may expose event category, channel, terminal status, controlled suppression reason, recipient count or an authorized safe recipient representation, project-safe context, created/suppressed timestamps, and no secrets/provider payloads/contact details unless the existing internal role-safe standard expressly permits those fields.
5. Add or revise constrained read/mark commands only where the existing `mark_notification_read` / `mark_all_notifications_read` functions cannot represent the required read behavior. Preserve their self-only ownership check and make mark-read idempotent.
6. Keep `notification_unread_counts_view` correct for unread `in_app` rows only. External suppression never contributes to an unread badge.

#### E. Alert evaluator command boundary

1. Create one private/internal authoritative alert-evaluation command suitable for future signed scheduling and the S06 manual demonstration path.
2. It must evaluate only accepted existing reminder triggers: `deadline_24h`, `deadline_12h`, `deadline_6h`, `deadline_overdue`, and `review_inactivity_reminder`.
3. Preserve current trigger distinctions, including the client-submission exclusion from production-review inactivity reminders. Do not treat a `client_submission` as a production review state machine.
4. Build deterministic deduplication keys from the reminder type, target entity/cycle, and accepted reminder window. Re-running manual evaluation must not create duplicate events/recipients for the same eligible reminder window.
5. The evaluator must use database time and authoritative persisted lifecycle/deadline/review state; it must not rely on browser time, a hard-coded demo date, or mutable client state.
6. It returns only a safe summary suitable for an authorized internal caller: evaluated count, created event count, in-app recipient count, and external suppression count. It must not return contact values, raw recipient lists, secrets, or provider configuration detail.

### 4.3 Required pre-sprint evidence

Before S06-01 begins, record factual evidence that:

- the migration applied to `jsf-pm-dev` exactly once through the approved path;
- generated types were produced from the applied database and written unchanged;
- a lifecycle event creates exactly one event plus intended in-app and eligible external recipient rows;
- an ineligible external channel produces no row;
- eligible disabled external rows are terminal `suppressed/provider_disabled` with zero attempts and no provider metadata;
- `private.claim_notification_batch` does not claim suppressed rows;
- self-only feed/mark-read access, Admin/PM Lead operational queue access, and denial of all other roles are proven;
- evaluator deduplication, reminder eligibility, and client-submission exclusion are proven; and
- Realtime publication remains limited to `notification_recipients`.

---

## 5. Capability design contract

### 5.1 Delivery-mode contract

Use one server-only configuration model with a closed set of modes:

```text
external_delivery_mode = disabled | active
```

S06 treats every condition other than explicit `active` plus complete provider-specific validation as disabled. In the current sprint, the expected environment behavior is disabled.

- Configuration parsing lives in a server-only module.
- It returns a typed capability state, never raw environment values.
- It validates non-placeholder values; a string that is present but syntactically placeholder-like is disabled.
- No client component imports the module or reads provider values.
- The user-visible result is an authorized localization code, not a missing-variable message.
- Disabled mode causes no network request, SDK call, schedule creation, external side effect, or fake success.

### 5.2 Provider-ready interface boundary

Define narrow channel interfaces for email and WhatsApp with an explicit dispatch result union. The inactive S06 implementation returns only a typed no-dispatch/suppression outcome. It must not instantiate or call Resend, Meta, QStash, or Workflow in disabled mode.

Future activation may add concrete active dispatch implementations behind the same server-only interface. It must not change event creation, recipient eligibility, in-app notification delivery, suppression history, or manual evaluator semantics without an accepted activation ADR/runbook.

### 5.3 Diagnostics contract

An authorized Admin or PM Lead who initiated or inspects an eligible suppressed delivery may receive a localized toast/inline status containing:

- the channel (`email` or `whatsapp`);
- a human-safe event category; and
- a recipient count.

It must not reveal names, addresses, phone numbers, IDs, raw event payloads, configuration names, secret states, provider errors, or which individual opted in/out. It must not render for Operator or Client users, even if they are the lifecycle actor or intended recipient.

### 5.4 Manual alert-evaluation contract

The manual control is intentionally narrow:

- available only to an authenticated Admin or PM user who is an active `pm_lead` for the selected project when evaluation is project-scoped; Admin retains authorized global internal operations only if the final migration/function specification grants it explicitly;
- available only when server-only demo flag is true **and** environment posture is `jsf-pm-dev`/local demonstration;
- has an explicit confirmation describing that it evaluates current authoritative reminders and creates ordinary in-app/suppressed records, not a real email/WhatsApp send;
- uses the same internal evaluator as future signed scheduling;
- is idempotent for the same evaluation window;
- reports a safe aggregate result and refreshes only affected internal notification/inbox views;
- is absent, not merely disabled, in every non-development environment.

---

## 6. Work items and delivery sequence

### S06-01 — Reconcile the applied notification baseline and publish the implementation mapping

**Objective:** Establish one exact repository-local map from existing lifecycle command producers through notification event/fan-out rows, safe reads, roles, routes, and S06 migration additions before application implementation begins.

**Scope**

1. Inspect the applied S06 migration, generated types, committed notification-producing functions, current notification enums, RLS policies, grants, indexes, Realtime publication, unread-count view, shell-data query, navigation badge, and message catalogs.
2. Create `dev-docs/specs/s06/s06-e08-notification-capability-contract-mapping-reference.md` as the implementation reference. It must map each trigger producer, recipient derivation, allowed channel(s), eligibility rule, generated event payload contract, safe recipient feed representation, internal queue representation, route target, action, refresh behavior, and test ownership.
3. Confirm every current lifecycle function that emits a notification event uses the applied common fan-out boundary or an equivalent reviewed transactional path. Do not add external recipient logic to a component or Server Action.
4. Confirm all exact migration/function/view names from the applied baseline. Do not preserve provisional prose names when actual source differs.
5. List all concrete S06 routes, server actions, query modules, client components, tests, catalog namespaces, and closeout artifacts before implementation starts.

**Completion conditions**

- No S06 work item depends on guessed table fields, RPC names, enum values, view columns, role rules, or route names.
- Every event producer has a documented in-app and external eligibility outcome.
- The mapping distinguishes recipient-owned feed access from internal queue access.
- The mapping records the accepted `suppressed/provider_disabled` terminal behavior and no-auto-replay rule.

### S06-02 — Implement server-only configuration and provider-ready disabled adapters

**Objective:** Make the application unable to dispatch externally unless future activation supplies explicit active mode and valid provider configuration.

**Expected modules**

- Create: `src/lib/notifications/config.ts`
- Create: `src/lib/notifications/types.ts`
- Create: `src/lib/notifications/channel-adapters.ts`
- Create: `src/lib/notifications/errors.ts`
- Test: `src/lib/notifications/__tests__/config.test.ts`
- Test: `src/lib/notifications/__tests__/channel-adapters.test.ts`
- Modify only if necessary: `.env.example` for variable **names and safe disabled examples only**; never real values.

**Scope**

1. Add a server-only typed parser for explicit delivery mode, demo flag, and provider configuration presence/format validation.
2. Return only typed states such as disabled/active-ready/invalid; never export values or raw validation reasons to client/shared code.
3. Recognize missing, blank, placeholder, partial, malformed, and inactive configuration as disabled. The implementation must make no provider SDK construction or external request in those cases.
4. Define email/WhatsApp adapter interfaces whose disabled implementations return safe no-dispatch outcomes. Do not implement a fake send, fake message ID, fake provider receipt, or test-only success adapter.
5. Supply a small mapping from typed result codes to localization-safe diagnostic codes. Keep actual display copy in message catalogs, not server module prose.
6. Add negative tests for accidental activation, placeholder parsing, client import boundary, SDK/network non-invocation, and non-leaking errors.

**Completion conditions**

- Disabled mode is the deterministic default.
- A present placeholder cannot enable dispatch.
- No browser bundle can receive provider configuration or diagnostic internals.
- Tests prove that disabled adapter invocation produces no network/SDK action.

### S06-03 — Implement notification queries, recipient inbox/history, and read state

**Objective:** Deliver an authorized, accessible in-app notification experience that consumes the applied safe projection rather than base tables.

**Expected modules and routes**

- Create: `src/lib/notifications/queries.ts`
- Create: `src/lib/notifications/actions.ts`
- Create: `src/lib/notifications/schemas.ts`
- Create: `src/app/[locale]/(protected)/notificaciones/page.tsx`
- Create: `src/app/[locale]/(protected)/notificaciones/loading.tsx`
- Create: `src/app/[locale]/(protected)/notificaciones/error.tsx`
- Create route-local `_components/notification-list.tsx`, `notification-list-item.tsx`, `notification-empty-state.tsx`, and a small client `notification-read-actions.tsx` as needed.
- Modify: `src/components/shared/app-nav/app-nav.tsx`, `src/components/shared/app-nav/_components/mobile-nav-toggle.tsx`, and the badge/counter integration only as required to make the route real and refresh correctly.
- Test: focused notification query/action/component/route tests under the repository’s established Vitest structure.

**Scope**

1. Use an authenticated server read of the applied self-only notification feed. Never query `notification_recipients` broadly and filter in the client.
2. Build `/notificaciones` and locale equivalent through the existing locale layout. The route contains only the authenticated user’s in-app notification representation.
3. Present newest-first bounded history with an explicit safe pagination/load-more contract. Do not load unbounded history into the browser.
4. Each item provides localized category, safe title/body/context, created-time presentation, unread/read state, and optional navigation only when its route target is already authorized by the destination route. Do not create unsafe open redirects or disclose a raw target identifier.
5. Mark-one-read and mark-all-read actions use the constrained self-owned database command. They are idempotent, pending-safe, and refresh route + navigation count after authoritative success.
6. Preserve unread badge accessibility: announce count changes, use localized label/overflow behavior, and never rely on color alone.
7. Implement loading, empty, connection/error, and retry states with safe localized content. No raw Supabase/RLS messages, IDs, event payloads, or stack traces.
8. Do not make external `suppressed` records visible in this ordinary inbox.

**Completion conditions**

- A user sees only their own in-app history and can never mark another user’s row read through a forged ID.
- Badge count and inbox read state agree after server refresh.
- Inbox remains usable with keyboard, screen reader, 375px width, Spanish/English, and both themes.
- No notification read path leaks operational/provider data.

### S06-04 — Implement authorized internal notification queue and suppressed-delivery diagnostics

**Objective:** Give Admin/PM Lead users operational visibility into safe terminal suppression without exposing configuration or recipient-sensitive information to ordinary users.

**Expected modules and routes**

- Create: `src/lib/notifications/operations-queries.ts`
- Create: `src/lib/notifications/operations-actions.ts`
- Create: `src/app/[locale]/(protected)/pm/notificaciones/page.tsx`
- Create: route-local `_components/notification-operations-queue.tsx`, `suppressed-delivery-status.tsx`, and `manual-alert-evaluation-dialog.tsx`.
- If the app’s Admin route convention requires a separate entry, create a thin Admin route that consumes the same safe internal module; do not duplicate query/authorization code.
- Test: role authorization, projection, diagnostic, queue-filter, and action tests.

**Scope**

1. Authorize the route and queries at the server boundary. Admin and active PM Lead access must be distinguished from PM Watcher, Operator, and Client denial. Do not infer PM Lead from route appearance.
2. Render a bounded internal queue/history with controlled external state: event category, channel, status, controlled reason, aggregate recipient count where appropriate, project-safe context, and timestamps.
3. Show `suppressed` as terminal. The UI must explicitly state that it was not sent in the current environment and will not auto-send later.
4. Never display raw config status, environment variable names, contact values, raw payloads, provider errors, secret state, or simulated provider success.
5. Add server-issued, localized diagnostics only after an authorized action produces an eligible suppressed-delivery result. The message includes channel, event category, and count only.
6. Keep the queue separate from the ordinary recipient inbox. An ordinary user receives their in-app notification but never operational explanation.
7. Support safe filter states only if the applied projection supports them: channel, status, event category, and bounded date range. Do not introduce broad analytics, export, or arbitrary search.

**Completion conditions**

- Admin/PM Lead can inspect safe suppression evidence; all unauthorized roles are denied without leaking queue existence/data.
- The queue accurately distinguishes in-app state from terminal external suppression.
- A suppressed record cannot be requeued, edited, or presented as a retry/send control.
- English/Spanish diagnostic behavior is semantically equivalent.

### S06-05 — Implement shared alert evaluation and the development-only manual control

**Objective:** Demonstrate reminder evaluation through the future shared scheduling command without adding a scheduler or external dispatch.

**Expected modules**

- Create: `src/lib/notifications/alert-evaluator.ts`
- Create or modify narrow server-only action module used by S06-04.
- Create route-local manual evaluation control under the internal queue.
- Test: evaluator eligibility, deduplication, authorization, disabled-demo-flag, and safe-summary tests.

**Scope**

1. Consume the applied authoritative evaluator boundary. Application code orchestrates authorization, safe request validation, result mapping, and route refresh; it does not reimplement deadline/review semantics in TypeScript.
2. Make the manual action available only under all three conditions: authenticated authorized internal user, dedicated server-only demo flag enabled, and local `jsf-pm-dev` demonstration posture.
3. Require a deliberate confirmation. The dialog must explain that it evaluates reminders and creates normal in-app/terminal suppression records; it does not send WhatsApp or email.
4. Call the shared evaluator once per user action. Disable duplicate submission while pending; after result, show only safe aggregate counts.
5. Re-run must remain idempotent for the same schedule window. A new window may create a new accepted reminder event only if the database evaluator decides it is due.
6. Exercise each supported trigger category using the mutable sandbox/reference-safe scenario boundaries. Preserve the client-submission exclusion from review-inactivity reminders.
7. Do not expose a browser-controlled evaluation time, project/member/recipient override, channel override, or arbitrary trigger selection.

**Completion conditions**

- Manual evaluation is impossible outside the explicit demo posture and never uses timers/polling.
- It shares the same internal evaluator intended for later signed scheduling.
- Duplicate invocation does not produce duplicate event/fan-out rows for one reminder window.
- Result UI is truthful, localized, accessible, and free of recipient/provider secret detail.

### S06-06 — Implement inactive provider-facing routes and activation-safe boundaries

**Objective:** Establish safe endpoint behavior and module boundaries now, without pretending that live provider integration exists.

**Expected modules**

- Create only the exact routes confirmed by the repository API contract and applied S06 mapping—for example, future workflow/webhook route shells under `src/app/api/`.
- Create: `src/lib/notifications/provider-endpoint-guards.ts` if a shared guard is warranted.
- Test: inactive endpoint rejection, no-mutation, no-information-leak, and signature-order tests.

**Scope**

1. Implement only endpoint paths that the current repository contract already reserves or that S06-01 reconciles as required. Do not invent public HTTP API surface.
2. When a provider is inactive, endpoint requests fail safely without creating events/recipients, recording a receipt, invoking an adapter, or explaining whether a provider is configured.
3. When later active behavior is introduced, signature verification must precede side effects. S06 may establish the guard/interface shape but cannot claim that an unconfigured provider signature flow is tested against the provider.
4. Return a generic safe rejection consistent with the established API error policy; avoid provider enumeration and detailed configuration responses.
5. Do not use locally simulated webhooks, generated fake provider message IDs, or receipt fixtures that imply delivery succeeded.

**Completion conditions**

- Inactive routes are inert and non-enumerating.
- No request to an inactive route changes notification, audit, or provider state.
- Endpoint structure does not block later configured signature verification and activation evidence.

### S06-07 — Integrate navigation, localization, accessibility, focused evidence, and closeout

**Objective:** Close E08 capability as a coherent, demonstrable application slice without overstating activation completion.

**Scope**

1. Add authenticated navigation to the real notification inbox. Preserve role-safe navigation, desktop/mobile parity, language switcher, theme control, sign-out, and existing unread badge behavior.
2. Add internal operational queue navigation only for authorized Admin/PM Lead users and only after its route exists. Do not show unavailable operational navigation to Client or Operator users.
3. Add `notifications` and `notificationOperations` catalog namespaces, with exact Spanish/English key parity for inbox, status, channel, controlled reason, unread/read actions, queue, manual evaluator confirmation/result, inactive-environment explanation, and all aria labels.
4. Ensure all primary actions have localized labels, descriptive status text, focus management, pending/disabled state, non-color state indicators, Escape behavior for dialogs, and 44×44px touch targets where applicable.
5. Add route-level loading/error/not-found treatment and safe retry behavior. A retry is a new online request, never a persistent replay queue.
6. Write `dev-docs/specs/s06/s06-sprint-06-closeout-verification.md` with exact changed artifacts, applied migration/type provenance, actual test results, manual evidence, localization/accessibility evidence, known limitations, and deferred activation work.
7. Update `CHANGELOG.md` only with implemented capability-track user-visible behavior. Never state that email, WhatsApp, QStash, hosted deployment, DNS, or provider receipt functionality is live.

**Completion conditions**

- No dead notification navigation remains.
- Ordinary users see only their inbox; Admin/PM Lead internal operations remain role-safe.
- Both locales/themes and narrow/mobile interaction support the same authorized behavior.
- Closeout evidence distinguishes development capability from future provider activation.

---

## 7. Required focused verification strategy

Use the repository’s Vitest, React Testing Library, MSW, and existing testing conventions. Do not add Playwright. Database/RLS/constraint evidence proves authoritative enforcement; component tests prove presentation and action wiring, not database authorization by themselves.

### 7.1 Database and integration evidence

| Area | Required proof |
| --- | --- |
| Status model | `suppressed` is accepted only for external channels and requires `provider_disabled` plus `suppressed_at`; invalid combinations are rejected. |
| No-send terminality | Suppressed rows have zero attempts/no provider metadata/no claim state/no retry timestamp; later configuration change does not alter existing rows. |
| Fan-out | One lifecycle action produces at most one immutable event and one recipient row per eligible user/channel; duplicate capacity does not duplicate fan-out. |
| Eligibility | Opted-out, no-consent, missing-phone, inactive, non-member, email-disabled, or template-ineligible external recipients produce no external row. In-app behavior remains independently correct. |
| Suppression | Eligible disabled email/WhatsApp recipient rows become terminal suppression records with safe reason; no provider call is possible. |
| Lease/receipt safety | Claim query excludes `suppressed`; receipt function cannot advance it. Existing pending/processing receipt behavior remains unaffected. |
| Recipient feed RLS | A user sees/marks only their own in-app row. Forged recipient IDs cannot mark another user’s record. External queue/status is absent from ordinary feed. |
| Internal queue RLS | Authorized Admin/PM Lead access succeeds only within accepted scope; PM Watcher, Operator, and Client are denied. |
| Alert evaluator | Reminder triggers use authoritative database state/time; same window is deduplicated; next legitimate window can be evaluated; client-submission does not enter review-inactivity reminder path. |
| Realtime | `notification_recipients` remains the sole publication scope; no unrelated table is added. |

### 7.2 Server and adapter tests

1. Missing, blank, placeholder, partial, malformed, and inactive configuration all resolve disabled.
2. Explicit active mode without complete valid provider configuration fails closed.
3. Disabled email/WhatsApp adapters do not construct a provider client, make a fetch, call a provider SDK, create a schedule, or yield a fake message ID.
4. Configuration/result mapping exposes only safe typed codes to presentation code.
5. Manual evaluation action rejects unauthenticated, Client, Operator, PM Watcher, non-demo, and non-development calls before evaluator invocation.
6. Active Admin/PM Lead demo invocation calls the shared evaluator exactly once, returns safe aggregate counts, and revalidates concrete affected paths.
7. Inactive provider-facing routes return safe rejection and write no rows.

### 7.3 UI and accessibility tests

1. Inbox renders only self-safe test data; newest-first order, unread indicator, empty/error/retry, pagination, mark-one, and mark-all all refresh truthfully.
2. Badge count changes after authoritative read actions and preserves accessible label/overflow handling.
3. Ordinary inbox never renders external channel, suppression reason, provider detail, or operational controls.
4. Internal queue renders controlled suppressed state/reason only for authorized role fixtures.
5. Suppressed diagnostic contains only localized channel/event/count; assert it contains no name, address, phone, raw configuration, or provider error content.
6. Manual evaluator dialog has title/description, confirm/cancel, Escape/focus restoration, pending state, localized result, and no send claim.
7. Catalog parity test covers every new S06 key in `messages/es-MX.json` and `messages/en-US.json`.
8. Keyboard and screen-reader tests cover inbox actions, queue filters, evaluator dialog, badges/status, and route navigation.

### 7.4 Manual localhost demonstration journeys

Run only against the approved mutable sandbox after focused automation is green.

1. **Recipient inbox:** trigger a known sandbox lifecycle event for User A. Sign in as User A, open `/notificaciones`, confirm exactly the authorized in-app item and unread badge; mark one read, refresh, then mark all remaining rows read.
2. **Recipient isolation:** sign in as User B and attempt User A notification route/action identifiers. Confirm User B cannot list or mutate User A’s notifications.
3. **Suppressed external behavior:** use an event with an eligible email and/or WhatsApp recipient while delivery mode is disabled. As Admin/PM Lead, confirm the safe internal queue shows terminal suppression with controlled reason and no send/retry action. Confirm the ordinary recipient sees only in-app behavior.
4. **Ineligibility:** use sandbox data for opted-out/no-consent/email-disabled eligibility cases. Confirm no external recipient row appears while correct in-app behavior is preserved.
5. **Diagnostic privacy:** trigger an eligible suppression as authorized internal user. Confirm Spanish and English diagnostics contain only channel, event category, and count—no recipient/provider/configuration details.
6. **Manual reminders:** enable the dedicated local demo flag, run **evaluate alerts now** for an eligible sandbox scenario, verify safe result aggregates and resulting in-app/suppressed records. Run again within the same window and confirm no duplicate event/fan-out.
7. **Manual-control denial:** disable the flag and confirm the control is absent; repeat as PM Watcher, Operator, and Client, confirming no route/control/action access.
8. **Inactive endpoint:** request each implemented provider-facing endpoint while inactive. Confirm safe rejection and no database-side notification/receipt effect.
9. **Mobile/accessibility/localization:** repeat inbox mark-read and authorized manual evaluation at 375px width, keyboard-only, Spanish/English, and light/dark themes.

---

## 8. Sprint Definition of Done

Sprint 06 capability track is complete only when all conditions below are met.

1. The reviewed S06 migration is applied to `jsf-pm-dev`; generated types are regenerated unchanged; source/applied/type provenance is recorded.
2. Existing lifecycle commands create one canonical event and deterministic eligible recipient/channel fan-out without duplicate domain events.
3. In-app notification inbox/history, unread badge/count, read-one/read-all behavior, safe navigation, loading/error/empty/retry states, and accessible localized UX work under real authentication.
4. Eligible disabled external channels create terminal `suppressed` recipient records with the sole S06 safe reason `provider_disabled`; ineligible channels create no external row.
5. Suppressed records have no provider attempt, message ID, receipt, claim, retry, auto-send, auto-requeue, or automatic activation behavior.
6. Only Admin/PM Lead users can inspect the safe operational suppression queue and receive its localized diagnostics. Client, Operator, PM Watcher, and ordinary inbox consumers cannot observe provider/queue information.
7. Configuration is server-only and fail-closed; placeholders/partial values cannot produce a provider SDK call, HTTP request, schedule, or external side effect.
8. The manual evaluator is available only with authorized role, dedicated demo flag, and development posture; it invokes the future shared evaluator boundary, has no timer/cron substitute, and is deduplicated.
9. Provider-facing inactive routes are safe, inert, non-enumerating, and free of simulated provider receipts/success.
10. Existing notification lease, receipt, RLS, Realtime, event immutability, fan-out uniqueness, preference/consent, and workflow boundaries are preserved.
11. All new user-facing content has exact Spanish/English semantic-key parity and works in both themes, at narrow width, by keyboard, and with meaningful screen-reader labels/status.
12. Focused automated checks, required database/RLS evidence, and manual localhost journeys have factual recorded outcomes.
13. Sprint closeout and CHANGELOG distinguish completed capability from deferred Resend/Meta/Upstash/Vercel/Cloudflare/Hostinger/production-Supabase activation.

---

## 9. Stop conditions and decision boundaries

| Discovery | Required response |
| --- | --- |
| Applied migration/generated types/API contract conflict with ADR-024 or this plan | Stop the affected item; record exact source conflict; obtain governing decision. |
| Existing lifecycle producers cannot share a transactional fan-out path without broad redesign | Stop; specify the proven minimal database boundary. Do not replicate fan-out in app code. |
| A required external recipient eligibility fact/template is absent or cannot be safely projected | Do not fabricate a row or treat the user eligible. Record the exact gap. |
| A desired diagnostic needs recipient/contact/configuration/provider detail | Reject it. ADR-024 permits channel, event category, and recipient count only. |
| A provider SDK/network call can occur in disabled/placeholder mode | Block integration as an R0/R1 safety defect until fail-closed behavior is proven. |
| A route/action exposes another user’s inbox, an external queue to an ordinary user, or internal queue data to PM Watcher/Operator/Client | Block integration and correct database/RLS/query/action boundary. |
| Manual evaluation requires a timer, polling loop, local daemon, browser schedule, or client-selected timestamp/recipient | Stop. S06 permits only deliberate authorized invocation of the shared evaluator. |
| A feature needs real sender/domain verification, Meta approval, QStash schedule, public callback endpoint, hosted deployment, DNS/email administration, or production Supabase | Defer to the later activation ADR/runbook. Do not create a partial live path. |
| A proposal auto-delivers historical suppressed records once credentials exist | Reject. Terminal suppression is non-replayable without a later explicit decision. |
| A test/manual journey claims live delivery, receipt, provider success, deployed environment, or external reachability | Correct the evidence language. S06 proves development capability only. |

---

## 10. Follow-on activation boundary

After S06, a separate Project Owner-authorized activation ADR/runbook must govern actual external-service activation. It must define target environment, secret provenance, sender/domain/provider prerequisites, template/phone/business verification, schedule/workflow/webhook configuration, signature verification, test recipients, rollback/disable path, monitoring/receipt evidence, and deployed/database provenance.

S06 deliberately leaves the following as deferred activation work:

- Resend sender/domain and real email dispatch;
- Meta WhatsApp business/template/phone/webhook setup and delivery receipts;
- Upstash QStash schedules and Workflow operation;
- Vercel/Cloudflare/Hostinger deployment and domain/email administration; and
- production Supabase provisioning/migrations/types/connectivity.

---

## 11. Planning authority statement

This plan decomposes ADR-024’s accepted Epic 08 capability track. It specifies the required S06 suppression/alert-evaluation migration before application work begins and does not authorize provider activation or unrelated database redesign. The plan is implementation-ready only after its specified migration has been applied to `jsf-pm-dev` and generated types have been reconciled into the exact S06 baseline.
