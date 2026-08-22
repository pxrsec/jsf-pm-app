---
title: S06-02 Server-Only Configuration and Provider-Ready Disabled Adapters
spec_id: S06-02
sprint_id: S06
epic_id: E08
status: implementation-ready
version: 1.1
created: 2026-08-22
updated: 2026-08-22
author_profile: engineering-manager
project: Joya Star Films Project Management App
branch: feature/s06-e08-notification-scheduling-and-external-providers-capability-track
risk: high
implementation_scope: application-only; no migration; no provider operation
sources:
  - dev-docs/specs/s06/s06-e08-notification-scheduling-and-external-providers-capability-track-sprint-plan.md
  - dev-docs/specs/s06/s06-e08-notification-capability-contract-mapping-reference.md
  - supabase/migrations/20260822140000_s06_e08_notification_capability_suppression.sql
  - AGENTS.md
  - package.json
  - .env.example
  - src/config/server.config.ts
  - src/config/app.config.ts
  - eslint.config.mjs
related_adrs:
  - ADR-024 Deferred External Provider Activation and Epic 08 Capability Delivery
prerequisites:
  - S06-01 mapping reference complete
  - Applied S06 suppression and alert-evaluation migrations reflected in committed generated types
successor_work_items:
  - S06-03
  - S06-04
  - S06-05
  - S06-06
---

# S06-02 — Implement Server-Only Configuration and Provider-Ready Disabled Adapters

## 1. Objective

Create a narrow, typed, **server-only** configuration and channel-adapter boundary that makes external email and WhatsApp dispatch impossible in Sprint 06.

The boundary exists to make a later provider-activation change small and reviewable. It does **not** activate Resend, Meta WhatsApp, Upstash QStash, Upstash Workflow, an HTTP webhook, a schedule, a timer, or any other external operation. It must remain inert when configuration is missing, blank, placeholder-like, partial, malformed, explicitly disabled, or nominally active without a later accepted activation implementation.

The implementation result is a safe internal capability model and two disabled adapters. It creates no database effect, no notification event, no recipient row, no receipt, no provider message ID, no provider client, no HTTP request, no schedule, no queue claim, and no browser-visible configuration surface.

This work item is the provider configuration **boundary**, not provider dispatch. S06’s canonical external-delivery outcome remains the already-applied database trigger’s terminal `suppressed/provider_disabled` recipient row. The application must not replace, duplicate, or reinterpret that database behavior.

---

## 2. Implementation outcome and non-negotiable truthfulness boundary

At S06-02 completion:

1. A server consumer can read a typed configuration snapshot without receiving raw environment values.
2. The snapshot defaults deterministically to `disabled` and handles bad inputs fail-closed.
3. The snapshot can distinguish an intentionally disabled posture, a malformed active declaration, and a fully supplied provider-ready declaration **internally** without disclosing secret/configuration detail.
4. The only adapters supplied by this item are disabled adapters. Invoking either one returns a typed no-dispatch result and performs no side effect.
5. An `active-ready` configuration state does **not** create an active adapter and does **not** authorize a send. It only proves that future activation has a configuration-shaped input to validate again under a separately accepted ADR/runbook and implementation item.
6. Presentation code can map a bounded public-safe result code to localization keys without learning an environment-variable name, provider readiness detail, secret, payload, address, phone number, raw error, or stack.
7. No code from this item is permitted in a Client Component, shared browser module, middleware/proxy, message catalog, test fixture with real values, or public API response.

The implementation must make it impossible for “credentials happen to be present in `.env.local`” to silently become live provider dispatch. Configuration presence is not provider activation.

---

## 3. Authority and precedence

Apply this precedence to every implementation decision:

1. Direct Project Owner direction and accepted ADR-024.
2. Applied S06 migration sources and their committed MCP-generated `src/lib/database.types.ts` result for notification data behavior.
3. The S06 sprint plan for scope, sequence, constraints, acceptance evidence, and exclusions.
4. The S06-01 mapping reference for exact currently applied notification, suppression, role-safe projection, and producer facts.
5. This S06-02 specification for application-module boundaries, configuration vocabulary, adapter contracts, and focused evidence.
6. `AGENTS.md`, package scripts, installed dependency documentation, and nearby repository conventions.

If an authority above conflicts with this document, stop the affected scope. Do not resolve an architecture, provider, schema, or security conflict by weakening the disabled boundary.

### 3.1 Source facts reconciled before implementation

| Fact | Reconciled implementation consequence |
| --- | --- |
| The applied S06 fan-out trigger creates terminal external `suppressed/provider_disabled` rows for otherwise eligible recipients. | No TypeScript adapter inserts, updates, retries, claims, records a receipt for, or otherwise mutates those rows. |
| `suppressed` is terminal and no historical auto-replay is authorized. | Neither configuration parsing nor adapter selection may scan, requeue, migrate, or resend historical records. |
| Resend, Meta WhatsApp, QStash, and Workflow packages are installed. | Installed packages are not permission to import, instantiate, configure, or invoke them in S06-02. |
| `.env.example` currently lists legacy/provider variable names with placeholders. | S06-02 may update that template only to document exact names and safe disabled examples; it may not add values or imply activation. |
| Current `src/config/server.config.ts` throws at module evaluation for `SUPABASE_SECRET_KEY`. | S06-02 must not import it. Notification provider configuration needs a separate lazy, non-throwing, server-only parser because disabled operation is the expected runtime posture. |
| Current ESLint restriction protects only the admin Supabase client. | The item must add a focused structural import restriction for the new notification server-only modules, rather than relying only on developer discipline. |
| Repository tests normally live under `__tests__/`, while the sprint plan expressly names S06-02 co-located test paths. | The S06 plan owns the S06-02 test destinations. Create `src/lib/notifications/__tests__/config.test.ts` and `src/lib/notifications/__tests__/channel-adapters.test.ts`; Vitest’s included TypeScript globs cover them. Do not move existing suites. |

