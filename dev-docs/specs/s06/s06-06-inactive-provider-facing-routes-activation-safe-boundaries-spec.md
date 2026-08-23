---
title: S06-06 Inactive Provider-Facing Routes and Activation-Safe Boundaries Specification
status: implementation-ready
version: 1.1
sprint_id: S06
epic_id: E08
work_item_id: S06-06
feature_slug: s06-06-inactive-provider-facing-routes-activation-safe-boundaries
project: Joya Star Films Project Management App
branch: feature/s06-e08-notification-scheduling-and-external-providers-capability-track
risk: high
implementation_scope: application-and-contract-boundary only; no migration; no provider operation; no scheduler
created: 2026-08-22
updated: 2026-08-22
author_profile: engineering-manager
authority:
  - Project Owner direction
  - ADR-024 Deferred External Provider Activation and Epic 08 Capability Delivery
  - dev-docs/specs/s06/s06-e08-notification-scheduling-and-external-providers-capability-track-sprint-plan.md
  - dev-docs/specs/s06/s06-e08-notification-capability-contract-mapping-reference.md
  - contracts/openapi/jsf-pm-api.openapi.yaml
  - AGENTS.md
prerequisites:
  - S06-01 mapping reference complete
  - S06-02 disabled server-only provider capability boundary complete
  - S06-03 through S06-05 complete
  - Project Owner accepted the Section 4 inactive-endpoint contract on 2026-08-22; OpenAPI and route-shell changes must be implemented atomically
successor_work_items:
  - S06-07
---

# S06-06 — Implement Inactive Provider-Facing Routes and Activation-Safe Boundaries

## 1. Objective

Create only the already-reserved provider-facing HTTP route shells and the smallest shared server-only guard needed to make them **deliberately inert** in Sprint 06.

The routes establish stable future locations for:

1. Meta WhatsApp webhook verification and receipt intake;
2. Upstash-signed notification processing; and
3. Upstash-signed alert scheduling.

They must not imply that any provider is configured, reachable, verified, scheduled, or active. Every request in S06 is rejected before body parsing, signature verification, provider/client construction, database access, queue claim, receipt recording, adapter invocation, or any other side effect.

This work item does not implement a provider integration. It implements the explicit boundary that prevents an accidentally deployed or manually probed endpoint from becoming a partial integration.

---

## 2. Database and migration determination

### 2.1 No migration is required or authorized

**S06-06 requires no database migration. Do not create a migration file.**

The work item must not alter:

- `notification_events` or `notification_recipients`;
- the `suppressed/provider_disabled` terminal model;
- external-recipient eligibility/fan-out;
- the notification lease/claim boundary;
- provider receipt recording;
- RLS, grants, views, Realtime publication, audit records, or generated database types; or
- `public.evaluate_notification_alerts(...)` and its private evaluator boundary.

A provider-facing request must cause **zero** notification, audit, provider, receipt, scheduler, or database state changes. Any proposed database dependency is a stop condition, not a reason to add a schema artifact.

### 2.2 Existing database behavior this item preserves

The applied S06 data boundary already creates terminal `email`/`whatsapp` recipient records only when the recipient is otherwise eligible; their sole S06 external outcome is `suppressed/provider_disabled`. Those records have zero attempts and cannot be claimed, retried, requeued, sent, or advanced by a later receipt.

S06-06 neither reads nor changes that state. In particular, an inbound HTTP request must never call `private.record_provider_receipt`, a future queue claim function, a notification adapter, or any direct table/RPC operation.

---

## 3. Authority and source reconciliation

Apply this order to every implementation decision:

1. Direct Project Owner direction and accepted ADR-024.
2. Applied migration sources and the unchanged generated database types for data behavior.
3. The Sprint 06 plan for scope, safety constraints, and acceptance evidence.
4. The S06-01 mapping reference for exact applied notification and authorization facts.
5. This S06-06 specification for route/guard shape and implementation evidence.
6. `contracts/openapi/jsf-pm-api.openapi.yaml` for the exact reserved paths and the mandatory inactive behavior in §4.
7. `AGENTS.md`, installed Next.js documentation, package scripts, and established route-handler conventions.

