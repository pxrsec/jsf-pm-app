# S07 M0-C — Server-Only Notification Alert Evaluator Refactor and Pre-Execution Inspection Report

- **Document ID:** `S07-M0-C-REPORT-01`
- **Sprint:** `S07`
- **Work Item:** `M0-C`
- **Status:** `COMPLETED (Application Refactor Complete & Migration Safe to Apply)`
- **Candidate Migration:** `supabase/migrations/20260823111500_s07_m0_server_only_notification_alert_evaluator.sql`
- **Inspection Date:** `2026-08-23`
- **Target Environment:** `jsf-pm-dev` / Repository Workspace
- **Authority / Permission:** Authorized Read-Only Inspection via Repository CodeGraph, Live Catalog Analysis, and Supabase MCP

---

## 1. Verdict

**Verdict:** `safe to proceed to later manual application`

### Executive Summary

The application-side trust boundary refactor for **M0-C** is **complete, verified, and strictly isolated**. The candidate database migration `supabase/migrations/20260823111500_s07_m0_server_only_notification_alert_evaluator.sql` is **verified 100% sound, correct, and ready for later manual application by the authorized Architect**.

1. **Elimination of Security Finding:** The Supabase Security Advisor currently reports `authenticated_security_definer_function_executable` on `public.evaluate_notification_alerts(p_project_id uuid)`. The candidate migration revokes `EXECUTE` from `PUBLIC`, `anon`, and `authenticated` on both `public.evaluate_notification_alerts(uuid)` and `private.evaluate_notification_alerts(uuid)`, granting `EXECUTE` exclusively to `service_role`. Applying the migration will completely resolve this Security Advisor warning.
2. **Server-Only PostgREST Boundary (Option B):** Because `private` is intentionally not an exposed PostgREST schema, retaining `public.evaluate_notification_alerts(uuid)` with `service_role` EXECUTE provides the necessary transport boundary for the Next.js server admin client without exposing internal schemas or creating out-of-band transports.
3. **Multi-Gate Application Isolation:** The server action `evaluateNotificationAlertsAction` (`src/lib/notifications/alert-evaluator-actions.ts`) has been refactored to instantiate `createAdminClient()` strictly **after** six sequential verification gates have passed:
   - Authenticated user session (`requireSession`);
   - Explicit demo evaluation feature flag (`NOTIFICATION_DEMO_ALERT_EVALUATION_ENABLED === "true"`);
   - Strict local loopback development posture (`NODE_ENV === "development"` and loopback hostname in `NEXT_PUBLIC_APP_URL`);
   - Strict schema parsing (`EvaluateAlertsAsAdminSchema` / `EvaluateAlertsAsPmLeadSchema`);
   - Caller role authorization (Admin or PM only; Operator and Client rejected with `UNAUTHORIZED`);
   - PM-lead active project capacity verification under the cookie-authenticated caller client (`assertPmLeadForProject`).
4. **Zero Client / Credential Exposure:** `SUPABASE_SECRET_KEY` remains strictly server-isolated in `src/lib/supabase/admin.ts`. No service-role key or admin client is ever exposed to the browser, client components, API responses, logs, or error payloads.
5. **Preserved Semantics & No External Dispatch:** The evaluation routine creates only in-app notification records and terminal external suppressions (`delivery_status = 'suppressed'`). No external delivery providers (Resend, WhatsApp), schedulers, workflows, or webhooks are activated.
6. **Zero Generated Type Drift:** The public function signature `evaluate_notification_alerts(p_project_id?: string): Json` is invariant. No edits or type changes are made to `src/lib/database.types.ts`.
7. **Comprehensive Test Proof:** All 58 focused test contracts across 5 test suites pass 100%, and full workspace test suite (652 tests across 70 suites) passes with zero regressions.

---

## 2. Complete Object and Dependency Inventory

### 2.1 Live Remote Catalog State (`jsf-pm-dev`)

Catalog inspection via authorized read-only SQL queries established:

| Schema | Routine Name | Arguments | Security Mode | Config (`search_path`) | Owner | Live Catalog ACL (`proacl`) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `public` | `evaluate_notification_alerts` | `p_project_id uuid DEFAULT NULL` | `SECURITY DEFINER` | `pg_catalog, public` | `postgres` | `{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}` |
| `private` | `evaluate_notification_alerts` | `p_project_id uuid DEFAULT NULL` | `SECURITY DEFINER` | `pg_catalog, public` | `postgres` | `{=X/postgres,postgres=X/postgres,service_role=X/postgres}` |