---

## 4. In scope

1. `src/lib/notifications/config.ts`: server-only parsing and safe typed capability snapshot.
2. `src/lib/notifications/types.ts`: pure TypeScript contracts permitted only to be imported by the notification server-only boundary and its tests. It must not become a browser/shared notification domain module.
3. `src/lib/notifications/channel-adapters.ts`: disabled email and WhatsApp adapter implementations and factory/selection boundary.
4. `src/lib/notifications/errors.ts`: bounded internal error/result vocabulary and mapping to localization-safe diagnostic codes.
5. Focused S06-02 tests at the exact paths named in Section 11.
6. `eslint.config.mjs`: the smallest structural restriction required to reject prohibited imports of this server-only notification boundary.
7. `.env.example`: only the exact new configuration variable names, explanatory comments, and deliberately disabled placeholder/template values required by Section 7.4.
8. Focused non-mutating verification commands specified in Section 12.

---

## 5. Explicitly out of scope

The following are prohibited in this work item:

- A Resend import, Resend client construction, `emails.send`, actual email payload, sender verification, domain/DNS work, API-key validation against Resend, or a test fake that returns a message ID.
- A Meta/WhatsApp HTTP request, SDK, Graph API URL construction, bearer token use, template submission, message payload, phone/business verification, webhook verification, receipt handling, or any live/test message.
- Any `fetch`, `XMLHttpRequest`, Node `http`/`https`, provider SDK invocation, provider client instantiation, retry loop, timer, cron substitute, schedule creation, QStash use, Workflow use, callback route, webhook route, queue consumer, or background process.
- S06-03 inbox queries/actions/routes, S06-04 operational queue/routes/diagnostics, S06-05 evaluator action/control, S06-06 endpoint guards/routes, S06-07 navigation/catalog/closeout work.
- A database query, RPC call, direct table mutation, migration, generated-type edit, Supabase MCP operation, receipt, lease, claim, notification event, or recipient mutation.
- Any provider “test mode,” fake success adapter, fake provider message ID, mocked provider receipt, or simulated provider webhook that could be interpreted as delivery evidence.
- New public configuration, `NEXT_PUBLIC_*` provider variable, client-side feature flag, API response field, localization copy, toast, telemetry, logging of configuration, or browser/edge configuration read.
- Reading, changing, printing, committing, or copying `.env.local` or any real credential.
- Broad refactoring of existing configuration, Supabase, ESLint, test, or environment-template architecture.

---

## 6. Security model and import boundary

### 6.1 Server-only ownership

Every production module under `src/lib/notifications/` created by this item must begin with:

```ts
import "server-only";
```

That directive is necessary but not sufficient. The modules must additionally be protected by ESLint restricted-import rules so a prohibited consumer fails local lint and CI rather than relying on a reviewer to notice the import.

The following import graph is permitted:

```text
future server action / future server query / future route handler
  └─ src/lib/notifications/channel-adapters.ts
      ├─ src/lib/notifications/config.ts
      ├─ src/lib/notifications/types.ts
      └─ src/lib/notifications/errors.ts
```

Tests may import each module after mocking `server-only` exactly as existing server-only test suites do. Tests are not runtime consumers.

The following import graph is prohibited:

```text
Client Component | shared presentation component | hook | Zustand store
middleware/proxy | app public config | message catalog | browser client
  └─ any src/lib/notifications/{config,types,channel-adapters,errors}
```

A future notification Server Action may import the adapter boundary only after its own work item and authorization model are accepted. It must never import raw environment values or bypass the factory.

### 6.2 Required ESLint restriction

Extend the existing `no-restricted-imports` scope for browser/shared/middleware surfaces with exact aliases and source-style paths for all four modules:

```text
@/lib/notifications/config
@/lib/notifications/types
@/lib/notifications/channel-adapters
@/lib/notifications/errors
src/lib/notifications/config
src/lib/notifications/types
src/lib/notifications/channel-adapters
src/lib/notifications/errors
```

The restriction message must state that notification provider configuration/adapters are server-only and cannot be imported by client, shared, middleware, or proxy code.

Do not restrict legitimate server-only consumers globally. Do not add an ESLint plugin or dependency solely for this item. Preserve the existing Prisma and admin-client restrictions unchanged.

### 6.3 No raw-value export rule

No export from S06-02 may contain or expose:

- a provider API key, token, app secret, webhook verify token, signing key, phone number ID, business account ID, sender email, sender domain, workflow URL, or raw environment object;
- a key/value record whose values include raw configuration;
- Zod `error.issues`, an exception message derived from a raw value, or a provider validation detail;
- a function named or shaped as an environment dump, debug snapshot, `getRawConfig`, `getProviderToken`, `getResendClient`, or `getWhatsAppClient`.

Internal parsing may temporarily read `process.env` only inside `config.ts`. Raw values must remain function-local and be discarded after validation. They must not be retained in a returned object, closure exported from the module, error object, log field, or `toJSON` result.

---

## 7. Required module contracts

### 7.1 `src/lib/notifications/types.ts`

This module defines closed internal contracts. It must contain types/readonly constants only; it must not parse the environment, import a provider package, access a network primitive, or contain user-visible copy.

The precise syntax may follow local TypeScript style, but the semantic model must be equivalent to the following.

#### A. Closed channel set