The S06-01 mapping confirms that no provider webhook/workflow application implementation or consumer exists yet. It reserves no additional paths beyond the OpenAPI contract. Therefore this work item must not invent a Resend callback, email webhook, Meta status callback variant, QStash schedule-management endpoint, health endpoint, provider configuration endpoint, public dispatch endpoint, or generic provider router.

---

## 4. Accepted inactive-endpoint contract reconciliation

### 4.1 Reconciled OpenAPI baseline

The current canonical OpenAPI contract reserves the exact paths required by S06-06:

| Reserved path | Reserved operation(s) | Pre-S06-06 contract wording |
| --- | --- | --- |
| `/api/webhooks/whatsapp` | `verifyWhatsappWebhook` (`GET`), `receiveWhatsappWebhook` (`POST`) | `x-provider-status: deferred`; future operational responses include `200`, and the POST describes signature-authenticated receipt behavior. |
| `/api/workflows/notification-processor` | `runNotificationProcessor` (`POST`) | `x-provider-status: deferred`; future operational response is `200`. |
| `/api/workflows/alert-scheduler` | `runAlertScheduler` (`POST`) | `x-provider-status: deferred`; future operational response is `200`. |

Those future operational response claims are superseded for these four operations by the Project Owner's accepted S06 inactive-endpoint decision. The unrelated `NotificationDeliveryStatus` enum drift—its omission of the applied terminal `suppressed` value—remains explicitly deferred to S06-07/API-contract reconciliation and is not changed by S06-06.

### 4.2 Mandatory OpenAPI and route behavior

For each of the four reserved HTTP operations, implementation **must** make the following exact, coordinated change in `contracts/openapi/jsf-pm-api.openapi.yaml`:

```yaml
x-provider-status: inactive
responses:
  '404':
    description: Generic inactive endpoint rejection. No request body, signature, provider configuration, provider client, scheduler, database command, receipt, or dispatch is processed.
    content:
      application/json:
        schema: { $ref: '#/components/schemas/ApiError' }
```

Remove the current `200` and operation-specific active/deferred response claims from those four operation blocks. Do not retain alternative `401`, `403`, `503`, bare-response, challenge, or success-response variants for S06. Do not leave `x-provider-status: deferred` on any of the four operations.

Every route handler **must** return this fixed S06 response body:

```json
{
  "error": {
    "code": "not_found",
    "message": "Not found"
  },
  "request_id": "<server-generated UUID>"
}
```

This response intentionally does not disclose whether a route is reserved, a provider is configured, a signature is valid, a service is reachable, or future activation is planned. It retains the project’s established structured API-error envelope and correlation field.

The implementation modifies **only** the four reserved operation response blocks and their `x-provider-status` values. It must not update the global API version, the stale notification-status enum, unrelated REST operations, server URLs, schemas, provider prerequisites, or documented future payload schemas in this item.

The OpenAPI update and route-shell implementation are one atomic acceptance unit: implementation is incomplete if either surface retains the former success/deferred behavior or if their status/body contracts differ.

---

## 5. Scope

### 5.1 In scope

1. Create exactly one server-only shared provider-endpoint guard if it removes duplication without becoming a generic provider framework.
2. Create route-handler shells only for the exact OpenAPI paths in §4.1.
3. Make every defined method return the identical generic inactive rejection in §4.2.
4. Establish a narrow future-safe handler composition that makes the required future ordering explicit: activation gate, trusted signature verification, then an idempotent authoritative command/receipt boundary.
5. Add focused route/guard tests proving inactive rejection, no body/signature/provider/database work, no information disclosure, and the future signature-before-side-effect contract shape.
6. Make the mandatory route-specific OpenAPI reconciliation in §4 as part of the same implementation change.
7. Add only documentation/test evidence required by this implementation item.

