---
document_id: S07-M0-SD-CLOSEOUT-01
sprint_id: S07
work_item: M0-SD
status: completed
target_environment: jsf-pm-dev
migration_source: supabase/migrations/20260823130000_s07_m0_security_definer_command_hardening.sql
applied_migration_name: 20260823130000_s07_m0_security_definer_command_hardening
completed_at: 2026-08-23T14:38:00-06:00
---

# S07 M0 — SECURITY DEFINER Disposition Closeout

## Outcome

The final bounded disposition package for the remaining authenticated public `SECURITY DEFINER` command surface is complete in `jsf-pm-dev`.

Applied migration:

```text
20260823130000_s07_m0_security_definer_command_hardening
```

The package changed only seven reviewed function bodies. It did not modify tables, enums, RLS policies, providers, schedulers, webhooks, external delivery, or the 11 retained trusted commands.

## Applied behavior

| Ref | Routines | Verified result |
| --- | --- | --- |
| R1 | `accept_invite` | Email mismatch now raises the non-enumerating `Invitation does not belong to the authenticated user` message. |
| R2 | `mark_notification_read`, `mark_all_notifications_read` | Both bind `auth.uid()` and reject missing authentication before a mutation. A transactional no-session probe confirmed the guard. |
| R3 | `soft_delete_entity`, `restore_entity` | Explicit eight-entity allowlist, unsupported/immutable rejection, parameterized dynamic identifier handling, `ROW_COUNT` no-op return `false`, and no audit record on a no-op. |
| R4 | `reopen_client_deliverable` | Removed the invalid dead pre-load helper call; retained locked-row and loaded-project Admin/PM Lead authorization. |
| R5 | `recover_project_status` | Recovery target is restricted to `planning`, `in_progress`, or `paused`; terminal states remain exclusively in `transition_project_status`. |

## Live catalog verification

For every changed routine, the applied catalog preserves:

- postgres owner;
- `SECURITY DEFINER`;
- `search_path = pg_catalog, public`;
- no `PUBLIC` or `anon` execution;
- authenticated and service-role execution.

The live public-schema count is now:

```text
authenticated-executable SECURITY DEFINER routines: 18
PUBLIC-executable SECURITY DEFINER routines: 0
anon-executable SECURITY DEFINER routines: 0
```

The Advisor retains 18 `authenticated_security_definer_function_executable` notices. This is expected: the remaining user-facing trusted commands are intentionally authenticated-executable, and their routine-local authorization is now documented in the disposition audit. The Advisor cannot inspect that internal logic.

## Repository and type verification

- Focused M0-SD suites passed: **73 tests across 5 files**.
- `npm run typecheck` passed.
- Modified M0-SD source/tests passed ESLint and Prettier checks.
- `git diff --check` passed.
- Generated Supabase types are normalized-byte-identical to committed `src/lib/database.types.ts`.
  - SHA-256: `9a238e87d5e643af8ffb72fba0394d8bd91736ca7f6152adf181bfb7ac037c98`

## Full-suite limitation

A fresh local `npm run test` after application returned exit code 1 with 12 UI test files / 82 tests failing at test-runtime setup with `React.act is not a function` from `react-dom-test-utils.production.js`. The failing suites are unrelated to M0-SD and occur before their feature assertions. This contradicts Antigravity’s claimed full-suite pass; the actual local execution above is controlling evidence.

## Deferred configuration

Supabase Auth leaked-password protection remains explicitly deferred by the Project Owner. It is not remediated and is not an S07 prerequisite.

## Closure

M0-A, M0-B, M0-C, and the Section 3 SECURITY DEFINER disposition package are complete. No further security-remediation implementation decision is required before beginning S07 feature work.