```ts
type ExternalNotificationChannel = "email" | "whatsapp";
```

No `in_app`, generic `string`, provider name, schedule channel, or future channel is accepted by this adapter boundary. In-app delivery is database/application behavior outside S06-02.

#### B. Closed mode set

```ts
type ExternalDeliveryMode = "disabled" | "active";
```

The parser never forwards an unknown raw value. Any other input becomes the safe effective disabled posture with an internal non-leaking configuration code.

#### C. Per-provider configuration state

The configuration snapshot must represent a provider’s state without provider values:

```ts
type ProviderConfigurationState =
  | { kind: "disabled"; code: ProviderConfigurationCode }
  | { kind: "ready" };
```

`ready` means all named fields for that provider have passed S06-02 shape validation. It does **not** mean credentials work, sender/template resources are approved, external services are reachable, provider dispatch is active, or a message can be sent.

#### D. Overall capability state

```ts
type ExternalDeliveryCapability =
  | {
      kind: "disabled";
      mode: "disabled";
      code: ExternalDeliveryConfigurationCode;
      email: { kind: "disabled"; code: ProviderConfigurationCode };
      whatsapp: { kind: "disabled"; code: ProviderConfigurationCode };
    }
  | {
      kind: "invalid";
      mode: "disabled";
      code: ExternalDeliveryConfigurationCode;
      email: ProviderConfigurationState;
      whatsapp: ProviderConfigurationState;
    }
  | {
      kind: "active-ready";
      mode: "active";
      email: { kind: "ready" };
      whatsapp: { kind: "ready" };
    };
```

The overall `active-ready` variant is intentionally configuration-only. The adapter factory in Section 8 must still return disabled/no-dispatch adapters in S06. This double gate prevents a future `.env.local` change from becoming an unreviewed provider release.

#### E. Closed safe codes

Use a finite implementation-internal code union. The exact names below are normative because tests and later mapping must not infer raw environment names:

```ts
type ExternalDeliveryConfigurationCode =
  | "mode_disabled"
  | "mode_missing"
  | "mode_blank"
  | "mode_placeholder"
  | "mode_invalid"
  | "provider_configuration_incomplete"
  | "provider_configuration_malformed"
  | "provider_configuration_placeholder";

type ProviderConfigurationCode =
  | "provider_disabled"
  | "provider_missing"
  | "provider_blank"
  | "provider_placeholder"
  | "provider_partial"
  | "provider_malformed";
```

Do not add codes that identify individual variable names, provider account state, an expected secret length, a secret substring, an endpoint, a recipient, or a provider-specific failure.

#### F. Adapter command and result

The disabled adapter must accept a deliberately minimal internal request shape. It is not a provider payload contract and must not include recipient contact values, provider template values, raw notification payload, attachment data, or credentials.

```ts
type DisabledAdapterRequest = Readonly<{
  channel: ExternalNotificationChannel;
  eventCategory: string;
}>;

type DisabledAdapterResult = Readonly<{
  kind: "not_dispatched";
  channel: ExternalNotificationChannel;
  code: "provider_disabled";
}>;
```

`eventCategory` is retained only to preserve a future internal adapter seam. The S06-02 adapter must not log, serialize, branch on, return, or transform it. It is not user-facing output and must not contain raw notification payload data.

The adapter interface is intentionally asynchronous to reserve a future dispatch seam while keeping S06 behavior inert:

```ts
interface NotificationChannelAdapter {
  readonly channel: ExternalNotificationChannel;
  dispatch(input: DisabledAdapterRequest): Promise<DisabledAdapterResult>;
}
```

The result must never contain `providerMessageId`, `messageId`, `receipt`, `status: sent`, `attempt`, `retryAt`, `error`, `cause`, provider response, or a raw provider/configuration identifier.

### 7.2 `src/lib/notifications/errors.ts`

This module centralizes only safe codes and their presentation-safe mapping. It must not contain actual Spanish or English display copy. That belongs to S06-04/S06-07 message-catalog work.

Required exports:

1. a type-safe mapping from the disabled adapter’s `provider_disabled` code to a stable semantic localization key, for example `"providerDisabled"`;
2. a type-safe mapping for a generic server-boundary unavailable result, if a later server action needs it, for example `"externalDeliveryUnavailable"`;
3. a narrow, safe server error/result shape that does not contain an `Error`, `unknown`, raw cause, stack, environment variable name, or provider validation information.

A presentation consumer may receive only the localization-safe key after server authorization in a future item. S06-02 itself has no UI caller and must not create or import a catalog.

The database machine-readable suppression reason remains exactly `provider_disabled`. Do not introduce a competing persisted or UI-visible reason vocabulary such as `credentials_missing`, `resend_inactive`, `meta_unconfigured`, `test_mode`, or `active_not_implemented`.

### 7.3 `src/lib/notifications/config.ts`

#### A. Server-only parser requirements

The module must use `import "server-only"` and expose one focused configuration-read function such as:

```ts
getExternalDeliveryCapability(): ExternalDeliveryCapability
```

It may memoize the immutable result for a process only if test isolation remains deterministic. A cached result must never survive `vi.resetModules()` in the focused tests. A simple re-parse per call is acceptable and preferred for clarity because the result is tiny and configuration does not change during a request.

Unlike `src/config/server.config.ts`, this parser **must not throw** for absent, blank, placeholder, partial, malformed, or disabled notification provider configuration. Disabled operation is the required S06 production behavior. It returns the appropriate safe typed state instead.

The parser must not import `src/config/server.config.ts`, `src/config/app.config.ts`, `@/lib/supabase/admin`, `resend`, `@upstash/qstash`, `@upstash/workflow`, `next/headers`, or any app route/action module.