### 5.2 Explicit exclusions

The following are prohibited:

- Resend, Meta, Upstash QStash, Upstash Workflow, `fetch`, provider SDK/client construction, Graph API URL construction, network call, schedule creation, workflow execution, deployment, DNS, or provider-console work.
- Provider token, webhook verify token, app secret, QStash signing key, workflow URL, sender identity, template, recipient contact value, request body, raw signature, raw configuration state, or provider error logging/exposure.
- GET challenge verification, POST receipt parsing, HMAC computation, QStash signature verification, body parsing, JSON/schema validation, timestamp/replay checks, queue claim, dispatch, retry, receipt persistence, or any fake/simulated provider success.
- Direct/indirect Supabase client creation, RPC invocation, table query, audit write, notification mutation, service-role use, migration, generated-type edit, RLS/policy/grant change, or Realtime change.
- A manual endpoint tester, provider diagnostics UI, configuration-health response, provider status endpoint, route navigation, localization catalog entry, client component, browser configuration exposure, or toast.
- A local scheduler, cron substitute, timer, polling loop, background worker, durable workflow process, or test fixture that pretends to be a provider.
- Updating `/api/v1/notifications*`, the stale notification delivery-status OpenAPI enum, or unrelated API operations.
- Any automatic delivery/replay/requeue of historical `suppressed` records when a provider later becomes active.

---

## 6. Required route inventory and HTTP behavior

### 6.1 Exact route files

Create only these route-handler files:

| Route file | Exported handler(s) | Reserved operation |
| --- | --- | --- |
| `src/app/api/webhooks/whatsapp/route.ts` | `GET`, `POST` | Meta verification challenge and WhatsApp receipt intake. |
| `src/app/api/workflows/notification-processor/route.ts` | `POST` | Upstash notification processor. |
| `src/app/api/workflows/alert-scheduler/route.ts` | `POST` | Upstash alert scheduler. |

Do not create `/api/v1/...` aliases, route groups, catch-all routes, endpoint redirects, rewrite rules, API middleware, dynamic provider path segments, `OPTIONS` handlers, or a generic `/api/providers/*` surface.

The handler files must remain small, below the repository’s 400-line limit, and contain only imports, thin method exports, and delegation to the guard. They must not acquire provider-specific behavior while S06 remains inactive.

### 6.2 Uniform inactive behavior

For each defined method, the handler must immediately delegate to one common function and return the exact generic response described in §4.2:

- HTTP status: `404`.
- Content type: JSON through `NextResponse.json`.
- Envelope: the contract’s `ApiError` shape, with exactly `error.code`, `error.message`, and `request_id`.
- Error code: exact lowercase `not_found`.
- Error message: exact English API text `Not found`.
- Request ID: a fresh server-generated UUID for correlation only; it must not encode provider, route, caller, environment, signature, or configuration information.
- Response body: no route name, provider name, provider state, activation timing, retry instruction, signature result, body-validation result, configuration field, secret fragment, audit ID, notification ID, or stack/error detail.

The inactive guard must not set a `Retry-After` header, provider-specific header, CORS header, cache directive intended to emulate an upstream provider, or content that tells a caller to retry after activation. Preserve the framework’s normal method behavior for methods not declared by the contract; do not expand the surface merely to customize it.

### 6.3 Request-processing prohibition

Before returning the rejection, neither a handler nor the guard may call or access:

```text
request.json()
request.text()
request.formData()
request.arrayBuffer()
request.clone()
request.body
request.headers.get("X-Hub-Signature-256")
request.headers.get("Upstash-Signature")
process.env
crypto.createHmac(...)
fetch(...)
provider SDK/client constructors
cookies()
createClient(...)
createAdminClient(...)
supabase.rpc(...)
supabase.from(...)
```

It may create the opaque correlation UUID. It must not log request headers, URL/query values, bodies, method-specific provider data, raw exceptions, or configuration state.

