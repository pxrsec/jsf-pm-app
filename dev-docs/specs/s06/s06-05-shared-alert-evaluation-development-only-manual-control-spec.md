---
title: S06-05 Shared Alert Evaluation and Development-Only Manual Control Specification
status: implementation-ready
version: 1.0
sprint_id: S06
epic_id: E08
work_item_id: S06-05
feature_slug: s06-05-shared-alert-evaluation-development-only-manual-control
project: Joya Star Films Project Management App
branch: feature/s06-e08-notification-scheduling-and-external-providers-capability-track
risk: high
implementation_scope: application-only; no migration; no provider operation; no scheduler
created: 2026-08-22
updated: 2026-08-22
author_profile: engineering-manager
authority:
  - Project Owner direction
  - ADR-024 Deferred External Provider Activation and Epic 08 Capability Delivery
  - dev-docs/specs/s06/s06-e08-notification-scheduling-and-external-providers-capability-track-sprint-plan.md
  - dev-docs/specs/s06/s06-e08-notification-capability-contract-mapping-reference.md
  - supabase/migrations/20260822150000_s06_e08_alert_evaluation.sql
  - src/lib/database.types.ts
  - AGENTS.md
prerequisites:
  - S06-01 through S06-04 are complete
  - 20260822150000_s06_e08_alert_evaluation.sql is applied to jsf-pm-dev
  - src/lib/database.types.ts is the unchanged post-application generated artifact
  - S06-02 server-only demo-flag parser is available
  - S06-04 internal operations routes and queue are available
successor_work_items:
  - S06-06
  - S06-07
---

# S06-05 — Implement Shared Alert Evaluation and the Development-Only Manual Control

## 1. Objective

Deliver one deliberate, localized, accessible **Evaluate alerts now** control in the authorized internal notification-operations surface. The control demonstrates the already-applied, database-authoritative reminder evaluator through the exact public RPC that a future signed scheduler will use to reach the same private evaluator.

This is a development demonstration control. It may create ordinary immutable notification events, ordinary `in_app` recipient rows, and—only for independently eligible external recipients—the existing terminal `suppressed/provider_disabled` rows created by the applied fan-out trigger. It does **not** send email or WhatsApp, call an adapter, construct a provider client, create a schedule, create a timer, poll, invoke a webhook, fabricate a provider receipt, or change the terminality/no-replay rule.

The control is present only when **all** of the following are true:

1. the request has an active authenticated session;
2. the session is an authorized internal operator under the applied evaluator contract:
   - active application-role `admin`, for one global evaluation; or
   - active application-role `pm` with an active `pm_lead` membership, for one project selected from server-authorized PM Lead projects;
3. `NOTIFICATION_DEMO_ALERT_EVALUATION_ENABLED` parses as exact server-only `true` through S06-02’s existing parser; and
4. the server is in the narrowly defined local `jsf-pm-dev` demonstration posture in §6.

The server action repeats every gate. Rendering a button is never authorization.

---

## 2. Database and migration determination

### 2.1 No new migration is authorized or required

**S06-05 requires no additional migration. Do not create a migration file.**

The implementation consumes the already-applied database boundary authored in:

```text
supabase/migrations/20260822150000_s06_e08_alert_evaluation.sql
```

The mapping reference confirms that this migration is applied to `jsf-pm-dev` and that its unchanged generated type exposes:

```ts
evaluate_notification_alerts(p_project_id?: string): Json
```

The migration already provides:

- `private.evaluate_notification_alerts(p_project_id uuid default null)`, the sole database-authoritative evaluator;
- `public.evaluate_notification_alerts(p_project_id uuid default null)`, the authenticated entry boundary;
- database-time evaluation of deadline reminders and production-review inactivity reminders;
- deterministic immutable event deduplication;
- authoritative in-app recipient insertion and the existing disabled external fan-out trigger;
- Admin global/project authorization and PM Lead explicit-project authorization; and
- a safe aggregate JSON result shape.

No application inconvenience authorizes a second RPC, an overload, a changed function signature, direct SQL, base-table mutation, a generated-types edit, a dashboard edit, or a new schema source. If the committed generated function signature or returned behavior differs from this document, stop the implementation and reconcile the governing migration/type baseline before changing application code.

### 2.2 Applied evaluator semantics that application code must preserve

The application calls the public RPC once and treats it as the only evaluator. It must not replicate, supplement, or pre-decide any of the following in TypeScript:

| Database-owned concern | Required application treatment |
| --- | --- |
| Current time | Do not accept, calculate, serialize, or display a client-selected evaluation time. The evaluator uses database `now()`. |
| Deadline windows | Do not derive 24h/12h/6h/overdue eligibility in UI or server action code. The database defines disjoint windows. |
| Reminder deduplication | Do not implement client/server deduplication. The database event deduplication keys are authoritative. |
| Task eligibility | Do not browse/select task IDs, assignees, deadlines, lifecycle state, or recipients in the UI. |
| Review-inactivity semantics | Do not expose stage, elapsed duration, reminder number, or a trigger picker. The database evaluates only persisted production workflow facts. |
| Client submissions | Never add them to review-inactivity handling. The evaluator excludes `workflow_type = 'client_submission'`. |
| Fifth-reminder/stall behavior | Do not simulate or display it as a separate command. The database enforces the cap and stall transition. |
| Recipient selection | Do not accept recipient, channel, membership, opt-in, consent, template, or preference input. The evaluator/fan-out boundary owns it. |
| External delivery | Do not invoke S06-02 adapters or configuration capability. Existing database fan-out may create terminal suppression only. |

---

## 3. Scope and explicit exclusions

### 3.1 In scope