#### Schema Privileges Baseline:
- `public`: `{pg_database_owner=UC/pg_database_owner,=U/pg_database_owner,postgres=U/pg_database_owner,anon=U/pg_database_owner,authenticated=U/pg_database_owner,service_role=U/pg_database_owner}`
- `private`: `{postgres=UC/postgres,authenticated=U/postgres,service_role=U/postgres}`
- `extensions`: `{postgres=UC/postgres,anon=U/postgres,authenticated=U/postgres,service_role=U/postgres,dashboard_user=UC/postgres}`

#### Critical Catalog Findings:
1. **Public Entry Function Dispatch:** In the live definition of `public.evaluate_notification_alerts`, when `auth.role() = 'service_role'`, execution immediately branches to `return private.evaluate_notification_alerts(p_project_id);`.
2. **Private Routine Inherited Public Privilege:** `private.evaluate_notification_alerts` contains `=X/postgres` in its ACL (inherited default public EXECUTE grant). Because `authenticated` holds `USAGE` on schema `private`, authenticated database connections currently have raw SQL execution capability on the internal evaluator.
3. **Database Object Dependents:** Query against `pg_depend` confirmed **0** dependent database objects (no views, foreign keys, or triggers depend on `public.evaluate_notification_alerts`).

### 2.2 Application Caller and Dependency Inventory

| Artifact Path | Reference / Symbol | Classification | Action Taken | Rationale & Verification Basis |
| :--- | :--- | :--- | :--- | :--- |
| `src/lib/notifications/alert-evaluator-actions.ts` | `evaluateNotificationAlertsAction`, `createAdminClient`, `evaluateNotificationAlerts`, `assertPmLeadForProject` | **Required Refactor** | Refactored | Caller reads and PM lead checks execute under cookie client; `createAdminClient()` is imported and instantiated only after all gates pass and passed to `evaluateNotificationAlerts`. |
| `src/lib/notifications/__tests__/alert-evaluator-actions.test.ts` | `mockCreateAdminClient`, `mockCreateClient`, `evaluateNotificationAlertsAction` | **Required Focused Tests** | Updated | Added mock admin client assertion checks, verified admin client is never invoked on failed gates, verified Admin receives `mockAdminClient` with `null`, and PM receives `mockAdminClient` with project UUID. |
| `src/lib/notifications/alert-evaluator.ts` | `evaluateNotificationAlerts`, `isLocalNotificationDemoPosture`, `assertPmLeadForProject`, `listActivePmLeadEvaluationProjects` | **Verification-only** | Unmodified | Verified accepts `SupabaseClient<Database>`, invokes `supabase.rpc("evaluate_notification_alerts", { p_project_id })`, parses strict DTO return. |
| `src/lib/notifications/alert-evaluator-schemas.ts` | `EvaluateAlertsAsAdminSchema`, `EvaluateAlertsAsPmLeadSchema`, `AlertEvaluationSummary` | **Verification-only** | Unmodified | Strict Zod schemas for input validation and raw database return parsing. |
| `src/lib/notifications/config.ts` | `isNotificationDemoAlertEvaluationEnabled`, `getExternalDeliveryCapability` | **Verification-only** | Unmodified | Demo flag check; external delivery returns `disabled`. |
| `src/lib/supabase/admin.ts` | `createAdminClient` | **Verification-only** | Unmodified | Server-only privileged factory returning Supabase client with `SUPABASE_SECRET_KEY`. |
| `src/app/[locale]/(protected)/pm/notificaciones/_components/manual-alert-evaluation-dialog.tsx` | `ManualAlertEvaluationDialog` | **Verification-only** | Unmodified | Consumes `evaluateNotificationAlertsAction`; presents accessible confirmation and project select. |
| `src/app/[locale]/(protected)/pm/notificaciones/_components/manual-alert-evaluation-dialog.test.tsx` | Component unit test suite | **Verification-only** | Unmodified | Verified 8 component tests pass 100%. |
| `src/app/[locale]/(protected)/pm/notificaciones/page.tsx` & `src/app/[locale]/(protected)/admin/notificaciones/page.tsx` | Server route pages | **Verification-only** | Unmodified | Gate server-side rendering of manual control on posture and demo flags. |
| `src/app/[locale]/(protected)/pm/notificaciones/notification-operations-routes.test.tsx` | Route integration test suite | **Verification-only** | Unmodified | Verified 11 route tests pass 100%. |
| `src/lib/database.types.ts` | Database RPC types (`evaluate_notification_alerts`) | **Generated Artifact** | Unmodified (Immutable) | Tracked generated source file; signature is invariant. |
| `supabase/migrations/20260823111500_s07_m0_server_only_notification_alert_evaluator.sql` | Candidate M0-C migration | **Candidate Migration** | Ready for Application | Line-by-line review confirms syntax, transaction atomicity, and ACL correctness. |
| `contracts/openapi/jsf-pm-api.openapi.yaml` | OpenAPI specification | **Verification-only** | Unmodified | No database RPCs or admin operations exposed. |
| `eslint.config.mjs` | Lint boundary rules | **Verification-only** | Unmodified | Restricts admin client from client components, shared code, and middleware. |
| `CHANGELOG.md` | Repository history log | **AFFECTED (Documentation)** | To update | Prepend report entry via `/update-changelog`. |