The route must not validate Origin/Host. These are unauthenticated external-provider-facing endpoints, not unsafe cookie-authenticated browser commands. Adding the ordinary same-origin check would be a misleading partial provider-authentication mechanism and would not satisfy future signature verification requirements. The generic rejection is sufficient while the route remains inactive.

---

## 7. Shared guard and future activation-safe composition

### 7.1 Guard module

Create `src/lib/notifications/provider-endpoint-guards.ts` only if route duplication would otherwise occur. It must begin with:

```ts
import "server-only";
```

Its public S06 export must be narrow and equivalent to:

```ts
import { NextResponse } from "next/server";

export function rejectInactiveProviderEndpoint(): NextResponse {
  // Returns the fixed generic 404 API-error envelope only.
}
```

The exact helper name may vary, but it must not accept a provider name, route name, request, raw body, secret, configuration snapshot, or status selector. It must not return a response that differs by endpoint.

Do not import S06-02 `config.ts`, `types.ts`, `channel-adapters.ts`, or `errors.ts`. S06’s endpoint posture is unconditionally inactive even when a synthetic/local configuration parses as `active-ready`; configuration-shaped input is not operational activation.

### 7.2 Required future composition seam

The source must include a concise non-operational type/interface or documented private composition order sufficient to prevent a future activation implementation from performing side effects before signature verification. It must not add a fake verifier or a callable active branch.

The normative future order is:

```text
1. A separately accepted activation ADR/runbook explicitly permits one named endpoint.
2. A server-only activation gate permits only the approved target environment.
3. Read raw request bytes exactly once, with a bounded body-size policy.
4. Verify the provider-specific signature/authentication and replay policy against server-only secrets.
5. Parse and validate the authenticated payload using the then-current contract.
6. Invoke one idempotent authoritative database command or receipt boundary.
7. Return the provider-approved acknowledgement without leaking internal state.
```

Steps 3–6 are **not implemented** in S06-06. The important invariant is that any future provider-specific verification is completed before an adapter, queue claim, provider receipt, notification event, database mutation, audit write, or dispatch side effect.

A permitted non-operational representation is a type-only internal contract such as:

```ts
type VerifiedProviderRequest<TPayload> = Readonly<{
  payload: TPayload;
}>;

// Future activation-only command handlers may accept VerifiedProviderRequest<TPayload>
// rather than a raw NextRequest. No verifier or command is implemented in S06-06.
```

Do not export this type to browser/shared modules, and do not use it to create a mocked signed request. Its purpose is structural documentation for a later activation slice, not a current interface.

### 7.3 Signature-order invariant

The S06 test contract must prove the currently executable half of this rule:

- inactive rejection occurs before any request inspection or stateful dependency can be invoked; and
- no future-looking handler seam accepts a raw request and a side-effect command in the same unguarded callable function.

It must **not** claim that a Meta or Upstash signature flow works. No provider secret, documented sample signature, fake signature, provider fixture, or cryptographic verification test is authorized in this sprint.

---

## 8. Security and information-boundary model

### 8.1 Threat-response matrix

| Attempt or condition | Required S06 behavior | Forbidden behavior |
| --- | --- | --- |
| Valid-looking Meta verification query | Same generic `404/not_found` response. | Echoing a challenge, comparing a token, or stating webhook activation status. |
| Valid-looking Meta POST with signature | Same generic response before signature/body access. | HMAC verification, body parsing, receipt update, status acknowledgment, or duplicate/stale classification. |
| Missing/malformed/invalid Meta signature | Same generic response. | Different status/body/header that reveals signature handling. |
| Valid-looking Upstash request | Same generic response before header/body access. | Upstash signature verification, workflow continuation, queue claim, or dispatch. |
| Missing/malformed/invalid Upstash signature | Same generic response. | Different response that reveals the workflow endpoint’s state. |
| Synthetic `active-ready` S06-02 capability | Same generic response. | Treating configuration shape as activation or selecting an active adapter. |
| Provider environment variable absent/blank/placeholder/valid-looking | Same generic response; the route does not read it. | Explaining missing configuration or building a provider client. |
| Repeated/replayed request | Independent identical generic rejections; no persisted idempotency/receipt record. | Creating a replay record, audit record, receipt, or retry work. |
| Unexpected internal exception | Framework-safe generic failure path; log only approved generic route-operation telemetry if the project’s error policy requires it. | Returning stack/raw exception or logging request/provider/configuration data. |

