---
document_id: S07-M0-SD-AUDIT-01
sprint_id: S07
work_item: M0-SD
status: implementation-brief
assessment_date: 2026-08-23
target_environment: jsf-pm-dev
scope: remaining authenticated-executable public SECURITY DEFINER RPCs after M0-A and M0-C
---

# S07 M0 — SECURITY DEFINER Disposition Audit and Refactor Brief

## 1. Purpose and authority

This is the implementation handoff for the final bounded audit required by Section 3 of `S07 Supabase Advisor Remediation Assessment`.

It covers the **18 remaining** Advisor-flagged public `SECURITY DEFINER` functions that are intentionally executable by `authenticated`. It excludes:

- `public.rls_auto_enable()` — remediated by M0-A.
- `public.evaluate_notification_alerts(uuid)` and `private.evaluate_notification_alerts(uuid)` — remediated by M0-C; service-role-only.
- `auth_leaked_password_protection` — **explicitly deferred by the Project Owner**. Do not enable, configure, test, or document it as resolved.
- Provider, scheduler, webhook, deployment, production, and preproduction work.

This brief authorizes repository-only investigation/refactor preparation by Antigravity. **Do not apply Supabase migrations, run DDL, change dashboard settings, activate providers, or use Supabase credentials.**

## 2. Audit method and live baseline

The audit inspected live `jsf-pm-dev` catalog definitions and ACLs, private authorization helpers, applied migration source, repository RPC callers, type declarations, tests, and current Security Advisor output.

### Uniform positive baseline

All 18 functions below currently have all of these properties:

- postgres-owned `SECURITY DEFINER` routine;
- fixed `search_path = pg_catalog, public`;
- `PUBLIC` execution: false;
- `anon` execution: false;
- `authenticated` execution: true;
- `service_role` execution: true;
- no dependent database objects recorded in `pg_depend` beyond the function's own internal dependency graph;
- a user-facing RPC contract in `src/lib/database.types.ts` and a repository caller or explicit schema-contract coverage.

The private authorization helpers used by the routines (`private.is_admin`, `private.is_project_lead`, `private.is_project_pm`, `private.is_project_client`, `private.is_project_watcher`, `private.is_task_assignee`, `private.is_deliverable_assignee`, and `private.current_user_role`) all derive their result from `auth.uid()`, active/non-deleted profiles, and active/non-deleted memberships or assignee ownership. A null session therefore fails those helper checks.

**Do not convert this command surface wholesale to `SECURITY INVOKER`, revoke `authenticated` execution broadly, expose `private`, or replace command authorization with UI-only checks.** The Advisor cannot inspect routine-local authorization; the retained warnings are expected only where this audit records an intentional trusted command.

## 3. Disposition matrix

