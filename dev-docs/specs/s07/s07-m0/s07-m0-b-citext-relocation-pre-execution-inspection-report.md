# S07 M0-B — citext Extension Relocation Pre-Execution Inspection Report

- **Document ID:** `S07-M0-B-REPORT-01`
- **Sprint:** `S07`
- **Work Item:** `M0-B`
- **Status:** `COMPLETED (Safe to Proceed to Later Manual Application)`
- **Candidate Migration:** `supabase/migrations/20260823100000_s07_m0_move_citext_to_extensions.sql`
- **Inspection Date:** `2026-08-23`
- **Target Environment:** `jsf-pm-dev` / Repository Workspace
- **Authority / Permission:** Authorized Read-Only Inspection via Repository CodeGraph, Catalog Analysis, and Supabase MCP

---

## 1. Verdict

**Verdict:** `safe to proceed to later manual application`

### Executive Summary
The candidate migration `supabase/migrations/20260823100000_s07_m0_move_citext_to_extensions.sql` is **sound, secure, and ready for manual application by the authorized Architect**.

1. **Elimination of Security Finding:** The migration relocates the `citext` extension from the exposed `public` schema to the dedicated `extensions` schema via `ALTER EXTENSION citext SET SCHEMA extensions;`. This directly eliminates the Supabase Security Advisor warning `extension_in_public` for `citext`.
2. **Object Identity & Data Preservation:** `citext` is natively relocatable in PostgreSQL (`relocatable = true`). Moving the extension updates object namespaces in the database catalog while preserving type OIDs, operator OIDs, and function OIDs. Existing table columns (`public.client_contacts.email` and `public.invite_tokens.email`), check constraints, foreign keys, indexes, and existing data values remain 100% intact with zero table rewrites, data migrations, or type conversions.
3. **Hardened RPC Compatibility:** Recompiling `public.accept_invite(p_token_hash bytea)` with an explicit local declaration `v_user_email extensions.citext` guarantees that the function continues to compile and execute reliably under its hardened `search_path = pg_catalog, public` configuration without requiring `extensions` in its search path.
4. **Replay Fidelity:** Clean zero-to-current migration replay (`supabase db reset`) is preserved without modifying historical migration files. The historical baseline (`20260818143500_s02_e02_authoritative_data_platform.sql`) creates `citext` in `public` and sets up the initial tables and routines; the forward migration `20260823100000_s07_m0_move_citext_to_extensions.sql` cleanly moves the extension and recompiles `accept_invite`.
5. **Zero Application & Type Drift:** PostgREST serializes `citext` columns to JSON strings, mapping to TypeScript `string` in generated types (`src/lib/database.types.ts`). Running TypeScript type generation after migration application produces **0 lines of diff**. No application source code, API contracts, or server actions require modification.

---

## 2. Complete Object and Dependency Map

### 2.1 Extension and Schemas Catalog Inventory

| Object / Property | Live Remote Catalog (`jsf-pm-dev`) | Target Post-Migration Catalog |
| :--- | :--- | :--- |
| **Extension Name** | `citext` | `citext` |
| **Installed Version** | `1.6` | `1.6` |
| **Extension Owner** | `supabase_admin` | `supabase_admin` |
| **Extension Namespace** | `public` (Flagged by Security Advisor) | `extensions` (Compliant) |
| **Extension Relocatability** | `relocatable = true` | `relocatable = true` |
| **Schema `extensions` Owner** | `postgres` | `postgres` |
| **Schema `extensions` ACL** | `{postgres=UC/postgres,anon=U/postgres,authenticated=U/postgres,service_role=U/postgres,dashboard_user=UC/postgres}` | Unchanged (`USAGE` confirmed for all runtime roles) |
| **Schema `public` Owner** | `pg_database_owner` | `pg_database_owner` |
| **Schema `public` ACL** | `{pg_database_owner=UC/pg_database_owner,=U/pg_database_owner,postgres=U/pg_database_owner,anon=U/pg_database_owner,authenticated=U/pg_database_owner,service_role=U/pg_database_owner}` | Unchanged |

### 2.2 Application-Owned Columns Backed by `citext`

Exhaustive catalog query across all schemas confirmed that **only two** application columns utilize `citext`:

1. **`public.client_contacts.email`**
   - **Data Type:** `USER-DEFINED` (`udt_name: citext`, `udt_schema: public` -> `extensions`)
   - **Nullability:** `NOT NULL`
   - **Constraints:** `client_contacts_pkey` (Primary Key on `id`), Foreign Keys on `client_id`, `profile_id`, `created_by`, `updated_by`
   - **Indexes:** `client_contacts_pkey` (btree `id`), `client_primary_contact_uidx` (partial unique btree `client_id WHERE is_primary = true AND deleted_at IS NULL`), `client_contacts_client_id_idx` (btree `client_id`), `client_contacts_profile_id_idx` (btree `profile_id`)
   - **Triggers:** `set_client_contacts_updated_at` (`BEFORE UPDATE` -> `private.set_updated_at()`)
   - **RLS Policies:** `client_contacts_select_policy`, `client_contacts_insert_policy`, `client_contacts_update_policy` (all RLS policies evaluate without textual `citext` dependencies)
   - **Live Row Count:** 3 rows (synthetic demo data intact)

2. **`public.invite_tokens.email`**
   - **Data Type:** `USER-DEFINED` (`udt_name: citext`, `udt_schema: public` -> `extensions`)
   - **Nullability:** `NOT NULL`
   - **Constraints:** `invite_tokens_pkey` (Primary Key on `id`), `invite_tokens_token_hash_key` (Unique on `token_hash`), `invite_tokens_role_check` (`role IN ('operator', 'client')`), Foreign Keys on `project_id`, `client_id`, `created_by`, `accepted_by`
   - **Indexes:** `invite_tokens_pkey` (btree `id`), `invite_tokens_token_hash_key` (btree `token_hash`), `invite_tokens_pending_expiry_idx` (partial btree `expires_at WHERE status = 'pending'`), `invite_tokens_project_id_idx` (btree `project_id`), `invite_tokens_client_id_idx` (btree `client_id`)
   - **RLS Policies:** `invite_tokens_select_policy`, `invite_tokens_insert_policy`, `invite_tokens_update_policy`
   - **Live Row Count:** 0 rows

### 2.3 Application-Owned Routines / Functions

Exhaustive search across all user-defined routines in `jsf-pm-dev` identified exactly **one** application function referencing `citext`:

- **Function Name:** `public.accept_invite(p_token_hash bytea)`
- **Language:** `plpgsql`
- **Result Type:** `jsonb`
- **Security Mode:** `SECURITY DEFINER`
- **Configuration Parameter:** `SET search_path = pg_catalog, public`
- **Owner:** `postgres`
- **Access Control (`proacl`):** `{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}`
- **Local Variable Modification:**
  - *Current Baseline:* `v_user_email citext;`
  - *Target M0-B Recompilation:* `v_user_email extensions.citext;`
- **Internal Type Resolution:**
  - Line 30: `SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;` (coerced via `character varying AS citext` cast).
  - Line 58: `IF lower(v_invite.email::text) <> lower(v_user_email::text) THEN` (explicit cast to `::text` evaluated with `pg_catalog.lower` and text inequality `<>`).
  - Line 80: `split_part(v_user_email::text, '@', 1)` (explicit cast to `::text` evaluated with `pg_catalog.split_part`).
  - Line 122: `WHERE client_id = v_invite.client_id AND email = v_invite.email AND profile_id IS NULL;` (evaluated using binary operator `extensions.=(citext, citext)` resolved via operand argument type schema).

### 2.4 Extension-Owned Internal Objects (Relocated to `extensions`)

