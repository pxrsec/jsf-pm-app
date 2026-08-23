# S07 M0-A — RLS Event-Trigger Execute Revocation Pre-Execution Inspection Report

- **Document ID:** `S07-M0-A-REPORT-01`
- **Sprint:** `S07`
- **Work Item:** `M0-A`
- **Status:** `COMPLETED (Needs Source Correction Before Application)`
- **Candidate Migration:** `supabase/migrations/20260823083000_s07_m0_revoke_rls_auto_enable_execute.sql`
- **Date:** `2026-08-23`
- **Target Environment:** `jsf-pm-dev` / Repository Workspace

---

## 1. Verdict

**Verdict:** `needs source correction`

### Executive Summary
The proposed privilege revocation in `supabase/migrations/20260823083000_s07_m0_revoke_rls_auto_enable_execute.sql` is logically correct in its security intent: it addresses the Supabase Security Advisor warning `authenticated_security_definer_function_executable` by revoking direct `EXECUTE` privileges on `public.rls_auto_enable()` from `public`, `anon`, and `authenticated`. Furthermore, `rls_auto_enable()` is **not** an application runtime RPC and is never invoked by client applications, server actions, route handlers, or background jobs.

However, **the migration must NOT be applied in its current state** because of an underlying repository source-of-truth defect:
1. **Missing Canonical Definition in Migration Chain:** Neither the function `public.rls_auto_enable()` nor the DDL event trigger `ensure_rls` is defined in any repository migration (`supabase/migrations/*.sql`).
2. **Replay Incompatibility:** On a clean, zero-to-current replay from repository migrations (e.g., `supabase db reset`), the candidate migration will fail with `ERROR: function public.rls_auto_enable() does not exist`. Additionally, the prior historical migration `supabase/migrations/20260818172000_s02_e02_tighten_rls_auto_enable.sql` suffers from the same replay defect.
3. **Remediation Requirement:** The candidate migration (or a dedicated predecessor forward migration) must define `public.rls_auto_enable()` and `ensure_rls` canonically with idempotent DDL before revoking the execution privileges, ensuring both remote catalog alignment and clean zero-to-current replayability.

---

## 2. Object and Dependency Map

### 2.1 Database Object Specifications (Live Catalog vs. Source)

| Property | Live Remote Catalog (`jsf-pm-dev`) | Repository Migration Chain (`supabase/migrations/`) |
| :--- | :--- | :--- |
| **Function Name** | `public.rls_auto_enable()` | Not defined in source (referenced only in `REVOKE` statements) |
| **Return Type** | `event_trigger` | Not defined in source |
| **Language** | `plpgsql` | Not defined in source |
| **Security Mode** | `SECURITY DEFINER` | Not defined in source |
| **Config (`search_path`)** | `pg_catalog` | Not defined in source |
| **Owner Role** | `postgres` | Not defined in source |
| **Current ACL (`proacl`)** | `{postgres=X/postgres, service_role=X/postgres, authenticated=X/postgres}` | `REVOKE ... FROM public, anon;` attempted in `20260818172000` |
| **Event Trigger** | `ensure_rls` | Not defined in source |
| **Trigger Event** | `ddl_command_end` | Not defined in source |
| **Trigger Tags** | `CREATE TABLE`, `CREATE TABLE AS`, `SELECT INTO` | Not defined in source |
| **Trigger Function** | `rls_auto_enable()` | Not defined in source |
| **Trigger Status** | Enabled (`evtenabled = 'O'`) | Not defined in source |
| **Trigger Owner** | `postgres` | Not defined in source |

### 2.2 Verbatim Function Definition (from Live Catalog)

```sql
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;
```

### 2.3 Privilege Origin and History

1. **`20260818143500_s02_e02_authoritative_data_platform.sql` (Initial Baseline):**
   - Created public tables and explicitly enabled RLS on all 18 tables.
   - Did not include DDL for `public.rls_auto_enable()` or `ensure_rls`.
2. **`20260818170000_s02_e02_public_table_grants.sql` (Root Cause of Grant):**
   - Line 21: `grant execute on all routines in schema public to authenticated;` explicitly granted `EXECUTE` on all public functions (including `rls_auto_enable`) to `authenticated`.
   - Line 30: `alter default privileges in schema public grant execute on routines to authenticated;` ensured that future functions would also grant `EXECUTE` to `authenticated`.
3. **`20260818172000_s02_e02_tighten_rls_auto_enable.sql` (Incomplete Prior Fix):**
   - Line 7: `revoke all on function public.rls_auto_enable() from public, anon;` revoked privileges from `public` and `anon`, but omitted `authenticated`.
   - As a consequence, `authenticated` retained `EXECUTE` in `proacl`.