#### B. Exact input variables

The only raw input variables in this item are:

| Purpose | Variable | Visibility | S06 use |
| --- | --- | --- | --- |
| Explicit global delivery posture | `EXTERNAL_DELIVERY_MODE` | server-only | Required explicit choice: `disabled` or `active`. Missing/invalid resolves fail-closed. |
| Later manual-evaluator demo posture | `NOTIFICATION_DEMO_ALERT_EVALUATION_ENABLED` | server-only | Parse now only as a bounded server-only boolean capability for S06-05; it must not create a control or invoke evaluation in S06-02. |
| Resend credential | `RESEND_API_KEY` | server-only | Format/presence validation only; never used to construct a client. |
| Resend sender identity | `RESEND_FROM_EMAIL` | server-only | Conservative sender-address shape validation only; never used to construct a payload. |
| Meta access token | `WHATSAPP_API_TOKEN` | server-only | Presence/non-placeholder validation only; never used in a request/header. |
| Meta phone identifier | `WHATSAPP_PHONE_NUMBER_ID` | server-only | Numeric identifier shape validation only; never used in a URL/payload. |
| Meta business identifier | `WHATSAPP_BUSINESS_ACCOUNT_ID` | server-only | Numeric identifier shape validation only; never used in a URL/payload. |
| Meta app secret | `WHATSAPP_APP_SECRET` | server-only | Presence/non-placeholder validation only; never used for signatures. |
| Meta Graph API version | `WHATSAPP_API_VERSION` | server-only | Strict Graph-version shape validation only; never used to form a URL. |

`WHATSAPP_WEBHOOK_VERIFY_TOKEN`, QStash signing keys/tokens, and `UPSTASH_WORKFLOW_URL` are outside the S06-02 adapter configuration contract. They belong to later inactive endpoint/scheduling activation work. S06-02 must not read, validate, return, or cause `.env.example` changes for them beyond retaining their existing clearly deferred template section.

`NEXT_PUBLIC_*` provider variables are forbidden. The parser must not use `NEXT_PUBLIC_APP_URL` as a development-posture check; S06-05 will define its own server-side posture rule in its dedicated item.

#### C. Global mode parsing

Trim input before classification. Interpret the raw global mode as follows:

| Raw `EXTERNAL_DELIVERY_MODE` state | Effective capability | Safe code | Provider invocation permitted? |
| --- | --- | --- | --- |
| missing | `disabled` | `mode_missing` | No |
| whitespace-only | `disabled` | `mode_blank` | No |
| placeholder-like | `disabled` | `mode_placeholder` | No |
| exact case-insensitive `disabled` after trim | `disabled` | `mode_disabled` | No |
| exact case-insensitive `active` after trim, all required provider configurations valid | `active-ready` | none | Still no in S06-02; Section 8 returns disabled adapters. |
| exact case-insensitive `active` after trim, any provider missing/invalid | `invalid` with effective mode `disabled` | one generic aggregate code | No |
| any other string | `invalid` with effective mode `disabled` | `mode_invalid` | No |

Treating malformed active declarations as `invalid` instead of throwing provides safe internal observability to a future authorized server consumer without turning configuration inconsistency into a browser-visible failure or a partial provider launch.

#### D. Placeholder detection

A value is placeholder-like when, after trimming and lowercasing, it is empty or contains any of these case-insensitive fragments:

```text
replace_me
replace-me
replace me
example
placeholder
changeme
change-me
your_
your-
<
>
```

Additionally, known template literals in the existing environment file are placeholders, including `re_replace_me`, `replace-me@example.com`, `https://replace-me.example`, and `sb_*_replace_me` forms.

This is intentionally conservative. A value containing a placeholder fragment must never enable provider readiness even if it otherwise matches a format. Do not attempt entropy scoring, DNS lookup, network validation, secret decoding, account lookup, or a provider probe.

#### E. Provider validation rules

Provider validation is only a local shape/presence gate. It is not credential verification.

**Email provider is ready only if all conditions are true:**

1. `RESEND_API_KEY` is present after trim, not placeholder-like, and begins with `re_` followed by at least one non-whitespace character; and
2. `RESEND_FROM_EMAIL` is present after trim, not placeholder-like, contains exactly one `@`, has non-empty local/domain portions, contains no whitespace, and the domain portion contains at least one dot not at the beginning or end.

Do not claim the sender is authorized, the domain is verified, the key works, or an email may be sent.

**WhatsApp provider is ready only if all conditions are true:**

1. `WHATSAPP_API_TOKEN` is present after trim and not placeholder-like;
2. `WHATSAPP_PHONE_NUMBER_ID` is present after trim, not placeholder-like, and matches digits only;
3. `WHATSAPP_BUSINESS_ACCOUNT_ID` is present after trim, not placeholder-like, and matches digits only;
4. `WHATSAPP_APP_SECRET` is present after trim and not placeholder-like; and
5. `WHATSAPP_API_VERSION` is present after trim, not placeholder-like, and matches `v` followed by one or more digits, a literal dot, and one or more digits (for example `v21.0`).

Do not validate Meta business status, template approval, consent, recipient phone number, webhook signature, endpoint reachability, or token authenticity. Those are provider-operation/activation concerns and remain deferred.

**State precedence for a provider:**