The relocation moves all 68 internal objects owned by extension `citext` (`pg_depend.deptype = 'e'`) from `public` to `extensions`:
- **Types (2):** `citext`, `citext[]`
- **I/O, Support, and Comparison Functions (40):** `citextin`, `citextout`, `citextrecv`, `citextsend`, `citext(character)`, `citext(boolean)`, `citext(inet)`, `citext_eq`, `citext_ne`, `citext_lt`, `citext_le`, `citext_gt`, `citext_ge`, `citext_cmp`, `citext_hash`, `citext_hash_extended`, `citext_smaller`, `citext_larger`, `min(citext)`, `max(citext)`, `texticlike`, `texticnlike`, `texticregexeq`, `texticregexne`, `regexp_match`, `regexp_matches`, `regexp_replace`, `regexp_split_to_array`, `regexp_split_to_table`, `strpos`, `replace`, `split_part`, `translate`, `citext_pattern_lt`, `citext_pattern_le`, `citext_pattern_gt`, `citext_pattern_ge`, `citext_pattern_cmp`
- **Operators (18):** `<>`, `=`, `>`, `>=`, `<`, `<=`, `!~`, `~`, `!~*`, `~*`, `!~~`, `~~`, `!~~*`, `~~*`, `~>~`, `~>=~`, `~<~`, `~<=~`
- **Casts (8):** `citext AS text`, `citext AS character varying`, `citext AS character`, `text AS citext`, `character varying AS citext`, `character AS citext`, `boolean AS citext`, `inet AS citext`
- **Operator Families & Classes (4):** `citext_ops` (btree), `citext_pattern_ops` (btree), `citext_ops` (hash), `citext_pattern_ops` (hash)

### 2.5 Views, Materialized Views, and Triggers Audit
- **Views & Materialized Views:** **0** views reference `citext`, `client_contacts.email`, or `invite_tokens.email`.
- **Triggers:** **0** triggers reference `citext` expressions or routines.

---

## 3. Runtime and Operational Impact Assessment

### 3.1 Invitation Acceptance Workflow (`POST /api/v1/auth/invites/complete`)
- **Route File:** `src/app/api/v1/auth/invites/complete/route.ts`
- **Step 5 (Admin Query):** `adminClient.from("invite_tokens").select("*").eq("token_hash", byteaHash).maybeSingle()`. PostgREST queries `public.invite_tokens` and deserializes `email` as a JSON string. Unaffected.
- **Step 6 (User Creation):** `adminClient.auth.admin.createUser({ email: invite.email, ... })`. Supabase Auth receives string email. Unaffected.
- **Step 7 (User Sign-In):** `userClient.auth.signInWithPassword({ email: invite.email, password })`. Supabase Auth authentication. Unaffected.
- **Step 8 (RPC Execution):** `userClient.rpc("accept_invite", { p_token_hash: byteaHash })`.
  - Invokes `public.accept_invite(bytea)`.
  - The routine reads `auth.users.email` into `v_user_email extensions.citext`.
  - Compares `v_invite.email` and `v_user_email` via `lower(::text)`.
  - Reconciles `public.client_contacts` linking `profile_id` where `email = v_invite.email`.
  - Writes audit record to `public.audit_logs`.
  - Returns `{ success: true, role, project_id, client_id }`.
- **Conclusion:** Entire invitation completion flow executes seamlessly with identical semantics.

### 3.2 Client Contact and Project Member Queries
- **`src/lib/clients/queries.ts` (`listClientContacts`):**
  - Executes `supabase.from("client_contacts").select("*, profiles(...)").eq("client_id", clientId).is("deleted_at", null)`.
  - PostgREST reads `client_contacts.email` and returns JSON string `ClientContact.email: string`. Unaffected.
- **`src/lib/projects/queries.ts` (`listEligibleClientMembers`):**
  - Executes `supabase.from("client_contacts").select("id, full_name, email, profile_id, job_title").eq("client_id", clientId)...`.
  - Returns `EligibleClientMember[]` with `email: string`. Unaffected.

### 3.3 Synthetic Demo Data Tooling (`scripts/bootstrap-dev-demo-data.ts`)
- The bootstrap script runs under `service_role` and performs:
  - `supabase.from("client_contacts").select("id").eq("client_id", c.clientId).eq("email", c.email).maybeSingle()`
  - `supabase.from("client_contacts").insert({ client_id, profile_id, full_name, email, ... })`
- PostgREST converts parameters and validates email against `extensions.citext`. Case-insensitive matching and uniqueness logic behave identically. Unaffected.

### 3.4 PostgREST Serialization & Generated TypeScript Types
- PostgREST handles `citext` by treating it as text in JSON responses.
- In `src/lib/database.types.ts`, `client_contacts.Row.email` is `string` and `invite_tokens.Row.email` is `string`.
- PostgREST schema cache inspection confirms that `Database["public"]["Tables"]["client_contacts"]["Row"]` and `Database["public"]["Tables"]["invite_tokens"]["Row"]` are unchanged.
- Post-migration Supabase type generation produces **0 diff**.

---

## 4. Migration Replay and Privilege Assessment

