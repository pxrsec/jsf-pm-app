---
document_id: S07-M0-SD-REPORT-01
sprint_id: S07
work_item: M0-SD
status: inspection-and-refactor-report
assessment_date: 2026-08-23
target_environment: jsf-pm-dev
scope: remaining authenticated-executable public SECURITY DEFINER RPCs after M0-A and M0-C
---

# S07 M0 — SECURITY DEFINER Disposition Audit and Candidate Migration Report

## 1. Executive Summary

This report documents the repository-local investigation, disposition audit, and candidate migration authoring for **Sprint 07 Work Item M0-SD** (Section 3 of the `S07 Supabase Advisor Remediation Assessment`).

All **18 remaining** Advisor-flagged public `SECURITY DEFINER` routines intentionally executable by `authenticated` were inspected against live catalog definitions in `jsf-pm-dev`, repository callers, and existing schema contracts:
- **11 trusted routines** were audited, confirmed to possess robust routine-local authorization and bounded input containment, and marked as **Keep** without code or ACL changes.
- **7 target routines** were refactored across five bounded security/integrity improvements (**R1–R5**) in candidate migration `supabase/migrations/20260823130000_s07_m0_security_definer_command_hardening.sql`.

**Zero remote database, configuration, or provider mutation occurred.** Migration application and remote verification are reserved for the authorized Architect on an explicit P1D card.

---

## 2. Inspected Functions Inventory & Disposition Matrix

All 18 audited routines are owned by `postgres`, declare `SECURITY DEFINER`, fixed `search_path = pg_catalog, public`, have `PUBLIC` and `anon` execution revoked, and grant `authenticated` and `service_role` execution.

| # | Routine Signature | User-Facing Purpose / Boundary | Callers / Contract Reference | Disposition |
|---|---|---|---|---|
| 1 | `accept_invite(p_token_hash bytea)` | Authenticated invite completion | `src/app/api/v1/auth/invites/complete/route.ts` | **Refactor (R1)** |
| 2 | `create_collaboration_comment(uuid, collaboration_target_type, uuid, text)` | Project/task/deliverable comment creation | `src/lib/comments/` server actions | **Keep** |
| 3 | `get_project_completion_readiness(uuid)` | Project readiness evaluation | `src/lib/projects/commands.ts` | **Keep** |
| 4 | `list_my_in_app_notifications(integer, timestamptz, uuid)` | In-app notification inbox pagination | `src/lib/notifications/queries.ts` | **Keep** |
| 5 | `list_suppressed_notification_operations(integer, timestamptz, uuid, notification_channel)` | PM/Admin operations queue pagination | `src/lib/notifications/operations-queries.ts` | **Keep** |
| 6 | `mark_all_notifications_read()` | Mark all caller notifications read | `src/lib/notifications/actions.ts` | **Refactor (R2)** |
| 7 | `mark_deliverable_delivered(uuid)` | PM deliverable delivery action | `src/lib/deliverables/commands.ts` | **Keep** |
| 8 | `mark_notification_read(uuid)` | Mark single notification read | `src/lib/notifications/actions.ts` | **Refactor (R2)** |
| 9 | `recover_project_status(uuid, project_status, text)` | Admin recovery command | `src/lib/projects/commands.ts` | **Refactor (R5)** |
| 10 | `reopen_client_deliverable(uuid, text)` | Reopen submitted client deliverable | Retained DB command (`deliverables` domain) | **Refactor (R4)** |
| 11 | `report_broken_link(uuid, uuid, text)` | Report deliverable broken URL | `src/lib/deliverables/commands.ts` | **Keep** |
| 12 | `restore_entity(entity_type, uuid, text)` | Admin entity restore command | `src/lib/projects/commands.ts` | **Refactor (R3)** |
| 13 | `review_deliverable(uuid, review_stage, review_decision, text)` | Internal/client deliverable review | `src/lib/deliverables/commands.ts` | **Keep** |
| 14 | `soft_delete_entity(entity_type, uuid, text)` | Admin entity archive command | `src/lib/projects/commands.ts`, `src/lib/deliverables/commands.ts` | **Keep / Refactor (R3)** |
| 15 | `submit_client_deliverable(uuid, text, text)` | Client external URL submission | `src/lib/client/actions.ts` | **Keep** |
| 16 | `submit_deliverable_version(uuid, text, text)` | Operator version submission | `src/lib/deliverables/commands.ts` | **Keep** |
| 17 | `transition_project_status(uuid, project_status, boolean, text)` | Project lifecycle transition | `src/lib/projects/commands.ts` | **Keep** |
| 18 | `transition_task_status(uuid, task_status, text)` | Task status transition | `src/lib/projects/commands.ts` | **Keep** |