---

## 3. Trust Boundary and Security Proof

### 3.1 Six-Layer Security & Posture Enforcement

```
[ Incoming Request: evaluateNotificationAlertsAction(rawInput) ]
                        │
                        ▼
    ┌───────────────────────────────────────────────┐
    │ Layer 1: Authenticated Session Validation     │
    │ requireSession(cookieStore)                   │
    └──────────────────────┬────────────────────────┘
                           │ (valid session)
                           ▼
    ┌───────────────────────────────────────────────┐
    │ Layer 2: Feature Flag Gate                    │
    │ isNotificationDemoAlertEvaluationEnabled()    │
    └──────────────────────┬────────────────────────┘
                           │ (true)
                           ▼
    ┌───────────────────────────────────────────────┐
    │ Layer 3: Local Development Posture Gate       │
    │ isLocalNotificationDemoPosture()              │
    │ (NODE_ENV=development + loopback hostname)    │
    └──────────────────────┬────────────────────────┘
                           │ (true)
                           ▼
    ┌───────────────────────────────────────────────┐
    │ Layer 4: Role-Specific Strict Input Schema    │
    │ Admin: EvaluateAlertsAsAdminSchema.safeParse  │
    │ PM: EvaluateAlertsAsPmLeadSchema.safeParse    │
    └──────────────────────┬────────────────────────┘
                           │ (valid schema)
                           ▼
    ┌───────────────────────────────────────────────┐
    │ Layer 5: Role Authorization & Capacity Gate   │
    │ Admin: authorized                             │
    │ PM: assertPmLeadForProject (via cookieClient) │
    │ Other roles (Operator, Client): UNAUTHORIZED  │
    └──────────────────────┬────────────────────────┘
                           │ (authorized)
                           ▼
    ┌───────────────────────────────────────────────┐
    │ Layer 6: Privileged Server Admin Client Call  │
    │ const adminClient = createAdminClient();      │
    │ evaluateNotificationAlerts(adminClient, ...)  │
    └──────────────────────┬────────────────────────┘
                           │
                           ▼
    [ Database Public RPC: public.evaluate_notification_alerts ]
    (Requires role: service_role; rejects authenticated/anon)
```

### 3.2 Verification of Non-Leakage & Fail-Closed Behavior

1. **Unauthenticated / Expired Session:** Throws `AuthError` -> caught and mapped to `{ ok: false, error: { code: "UNAUTHORIZED" } }`. `createAdminClient()` is **never invoked**.
2. **Disabled Demo Flag or Non-Development Posture:** Returns `{ ok: false, error: { code: "UNAVAILABLE" } }`. `createAdminClient()` is **never invoked**.
3. **Invalid Input (e.g. extra fields, invalid UUID):** Returns `{ ok: false, error: { code: "VALIDATION_FAILED" } }`. `createAdminClient()` is **never invoked**.
4. **Unauthorized Roles (Operator / Client):** Returns `{ ok: false, error: { code: "UNAUTHORIZED" } }`. `createAdminClient()` is **never invoked**.
5. **PM Non-Lead for Selected Project:** `assertPmLeadForProject` returns `false` -> returns `{ ok: false, error: { code: "UNAUTHORIZED" } }`. `createAdminClient()` is **never invoked**.
6. **Evaluator / Service Failure:** Any rejection in admin client creation or RPC execution is caught and mapped to generic `{ ok: false, error: { code: "UNAVAILABLE" } }` without triggering path revalidations or leaking error traces.

---

## 4. Candidate Migration Review

Line-by-line review of `supabase/migrations/20260823111500_s07_m0_server_only_notification_alert_evaluator.sql`:

```sql
1:  -- Sprint 07 M0-C: make notification alert evaluation server-only.
2:  --
3:  -- The public RPC remains the narrow PostgREST entry point for the application's
4:  -- server-side service-role client. Browser/session roles lose direct EXECUTE.
5:  -- The private evaluator is also restricted explicitly because the live catalog
6:  -- currently grants it through PUBLIC while authenticated has private-schema USAGE.
7:  --
8:  -- This migration intentionally does not modify evaluator logic, notification
9:  -- generation, external-delivery suppression, schedules, providers, or schemas.
10: 
11: begin;
12: 
13: -- Public RPC: callable only with the server-held Supabase service-role credential.
14: revoke all on function public.evaluate_notification_alerts(uuid) from public;
15: revoke all on function public.evaluate_notification_alerts(uuid) from anon;
16: revoke all on function public.evaluate_notification_alerts(uuid) from authenticated;
17: grant execute on function public.evaluate_notification_alerts(uuid) to service_role;
18: 
19: -- Internal evaluator: remove the inherited PUBLIC EXECUTE grant and retain only
20: -- the trusted service-role execution path used by the public service boundary.
21: revoke all on function private.evaluate_notification_alerts(uuid) from public;
22: revoke all on function private.evaluate_notification_alerts(uuid) from anon;
23: revoke all on function private.evaluate_notification_alerts(uuid) from authenticated;
24: grant execute on function private.evaluate_notification_alerts(uuid) to service_role;
25: 
26: commit;
```

