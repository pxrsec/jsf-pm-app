---
document_id: S07-M0-A-PRECHECK-01
sprint_id: S07
work_item: M0-A
title: RLS Event-Trigger Execute Revocation — Antigravity Pre-Execution Inspection
status: ready-for-inspection
migration_source: supabase/migrations/20260823083000_s07_m0_revoke_rls_auto_enable_execute.sql
created: 2026-08-23
---

# S07 M0-A — RLS Event-Trigger Execute Revocation

## Purpose and required outcome

Inspect the repository comprehensively before any later manual migration application. Establish whether revoking direct `authenticated` execution of `public.rls_auto_enable()` can affect application runtime, migration replay, database tooling, test contracts, generated types, documentation, or other operational behavior.

The candidate migration is intentionally narrow:

```sql
begin;

revoke all on function public.rls_auto_enable() from public;
revoke all on function public.rls_auto_enable() from anon;
revoke all on function public.rls_auto_enable() from authenticated;

commit;
```

Its intended result is to remove direct user-role execution of an event-trigger function while preserving the `ensure_rls` DDL event trigger itself. This is a pre-execution inspection artifact. **Do not apply this migration, use credentials, modify generated types, modify the migration, or make any remote/database change.**

## Established evidence to validate, not assume

Read-only live catalog inspection already found:

- `public.rls_auto_enable()` returns `event_trigger`, is `SECURITY DEFINER`, and has `search_path = pg_catalog`.
- Its current ACL grants `EXECUTE` to `postgres`, `service_role`, and `authenticated`.
- The database has the enabled event trigger `ensure_rls`, firing on `ddl_command_end` for `CREATE TABLE`, `CREATE TABLE AS`, and `SELECT INTO`, using `rls_auto_enable()`.
- There is no ordinary table trigger dependency.
- Earlier repository source attempted `revoke all on function public.rls_auto_enable() from public, anon;`, but the current remote catalog still permits `authenticated` execution.
- Initial repository search found no application TypeScript/TSX RPC call or client wrapper named `rls_auto_enable`; it found the prior migration and a historical CHANGELOG statement only.

These facts are starting evidence, not a substitute for a complete repository inspection. If the repository contradicts any fact, stop and report the exact paths/lines and conflict.

## Verified preflight findings from the current repository inspection

### Verdict: source reconciliation is required before any later manual application

The repository confirms that `rls_auto_enable()` is **not an application runtime RPC**:

- no TypeScript or TSX application source references `rls_auto_enable`;
- the application RPC inventory contains lifecycle, delivery, comment, notification, and alert-evaluator calls but no RLS event-trigger invocation;
- OpenAPI has no operation for it;
- generated `src/lib/database.types.ts` has no consumer/call-site reference;
- the only repository text matches before this M0 work were the prior tightening migration and one historical CHANGELOG statement.

However, the inspection found a material source-of-truth defect that the current 11-line candidate migration cannot solve by itself:

1. Live `jsf-pm-dev` contains `public.rls_auto_enable()` and enabled event trigger `ensure_rls`.
2. The repository migration chain contains **no source definition** for either `public.rls_auto_enable()` or `ensure_rls`; a whole-repository search found no prior `CREATE EVENT TRIGGER`, event-trigger function body, or `pg_event_trigger_ddl_commands()` use.
3. `supabase/migrations/20260818170000_s02_e02_public_table_grants.sql:21,30` grants `EXECUTE` on all current and future public routines to `authenticated`. That explicit grant explains why `supabase/migrations/20260818172000_s02_e02_tighten_rls_auto_enable.sql:7`—which revokes only `public` and `anon`—did not remove `authenticated` execution.
4. A zero-to-current replay from the repository source does not recreate the live event-trigger object. On that clean replay, the candidate M0-A `REVOKE ... ON FUNCTION public.rls_auto_enable()` would fail because the function is absent.

Therefore, **do not treat the current candidate migration as application-ready until the Project Owner selects the source-reconciliation treatment.** The minimum remediation is to make the repository migration chain define the canonical function/event-trigger object before or together with the privilege revoke, while preserving the exact live trigger semantics. A guard that merely skips the revoke when the function is absent is insufficient because it would preserve the replay drift.

### Exact affected artifacts identified now