*(Note: `public.rls_auto_enable()` and `public.evaluate_notification_alerts(uuid)` were previously remediated in M0-A and M0-C to be `service_role`-only).*

---

## 3. Approved R5 Recovery Target-State Policy

The Project Owner approved the recovery target-state policy on 2026-08-23:

```text
Allowed recovery targets: planning, in_progress, paused
Disallowed recovery targets: completed, cancelled
```

`completed` and `cancelled` remain exclusively governed by `public.transition_project_status`. `recover_project_status` is an Admin-only recovery boundary, not a second unrestricted lifecycle-transition endpoint.

---

## 4. Routine-by-Routine Comparison for Candidate Migration

**Candidate migration path:**
`supabase/migrations/20260823130000_s07_m0_security_definer_command_hardening.sql`

### 4.1 `public.accept_invite(p_token_hash bytea)` (R1)
- **Baseline:** If emails did not match, raised `User email % does not match invitation recipient email %`, interpolating caller and recipient email values.
- **Candidate Migration:** Replaces the exception with `raise exception 'Invitation does not belong to the authenticated user';`.
- **Security Impact:** Eliminates sensitive data interpolation in raw PostgREST exception messages when directly invoked.
- **Search Path / ACL / Owner:** Preserves `set search_path = pg_catalog, public`, `SECURITY DEFINER`, `postgres` ownership, and `authenticated`/`service_role` EXECUTE grants.

### 4.2 `public.mark_notification_read(p_notification_recipient_id uuid)` (R2)
- **Baseline:** Used inline subquery `user_id = (select auth.uid())` in `UPDATE` predicate; unauthenticated calls updated 0 rows and returned `false`.
- **Candidate Migration:** Explicitly binds `v_user_id uuid := auth.uid();` and throws `raise exception 'Authentication required';` if `v_user_id is null`.
- **Security Impact:** Fails explicitly on missing authentication sessions instead of silently returning no-op success.
- **Search Path / ACL / Owner:** Unchanged.

### 4.3 `public.mark_all_notifications_read()` (R2)
- **Baseline:** Used inline subquery `user_id = (select auth.uid())` in `UPDATE` predicate; unauthenticated calls updated 0 rows and returned `0`.
- **Candidate Migration:** Explicitly binds `v_user_id uuid := auth.uid();` and throws `raise exception 'Authentication required';` if `v_user_id is null`.
- **Security Impact:** Fails explicitly on missing authentication sessions instead of returning integer `0`.
- **Search Path / ACL / Owner:** Unchanged.

### 4.4 `public.soft_delete_entity(p_entity_type public.entity_type, p_entity_id uuid, p_reason text)` (R3)
- **Baseline:** `CASE` expression had no `ELSE` branch; if an unmapped entity type passed, dynamic SQL evaluated to `update public.NULL set ...` or failed silently while emitting an audit log and returning `true`.
- **Candidate Migration:**
  - Implements an explicit closed allowlist: `profile`, `client`, `project`, `project_member`, `task`, `deliverable`, `calendar_event`, `collaboration_comment`.
  - `ELSE` branch immediately throws `raise exception 'Entity type % is not supported for soft delete', p_entity_type;` before dynamic SQL.
  - Inspects `GET DIAGNOSTICS v_row_count = ROW_COUNT;`.
  - If `v_row_count = 0` (no row changed), returns `false` and suppresses audit log creation.
  - If `v_row_count > 0`, writes audit log and returns `true`.
- **Security Impact:** Eliminates potential null dynamic queries, prevents misleading audit logs on failed/no-op mutations, and unifies return semantics.
- **Search Path / ACL / Owner:** Unchanged.

### 4.5 `public.restore_entity(p_entity_type public.entity_type, p_entity_id uuid, p_reason text)` (R3)
- **Baseline:** `CASE` expression had no `ELSE` branch and always returned `true` with audit log even when no row was restored.
- **Candidate Migration:**
  - Implements explicit closed allowlist matching `soft_delete_entity`.
  - Adds immutable entity type rejection (`audit_log`, `notification`, etc.).
  - `ELSE` branch immediately throws `raise exception 'Entity type % is not supported for restore', p_entity_type;`.
  - Inspects `ROW_COUNT`: returns `false` with zero audit logs on no-ops; writes audit log and returns `true` on successful update.
- **Security Impact:** Normalizes administrative return semantics with `soft_delete_entity` and prevents false success audit logging.
- **Search Path / ACL / Owner:** Unchanged.