1. A server-only evaluator wrapper that calls only `public.evaluate_notification_alerts` through the cookie-authenticated Supabase client and validates/narrows the returned JSON to a safe aggregate DTO.
2. A narrow Server Action that validates only the evaluation scope required by the caller’s role; rechecks session, demo flag, local posture, and authorization; invokes the wrapper once; maps failures to closed codes; and revalidates concrete affected notification paths.
3. A server-only PM Lead project-scope query used solely to populate an authorized bounded project selector for the PM route.
4. A client confirmation control rendered under the existing S06-04 operations queue screen only in the authorized local demo posture.
5. A confirmation dialog that accurately states the operation evaluates current reminders and may create ordinary in-app notification records and terminal suppression records, while explicitly stating that it does not send email or WhatsApp.
6. Safe aggregate result feedback and refresh of the internal operations queue plus affected notification-shell/inbox paths.
7. Additive `notificationOperations.manualEvaluation` catalog keys with exact Spanish/English structural parity.
8. Focused evaluator-wrapper, Server Action, component, authorization, flag/posture, safe-result, localization, and route-composition tests.

### 3.2 Explicit exclusions

The following are prohibited:

- Any new migration, DDL, RLS/policy/grant change, function change, generated-type edit, Supabase MCP operation, direct SQL, or base-table notification mutation.
- Any external email/WhatsApp send, Resend/Meta/QStash/Workflow import or call, `fetch`, provider SDK/client construction, provider payload, fake provider ID, fake receipt, webhook, endpoint, schedule, workflow, timer, polling loop, background process, cron substitute, or client-side interval.
- A browser-controlled evaluation timestamp, task/deliverable/recipient/channel override, trigger selector, review-stage selector, provider selector, payload input, retry/requeue control, or external-delivery command.
- A manual control in a production, preview, deployed, non-local, or unknown environment; a hidden-but-callable action is not acceptable.
- A resend/replay of existing `suppressed` records, mutation of suppression records, direct queue manipulation, or statement that a terminal record will send after later configuration.
- Any ordinary recipient-inbox change, navigation work, provider endpoint work, broad operations filters/search/export, or S06-07 closeout work.
- Disclosure of project IDs, task/deliverable IDs, event IDs, recipient identity/contact information, template/provider/configuration information, raw payloads, raw RPC/database errors, stack traces, internal authorization detail, or environment-variable values.

---

## 4. Authority and reconciliation rules

Apply this order to every implementation decision:

1. Direct Project Owner direction and accepted ADR-024.
2. The applied migration source and generated type artifact named in §2.
3. The Sprint 06 plan and S06-01 mapping reference.
4. This specification.
5. `AGENTS.md`, installed local Next.js documentation, package scripts, and nearby repository conventions.

### 4.1 Reconciliation: S06-04 intentionally owns no evaluator UI

S06-04 correctly omitted the manual-evaluation dialog and action. Its screen currently renders only heading, description, and the read-only queue. S06-05 owns the dialog, action, server wrapper, demo gating, result feedback, and the resulting refresh behavior. Do not add a second evaluator action/control to either role page or to the queue component.

### 4.2 Reconciliation: PM project scope is required by the applied RPC

The applied public RPC permits an Admin to call with `p_project_id = null` globally. A PM Lead is rejected by the database if `p_project_id` is null and may evaluate only an active PM Lead project.

Therefore, the PM control must offer a **server-authorized finite project selection**. This is not a browser override of evaluation behavior:

- the browser may select only a project returned by the server from the caller’s own active PM Lead memberships;
- the Server Action validates an opaque UUID but independently rechecks current PM Lead authority before calling the RPC;
- the database public RPC independently rechecks `private.is_project_lead(p_project_id)`; and
- the browser never supplies time, trigger, recipient, membership type, channel, provider, or delivery state.

Admin S06-05 UI performs one global evaluation only. Do not add an Admin project selector in this work item. The mapping allows Admin project scope, but global evaluation is sufficient to demonstrate the applied shared command while avoiding unneeded selector/data scope.

If a product requirement later demands a different Admin scope UX, create a separate accepted specification; do not widen this control opportunistically.

---

## 5. Applied authorization matrix

| Caller and posture | Button rendered? | Action result | RPC argument | Notes |
| --- | --- | --- | --- | --- |
| Active Admin + flag true + local dev posture | Yes | May invoke exactly one global evaluation | `p_project_id: null` | The database permits Admin global evaluation. |
| Active PM Lead + flag true + local dev posture + one or more active lead projects | Yes | May invoke once for one server-authorized selected project | selected project UUID | Server action and database both recheck capacity. |
| Active PM with only watcher/non-lead memberships | No | Closed `UNAUTHORIZED` if forged | none | Queue access and evaluator access both fail closed. |
| Operator, Client, inactive/deleted/missing profile, unauthenticated | No | Closed `UNAUTHORIZED` if forged | none | Never disclose whether evaluation is available or whether reminders exist. |
| Any otherwise-authorized caller + flag false/missing/malformed | No | Closed `UNAVAILABLE` if forged | none | No RPC call. |
| Any otherwise-authorized caller + non-local/unknown/production posture | No | Closed `UNAVAILABLE` if forged | none | No RPC call. |
| PM Lead with no currently active eligible lead-project record | No | Closed `UNAUTHORIZED` if forged | none | No arbitrary project entry field or empty selector. |

`UNAVAILABLE` deliberately covers disabled demo posture. Do not introduce `DEMO_DISABLED`, `ENVIRONMENT_DENIED`, `PRODUCTION`, `FLAG_FALSE`, or any code that reveals configuration/environment state to browser code.

---

## 6. Development-posture gate

### 6.1 Exact local demonstration predicate