1. Global mode disabled/missing/blank/placeholder: provider state is `disabled/provider_disabled` without separately enumerating raw field defects.
2. Global mode invalid: provider states may be parsed internally but the outward capability remains `invalid/mode_invalid`; do not leak which field fails.
3. Global mode active with an incomplete set of otherwise non-placeholder fields: provider state is `disabled/provider_partial` and overall state is `invalid/provider_configuration_incomplete`.
4. Global mode active with a missing/blank/placeholder provider field: provider state receives the corresponding generic state and overall state is `invalid/provider_configuration_placeholder` or `invalid/provider_configuration_incomplete`.
5. Global mode active with all fields present but one or more malformed: provider state is `disabled/provider_malformed` and overall state is `invalid/provider_configuration_malformed`.
6. Global mode active with both provider sets valid: both are `ready` and the snapshot is `active-ready`.

The implementation must avoid exposing provider-specific causes through an aggregate error. If only email is malformed, a caller receives only `provider_configuration_malformed`, not “Resend sender address malformed.”

#### F. Demo flag parsing

Expose a separate server-only function or a readonly field on the capability snapshot for:

```ts
isNotificationDemoAlertEvaluationEnabled(): boolean
```

It must return `true` only for a trimmed, case-insensitive exact `true`. Every other value—including missing, blank, `1`, `yes`, `on`, placeholder-like, `false`, and malformed strings—returns `false`.

This parser performs no environment/posture authorization. S06-05 must require this value **and** its own approved local `jsf-pm-dev` posture/role checks. S06-02 must not export a raw flag value, create UI, or use the flag to change adapter behavior.

### 7.4 `.env.example` contract

Modify the environment template only after the code contract above is fixed. Retain the existing section structure where feasible, but make the explicit disabled default unmistakable.

Required new/updated safe entries:

```dotenv
# Sprint 06 external delivery capability. Keep disabled in jsf-pm-dev.
# `active` is configuration-ready only; it does not activate dispatch in S06.
EXTERNAL_DELIVERY_MODE=disabled

# Enables only S06-05's authorized local manual alert-evaluation control.
# It never enables email/WhatsApp dispatch.
NOTIFICATION_DEMO_ALERT_EVALUATION_ENABLED=false
```

Retain provider variable names with placeholders only. Recommended safe template values:

```dotenv
RESEND_API_KEY=re_replace_me
RESEND_FROM_EMAIL=replace-me@example.com
WHATSAPP_API_TOKEN=replace_me
WHATSAPP_PHONE_NUMBER_ID=replace_me
WHATSAPP_BUSINESS_ACCOUNT_ID=replace_me
WHATSAPP_APP_SECRET=replace_me
WHATSAPP_API_VERSION=v21.0
```

Keep `WHATSAPP_WEBHOOK_VERIFY_TOKEN` and the Upstash section explicitly labelled as deferred activation/endpoint/scheduling inputs. Do not imply that adding any template value activates sending, webhooks, or scheduling.

Do not add `.env.local`, do not change a real local environment, and do not add or print any non-placeholder value.

---

## 8. Adapter-selection and dispatch contract

### 8.1 Required behavior

`channel-adapters.ts` must provide an explicit adapter-selection function such as:

```ts
getNotificationChannelAdapter(channel: ExternalNotificationChannel): NotificationChannelAdapter
```

For both `email` and `whatsapp`, S06-02 returns the disabled adapter regardless of whether `getExternalDeliveryCapability()` returns `disabled`, `invalid`, or `active-ready`.

This is deliberate. The configuration parser is future-ready; the runtime adapter implementation is still disabled-only. A later activation work item must replace or extend selection only after a Project Owner-authorized activation ADR/runbook has approved exact provider prerequisites, secret provenance, dispatch implementation, payload policy, signature/webhook behavior, retry/receipt handling, test recipients, rollback, monitoring, and environment evidence.

### 8.2 Disabled adapter invariants

For each adapter invocation:

1. Resolve immediately/asynchronously to exactly `{ kind: "not_dispatched", channel, code: "provider_disabled" }`.
2. Do not inspect or branch on the request `eventCategory` beyond TypeScript shape acceptance.
3. Do not import, construct, call, mock, or dynamic-import Resend, Meta, QStash, Workflow, `fetch`, or any network primitive.
4. Do not generate an ID, UUID, timestamp, random value, receipt, status transition, attempt count, retry instruction, or diagnostic payload.
5. Do not throw for expected disabled behavior.
6. Do not log, trace, emit telemetry, call Sentry, mutate a store, update a database, or create a side-effect promise.
7. Do not return a configuration state or reason more specific than `provider_disabled`.

### 8.3 Active-ready safety rule

The following pseudo-flow is normative:

```text
configuration parser:
  active + fully valid shapes -> active-ready

adapter selector in S06-02:
  disabled | invalid | active-ready -> disabled adapter

disabled adapter dispatch:
  -> not_dispatched / provider_disabled / no side effect
```

A developer must not implement this unsafe alternative:

```text
active-ready -> import provider SDK -> construct client -> send
```

That is a stop-condition violation even if tests use mock credentials and no production account is configured.

### 8.4 Future activation compatibility boundary

A later activation item may add concrete adapters behind the same interface only when all of these are explicitly accepted outside S06-02:

- an activation ADR/runbook and target-environment scope;
- provider account/sender/template/phone/business prerequisites;
- a separate server-only secret boundary and credential rotation policy;
- exact recipient payload minimization and authorization decisions;
- a provider dispatch transactional/lease boundary consistent with existing `pending`/`processing` recipient semantics;
- idempotency, retry, rate-limit, monitoring, receipt/webhook signature, and rollback behavior;
- provider-safe test recipients and non-fabricated evidence; and
- confirmation that historic `suppressed` records remain non-replayable absent another explicit decision.

No active adapter can be introduced as a “small follow-up” in S06-02 or by merely changing an environment value.

---