### 4.6 `public.reopen_client_deliverable(p_deliverable_id uuid, p_reason text)` (R4)
- **Baseline:** Included dead pre-load check `if not ((select private.is_admin()) or (select private.is_project_lead(p_deliverable_id))) then null; end if;`, passing a deliverable UUID into a project UUID parameter.
- **Candidate Migration:** Removes the dead pre-load check. Retains the authoritative post-load Admin/PM Lead check `private.is_project_lead(v_deliv.project_id)`.
- **Security Impact:** Cleans invalid helper invocation while preserving all locked-row checks and authorization invariants.
- **Search Path / ACL / Owner:** Unchanged.

### 4.7 `public.recover_project_status(p_project_id uuid, p_target_status public.project_status, p_reason text)` (R5)
- **Baseline:** Accepted any `project_status` enum value including `completed` and `cancelled`.
- **Candidate Migration:**
  - Enforces allowlist validation:
    ```sql
    if p_target_status not in ('planning', 'in_progress', 'paused') then
      raise exception 'Target status % is not an allowed recovery status. Allowed: planning, in_progress, paused', p_target_status;
    end if;
    ```
  - Explicitly resets `completed_at = null` upon recovery.
- **Security Impact:** Prevents bypass of canonical lifecycle validation in `transition_project_status`.
- **Search Path / ACL / Owner:** Unchanged.

---

## 5. Changed Files & Artifacts

1. **`supabase/migrations/20260823130000_s07_m0_security_definer_command_hardening.sql`** [NEW]: Candidate migration.
2. **`src/lib/projects/schemas.ts`** [MODIFIED]: Synchronized `RecoverProjectStatusSchema` target status enum to `["planning", "in_progress", "paused"]`.
3. **`__tests__/projects/schemas.test.ts`** [MODIFIED]: Added tests asserting `planning`, `in_progress`, `paused` pass, and `completed`, `cancelled` fail.
4. **`__tests__/database/security-definer-refactor.test.ts`** [NEW]: Static migration-source contract test suite covering R1–R5 invariants.
5. **`dev-docs/specs/s07/s07-m0-security-definer-disposition-audit-and-refactor-report.md`** [NEW]: This report.

---

## 6. Verification Commands and Actual Outcomes

### 6.1 Focused Test Suite
```powershell
npx vitest run __tests__/database/security-definer-refactor.test.ts __tests__/database/schema-contract.test.ts __tests__/projects/schemas.test.ts __tests__/auth/negative-path.test.ts src/lib/notifications/__tests__/actions.test.ts
```
**Outcome:** PASSED (5 test files, 73 tests passed, 0 failures).

### 6.2 Full Test Suite
```powershell
npm run test
```
**Outcome:** PASSED (71 test files passed, 4 skipped, 663 tests passed, 9 skipped, 0 failures).

### 6.3 TypeScript Typecheck
```powershell
npm run typecheck
```
**Outcome:** PASSED (0 type errors).

### 6.4 Prettier Format Check
```powershell
npm run format:check
```
**Outcome:** PASSED ("All matched files use Prettier code style!").

### 6.5 ESLint Check
```powershell
npm run lint
```
**Outcome:**
- Modified/created files in this task (`__tests__/database/security-definer-refactor.test.ts`, `__tests__/projects/schemas.test.ts`, `src/lib/projects/schemas.ts`): **0 lint errors**.
- Repository wide: 1 pre-existing out-of-scope error in `src/lib/notifications/alert-evaluator-actions.ts` from M0-C (restricted import rule on `@/lib/supabase/admin`).

### 6.6 Git Whitespace & Cleanliness
```powershell
git diff --check
```
**Outcome:** PASSED (0 whitespace errors).

---

## 7. Catalog, Types, and Caller Alignment

- **Signatures:** Every candidate function retains its exact argument types and return type (`bytea -> jsonb`, `uuid -> boolean`, `() -> integer`, `entity_type, uuid, text -> boolean`, `uuid, text -> jsonb`, `uuid, project_status, text -> jsonb`).
- **`src/lib/database.types.ts`:** Generated types are 100% aligned with candidate signatures; 0 type diff is expected upon post-application generation.
- **Repository Callers:** All callers in `src/lib/projects/commands.ts`, `src/lib/deliverables/commands.ts`, `src/lib/notifications/actions.ts`, and `src/app/api/v1/auth/invites/complete/route.ts` are fully compatible.

---

## 8. Confirmation of Boundaries

- **Remote database mutation:** NONE. No DDL or DML was executed against Supabase `jsf-pm-dev`.
- **Git mutation:** NONE. No commit, push, branch creation, or tag was created.
- **Supabase credentials:** NONE. No write keys or configuration changes were used.