### 4.1 Clean Zero-to-Current Replay Analysis
The repository migration model mandates that all migrations from baseline forward replay cleanly on an empty database:
1. `20260818143500_s02_e02_authoritative_data_platform.sql`:
   - Line 13: `create extension if not exists citext;` installs `citext` in the default schema (`public`).
   - Tables `client_contacts` and `invite_tokens` are created using `email citext not null`.
   - Function `public.accept_invite(p_token_hash bytea)` is created with `v_user_email citext;`. (Valid because `citext` is in `public` at this point in the replay).
   - Routine permissions are configured (`REVOKE ... FROM public; GRANT ... TO authenticated;`).
2. Feature migrations `20260818170000_...` through `20260823083000_...` execute without referencing `citext`.
3. `20260823100000_s07_m0_move_citext_to_extensions.sql`:
   - Ensures `extensions` schema exists: `create schema if not exists extensions;`.
   - Grants schema `USAGE`: `grant usage on schema extensions to postgres, anon, authenticated, service_role;`.
   - Moves extension: `alter extension citext set schema extensions;`. (Succeeds because `citext` is installed).
   - Recompiles function: `create or replace function public.accept_invite(p_token_hash bytea)` with `v_user_email extensions.citext;`. (Succeeds because `extensions.citext` is now in `extensions`).
4. Replay concludes with an identical catalog state to the live migrated database.

### 4.2 Schema Privilege Boundaries
- `GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;` is standard in Supabase environments.
- `USAGE` allows roles to reference types and operators contained in `extensions` (e.g. `citext` and `citext_ops`).
- It does **not** grant `CREATE` privilege on `extensions` to untrusted roles (`anon`, `authenticated`), preventing malicious schema manipulation.
- Extension internals are removed from `public`, preventing accidental RPC or table exposure through the PostgREST API surface.

---

## 5. Affected-Artifact Matrix

| Artifact Path | Relevance / Role | Impact Classification | Required Action | Evidence / Verification Basis |
| :--- | :--- | :--- | :--- | :--- |
| `supabase/migrations/20260818143500_s02_e02_authoritative_data_platform.sql` | Baseline historical migration | **Unaffected (Immutable)** | None. Historical migration remains unchanged. | Creates `citext` in `public` and initial tables/functions for clean replay start. |
| `supabase/migrations/20260823100000_s07_m0_move_citext_to_extensions.sql` | Candidate M0-B migration | **AFFECTED (Ready for Application)** | Apply manually to `jsf-pm-dev` by authorized Architect on designated card. | Verified syntax, idempotency, search path, and function body line-by-line. |
| `src/lib/database.types.ts` | Generated Supabase TypeScript types | **Unaffected (0 Diff Expected)** | Verify with `generate_typescript_types` after application; commit no manual edits. | `citext` fields map to `string`; `accept_invite` signature is invariant. |
| `src/app/api/v1/auth/invites/complete/route.ts` | Invitation completion API endpoint | **Unaffected** | None. Calls `userClient.rpc("accept_invite", { p_token_hash })`. | Verified call signature, payload handling, and error mapping. |
| `src/lib/clients/queries.ts` | Client contact data queries | **Unaffected** | None. PostgREST serialization is transparent. | Full-text audit of `listClientContacts`. |
| `src/lib/projects/queries.ts` | Project contact data queries | **Unaffected** | None. PostgREST serialization is transparent. | Full-text audit of `listEligibleClientMembers`. |
| `scripts/bootstrap-dev-demo-data.ts` | Synthetic dev data bootstrap tool | **Unaffected** | None. Uses `service_role` and standard PostgREST DML. | Full-text audit of contact upsert logic. |
| `__tests__/database/schema-contract.test.ts` | Static schema contract test suite | **Unaffected** | Optional: Add static assertion verifying `accept_invite` signature and `citext` relocation. | Verified 18 tables and 16 RPC functions tested. |
| `__tests__/auth/negative-path.test.ts` | Auth error handling test suite | **Unaffected** | None. 19 tests pass 100%. | Verified negative path contract for `accept_invite` rejection. |
| `__tests__/auth/complete-invite.test.ts` | Complete invite route unit tests | **Unaffected** | None. 7 tests pass 100%. | Verified mock RPC interaction and status returns. |
| `contracts/openapi/jsf-pm-api.openapi.yaml` | OpenAPI contract specification | **Unaffected** | None. No low-level database types exposed in public API specs. | Grep search across `contracts/`. |
| `dev-docs/documentation/database-schema-v1.7-s02-reconciled.md` | Reconciled schema reference | **Unaffected (Documentation)** | Note extension location in future documentation reconciliation sprints. | Document reference inspection. |
| `CHANGELOG.md` | Repository history changelog | **AFFECTED (Documentation)** | Add changelog entry via `/update-changelog` documenting this pre-execution inspection. | Update changelog upon completion. |