4. **`20260823083000_s07_m0_revoke_rls_auto_enable_execute.sql` (Candidate S07 M0-A Migration):**
   - Lines 7–9: Attempts to revoke from `public`, `anon`, and `authenticated`.

### 2.4 Call Paths and Dependencies
- **Trigger Dependency:** Internal PostgreSQL engine hook on `ddl_command_end` -> executes `ensure_rls` -> invokes `public.rls_auto_enable()`.
- **Table Trigger Dependencies:** 0 (no row-level or statement-level table triggers reference `rls_auto_enable`).
- **Application Runtime Invocations:** 0 (no TypeScript, TSX, JS, or API route references).

---

## 3. Runtime-RPC Determination

### Direct Determination
**`public.rls_auto_enable()` is NOT an application runtime RPC.** It is an internal database DDL event-trigger function and must never be exposed to or executed by authenticated users or public clients.

### Complete Verifiable Evidence
1. **Application Source Code Audit:**
   A full-text search across all application code (`src/**/*.ts`, `src/**/*.tsx`) identified **zero** references to `rls_auto_enable` or `ensure_rls`.
2. **Runtime Supabase RPC Inventory:**
   An exhaustive audit of all `supabase.rpc(...)` invocations across the workspace confirmed that runtime RPC calls are strictly confined to the 18 authorized operational functions:
   - `src/lib/projects/commands.ts`: `soft_delete_entity`, `restore_entity`, `transition_project_status`, `recover_project_status`, `transition_task_status`
   - `src/lib/notifications/queries.ts`: `list_my_in_app_notifications`
   - `src/lib/notifications/operations-queries.ts`: `list_suppressed_notification_operations`
   - `src/lib/notifications/alert-evaluator.ts`: `evaluate_notification_alerts`
   - `src/lib/notifications/actions.ts`: `mark_notification_read`, `mark_all_notifications_read`
   - `src/lib/deliverables/commands.ts`: `submit_deliverable_version`, `submit_client_deliverable`, `review_deliverable`, `mark_deliverable_delivered`, `report_broken_link`
   - `src/lib/comments/commands.ts`: `create_collaboration_comment`
   - `src/app/api/v1/auth/invites/complete/route.ts`: `accept_invite`
3. **OpenAPI Specification (`contracts/openapi/jsf-pm-api.openapi.yaml`):**
   Contains zero endpoints, operations, or schemas referencing `rls_auto_enable`.
4. **Generated Type Definitions (`src/lib/database.types.ts`):**
   `rls_auto_enable` is not present under `Database["public"]["Functions"]`. (PostgREST schema cache omits `event_trigger` return types from RPC discovery).
5. **Database Contract Tests (`__tests__/database/schema-contract.test.ts`):**
   Lines 271–288 define the canonical list of 16 S02 public RPC functions. `rls_auto_enable` is correctly absent from this contract.
6. **Technical Non-Callability:**
   Functions returning `event_trigger` in PostgreSQL cannot be called via standard SQL (`SELECT public.rls_auto_enable()`) or PostgREST RPC requests; doing so results in a database error (`ERROR: cannot return event_trigger in simple SQL call`). The Security Advisor flags the function solely because `proacl` grants `EXECUTE` on a `SECURITY DEFINER` routine to `authenticated`.

---

## 4. Migration Replay and Tooling Impact

### 4.1 PostgreSQL Event-Trigger Invocation Mechanics
- In PostgreSQL, event triggers are executed automatically by the core DDL execution engine when a triggering command terminates.
- The invoking role (the role executing `CREATE TABLE`) does **not** need direct SQL `EXECUTE` privileges on the event trigger function.
- Because `public.rls_auto_enable()` is defined with `SECURITY DEFINER` and owned by `postgres`, it executes with superuser/owner privileges regardless of the active DDL user role.
- **Conclusion:** Revoking `EXECUTE` from `authenticated`, `anon`, and `public` will **not** prevent `ensure_rls` from firing during legitimate migration DDL operations.

### 4.2 Application DDL Impossibility
The application runtime (Next.js server actions, route handlers, background tasks) performs only DML queries (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) and authorized RPC calls under RLS. No application user role or API route possesses permissions to execute `CREATE TABLE`, `CREATE TABLE AS`, or `SELECT INTO`.