| Function | User-facing purpose / repository boundary | Authorization and input containment verified | Disposition |
| --- | --- | --- | --- |
| `accept_invite(bytea)` | Authenticated invite completion route using cookie-bound user client | Requires `auth.uid()`, locks token, verifies pending/unexpired/unrevoked state and the caller email, then creates only the invited role/membership | **Refactor required: safe error wording** |
| `create_collaboration_comment(uuid, collaboration_target_type, uuid, text)` | Server action through comments command module | Role/capacity derives from project/target ownership; target ID is checked against project; DB body constraint is 1–20,000 trimmed chars | **Keep** |
| `get_project_completion_readiness(uuid)` | Project lifecycle server action | Admin or active project PM; reads only scoped project task/deliverable readiness | **Keep** |
| `list_my_in_app_notifications(integer, timestamptz, uuid)` | Notification page/query module | Requires `auth.uid()`, recipient filter is caller-owned, limit is clamped 1–100, cursor pair is complete-only | **Keep** |
| `list_suppressed_notification_operations(integer, timestamptz, uuid, notification_channel)` | Admin/PM notification operations page and action | Requires `auth.uid()`; Admin or active PM Lead of each non-null project; limit and composite cursor are bounded/validated | **Keep** |
| `mark_all_notifications_read()` | Notification server action | Update predicate is caller-owned but lacks an explicit missing-session rejection | **Refactor required** |
| `mark_deliverable_delivered(uuid)` | Deliverable delivery server action | Locked row; Admin/active PM Lead of loaded deliverable project; approved-only transition | **Keep** |
| `mark_notification_read(uuid)` | Notification server action | Update predicate is caller-owned but lacks an explicit missing-session rejection | **Refactor required** |
| `recover_project_status(uuid, project_status, text)` | Admin recovery command wrapper | Admin-only and non-empty reason, but accepts every enum target without a recovery-specific transition policy | **Decision then refactor required** |
| `reopen_client_deliverable(uuid, text)` | No current repository caller found; retained database command | Correct post-load Admin/active PM Lead check, workflow/status/reason guards; contains a redundant pre-load check using a deliverable UUID as a project UUID | **Refactor required: remove dead check** |
| `report_broken_link(uuid, uuid, text)` | Deliverable link-report server action | Admin/project PM/project client on loaded deliverable; version must belong to deliverable; DB reason constraint caps at 2,000 chars | **Keep** |
| `restore_entity(entity_type, uuid, text)` | Admin project restore action / generic administrative command | Admin-only; enum limits entity selector, but dynamic SQL's CASE has no explicit unsupported-entity failure and routine returns success even when no row changes | **Refactor required** |
| `review_deliverable(uuid, review_stage, review_decision, text)` | Internal/client review server actions | Locked row, workflow/state validation, Admin/PM Lead internal capacity or project-client capacity, mandatory change comments | **Keep** |
| `soft_delete_entity(entity_type, uuid, text)` | Admin project/task/deliverable archive actions / generic administrative command | Admin-only; immutable enum values blocked, but dynamic SQL CASE has no explicit unsupported-entity failure and routine returns success even when no row changes | **Refactor required** |
| `submit_client_deliverable(uuid, text, text)` | Client server action | Locked row; direct client assignee ownership, workflow/state validation, URL and note bounds | **Keep** |
| `submit_deliverable_version(uuid, text, text)` | Production deliverable server action | Locked row; direct assignee or Admin/active PM Lead; workflow/state validation and provider URL validation | **Keep** |
| `transition_project_status(uuid, project_status, boolean, text)` | Project lifecycle server action | Admin/active PM Lead, locked row, cancellation/reopen rules, explicit completion override, internal readiness call | **Keep** |
| `transition_task_status(uuid, task_status, text)` | Task and client-request server actions | Locked row; Admin/PM Lead, direct operator, or constrained direct client assignee; explicit state machine and reopen reason | **Keep** |

## 4. Required refactor scope

### R1 — Make invite mismatch/error paths non-enumerating

**Database target:** `public.accept_invite(bytea)`

The email-mismatch exception currently interpolates both caller and invitation email values. The normal API route maps RPC failure safely, but an authenticated caller can invoke the public RPC directly and receive raw PostgreSQL error text.

Refactor the error contract so the database never interpolates an email address, token detail, user metadata, or other sensitive value in an exception. Preserve the route's current HTTP response mapping and success payload.

At minimum replace the email-mismatch error with a non-enumerating stable message, such as:

```sql
raise exception 'Invitation does not belong to the authenticated user';
```

Do not weaken the lock, expiry, revocation, or email-equality checks. Do not change invite data, token hashing, `extensions.citext`, role/membership creation, or the success return shape.

### R2 — Require an explicit authenticated actor for notification read mutations

**Database targets:**

- `public.mark_notification_read(uuid)`
- `public.mark_all_notifications_read()`

Both currently contain caller-owned `UPDATE` predicates based on `auth.uid()`, so an anonymous invocation changes zero rows. That is fail-safe operationally, but it does not meet the explicit-authentication invariant and returns an indistinguishable `false`/`0` instead of rejecting an unauthenticated command.