Create a server-only helper in the new evaluator module or a dedicated server-only companion module, for example:

```ts
export function isLocalNotificationDemoPosture(): boolean
```

It returns true only when every condition holds:

1. `process.env.NODE_ENV === "development"`; and
2. `process.env.NEXT_PUBLIC_APP_URL` parses successfully as a URL whose hostname is exactly one of:
   - `localhost`
   - `127.0.0.1`
   - `[::1]`
   - `::1`

All other values, including missing, blank, malformed, a non-loopback hostname, a tunnel, LAN address, preview URL, production URL, and any unexpected deployment configuration, return false. The helper must not throw for these expected disabled cases and must not export/serialize the raw URL or its parse error.

This is intentionally stricter than merely checking `NODE_ENV !== "production"`. It permits the established `jsf-pm-dev` local demonstration posture (`NODE_ENV=development`, `NEXT_PUBLIC_APP_URL=http://localhost:3000`) while making a build, preview, or deployed process fail closed even if the demo flag was accidentally set.

The helper may read only the two variables above and must begin with `import "server-only";`. It must not import `app.config.ts`, because that module is browser-oriented and throws detailed configuration errors. It must not reuse or modify S06-02’s provider capability parser; the two guards have distinct responsibilities.

### 6.2 Combined availability rule

The manual-control availability condition is exactly:

```text
isNotificationDemoAlertEvaluationEnabled()
&& isLocalNotificationDemoPosture()
&& caller passes current server authorization
```

The page/server-screen uses it only after route/session authorization to decide whether to render the control. The Server Action repeats it after session validation and before any project lookup or evaluator RPC invocation.

Neither UI hiding nor a successful initial page render grants mutation authority.

---

## 7. Module and file contract

### 7.1 Create

| Path | Responsibility | Hard boundary |
| --- | --- | --- |
| `src/lib/notifications/alert-evaluator.ts` | Server-only local-posture check, safe result DTO/schema, server-side result narrowing, authorized PM project lookup, and typed wrapper for the one public evaluator RPC. | No UI copy, no provider/config/adapters, no base notification tables, no direct SQL, no private RPC, no environment-value export. |
| `src/lib/notifications/alert-evaluator-schemas.ts` | Strict Server Action input schemas and pure types for Admin global vs PM selected-project requests. | No Supabase/environment/UI import. |
| `src/app/[locale]/(protected)/pm/notificaciones/_components/manual-alert-evaluation-dialog.tsx` | Client-only interaction leaf: controlled project selection, confirmation, pending state, safe result/status feedback, focus behavior, and one action invocation. | No Supabase/browser query, raw environment/config import, provider/import, direct queue/inbox mutation, custom time/channel/trigger/recipient input. |
| `src/lib/notifications/__tests__/alert-evaluator.test.ts` | Wrapper/posture/result schema/PM scope-query focused tests. | Mocked cookie-authenticated client only; no live DB claim. |
| `src/lib/notifications/__tests__/alert-evaluator-actions.test.ts` | Action order, authorization, flag/posture denial, exact RPC input, safe mapping, and revalidation tests. | Mock auth/config/posture/RPC; no provider or direct DB mutation. |
| `src/app/[locale]/(protected)/pm/notificaciones/_components/manual-alert-evaluation-dialog.test.tsx` | Dialog interaction, confirmation, pending state, safe result/error display, project selector, keyboard/focus, and no-send truthfulness. | Focused jsdom test only; no provider/inbox/queue pagination test duplication. |

### 7.2 Modify

| Path | Required modification | Explicitly forbidden |
| --- | --- | --- |
| `src/lib/notifications/operations-actions.ts` | Add the evaluator Server Action and its closed result types, or create a narrowly named sibling `alert-evaluator-actions.ts` if this keeps the existing continuation module below 400 lines. The preferred ownership is a sibling action module because the operation is a mutation rather than queue continuation. | Altering the existing load-more behavior/error union, importing providers, reading raw environment values, or accepting arbitrary evaluator controls. |
| `src/app/[locale]/(protected)/pm/notificaciones/_components/notification-operations-screen.tsx` | Accept a server-computed optional manual-control model and render the dialog directly below the description and above the read-only queue. | Moving the control into `NotificationOperationsQueue`, duplicating it by route, or rendering it before server authorization. |
| `src/app/[locale]/(protected)/pm/notificaciones/page.tsx` | After existing PM route/capacity authorization, construct the PM manual-control model only if demo flag + local posture + eligible lead project scope pass. | Weakening PM Lead checks, accepting query-string scope, evaluating on render, or querying notification tables. |
| `src/app/[locale]/(protected)/admin/notificaciones/page.tsx` | After existing Admin route authorization, construct the global Admin manual-control model only if demo flag + local posture pass. | Admin project selector, automatic evaluation, or direct provider/config output. |
| `messages/es-MX.json` | Add only the `notificationOperations.manualEvaluation` keys in §11. | Raw provider/configuration/recipient detail or unrelated S06-06/S06-07 copy. |
| `messages/en-US.json` | Exact structural parity with Spanish. | Different nesting, semantic gaps, or English-only fallback. |
| `__tests__/i18n/message-catalogs.test.ts` | Extend the existing notification-operations parity assertion to validate the manual-evaluation subtree. | A parallel i18n harness. |
| `src/app/[locale]/(protected)/pm/notificaciones/notification-operations-routes.test.tsx` or the actual existing route test | Add only composition/availability assertions necessary to prove the control is passed/rendered only under the gate. | Replacing database authorization proof with a page mock. |

### 7.3 Files explicitly not modified

Do not modify:

- any `supabase/migrations/*` file;
- `src/lib/database.types.ts`;
- `src/lib/notifications/config.ts`, `types.ts`, `errors.ts`, or `channel-adapters.ts`;
- `src/lib/notifications/operations-queries.ts`, `operations-contracts.ts`, `operations-schemas.ts`, or `operations-authorization.ts`, except a type-only export if a small shared type genuinely avoids duplication;
- recipient inbox queries/actions/components/routes;
- fan-out triggers, lifecycle commands, provider receipt/lease boundaries, endpoints, navigation, middleware/protected layout, `package.json`, or `.env.example`;
- application/global configuration modules; and
- `CHANGELOG.md` or sprint closeout files (S06-07 owns final integration documentation).

If an implementation requires a prohibited mutation, stop and record the exact governing conflict.

---

## 8. Server contracts

### 8.1 Safe evaluator result contract

The generated RPC return is `Json` and is untrusted at the application boundary. Validate it before projecting to browser code. Define this exact closed browser-safe DTO:

```ts
export type AlertEvaluationSummary = Readonly<{
  tasksEvaluated: number;
  reviewsEvaluated: number;
  eventsCreated: number;
  inAppRecipientsCreated: number;
  externalSuppressionsCreated: number;
}>;
```

Validate a strict object with exactly the applied migration’s five keys:

```text
tasks_evaluated
reviews_evaluated
events_created
in_app_recipients_created
external_suppressions_created
```

Each value must be a finite safe integer greater than or equal to zero. Reject all arrays, null, missing properties, non-numeric strings, decimal values, negative values, `NaN`, `Infinity`, unexpected keys, and nested/provider/recipient data. A failed parse is a generic server-side unavailable outcome. Do not return partial counts.

The client receives only the camel-cased `AlertEvaluationSummary`; it never receives raw JSON, database IDs, reminder window information, recipient counts by user/channel, or a delivery/provider result.

### 8.2 Scope input contract

Create only the following strict action schemas:

```ts
const EvaluateAlertsAsAdminSchema = z.object({}).strict();

const EvaluateAlertsAsPmLeadSchema = z
  .object({ projectId: z.string().uuid() })
  .strict();
```

The Server Action must not trust a caller-selected role discriminator. Its server session determines which schema is valid:

- Admin: accept only `{}` and call the RPC with `{ p_project_id: null }`.
- PM: accept only `{ projectId }`, then revalidate the user has current active PM Lead capacity for **that exact project** before calling the RPC.
- All other roles: return closed `UNAUTHORIZED` before using input to call any evaluator boundary.

Do not add nullable project IDs, `scope`, date/time, trigger, recipient, delivery channel, provider, dry-run, force, retry, locale, return URL, or confirmation-text fields.

### 8.3 PM project selector query

Add one server-only function, for example:

```ts
export async function listActivePmLeadEvaluationProjects(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<readonly AlertEvaluationProject[]>;
```

Its browser-safe output is exactly:

```ts
export type AlertEvaluationProject = Readonly<{
  id: string; // selector value only; never visible, routed, logged, or labelled
  name: string;
}>;
```

Requirements:

1. Query only the caller’s own `project_members` rows with `user_id = userId`, `member_type = 'pm_lead'`, `deleted_at is null`.
2. Join only active, non-deleted projects that are not archived and not terminal (`completed` or `cancelled`). This avoids offering an evaluation that is certain to evaluate nothing because its project is operationally unavailable.
3. Use the minimum projection necessary for selector options: membership project ID and project name. Do not query notification/event/recipient data, profile contact data, projects outside the caller’s membership, deadlines, deliverables, tasks, or counts.
4. Deduplicate by project ID server-side and sort by project name using a deterministic locale-neutral database order or a stable server-side comparison. The client must not construct/merge arbitrary project options.
5. A query error fails closed: do not render the PM control and do not fall back to an arbitrary/global project scope.
6. A PM route may pass this finite list to the dialog only after the pre-existing `hasActivePmLeadMembership` authorization succeeds. The action nevertheless repeats exact-project authorization.

The `id` is an opaque interaction value. It must not be included in visible strings, `aria-*` labels, toast content, query parameters, navigation, logs, analytics, snapshots, or manual result output.

### 8.4 Evaluator wrapper

`alert-evaluator.ts` must begin with `import "server-only";` and expose a focused function equivalent to:

```ts
export async function evaluateNotificationAlerts(
  supabase: SupabaseClient<Database>,
  projectId: string | null,
): Promise<AlertEvaluationSummary>;
```

It calls exactly:

```ts
supabase.rpc("evaluate_notification_alerts", {
  p_project_id: projectId,
});
```

Rules:

1. It does not call a private RPC, query any notification/event/recipient table, call an adapter, read provider config, call `fetch`, or evaluate domain rules.
2. It makes one RPC call and validates the returned JSON using §8.1.
3. On RPC error or malformed JSON, log only a bounded event name such as `notification-alert-evaluation-failed` and throw one generic error; do not log project ID, user ID, arguments, raw result, database error, or configuration state.
4. It returns only the safe summary.
5. It does not cache results, retry, debounce, schedule, poll, or transform a zero result into an error. A valid all-zero aggregate means no currently due reminder created an event.

### 8.5 Server Action

Use a narrowly named Server Action in a new `alert-evaluator-actions.ts` sibling module unless codebase inspection proves the existing operation-actions file remains small and cohesive. Start with `"use server";`.

Define the only client-visible error union:

```ts
export type AlertEvaluationActionErrorCode =
  | "VALIDATION_FAILED"
  | "UNAUTHORIZED"
  | "UNAVAILABLE";

export type AlertEvaluationActionResult =
  | { ok: true; data: AlertEvaluationSummary }
  | { ok: false; error: { code: AlertEvaluationActionErrorCode } };
```

Export one action:

```ts
export async function evaluateNotificationAlertsAction(
  rawInput: unknown,
): Promise<AlertEvaluationActionResult>;
```

Required order:

1. Await `cookies()` and call `requireSession(cookieStore)`. Map known `AuthError` to `UNAUTHORIZED`; do not reveal inactive versus unauthenticated distinctions.
2. Create the cookie-authenticated Supabase client.
3. Apply `isNotificationDemoAlertEvaluationEnabled()` and `isLocalNotificationDemoPosture()`. If either is false, return `UNAVAILABLE`. Do not query PM projects or call the evaluator first.
4. Branch only on `session.role`:
   - **Admin:** parse `rawInput` with the strict empty Admin schema. Invalid input returns `VALIDATION_FAILED`. Call `evaluateNotificationAlerts(supabase, null)` exactly once.
   - **PM:** parse with the strict PM schema. Invalid input returns `VALIDATION_FAILED`. Recheck an active PM Lead membership for the exact supplied project in a new server-only helper. If false or query error, return `UNAUTHORIZED`. Call `evaluateNotificationAlerts(supabase, parsed.data.projectId)` exactly once.
   - **Other role:** return `UNAUTHORIZED` without treating supplied input as scope.
5. Map the wrapper’s generic failure to `UNAVAILABLE`; never return an exception, RPC name, project ID, unavailable provider/configuration reason, or raw JSON.
6. On success, revalidate exactly the affected protected views:

```ts
revalidatePath("/admin/notificaciones");
revalidatePath("/en/admin/notificaciones");
revalidatePath("/pm/notificaciones");
revalidatePath("/en/pm/notificaciones");
revalidatePath("/notificaciones");
revalidatePath("/en/notificaciones");
revalidatePath("/[locale]/(protected)", "layout");
```

Before implementation, confirm the installed Next.js 16 `revalidatePath` layout behavior in the local package documentation. If route-group layout revalidation is unsupported, retain the six concrete paths and use the smallest supported protected-shell refresh boundary; do not broaden to a global cache invalidation.

7. Return the safe summary. It is valid for every aggregate to be zero. Do not revalidate on rejected/failed outcomes.

The action must never call the evaluator more than once per accepted user confirmation. Duplicate click prevention belongs to the dialog; database idempotency remains the authoritative backstop.

---

## 9. Route composition and client dialog behavior

### 9.1 Shared screen model

Keep S06-04’s single shared `NotificationOperationsScreen`. Extend it with an optional safe prop such as:

```ts
type ManualAlertEvaluationControl =
  | Readonly<{ kind: "admin-global" }>
  | Readonly<{
      kind: "pm-project";
      projects: readonly AlertEvaluationProject[];
    }>;

type NotificationOperationsScreenProps = {
  initialPage: SuppressedNotificationOperationsPage;
  manualAlertEvaluation?: ManualAlertEvaluationControl;
};
```

The screen renders `ManualAlertEvaluationDialog` only when this prop is present. It remains a shared role-neutral screen: routes determine whether the prop exists, while the dialog determines controlled interaction. The queue remains read-only and must not own, import, or invoke the evaluator action.

### 9.2 Route assembly

**Admin page**:

1. Preserve existing `requireSession` and `session.role === 'admin'` redirect behavior.
2. Compute `manualAlertEvaluation` only when flag and local posture are both true.
3. When enabled, pass `{ kind: 'admin-global' }` to the shared screen.
4. Continue to fetch the normal first queue page after route authorization. Do not evaluate during server rendering.

**PM page**:

1. Preserve existing session, role, and `hasActivePmLeadMembership` denial/redirect behavior.
2. Only after that succeeds, check flag and local posture.
3. When both pass, fetch the safe active PM Lead project list from §8.3.
4. Pass `{ kind: 'pm-project', projects }` only when the list is non-empty. A failed/empty query silently omits the manual control; it does not make the queue inaccessible and does not render a configuration/authorization explanation.
5. Continue to fetch the normal first queue page independently. Do not call the evaluator while deriving the selector.

The page must not pass the application role, session, user ID, configuration values, or environment status to the client.

### 9.3 Dialog primitive and structure

Use the established `AlertDialog` primitive from `@/components/ui/alert-dialog`, not an ad hoc modal. It provides the project’s existing modal semantics and focus management.

The client component is the only interaction owner. Required structure:

1. A visible trigger button below the page description, before the queue. It uses a localized label and has a 44×44 CSS-pixel minimum target.
2. `AlertDialogContent` with a localized title and description.
3. A conspicuous localized truthfulness statement that evaluation can create ordinary in-app records and terminal suppressed external records for independently eligible recipients, but does **not** send email or WhatsApp.
4. For PM only, one labeled native `<select>` populated exclusively from server-provided project options. It has no free-form input, no blank project ID submission, no project creation, no arbitrary project search, and no global option.
5. Native Cancel and Confirm controls. Confirm uses action-oriented localized copy such as “Evaluate now”; it must not say “Send”, “Dispatch”, “Deliver”, “Retry”, or “Schedule”.
6. A single visible `role="status" aria-live="polite"` region for pending/success feedback and a visible `role="alert"` for closed failures. The live regions must contain only localized safe content and aggregate numbers.

### 9.4 Interaction state rules