| Path | Relevance | Required remediation / treatment |
| --- | --- | --- |
| `supabase/migrations/20260818143500_s02_e02_authoritative_data_platform.sql` | Canonical S02 schema source creates tables but does not define the live RLS event-trigger function/trigger. | Do not rewrite history casually. Reconcile the missing object through a forward source migration or an explicitly accepted source-reconciliation decision. |
| `supabase/migrations/20260818170000_s02_e02_public_table_grants.sql` | Explicitly grants all current public routines and default public routines to `authenticated`. | Preserve broad baseline only if intended, but M0-A must explicitly revoke this sensitive function after its canonical definition exists. Future sensitive public functions must have explicit privilege controls. |
| `supabase/migrations/20260818172000_s02_e02_tighten_rls_auto_enable.sql` | Prior remediation omitted the explicit `authenticated` grant. | Historical source remains immutable evidence. Its limitation is superseded by the new forward remediation; do not edit it. |
| `supabase/migrations/20260823083000_s07_m0_revoke_rls_auto_enable_execute.sql` | Candidate M0-A source. | Must be revised only after source-reconciliation treatment is decided so it is zero-to-current replayable and preserves `ensure_rls`. |
| `src/lib/database.types.ts` | Generated type artifact. | No type change is expected from a privilege/event-trigger reconciliation. Do not edit it. Determine regeneration only after a later actual applied schema result. |
| `src/lib/**` and `src/app/**` | Runtime RPC/route surface. | No direct caller was found; no app-code remediation is currently required. Re-run the search immediately before application because the worktree may change. |
| `__tests__/database/schema-contract.test.ts` | Current static database contract test checks tables/enums/views/RPCs but not the event trigger or its grant. | Add focused static source assertions only when the final canonical migration shape is accepted; do not claim live privilege proof from static tests. |
| `CHANGELOG.md` | Historical entry says the old migration revoked anon execution. | Preserve history. If M0-A is completed later, add a new factual entry that distinguishes explicit authenticated revoke and source reconciliation; do not rewrite the historical entry. |


### In scope

- Repository-only analysis of direct and indirect uses/dependencies of `public.rls_auto_enable()` and `ensure_rls`.
- A precise impact report listing every relevant file, symbol, SQL object, test, documentation record, migration-replay concern, and required remediation.
- Static validation of the candidate migration’s SQL intent, transaction scope, function signature, privilege target, idempotency expectations, and ordering within the current migration chain.
- Identification of tests/verification that must happen later after a separately authorized manual application.

### Out of scope

- Applying or simulating the migration against any remote/local database.
- Editing any SQL, TypeScript, generated database types, test, environment, deployment, provider, or configuration file.
- Running `supabase`, `psql`, `pg_dump`, database connections, migrations, resets, MCP mutation, dashboard operation, or credential-dependent command.
- Broad `SECURITY DEFINER` cleanup, citext relocation, evaluator-gate remediation, index changes, provider activation, or S07 feature work.

## Required inspection method

Use CodeGraph first for code/database-client references. Then perform broad repository searches, including SQL, TypeScript/TSX, JavaScript, test files, scripts, Markdown, YAML, JSON, package scripts, CI configuration, and all migration sources. Do not stop at an exact-string match: inspect semantic aliases and surrounding infrastructure.

### 1. Establish the exact database-object graph from repository source

Inspect every migration in chronological order and locate:

- the original creation of `public.rls_auto_enable()`;
- the `CREATE EVENT TRIGGER ensure_rls` declaration and its tags/events;
- every `ALTER FUNCTION`, `CREATE OR REPLACE FUNCTION`, `GRANT`, `REVOKE`, `ALTER DEFAULT PRIVILEGES`, `DROP EVENT TRIGGER`, `DROP FUNCTION`, or ownership change involving this function or event trigger;
- all DDL patterns that create public tables after the event trigger exists, including later migrations and test/migration harnesses;
- references to event-trigger return type, `pg_event_trigger_ddl_commands`, dynamic SQL, RLS auto-enablement, and public-schema DDL;
- privilege model/source ordering that could regrant `authenticated` after this new migration.

Do not infer that a `REVOKE FROM PUBLIC` covers every explicit role grant. Determine whether an explicit `authenticated` ACL exists in source, a later migration, or a source/application mismatch.

### 2. Inspect all possible runtime paths

Search beyond exact function names for:

- Supabase `.rpc(...)` calls and wrappers;
- REST/RPC route identifiers and OpenAPI operation names;
- database-type `Functions` entries and typed call sites;
- server actions, route handlers, API routes, scripts, seeds, test helpers, integration tests, MSW handlers, and command utilities;
- references to RLS enablement, table creation, schema bootstrap, migration execution, test database setup, and dynamic DDL;
- developer tooling that could invoke event triggers indirectly during table creation.