### 8.2 No enumeration guarantees

For the same HTTP method, all defined inactive endpoints return the same status, schema, code, and message regardless of:

- provider-specific path;
- presence/absence/validity of a signature header;
- query parameters;
- request body content/size within framework handling;
- current delivery configuration; or
- whether a provider account/credential exists outside the application.

The handler must not reflect query values, headers, body content, or pathname in the response. It must not expose `x-provider-status`, an endpoint feature flag, or a provider identity in headers or JSON.

### 8.3 Server-only import boundary

Route handlers and the guard are server-owned. They must not be imported by Client Components, shared presentation modules, hooks, stores, middleware/proxy, message catalogs, or browser Supabase code.

Before implementation, inspect the S06-02 ESLint boundary. Extend it only if that existing restriction does not already structurally prohibit imports of `provider-endpoint-guards.ts` from the prohibited surfaces. The smallest exact restriction should cover both alias and source-style imports:

```text
@/lib/notifications/provider-endpoint-guards
src/lib/notifications/provider-endpoint-guards
```

Do not add a dependency or a broad global restriction. Preserve existing notification-module restrictions and do not treat `server-only` as sufficient by itself.

---

## 9. File contract

### 9.1 Create

| Path | Responsibility | Hard boundary |
| --- | --- | --- |
| `src/lib/notifications/provider-endpoint-guards.ts` | Fixed generic inactive rejection and non-operational future ordering seam. | No request/config/environment/provider/crypto/database/Supabase/network import or access. |
| `src/app/api/webhooks/whatsapp/route.ts` | Thin `GET` and `POST` route shells delegating to the inactive guard. | No challenge, signature, raw body, receipt, provider import, or database action. |
| `src/app/api/workflows/notification-processor/route.ts` | Thin `POST` shell delegating to the inactive guard. | No Upstash verification, queue claim, dispatch, retry, or workflow operation. |
| `src/app/api/workflows/alert-scheduler/route.ts` | Thin `POST` shell delegating to the inactive guard. | No schedule processing, evaluator call, timer, or database operation. |
| `src/lib/notifications/__tests__/provider-endpoint-guards.test.ts` | Guard shape, fixed envelope, correlation-ID opacity, import/no-side-effect static assertions. | No provider secret/fixture, crypto signature, network, or database mock. |
| `src/app/api/webhooks/whatsapp/route.test.ts` | GET/POST rejection uniformity and no request inspection. | No challenge/receipt/provider simulation. |
| `src/app/api/workflows/notification-processor/route.test.ts` | POST rejection and no dependency invocation. | No workflow/queue/adapter simulation. |
| `src/app/api/workflows/alert-scheduler/route.test.ts` | POST rejection and no dependency invocation. | No evaluator/scheduler/provider simulation. |

### 9.2 Modify as required by the mandatory §4 contract

| Path | Required limited change | Explicitly forbidden |
| --- | --- | --- |
| `contracts/openapi/jsf-pm-api.openapi.yaml` | Change the four reserved route-operation `x-provider-status` values to `inactive`; remove their `200`/operation-specific deferred-success responses; and document only the exact §4 `404` `ApiError` response. | Version bump, server changes, global security changes, unrelated API edits, schema rewrites, notification-status enum repair, or adding a provider payload. |
| `eslint.config.mjs` | Add only the focused prohibited-import entries for the guard if missing. | Changing existing restrictions, introducing plugins/dependencies, or broad unrelated lint policy changes. |

### 9.3 Files explicitly not modified