- The dialog is closed initially.
- Opening the dialog does not invoke any server action.
- For PM, initialize selected project from the first server-authorized option only after opening/receiving props. The user may select only another supplied option. If an impossible empty list arrives, do not render a confirmable dialog.
- Confirmation invokes `evaluateNotificationAlertsAction` exactly once with `{}` for Admin or `{ projectId }` for PM.
- While pending, disable trigger, selector, Cancel, and Confirm; render localized pending status; prevent Escape/dismiss only if the AlertDialog primitive’s pending-safe composition requires it. Do not permit a second action while the first is unresolved.
- On closed failure, preserve the dialog and current PM selection, restore a usable confirm/cancel state, and render only the localized error mapped from the closed code.
- On success, show the localized aggregate result in the dialog/status region, then invoke `router.refresh()` exactly once so the authoritative internal queue, inbox, and protected-shell badge refresh. The database result—not local fabricated queue records—determines the changed UI.
- Do not close the dialog before the user can perceive the success summary. It may remain open until the user cancels/closes it; if product interaction testing establishes a safer conventional close-after-acknowledgement behavior, retain the result in an external focusable status region before closing. Do not silently discard the outcome.
- Reconcile/reset local completed/error state when the server-computed manual-control prop changes after `router.refresh()`.
- No toast is required. If the project’s existing Sonner pattern is reused, it must duplicate neither the dialog result nor expose any additional field. Inline dialog feedback is the preferred bounded implementation.

### 9.5 Accessibility requirements

1. Use the AlertDialog title and description primitives so the dialog has programmatic name and description.
2. Escape closes the dialog only when no evaluation is pending; focus returns to the trigger after cancel/close.
3. Native buttons provide Enter/Space activation. The native select is keyboard-operable and has an explicit localized `<label>`.
4. Confirm/cancel/trigger/select meet the 44×44 CSS-pixel minimum and remain visible at 375px width in either theme.
5. Pending, successful aggregate result, and failure are textual—not color-only. Do not announce historic queue records as a result of opening the dialog.
6. On a successful refresh, preserve focus in the dialog while result is displayed. If the control is removed because server props now disable it, move focus to the screen heading/status safely rather than leaving focus on a detached element.
7. Do not include opaque IDs, raw triggers, recipient counts by identity, provider names/configuration, or raw errors in accessible names, descriptions, status messages, test IDs, or DOM data attributes.

---

## 10. Truthful result presentation

The dialog may display only the five safe aggregate values in `AlertEvaluationSummary`. It must use localized labels and interpolate numbers only.

| Aggregate | Truthful meaning | Forbidden interpretation |
| --- | --- | --- |
| Tasks evaluated | Candidate persisted task records considered by the evaluator. | A count of notifications sent or a client-selected task set. |
| Reviews evaluated | Candidate production-review records considered by the evaluator. | A count of client submissions or provider activity. |
| Events created | New immutable reminder event rows created after database eligibility/deduplication. | A count of all current reminders, deliveries, or successful sends. |
| In-app recipients created | New in-app recipient rows created by the authoritative evaluator. | A read/unread count or confirmation that a named user saw a notification. |
| External suppressions created | New otherwise-eligible external recipient rows that became terminal `suppressed/provider_disabled`. | An email/WhatsApp send, queued dispatch, provider attempt, provider failure, retry, or future automatic delivery. |

Required result-copy rules:

- A zero-result evaluation is successful and must state that no new reminder records were created for the current authoritative evaluation, not that there are no due tasks/reviews globally.
- No copy may name Resend, Meta, WhatsApp provider configuration, credentials, schedules, QStash, Workflow, a provider outage, or an external send.
- No copy may say “sent”, “delivered”, “queued for delivery”, “will retry”, “will send later”, or “provider error”.
- The explanation for `externalSuppressionsCreated` must remain semantically consistent with S06-04’s terminal explanation: no send occurred and no automatic later send occurs.

---

## 11. Localization contract

Add the following exact leaf-key tree under the already-existing `notificationOperations` namespace in **both** `messages/es-MX.json` and `messages/en-US.json`:

```text
notificationOperations.manualEvaluation.trigger
notificationOperations.manualEvaluation.triggerAria
notificationOperations.manualEvaluation.dialogTitle
notificationOperations.manualEvaluation.dialogDescription
notificationOperations.manualEvaluation.noSendExplanation
notificationOperations.manualEvaluation.projectLabel
notificationOperations.manualEvaluation.projectAria
notificationOperations.manualEvaluation.cancel
notificationOperations.manualEvaluation.confirm
notificationOperations.manualEvaluation.pending
notificationOperations.manualEvaluation.successTitle
notificationOperations.manualEvaluation.zeroResult
notificationOperations.manualEvaluation.summary.tasksEvaluated
notificationOperations.manualEvaluation.summary.reviewsEvaluated
notificationOperations.manualEvaluation.summary.eventsCreated
notificationOperations.manualEvaluation.summary.inAppRecipientsCreated
notificationOperations.manualEvaluation.summary.externalSuppressionsCreated
notificationOperations.manualEvaluation.errors.validation
notificationOperations.manualEvaluation.errors.unauthorized
notificationOperations.manualEvaluation.errors.unavailable
```

Rules:

1. Spanish (`es-MX`) is the default visible locale; English (`en-US`) is semantically equivalent, not mechanically identical wording.
2. Both catalogs have exactly this nesting and no extra locale-only manual-evaluation key.
3. `noSendExplanation` must clearly state: evaluate current reminders; ordinary in-app and terminal suppression records may be created; no email/WhatsApp is sent.
4. `zeroResult` must describe a successful current evaluation with no new reminder records, not a system/provider failure.
5. Summary count keys interpolate only a number. They do not interpolate IDs, project names, people, email, phone, trigger, channel, provider, environment, or configuration.
6. Error keys map only the closed action codes. Do not distinguish demo flag, local posture, exact role failure, project membership, RPC function, database failure, or configuration state.

Update the existing recursive catalog-parity test so it asserts the full `notificationOperations.manualEvaluation` subtree and required leaves in both locales.

---

## 12. Focused verification contract

