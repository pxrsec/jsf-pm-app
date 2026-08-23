---
document_id: S07-M0-C-REFRACTOR-PREFLIGHT-01
sprint_id: S07
work_item: M0-C
title: Server-Only Notification Alert Evaluation — Refactor and Pre-Execution Inspection
status: ready-for-antigravity
migration_source: supabase/migrations/20260823111500_s07_m0_server_only_notification_alert_evaluator.sql
application_status: refactor-required-before-application
---

# S07 M0-C — Server-Only Notification Alert Evaluator

## Objective

Complete the application-side half of M0-C so alert evaluation remains available only through the authorized local-development server action, while authenticated browser/session credentials can no longer call the evaluator RPC directly.

The reviewed database candidate is:

```text
supabase/migrations/20260823111500_s07_m0_server_only_notification_alert_evaluator.sql
```

It removes `EXECUTE` from `PUBLIC`, `anon`, and `authenticated` on both:

- `public.evaluate_notification_alerts(uuid)`
- `private.evaluate_notification_alerts(uuid)`

It leaves `service_role` as the sole explicit non-owner runtime executor. **Do not apply this migration in this task.**

## Why a server-only public RPC boundary is required

The Supabase JavaScript client used by the Next.js server calls PostgREST RPC endpoints. The `private` schema is intentionally not an exposed PostgREST application schema; moving the callable RPC into `private` would not create a usable server RPC path without exposing that schema or introducing a separate trusted SQL/Edge-function transport.

Therefore the correct Option B implementation is:

1. retain the existing public RPC name/signature as a PostgREST transport boundary;
2. revoke every browser/session role's ability to execute it;
3. use only the server-held `SUPABASE_SECRET_KEY` through `createAdminClient()` after all session, feature-gate, input, role, and PM-lead checks pass;
4. retain the existing database-authoritative evaluator and external-delivery suppression behavior unchanged.

A public schema location does **not** make a function browser-callable after `EXECUTE` has been revoked. The service-role secret must never reach browser code, public configuration, logs, test snapshots, or response payloads.

## Verified baseline

Read-only repository and `jsf-pm-dev` inspection established:

- `public.evaluate_notification_alerts(uuid)` is `SECURITY DEFINER`, postgres-owned, with hardened `search_path = pg_catalog, public`.
- It currently grants `EXECUTE` to `authenticated` and `service_role`.
- It already routes service-role execution directly to `private.evaluate_notification_alerts(uuid)`.
- `private.evaluate_notification_alerts(uuid)` is also `SECURITY DEFINER`; its current ACL includes inherited `PUBLIC EXECUTE`, and `authenticated` currently has `USAGE` on `private`.
- The public function has no database object dependents.
- The sole application call chain is:

```text
ManualAlertEvaluationDialog
  -> evaluateNotificationAlertsAction
  -> evaluateNotificationAlerts
  -> public.evaluate_notification_alerts
```

- `evaluateNotificationAlertsAction` already performs session validation, demo-flag and strict loopback-development posture checks, strict input parsing, Admin/PM role checks, and exact PM-lead membership validation.
- `src/lib/supabase/admin.ts` already owns `createAdminClient()` and keeps `SUPABASE_SECRET_KEY` server-side.
- Alert evaluation must continue to create only in-app records and terminal external suppressions. Do not activate delivery providers, schedules, workflows, webhooks, or any external service.

## Antigravity task

Perform an independent repository-only inspection first, then implement only the required application refactor and focused tests. Do not apply migrations, call Supabase, modify generated database types manually, alter provider configuration, or change unrelated M0/S07 files.

### 1. Confirm the inventory before editing

Inspect and report every reference to:

- `evaluate_notification_alerts` and `private.evaluate_notification_alerts`;
- `evaluateNotificationAlerts`, `evaluateNotificationAlertsAction`, and `createAdminClient`;
- manual evaluator UI/routes, tests, config gates, API/OpenAPI contracts, scripts, and provider/scheduler code;
- source-level assumptions that the evaluator receives a cookie-authenticated client;
- imports of `@/lib/supabase/admin` and any test mocks for it.

