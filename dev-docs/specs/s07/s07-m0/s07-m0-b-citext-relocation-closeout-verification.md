---
document_id: S07-M0-B-CLOSEOUT-01
sprint_id: S07
work_item: M0-B
status: completed
target_environment: jsf-pm-dev
migration_source: supabase/migrations/20260823100000_s07_m0_move_citext_to_extensions.sql
applied_migration_name: 20260823100000_s07_m0_move_citext_to_extensions
completed_at: 2026-08-23T13:02:35-06:00
---

# S07 M0-B — citext Relocation and Compatibility Verification Closeout

## Outcome

M0-B is complete in `jsf-pm-dev`. The reviewed forward migration was applied once and moved `citext` 1.6 from the exposed `public` schema to `extensions` without data conversion, table rewrite, type generation drift, or application-code refactor.

## Migration contract completed

`supabase/migrations/20260823100000_s07_m0_move_citext_to_extensions.sql`:

1. ensures `extensions` exists and preserves `USAGE` for `anon`, `authenticated`, and `service_role`;
2. performs `ALTER EXTENSION citext SET SCHEMA extensions`;
3. recompiles `public.accept_invite(bytea)` with `v_user_email extensions.citext` while preserving its public RPC signature, `SECURITY DEFINER` posture, owner, hardened `search_path = pg_catalog, public`, and existing ACL.

No application source, API contract, test fixture, RLS policy, table definition, column conversion, data migration, index rebuild, or generated database type was required.

## Live verification evidence

| Check | Verified result |
| --- | --- |
| Remote migration registration | `20260823100000_s07_m0_move_citext_to_extensions` |
| citext version | `1.6` |
| citext schema | `extensions` |
| extension owner | `supabase_admin` |
| Schema usage | `anon`, `authenticated`, and `service_role` retain `USAGE` |
| `client_contacts.email` | `extensions.citext` |
| `invite_tokens.email` | `extensions.citext` |
| `accept_invite(bytea)` | `SECURITY DEFINER`, postgres-owned, same hardened search path and ACL |
| Explicit qualified declaration | present: `v_user_email extensions.citext` |
| public citext extension routines | `0` |
| Case-insensitive semantics | all 3 current client contacts match `upper(email)::extensions.citext` |

## Advisor and generated-type verification

- The post-application Supabase Security Advisor no longer returns `extension_in_public` for `citext`.
- Remaining advisor findings are intentionally outside M0-B: business-RPC `SECURITY DEFINER` findings, the M0-C evaluator-gate issue, and leaked-password protection.
- `mcp__supabase__generate_typescript_types` is normalized-byte-equivalent to committed `src/lib/database.types.ts`.
  - SHA-256: `9a238e87d5e643af8ffb72fba0394d8bd91736ca7f6152adf181bfb7ac037c98`
  - Affected database fields remain TypeScript `string`.

## Repository verification

- `npm run typecheck` passed.
- `npm run test -- __tests__/database/schema-contract.test.ts __tests__/auth/negative-path.test.ts __tests__/auth/complete-invite.test.ts` passed: 3 files, 38 tests.
- `git diff --check` passed.

## Refactor determination

**No Antigravity refactor is required.** The only necessary compatibility update was already contained in the applied migration: qualifying the `accept_invite` local variable as `extensions.citext`. Runtime routes, client-contact queries, bootstrap tooling, API contract, tests, and generated types require no change.

## Closure

No Project Owner decision is required for M0-B. M0-C and Auth leaked-password protection remain separate pre-S07 security items.