Do not modify:

- `.env.example`, `.env.local`, configuration files, S06-02 config/types/adapters/errors, or any secret-related code;
- `src/lib/database.types.ts`, `src/lib/supabase/**`, migrations, RLS, database functions, audit code, or notification data modules;
- alert evaluator modules/actions/components/routes;
- notification inbox, internal operations queue, navigation, message catalogs, middleware/proxy, app configuration, package manifest, lockfile, or CHANGELOG;
- provider SDK wrappers, webhook handlers, schedule code, provider mocks, MSW handlers, fixtures claiming provider traffic, or deployment configuration.

If an implementation needs a file listed here, stop and document the exact missing authority. Do not expand scope to make an inactive shell convenient.

---

## 10. Test-first verification contract

The Hermes test-engineer owns the controlling test-first contract. Preserve supplied VC identifiers and do not invent, delete, weaken, or convert a negative test into a fake integration test. This specification defines the required behavior and destinations.

### 10.1 Test isolation rules

1. Tests use only `NextRequest`/route-handler invocation and module mocks that fail if a forbidden dependency is touched.
2. Tests do not read `.env.local`, real environment values, provider dashboards, provider URLs, or application database state.
3. Tests do not call Meta, Resend, Upstash, QStash, Workflow, `fetch`, an HTTP server, or a local development server.
4. Tests do not generate real or fake provider signatures, challenge tokens, webhook payloads, provider receipt IDs, delivery status updates, schedule payloads, or external success responses.
5. Tests may use arbitrary opaque request bodies/headers solely to prove they are not inspected; those values must never be asserted as parsed provider data.
6. Tests must mock `server-only` using the established repository pattern before importing a server-only module in Vitest.
7. A mock for any forbidden dependency must fail loudly if constructed or called. A passing test proves non-invocation; it does not replace the dependency with a fake successful provider response.

### 10.2 Guard tests

`src/lib/notifications/__tests__/provider-endpoint-guards.test.ts` must prove:

1. the guard has a server-only marker and no `use client` directive;
2. the response status is exactly `404`;
3. the response JSON conforms exactly to `{ error: { code: "not_found", message: "Not found" }, request_id: <UUID> }` with no additional fields;
4. independently generated request IDs are opaque UUIDs and do not contain provider names, route names, configuration codes, signature/header data, or request content;
5. the production source has no import/reference to `resend`, Meta Graph endpoints, `@upstash/qstash`, `@upstash/workflow`, `fetch`, Node `http`/`https`, `crypto.createHmac`, Supabase clients, `cookies`, provider configuration modules, adapter modules, alert evaluator modules, or notification table/RPC strings;
6. the source does not accept/use a `NextRequest`, raw signature, raw body, provider/channel argument, or configuration capability as its public inactive-rejection input; and
7. the documented/type-only future seam exposes no active verifier, active switch, provider secret input, side-effect callback, queue command, receipt command, or raw-request-to-command direct flow.

### 10.3 Route tests

For each route file, prove:

1. every defined method returns exactly the same generic rejection envelope and `404` status;
2. WhatsApp `GET` and `POST` are behaviorally identical despite different query/header/body shapes;
3. requests carrying `hub.mode`, `hub.verify_token`, `hub.challenge`, `X-Hub-Signature-256`, `Upstash-Signature`, arbitrary JSON, malformed JSON, or large-looking opaque text receive the same rejection without body/header parsing by application code;
4. the shared guard is called once and no other application dependency is called;
5. no provider, adapter, config parser, Supabase client/RPC/table, evaluator, audit, queue, receipt, timer, schedule, or network primitive is imported/constructed/called;
6. route sources do not include `request.json`, `request.text`, `request.formData`, `request.arrayBuffer`, `request.body`, `request.clone`, signature header names, environment reads, provider names in response text, or `fetch`;
7. the route handlers contain no response status/body branch keyed on provider/signature/configuration state; and
8. only the exact prescribed method exports exist. No uncontracted API surface is introduced.