Classify each match as required refactor, verification-only, generated artifact, documentation-only, or unrelated. Stop and report any additional runtime caller, hidden scheduler, direct private RPC call, or source dependency that contradicts this brief.

### 2. Required implementation

Refactor only the server action boundary in:

```text
src/lib/notifications/alert-evaluator-actions.ts
```

Required behavior:

1. Keep the cookie-authenticated `createClient(cookieStore)` client for caller-scoped reads and `assertPmLeadForProject` only.
2. Import and call `createAdminClient()` only after all applicable gates have passed:
   - valid session;
   - demo flag enabled;
   - strict local-development loopback posture;
   - strict input schema;
   - Admin or PM role authorization;
   - for PM, exact active PM-lead membership for the supplied project.
3. Pass the `createAdminClient()` result, not the cookie-authenticated client, to `evaluateNotificationAlerts`.
4. Preserve the existing public RPC call name and exact payload contract:

```ts
supabase.rpc("evaluate_notification_alerts", {
  p_project_id: null | projectId,
});
```

5. Preserve all current generic error mapping, revalidation paths, strict DTO parsing, local-demo gate, and no-provider-dispatch behavior.
6. Do not call private RPCs from TypeScript, expose `private` in PostgREST, import `SUPABASE_SECRET_KEY` directly, pass caller identity/role as RPC input, add a browser client, or loosen any gate.
7. Do not change the migration in this task unless an independently proven source defect requires the smallest documented patch.

### 3. Required focused tests

Update only focused tests necessary to prove the new trust boundary. At minimum amend:

```text
src/lib/notifications/__tests__/alert-evaluator-actions.test.ts
```

The test contract must prove:

1. `createAdminClient()` is not called when session validation fails, demo flag/local posture fails, input is invalid, role is unauthorized, or PM-lead validation fails.
2. On authorized Admin evaluation, `evaluateNotificationAlerts` receives the mocked admin client and `null` exactly.
3. On authorized PM evaluation, `assertPmLeadForProject` receives the cookie-authenticated client, while `evaluateNotificationAlerts` receives the distinct mocked admin client and the exact project UUID.
4. Admin-client/evaluator failure maps to the existing generic `UNAVAILABLE` response and does not revalidate.
5. Existing behavior/DTO tests remain valid. Update wording/comments that incorrectly call the invocation cookie-authenticated, but do not change the RPC name or response contract.

Run and report exact output for:

```bash
npm run test -- src/lib/notifications/__tests__/alert-evaluator.test.ts src/lib/notifications/__tests__/alert-evaluator-actions.test.ts "src/app/[locale]/(protected)/pm/notificaciones/_components/manual-alert-evaluation-dialog.test.tsx" "src/app/[locale]/(protected)/pm/notificaciones/notification-operations-routes.test.tsx" __tests__/i18n/message-catalogs.test.ts
npm run typecheck
```

Also run `git diff --check`. Do not claim runtime database success before the migration is later applied and verified by an authorized executor.

## Required report

Write a report next to this document as:

```text
dev-docs/specs/s07/s07-m0-c-server-only-alert-evaluator-refactor-and-pre-execution-inspection-report.md
```

Include:

- complete caller/dependency inventory;
- changed files and exact behavioral reason for each;
- proof that trusted evaluation happens only after caller authorization and capability gates;
- focused test/typecheck/diff results;
- explicit confirmation that no credential, provider, schedule, webhook, external-dispatch, generated-type, or Supabase mutation occurred;
- whether the migration is still correct unchanged, or the smallest exact correction needed;
- post-application verification queries for public/private ACLs and the Advisor finding.

## Stop conditions

Stop and report rather than broadening scope if any of these occur:

1. The server action cannot instantiate `createAdminClient()` without exposing a secret or changing public configuration.
2. An application caller needs direct authenticated RPC execution for a legitimate non-demo path.
3. A direct private-schema RPC, scheduler, workflow, provider action, or another runtime caller exists outside the known call chain.
4. The required tests reveal that service-role evaluation changes public response, scope, or no-dispatch behavior.
5. The candidate migration would remove the last valid service-role execution path.
6. Any required change would alter notification evaluation semantics, provider activation, RLS, unrelated SECURITY DEFINER functions, or database-generated types.