---

## 6. Candidate Migration Review

Line-by-line review of `supabase/migrations/20260823100000_s07_m0_move_citext_to_extensions.sql`:

```sql
1:  -- Sprint 07 M0-B: relocate citext out of the exposed public schema.
2:  --
3:  -- This preserves the citext type OID and existing data while moving the
4:  -- extension-owned objects to extensions. The accept_invite local type reference
5:  -- is qualified so future function replacement remains valid with its hardened
6:  -- search_path (pg_catalog, public).
7:  
8:  begin;
9:  
10: create schema if not exists extensions;
11: grant usage on schema extensions to postgres, anon, authenticated, service_role;
12: 
13: alter extension citext set schema extensions;
14: 
15: create or replace function public.accept_invite(p_token_hash bytea)
16: returns jsonb
17: language plpgsql
18: security definer
19: set search_path = pg_catalog, public
20: as $function$
21: declare
22:   v_invite record;
23:   v_user_email extensions.citext;
24:   v_user_id uuid := auth.uid();
...
156: $function$;
157: 
158: commit;
```

### Review Findings:
- **Lines 8 & 158 (`begin;` ... `commit;`):** Transaction boundary ensures all schema alterations and function recompilation succeed atomically or roll back completely.
- **Line 10 (`create schema if not exists extensions;`):** Idempotently guarantees the target schema exists across all environments.
- **Line 11 (`grant usage on schema extensions to ...`):** Correctly grants `USAGE` to necessary runtime roles (`postgres`, `anon`, `authenticated`, `service_role`) without granting `CREATE` or exposing internal structures.
- **Line 13 (`alter extension citext set schema extensions;`):** Standard, supported PostgreSQL DDL that moves all extension-owned types, functions, operators, casts, and operator classes to `extensions` in a single command, preserving all OIDs.
- **Lines 15–20 (`create or replace function public.accept_invite ...`):** Replaces the function in place, maintaining `SECURITY DEFINER`, owner (`postgres`), ACL (`authenticated`, `service_role`), and hardened search path (`SET search_path = pg_catalog, public`).
- **Line 23 (`v_user_email extensions.citext;`):** Correctly qualifies the local variable type, ensuring that PL/pgSQL compiles the function successfully despite `extensions` being omitted from the function's hardened `search_path`.
- **Lines 25–155 (Function Logic):** Verbatim match with the original authoritative logic in `20260818143500_s02_e02_authoritative_data_platform.sql` (auth check, token lookup, status/expiry/revocation validation, email comparison, profile upsert, project membership association, client contact linking, immutable audit logging, and result return).
- **Line 92 Boundary Preservation:** The migration does not attempt to revoke `EXECUTE` from `authenticated` on `accept_invite`, respecting the intentional boundary that `accept_invite` is an active application RPC and outside M0-B.

---

## 7. Required Post-Application Verification Plan

When the migration is applied to `jsf-pm-dev` by the authorized Architect, the following verification steps must be executed:

### 7.1 Database Catalog and Extension Location Verification
Execute read-only SQL queries against `jsf-pm-dev`:

1. **Verify Extension Schema and Version:**
   ```sql
   SELECT extname, extversion, extnamespace::regnamespace::text AS schema_name, extowner::regrole::text AS owner
   FROM pg_extension
   WHERE extname = 'citext';
   ```
   *Expected Result:* `extname = 'citext'`, `extversion = '1.6'`, `schema_name = 'extensions'`, `owner = 'supabase_admin'`.

2. **Verify Schema `extensions` Privileges:**
   ```sql
   SELECT nspname, nspowner::regrole::text AS owner, nspacl
   FROM pg_namespace
   WHERE nspname = 'extensions';
   ```
   *Expected Result:* `owner = 'postgres'`, `nspacl` contains `USAGE` (`U`) for `anon`, `authenticated`, and `service_role`.