Classify each finding as one of: direct application runtime invocation, migration-time DDL dependency, test/tooling dependency, historical/documentation reference, generated artifact only, or unrelated textual match.

### 3. Inspect indirect breakage risk from removing `authenticated` EXECUTE

Determine whether PostgreSQL event-trigger execution requires the invoking DDL role to hold direct `EXECUTE` on the event-trigger function. Do not assume. Use authoritative repository evidence where available; if runtime behavior cannot be established without a controlled later database test, identify that exact verification as a post-application requirement rather than claiming certainty.

Specifically examine whether:

- the enabled `ensure_rls` event trigger continues to run for DDL performed by the migration/application service role after direct authenticated execution is revoked;
- any user-facing application path actually performs DDL (it should not);
- test or bootstrap workflows create tables while authenticated, service role, or another role is active;
- revocation would affect trigger ownership, function ownership, or `SECURITY DEFINER` semantics;
- a direct RPC call to an `event_trigger`-returning function is technically callable/meaningful or merely advisor-visible due to ACL.

### 4. Audit migration source quality

Review the new source file against the current migration convention and all adjacent security migrations. Confirm or report:

- filename ordering does not collide with an existing source;
- the function signature is exactly `public.rls_auto_enable()`;
- all three revoke statements target only direct execution grants and do not drop/alter the function, event trigger, RLS policies, tables, types, grants for unrelated functions, or schema;
- transaction use matches existing SQL migration convention;
- no generated database type update is logically required by a privilege-only migration;
- the migration remains replay-safe for a database where the grant is already absent;
- no later repository migration currently regrants `authenticated` execution.

If a source correction is necessary, report the smallest exact patch; do not make it.

### 5. Identify exact downstream artifacts and remediation

Your report must enumerate concrete paths, not categories. For each affected path, provide:

| Path | Why it is relevant | Impact classification | Required action before/after manual application |
| --- | --- | --- | --- |

At minimum, assess whether these are affected:

- `supabase/migrations/20260818143500_s02_e02_authoritative_data_platform.sql`
- `supabase/migrations/20260818172000_s02_e02_tighten_rls_auto_enable.sql`
- `supabase/migrations/20260823083000_s07_m0_revoke_rls_auto_enable_execute.sql`
- every later migration that can create a table or alter grants;
- `src/lib/database.types.ts`;
- database schema contract tests and migration tests;
- bootstrap scripts and any test-database/bootstrap tooling;
- `contracts/openapi/jsf-pm-api.openapi.yaml`;
- `CHANGELOG.md`;
- the S07 advisor assessment and S07 sprint plan;
- CI/package scripts and agent/developer documentation.

If an artifact is not affected, say so with the search/inspection basis. Do not create fake remediation work.

## Required report format

Write no repository changes. Return a factual inspection report with exactly these sections:

1. **Verdict:** `safe to proceed to manual application` | `blocked` | `needs source correction`.
2. **Object/dependency map:** function, ACL source, event trigger, ownership/trigger execution facts, and all discovered call paths.
3. **Runtime-RPC determination:** direct answer on whether it is a required application runtime RPC, with exact evidence.
4. **Migration replay/tooling impact:** every DDL/test/bootstrap concern and what proves it.
5. **Affected-artifact matrix:** all paths inspected, including explicit unaffected findings.
6. **Required remediation:** minimal exact changes, if any, separated into pre-application and post-application work.
7. **Later manual-application verification plan:** database privilege query, event-trigger/RLS creation behavior, Security Advisor result, focused repository tests, generated-type determination, and regression checks. Describe only what must be verified; do not include instructions to apply the migration.
8. **Stop conditions:** contradictions, later regrant, direct runtime caller, event-trigger failure risk, unexpected generated type change, or unrelated worktree changes.

## Acceptance criteria for this inspection

- The report demonstrates a full repository sweep, not a shallow exact-name search.
- It proves or explicitly bounds uncertainty around whether `rls_auto_enable()` is an application runtime RPC.
- It distinguishes direct RPC execution, DDL event-trigger execution, and migration/tooling behavior.
- Every claimed affected artifact has an exact path and evidence; every claimed unaffected artifact has a stated search/inspection basis.
- It proposes no remote operation and makes no repository modification.
- It does not broaden into M0-B, M0-C, index remediation, external-provider activation, or S07 feature work.