### Review Findings:
- **Lines 11 & 26 (`begin;` ... `commit;`):** Ensures atomic transaction execution.
- **Lines 14–17 (`public.evaluate_notification_alerts`):** Explicitly strips execution rights from `public`, `anon`, and `authenticated`, granting `EXECUTE` solely to `service_role`. This directly prevents direct browser execution while preserving the PostgREST RPC route for server admin calls.
- **Lines 21–24 (`private.evaluate_notification_alerts`):** Explicitly revokes the inherited default `PUBLIC EXECUTE` grant (`=X/postgres`) and restricts `private.evaluate_notification_alerts` strictly to `service_role`.
- **Zero Schema or Function Modification:** The migration does not alter routine signatures, internal evaluation logic, table schemas, or generated TypeScript types.
- **Verdict:** The migration is **100% correct unchanged**.

---

## 5. Verification Commands and Outcomes

### 5.1 Focused Notification Test Suite
```bash
npm run test -- src/lib/notifications/__tests__/alert-evaluator.test.ts src/lib/notifications/__tests__/alert-evaluator-actions.test.ts "src/app/[locale]/(protected)/pm/notificaciones/_components/manual-alert-evaluation-dialog.test.tsx" "src/app/[locale]/(protected)/pm/notificaciones/notification-operations-routes.test.tsx" __tests__/i18n/message-catalogs.test.ts
```
**Outcome:** `PASS` — 5 test files passed, 58 tests passed (0 failures).

### 5.2 TypeScript Compilation Check
```bash
npm run typecheck
```
**Outcome:** `PASS` — Zero TypeScript errors (`tsc --noEmit` exited with code 0).

### 5.3 Git Formatting & Diff Integrity
```bash
git diff --check
```
**Outcome:** `PASS` — Zero whitespace, line ending, or conflict markers.

### 5.4 Full Workspace Regression Suite
```bash
npm run test
```
**Outcome:** `PASS` — 70 test files passed, 652 tests passed, 4 files / 9 tests skipped (expected placeholder suites), 0 failures.

---

## 6. Required Post-Application Verification Plan

When the migration `supabase/migrations/20260823111500_s07_m0_server_only_notification_alert_evaluator.sql` is manually applied to `jsf-pm-dev` by the authorized Architect, the following post-application verification steps must be executed:

### 6.1 Database Catalog ACL Verification
Execute the following query against `jsf-pm-dev`:

```sql
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  p.prosecdef AS is_security_definer,
  p.proowner::regrole::text AS owner,
  p.proacl
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'evaluate_notification_alerts'
ORDER BY n.nspname;
```

**Expected Post-Application Result:**
- `public.evaluate_notification_alerts`: `proacl` must be `{postgres=X/postgres,service_role=X/postgres}` (no `authenticated`, `anon`, or `public` grants).
- `private.evaluate_notification_alerts`: `proacl` must be `{postgres=X/postgres,service_role=X/postgres}` (no `=X/postgres` or `authenticated` grants).

### 6.2 Security Advisor Verification
Fetch live security advisor notices via Supabase:
- Verify that `authenticated_security_definer_function_executable` is **no longer present** for `public.evaluate_notification_alerts`.

### 6.3 Post-Application Invariance Checks
1. Run `generate_typescript_types` via Supabase MCP to confirm `src/lib/database.types.ts` remains completely unchanged (0 lines diff).
2. Run `npm run test` and `npm run typecheck`.

---

## 7. Stop Conditions & Affirmations

1. **Secret Isolation Affirmation:** No secret key (`SUPABASE_SECRET_KEY`), credential, or sensitive configuration has been exposed to client modules, responses, logs, or repository files.
2. **Provider & Dispatch Inactivity Affirmation:** No external email (Resend), WhatsApp, webhook, workflow, or scheduler has been activated. Evaluation remains strictly internal and suppressed.
3. **Schema & Generated Type Invariance Affirmation:** No Supabase migration was applied, no direct DDL was executed, and `src/lib/database.types.ts` was not edited or regenerated.
4. **Git Mutation Boundary Affirmation:** Zero Git mutations (no commits, pushes, branches, or tags) were performed.