### 10.4 Contract test

Add a focused static OpenAPI assertion in the existing contract-test location or a narrowly co-located S06-06 test, following the repository’s current convention after inspection. It must assert:

1. the three exact paths exist and no S06-06 route path differs from the contract;
2. the four operation IDs remain unchanged;
3. each operation has the exact `x-provider-status: inactive` value and only the mandatory §4 `404` response;
4. each operation documents only the generic inactive `404` response and the `ApiError` envelope; and
5. S06-06 did not alter unrelated path blocks.

This static test validates source alignment. It does not prove a real provider, signature, webhook, schedule, or deployed endpoint.

### 10.5 Signature-order evidence boundary

The test name and assertions must be truthful:

- valid S06 claim: **inactive rejection precedes all request inspection and potential side-effect dependencies; the future interface does not permit an unverified raw request to reach a command seam**;
- invalid S06 claim: **Meta/Upstash signature verification works**, **webhook receipts are accepted**, **workflow is authenticated**, or **provider delivery is verified**.

No provider signature-order integration test is possible or authorized until a separate activation specification supplies approved secrets, provider contracts, replay policy, target environment, and an idempotent command path.

---

## 11. Required implementation commands

The implementation worker runs these only after the test-first contract and route/guard implementation are complete. They must not start a server or contact a provider:

```bash
npm run test -- src/lib/notifications/__tests__/provider-endpoint-guards.test.ts src/app/api/webhooks/whatsapp/route.test.ts src/app/api/workflows/notification-processor/route.test.ts src/app/api/workflows/alert-scheduler/route.test.ts
npm run typecheck
npm run lint
npx prettier --check src/lib/notifications/provider-endpoint-guards.ts src/app/api/webhooks/whatsapp/route.ts src/app/api/workflows/notification-processor/route.ts src/app/api/workflows/alert-scheduler/route.ts src/lib/notifications/__tests__/provider-endpoint-guards.test.ts src/app/api/webhooks/whatsapp/route.test.ts src/app/api/workflows/notification-processor/route.test.ts src/app/api/workflows/alert-scheduler/route.test.ts contracts/openapi/jsf-pm-api.openapi.yaml eslint.config.mjs
```

If an exact test destination differs because repository inspection finds an established API-route test convention, preserve the convention and update the plan artifact before implementation. Do not add a second test runner/configuration, Playwright, MSW provider handler, local server, `curl` smoke test, provider command, Supabase command, scheduler, deployment, or broad integrated suite for this work item.

The Project Owner has expressly asked that no repository verification commands be run while this specification is authored. This document records future implementation commands only; none were run for this specification.

---

## 12. Acceptance criteria

S06-06 is complete only when all conditions below are true:

1. No migration was created, changed, applied, or regenerated.
2. Exactly the three contract-reserved provider route files exist, with four defined methods total (`GET`/`POST` WhatsApp; POST processor; POST scheduler), and no other provider-facing path exists.
3. The OpenAPI route-operation blocks and route-handler behavior match the mandatory inactive contract in §4; all four operation blocks use `x-provider-status: inactive`, document only the exact `404/not_found` `ApiError` envelope, and contain no legacy `200` or deferred-success response.
4. Every defined inactive endpoint returns the exact same generic structured `404/not_found` response regardless of method-specific provider-looking input, signature-looking headers, request body, or local configuration-shaped state.
5. No inactive request reads a body, query parameter, signature header, environment variable, provider configuration, or secret.
6. No inactive request constructs/calls a provider SDK/client, network primitive, adapter, queue processor, evaluator, timer, scheduler, database client, RPC, table query/mutation, receipt boundary, audit boundary, or dispatch command.
7. No response/header/log/browser-visible output reveals provider identity, endpoint state, signature validity, configuration presence, activation timing, recipient data, notification data, raw request/provider data, or internal errors.
8. The common guard is server-only and structurally restricted from browser/shared/middleware/proxy imports; it does not import the S06-02 capability parser because configuration readiness is not activation.
9. The source contains a narrow non-operational future ordering seam requiring activation authorization and verified requests before future commands, without implementing fake/real verification or any active branch.
10. Tests prove the inactive no-inspection/no-side-effect behavior and source/contract alignment while explicitly avoiding a claim of actual provider signature or workflow correctness.
11. Typecheck, lint, formatter, and focused test results are reported factually by the implementation worker.
12. The completion report states that Resend, Meta WhatsApp activation, receipt processing, Upstash schedules/workflows, provider signature verification, external dispatch, live delivery, DNS/deployment, production proof, and historical suppressed-record replay remain deferred.