Refactor both functions to:

1. Bind `v_user_id uuid := auth.uid();`.
2. Immediately reject null with the exact stable exception `Authentication required`.
3. Use `v_user_id` in the existing ownership predicate.
4. Preserve return types and all successful behavior:
   - one-read returns `boolean` based on rows changed;
   - mark-all returns the changed-row count.
5. Preserve `SECURITY DEFINER`, fixed search path, owner, and grants.

### R3 — Make generic administrative entity commands an explicit closed allowlist

**Database targets:**

- `public.soft_delete_entity(entity_type, uuid, text)`
- `public.restore_entity(entity_type, uuid, text)`

The selector is typed as `public.entity_type`, not raw text, and the identifier is safely passed through `USING`; this is **not** arbitrary SQL identifier injection. However, the `CASE` mapping omits an `ELSE` branch. Existing immutable types are rejected first, but a future enum value or unexpected non-mapped value could yield a null dynamic statement while the function still writes an audit record and returns `true`.

Refactor to make the supported mutable entity allowlist explicit and fail closed:

```text
profile, client, project, project_member, task, deliverable, calendar_event, collaboration_comment
```

Requirements:

1. Preserve the Admin-only check and immutable-type rejection.
2. Resolve a named target table only through an exhaustive allowlist. Any unsupported type must raise a stable exception before dynamic SQL.
3. Keep `%I` and `USING p_entity_id`; never concatenate raw identifiers or values.
4. Capture affected-row count. If the requested row is missing/already in the target deleted state, return `false` and do **not** emit a misleading success audit event. This is a semantic correction; coordinate the exact caller expectation with existing wrapper tests.
5. If one function currently allows a no-op and the other does not, normalize both to the same documented return behavior.
6. Preserve table-specific RLS bypass only within this Admin-gated command boundary, audit schema, function ownership/security/search path, and public RPC signatures.

### R4 — Remove the redundant pre-load authorization code

**Database target:** `public.reopen_client_deliverable(uuid, text)`

The first block calls `private.is_project_lead(p_deliverable_id)` before the deliverable is loaded, and does nothing even if false. A deliverable UUID is not a project UUID. The correct authorization check occurs after the locked deliverable row is loaded and uses `v_deliv.project_id`.

Remove only the redundant first block. Preserve the authoritative post-load Admin/PM Lead check, locked row, workflow/status/reason checks, audit, notification behavior, return shape, ACL, and function signature.

### R5 — Approved recovery target-state policy

**Database target:** `public.recover_project_status(uuid, project_status, text)`

The Project Owner approved the recommended policy on 2026-08-23:

```text
Allowed recovery targets: planning, in_progress, paused
Disallowed recovery targets: completed, cancelled
```

`completed` and `cancelled` remain exclusively governed by `public.transition_project_status`. `recover_project_status` is an Admin-only recovery boundary, not a second unrestricted lifecycle-transition endpoint.

Antigravity must add a DB-level allowlist before any project update, retain Admin-only/reason/audit behavior, and add exact negative tests for `completed` and `cancelled` target inputs. Do not alter the `project_status` enum, remove the required reason, or change ordinary transition semantics.

## 5. Required test and verification plan

Antigravity must update existing focused tests and report the exact result. It must not claim a passing full suite without capturing its actual output.

### Required repository tests

1. `accept_invite`: wrong-recipient test verifies no email address or other sensitive interpolation reaches the route response or database error assertion.
2. Notification actions: unauthenticated direct-RPC contract tests for both mark-read commands; ownership/no-cross-user mutation tests; unchanged authenticated success behavior.
3. Administrative entity commands: each supported entity mapping, immutable rejection, unsupported/future-enum fail-closed behavior, nonexistent/already-state return semantics, no audit record on a no-op, Admin denial, and exact dynamic SQL safety preservation.
4. Reopen command: static/regression test proving only the post-load project authorization check remains.
5. Recovery function: only after the Project Owner decides R5, tests for every allowed target, every disallowed target, non-Admin rejection, blank reason, and audit outcome.
6. Keep schema-contract tests asserting:
   - all retained user-facing functions remain `SECURITY DEFINER` with `search_path = pg_catalog, public`;
   - `PUBLIC` and `anon` remain unable to execute;
   - authenticated execution remains only for the intentional user-facing functions;
   - evaluator functions remain service-role-only.