### 4.3 Demo Bootstrap Script (`scripts/bootstrap-dev-demo-data.ts`)
The demo data bootstrap script connects using `service_role` and performs purely idempotent DML insertions and Supabase Auth administrative calls. It performs no DDL and does not invoke `rls_auto_enable()`.

### 4.4 Migration Replay Defect (Detailed Analysis)
- If a clean zero-to-current replay is executed on a blank database:
  - `20260818143500_s02_e02_authoritative_data_platform.sql` executes without creating `public.rls_auto_enable()`.
  - `20260818172000_s02_e02_tighten_rls_auto_enable.sql` attempts `REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM public, anon;` -> **FAILS** (`ERROR: function public.rls_auto_enable() does not exist`).
  - `20260823083000_s07_m0_revoke_rls_auto_enable_execute.sql` attempts `REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM ...` -> **FAILS** (`ERROR: function public.rls_auto_enable() does not exist`).
- **Conclusion:** Applying a bare `REVOKE` migration without establishing the canonical object definition in the migration chain perpetuates the drift between live database state and migration history.

---

## 5. Affected-Artifact Matrix

| Artifact Path | Relevance / Role | Impact Classification | Required Action | Search / Inspection Basis |
| :--- | :--- | :--- | :--- | :--- |
| `supabase/migrations/20260818143500_s02_e02_authoritative_data_platform.sql` | Canonical S02 schema baseline | **Unaffected (Historical)** | None. Historical migration remains immutable. | Code review: creates tables with explicit RLS enablement; does not define trigger function. |
| `supabase/migrations/20260818170000_s02_e02_public_table_grants.sql` | Grants routines to `authenticated` | **Unaffected (Historical)** | None. Explains root cause of `authenticated` grant. Historical source remains immutable. | Code review: lines 21 and 30 grant `execute on all routines in schema public to authenticated`. |
| `supabase/migrations/20260818172000_s02_e02_tighten_rls_auto_enable.sql` | Prior partial tightening | **Unaffected (Historical)** | None. Historical source remains immutable. | Code review: line 7 revoked `public, anon` only. |
| `supabase/migrations/20260823083000_s07_m0_revoke_rls_auto_enable_execute.sql` | Candidate M0-A migration source | **AFFECTED (Needs Revision)** | Revise to include canonical function and event trigger DDL before `REVOKE` statements. | Syntax and replay analysis: bare revoke fails on clean replay. |
| Later migrations (`20260819140000_...` to `20260822170000_...`) | Subsequent feature migrations | **Unaffected** | None. No later migration alters event triggers or regrants `rls_auto_enable`. | Grep analysis across all 16 migration files. |
| `src/lib/database.types.ts` | Generated Supabase TypeScript types | **Unaffected** | None. Functions returning `event_trigger` are not generated in types; no diff expected. | Verified lines 1694–1839: `rls_auto_enable` is not present. |
| `src/lib/**` and `src/app/**` | Application runtime codebase | **Unaffected** | None. Zero runtime call sites. | Full-text grep and CodeGraph exploration across `src/`. |
| `contracts/openapi/jsf-pm-api.openapi.yaml` | Public API specification | **Unaffected** | None. No endpoints reference `rls_auto_enable`. | Grep search in `contracts/`. |
| `__tests__/database/schema-contract.test.ts` | Static schema contract test suite | **AFFECTED (Post-reconciliation)** | Optional: Add static assertion verifying `public.rls_auto_enable()` privilege revocation once migration is finalized. | Test file analysis: currently tests 18 tables, 22 enums, 9 views, 16 RPCs. |
| `scripts/bootstrap-dev-demo-data.ts` | Synthetic dev data bootstrap tool | **Unaffected** | None. Uses `service_role` and performs only DML insertions. | Code review of `scripts/bootstrap-dev-demo-data.ts`. |
| `CHANGELOG.md` | Repository history changelog | **AFFECTED (Documentation)** | Add changelog entry via `/update-changelog` documenting this pre-execution inspection. | Changelog analysis: historical line 652 records prior fix. |
| `dev-docs/documentation/database-schema-v1.7-s02-reconciled.md` | Reconciled schema reference | **Unaffected** | None. Document tracks table schemas, views, and RLS policies. | Grep search in `dev-docs/documentation/`. |

---

## 6. Required Remediation

### 6.1 Pre-Application Remediation (Source Correction)
Before any manual application to `jsf-pm-dev`, the migration source `supabase/migrations/20260823083000_s07_m0_revoke_rls_auto_enable_execute.sql` should be updated to establish the canonical function and event trigger before revoking privileges.

**Recommended Minimal Migration Source Patch:**