---

## 13. Stop conditions

| Discovery | Required response |
| --- | --- |
| The OpenAPI contract block and route handler do not both implement the mandatory §4 `inactive`/`404` contract. | Stop. Correct both surfaces in the same change; do not leave legacy `deferred`, `200`, or mismatched response behavior. |
| An implementation needs a provider secret, verify token, signature, body parser, raw payload, provider SDK, `fetch`, endpoint URL, schedule, queue, receipt, or database call. | Stop. That is activation work outside S06-06. |
| A route uses S06-02 `active-ready` capability to choose behavior. | Block as an R0/R1 activation-boundary defect. S06-06 remains unconditionally inactive. |
| A caller can infer a provider, endpoint reservation, signature result, configuration state, or future activation timing from status/body/header differences. | Block integration and restore uniform generic rejection. |
| Tests prove a mock provider success, fake receipt, fake webhook, fake signature verification, or scheduled invocation. | Reject the evidence. Replace it with no-inspection/no-invocation evidence. |
| The existing OpenAPI contract’s stale `NotificationDeliveryStatus` enum would be changed as part of route work. | Stop that change; record it as S06-07/API-contract reconciliation scope. |
| A route method not reserved by the contract is needed to customize unknown-method behavior. | Stop. Do not expand the public surface for an inactive endpoint. |
| A future-verification seam accepts a raw request and arbitrary side-effect callback/command without an intervening verified-request type. | Stop and tighten the seam before implementation. |
| A completion report uses “webhook implemented,” “workflow implemented,” “provider integrated,” “signature verified,” “receipt accepted,” “scheduled,” “sent,” or “delivered.” | Correct the language. The sole completed behavior is safe inactive rejection. |

---

## 14. Completion handoff requirements

The implementation worker must report:

1. exact changed route, guard, test, lint-boundary, and OpenAPI paths;
2. the Project Owner-accepted mandatory §4 inactive contract and the four operation IDs/paths reconciled;
3. the exact fixed response status/envelope and confirmation that it is uniform and non-enumerating;
4. confirmation that no request body, signature header, configuration/environment value, provider SDK, network primitive, database/RPC/audit/receipt/evaluator/adapter/scheduler code was accessed;
5. the focused test files and exact commands with factual pass/fail results;
6. the source-level and lint evidence for server-only/import restrictions;
7. the explicit boundary between mocked route tests and absent provider/database/deployment evidence;
8. confirmation that no migration, generated type, database state, provider account, secret, schedule, webhook verification, dispatch, receipt, live delivery, or historical suppression replay occurred; and
9. the remaining S06-07/API-contract reconciliation item for the stale OpenAPI `NotificationDeliveryStatus` enum and sprint closeout, without claiming it was fixed here.

The only accurate completion statement is:

> **The four contract-reserved provider-facing operations now reject uniformly through server-only inactive route shells. They inspect no provider request data and cause no notification, provider, database, receipt, schedule, or dispatch effect. Provider activation and signature-verified processing remain deferred to a separately authorized activation ADR/runbook.**

---

*This specification deliberately treats configuration readiness, route reservation, signature verification, workflow execution, receipt recording, and external delivery as separate concerns. In Sprint 06 they are not partial states of one feature: only the route-reservation boundary exists, and it is intentionally inert.*