Do not run verification while authoring this specification. The Project Owner has already completed and committed prior S06 verification. The implementation worker runs these checks only after the assigned test-first contract and implementation exist.

### 12.1 Required test coverage

| Target | Required assertions |
| --- | --- |
| `alert-evaluator.test.ts` | Exact public RPC name/argument (`null` or supplied UUID); exactly one RPC call; strict safe JSON mapping; rejection of missing/extra/non-integer/negative/unsafe result values; generic failure on RPC error; no raw JSON/IDs/provider/config/error leakage; no base-table/adapters/fetch behavior; local-posture predicate accepts only development + loopback app URL and fails closed for all other cases; PM selector returns only current active non-archived/non-terminal lead projects, dedupes/sorts, and fails closed. |
| `alert-evaluator-actions.test.ts` | Known auth failure returns only `UNAUTHORIZED`; flag false and non-local posture return only `UNAVAILABLE` before PM scope query/RPC; Admin accepts only `{}` and calls evaluator once with null; PM malformed input fails validation; PM exact-project authority is rechecked; PM action calls evaluator once with selected project; unauthorized roles do not call RPC; RPC/malformed-summary failures map to `UNAVAILABLE`; returned success is only five aggregates; exact concrete paths are revalidated only after success; no provider/config/adapter/fetch/timer call. |
| `manual-alert-evaluation-dialog.test.tsx` | Trigger absent is a route-composition concern; when rendered it opens an accessible AlertDialog with truthful no-send copy; Admin submits `{}` once only after explicit confirm; PM sees only supplied project names and submits the selected opaque ID; no free-form time/trigger/recipient/channel/provider input exists; pending disables all duplicate-submission/dismiss controls; success renders only aggregates and refreshes once; each closed error maps to localized safe text; cancel/Escape/focus restoration and keyboard/select behavior work; no raw ID/provider/recipient/error text appears. |
| Existing operations route/screen test | Admin and PM route composition passes the control only when server gates succeed; PM no-project/failing selector omits the control without breaking queue rendering; flag/posture false omits it; no route evaluates alerts during render. |
| Existing catalog parity test | Exact manual-evaluation subtree parity and required summary/error leaves. |

Mocked tests prove wiring and safe projection only. They do not prove applied database RLS, database-time windows, deduplication, recipient eligibility, or suppression constraints. Those remain migration/database evidence and the required manual sandbox journey.

### 12.2 Required manual localhost acceptance journey

Use only approved mutable `jsf-pm-dev` sandbox/reference-safe scenarios after focused automation is green.

1. Set the dedicated local demo flag true in an untracked local environment and keep `EXTERNAL_DELIVERY_MODE=disabled`. Confirm the local app starts in the exact approved development/loopback posture.
2. As Admin, open `/admin/notificaciones`. Confirm the manual control is visible, requires confirmation, describes evaluation/no-send truthfully, and does not run until Confirm.
3. Choose a prepared reference-safe scenario with at least one currently eligible reminder. Confirm once. Verify only the safe aggregate result appears; confirm resulting ordinary recipient inbox record(s) and authorized terminal suppression queue evidence through their real routes. Confirm no provider request, send claim, retry, or provider receipt appears.
4. Confirm again in the same database reminder window. Verify the UI reports a safe aggregate and database evidence shows no duplicate event/fan-out for that reminder window.
5. As an active PM Lead, open `/pm/notificaciones`. Confirm only server-authorized active lead projects appear. Evaluate one selected project and verify the PM sees only permitted queue data; attempt a forged non-member project UUID through the action boundary and confirm generic denial/no evaluation.
6. As PM Watcher, Operator, Client, unauthenticated user, inactive user, and deleted user as available in sandbox fixtures, confirm the control is absent and forged action invocation yields no evaluator outcome, queue data, environment information, or raw authorization detail.
7. Set the demo flag false and restart/reload in local development. Confirm the control is absent from both authorized routes and a forged request calls no evaluator RPC.
8. With the flag true, test a non-loopback/non-development posture through isolated test configuration only—not a deployment—and confirm the action/control fail closed.
9. Repeat one authorized Admin and PM interaction in `/en/admin/notificaciones` / `/en/pm/notificaciones`, at 375px width, keyboard-only, and both themes. Confirm localized modal labels, result statuses, focus restoration, and non-color feedback.
10. Exercise all supported trigger categories through accepted mutable/reference-safe scenarios as Sprint 06 requires: `deadline_24h`, `deadline_12h`, `deadline_6h`, `deadline_overdue`, and `review_inactivity_reminder`. Verify client-submission records never participate in review-inactivity reminders. This is database/evaluator evidence, not a browser-trigger picker.

Do not use direct table inserts to claim evaluator behavior, real providers, fake provider receipt fixtures, an interval, a local scheduler, deployment, DNS, public endpoint, or production data.

### 12.3 Required implementation commands

Run after implementation only:

```bash
npm run test -- src/lib/notifications/__tests__/alert-evaluator.test.ts src/lib/notifications/__tests__/alert-evaluator-actions.test.ts "src/app/[locale]/(protected)/pm/notificaciones/_components/manual-alert-evaluation-dialog.test.tsx" "src/app/[locale]/(protected)/pm/notificaciones/notification-operations-routes.test.tsx" __tests__/i18n/message-catalogs.test.ts
npm run typecheck
npm run lint
npx prettier --check src/lib/notifications/alert-evaluator.ts src/lib/notifications/alert-evaluator-schemas.ts src/lib/notifications/alert-evaluator-actions.ts "src/app/[locale]/(protected)/pm/notificaciones" "src/app/[locale]/(protected)/admin/notificaciones" messages/es-MX.json messages/en-US.json __tests__/i18n/message-catalogs.test.ts
```