```sql
-- Sprint 07 M0-A: Reconcile canonical RLS event trigger and revoke direct runtime execution.
-- Scope: Object reconciliation and privilege correction.

begin;

-- 1. Ensure canonical definition of rls_auto_enable function
create or replace function public.rls_auto_enable()
 returns event_trigger
 language plpgsql
 security definer
 set search_path to 'pg_catalog'
as $function$
declare
  cmd record;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table','partitioned table')
  loop
     if cmd.schema_name is not null and cmd.schema_name in ('public') and cmd.schema_name not in ('pg_catalog','information_schema') and cmd.schema_name not like 'pg_toast%' and cmd.schema_name not like 'pg_temp%' then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception
        when others then
          raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
     else
        raise log 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     end if;
  end loop;
end;
$function$;

-- 2. Ensure canonical event trigger exists and is enabled
do $$
begin
  if not exists (
    select 1 from pg_event_trigger where evtname = 'ensure_rls'
  ) then
    create event trigger ensure_rls
      on ddl_command_end
      when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      execute function public.rls_auto_enable();
  end if;
end;
$$;

-- 3. Explicitly revoke execution privileges from public, anon, and authenticated
revoke all on function public.rls_auto_enable() from public;
revoke all on function public.rls_auto_enable() from anon;
revoke all on function public.rls_auto_enable() from authenticated;

commit;
```

### 6.2 Post-Application Remediation (Authorized Architect Only)
1. **Live Application:** Apply the reconciled migration to `jsf-pm-dev` using the authorized role/process.
2. **Type Generation Check:** Run `generate_typescript_types` to verify that `src/lib/database.types.ts` is untouched (0 diff).
3. **Changelog Update:** Log the successful application and Security Advisor remediation in `CHANGELOG.md`.

---

## 7. Later Manual-Application Verification Plan

When the migration is manually applied by the authorized Architect, the following verification steps must be executed:

### 7.1 Database Privilege and Catalog Inspection
Execute read-only SQL queries against `jsf-pm-dev`:

1. **Verify Function Privileges (`proacl`):**
   ```sql
   SELECT proname, prosecdef, proacl
   FROM pg_proc
   JOIN pg_namespace ON pg_namespace.oid = pg_proc.pronamespace
   WHERE nspname = 'public' AND proname = 'rls_auto_enable';
   ```
   *Expected Result:* `proacl` contains `{postgres=X/postgres,service_role=X/postgres}`. The `authenticated` entry is completely removed.

2. **Verify Event Trigger Status:**
   ```sql
   SELECT evtname, evtevent, evtenabled, evttags
   FROM pg_event_trigger
   WHERE evtname = 'ensure_rls';
   ```
   *Expected Result:* `evtname = 'ensure_rls'`, `evtevent = 'ddl_command_end'`, `evtenabled = 'O'`, `evttags = {'CREATE TABLE','CREATE TABLE AS','SELECT INTO'}`.

### 7.2 Security Advisor Verification
Fetch live security advisor notices:
- Verify that `authenticated_security_definer_function_executable` is **no longer present** for `public.rls_auto_enable()`.

### 7.3 Repository and Type Verification
1. **Type Artifact Invariance:** Verify `git diff src/lib/database.types.ts` produces 0 lines changed.
2. **Static Schema Contract Test:** Run `npm run test -- __tests__/database/schema-contract.test.ts` (must pass 100%).
3. **Full Repository Verification Suite:** Run `npm run verify` (`format:check`, `lint`, `typecheck`, `build`, `test`, `test:coverage`, `audit:prod`).

---

## 8. Stop Conditions

If any of the following conditions are encountered during pre-execution review or subsequent manual application, **STOP IMMEDIATELY** and request explicit architectural direction:

1. **Catalog Contradiction:** If live catalog inspection on `jsf-pm-dev` indicates `public.rls_auto_enable()` or `ensure_rls` has been dropped, altered to `SECURITY INVOKER`, or re-assigned to a non-postgres owner.
2. **Later Routine Regrant:** If any migration in the workspace or upstream branch modifies `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON ROUTINES TO authenticated` without explicit exclusion of administrative/trigger functions.
3. **Runtime Caller Discovered:** If any branch or PR introduces a client-facing `.rpc("rls_auto_enable")` or references `rls_auto_enable` in application routes.
4. **Generated Type Drift:** If running Supabase TypeScript type generation after migration application alters `src/lib/database.types.ts` in an unexpected or breaking manner.
5. **Event-Trigger Execution Failure:** If table creation by migration tools or database administrators fails due to event trigger execution errors.