## 9. Error, diagnostic, and localization-safe behavior

### 9.1 Boundary behavior table

| Scenario | Config capability | Adapter result | Permitted externally visible detail |
| --- | --- | --- | --- |
| Variables absent or blank | `disabled` | `not_dispatched/provider_disabled` | None in S06-02. Future authorized UI may use only a generic localized disabled message. |
| Disabled explicit mode with valid-looking values | `disabled` | `not_dispatched/provider_disabled` | No disclosure that values exist or which provider appears configured. |
| Placeholder anywhere | `disabled` or `invalid` as Section 7.3 defines | `not_dispatched/provider_disabled` | No raw placeholder/variable name. |
| `active` with partial/malformed configuration | `invalid` with effective disabled mode | `not_dispatched/provider_disabled` | No individual provider/field detail. |
| `active` with valid-looking email and WhatsApp configuration | `active-ready` | `not_dispatched/provider_disabled` in S06 | No send claim, provider readiness display, or adapter/provider output. |
| Unknown channel at a typed boundary | Not representable in TypeScript; reject only inside a future server caller with a generic safe code | No adapter | Never derive channel from browser input in S06-02. |
| Unexpected internal programming failure | May throw only to the server framework/logging policy after redaction | No provider interaction | Never serialize stack/raw config to client. |

### 9.2 Localization-safe mapping rules

- `errors.ts` may export semantic keys only. It may not import `next-intl`, `messages/*.json`, or user-visible strings.
- No new catalog key is required in S06-02 because there is no UI. S06-04/S06-07 own the actual bilingual catalog namespace and authorized presentation.
- A future presentation caller must map `provider_disabled` to controlled copy that distinguishes terminal suppression from a send. It must not say “sent,” “queued,” “retrying,” “provider down,” “credentials missing,” or “will send when configured.”
- The only allowed S06 operational diagnostic dimensions remain channel, safe event category, and aggregate count after appropriate authorization. S06-02 has no authorized route/action and therefore emits no diagnostic itself.

---

## 10. Files and implementation boundaries

### 10.1 Expected changed-file inventory

| Path | Action | Responsibility | Hard boundary |
| --- | --- | --- | --- |
| `src/lib/notifications/types.ts` | Create | Closed server-only internal contracts for modes, codes, channel, adapter request/result. | No provider import, environment access, UI copy, or broad domain model. |
| `src/lib/notifications/errors.ts` | Create | Safe internal code/result and localization-key mapping. | No raw errors/config/provider copy. |
| `src/lib/notifications/config.ts` | Create | Server-only parsing/shape validation of only Section 7.3 variables. | No throw for disabled/malformed expected states; no raw export or network. |
| `src/lib/notifications/channel-adapters.ts` | Create | Disabled-only adapter implementation/factory. | No SDK/client/fetch/side effect/fake success. |
| `src/lib/notifications/__tests__/config.test.ts` | Create | Focused configuration/flag/secret-boundary negative tests. | Synthetic values only. |
| `src/lib/notifications/__tests__/channel-adapters.test.ts` | Create | Adapter no-side-effect/contract tests. | No fake successful provider adapter. |
| `eslint.config.mjs` | Modify | Structural restrictions for new server-only modules. | Preserve existing restrictions. |
| `.env.example` | Modify only if required | Exact safe variable template and disabled examples. | No real values; no activation implication. |

### 10.2 Files explicitly not modified by S06-02

- `src/config/app.config.ts`
- `src/config/server.config.ts`
- `src/lib/supabase/*`
- `src/lib/database.types.ts`
- any `supabase/migrations/*`
- `contracts/openapi/*`
- `src/app/**`
- `src/components/**`
- `messages/es-MX.json` and `messages/en-US.json`
- provider endpoint routes, alert evaluator, inbox queries/actions, operations queries/actions, navigation, `CHANGELOG.md`, sprint closeout documentation
- lockfiles and `package.json`

If implementing the contract appears to require any listed excluded file, stop and record the exact conflict. Do not expand the item silently.

---

## 11. Test-first verification contract

The existing Hermes test-engineer owns test-first behavioral contracts. Preserve any controlling VC identifiers supplied with the assigned card; do not invent, weaken, or delete them. This specification defines required test behavior and file destinations for S06-02.

### 11.1 Test isolation rules

1. Each configuration test starts with `vi.resetModules()` before dynamically importing the configuration module so module-evaluation/caching cannot contaminate another environment case.
2. Preserve and restore `process.env` in `beforeEach`/`afterEach` using the repository’s existing config-test pattern.
3. Mock `server-only` to an empty module before importing a server-only target in Vitest, as existing repository server-only tests do.
4. Use only obviously synthetic values. Never copy a value from `.env.local`, CI, shell output, service dashboard, or user input.
5. Mock global `fetch` only to fail if invoked. A passing test must prove it was never called; it must not use MSW to simulate an outbound successful provider response.
6. Do not dynamically import provider packages in a test. Import-spy or source-level assertions may prove their absence; no test should instantiate a provider client.
7. Tests must not load `src/config/server.config.ts`, which can fail because `SUPABASE_SECRET_KEY` is intentionally unrelated to disabled notification configuration.

### 11.2 `src/lib/notifications/__tests__/config.test.ts`

Required cases:

1. **Default is disabled:** absent `EXTERNAL_DELIVERY_MODE` returns `disabled`, safe `mode_missing`, disabled provider states, and no raw environment-value field.
2. **Explicit disabled wins:** `EXTERNAL_DELIVERY_MODE=disabled` remains disabled even when all synthetic email/WhatsApp fields are shape-valid.
3. **Whitespace and unknown mode fail closed:** blank and a value such as `enabled`/`test` become disabled effective posture; no exception is thrown for normal bad configuration.
4. **Mode placeholder fails closed:** template-like global values such as `replace_me` and `<mode>` never enable readiness.
5. **Active needs both providers:** valid-looking email with absent WhatsApp, and the inverse, each result in `invalid` with effective disabled mode and no provider-specific/raw variable disclosure.
6. **Partial and blank inputs:** each provider’s missing/blank/partial required fields produce disabled/invalid state as specified; the exported snapshot contains only finite codes.
7. **Placeholder values:** every placeholder pattern from Section 7.3.D is recognized when used in a required provider field, including existing `.env.example` literals.
8. **Malformed email configuration:** a non-`re_` token, malformed sender, whitespace sender, and malformed sender domain never yield email `ready`.
9. **Malformed WhatsApp configuration:** non-digit phone/business identifiers and invalid Graph versions never yield WhatsApp `ready`.
10. **Fully shaped active-ready configuration:** only a synthetic exact `active` mode plus all required fields passing local shape checks returns `active-ready`. The test must explicitly state that this is configuration readiness, not dispatch permission.
11. **No raw export:** serialize/inspect every public returned object and assert it does not contain synthetic API keys, tokens, app secrets, sender address, IDs, `process.env`, `RESEND_`, `WHATSAPP_`, or raw Zod issue text.
12. **Server-only marker:** statically assert the production `config.ts` begins with/imports `server-only`; direct runtime test imports mock the marker only for Vitest execution.
13. **Demo flag:** only case-insensitive exact `true` enables `isNotificationDemoAlertEvaluationEnabled`; missing, false, blank, `1`, yes, on, and placeholder-like values are false.
14. **No unrelated environment reads:** source-level focused assertion confirms no QStash/Workflow/webhook/token variable names or `NEXT_PUBLIC_` provider keys appear in the parser.

Do not test live provider credential validity, sender authorization, provider endpoint reachability, or a real environment.

### 11.3 `src/lib/notifications/__tests__/channel-adapters.test.ts`

Required cases:

1. For each exact channel (`email`, `whatsapp`), selection returns an adapter whose declared channel matches the request.
2. Dispatch resolves to exactly `kind: not_dispatched`, the requested channel, and `code: provider_disabled`.
3. Dispatch returns no message ID, provider receipt, `sent` status, timestamp, retry, attempt, error cause, raw config, or event category.
4. With configuration absent/disabled, `fetch` is never called and no provider client/SDK factory is invoked.
5. With synthetic `active-ready` configuration, selection and dispatch remain disabled/no-dispatch and `fetch` is still never called. This is the regression test that prevents environment-only activation.
6. The adapter module has a static server-only marker and no `use client` directive.
7. Static source assertions confirm no import path/reference to `resend`, `@upstash/qstash`, `@upstash/workflow`, provider Graph API endpoint, `fetch(`, Node `http`, or Node `https` appears in the production adapter module.
8. The adapter factory accepts only the closed `email`/`whatsapp` union at compile time; do not add a runtime browser-controlled channel switch simply to test invalid input.
9. The disabled adapter does not throw for expected disabled/active-ready configuration cases.

The tests must prove no interaction, not merely mock an interaction that returns success.

### 11.4 Structural import-boundary evidence

Add a focused static test to one of the two required S06-02 test files, or extend the existing configuration import-guard suite only if the test engineer’s contract directs it. It must inspect `eslint.config.mjs` and prove the exact four notification module aliases/source paths are present in the restricted-import configuration.

Then `npm run lint` is the actual enforcement proof. Do not claim that a source-string test alone guarantees browser bundle isolation.

---

## 12. Required focused command sequence

Run only after tests and implementation are complete, without reading or printing secrets:

```text
npm run test -- src/lib/notifications/__tests__/config.test.ts src/lib/notifications/__tests__/channel-adapters.test.ts
npm run typecheck
npm run lint
npm run format:check
npm run build
```

Rationale:

- The focused Vitest command proves S06-02 configuration, disabled adapter, no-network, and structural expectations.
- TypeScript verifies closed unions and no invalid module shape.
- ESLint enforces the restricted-import boundary.
- Prettier check is non-mutating.
- The production build is the final browser/server boundary check.

Do not run `npm run format`, `npm run verify`, coverage, Supabase commands, provider commands, a local scheduler, a provider endpoint, or a manual localhost provider journey for this item. Sprint-wide database, UI, route, authorization, manual demo, and closeout evidence belong to their owning work items.

If `npm run build` or lint proves a current import boundary convention differs materially from this specification, stop and reconcile the documented restriction rather than removing the server-only guard.

---

## 13. Acceptance criteria

