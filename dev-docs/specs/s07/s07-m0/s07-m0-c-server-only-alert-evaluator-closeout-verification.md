---
document_id: S07-M0-C-CLOSEOUT-01
sprint_id: S07
work_item: M0-C
status: completed
target_environment: jsf-pm-dev
migration_source: supabase/migrations/20260823111500_s07_m0_server_only_notification_alert_evaluator.sql
applied_migration_name: 20260823111500_s07_m0_server_only_notification_alert_evaluator
completed_at: 2026-08-23T13:34:51-06:00
---

# S07 M0-C — Server-Only Alert Evaluator Closeout

## Outcome

M0-C is complete in `jsf-pm-dev`. The alert evaluator remains available only through the gated Next.js server action using the server-held Supabase service-role client. Browser/session roles can no longer execute either evaluator routine directly.

## Application boundary

Antigravity refactored `src/lib/notifications/alert-evaluator-actions.ts` and its focused action tests.

- The cookie-authenticated client remains limited to caller-scoped PM-lead verification.
- `createAdminClient()` is created only after session, demo flag, strict local-development posture, input, role, and PM-lead capacity checks have passed.
- The existing public RPC name and payload remain unchanged.
- No secret is exported to browser code, logs, or responses.
- Evaluation behavior remains internal: in-app notifications and terminal external suppressions only. Providers, schedules, workflows, webhooks, and external delivery remain inactive.

## Live catalog verification

| Function | authenticated | anon | PUBLIC | service_role | Owner / posture |
| --- | --- | --- | --- | --- | --- |
| `public.evaluate_notification_alerts(uuid)` | false | false | false | true | postgres-owned, `SECURITY DEFINER`, `search_path = pg_catalog, public` |
| `private.evaluate_notification_alerts(uuid)` | false | false | false | true | postgres-owned, `SECURITY DEFINER`, `search_path = pg_catalog, public` |

The applied migration is registered remotely as:

```text
20260823111500_s07_m0_server_only_notification_alert_evaluator
```

The post-application Security Advisor no longer reports `public.evaluate_notification_alerts(uuid)` under `authenticated_security_definer_function_executable`.

## Artifact and repository verification

- Generated Supabase types are normalized-byte-equivalent to committed `src/lib/database.types.ts`.
  - SHA-256: `9a238e87d5e643af8ffb72fba0394d8bd91736ca7f6152adf181bfb7ac037c98`
- `npm run typecheck` passed.
- `npm run test -- src/lib/notifications/__tests__/alert-evaluator.test.ts src/lib/notifications/__tests__/alert-evaluator-actions.test.ts` passed: 2 files, 29 tests.
- `git diff --check` passed.

## Full-suite limitation

A fresh `npm run test` after M0-C returned exit code 1: 12 UI-oriented suites and 82 tests fail before their assertions because the current test runtime resolves `React.act` as non-callable through `react-dom-test-utils.production.js`. The M0-C focused evaluator suites pass, and the failure is not caused by the evaluator action change. This is an existing/unrelated test-environment compatibility issue requiring separate diagnosis; it does not change the verified database privilege result.

## Closure

No further M0-C refactor or Project Owner decision is required. The separate Supabase Auth leaked-password-protection setting remains the only identified pre-S07 remediation item not completed by M0-A through M0-C.
