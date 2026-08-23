---
document_id: S07-M0-A-CLOSEOUT-01
sprint_id: S07
work_item: M0-A
status: completed
target_environment: jsf-pm-dev
migration_source: supabase/migrations/20260823083000_s07_m0_revoke_rls_auto_enable_execute.sql
applied_migration_name: 20260823083000_s07_m0_revoke_rls_auto_enable_execute
completed_at: 2026-08-23T12:16:21-06:00
---

# S07 M0-A — RLS Event-Trigger Reconciliation and Execute Revocation Closeout

## Outcome

M0-A is complete in `jsf-pm-dev`. The approved forward migration was refined from a revoke-only candidate into a replayable reconciliation migration, applied once, and verified through live catalog, Advisor, generated-type, targeted-test, and transactional behavior evidence.

## Source correction made

The pre-execution inspection established that the live `public.rls_auto_enable()` function and `ensure_rls` event trigger existed outside the repository migration chain. The final migration therefore:

1. canonically defines `public.rls_auto_enable()` as a `SECURITY DEFINER` event-trigger function with `search_path = pg_catalog`;
2. recreates the named `ensure_rls` trigger for `ddl_command_end` on `CREATE TABLE`, `CREATE TABLE AS`, and `SELECT INTO`;
3. explicitly revokes direct function execution from `public`, `anon`, and `authenticated`.

It changes no application table, data, RLS policy, application RPC contract, generated database type, or provider configuration.

## Live application evidence

The Supabase migration operation completed successfully and registered:

```text
20260823083000_s07_m0_revoke_rls_auto_enable_execute
```

The live post-application catalog reports:

| Property | Verified result |
| --- | --- |
| Function | `public.rls_auto_enable()` |
| Security mode | `SECURITY DEFINER` |
| Function owner | `postgres` |
| Search path | `pg_catalog` |
| ACL | `postgres=X/postgres, service_role=X/postgres` |
| `authenticated` EXECUTE | `false` |
| `anon` EXECUTE | `false` |
| `public` EXECUTE | `false` |
| Event trigger | `ensure_rls` |
| Trigger event | `ddl_command_end` |
| Trigger status | enabled (`O`) |
| Trigger tags | `CREATE TABLE`, `CREATE TABLE AS`, `SELECT INTO` |
| Trigger owner | `postgres` |

## Behavior verification

A transaction-scoped test created `public.__s07_m0_a_rls_probe`, queried its catalog state, and rolled the transaction back.

- During the transaction, `relrowsecurity = true`, proving `ensure_rls` still enabled RLS after the privilege revocation.
- After rollback, `to_regclass('public.__s07_m0_a_rls_probe') is null` returned `true`; no probe table persisted.

## Security Advisor verification

The post-application Security Advisor does **not** report `public.rls_auto_enable()` in `authenticated_security_definer_function_executable` findings.

Remaining Advisor work is intentionally outside M0-A:

- move `citext` out of `public` through M0-B;
- resolve the direct authenticated access/design of `evaluate_notification_alerts` through M0-C;
- preserve the other business RPC findings because their authenticated execution is intentional and must be reviewed individually, not mass-revoked;
- decide Auth leaked-password protection separately.

## Generated-type and repository verification

- `mcp__supabase__generate_typescript_types` returned a schema representation that is normalized-byte-equivalent to `src/lib/database.types.ts`.
  - SHA-256: `9a238e87d5e643af8ffb72fba0394d8bd91736ca7f6152adf181bfb7ac037c98`
  - `rls_auto_enable` is absent from both generated and committed types, as expected for an `event_trigger` return type.
- `npm run test -- __tests__/database/schema-contract.test.ts` passed: 1 test file, 12 tests.
- `git diff --check` passed after the source/document changes.
- The full `npm run verify` stopped at `format:check` because 65 pre-existing repository files have Prettier violations. It did not reach lint, typecheck, build, test, coverage, or audit. M0-A files were not listed as formatting violations; Prettier does not provide a SQL parser for the migration file, so SQL formatting was checked by source review and successful database application.

## Closure

No decision is required for M0-A. It is complete. M0-B and M0-C remain separate pre-S07 gate items.