- [ ] The S06-01 mapping confirms that the applied suppression/evaluator database baseline exists before S06-02 begins; S06-02 does not change it.
- [ ] `src/lib/notifications/config.ts`, `types.ts`, `channel-adapters.ts`, and `errors.ts` exist and begin with a server-only boundary marker.
- [ ] All raw provider/environment reads occur only inside `config.ts`; no module export contains raw values, an environment object, a raw validation issue, a secret-derived error, or a provider payload.
- [ ] `EXTERNAL_DELIVERY_MODE` has only the explicit effective values `disabled` and `active`; missing, blank, placeholder, malformed, unknown, and partial states fail closed without dispatch.
- [ ] The expected S06 development posture is deterministic `disabled`, and a present template placeholder cannot accidentally enable readiness.
- [ ] `active-ready` requires complete local shape validation for both exact email and WhatsApp variable sets, but does not authorize or cause dispatch.
- [ ] `NOTIFICATION_DEMO_ALERT_EVALUATION_ENABLED` uses exact server-only boolean parsing and does not create UI or alter adapter dispatch behavior.
- [ ] Both channel adapters always resolve to the typed `not_dispatched/provider_disabled` result in S06, including with active-ready synthetic configuration.
- [ ] No S06-02 production/test code constructs/imports/calls a provider SDK, `fetch`, network primitive, webhook, schedule, workflow, timer, provider client, or fake success/receipt/message ID.
- [ ] No TypeScript adapter reads/writes notification events, recipients, suppression facts, leases, receipts, or other database state.
- [ ] The existing database-owned `suppressed/provider_disabled` terminal/no-auto-replay semantics remain the sole external-delivery outcome; this item introduces no competing reason vocabulary.
- [ ] ESLint structurally rejects all four notification server-only module imports from client/shared/middleware/proxy surfaces while preserving current restrictions.
- [ ] `.env.example` uses only safe template values and clearly records that disabled is default and `active` does not activate dispatch in S06.
- [ ] The exact focused tests and command sequence in Section 12 pass with factual results before implementation completion is reported.
- [ ] No excluded file or scope is changed without a governing decision.

---

## 14. Stop conditions

| Discovery | Required response |
| --- | --- |
| A proposed implementation needs a Resend/Meta/QStash/Workflow import, client, `fetch`, schedule, webhook, or provider call to satisfy a test. | Stop. The test or implementation is outside S06-02; preserve a disabled no-dispatch boundary. |
| An active-looking environment value reaches a dispatch implementation. | Block as R0/R1 safety defect. Remove the path and prove active-ready still returns disabled adapters. |
| A browser/shared/middleware module needs a configuration code or adapter import. | Stop. Keep presentation behind a later authorized server action/query that returns only a safe localization key. |
| A future UI asks which field is missing, which provider is configured, or to show raw configuration/provider error detail. | Reject. The S06 diagnostic contract permits only authorized channel/event-category/aggregate-count information. |
| A provider readiness requirement needs an account, DNS, domain/sender, template, phone, webhook, or network probe. | Defer to a later activation ADR/runbook; do not turn it into a configuration parser concern. |
| Tests cannot import the co-located S06 paths under current Vitest discovery/configuration. | Stop and reconcile the test-path conflict with the controlling S06 plan. Do not silently relocate the tests or change broad Vitest configuration. |
| Existing ESLint file globs cannot protect a prohibited import surface. | Stop and request a minimal reviewed structural-boundary adjustment; do not rely on comments or `server-only` alone. |
| Implementing the parser seems to require modifying public config, server Supabase config, database types, a migration, OpenAPI, UI, or a route. | Stop. That is outside S06-02. |
| A test or output would require a real environment value. | Stop. Use synthetic data only; do not read `.env.local` or service consoles. |
| A proposed change sends/requeues historical suppressed rows when configuration changes. | Reject. Terminal suppression is non-replayable under ADR-024 and the applied S06 database model. |

---

## 15. Successor handoff

S06-02 leaves the following bounded capabilities for successor work only:

| Successor | Allowed dependency on S06-02 | Still prohibited / owned elsewhere |
| --- | --- | --- |
| S06-03 inbox/read state | None expected beyond avoiding provider config imports. | Inbox must use only the safe database feed/read functions; it must not display config/adapters. |
| S06-04 operations queue/diagnostic | Map only the bounded safe result/localization code through an authorized server boundary if necessary. | It must not inspect raw configuration, provider readiness, recipient identity/contact, or enable resend/retry. |
| S06-05 manual evaluator | Consume the exact server-only demo-flag boolean as one gate, plus its own authorized role/local posture gate. | It must not use the flag to send externally or implement a scheduler. |
| S06-06 inactive endpoints | May reuse a safe configuration-capability query only behind a generic non-enumerating guard. | It must not disclose status, process a receipt, call adapter/provider, or add a fake signature flow. |
| Later activation work | May replace the disabled adapter only behind an accepted activation ADR/runbook and new evidence. | It cannot reactivate historic suppressed rows or use S06-02 `active-ready` alone as approval. |

No successor may broaden these contracts by importing raw environment values or treating configuration-ready as provider activation.

---

## 16. Completion report requirements

The implementation worker’s factual completion evidence must include:

1. exact changed files and whether `.env.example` was modified;
2. the final input-variable inventory, with values omitted/redacted entirely;
3. the implemented capability/adapter variants and confirmation that `active-ready` remains no-dispatch;
4. focused tests added or updated and the exact assertion categories covered;
5. exact commands from Section 12 with pass/fail output summaries;
6. import-boundary/lint evidence;
7. confirmation that no provider/network/database/scheduler/webhook action occurred;
8. security impact: server-only isolation, no raw config export, no browser exposure, no fake receipt/message ID, and no historical replay;
9. localization impact: no catalog/user-visible copy in S06-02; only a safe future localization-key mapping exists; and
10. known limitations: live provider activation, delivery, receipt, scheduling, endpoints, provider prerequisites, and production proof remain deferred.

Do not report “email support,” “WhatsApp support,” “provider integration,” “queued,” “sent,” “configured,” or “ready for production” as completed user-facing behavior. The correct completion statement is: **server-only fail-closed configuration and disabled provider-ready adapter interfaces are implemented; external dispatch remains disabled and unimplemented.**

---

*This specification is intentionally comprehensive because it defines a high-risk secret and external-side-effect boundary. It authorizes only a disabled, server-only capability seam. It does not authorize provider activation or alter the applied S06 database-owned terminal suppression behavior.*