### Required development-database pre-application inspection

Before proposing any migration application, re-read the live function ACLs and definitions for only the affected functions, confirm their exact signatures, and compare the candidate migration against them. Do not run a blanket function rewrite.

### Required post-application verification

After a separately authorized application to `jsf-pm-dev`:

1. Verify signature, owner, `SECURITY DEFINER`, hardened search path, and role-by-role execute privileges for each changed function.
2. Verify `PUBLIC` and `anon` have no execute rights; authenticated retains only the user-facing contracts in this document; service-role behavior is unchanged unless an explicit reviewed change says otherwise.
3. Re-run Security Advisor and record the 18 remaining intentional warnings as audited dispositions. Do not expect it to clear merely because authorization was verified internally.
4. Generate Supabase types and compare byte-for-byte after normalization before accepting any generated-file edit.
5. Run focused test suites, `npm run typecheck`, `git diff --check`, and the repository formatter on modified files. If the full suite is red for unrelated runtime/dependency reasons, report the exact blocker separately.

## 6. Explicit non-goals

- No migration application or Supabase mutation by Antigravity.
- No broad ACL revocation or `SECURITY INVOKER` conversion.
- No evaluator changes, private-schema exposure, public API replacement, provider activation, scheduler activation, webhook work, or external delivery.
- No dashboard changes, including leaked-password protection.
- No index additions/removals, table rebuilds, enum changes, broad RLS rewrites, or generated-type edits unless generation proves a signature change that is separately accepted.
- No commits, pushes, branch changes, or unrelated refactors.

## 7. Required candidate migration and Antigravity report

A **forward candidate migration is required**. R1–R5 modify PostgreSQL function bodies; an application refactor alone cannot change the deployed authorization or error behavior in `jsf-pm-dev`.

**Required candidate migration path:**

```text
supabase/migrations/20260823130000_s07_m0_security_definer_command_hardening.sql
```

Antigravity must author that file alongside the focused repository/test refactor. The migration must:

1. Use `create or replace function` only for the seven affected routines: `accept_invite`, `mark_notification_read`, `mark_all_notifications_read`, `soft_delete_entity`, `restore_entity`, `reopen_client_deliverable`, and `recover_project_status`.
2. Preserve every unchanged signature, owner, `SECURITY DEFINER` mode, `search_path = pg_catalog, public`, explicit `PUBLIC`/`anon` revokes, and authenticated/service-role grants.
3. Carry only R1–R5 behavior changes. It must not alter tables, enums, RLS, providers, scheduler behavior, evaluator boundaries, or the 13 retained trusted commands.
4. Be transactional and replay-safe from the repository migration baseline.
5. Not be applied by Antigravity or otherwise sent to Supabase.

Write a repository-local report next to this brief. It must include:

1. Every inspected function, repository caller, changed file, and candidate migration path.
2. The approved R5 policy copied verbatim: allowed `planning`, `in_progress`, `paused`; disallowed `completed`, `cancelled`.
3. Exact routine-by-routine behavior/ACL/search-path comparison for the candidate migration.
4. Test commands and actual outputs, including failures and whether they are in scope.
5. Confirmation that no remote database/configuration/provider action occurred.
6. Any discrepancy between the live catalog, migration source, generated types, and repository callers.

## 8. Implementation readiness

R1–R5 are implementation-ready. The remaining 13 functions in the disposition matrix are approved to remain as intentional authenticated trusted RPCs without ACL or security-mode changes.