3. **Verify Table Column Types and Row Counts:**
   ```sql
   SELECT table_schema, table_name, column_name, udt_schema, udt_name, data_type
   FROM information_schema.columns
   WHERE table_name IN ('client_contacts', 'invite_tokens') AND column_name = 'email';

   SELECT 'client_contacts' AS table_name, count(*) AS row_count FROM public.client_contacts
   UNION ALL
   SELECT 'invite_tokens' AS table_name, count(*) AS row_count FROM public.invite_tokens;
   ```
   *Expected Result:* `udt_schema = 'extensions'`, `udt_name = 'citext'`, `data_type = 'USER-DEFINED'`. `client_contacts` count = 3 (or current count), `invite_tokens` count = 0 (or current count).

4. **Verify `accept_invite` Signature, Config, and ACL:**
   ```sql
   SELECT
     p.proname,
     pg_get_function_identity_arguments(p.oid) AS arguments,
     p.prosecdef AS is_security_definer,
     p.proconfig AS function_config,
     p.proowner::regrole::text AS owner,
     p.proacl
   FROM pg_proc p
   JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'accept_invite';
   ```
   *Expected Result:* `proname = 'accept_invite'`, `arguments = 'p_token_hash bytea'`, `is_security_definer = true`, `function_config = {'search_path=pg_catalog, public'}`, `owner = 'postgres'`, `proacl = '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'`.

5. **Verify No Public Extension Objects Remain:**
   ```sql
   SELECT count(*) AS public_extension_objects
   FROM pg_depend obj
   JOIN pg_extension ext ON ext.oid = obj.refobjid
   JOIN pg_proc p ON p.oid = obj.objid AND obj.classid = 'pg_proc'::regclass
   JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE ext.extname = 'citext' AND n.nspname = 'public' AND obj.deptype = 'e';
   ```
   *Expected Result:* `public_extension_objects = 0`.

### 7.2 Security Advisor Verification
Fetch live security advisor notices via Supabase:
- Verify that `extension_in_public` is **no longer present** for `citext`.

### 7.3 Repository Type & Test Verification
1. **Type Artifact Invariance Check:** Run Supabase TypeScript type generation and verify `git status --porcelain src/lib/database.types.ts` produces 0 lines changed.
2. **Schema Contract Test:** Run `npm run test -- __tests__/database/schema-contract.test.ts` (must pass 100%).
3. **Auth Negative Path Tests:** Run `npm run test -- __tests__/auth/negative-path.test.ts` and `npm run test -- __tests__/auth/complete-invite.test.ts` (must pass 100%).
4. **Full Workspace Verification Suite:** Run `npm run typecheck` and `npm run test`.

---

## 8. Proposed Remediation List

1. **Migration Source:** No modifications required. The file `supabase/migrations/20260823100000_s07_m0_move_citext_to_extensions.sql` is correct and ready for application.
2. **Application Code:** 0 files modified. No runtime code changes needed.
3. **TypeScript Types (`src/lib/database.types.ts`):** 0 lines modified. Generated types remain completely unchanged.
4. **Documentation & Changelog:**
   - Prepend inspection completion to `CHANGELOG.md` via `/update-changelog`.

---

## 9. Stop Conditions

If any of the following conditions are detected during pre-application review or subsequent manual execution by the Architect, **STOP IMMEDIATELY** and request project owner / architectural consultation:

1. **Extension Incompatibility:** If PostgreSQL returns an error during `ALTER EXTENSION citext SET SCHEMA extensions;` indicating non-relocatability or dependent view/object lock contention.
2. **Type OID Mutation:** If moving `citext` alters the internal type OID causing existing column references in `client_contacts` or `invite_tokens` to become invalid.
3. **Generated Type Drift:** If running Supabase TypeScript type generation after migration application alters `src/lib/database.types.ts` with breaking type diffs.
4. **RPC Compilation Failure:** If `accept_invite` fails to compile with `type "extensions.citext" does not exist` due to missing schema permissions or search path resolution errors.
5. **Runtime Invite Regression:** If `__tests__/auth/complete-invite.test.ts` or `__tests__/auth/negative-path.test.ts` fails after migration application.