If the selected action-module placement differs from the preferred sibling path, substitute the actual narrow action path in the formatter command. Do not run a provider command, Supabase mutation command, scheduler, endpoint, deployment, or broad verification suite solely for S06-05. S06-07 owns final integrated build/closeout evidence.

---

## 13. Acceptance criteria

S06-05 is complete only when every condition below is true:

1. No migration was created or changed; the implementation consumes only the applied `public.evaluate_notification_alerts(p_project_id?)` RPC and unchanged generated type baseline.
2. Application code invokes the public evaluator exactly once per accepted confirmation and never calls a private function, direct SQL, base notification table, lifecycle producer, adapter, provider, endpoint, schedule, timer, polling loop, or fake receipt.
3. Admin can run only one global manual evaluation; an active PM Lead can run only one explicitly selected project returned from server-authorized active PM Lead projects.
4. Admin/PM route controls are rendered only when session/capacity authorization, exact demo flag, and exact local development posture all succeed; the Server Action repeats every gate.
5. PM Watcher, Operator, Client, unauthenticated, inactive, deleted, flag-disabled, non-local, and forged callers cannot invoke the evaluator or learn why it is unavailable.
6. Browser inputs cannot select a time, trigger, task, deliverable, recipient, member type, channel, provider, external dispatch, retry, or arbitrary project; PM can choose only an authorized finite server-supplied project option.
7. The public RPC result is strict-validated server-side and browser output contains only the five non-negative aggregate counts.
8. Success feedback accurately distinguishes evaluation/event/recipient/terminal-suppression counts from sending/delivery/provider behavior. It makes no send, provider, retry, scheduled, or future-auto-send claim.
9. Repeated confirmation in the same database reminder window creates no duplicate notification event/fan-out rows; the UI relies on the database’s idempotency rather than local deduplication.
10. The dialog uses existing AlertDialog semantics, is keyboard/screen-reader usable, restores focus correctly, disables duplicate submission while pending, retains safe error context, and works at 375px in both themes.
11. `notificationOperations.manualEvaluation` has exact Spanish/English semantic-key parity.
12. Focused tests, exact commands, and the factual local sandbox journey are reported with database/RLS/evaluator evidence clearly distinguished from mocks.
13. The completion report makes explicit that Resend, Meta WhatsApp, QStash/Workflow, schedules, webhooks, external dispatch, delivery receipts, DNS, deployment, production verification, and auto-replay remain deferred.

---

## 14. Stop conditions

| Discovery | Required response |
| --- | --- |
| The applied function/type signature differs from `evaluate_notification_alerts(p_project_id?)`, or migration/type provenance is unavailable. | Stop. Reconcile the applied migration/generated types; do not create a compensating migration or TypeScript evaluator. |
| Implementing a required behavior needs a new RPC, migration, direct SQL, service-role client, base table, private evaluator call, or generated-types edit. | Stop and request a governing data-boundary decision. |
| A provider SDK, adapter, `fetch`, webhook, schedule, QStash/Workflow call, timer, polling loop, fake send/receipt, or local scheduler appears necessary. | Stop. It is outside S06-05 and violates ADR-024 capability scope. |
| Demo flag or local posture is false/unknown. | Omit the control; action returns generic `UNAVAILABLE`; make no evaluator call. |
| A PM scope cannot be established from current active lead membership or selector query fails. | Omit the PM control or return generic authorization denial for a forged call. Never fall back to global scope or an arbitrary project. |
| A proposed UI needs a date/time, trigger, recipient, channel, provider, project free-text, or force/retry input. | Reject it. The evaluator owns reminder semantics; only the constrained PM project selector is permitted. |
| The RPC returns malformed/unexpected JSON. | Fail closed as `UNAVAILABLE`; do not render partial counts or raw JSON. |
| A result/diagnostic needs contact data, recipient detail, IDs, payload, config/secret status, raw database error, or provider state. | Reject it. Only five aggregates and existing safe queue/inbox projections are permitted. |
| A test claims duplicate prevention through client state rather than database event/fan-out evidence. | Reject the claim. The UI prevents duplicate submissions; the database proves idempotency. |
| A proposed copy implies sending, failure after a provider attempt, queued delivery, retry, scheduled execution, or eventual automatic send. | Block until truthful terminal/no-send wording is restored. |

---

## 15. Completion handoff requirements

The implementation handoff must report:

1. exact changed application/test/catalog paths, and explicit confirmation that no migration, generated type, provider, endpoint, scheduler, navigation, or database-boundary file changed;
2. confirmed consumption of the already-applied public evaluator RPC and its unchanged generated type signature;
3. exact flag/local-posture predicate and confirmation that raw environment values never cross the server boundary;
4. Admin global and PM exact-project authorization behavior, including PM Watcher/non-lead denial and selector restrictions;
5. safe result DTO keys and proof that no raw JSON, ID, recipient, provider, configuration, payload, or error detail reaches presentation;
6. focused test files plus each exact verification command and factual outcome;
7. manual sandbox evidence for one eligible reminder, same-window idempotent repeat, role/flag/posture denial, PM project scoping, localization/accessibility, and client-submission exclusion;
8. clear distinction between mocked module/component tests and database-authoritative evaluator/RLS/idempotency evidence; and
9. known limitations and deferred work: no live email/WhatsApp, no provider operation/receipt, no schedule/QStash/Workflow, no endpoint/webhook, no deployment/DNS, no production proof, and no historic suppressed-record replay.

The only correct completion statement is: **the local-development, authorized manual control invokes the shared database evaluator and reports safe aggregates; it may create normal in-app and terminal suppression records, while all external dispatch and scheduling remain disabled and unimplemented.**
