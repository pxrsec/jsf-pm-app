---
document_id: S07-M0-B-PRECHECK-01
sprint_id: S07
work_item: M0-B
title: citext Extension Relocation — Antigravity Pre-Execution Inspection
status: ready-for-inspection
migration_source: supabase/migrations/20260823100000_s07_m0_move_citext_to_extensions.sql
created: 2026-08-23
---

# S07 M0-B — citext Extension Relocation

## Objective

Perform a comprehensive repository-only inspection before any later decision to apply M0-B. The candidate migration moves the `citext` extension from the exposed `public` schema to `extensions`, preserves existing type/data identities, and recompiles `public.accept_invite(bytea)` with an explicit `extensions.citext` local-variable type.

The objective is to eliminate Supabase’s `extension_in_public` Security Advisor warning **without** breaking invite acceptance, case-insensitive email behavior, PostgREST serialization, table access, RLS, stored procedures, indexes/constraints, generated types, migration replay, or developer tooling.

**This is an inspection-only instruction. Do not apply the migration; do not connect to a database; do not use Supabase MCP, dashboard, CLI, credentials, `psql`, reset commands, or any remote operation. Do not edit migrations, application code, generated types, tests, config, or documentation. Return a factual report only.**

## Candidate migration under inspection

`supabase/migrations/20260823100000_s07_m0_move_citext_to_extensions.sql`

Its intended contract is:

1. ensure the `extensions` schema exists and retains `USAGE` for the existing relevant roles;
2. run `ALTER EXTENSION citext SET SCHEMA extensions`—not drop/recreate, cast/rewrite, or copy data;
3. preserve the `citext` type’s object identity, so existing `public.client_contacts.email` and `public.invite_tokens.email` values/constraints remain intact;
4. replace only `public.accept_invite(bytea)` so its local declaration becomes `v_user_email extensions.citext` while retaining its existing signature, owner/security mode, hardened `search_path = pg_catalog, public`, authorization behavior, result contract, and grants.

Do not assume this candidate is final. Identify every defect, missing guard, unsafe permission change, replay issue, or required companion refactor with exact evidence.

## Established starting evidence — validate independently

Read-only inspection before this brief found:

- Live `jsf-pm-dev` has `citext` 1.6 installed in `public`, owned by `supabase_admin`.
- Live `extensions` exists, is owned by `postgres`, and currently grants `USAGE` to `postgres`, `service_role`, `authenticated`, and `anon`.
- The only application-owned `citext` columns are `public.client_contacts.email` and `public.invite_tokens.email`.
- No database views, RLS policies, or constraints have an explicit `citext` textual definition.
- No application-defined function other than `public.accept_invite(bytea)` references `citext`; its current local variable is unqualified and its function `search_path` excludes `extensions`.
- `accept_invite` is a required authenticated application RPC, invoked from `src/app/api/v1/auth/invites/complete/route.ts`; it must remain callable and behaviorally identical.
- `src/lib/database.types.ts` represents the affected table fields as TypeScript `string`; a type diff is not expected but must be checked after a later authorized application.
- Historical source creates `citext` unqualified in `20260818143500_s02_e02_authoritative_data_platform.sql`, before creating both tables and `accept_invite`. The forward relocation must make a clean zero-to-current migration replay coherent without rewriting historical migration history.

## Non-negotiable boundaries

- No application, database, remote, provider, deployment, authentication, or configuration mutation.
- Do not drop/recreate `citext`, either affected table, or any column; do not convert email values to `text`; do not rebuild indexes opportunistically.
- Do not broaden `public` exposure, exposed schemas, default privileges, extension permissions, `SECURITY DEFINER` grants, or RLS policies.
- Do not alter M0-A, M0-C, query-index remediation, or S07 feature work.
- Do not treat a textual `citext` documentation mention as a code refactor without classifying its authority and need.
- Preserve `accept_invite` behavior and grant boundary. Do not respond by revoking `authenticated` execution, moving the RPC, or changing its authorization model.

## Mandatory investigation

Use CodeGraph first. Follow with broad repository searches across SQL, TypeScript/TSX/JavaScript, tests, scripts, documentation, contracts, CI/tooling, and configuration. Do not stop at exact-string matches. Search semantic relationships: email fields, invitation completion, type casts, function replacement, search paths, extension schema assumptions, exposed-schema configuration, generated types, and database bootstrap behavior.

### 1. Build the complete citext object/dependency inventory

Inspect every migration, especially the initial S02 platform migration and all later migrations. Determine and report:

- every `CREATE EXTENSION`, `ALTER EXTENSION`, `CREATE SCHEMA`, schema grant/revoke, default-privilege, and search-path declaration relevant to `public`, `extensions`, or `citext`;
- every table column, function argument/return/local declaration, cast, operator, index, constraint, policy, view/materialized view, trigger, generated expression, or dynamic SQL that uses—or will resolve—`citext`;
- all extension-owned objects versus application-owned dependencies; clearly separate extension internals from remediation work;
- whether `ALTER EXTENSION citext SET SCHEMA extensions` preserves type OID/data/index/constraint identity in the actual migration/replay model, or whether an application-owned object needs a forward refactor;
- whether any later migration recompiles/replaces `accept_invite` or introduces another unqualified `citext` reference after M0-B.

### 2. Trace every runtime and operational path affected by the two email columns

Inspect all use of `client_contacts.email` and `invite_tokens.email`, including:

- the invite-completion route, its authenticated RPC invocation, safe-error behavior, and its focused tests;
- client-contact queries, project queries, bootstrap/demo-data script, Admin/PM forms, schema validators, API handlers, fixtures, mocks, and integration tests;
- PostgREST selects/inserts/updates, generated `Database` types, API contracts, and serialization assumptions;
- case-insensitive equality, sorting, filtering, duplicate/uniqueness behavior, and any explicit `::text`, `lower(...)`, or `citext` operator use;
- any direct extension routine use or expectation that `citext` remains callable/qualified through `public`.

Classify each item as: runtime behavior, migration/replay source, test/fixture/tooling dependency, generated artifact, documentation-only reference, extension internal, or unrelated textual match.

### 3. Audit the candidate migration itself

Assess the migration line by line. Report whether it correctly:

- creates/uses `extensions` without changing unrelated schema privileges;
- preserves the necessary `USAGE` privilege for roles that must serialize/read/write existing citext-backed public data, without granting `CREATE` or exposing extension objects through `public`;
- moves the existing extension exactly once and is suitable for a zero-to-current replay;
- leaves existing column values, type OID, indexes, constraints, RLS policies, table ownership, and table grants intact;
- recompiles `public.accept_invite(bytea)` only because its local type must be schema-qualified after relocation;
- retains the exact `accept_invite` signature, security-definer posture, owner, `search_path`, ACL, authorization checks, return shape, transaction semantics, and meaningful behavior;
- avoids accidental changes to the security finding for `accept_invite`, which is intentionally outside M0-B;
- needs any additional source adjustment for historical migration replay or for future function replacement conventions.

If a source correction is needed, provide the smallest exact patch but do not make it.

### 4. Determine required post-application verification, not application steps

Specify exact validation queries/tests that a later authorized executor must run. At minimum, cover:

1. extension schema is `extensions`, not `public`;
2. `extensions` schema `USAGE` remains correct for the roles actually required;
3. `client_contacts.email` and `invite_tokens.email` resolve to `extensions.citext` and keep their row counts/data values unchanged;
4. `accept_invite(bytea)` retains its signature, owner/security/ACL/search-path contract and now uses an explicit `extensions.citext` declaration;
5. the invite-completion negative-path contract and related application behavior remain green;
6. generated TypeScript types are compared byte-for-byte rather than hand-edited;
7. the Security Advisor no longer reports `extension_in_public` for citext;
8. no unexpected public extension-owned type/function/operator objects remain;
9. migration replay adequacy is evaluated without rewriting historical source.

Do not run any of these checks against a database now. They belong in the report for later execution.

## Required report format

Return only a report with these sections:

1. **Verdict:** `safe to proceed to later manual application` | `needs source correction` | `blocked`.
2. **Complete object map:** extension, schemas, application-owned columns, function/RPC, extension internals, and every discovered dependency.
3. **Runtime impact assessment:** exact invite/contact workflows and whether any application-code refactor is required.
4. **Migration replay and privilege assessment:** historical source behavior, schema usage, function recompilation, and any clean-replay caveat.
5. **Affected-artifact matrix:** exact path, classification, evidence, and required action—including explicit unaffected findings.
6. **Candidate migration review:** line-level defects or confirmation.
7. **Required post-application verification plan:** queries, tests, generated-type comparison, Advisor result, and stop conditions only.
8. **Proposed remediation list:** smallest required source/test/documentation changes, with no speculative cleanup.

## Acceptance criteria

- Demonstrates a repository-wide and semantic inspection, not only a `citext` literal search.
- Separates extension implementation internals from application-owned dependencies.
- Proves or explicitly bounds the impact on `accept_invite`, invitation completion, client-contact access, case-insensitive email semantics, and generated types.
- Uses exact paths/evidence for every proposed change and for all claims of non-impact.
- Makes zero changes and performs zero database/remote actions.
