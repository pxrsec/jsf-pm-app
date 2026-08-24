# JSF PM App Development Changelog

## [2026-08-24 @ 07:25]

**🚀 Features & 🛠 Architecture: S07-02 Calendar & Manual Milestones Full Implementation**

- **Timezone Domain Core (`@date-fns/tz` & `src/lib/calendar/`):**
  - Configured `@date-fns/tz` with `CALENDAR_TIME_ZONE = "America/Mexico_City"` across all calendar arithmetic, preventing wall-clock drift and ensuring exact exclusive half-open range queries `[from, to)`.
  - Implemented inclusive-end parsing: all-day UI milestones store `ends_at` as the next calendar day's 00:00:00 Mexico City wall-clock instant, displaying identically and unambiguously in the UI.
  - Implemented strict Zod schemas with inheritance for create/update milestone commands, ensuring 160-char title limits, 2000-char description limits, and non-empty ISO validations.
- **Data & Server Actions (`src/lib/calendar/`):**
  - Routed all calendar data queries (`list_role_safe_calendar_events`, `list_calendar_milestone_targets`, `get_calendar_milestone_for_edit`) exclusively through `SECURITY DEFINER` RPCs.
  - Implemented role-gated server actions (`createCalendarMilestoneAction`, `updateCalendarMilestoneAction`, `softDeleteCalendarMilestoneAction`, `getCalendarMilestoneForEditAction`) with server-side authorization check (`admin` and `pm`) and precise path revalidation (`/[locale]/(protected)/calendario` and concrete project paths).
- **Navigation & Presentation Views (`src/app/[locale]/(protected)/calendario/`):**
  - Added `/calendario` to route guards and navigation bars (`AppNav`, `MobileNavToggle`) for all authenticated roles.
  - Built 4 responsive calendar views (`MonthView`, `WeekView`, `AgendaView`, `ListView`) with color tokens (`chart-1` through `chart-5`), deep links for Admin, PM, and Client project pages, and non-interactive text for Operator events.
  - Created `MilestoneDialog` and `DeleteMilestoneDialog` with on-demand description fetching and target project/task pickers.
- **Project Workspace Integration (`ProjectWorkspaceShell` & `ProjectCalendarTab`):**
  - Added URL query-driven `tab=calendar` activation with view (`calendarView`) and date window (`calendarFrom`, `calendarTo`) persistence.
  - Wired role- and capacity-aware milestone management (`canManageMilestones`), ensuring PM Watchers and terminal projects receive clean read-only calendar views.
- **Verification & Compliance:**
  - `npx vitest run ...`: 11 test suites / 114 tests passed (100%).
  - `npm run typecheck`: 0 errors.
  - `npm run lint`: 0 errors, 0 warnings.
  - `npm run build`: Clean production compilation and dynamic route generation.
  - All source files strictly <= 400 lines.

## [2026-08-24 @ 05:33]

**S07-E09-M1R: Calendar Task-Scoped Milestones and PM Authority Migration Applied**

- Applied migration `20260823144000_s07_e09_calendar-task-scoped-milestones-and-pm-authority.sql` (`20260823144000_s07_e09_calendar_task_scoped_milestones_and_pm_authority`) to remote database via Supabase MCP `apply_migration`.
- Schema enhancements:
  - Added `task_id` (`uuid references public.tasks(id) on delete restrict`) column to `public.calendar_events`.
  - Added validation trigger `calendar_events_task_scope_trg` and function `private.validate_calendar_event_task_scope()` to enforce that task-scoped milestones reference existing active tasks within the same project.
  - Revoked `SELECT` on `public.calendar_events` from `authenticated` and dropped `calendar_events_select_policy` to route all authenticated reads through hardened `SECURITY DEFINER` functions.
  - Replaced `public.list_role_safe_calendar_events(timestamptz, timestamptz, uuid)` to include `project_name` and `task_id`, providing all-PM calendar authority and filtering task-scoped milestones for direct operator assignees.
  - Created manager-only functions `public.list_calendar_milestone_targets()` and `public.get_calendar_milestone_for_edit(uuid)`.
  - Replaced command functions `public.create_calendar_milestone`, `public.update_calendar_milestone`, and `public.soft_delete_calendar_milestone` to support `p_task_id`, maintain structured audit logs, and enforce manager permissions.
- Regenerated TypeScript types via Supabase MCP `generate_typescript_types` and updated [database.types.ts](file:///c:/Users/ruben/Desktop/jsf-app-dev-project/jsf-pm-app/src/lib/database.types.ts).
- Verified with focused test suite: `npx vitest run __tests__/database/s07-e09-migrations.test.ts` (5/5 tests passing).


## [2026-08-23 @ 17:19]

**🐛 Hotfixes / 🛠 Architecture: ESLint Boundary Override & Server-Only Guard for Alert Evaluator Action**

- **ESLint Flat-Config Scoped Override (`eslint.config.mjs`):** Added a targeted configuration block for `src/lib/notifications/alert-evaluator-actions.ts` that enforces the repository's strict Prisma prohibition while permitting `@/lib/supabase/admin` exclusively for this server action.
- **Server-Only Boundary Guard (`src/lib/notifications/alert-evaluator-actions.ts`):** Added `import "server-only";` immediately after `"use server";` to guarantee build-time isolation from client bundles.
- **Preserved Boundaries:** Global restricted-import guards for `@/lib/supabase/admin` remain fully enforced across all client components (`src/components/**`), hooks (`src/hooks/**`), pages (`src/app/!(api)/**`), middleware/proxy (`proxy.ts`), and other shared notification modules.
- **Verification:**
  - `src/lib/notifications/__tests__/alert-evaluator-actions.test.ts`: 12/12 tests passed.
  - `__tests__/supabase/admin.test.ts`, `__tests__/config/prisma-guard.test.ts`, `channel-adapters.test.ts`, `provider-endpoint-guards.test.ts`: 38/38 tests passed.
  - `npm run lint`: 0 errors, 0 warnings across all files.
  - `npm run typecheck`: 0 errors (`tsc --noEmit`).
  - `npm run format:check`: 100% Prettier compliant.

## [2026-08-23 @ 16:38]

**S07-E09-M4: Scope Calendar Events Direct Select Policy Migration Applied**

- Applied migration `20260823143000_s07_e09_scope_calendar_events_direct_select.sql` (`20260823143000_s07_e09_scope_calendar_events_direct_select`) to `jsf-pm-dev` via Supabase MCP `apply_migration`.
- Replaced permissive `calendar_events_select_policy` on `public.calendar_events` to enforce `deleted_at is null and (select private.is_project_pm(project_id))`, eliminating direct manual-milestone read bypass for Operators and Clients.
- Verified live policy posture in `pg_policies` and executed runtime RLS query assertions under authenticated role contexts:
  1. Admin direct milestone read succeeds.
  2. PM Lead / PM Watcher direct read succeeds strictly for assigned/active PM projects and is denied for unassigned projects.
  3. Operator direct read is denied (0 rows returned).
  4. Client direct read is denied (0 rows returned).
- Generated TypeScript definitions verified via Supabase MCP `generate_typescript_types` (exact match; no schema/type alterations).
- Verified focused migration test suite and strict typecheck (`tsc --noEmit`) passing cleanly.

## [2026-08-23 @ 16:08]

**S07-E09-M3: Scoped Operations Metrics & Admin Projections Migration Applied**

- Applied migration `20260823142000_s07_e09_scoped-operations-metrics-and-admin-projections.sql` (`20260823142000_s07_e09_scoped_operations_metrics_and_admin_projections`) to `jsf-pm-dev` via Supabase MCP `apply_migration`.
- Created authenticated, read-only `SECURITY DEFINER` RPC functions:
  - `get_scoped_operations_metrics`: Computes role-safe aggregates for project status distribution, active/overdue/deadline task counts, deliverable metrics, client review cycles, completion cycles, and notification/incident queues with strict 93-day window validation and role authorization.
  - `list_admin_audit_history`: Provides Admin-only bounded audit event inspection with structured changed-field summarization, 93-day date boundary enforcement, and keyset pagination.
  - `list_admin_user_invitation_state`: Provides Admin-only unified operational streams of profiles and invitations with keyset pagination.
- Applied hardened search paths (`pg_catalog, public`), revoked execution from `public` and `anon`, and granted execution to `authenticated`.
- Regenerated TypeScript definitions in `src/lib/database.types.ts` via Supabase MCP `generate_typescript_types`.
- Verified focused migration test suite `__tests__/database/s07-e09-migrations.test.ts` (4 tests passing).

## [2026-08-23 @ 16:05]

**S07-E09-M2: Finalized Production Archive & Link Incidents Migration Applied**

- Applied migration `20260823141000_s07_e09_finalized-production-archive-and-link-incidents.sql` (`20260823141000_s07_e09_finalized_production_archive_and_link_incidents`) to `jsf-pm-dev` via Supabase MCP `apply_migration`.
- Created purpose-limited `SECURITY DEFINER` read RPC functions:
  - `list_finalized_production_archive`: Exposes role-safe finalized production deliverable archive with complete keyset pagination, 93-day date boundary enforcement, and scoped project metadata visibility for operators.
  - `list_role_safe_link_incidents`: Exposes role-safe deliverable link report incident listing strictly restricted to Admin and PM project leads/watchers with complete keyset pagination and 93-day date boundary enforcement.
- Applied hardened search paths (`pg_catalog, public`), revoked execution from `public` and `anon`, and granted execution to `authenticated`.
- Regenerated TypeScript definitions in `src/lib/database.types.ts` via Supabase MCP `generate_typescript_types`.
- Verified focused migration test suite `__tests__/database/s07-e09-migrations.test.ts` (4 tests passing).

## [2026-08-23 @ 16:01]

**S07-E09-M1: Calendar Role-Safe Feed & Audited Milestones Migration Applied**

- Applied migration `20260823140000_s07_e09_calendar-role-safe-feed-and-milestones.sql` (`20260823140000_s07_e09_calendar_role_safe_feed_and_milestones`) to `jsf-pm-dev` via Supabase MCP.
- Narrowed `calendar_events.color_override` constraint to design-system chart tokens (`chart-1` through `chart-5`).
- Created and exposed RPC functions: `list_role_safe_calendar_events`, `create_calendar_milestone`, `update_calendar_milestone`, and `soft_delete_calendar_milestone` with hardened search paths, role-safe access controls, and structured audit logs.
- Revoked direct table mutation (`INSERT`, `UPDATE`, `DELETE`) on `calendar_events` for `authenticated` role in favor of audited command RPCs.
- Regenerated TypeScript definitions in `src/lib/database.types.ts` via Supabase MCP `generate_typescript_types`.
- Verified complete test suite (72 test files, 667 tests passing) and strict typecheck (`tsc --noEmit`) passing cleanly.

## [2026-08-23 @ 14:38]

**S07-M0-SD: SECURITY DEFINER hardening applied to development**

- Applied `20260823130000_s07_m0_security_definer_command_hardening` to `jsf-pm-dev`.
- Verified all seven reviewed routines retain hardened function posture and intended authenticated/service-role execution; `PUBLIC` and `anon` execution remain denied.
- Completed non-enumerating invite errors, explicit notification-read authentication guards, closed administrative entity allowlists/no-op semantics, stale reopen-check removal, and the approved recovery-state allowlist.
- Generated types remain unchanged; focused M0-SD tests and typecheck pass. The current full suite remains blocked by the unrelated `React.act is not a function` runtime failure.

## [2026-08-23 @ 14:31]

**🛠 S07-M0-SD: SECURITY DEFINER Disposition Audit & Candidate Migration Hardening**

- **🛠 Architecture & Security Hardening:**
  - **Candidate Migration Authoring (`supabase/migrations/20260823130000_s07_m0_security_definer_command_hardening.sql`):** Authored candidate forward migration refactoring the 7 target `SECURITY DEFINER` routines while preserving signatures, postgres ownership, hardened search path (`pg_catalog, public`), and role ACLs:
    1. `accept_invite`: Replaced sensitive email interpolation with static, non-enumerating error message (`'Invitation does not belong to the authenticated user'`).
    2. `mark_notification_read`: Added explicit `auth.uid()` null check failing fast with `'Authentication required'`.
    3. `mark_all_notifications_read`: Added explicit `auth.uid()` null check failing fast with `'Authentication required'`.
    4. `soft_delete_entity`: Implemented explicit closed allowlist (8 entities), fail-closed error on unsupported types before dynamic SQL, `ROW_COUNT` inspection returning `false` on no-ops, and audit log suppression on no-ops.
    5. `restore_entity`: Implemented explicit closed allowlist (8 entities), immutable type rejection, fail-closed error on unsupported types, `ROW_COUNT` inspection returning `false` on no-ops, and audit log suppression on no-ops.
    6. `reopen_client_deliverable`: Removed invalid dead pre-load check `private.is_project_lead(p_deliverable_id)` while preserving authoritative post-load Admin/PM Lead check against `v_deliv.project_id`.
    7. `recover_project_status`: Enforced approved recovery target allowlist (`planning`, `in_progress`, `paused`) and rejected terminal transitions (`completed`, `cancelled`).
  - **Application Schema Synchronization (`src/lib/projects/schemas.ts`):** Synchronized `RecoverProjectStatusSchema` target status enum with the approved recovery policy (`planning`, `in_progress`, `paused`).
  - **Static Contract Test Suite (`__tests__/database/security-definer-refactor.test.ts`):** Implemented comprehensive static source-contract test suite asserting SQL transaction wrapping, 7 function declarations, grants/revokes, security modes, search paths, error non-enumeration, null guards, allowlist mapping, and dead check removal.
  - **Test Suite Updates (`__tests__/projects/schemas.test.ts`):** Expanded schema test coverage asserting acceptance of valid recovery targets and explicit rejection of `completed` and `cancelled`.
  - **Comprehensive Inspection Report (`dev-docs/specs/s07/s07-m0-security-definer-disposition-audit-and-refactor-report.md`):** Documented complete routine inventory, approved R5 policy, routine-by-routine comparison, test verification results, and boundary preservation statement.
  - **Zero Remote Database/Git Mutation Boundary:** Verified that no migration was applied, no remote database state was modified, and no git commits or branch alterations occurred.

## [2026-08-23 @ 13:34]

**S07-M0-C: server-only alert-evaluator privilege remediation**

- Applied `20260823111500_s07_m0_server_only_notification_alert_evaluator` to `jsf-pm-dev`.
- Removed `EXECUTE` from `PUBLIC`, `anon`, and `authenticated` on both evaluator routines; preserved service-role-only runtime execution.
- Verified the public authenticated `SECURITY DEFINER` Advisor finding is cleared, while the server action continues to perform all authorization and local-demo gates before using `createAdminClient()`.
- Generated database types remain unchanged; typecheck and focused evaluator tests pass.

## [2026-08-23 @ 13:30]

**🛠 S07-M0-C: Server-Only Notification Alert Evaluator Refactor & Pre-Execution Inspection**

- **🛠 Architecture & Security Refactor:**
  - **Comprehensive Inspection & Preflight (`dev-docs/specs/s07/s07-m0-c-server-only-alert-evaluator-refactor-and-pre-execution-inspection-report.md`):** Completed thorough codebase audit and live database catalog inspection on `jsf-pm-dev` regarding `public.evaluate_notification_alerts(uuid)` and `private.evaluate_notification_alerts(uuid)`.
  - **Server-Only PostgREST Boundary (Option B):** Verified that retaining `public.evaluate_notification_alerts` with `service_role` execution provides the necessary narrow transport boundary for server-held service-role calls without exposing internal schemas (`private`) or creating out-of-band transports.
  - **Server Action Trust Boundary Refactor (`src/lib/notifications/alert-evaluator-actions.ts`):** Refactored `evaluateNotificationAlertsAction` to instantiate `createAdminClient()` strictly after all 6 verification layers succeed (valid session, demo flag enabled, local loopback posture, strict schema parsing, role authorization, and PM lead project validation under the cookie client).
  - **Enhanced Test Verification (`src/lib/notifications/__tests__/alert-evaluator-actions.test.ts`):** Expanded unit test suite to assert that `createAdminClient()` is never called upon failed authorization or posture checks, and that authorized evaluations receive the privileged admin client without leaking credentials.
  - **Candidate Migration Verification (`supabase/migrations/20260823111500_s07_m0_server_only_notification_alert_evaluator.sql`):** Verified that the candidate migration correctly revokes `EXECUTE` from `public`, `anon`, and `authenticated` on both public and private evaluator routines and grants `EXECUTE` solely to `service_role`. Issued preflight verdict `safe to proceed to later manual application`.
  - **Zero Credential / Provider Drift:** Verified that no secrets were exposed, no external delivery providers or schedulers were activated, no migrations were applied, and generated TypeScript types (`src/lib/database.types.ts`) remained untouched.

## [2026-08-23 @ 13:02]

**S07-M0-B: citext extension relocation and compatibility verification**

- Applied `20260823100000_s07_m0_move_citext_to_extensions` to `jsf-pm-dev`.
- Moved `citext` 1.6 from `public` to `extensions`; the Security Advisor no longer reports the `extension_in_public` finding.
- Verified both existing email columns now resolve to `extensions.citext`, retain case-insensitive comparison behavior, and leave all generated TypeScript types unchanged.
- Recompiled `public.accept_invite(bytea)` with its explicit `extensions.citext` local declaration while preserving `SECURITY DEFINER`, hardened search path, owner, signature, and existing authenticated/service-role ACL.
- Confirmed no citext extension-owned routines remain in `public`; typecheck and the focused schema/invite test set pass.

## [2026-08-23 @ 12:55]

**🛠 S07-M0-B: citext Extension Relocation Pre-Execution Inspection**

- **🛠 Architecture & Security Inspection:**
  - **Comprehensive Repository & Live Catalog Preflight (`dev-docs/specs/s07/s07-m0-b-citext-relocation-pre-execution-inspection-report.md`):** Conducted exhaustive static codebase audit and read-only catalog inspection on `jsf-pm-dev` regarding the relocation of the `citext` extension from `public` to `extensions` and the recompilation of `public.accept_invite(bytea)`.
  - **Extension Relocatability & Object Identity Verification:** Proved that PostgreSQL `citext` 1.6 is natively relocatable (`relocatable = true`). Confirmed that `ALTER EXTENSION citext SET SCHEMA extensions;` preserves type OIDs, operator OIDs, and function OIDs without requiring table rewrites, data migrations, or column conversions on `public.client_contacts.email` and `public.invite_tokens.email`.
  - **RPC Search-Path Hardening:** Confirmed that recompiling `public.accept_invite(bytea)` with local declaration `v_user_email extensions.citext` guarantees type resolution under hardened `search_path = pg_catalog, public` while maintaining its `SECURITY DEFINER` posture, ACL, signature, and behavioral contract.
  - **Zero Application & Generated Type Drift:** Proved that PostgREST serialization and generated TypeScript types (`src/lib/database.types.ts`) remain 100% invariant (0 diff). Validated that all invitation completion routes, client contact queries, and synthetic demo bootstrap scripts operate transparently.
  - **Replay Fidelity & Preflight Verdict:** Verified clean zero-to-current migration replay (`supabase db reset`) from historical baseline without mutating historical migrations. Issued formal preflight verdict `safe to proceed to later manual application`.
  - **Strict Boundary Guarantee:** Applied 0 migrations, performed 0 database mutations, modified 0 application/test/type files, and preserved all non-negotiable architectural boundaries.

## [2026-08-23 @ 12:16]

**S07-M0-A: RLS event-trigger reconciliation and privilege remediation**

- Reconciled the canonical `public.rls_auto_enable()` definition and `ensure_rls` DDL event trigger in `supabase/migrations/20260823083000_s07_m0_revoke_rls_auto_enable_execute.sql`.
- Applied the M0-A migration to `jsf-pm-dev`; it preserves the enabled `ddl_command_end` trigger for `CREATE TABLE`, `CREATE TABLE AS`, and `SELECT INTO`.
- Revoked direct `EXECUTE` on `public.rls_auto_enable()` from `public`, `anon`, and `authenticated`; the live ACL now contains only `postgres` and `service_role`.
- Verified the event trigger enables RLS on a transaction-rolled-back public-table probe; the probe table is absent after rollback.
- Verified generated TypeScript types remain byte-equivalent to `src/lib/database.types.ts`, and the Security Advisor no longer reports `rls_auto_enable()`.

## [2026-08-23 @ 11:58]

**🛠 S07-M0-A: RLS Event-Trigger Execute Revocation Pre-Execution Inspection**

- **🛠 Architecture & Security Inspection:**
  - **Comprehensive Repository & Live Catalog Preflight (`dev-docs/specs/s07/s07-m0-a-rls-auto-enable-revocation-pre-execution-inspection-report.md`):** Conducted exhaustive static codebase audit and read-only catalog inspection on `jsf-pm-dev` regarding `public.rls_auto_enable()` and DDL event trigger `ensure_rls`.
  - **Runtime RPC Non-Usage Determination:** Proved definitively that `rls_auto_enable()` is not an application runtime RPC across all `src/` TypeScript/TSX code, OpenAPI contracts (`contracts/openapi/jsf-pm-api.openapi.yaml`), and generated types (`src/lib/database.types.ts`).
  - **Source Reconciliation Defect Identification:** Discovered that neither `public.rls_auto_enable()` nor `ensure_rls` is defined in the repository migration chain (`supabase/migrations/`), causing clean zero-to-current replays to fail on bare `REVOKE` statements. Issued formal preflight verdict `needs source correction`.
  - **Remediation & Verification Plan:** Formulated canonical idempotent DDL specification to define the function and event trigger in the forward migration source before revoking `public`, `anon`, and `authenticated` execution privileges, alongside complete post-application catalog and Security Advisor verification protocols.
  - **Zero Migration & Data Mutation Guarantee:** Applied 0 migrations, performed 0 database mutations, modified 0 database types, and maintained strict read-only boundary.

## [2026-08-23 @ 07:50]

**🚀 S06-07: Navigation, Localization, Accessibility, Focused Evidence, and Sprint Closeout**

- **🚀 Features & Navigation:**
  - **Server-Derived Operations Capability (`src/app/[locale]/(protected)/layout.tsx`):** Derived fail-closed `canAccessNotificationOperations: boolean` on the server (`true` for Admin, `hasActivePmLeadMembership` for PM, `false` for Operator and Client) and passed it to navigation presentation.
  - **Desktop Navigation (`src/components/shared/app-nav/app-nav.tsx`):** Integrated accessible in-app inbox link for all authenticated roles (`/notificaciones`) with unread badge pill (`aria-hidden="true"`) and polite live region (`role="status" aria-live="polite"`). Rendered operations navigation link (`/pm/notificaciones` or `/admin/notificaciones`) exclusively for Admin and PM Lead users.
  - **Mobile Navigation Drawer (`src/components/shared/app-nav/_components/mobile-nav-toggle.tsx`):** Added responsive drawer links for inbox and conditional operations with minimum 44px touch targets, automatic drawer closure on link selection, and Escape key focus restoration.
  - **Visual Badge Component (`src/components/shared/app-nav/_components/notification-badge.tsx`):** Preserved visual count presentation with `99+` overflow formatting while isolating accessibility semantics to the owning link and sibling live region.

- **🛠 Architecture, Localization & OpenAPI:**
  - **Message Catalogs Parity (`messages/es-MX.json`, `messages/en-US.json`):** Added `shell.nav.links.notificationOperations`, `shell.nav.notifications.inboxLinkAria`, and `shell.nav.notifications.inboxLinkAriaWithCount` with 100% Spanish/English parity and matching `{count}` interpolation.
  - **OpenAPI Contract Reconciliation (`contracts/openapi/jsf-pm-api.openapi.yaml`):** Reconciled `NotificationDeliveryStatus` enum by adding `suppressed`; updated descriptions for the 4 inactive operations (`verifyWhatsappWebhook`, `receiveWhatsappWebhook`, `runNotificationProcessor`, `runAlertScheduler`) to state the truthful S06 inactive 404 contract.
  - **Zero Migration & Data Boundary Guarantee:** Explicitly verified that S06-07 created/applied zero migrations, modified zero database types, and invoked zero Supabase MCP/DDL tools.

- **🧪 Testing, Verification & Closeout:**
  - **Navigation & Capability Matrix Tests (`__tests__/app-shell/navigation.test.ts`, `__tests__/integration/role-journey.test.ts`):** 19 tests verifying complete 5-role capability matrix across desktop and mobile views, accessible link naming, status live regions, drawer closure, and negative access safeguards.
  - **OpenAPI & Catalog Tests (`src/lib/notifications/__tests__/provider-endpoint-guards.test.ts`, `__tests__/i18n/message-catalogs.test.ts`, `__tests__/i18n/key-naming.test.ts`):** Verified enum consistency, absence of stale descriptions, catalog parity, and key naming rules.
  - **Integrated Repository Gate (`npm run verify`):** Passed in the supported local-development verification posture: Prettier formatting check, ESLint (0 errors, 0 warnings), TypeScript check (`tsc --noEmit`), Next.js App Router build, Vitest suite (70 passed / 4 skipped, 651 tests), test coverage thresholds, and production audit (0 vulnerabilities). The closeout records the inherited-`NODE_ENV=production` Vitest reproducibility concern and its bounded follow-up.
  - **Factual Closeout Record (`dev-docs/specs/s06/s06-sprint-06-closeout-verification.md`):** Authored complete sprint closeout record detailing DoD traceability, route/command maps, manual localhost journeys J-01 through J-10, deferred scope, and the distinction between development capability and production activation. External provider activation, dispatch, receipt handling, scheduling, deployment, and production verification remain deferred.
  - **Future Promotion Baseline (`dev-docs/documentation/production-promotion-and-external-provider-activation-runbook.md`):** Added a non-authorizing, updateable checklist for later activation ADRs, staging/production database promotion, environment separation, provider prerequisites, secure public endpoint/schedule work, release gates, and rollback.

## [2026-08-23 @ 06:21]

**🚀 S06-06: Inactive Provider-Facing Routes and Activation-Safe Boundaries Implementation**

- **🚀 Features & Routes:**
  - **Inactive Route Shells (`src/app/api/webhooks/whatsapp/route.ts`, `src/app/api/workflows/notification-processor/route.ts`, `src/app/api/workflows/alert-scheduler/route.ts`):** Created the 4 contract-reserved provider-facing route shells (`GET`/`POST` for WhatsApp webhook, `POST` for notification processor, `POST` for alert scheduler) as thin server-only delegators to `rejectInactiveProviderEndpoint()` with type-only `import { type NextRequest, NextResponse } from "next/server"`.
  - **Uniform Inactive Rejection Guard (`src/lib/notifications/provider-endpoint-guards.ts`):** Implemented server-only rejection returning fixed 404 HTTP status, standard `ApiError` envelope (`code: "not_found"`, `message: "Not found"`), and an opaque UUID `request_id` generated via `globalThis.crypto.randomUUID()`. Guaranteed zero disclosure of provider state, route identity, configuration, or signature validity, with no custom headers (`Retry-After`, `x-provider-status`, CORS).
  - **Module-Private Future Seam (`src/lib/notifications/provider-endpoint-guards.ts`):** Embedded module-private `type VerifiedProviderRequest<TPayload>` and documented the normative 7-step future activation order ensuring signature verification precedes side-effect commands without exposing active execution branches or callable verifiers.

- **🛠 Architecture & Security:**
  - **OpenAPI Contract Reconciliation (`contracts/openapi/jsf-pm-api.openapi.yaml`):** Reconciled the 4 reserved operations (`verifyWhatsappWebhook`, `receiveWhatsappWebhook`, `runNotificationProcessor`, `runAlertScheduler`) by replacing legacy `x-provider-status: deferred` and `200` operational response descriptions with `x-provider-status: inactive` and the exact uniform 404 `ApiError` response definition.
  - **ESLint Server-Only Import Boundary (`eslint.config.mjs`):** Extended restricted import configuration to explicitly block `@/lib/notifications/provider-endpoint-guards` and `src/lib/notifications/provider-endpoint-guards` from client components, shared modules, and middleware.

- **🧪 Testing & Verification:**
  - **Provider Endpoint Guard Unit & Static Suite (`src/lib/notifications/__tests__/provider-endpoint-guards.test.ts`):** 5 tests verifying exact 404 status and error envelope, UUID v4 format and distinctness, static enforcement of server-only and zero prohibited imports/crypto APIs, ESLint restriction presence, and operation-scoped OpenAPI contract structure.
  - **Route Handlers Test Suites (`src/app/api/webhooks/whatsapp/route.test.ts`, `src/app/api/workflows/notification-processor/route.test.ts`, `src/app/api/workflows/alert-scheduler/route.test.ts`):** 12 tests across the three route suites verifying spy delegation to the guard under arbitrary opaque query/header/body inputs, unmocked real 404/not_found envelope responses, strict exported method constraints (`GET`/`POST` for WhatsApp, `POST` for workflows), and static source checks proving zero request dereferencing or side-effect APIs.
  - **Full Repository Verification:** 100% pass across Vitest (17 S06-06 tests), TypeScript typecheck (`tsc --noEmit`), ESLint (0 errors, 0 warnings), Prettier formatting check, and Next.js App Router production build (`next build`).

## [2026-08-22 @ 18:22]

**🚀 S06-05: Shared Alert Evaluation Development-Only Manual Control Implementation**

- **🚀 Features & User Interface:**
  - **Manual Alert Evaluation Dialog (`src/app/[locale]/(protected)/pm/notificaciones/_components/manual-alert-evaluation-dialog.tsx`):** Delivered controlled `<AlertDialog>` with proper Base UI composition, min 44px touch targets, PM project selector with `<Label>` and server-authorized options, truthful no-send explanation note, live pending state, polite `aria-live` result announcement with non-leaking aggregate counts, `role="alert"` error feedback, and `router.refresh()` on success.
  - **Shared Presentation Screen Integration (`src/app/[locale]/(protected)/pm/notificaciones/_components/notification-operations-screen.tsx`):** Rendered optional `manualAlertEvaluation` control above the operations queue for authorized internal callers in local demo posture.
  - **Route Server Entry Points (`src/app/[locale]/(protected)/pm/notificaciones/page.tsx`, `src/app/[locale]/(protected)/admin/notificaciones/page.tsx`):** Gated manual evaluation control behind `isNotificationDemoAlertEvaluationEnabled()` and `isLocalNotificationDemoPosture()`. PM route validates active PM Lead status and queries active lead projects via `listActivePmLeadEvaluationProjects`; Admin route provides global evaluation control (`kind: "admin-global"`).

- **🛠 Architecture & Security:**
  - **Evaluator Schemas & DTOs (`src/lib/notifications/alert-evaluator-schemas.ts`):** Defined strict Zod schemas (`EvaluateAlertsAsAdminSchema`, `EvaluateAlertsAsPmLeadSchema`, `AlertEvaluationRawSummarySchema`) with `.strict()` and safe non-negative integer validation (`z.number().finite().int().nonnegative().safe()`).
  - **Server-Only Alert Evaluator (`src/lib/notifications/alert-evaluator.ts`):** Implemented `isLocalNotificationDemoPosture()` ensuring `NODE_ENV === "development"` and loopback hostname matching (`localhost`, `127.0.0.1`, `[::1]`); `evaluateNotificationAlerts(supabase, projectId)` invoking public RPC `evaluate_notification_alerts` with exact `p_project_id: null` for Admin and UUID for PM; `listActivePmLeadEvaluationProjects()` querying active, non-terminal projects; and `assertPmLeadForProject()` enforcing exact project authorization.
  - **Server Actions (`src/lib/notifications/alert-evaluator-actions.ts`):** Implemented `evaluateNotificationAlertsAction` with session validation (`requireSession`), demo flag and local posture enforcement, strict input parsing, PM lead capacity verification, non-leaking error mapping (`VALIDATION_FAILED`, `UNAUTHORIZED`, `UNAVAILABLE`), and comprehensive Next.js 16 cache revalidation across 6 concrete paths and protected layout.
  - **Message Catalogs Parity (`messages/es-MX.json`, `messages/en-US.json`):** Added complete 20-leaf-key `notificationOperations.manualEvaluation` subtree across Spanish and English catalogs with exact semantic parity.

- **🧪 Testing & Verification:**
  - **Evaluator Module Unit Tests (`src/lib/notifications/__tests__/alert-evaluator.test.ts`):** 17 tests verifying loopback posture parsing, IPv6 formatting, RPC call signatures with exact null/UUID, strict summary schema validation (rejection of decimals, NaN, Infinity, negative numbers, overflow, unexpected keys), query deduplication, terminal status filtering, and fail-closed error handling.
  - **Server Actions Unit Tests (`src/lib/notifications/__tests__/alert-evaluator-actions.test.ts`):** 11 tests verifying session errors, demo posture gates, Admin global execution with exact null, PM Lead capacity checks, unauthorized role rejection, error mapping, path revalidations, and side-effect absence.
  - **Dialog Component Unit & Accessibility Tests (`src/app/[locale]/(protected)/pm/notificaciones/_components/manual-alert-evaluation-dialog.test.tsx`):** 8 tests verifying trigger rendering, accessible labels, truthful warning, Admin submission, PM project selection without UUID leakage, zero-result feedback, controlled pending safety, and `role="alert"` error states.
  - **Routes Integration Tests (`src/app/[locale]/(protected)/pm/notificaciones/notification-operations-routes.test.tsx`):** 11 tests verifying prop passing and gating for Admin and PM routes, redirect preservation, and failure isolation.
  - **Message Catalog Parity Suite (`__tests__/i18n/message-catalogs.test.ts`):** 10 tests verifying 43 leaf keys across both locales.
  - **Full Repository Verification:** 100% pass across Vitest (57 S06-05 tests + 142 full notification suite tests), TypeScript typecheck (`tsc --noEmit`), ESLint (0 errors, 0 warnings), Prettier formatting check.

## [2026-08-22 @ 17:25]

**🚀 S06-04: Authorized Internal Notification Queue and Suppressed-Delivery Diagnostics Implementation**

- **🚀 Features & User Interface:**
  - **Authorized Role-Scoped Routes (`src/app/[locale]/(protected)/pm/notificaciones/page.tsx`, `src/app/[locale]/(protected)/admin/notificaciones/page.tsx`):** Delivered the internal operations queue for `admin` (global) and `pm` with active `pm_lead` project capacity. Enforced session checks, server capacity checks (`hasActivePmLeadMembership`), locale preservation via `getLocale()`, and fail-closed redirects without exposing queue existence.
  - **Shared Presentation Screen (`src/app/[locale]/(protected)/pm/notificaciones/_components/notification-operations-screen.tsx`):** Created a shared server-only presentation screen helper rendering the localized heading, safe description, and role-neutral operations queue.
  - **Operations Queue Component (`src/app/[locale]/(protected)/pm/notificaciones/_components/notification-operations-queue.tsx`):** Client interaction component rendering ordered list (`<ol aria-label="...">`) with composite React keys (`${operation.eventId}:${operation.channel}`), authoritative prop reconciliation on `initialPage` changes, visible polite status announcements (`role="status"`), visible alert region (`role="alert"`), retry handling, and focus transfer to status region on pagination exhaustion.
  - **Suppressed Delivery Item (`src/app/[locale]/(protected)/pm/notificaciones/_components/suppressed-delivery-status.tsx`):** Rendered terminal status badge (`Suprimida`), channel badge (`Correo electrónico` / `WhatsApp`), safe event category derived from 21-trigger mapping, controlled reason (`Proveedor externo desactivado`), dedicated terminal explanation sentence, aggregate recipient count, safe project context, and localized ISO timestamps without disclosing sensitive recipient contacts, event IDs, or raw payloads.
  - **Empty State Component (`src/app/[locale]/(protected)/pm/notificaciones/_components/notification-operations-empty-state.tsx`):** Localized empty state for authorized callers with no suppression records.

- **🛠 Architecture & Security:**
  - **Pure Contracts & Zod Schemas (`src/lib/notifications/operations-contracts.ts`, `src/lib/notifications/operations-schemas.ts`):** Defined isolated DTOs (`SuppressedNotificationOperation`, `SuppressedNotificationOperationsCursor`, `SuppressedNotificationOperationsPage`), constant `NOTIFICATION_OPERATIONS_PAGE_SIZE = 25`, and strict composite cursor validation schema (`LoadSuppressedNotificationOperationsPageSchema`).
  - **Server-Only Authorization (`src/lib/notifications/operations-authorization.ts`):** Implemented `hasActivePmLeadMembership` with a multi-membership-safe `.limit(1)` existence query and `assertNotificationOperationsAccess` with distinct `NotificationOperationsAuthorizationError`.
  - **Server-Only Keyset Queries (`src/lib/notifications/operations-queries.ts`):** Created `listSuppressedNotificationOperationsPage` calling `list_suppressed_notification_operations` with complete raw row validation, 26-row fetch / 25-row retention, 25th-row keyset derivation, and non-leaking generic error handling.
  - **Server Action (`src/lib/notifications/operations-actions.ts`):** Implemented read-only continuation action `loadSuppressedNotificationOperationsPageAction` with step-by-step exception mapping (`VALIDATION_FAILED`, `UNAUTHORIZED`, `UNAVAILABLE`) and zero `revalidatePath` side effects.
  - **Message Catalogs Parity (`messages/es-MX.json`, `messages/en-US.json`):** Added complete 23-leaf-key `notificationOperations` namespace across Spanish and English with exact semantic key parity.

- **🧪 Testing & Verification:**
  - **Server Queries Test Suite (`src/lib/notifications/__tests__/operations-queries.test.ts`):** 8 tests verifying default RPC parameters, composite cursor handling, malformed cursor rejection, sensitive field exclusion, raw row validation fail-closed behavior, keyset pagination boundary, and RPC error logging.
  - **Server Actions Test Suite (`src/lib/notifications/__tests__/operations-actions.test.ts`):** 9 tests verifying validation failure, AuthError mapping, PM Watcher denial without query invocation, PM Lead authorization, fail-closed membership query errors, Admin authorization, and query error handling.
  - **Queue Component Test Suite (`notification-operations-queue.test.tsx`):** 7 tests verifying terminal state rendering, dual-channel composite key rendering for shared event IDs, privacy non-leakage, empty states, load-more continuation, error/retry states, semantic landmarks, and ARIA attributes.
  - **Route Server Entry Test Suite (`notification-operations-routes.test.tsx`):** 6 tests verifying PM Lead access, PM Watcher localized redirects, English locale redirects, unauthorized role redirects, and Admin access.
  - **Route Guard Regression Suite (`__tests__/app-shell/route-guard.test.ts`):** Verified Admin and PM access to `/admin/notificaciones` and `/pm/notificaciones`, and cross-role redirects (`/pm/notificaciones` -> `/admin`, `/admin/notificaciones` -> `/pm`).
  - **Message Catalog Verification (`__tests__/i18n/message-catalogs.test.ts`):** Verified all 23 leaf keys in `notificationOperations` and identical tree structure.
  - **Full Automated Verification:** 100% pass across Vitest (64/64 tests passing), TypeScript typecheck (`tsc --noEmit`), ESLint (0 errors, 0 warnings), Prettier formatting check, and Next.js App Router production build (`next build`).

## [2026-08-22 @ 16:46]

**🛠 S06-E08: Notification Operations Queue Keyset Pagination Migration & Types Regeneration**

- **🛠 Architecture & Database:**
  - **Applied Migration (`supabase/migrations/20260822170000_s06_e08_notification_operations_queue_keyset_pagination.sql`):** Applied the keyset pagination migration for the safe aggregated suppressed-delivery queue to `jsf-pm-dev` via Supabase MCP `apply_migration`. Dropped the superseded timestamp-only overload `public.list_suppressed_notification_operations(integer, timestamptz)` and introduced complete composite cursor keyset pagination via `public.list_suppressed_notification_operations(p_limit, p_before_suppressed_at, p_before_event_id, p_before_channel)` with deterministic ordering (`last_suppressed_at DESC, event_id DESC, channel DESC`), strict input completeness validation, valid channel checks, and authenticated execute grant.
  - **Database Types Synchronization (`src/lib/database.types.ts`):** Regenerated TypeScript types from `jsf-pm-dev` via Supabase MCP `generate_typescript_types` and updated `src/lib/database.types.ts` with the new keyset cursor parameter signature (`p_before_channel`, `p_before_event_id`, `p_before_suppressed_at`, `p_limit`).

## [2026-08-22 @ 16:26]

**🚀 S06-03: Notification Recipient Inbox, History, and Read State Implementation**

- **🚀 Features & User Interface:**
  - **Shared Authenticated Inbox Route (`src/app/[locale]/(protected)/notificaciones/page.tsx`):** Implemented the recipient notifications inbox page accessible to all authenticated roles (`admin`, `pm`, `operator`, `client`) with server-side session enforcement (`requireSession`), initial keyset page loading (`listRecipientInboxPage`), and localized metadata.
  - **Accessible Loading Skeleton (`src/app/[locale]/(protected)/notificaciones/loading.tsx`):** Created localized loading skeleton with `role="status"`, `aria-busy="true"`, and `aria-live="polite"`, displaying placeholder header, action bar, and card items with zero hard-coded text.
  - **Route Error Boundary (`src/app/[locale]/(protected)/notificaciones/error.tsx`):** Implemented client error boundary capturing exceptions to Sentry (`{ boundary: "localized-route" }`), rendering generic localized copy without leaking internal stacks or digests, with native retry (`reset()`) and minimum touch targets (`min-h-[44px] min-w-[44px]`).
  - **Interactive Notification Inbox (`src/app/[locale]/(protected)/notificaciones/_components/notification-inbox.tsx`):** Client interaction component managing single and mark-all read mutations with shared pending states, focus management on removal, keyboard accessibility, screen-reader status announcements, ordered list semantic structure (`<ol aria-label="...">`), and keyset pagination ("Load More").
  - **Inbox List Item & Empty State (`src/app/[locale]/(protected)/notificaciones/_components/*`):** Created `NotificationInboxItem` featuring category badge, explicit textual read/unread indicator, formatted timestamp, category-generic copy, and unread action button; and `NotificationEmptyState` with `BellOff` iconography and localized empty messaging.
  - **Trigger-to-Category Resolver (`src/app/[locale]/(protected)/notificaciones/_components/types.ts`):** Mapped all 21 `notification_trigger` enum variants deterministically to 15 user-facing category keys without exposing raw trigger identifiers or payload fields.

- **🛠 Architecture & Security:**
  - **Shared Route Exception Boundary (`src/lib/auth/routes.ts`, `src/app/[locale]/(protected)/layout.tsx`):** Added `/notificaciones` to protected path prefixes and exported `SHARED_AUTHENTICATED_PATH_PREFIXES` to permit all authenticated roles through the shared inbox while maintaining strict role-home enforcement for role-specific routes.
  - **Pure Browser-Safe Contracts (`src/lib/notifications/inbox-contracts.ts`):** Defined isolated DTOs (`RecipientInboxNotification`, `RecipientInboxCursor`, `RecipientInboxPage`) with type-only database imports, safe for client components and free of server-only runtime dependencies.
  - **Server-Only RPC Query Layer (`src/lib/notifications/queries.ts`):** Created typed `listRecipientInboxPage` caller with strict cursor validation, 26-row sentinel fetch, 25-row result clamping, `readAt: row.read_at ?? null` normalization, 25th-row keyset continuation derivation, and bounded diagnostic logging via `@/lib/logger`.
  - **Server Actions Layer (`src/lib/notifications/actions.ts`):** Implemented `"use server"` mutations `markNotificationReadAction`, `markAllNotificationsReadAction`, and `loadRecipientInboxPageAction` with strict Zod validation, session verification, narrow error mapping (`VALIDATION_FAILED`, `UNAUTHENTICATED`, `UNAVAILABLE`), and multi-path cache invalidation (`/notificaciones`, `/en/notificaciones`, `/[locale]/(protected)` layout).
  - **Message Catalogs Parity (`messages/es-MX.json`, `messages/en-US.json`):** Added complete 54-leaf-key `notifications` namespace across Spanish and English (including 30 category titles/descriptions) plus `shell.nav.links.notifications`.

- **🧪 Testing & Verification:**
  - **Route Guard Test Suite (`__tests__/app-shell/route-guard.test.ts`):** Verified all 4 active roles (`admin`, `pm`, `operator`, `client`) access `/notificaciones` and `/en/notificaciones` without redirects, cross-role protections remain enforced, and unlisted shared routes (`/notificaciones-interna`) redirect to role defaults.
  - **Server Queries Test Suite (`src/lib/notifications/__tests__/queries.test.ts`):** 8 tests validating default calls, valid/malformed cursors, sensitive field exclusion, null normalization, keyset pagination boundary (25 vs 26 rows), and RPC failure error isolation.
  - **Server Actions Test Suite (`src/lib/notifications/__tests__/actions.test.ts`):** 15 tests validating UUID/timestamp validation, unauthenticated mapping, error propagation, RPC execution, cache revalidation, and failure error codes.
  - **Component & Error Test Suites (`notification-inbox.test.tsx`, `error.test.tsx`):** 13 tests validating trigger-to-category mapping, raw payload non-exposure, read/unread indicators, button disablement, action execution, empty states, pagination retry, ARIA landmarks, touch targets, and Sentry boundary integration.
  - **Message Catalog Parity (`__tests__/i18n/message-catalogs.test.ts`):** 9 tests validating identical JSON structure, required namespaces, 54 notification keys, and complete category coverage.
  - **Full Automated Verification:** 100% pass across Vitest (65/65 tests passing), TypeScript compiler checks (`tsc --noEmit`), ESLint (0 errors, 0 warnings), Prettier formatting check, and Next.js App Router production build (`next build`).

## [2026-08-22 @ 15:42]

**🛠 S06-E08 / S06-03: Notification Inbox Keyset Pagination Migration & Types Regeneration**

- **🛠 Architecture & Database:**
  - **Applied Migration (`supabase/migrations/20260822160000_s06_e08_notification_inbox_keyset_pagination.sql`):** Applied the S06-03 recipient inbox history migration to `jsf-pm-dev` via Supabase MCP `apply_migration`. Dropped the superseded two-argument function `public.list_my_in_app_notifications(integer, timestamptz)` and introduced complete keyset cursor pagination via `public.list_my_in_app_notifications(p_limit, p_before_created_at, p_before_recipient_id)` with deterministic ordering (`created_at DESC, id DESC`), strict input pair validation, and authenticated-only execute grants.
  - **Database Types Synchronization (`src/lib/database.types.ts`):** Regenerated TypeScript types from `jsf-pm-dev` via Supabase MCP `generate_typescript_types` and updated `src/lib/database.types.ts` with the new keyset cursor argument signature (`p_before_created_at`, `p_before_recipient_id`, `p_limit`).

## [2026-08-22 @ 15:02]

**🚀 S06-02: Server-Only Configuration and Provider-Ready Disabled Adapters**

- **🛠 Architecture & Security:**
  - **Server-Only Configuration Boundary (`src/lib/notifications/config.ts`):** Implemented server-only environment parser reading strictly the 9 designated notification variables (`EXTERNAL_DELIVERY_MODE`, `NOTIFICATION_DEMO_ALERT_EVALUATION_ENABLED`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_API_VERSION`). Implemented conservative placeholder detection engine (`replace_me`, `replace-me`, `example`, `placeholder`, `changeme`, `your_`, `your-`, `<`, `>`, etc.) and fail-closed evaluation. Discards raw strings function-locally without exporting secrets or raw env values.
  - **Pure Server-Only Types & Discriminated Capabilities (`src/lib/notifications/types.ts`):** Defined closed channel set (`email`, `whatsapp`), delivery modes (`disabled`, `active`), safe internal diagnostic/configuration codes (`ExternalDeliveryConfigurationCode`, `ProviderConfigurationCode`), capability snapshot (`ExternalDeliveryCapability` with `disabled`, `invalid`, and `active-ready` variants), and adapter contracts (`DisabledAdapterRequest`, `DisabledAdapterResult`, `NotificationChannelAdapter`).
  - **Disabled Channel Adapters & Seam Factory (`src/lib/notifications/channel-adapters.ts`):** Implemented `DisabledEmailAdapter` and `DisabledWhatsAppAdapter` returning deterministic `not_dispatched` / `provider_disabled` results with zero side effects, no provider client creation, no network calls, and no provider SDK imports (`resend`, `@upstash/qstash`, `@upstash/workflow`). Selection factory returns disabled adapters across all modes (including `active-ready`).
  - **Safe Diagnostic & Localization Key Mapping (`src/lib/notifications/errors.ts`):** Created bounded diagnostic helper mapping internal codes to semantic localization keys (`provider_disabled` -> `providerDisabled`, `external_delivery_unavailable` -> `externalDeliveryUnavailable`) with exhaustive type safety via `as const satisfies Record<SafeNotificationDiagnosticCode, NotificationLocalizationKey>`.
  - **ESLint Flat-Config Import Boundary (`eslint.config.mjs`):** Enforced structural restricted imports for all 8 notification module paths (`@/lib/notifications/*` and `src/lib/notifications/*`) preventing imports into client components, shared modules, hooks, and middleware/proxies, with a targeted flat-config override for `src/lib/notifications/**` to permit intra-folder server-only imports while preserving Prisma and admin Supabase client restrictions.
  - **Safe Environment Template (`.env.example`):** Added explicit default `EXTERNAL_DELIVERY_MODE=disabled` and `NOTIFICATION_DEMO_ALERT_EVALUATION_ENABLED=false` with safe placeholder comments stating external delivery and webhooks remain deferred in S06.

- **🧪 Testing & Verification:**
  - **Configuration Parser Test Suite (`src/lib/notifications/__tests__/config.test.ts`):** 14 tests verifying missing/blank/placeholder/invalid/explicit-disabled modes, active multi-provider prerequisites, placeholder detection across all patterns, malformed email/WhatsApp validation, active-ready state generation, zero raw export leakage, static `server-only` import checks, demo flag parsing, and no unrelated env reads.
  - **Channel Adapters & Import Boundary Test Suite (`src/lib/notifications/__tests__/channel-adapters.test.ts`):** 11 tests verifying channel matching, dispatch result invariants (no message IDs/receipts/error causes), zero fetch/network calls under both disabled and active-ready configs, static `server-only` import checks, zero provider SDK imports, closed channel unions, non-throwing behavior, structural ESLint rule verification, and errors diagnostic mappings.
  - **Deterministic Test Harness:** Enforced `server-only` mocking, `vi.resetModules()` per dynamic import, `process.env` snapshot/restoration, synthetic data only, and global `fetch` stub lifecycle restoration across all suites.
  - **Automated Verification:** Verified 100% pass across Vitest (25/25 tests passing), TypeScript compiler checks (`tsc --noEmit`), ESLint (0 errors, 0 warnings), Prettier formatting (`prettier --check`), and Next.js App Router production build (`next build`).

## [2026-08-22 @ 14:17]

**🛠 S06-E08: Notification Capability Suppression & Alert Evaluation Migrations**

- **🛠 Architecture & Database:**
  - **Applied Notification Capability Suppression Migration (`supabase/migrations/20260822140000_s06_e08_notification_capability_suppression.sql`):** Applied the S06-E08 notification capability migration to `jsf-pm-dev` via Supabase MCP. Added `suppressed` terminal value to `public.notification_delivery_status`, added `suppression_reason` and `suppressed_at` columns to `public.notification_recipients` with suppression state constraints and indexing, implemented transactional disabled-provider fan-out (`private.fan_out_disabled_external_notifications`), preserved monotonic receipt and read boundaries, narrowed recipient select policy to in-app rows, and created safe read RPCs `public.list_my_in_app_notifications` and `public.list_suppressed_notification_operations`.
  - **Applied Authoritative Alert Evaluation Migration (`supabase/migrations/20260822150000_s06_e08_alert_evaluation.sql`):** Applied the S06-E08 alert evaluation migration to `jsf-pm-dev` via Supabase MCP. Implemented database-authoritative alert evaluator (`private.evaluate_notification_alerts` / `public.evaluate_notification_alerts`) for disjoint task deadline reminders (24h/12h/6h/overdue) and production deliverable review-inactivity reminders (capped at 5 intervals before transition to stalled), with role-based execution boundaries for Admin, active PM Lead, and `service_role`.
  - **Database Types Synchronization (`src/lib/database.types.ts`):** Regenerated TypeScript types from `jsf-pm-dev` via Supabase MCP `generate_typescript_types` and updated `src/lib/database.types.ts` with newly added enum value, recipient suppression columns, and RPC function definitions (`evaluate_notification_alerts`, `list_my_in_app_notifications`, `list_suppressed_notification_operations`).

## [2026-08-22 @ 12:15]

**🚀 S05-07: Navigation, Recovery, Localization, Accessibility, and Closeout Verification**

- **🚀 Features & Polish:**
  - **Reused Standard Recovery Primitive (`ProjectRecoveryState`):** Standardized unexpected route error recovery across Operator (`/operador/error.tsx`) and Client (`/cliente/error.tsx`) portals using the shared `ProjectRecoveryState` component with localized error titles, descriptions, retry handlers, Sentry boundary capture (`boundary: "localized-route"`), and role-safe return links (`/operador`, `/cliente`).
  - **44px Primary Touch Target Compliance:** Updated `MobileNavToggle` button (`min-h-[44px] min-w-[44px]`) and `ProjectRecoveryState` interactive retry and return controls to meet the 44px touch target accessibility standard.
  - **Drawer Keyboard Navigation & Focus Management:** Verified and tested mobile drawer closing upon internal route navigation and `Escape` key press, ensuring immediate focus restoration to the toggle button.
  - **Screen Reader Semantics & Loading Status:** Added `role="status"` and visually-hidden status announcements (`<span className="sr-only">`) to Operator and Client loading skeletons.

- **🛠 Architecture, Localization & Types Hygiene:**
  - **100% Bilingual Message Catalog Parity:** Synchronized all dictionary entries across `messages/es-MX.json` and `messages/en-US.json` for `shell.landing`, `projects.operatorAgenda`, `projects.operatorProjects`, `projects.operatorTask`, `projects.clientPortal`, `projects.clientProjects`, `projects.clientRequests`, `projects.clientSubmissions`, and `projects.clientReviews` with zero namespace mismatches.
  - **Eliminated Static Query-Level Fallbacks:** Removed hardcoded Spanish strings (`"Sin nombre"`, `"Sin título"`) from query layers (`src/lib/client/project-queries.ts`, `request-queries.ts`, `review-queries.ts`), returning raw `null` values and delegating presentation fallbacks to localized message catalogs.
  - **Nullable Domain Model Audit:** Updated `ClientProjectListItem`, `ClientSubmissionRequirementSummary`, `ClientRequestQueueItem`, `ClientRequestDetail`, `ClientProductionReviewQueueItem`, and `ClientProductionReviewDetail` types to strictly support nullable `name`, `title`, and `project_name` (`string | null`).
  - **Presentation Layer Fallback Remediation:** Localized all missing project names and untitled titles across Client and Operator presentation components, eliminating hardcoded `"Proyecto"`, `"Sin nombre"`, and `"Sin título"`.

- **🧪 Testing & Closeout Verification:**
  - **Targeted Test Expansion:** Added tests in `__tests__/app-shell/navigation.test.ts` (drawer closure on link click and Escape, focus restoration), `__tests__/projects/project-recovery-state.test.tsx`, `__tests__/client/client-portal.test.tsx` (English presentation rendering and negative fallback assertions), and verified `__tests__/operator/operator-agenda-routes.test.tsx`.
  - **Unified Verification Gate (`npm run verify`):** Executed full integration pipeline — Prettier formatting check (`format:check`), ESLint (`lint`), TypeScript typecheck (`typecheck`), Next.js App Router build (`build`), Vitest unit/integration suite (`test`: 53 test files, 478 passed, 0 failures), coverage thresholds (`test:coverage`), and production security audit (`audit:prod`: 0 vulnerabilities).
  - **Closeout Verification Artifact:** Generated `dev-docs/specs/s05/s05-sprint-05-closeout-verification.md` detailing J-01 through J-10 manual journey verification, DoD compliance matrix, and complete file inventory.

## [2026-08-22 @ 10:56]

**🚀 S05-05: Client Submission Planning Consumption, Pure Lexical URL Submission, and Correction Loop**

- **🚀 Features:**
  - **Client Submission Link Submission & Correction Flow (`ClientSubmissionActions`):** Implemented client submission modal with live lexical URL validation, provider preview classification, live note character counter (enforcing normalized post-trim length $\le 1000$ characters without raw HTML truncation), truthfulness disclaimer ("El sistema únicamente registra la URL proporcionada. No se realiza descarga, inspección ni almacenamiento del archivo"), confirmation step, double-submit protection, and live screen-reader announcements.
  - **Correction Loop UI & Reopen History:** In direct request detail views, rendered distinct "Reemplazo solicitado" badges, displayed PM reopen reason and replacement explanation, while keeping previous versions intact in an immutable history list.
  - **Separation of Presentation Contexts:** Preserved read-only summary display in project dashboards (`/cliente/proyectos/[project-id]`) while providing full interactive submission actions, registered link opening, and correction history strictly on canonical request detail views (`/cliente/tareas/[task-id]`).
  - **Deliberate Outbound External Links:** Rendered submitted URLs with `target="_blank"` and `rel="noopener noreferrer"` without any server-side network dereferencing.
  - **Malformed History Defense:** Automatically detects malformed correction history JSON, suppresses mutation actions, and renders a safe recovery warning without querying underlying database tables.

- **🛠 Architecture & Security:**
  - **Pure Lexical URL Validator & Classifier (`src/lib/client/submission-url.ts`):** Implemented zero-network pure regex and octet-length validation mirroring PostgreSQL `private.is_valid_client_submission_url` and provider classification (`google_drive`, `dropbox`, `onedrive`, `wetransfer`, `frame_io`, `other_https`) matching PostgreSQL `private.classify_client_submission_provider`.
  - **Strict Server Action & Schema Validation (`src/lib/client/actions.ts` & `src/lib/client/schemas.ts`):** Implemented `submitClientSubmissionAction` and `SubmitClientDeliverableSchema` strictly rejecting non-string note inputs, pre-normalizing whitespace, enforcing $\le 1000$ chars, performing lexical pre-validation, and verifying direct client assignment and `pending` state before calling `submitClientDeliverable`.
  - **Safe Error Code Mapping (`src/lib/projects/errors.ts`):** Extended `mapSupabaseError` with explicit classifications for direct-assignee failures (`UNAUTHORIZED`), invalid transitions/workflows (`INVALID_TRANSITION`), and authoritative URL/note constraints (`VALIDATION_FAILED`), preventing raw database string exposure.
  - **Mechanical Types Extraction (`src/lib/client/sort-helpers.ts`):** Extracted sorting helpers into a dedicated helper module to strictly satisfy the $\le 400$ lines constraint while re-exporting all sorters from `src/lib/client/types.ts`.
  - **Complete Bilingual Key Parity:** Added full Spanish (`messages/es-MX.json`) and English (`messages/en-US.json`) semantic translation trees under `projects.clientSubmissions` conforming to camelCase naming rules.

- **🧪 Testing & Verification:**
  - **Acceptance URL Corpus (`__tests__/client/client-submission-url.test.ts`):** 26 tests verifying all 7 standard valid provider URLs, 4 look-alike valid hosts mapped to `other_https`, 13 invalid URLs (scheme, credentials, ports, localhost, IP literals, whitespace, backslashes, $>2048$ bytes), and zero-network execution guarantee.
  - **Server Actions Tests (`__tests__/client/client-actions.test.ts`):** 22 tests verifying auth, schema validation, non-string note rejection, whitespace normalization, preflight state checks, 4-route family bilingual revalidation, and error mapping.
  - **Query Tests (`__tests__/client/client-queries.test.ts`):** 11 tests verifying correction history parsing, malformed JSON fallback, and direct submission target resolution.
  - **UI Integration & Presentation Tests (`__tests__/client/client-portal.test.tsx`):** 29 component tests verifying summary vs detailed modes, correction banners, outbound link attributes, action suppression, and bilingual dictionary parity.
  - **Full Automated Verification:** All 18 test suites (269 tests), TypeScript typecheck (`tsc --noEmit`), ESLint linting (0 errors, 0 warnings), Prettier formatting (`prettier --check .`), and Next.js production build (`next build`) passing 100%.

## [2026-08-22 @ 10:18]

**🛠 S05-05: Harden Client Submission URLs, Safe Correction History & Database Types Generation**

- **🛠 Architecture & Database:**
  - **Applied Migration (`supabase/migrations/20260822095500_s05_05_harden_client_submission_urls_and_correction_history.sql`):** Applied the S05-05 schema migration to `jsf-pm-dev` via Supabase MCP `apply_migration`. Implemented lexical public-HTTPS URL validation (`private.is_valid_client_submission_url`), authoritative lexical provider classification (`private.classify_client_submission_provider`), least-privilege direct-assignee correction history projection helper (`private.get_client_submission_correction_history`), hardened deliverable submission RPC (`public.submit_client_deliverable`), and updated `public.client_submission_view` with `correction_history`.
  - **Database Types Synchronization (`src/lib/database.types.ts`):** Regenerated TypeScript types from `jsf-pm-dev` via Supabase MCP `generate_typescript_types` and updated `src/lib/database.types.ts`.

## [2026-08-22 @ 09:37]

**🚀 S05-04: Client Portal Safe Project Dashboard & Direct-Request Queue**

- **🚀 Features:**
  - **Live Client Navigation & Shell Integration:** Activated the live `/cliente/proyectos` link in `AppNav` and `MobileNavToggle` for client users, and updated `ClientShell` with localized quick links to `/cliente/proyectos`, `/cliente/tareas`, `/cliente/entregables`, and direct project cards.
  - **Client Project Browser & Workspace (`/cliente/proyectos` & `/cliente/proyectos/[project-id]`):** Implemented client project list and project detail views featuring 4 separated sections: Project Context (with status badge and client scope), Your Requests (with child count and status), Your Requested Submissions (read-only requirements with pending/submitted indicators), and Released Production Reviews (with deliverable status and review link).
  - **Client Direct-Request Queue & Detail (`/cliente/tareas` & `/cliente/tareas/[task-id]`):** Implemented direct-assignee client request queue and detail views featuring plain-text descriptions, timeline dates, display-only approved resources, read-only child submission summaries, and interactive lifecycle controls.
  - **Client Request Lifecycle Actions (`ClientRequestActions`):** Implemented localized client action leaves for starting (`pending` → `in_progress`) and completing (`in_progress` → `completed`) client requests with double-click protection and inline error mapping.
  - **Client Production Review Queue & Detail (`/cliente/entregables` & `/cliente/entregables/[deliverable-id]`):** Implemented client review list (split into Awaiting Your Review and Recent Outcomes) and canonical review detail view featuring deliberate outbound Google Drive review links (`target="_blank"`, `rel="noopener noreferrer"`) and parsed client feedback history without internal IDs.
  - **Client Production Review Actions (`ClientReviewActions`):** Implemented approval and revision request controls with double-submit protection, character counters (1-2000 chars for revisions), and strict review action suppression if version or feedback data is invalid.
  - **Strict Error Code Catalog Mapping:** Implemented explicit client error mapping (`CLIENT_ERROR_KEY_BY_CODE`) mapping domain error codes (`VALIDATION_FAILED`, `UNAUTHORIZED`, `NOT_FOUND`, `INVALID_TRANSITION`, `CONFLICT`, `INVARIANT_VIOLATION`, `UNKNOWN`) to semantic catalog keys, preventing raw backend message leakage.

- **🛠 Architecture & Security:**
  - **Deliverables Command Adapter (`src/lib/deliverables/commands.ts`):** Extended `ReviewDeliverableCommandInput` to support `stage: "internal" | "client"`, keeping PM internal reviews and Client production reviews strictly separated.
  - **Server-Only Safe View Queries (`src/lib/client/`):** Created modular typed query boundaries (`project-queries.ts`, `request-queries.ts`, `review-queries.ts`, `queries.ts`) projecting strictly from `client_project_view`, `client_task_view`, `client_submission_view`, and `client_deliverable_view` under RLS.
  - **Dedicated Client Server Actions (`src/lib/client/actions.ts`):** Implemented `startClientRequestAction`, `completeClientRequestAction`, `approveClientDeliverableAction`, and `requestClientDeliverableChangesAction` enforcing session authentication, client role authorization, safe preflight state verification, command execution, and localized path revalidation.
  - **Preserved Locale on Non-Client Redirects:** All `/cliente/*` server routes check session role and redirect non-client users using locale-preserving prefixes.
  - **Bilingual Translation Parity:** Added complete Spanish (`messages/es-MX.json`) and English (`messages/en-US.json`) dictionaries under `projects.clientPortal`, `projects.clientProjects`, `projects.clientRequests`, `projects.clientSubmissions`, and `projects.clientReviews`.
  - **Line Limit Strict Adherence:** Kept all 24 production implementation files strictly $\le 300$ lines.

- **🧪 Testing & Verification:**
  - **Action Tests (`__tests__/client/client-actions.test.ts`):** 18 unit tests verifying input validation, session enforcement, non-client role rejection, preflight check guards, command execution, and path revalidations.
  - **Query Tests (`__tests__/client/client-queries.test.ts`):** 11 unit tests verifying field projections, direct task scoping, child submission isolation, and feedback parsing.
  - **Presentation & Review Tests (`__tests__/client/client-portal.test.tsx`):** 13 component tests verifying feedback parser, readiness computation, sort order, empty states, 4-section layout, outbound review links, action eligibility, and safe recovery states.
  - **Shell & Navigation Tests (`__tests__/app-shell/navigation.test.ts`, `__tests__/app-shell/role-landing.test.ts`):** 20 tests verifying live client navigation links, drawer toggles, and shell landing components.
  - **Semantic Key Parity (`__tests__/i18n/key-naming.test.ts`):** Verified translation key naming and full semantic dictionary parity.
  - **Full Automated Suite:** 6 test files, 65 tests passing (0 failures). `typecheck`, Next.js production `build`, `lint` (0 errors, 0 warnings), and `format:check` passing 100%.

## [2026-08-22 @ 07:11]

**🚀 S05-03: Operator Task Detail & Production-Submission Flow**

- **🚀 Features:**
  - **Canonical Operator Task Detail Route (`/operador/tareas/[task-id]` & `/en/operador/tareas/[task-id]`):** Delivered the server-rendered task detail view presenting authoritative urgency badges, task status/priority, title, project link, work description, timeline context, safe task resources, and assigned deliverables.
  - **Safe Outbound Task Resources (`operator-task-resources.tsx`):** Rendered outbound resource links with strict `target="_blank"` and `rel="noopener noreferrer"`, with accessible labels and no speculative server-side dereferencing.
  - **Assigned Deliverable Presentation (`operator-deliverable-card.tsx`):** Rendered deliverable cards with specifications, deadlines (submission, internal review, client delivery), current version badge (`v{n}`), and state-specific banners (`awaiting_internal_review`, `awaiting_client_review`, `approved`, `delivered`, `changes_requested`).
  - **Operator Version Submission Dialog (`operator-submission-dialog.tsx`):** Implemented client submission modal with immediate lexical Google Drive URL validation, optional submission note (max 1000 chars with live counter), explicit truthfulness disclaimer, revision banner for `changes_requested` states, and double-submit protection.
  - **Agenda Integration:** Linked task titles in `OperatorAgendaTaskCard` directly to canonical `/operador/tareas/[task-id]` route.

- **🛠 Architecture & Security:**
  - **Type Isolation (`src/lib/operator/types.ts`):** Established dedicated types and status mapping constants keeping all implementation files strictly under 400 lines.
  - **Safe Read Projection (`src/lib/operator/queries.ts`):** Implemented `getOperatorTaskDetail` and preflight `getOperatorDeliverableForSubmission` querying strictly from `operator_agenda_view` under RLS.
  - **Dedicated Server Action (`src/lib/operator/actions.ts`):** Implemented `submitOperatorDeliverableVersionAction` enforcing session authentication, operator role authorization, safe preflight deliverable lookup, `production` workflow & `pending`/`changes_requested` status gating, command adapter invocation (`submitDeliverableVersion`), and concrete path revalidation across `/operador/agenda`, `/operador/proyectos`, `/operador/proyectos/[project-id]`, and `/operador/tareas/[task-id]`.
  - **Bilingual Localization:** Added matching translation keys under `projects.operatorTask` and `projects.operatorSubmission` across `messages/es-MX.json` and `messages/en-US.json`.

- **🧪 Testing & Verification:**
  - **Query Tests (`__tests__/operator/operator-queries.test.ts`):** 16 unit tests covering field projection, deduplication, resource ordering, task detail mapping, and preflight submission lookup.
  - **Action Tests (`__tests__/operator/operator-actions.test.ts`):** 11 unit tests covering validation, session `AuthError` throwing, non-operator role rejection, `NOT_FOUND` / `INVALID_TRANSITION` guards, and path revalidations.
  - **Component Tests (`__tests__/operator/operator-task-detail.test.tsx`):** 8 component tests covering outbound resource links, deliverable state notices, revision notices, dialog validation, and action invocation.
  - **Route & Agenda Tests (`__tests__/operator/operator-agenda-routes.test.tsx`):** 7 tests covering task route linking, card urgency rendering, empty states, and translation parity.
  - **Full Suite Status:** 4 test files, 42 tests passing with 0 errors. TypeScript, ESLint, Next.js production build, and Prettier checks passing 100%.

## [2026-08-22 @ 06:30]

**🛠 S05-03: Operator Task Detail Safe Projection & Database Types Generation**

- **🛠 Architecture & Database:**
  - **Applied Migration (`supabase/migrations/20260821170000_s05_03_operator_task_detail_safe_projection.sql`):** Applied the S05-03 security-invoker projection migration to `jsf-pm-dev` via Supabase MCP `apply_migration`, extending `public.operator_agenda_view` with aggregated `task_resources` (JSONB), `deliverable_specifications`, and `submission_deadline_at`.
  - **Database Types Synchronization (`src/lib/database.types.ts`):** Regenerated TypeScript types from `jsf-pm-dev` via Supabase MCP `generate_typescript_types` and updated `src/lib/database.types.ts`.

## [2026-08-21 @ 16:19]

**🚀 S05-02: Operator My Day Agenda & Own-Work Navigation**

- **🚀 Features:**
  - **Operator My Day Agenda (`/operador/agenda` & `/en/operador/agenda`):** Delivered the server-rendered cross-project Operator agenda displaying own assigned tasks, authoritative urgency badges (`new`, `normal`, `upcoming`, `urgent`, `overdue`, `completed`), task statuses, project context, linked deliverable counts, and formatted deadlines.
  - **Completed-Today Section:** Implemented a distinct, read-only completed-today section for tasks completed within the Operator's stored local day retention window.
  - **Projects with Own-Work Index (`/operador/proyectos`):** Implemented the own-work project browser showing distinct safe project cards with own assigned task counts, present urgency badges, nearest deadline, and accessible navigation.
  - **Per-Project Own-Task List (`/operador/proyectos/[project-id]`):** Implemented project-scoped task list with generic safe absence/denial state preventing identifier probing.
  - **Navigation Activation:** Activated live, keyboard-focusable locale-aware link to `/operador/agenda` in desktop `AppNav` and mobile `MobileNavToggle`.

- **🛠 Architecture:**
  - **Dedicated Server Read Boundary (`src/lib/operator/queries.ts`):** Created typed server-only query module reading strictly from `operator_agenda_view` using explicit field projection.
  - **Task & Deliverable Deduplication:** Multi-deliverable rows for a single task are deduplicated into unified task records with deliverable summary arrays.
  - **Urgency Validation & Ordering:** Enforced authoritative urgency validation and Section 5.3 fallback sort order (`overdue` → `urgent` → `upcoming` → `new` → `normal` → `completed`) with task ID tie-breaking.
  - **Pure RSC Presentation:** All operator views and presentation components are built as pure React Server Components with no client-side badge dependencies.
  - **Bilingual Localization:** Added matching semantic keys under `projects.operatorAgenda` and `projects.operatorProjects` in `messages/es-MX.json` and `messages/en-US.json`.

- **🧪 Testing & Quality:**
  - **Query Suite (`__tests__/operator/operator-queries.test.ts`):** Added 10 tests covering explicit field projection, deduplication, Section 5.3 sort order, project grouping, and safe handling of missing/invalid categories and IDs.
  - **Route & Presentation Suite (`__tests__/operator/operator-agenda-routes.test.tsx`):** Added 7 tests validating card rendering across all 6 urgency categories, completed-today section, empty states, and an automated translation catalog parity assertion.
  - **Navigation Suite (`__tests__/app-shell/navigation.test.ts`):** Updated operator assertions to verify active desktop and mobile drawer navigation.

## [2026-08-21 @ 13:18]

**📝 Sprint 04 Closeout Record Structural Alignment & Contract Hygiene**

- **📝 Closeout Verification Document Alignments (`dev-docs/specs/s04/s04-sprint-04-closeout-verification.md`):**
  - **Committed Branch Name (§1):** Corrected branch metadata to exact committed branch `feature/s04-e04-e05-project-workspace-and-production-deliverable-lifecycle`.
  - **Sprint Plan DoD Section (§2):** Corrected the Definition-of-Done section reference to Section 7 (`Sprint Plan DoD Criterion (§7)`).
  - **Changed-Files Inventory Reorganization (§3):** Regrouped the full Sprint 04 file inventory into the authoritative 8-work-item sprint sequence: S04-01 (Visual Foundation & Persisted Theming), S04-02 (Workspace Command Boundary & Mutation Adapters), S04-03 (Project Directory & Membership Governance), S04-04 (Project Workspace, Task Planning & Constrained Kanban), S04-05 (Project Completion, Reopening & Audit Context), S04-06 (Deliverable Planning, Submission & Immutable History), S04-07 (Internal Review, Resubmission, Release & Final Delivery), and S04-08 (Navigation, Localization, Focused Evidence & Closeout).
  - **Sprint 05 Hand-Off Contract Hygiene (§10):** Replaced invented `completeProjectAction` with existing authoritative `transitionProjectStatusAction` alongside `reopenProjectAction` and `getCompletionReadinessAction`.

## [2026-08-21 @ 12:55]

**🚀 Deliverables English Localization Completeness & Factual Sprint 04 Closeout Record**

- **🌐 Localization Completeness (Blocker 2 Resolved):**
  - **Deliverable Component String Extraction (`deliverable-edit-dialog.tsx`, `deliverable-create-dialog.tsx`, `deliverable-history.tsx`, `deliverable-link-report-dialog.tsx`):** Extracted all remaining user-visible hardcoded strings into `projects.workspace.deliverables.*` keys across both `messages/es-MX.json` and `messages/en-US.json`. Added localized field labels (`statusLabel`, `versionLabel`, `titleLabel`, `assigneeLabel`, `assigneePlaceholder`, `userFallback`, `specificationsLabel`, `submissionDeadlineLabel`, `internalReviewDeadlineLabel`, `clientDeliveryDeadlineLabel`), submitter fallback (`teamMemberFallback`), and external link disclaimer notice (`truthfulnessNotice`).
  - **100% Translation Parity & Key Hygiene:** Maintained strict dot-delimited lower camelCase key hierarchy verified by `__tests__/i18n/message-catalogs.test.ts` and `__tests__/i18n/key-naming.test.ts`.
- **📝 Factual Sprint 04 Closeout Verification Record (Blocker 1 Resolved):**
  - **DoD & Feature Grounding (`dev-docs/specs/s04/s04-sprint-04-closeout-verification.md`):** Updated the Definition-of-Done and hand-off records to strictly mirror codebase realities: documented PM Watcher advisory commenting capabilities and explicit deferral of E06 Operator / E07 Client workspaces; documented the 5-state task lifecycle (`pending`, `in_progress`, `in_review`, `completed`, `blocked`); clarified that deliverable lifecycle progresses to `awaiting_client_review` with Client decision UI deferred to E07; corrected accessibility declarations (Escape restoration, semantic landmarks, loading live regions); clarified Sentry error boundary vs localized 404 boundary handling; updated handoff contract exports to verbatim symbols (`listProjectsForAdmin`, `listProjectsForPm`, `getProjectDetail`, `createTaskAction`, `transitionTaskStatusAction`, `reportDeliverableLinkAction`, `reviewDeliverableAction`, `markDeliverableDeliveredAction`).
- **🧪 Automated Verification Pipeline:**
  - `npm run verify`: Exited with code 0 across all 7 verification steps.
  - `npm run format:check`: 100% Prettier compliant.
  - `npm run lint`: 0 errors, 0 warnings.
  - `npm run typecheck`: 0 TypeScript errors.
  - `npm run build`: Production Next.js 16.3.1 Turbopack build compiled all 23 routes.
  - `npm run test`: 45 test files passed (344 passed, 0 failed, 9 skipped).
  - `npm run test:coverage`: Full v8 coverage generated across all application modules.
  - `npm run audit:prod`: 0 vulnerabilities.

## [2026-08-21 @ 12:10]

**🚀 Navigation Localization, Route Recovery, Loading Boundaries, and Sprint 04 Closeout (S04-08)**

- **🚀 Features & Integration:**
  - **Locale-Preserving Global Navigation (`src/components/shared/app-nav/app-nav.tsx`, `mobile-nav-toggle.tsx`):** Integrated Next-Intl routing `Link` into `AppNav` and `MobileNavToggle` to preserve canonical `/en` and `/es` locale prefixes. Activated live links for Admin (`/admin/proyectos`) and PM (`/pm/proyectos`), while keeping Operator and Client future-work items visibly unavailable and `aria-disabled="true"`.
  - **Shared Project Recovery State Component (`src/components/shared/projects/project-workspace/project-recovery-state.tsx`):** Created a safe presentational recovery component capturing exceptions to Sentry with `{ boundary: "localized-route" }`, rendering localized title/description, retry button (`reset`), and optional locale-aware return link without leaking raw database exceptions, digests, or stack traces.
  - **Route Error & Not-Found Boundaries:** Updated Admin and PM directory and workspace route error boundaries (`admin/proyectos/error.tsx`, `admin/proyectos/[id]/error.tsx`, `pm/proyectos/error.tsx`, `pm/proyectos/[id]/error.tsx`) to consume `ProjectRecoveryState`. Added safe localized `not-found.tsx` boundaries for unauthorized/missing project handling.
  - **Accessible Internationalized Loading Boundaries:** Updated Admin and PM directory and workspace `loading.tsx` boundaries to Server Components with `role="status"`, `aria-busy="true"`, `aria-live="polite"`, and screen-reader localized loading text from `projects.workspace.recovery.loading`.
  - **100% Translation Parity (`messages/es-MX.json`, `messages/en-US.json`):** Added `projects.workspace.recovery` namespace with full Spanish and English parity covering directory, workspace, retry, and return actions.
- **🛠 Architecture & Code Hygiene:**
  - **ESLint & React Compiler Compliance:** Refactored `deliverable-comments-section.tsx` and `deliverable-review-dialog.tsx` to eliminate synchronous `setState` in `useEffect`. Replaced `watch()` with `useWatch()` in deliverable dialogs for React Compiler compatibility.
  - **Strict TypeScript & Test Suite Hardening:** Eliminated explicit `any` usage in test suites (`deliverable-actions.test.ts`), added `// @vitest-environment jsdom` and `@testing-library/jest-dom/vitest` matchers to DOM tests, and added `@/i18n/routing` mocks to integration tests.
- **🧪 Sprint 04 Closeout & Full Verification:**
  - `npm run verify`: Exited with code 0 across all 7 verification gates.
  - `npm run format:check`: 100% Prettier compliant.
  - `npm run lint`: 0 errors, 0 warnings.
  - `npm run typecheck`: 0 TypeScript errors (`tsc --noEmit`).
  - `npm run build`: Production Next.js 16.3.1 Turbopack build succeeded (all 23 static/dynamic routes compiled).
  - `npm run test`: 45 test files passed (344 passed, 0 failed, 9 skipped).
  - `npm run test:coverage`: Full v8 coverage generated across all application modules.
  - `npm run audit:prod`: 0 vulnerabilities.
  - Closeout verification record written to `dev-docs/specs/s04/s04-sprint-04-closeout-verification.md`.

## [2026-08-21 @ 10:43]

**🚀 Authoritative Internal Review, Resubmission, Release, and Final Delivery (S04-07)**

- **🚀 Features:**
  - **Authoritative PM Review & Final Delivery Actions (`src/lib/deliverables/review-actions.ts`):** Implemented direct async Server Actions (`reviewDeliverableAction`, `markDeliverableDeliveredAction`) with server-side PM Lead / Admin preauthorization, deliverable project verification, strict state transition validation, and RPC invocations (`review_deliverable` with stage pinned to `internal`, and `mark_deliverable_delivered`).
  - **Active-PM-Lead Preauthorization Alignment (`src/lib/deliverables/auth-checks.ts`):** Aligned `verifyPmLeadCapacity` and `verifyProjectMemberAccess` with PostgreSQL authoritative function `private.is_project_lead` by verifying `profiles.is_active = true` and `profiles.deleted_at is null`.
  - **Safe Error Mapping (`src/lib/projects/errors.ts`):** Extended `mapSupabaseError` to recognize RPC authorization phrases (`"Only active PM Lead"`) and safely classify them as `UNAUTHORIZED`.
  - **Review & Delivery Schemas (`src/lib/deliverables/schemas.ts`):** Added `ReviewDeliverableActionSchema` (enforcing mandatory feedback comments on `changes_requested`) and `MarkDeliverableDeliveredActionSchema`.
  - **Review Decision Status Mapping (`src/lib/status-maps.ts`):** Defined `ReviewDecision` and `REVIEW_DECISION_MAP` exporting `approved` (ShieldCheck, green token) and `changes_requested` (RotateCcw, orange token).
  - **Controlled Review & Delivery Dialogs (`deliverable-review-dialog.tsx`, `deliverable-delivery-dialog.tsx`):** Added review modal with immutable notice, decision toggle, and character counter, alongside delivery modal featuring explicit workflow truthfulness disclaimers.
  - **Status-Aware Workspace Gating & Extraction (`deliverables-tab.tsx`, `deliverables-filter-bar.tsx`, `deliverable-detail-sheet.tsx`, `deliverable-list.tsx`, `deliverable-card.tsx`):** Extracted `DeliverablesFilterBar` to keep all components under 300 lines (well under the 400-line repository ceiling). Implemented status-aware action gating suppressing archive/mutation actions on `delivered` status, displaying review CTA for `awaiting_internal_review`, and displaying client review waiting notice for `awaiting_client_review`. Wired `router.refresh()` and detail view re-fetch on mutations.
  - **Full Dual-Locale Localization Parity (`messages/es-MX.json`, `messages/en-US.json`):** Localized all review/delivery dialogs, action labels, error keys, detail sheet banners, and fallback text strings.
- **🧪 Verification & Quality:**
  - `npx vitest run __tests__/deliverables/deliverable-actions.test.ts`: 20/20 passed.
  - `npx vitest run __tests__/deliverables/schemas.test.ts`: 18/18 passed.
  - `npx vitest run __tests__/projects/deliverables-workspace.test.tsx`: 13/13 passed.
  - `npm run typecheck`: 0 errors.
  - `npm run build`: Production Next.js Turbopack build succeeded with code 0.

## [2026-08-21 @ 09:27]

**🚀 Production Deliverable Planning, Submission, and Immutable History (S04-06)**

- **🚀 Features:**
  - **Hardened Google Drive Submission URLs (`validators.ts`, `schemas.ts`):** Enforced strict lexical URL checks rejecting non-HTTPS, raw whitespace, tabs, newlines, control characters, backslashes, userinfo credentials, non-Google hosts, and explicit port specifications (including `:443`). Preserved raw URL string without trimming to maintain boundary fidelity.
  - **PM Capacity & Eligibility Gates (`auth-checks.ts`, `actions.ts`):** Server-side enforcement restricting planning mutations (`createDeliverableAction`, `updateDeliverableAction`, `archiveDeliverableAction`) exclusively to project `pm_lead` or `admin`. Explicitly rejects `pm_watcher` from planning mutations while permitting link reporting, commenting, and read operations. Enforced comprehensive eligibility check (client project type, linked client organization, at least one active non-deleted client member, valid deliverable-enabled task, and active compatible assignee).
  - **Full Workspace Deliverables Module (`src/components/shared/projects/project-deliverables/*`):** Created responsive tab supporting list table and card view layouts, real-time status and assignee filtering, planning modals (`DeliverableCreateDialog`, `DeliverableEditDialog`, `DeliverableArchiveDialog`), version submission modal (`DeliverableSubmitDialog`), full detail sheet (`DeliverableDetailSheet`), immutable version timeline (`DeliverableHistory`), formal review audit history (`FormalFeedbackHistory`), informal collaboration comments (`DeliverableCommentsSection`), and link report alert dialog (`DeliverableLinkReportDialog`).
  - **Project Activity Tab (`project-activity-tab.tsx`):** Integrated dedicated activity view presenting completion cycles history projected from `project_completion_cycles_view`.
  - **Full Dual-Locale Localization (`messages/es-MX.json`, `messages/en-US.json`):** Delivered 100% synchronized, semantic translation keys for `projects.workspace.deliverables.*` and `projects.workspace.activity.*` adhering strictly to `VC-I18N-008` naming rules.
- **🛠 Architecture & Database:**
  - **Supabase Migrations Applied:** Applied `20260820153000_s04_06_harden_production_google_drive_submission_urls.sql` and `20260821100000_s04_06_allow_incomplete_client_project_planning.sql` on remote development database; regenerated `src/lib/database.types.ts`.
  - **Explicit Safe View Projections (`queries.ts`):** Defined strongly-typed projection interfaces (`DeliverableListItem`, `DeliverableDetailView`, `DeliverableVersionView`, `DeliverableFeedbackView`) avoiding wildcard selects or unbounded data models.
  - **Server Action Module Isolation (`comment-actions.ts`):** Modularized deliverable comment actions into dedicated `comment-actions.ts` and eliminated re-export statements from `"use server"` files to ensure strict Turbopack production compilation compliance.
  - **Strict Line Limit Compliance:** All 23 new and modified implementation files strictly satisfy the <= 400 lines repository rule.
- **🧪 Verification & Quality:**
  - `npm run build`: Production Turbopack build succeeded with code 0 (all static and dynamic routes compiled).
  - `npx tsc --noEmit`: 0 TypeScript errors.
  - `npm test`: 44 test suites passing (312 passed tests, 0 failures), including comprehensive unit tests for URL validators, schemas, server actions, and React Testing Library workspace components.


## [2026-08-20 @ 02:04]

**🐛 Next.js Server Action Module Compilation & I18N Key Compliance Hotfixes**

- **🐛 Hotfixes:**
  - **Server Action File Isolation (`src/lib/projects/actions.ts`, `src/lib/projects/lifecycle-actions.ts`):** Resolved Next.js Turbopack compiler failure (`Error: Export updateProjectAction doesn't exist in target module / The module has no exports at all`) by removing `export const` schemas and re-export statements from `"use server"` files. Relocated `ReopenProjectSchema`, `type ReopenProjectInput`, and `interface CreateProjectWithTeamInput` to `src/lib/projects/schemas.ts`. Updated client components and test suites to import actions directly from `@/lib/projects/lifecycle-actions`.
  - **Semantic Translation Key Compliance (`messages/es-MX.json`, `messages/en-US.json`):** Consolidated `projects.workspace.header.*` keys under `projects.workspace.summary.*` and updated `*Button` translation keys (`confirmButton`, `cancelButton`, `reopenButton`) to semantic `*Action` keys (`confirmAction`, `cancelAction`, `reopenAction`) to strictly satisfy `VC-I18N-008` rules forbidding visual/position/element keywords in translation namespaces.
  - **Codebase Formatting & Lint Hygiene:** Executed Prettier code formatting and eliminated unused `@typescript-eslint/no-unused-vars` warning in `actions.ts`.
- **🧪 Verification & Build:**
  - `npm run build`: Production Turbopack build succeeded with code 0 (all static and dynamic routes compiled).
  - `npm run typecheck`: 0 TypeScript errors.
  - `npm run lint`: 0 ESLint errors.
  - `npm run test`: All 42 test suites passing (291 passed tests, 0 failures).

## [2026-08-19 @ 17:48]

**🎯 Project Completion, Reopening, and Visible Audit Context (S04-05)**

- **🚀 Features:**
  - **Completion Preflight & Confirmation Modal (`project-complete-dialog.tsx`):** Built interactive completion flow utilizing `getCompletionReadinessAction` (`get_project_completion_readiness` RPC) to inspect unfinished work. Displays clear green indicator on full completion or amber warning detailing unfinished task and deliverable counts (with compact listing of up to 5 tasks), allowing PM Leads & Admins to execute an explicit confirmed override (`confirm_unfinished: true`).
  - **Reasoned Project Reopening Modal (`project-reopen-dialog.tsx`):** Implemented modal capturing mandatory reopening reason (1–500 characters) with real-time character counter and validation, calling `reopenProjectAction` (`transition_project_status` RPC with `next_status: "in_progress"`).
  - **Completed State Presentation (`completed-project-banner.tsx`):** Created read-only status banner for completed projects with formatted completion timestamp and conditional "Reabrir Proyecto" CTA for non-watcher actors.
  - **Workspace & Task Gating (`project-header.tsx`, `tasks-tab.tsx`):** Added context-aware header dropdown items ("Completar Proyecto" on active projects, "Reabrir Proyecto" on completed projects), suppressed invalid transitions (cancelling on completed state), preserved metadata editing capabilities, and gated "Nueva Tarea" creation controls when `project.status === "completed"`.
  - **Structured Completion Cycles History (`completion-cycles-card.tsx`):** Upgraded Overview tab cycle card to display all `project_completion_cycles_view` fields including cycle number, completion date, cycle duration in days, unfinished work override badges, reopened timestamps, active cycle badges, and recorded reopen reasons.
- **🛠 Architecture & Boundaries:**
  - **Lifecycle Server Actions (`src/lib/projects/lifecycle-actions.ts`):** Created dedicated server actions module housing `getCompletionReadinessAction` and `reopenProjectAction` with session role authorization (`admin` | `pm`), strict Zod validation (`ReopenProjectSchema`), and multi-route cache revalidations.
  - **Strict Line Limits:** Kept all 9 project components and server action files strictly under 400 lines (max 389 lines). Extracted `CompletionCyclesCard` to preserve file modularity.
  - **Full Localization Parity (`messages/es-MX.json` & `messages/en-US.json`):** Added 100% matching translation keys across `projects.workspace.completion.*`, `projects.workspace.reopen.*`, `projects.workspace.completedBanner.*`, `projects.workspace.header.*`, and `projects.workspace.overview.*`.
- **🧪 Verification & Build:**
  - `npm run test -- __tests__/projects/`: All 76 project tests passing across 9 test suites (including 15 dedicated lifecycle tests in `__tests__/projects/project-lifecycle.test.tsx`).
  - `npm run typecheck`: 0 TypeScript errors.
  - `npm run lint`: 0 ESLint errors.

## [2026-08-19 @ 16:48]

**📋 Project Workspace, Task Planning, and Constrained Kanban (S04-04)**

- **🚀 Features:**
  - **Constrained Kanban Board (`task-kanban-board.tsx`, `task-kanban-column.tsx`, `task-kanban-card.tsx`):** Built interactive drag-and-drop Kanban board powered by `@hello-pangea/dnd` across 5 status columns (`pending`, `in_progress`, `in_review`, `completed`, `blocked`) with optimistic updates, rollback on error, blocking priority indicator (`border-l-4 border-l-rose-400`), and watcher-mode view gating.
  - **Sortable Task List (`task-list-view.tsx`, `task-list-row.tsx`):** Implemented table view with multi-column sorting (title, priority, status, deadline) and row action menus.
  - **Multi-Dimensional Filters (`task-filters.tsx`):** Added filter controls for status, priority, task type (`internal_work` vs `client_request`), and assignee with active filter reset.
  - **Slide-Over Task Details (`task-detail-sheet.tsx`):** Built slide-over sheet displaying metadata, linked deliverable indicators, description, status machine transitions, and real-time collaboration comment feed.
  - **Creation, Edit & Archive Modals (`task-create-dialog.tsx`, `task-edit-dialog.tsx`, `task-archive-dialog.tsx`):** Type-safe forms powered by React Hook Form + Zod (`CreateTaskSchema`, `UpdateTaskSchema`), with `useWatch` optimization for React Compiler, client request gating on internal projects, and soft-delete with optional audit reason.
  - **Real-Time Collaboration Comments (`task-comments-section.tsx`):** Collaboration feed and compose form capturing `author_capacity_snapshot` and localized time-ago timestamps.
- **🛠 Architecture & Boundaries:**
  - **Server Actions Layer (`src/lib/projects/task-actions.ts`):** Implemented `createTaskAction`, `updateTaskAction`, `transitionTaskStatusAction`, `archiveTaskAction`, `createTaskCommentAction`, and `listTaskCommentsAction` with role checks, transactional RPC execution, and targeted path revalidation.
  - **Workspace Shell Integration (`project-workspace-shell.tsx`):** Replaced `TasksTabPlaceholder` with `<TasksTab>` in `ProjectWorkspaceShell`.
  - **Server Pre-Fetching:** Updated `/admin/proyectos/[id]` and `/pm/proyectos/[id]` page loaders to pre-fetch tasks via `listProjectTasks(supabase, id)` in parallel with project details.
  - **Strict Line Limits:** Kept all 16 component and server action modules strictly under 400 lines (max 394 lines in `actions.ts`).
  - **Localization Parity (`messages/es-MX.json` & `messages/en-US.json`):** 100% key parity under `projects.tasks.*` adhering strictly to `VC-I18N-008` (pure camelCase segments without forbidden keywords).
- **🐛 Hotfixes:**
  - **Server Action AST Module Transform:** Segregated task actions into dedicated `src/lib/projects/task-actions.ts` to eliminate Next.js server actions re-export bundler conflict and guarantee smooth production Turbopack builds.
- **🧪 Verification & Build:**
  - `npm run test`: All 276 tests across 41 test suites passing (including 61 project tests in `__tests__/projects/`).
  - `npm run typecheck`: 0 TypeScript errors.
  - `npm run lint`: 0 ESLint errors.
  - `npm run build`: Production Turbopack build succeeded with all static & dynamic routes compiled.

## [2026-08-19 @ 14:46]

**🚀 Project Directory, Project Creation, and Membership Governance (S04-03)**

- **Flexible Client Project Creation in Planning Stage:**
  - Added migration `20260819140000_s04_03_flexible_client_project_planning.sql` updating `private.validate_project_memberships()` to permit `0` client members and `null` `client_id` for client projects in `planning` status, while strictly enforcing $\ge 1$ client member and valid `client_id` upon advancing to active non-planning states.
  - Updated `CreateProjectSchema` and `UpdateProjectSchema` to make `client_id` optional and attachable later.
- **Server Actions Layer (`src/lib/projects/actions.ts`):**
  - Implemented `createProjectAction`, `updateProjectAction`, `addProjectMemberAction`, `updateProjectMemberAction`, `removeProjectMemberAction`, `setPrimaryPmLeadAction`, `transitionProjectStatusAction`, `archiveProjectAction`, and `restoreProjectAction` with strict role authorization, atomic rollback on member init failures, and path revalidation.
- **Navigation Integration:**
  - Activated live navigation links for `/admin/proyectos` and `/pm/proyectos` in desktop `AppNav` and responsive `MobileNavToggle`.
- **Project Directory Components (`src/components/shared/projects/project-directory/`):**
  - Created `ProjectDirectoryView`, `ProjectFilters`, `ProjectTable`, `ProjectCardList`, and `ProjectEmptyState` with debounced search, status and type filters, and responsive views.
- **Project Workspace & Governance (`src/components/shared/projects/project-workspace/` & `project-members/`):**
  - Created `ProjectWorkspaceShell`, `ProjectHeader`, `ProjectOverviewTab` (with Setup Warning Banner and quick client linking CTA), `ProjectEditDialog`, and `ProjectStatusDialog`.
  - Created `MemberRosterTab`, `MemberCapacityBadge` (with primary PM Lead star indicator), `AddMemberDialog`, `ChangeCapacityDialog`, `SetPrimaryLeadDialog`, and `RemoveMemberDialog`.
- **App Router Pages (`/admin/proyectos` & `/pm/proyectos`):**
  - Implemented full directory, creation forms (`AdminCreateForm`, `PmCreateForm`), and workspace detail pages with dedicated loading skeletons and error boundaries for both Admin and PM roles.
- **Automated Test Suite:**
  - Added unit and component tests in `__tests__/projects/` (`actions.test.ts`, `directory-view.test.tsx`, `membership-governance.test.tsx`, `schemas.test.ts`, `errors.test.ts`).
- **Verification:** All 254 test cases across 38 test suites passing; `npm run typecheck` and `npm run lint` clean with zero errors.

## [2026-08-19 @ 13:20]

**⚙️ Feature Data Layer & Command Boundary Reconciliation (S04-02)**

- **Authoritative Feature Data Layer (`src/lib/`):**
  - **Projects & Tasks Domain (`src/lib/projects/`):**
    - `schemas.ts`: Added strict Zod schemas with refinements (`CreateProjectSchema` enforcing client/internal organization constraints, `UpdateProjectSchema`, `TransitionProjectStatusSchema`, `RecoverProjectStatusSchema`, `AddProjectMemberSchema`, `UpdateProjectMemberSchema`, `CreateTaskSchema`, `UpdateTaskSchema`, and `TransitionTaskStatusSchema`).
    - `queries.ts`: Implemented typed server reads (`listProjectsForAdmin`, `listProjectsForPm`, `getProjectDetail`, `getCompletionCycles`, `listEligiblePmUsers`, `listEligibleOperators`, `listEligibleClientMembers`, `getProjectMembers`, `listProjectTasks`, `getTaskDetail`, `listTaskResources`).
    - `commands.ts`: Implemented type-safe server command adapters for RPCs (`transition_project_status`, `recover_project_status`, `get_project_completion_readiness`, `transition_task_status`, `soft_delete_entity`, `restore_entity`) and typed table operations (`createProject`, `updateProject`, `addProjectMember`, `updateProjectMember`, `setPrimaryPmLead`, `createTask`, `updateTask`).
    - `errors.ts`: Centralized safe error mapper (`mapSupabaseError`) and `CommandResult<T>` discriminated union for non-leaking error responses.
  - **Deliverables Domain (`src/lib/deliverables/`):**
    - `validators.ts`: Pure lexical Google Drive URL validator (`isValidGoogleDriveUrl` & `GOOGLE_DRIVE_URL_REGEX`) matching server-side RPC constraint `^https://(drive\.google\.com|docs\.google\.com)/` without network dereferencing.
    - `schemas.ts`: Added Zod schemas for deliverable creation (`CreateDeliverableSchema` production-only), planning updates (`UpdateDeliverableSchema`), submission (`SubmitDeliverableVersionSchema`), internal review (`ReviewDeliverableSchema` with mandatory comments on `changes_requested`), and link incident reporting (`ReportBrokenLinkSchema`).
    - `queries.ts`: Implemented typed server reads for deliverables, immutable version history (`listDeliverableVersions`), and version feedback (`listVersionFeedback`).
    - `commands.ts`: Implemented command adapters calling RPCs (`submit_deliverable_version`, `review_deliverable`, `mark_deliverable_delivered`, `report_broken_link`, `soft_delete_entity`) and typed table operations (`createDeliverable`, `updateDeliverable`).
    - `errors.ts`: Re-exported domain error types and safe error mappings.
  - **Collaboration Comments Domain (`src/lib/comments/`):**
    - `schemas.ts`: Added `CreateCommentSchema` validating target types (`project`, `task`, `deliverable`) and non-empty comment body.
    - `queries.ts`: Implemented `listComments` query fetching chronological comments with author profiles.
    - `commands.ts`: Implemented `createComment` command adapter invoking RPC `create_collaboration_comment`.
  - **Client Organizations Domain (`src/lib/clients/`):**
    - `schemas.ts`: Added `CreateClientSchema` enforcing URL-safe lowercase slugs and organization fields.
    - `queries.ts`: Implemented `listActiveClients`, `getClientById`, and `listClientContacts`.
    - `commands.ts`: Implemented `createClient` command adapter for organization creation.
- **Automated Test Coverage & Root Organization:**
  - Consolidated 100% of test suites under the root `__tests__/` directory (`__tests__/projects/`, `__tests__/deliverables/`, `__tests__/comments/`, `__tests__/clients/`, `__tests__/lib/`, `__tests__/theme/`).
- **Verification:** All 237 test cases across 35 test suites passing; `npm run typecheck`, `npm run lint`, and `npm run format:check` clean with 0 errors.

## [2026-08-19 @ 12:25]

**🎨 UI & Branding Enhancement: Iniciar Sesión Route**

- **Joya Purple Logo Integration:** Integrated `/joyalogo-purple.svg` directly onto the `/iniciar-sesion` (sign-in) card panel with responsive dimensions, smooth hover scale, and clean layout without an enclosing container box.
- **Ambient Lighting & Aesthetics:** Added subtle radial gradient backdrop glows matching the brand purple / accent palette in both light and dark modes.
- **Form Controls & Micro-Interactions:**
  - Upgraded input fields with Lucide icons (`Mail` and `Lock`), smooth focus rings, and accessible labels.
  - Implemented password visibility toggle button (`Eye` / `EyeOff`) with accessible ARIA label.
  - Added animated spinner (`Loader2`) for submit button loading states.
  - Enhanced error banner styling with `AlertCircle` icon.
- **Header Controls:** Added `ThemeToggle` alongside `LanguageSwitcher` in the sign-in page header.
- **ThemeToggle Hydration Refinement:** Updated `ThemeToggle` to utilize `useSyncExternalStore` for client mount detection, eliminating cascading renders and satisfying React 19 / ESLint rules.
- **Verification:** All 190 test cases across 29 test suites passing; TypeScript, ESLint, and Prettier passing with zero errors.

## [2026-08-19 @ 12:05]

**🎨 Visual Foundation & UI Architecture (S04-01)**

- **shadcn/ui & Design System Initialization:** Initialized shadcn/ui with Base UI Mira style, Neutral base palette, Indigo accent (`238 75% 60%`), and Lucide icon library configured for Tailwind CSS v4 via `@theme inline` tokens in `src/app/globals.css` and `components.json`.
- **UI Primitives Inventory:** Installed 20 required accessible UI primitives under `src/components/ui/` (`button`, `input`, `label`, `textarea`, `select`, `checkbox`, `badge`, `card`, `table`, `tabs`, `dialog`, `alert-dialog`, `sheet`, `dropdown-menu`, `popover`, `command`, `separator`, `skeleton`, `tooltip`, `sonner`, `input-group`).
- **CSP-Compliant Font Configuration:** Configured Google Fonts `Inter` (`--font-sans`) and `Geist_Mono` (`--font-mono`) self-hosted via `next/font/google` in `src/app/layout.tsx`, fully compliant with strict CSP (`font-src 'self' data:`).
- **Native Theme Switching & Persistence:**
  - Implemented `ThemeProvider` (`src/components/shared/theme/theme-provider.tsx`) wrapping `next-themes` with `defaultTheme="light"`, `enableSystem={false}`, and local storage persistence (`jsf-pm-theme`), with dev-mode console filtering for React 19 SSR anti-FOUC script tags.
  - Created `ThemeToggle` (`src/components/shared/theme/theme-toggle.tsx`) accessible dropdown menu with dynamic ARIA labels describing next actions, `aria-pressed`, `aria-current`, keyboard navigation, and a mounted lifecycle guard to eliminate SSR hydration mismatch with client-stored dark mode.
  - Added global `Toaster` component with `richColors` and bottom-right positioning.
- **Semantic Status Maps:** Created centralized semantic status and priority maps (`src/lib/status-maps.ts`) for `ProjectStatus`, `TaskStatus`, `TaskPriority` (with distinct `blocking` priority), `DeliverableStatus`, and `MemberCapacity`.
- **Global Shell & Auth Sweeps:**
  - Replaced hardcoded zinc/neutral styles and placeholder initials with semantic token classes, shadcn UI primitives, and `public/joya-icon.svg` brand mark across `AppNav`, `MobileNavToggle`, `NotificationBadge`, `SignOutButton`, and `LanguageSwitcher`.
  - Updated protected layouts, loading skeletons (`Skeleton`), and error boundaries across Admin, PM, Operator, and Client dashboards.
  - Upgraded authentication forms (`sign-in-form`, `reset-password-form`, `update-password-form`, `invitation-form`, `sesion-expirada`) to shadcn `Input`, `Label`, `Button`, and `Checkbox` primitives.
- **Localization (i18n):** Added 6 `theme.*` translation keys and navigation ARIA labels in both `messages/es-MX.json` and `messages/en-US.json`.
- **Automated Testing & Accessibility:**
  - Added unit test suites for `ThemeProvider` (`src/components/shared/theme/__tests__/theme-provider.test.tsx`) and `ThemeToggle` (`src/components/shared/theme/__tests__/theme-toggle.test.tsx`), validating default light mode, local storage persistence, `enableSystem={false}`, next-action ARIA labels, and zero `jest-axe` accessibility violations.
  - All 190 tests across 29 test suites passing; TypeScript, ESLint, Prettier, and Next.js production build (`npm run build`) passing with zero errors.

## [2026-08-19 @ 10:50]

**📋 Sprint 04 — Spec Updates (Project Owner decisions recorded)**

- Updated `dev-docs/specs/s04/s04-specs/s04-01-visual-foundation-shadcn-theming-spec.md` with two resolved Project Owner decisions:
  - **FLAG 3 resolved — Brand mark:** Use `public/joya-icon.svg` via `next/image` (`<Image src="/joya-icon.svg" alt="Joya" width={32} height={32} />`); fall back to plain `<img>` if SVG intrinsic-dimension issues arise; amber circle remains the last-resort exception
  - **FLAG 4 resolved — Monospace font:** shadcn/ui ships with Geist Mono as its standard mono font; load `Geist_Mono` from `next/font/google` and assign to `--font-mono` CSS variable (self-hosted, CSP-compliant); both `fontSans.variable` and `fontMono.variable` applied to `<html className>` in root layout
  - Updated Step 3b layout code, Step 7 brand mark instruction, acceptance criteria §7.2 checklist, and both FLAG sections to reflect the resolved state

## [2026-08-19 @ 10:37]

**📋 Sprint 04 — Documentation & Spec**

- Created `dev-docs/specs/s04/s04-specs/s04-01-visual-foundation-shadcn-theming-spec.md` (1,089 lines): highly detailed implementation specification for work item S04-01 (Visual Foundation: shadcn/ui initialization and persisted native theming), covering:
  - Pre-implementation baseline inventory (existing font conflicts, globals.css problems, CSP constraint)
  - Authoritative record of all Project Owner visual decisions (Mira style, Neutral palette, Indigo accent, Lucide icons, preset `b2J0x9uLeE`)
  - 12-step ordered implementation sequence with exact code snippets for root layout, ThemeProvider, ThemeToggle, globals.css rewrite, and CLI invocations
  - CSP conflict flag: Google Fonts CDN blocked; font loading must use `next/font/google` only
  - `prefers-color-scheme` conflict flag: existing media query must be removed to support `defaultTheme="light"` requirement
  - Sprint 04 shadcn primitive inventory install command (`button`, `input`, `label`, `textarea`, `select`, `checkbox`, `badge`, `card`, `table`, `tabs`, `dialog`, `alert-dialog`, `sheet`, `dropdown-menu`, `popover`, `command`, `separator`, `skeleton`, `tooltip`, `sonner`, `form`)
  - Full authenticated shell token sweep (AppNav, MobileNavToggle, protected layout, loading, error, auth forms) with old→new class replacement table
  - Semantic status mapping utilities specification (`src/lib/status-maps.ts`) for project status, task status, task priority, deliverable state, and member capacity
  - i18n key additions for `theme` namespace (6 keys) and `shell.nav` aria-label keys in both es-MX and en-US catalogs
  - Focused automated test requirements (ThemeProvider + ThemeToggle, 7+4 cases)
  - 8 acceptance criteria sections and full verification command suite
  - Explicit confirmation that no Supabase MCP operations are required for S04-01

## [2026-08-19 @ 09:31]

**⚙️ CI & Build Automation**

- Configured build-time mock environment variables in `.github/workflows/ci.yml` (`test-build` job), providing dummy `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY` during `npm run build` static route evaluation on headless CI runners

## [2026-08-18 @ 17:53]

**🚀 Features & Accessibility**

- Added global one-click `LanguageSwitcher` client component (`src/components/shared/language-switcher/language-switcher.tsx`) enabling immediate toggle between Spanish (`es-MX`) and English (`en-US`) with instant route replacement and active language highlight (`ES / EN`)
- Integrated `LanguageSwitcher` across the global desktop navigation bar (`AppNav`), mobile navigation drawer (`MobileNavToggle`), and all public account entry pages (`iniciar-sesion`, `restablecer-contrasena`, `actualizar-contrasena`, `invitacion`, `sesion-expirada`, `privacidad`)
- Added dedicated unit test suite (`__tests__/i18n/language-switcher.test.tsx`) verifying language switching, ARIA labels, and active states

## [2026-08-18 @ 17:42]

**🚀 Features & Architecture**

- Relocated protected route group into localized tree (`src/app/[locale]/(protected)/`), establishing clean unprefixed Spanish routes (`/admin`, `/pm`, `/operador`, `/cliente`) alongside localized English prefixed routes (`/en/admin`, `/en/pm`, etc.) under Next.js App Router and next-intl
- Implemented root route (`/` and `/en`) smart auto-redirect in `src/app/[locale]/page.tsx`, seamlessly redirecting unauthenticated visitors to `/iniciar-sesion` (or `/en/iniciar-sesion`) and authenticated sessions directly to their authoritative role dashboard
- Updated Content Security Policy (CSP) in `next.config.ts` to allow `'unsafe-eval'` strictly during development (`process.env.NODE_ENV !== "production"`), resolving React 19 / Turbopack dev-mode callstack reconstruction and eliminating browser console error overlays

## [2026-08-18 @ 16:15]

**🚀 Features & Testing**

- Added negative-path and cross-boundary security test suite (`__tests__/auth/negative-path.test.ts`, 19 tests) covering N-01 through N-20: invitation expiration/replay/mismatch handling, Zod token schema validation, magic link account-enumeration protection, password policy enforcement, deep-link unauthenticated & cross-role redirection, inactive/deleted profile containment, raw token leakage prevention, and credential exposure guards
- Added positive-path cross-role integration test suite (`__tests__/integration/role-journey.test.ts`, 13 tests) covering P-01 through P-24: role landing access for Admin, PM, Operator, and Client; profile full name rendering across all shells and `AppNav`; sign-out button interactions; landmark structure verification (`<nav aria-label>` and `<main id="main-content">`); accessibility attributes (`aria-current`, `aria-expanded`, `aria-disabled`, `aria-controls`, `aria-live`); and sign-in page locale isolation

**📖 Documentation**

- Created development persona access guide (`dev-docs/specs/s03/s03-e03-03-dev-persona-access.md`) documenting local-only authentication procedures for all 9 seeded personas, reference vs. sandbox corpora segregation, and access denial demonstration steps
- Created sprint closeout verification note (`dev-docs/specs/s03/s03-sprint-03-closeout-verification.md`) recording full definition of done compliance, changed file manifest, exact verification metrics (177 tests across 26 suites, 78.57% line coverage, 0 audit vulnerabilities), all 20 manual localhost journey records (J-01 through J-20), localization and accessibility impacts, and the Sprint 04 hand-off contract

## [2026-08-18 @ 15:30]

**🚀 Features**

- Implemented server-side protected route layout (`src/app/(protected)/layout.tsx`) utilizing `requireSession` to enforce authentication, profile activity, and cross-role URL containment with canonical redirection (`ROLE_DEFAULT_PATHS`)
- Added global navigation server component `AppNav` (`src/components/shared/app-nav/app-nav.tsx`) with role-safe navigation links, localized user profile affordances, in-app `NotificationBadge`, `SignOutButton` client component, and accessible `MobileNavToggle` drawer
- Created role-safe landing pages for all 4 personas: Admin (`/admin`), PM (`/pm`), Operator (`/operador`), and Client (`/cliente`) with dedicated loading skeletons (`loading.tsx`) and safe error boundary (`error.tsx`)
- Implemented `src/lib/shell-data/shell-queries.ts` server-only typed data query layer reading from S02 security-invoker views (`notification_unread_counts_view`, `operator_agenda_view`, `client_project_view`) and tables with debug logging and fallback resilience
- Added 35 `shell.*` localized message strings across `messages/es-MX.json` and `messages/en-US.json` with 100% key and token parity

**🧪 Tests**

- Added unit test suites for protected shell and navigation: `__tests__/app-shell/route-guard.test.ts` (11 tests), `__tests__/app-shell/role-landing.test.ts` (8 tests), `__tests__/app-shell/navigation.test.ts` (9 tests), and `__tests__/app-shell/shell-queries.test.ts` (11 tests)
- Updated `__tests__/i18n/key-naming.test.ts` to permit semantic naming segments for the `shell` namespace

## [2026-08-18 @ 15:00]

**📖 Documentation**

- Created implementation specification `dev-docs/specs/s03/s03-e03-02-role-safe-protected-shell-and-navigation-v1.0.md` for work item S03-E03-02, covering: protected route-group layout with server-side role guard and cross-role redirect enforcement; four role landing pages (Admin, PM, Operator, Client) with typed shell data reads from S02 permitted views; global `AppNav` server component with role-appropriate links, notification unread-count badge, sign-out client component, and accessible mobile drawer; `shell-queries.ts` server-only data module; loading skeletons and error boundaries; 35 new `shell.*` locale keys with es-MX/en-US parity; and a full test matrix across route guards, role landings, navigation, shell queries, localization, and accessibility assertions

## [2026-08-18 @ 14:45]


**🚀 Features**

- Implemented server-authoritative session utility (`src/lib/auth/session.ts`) with `requireSession` and `getOptionalSession` resolving the authenticated user, active `profiles` row, and authoritative `profiles.role`
- Added OpenAPI-compliant Zod validation schemas (`src/lib/validation/auth.ts`) defining single-source password policy, `CompleteInviteSchema`, `MagicLinkSchema`, `SignInSchema`, and `PasswordUpdateSchema`
- Created API route handlers: `POST /api/v1/auth/invites/complete` (server-side token hashing, admin-client user creation, `accept_invite` RPC execution), `POST /api/v1/auth/magic-link` (account-enumeration-safe existing-account OTP), and `GET /api/auth/callback` (PKCE/OTP session exchange)
- Added localized account-entry pages and client forms under `src/app/[locale]/` for sign-in (`iniciar-sesion`), password reset request (`restablecer-contrasena`), password update (`actualizar-contrasena`), invitation redemption (`invitacion`), and session expired/invalid link feedback (`sesion-expirada`)
- Updated Next.js middleware (`src/proxy.ts` and `src/lib/auth/middleware-session.ts`) to synchronize Supabase session refresh cookies alongside next-intl routing
- Added 28 `auth.*` translation keys to `messages/es-MX.json` and `messages/en-US.json` with 100% key parity
- Adjusted ESLint restricted imports (`eslint.config.mjs`) to permit privileged admin client imports within server-only API routes (`src/app/api/**`) while maintaining strict boundaries across client and shared code

**🧪 Tests**

- Added 6 focused test suites under `__tests__/auth/` with 46 tests covering schema validation, fail-closed session errors, token redemption lifecycle, enumeration safety, recovery flows, and message catalog parity
- Updated `__tests__/i18n/key-naming.test.ts` to include the `auth` namespace

## [2026-08-18 @ 13:45]

**📖 Documentation**

- Created implementation specification `dev-docs/specs/s03/s03-e03-01-invite-only-account-entry-and-session-lifecycle-v1.0.md` for work item S03-E03-01, covering: localized account-entry pages (sign-in, password reset, password update, invitation redemption, session-expired), the `completeInvite` and `requestMagicLink` route handlers, Auth callback, `requireSession` session utility, Zod validation schemas, middleware session-refresh update, locale catalog additions, role-route constants, and full negative/positive/localization test matrix

## [2026-08-18 @ 12:08]


**🚀 Features**

- Applied public table access grants migration (`supabase/migrations/20260818170000_s02_e02_public_table_grants.sql`) establishing PostgREST SQL grants for `service_role` and `authenticated` roles under RLS, with zero table access granted to `anon`
- Applied trigger fix migration (`supabase/migrations/20260818171000_s02_e02_fix_project_membership_trigger.sql`) correcting record polymorphism in `private.validate_project_memberships()` across `projects` and `project_members` tables
- Applied security tightening migration (`supabase/migrations/20260818172000_s02_e02_tighten_rls_auto_enable.sql`) revoking `anon` execution on `public.rls_auto_enable()`
- Applied performance optimization migration (`supabase/migrations/20260818173000_s02_e02_drop_duplicate_indexes.sql`) dropping redundant duplicate unique indexes on `invite_tokens` and `notification_events`
- Updated `scripts/bootstrap-dev-demo-data.ts` with atomic project membership batching and `submission_deadline_at` on client-submission deliverables
- Successfully executed and validated `npm run db:bootstrap` against `jsf-pm-dev` remote database across two consecutive runs, proving 100% idempotency and establishing the complete 6-project demo sandbox

## [2026-08-18 @ 11:45]

**🚀 Features**

- Completed synthetic demo data bootstrap (`scripts/bootstrap-dev-demo-data.ts`) supporting 6 distinct projects: 4 reference projects (`Acme Brand Relaunch`, `Internal Workflow Automation`, `Acme Commercial Q1`, `Acme Teaser 2025`), 1 client isolation project (`Starlight Summer Campaign`), and 1 designated interactive sandbox project (`Acme Sandbox Campaign`)
- Added complete synthetic demo records: low-priority task (`Brand Asset Archiving`), `client_contacts` linking Acme Corp and Starlight Media personas, Deliverable 2 (`Hero Promo Teaser Cut`) under Operator B, `collaboration_comments` across team capacities, and `notification_events` / `notification_recipients` with unread in-app queues
- Implemented `assertDbSuccess` in `scripts/bootstrap-dev-demo-data.ts` to fail loudly on any database mutation failure with contextual entity details
- Seeded canonical completion `audit_logs` entry for `Acme Commercial Q1` enabling `project_completion_cycles_view` derivations

**🧪 Tests**

- Tightened static schema contract suite (`__tests__/database/schema-contract.test.ts`) with scoped enum declaration block verification, per-view `WITH (security_invoker = true)` clause assertions, and workspace-wide Prisma absence scans

**📖 Documentation**

- Updated manual verification checklist (`dev-docs/specs/s02/s02-e02-data-plane-manual-verification.md`) to version 1.2, defining inspection protocols for all 6 projects, Deliverable 2, notification queues, collaboration comments, and interactive sandbox mutations

## [2026-08-18 @ 10:50]

**🚀 Features**

- Added persistent development-demo data bootstrap script (`scripts/bootstrap-dev-demo-data.ts`) with opt-in package command (`npm run db:bootstrap`) that idempotently reconciles 9 synthetic Auth personas (`@demo.jsf.internal`), client organizations, multi-lead client projects, internal projects, tasks, production review chains, client submissions, and milestones in `jsf-pm-dev`
- Added Auth-independent idempotent static configuration seed (`supabase/seed.sql`) for logical WhatsApp templates with partial unique index conflict handling

**🧪 Tests**

- Added static schema-contract test suite (`__tests__/database/schema-contract.test.ts`) validating 18 public tables, 22 enums (including `review_decision`), 9 security-invoker views, 16 public RPC functions, and the complete absence of Prisma

**📖 Documentation**

- Created manual data-plane verification checklist (`dev-docs/specs/s02/s02-e02-data-plane-manual-verification.md`) defining milestone-based manual verification across all 9 synthetic roles and isolation boundaries
- Documented `DEV_DEMO_PASSWORD` placeholder in `.env.example`

## [2026-08-18 @ 08:55]

**🚀 Features**

- Implemented authoritative Postgres data platform and access control schema (`supabase/migrations/20260818143500_s02_e02_authoritative_data_platform.sql`) covering 22 enums, 18 tables, 12 private authorization functions, 18 transactional RPCs, 24 partial/unique indexes, and 9 security-invoker views
- Enforced strict RLS policies across all public tables with `auth.uid()` subquery encapsulation and immutable audit/event triggers
- Applied migration to `jsf-pm-dev` remote Supabase database and generated untouched TypeScript database contract (`src/lib/database.types.ts`)
- Added realtime publication for `notification_recipients` and seeded initial WhatsApp notification templates

**🧪 Tests**

- Updated `__tests__/config/credential-exposure.test.ts` key regex boundary patterns to prevent substring false-positives on identifier tokens like `task_resources_task_id_fkey`

## [2026-08-17 @ 16:15]

**🛠 Architecture**

- Migrated deprecated Next.js `middleware.ts` to `proxy.ts` (`src/proxy.ts`) in accordance with Next.js 16 file conventions
- Updated ESLint restricted imports config (`eslint.config.mjs`) to include `proxy.ts` in structural isolation rules for privileged admin client

## [2026-08-17 @ 16:02]

**🚀 Features**

- Added global browser-security response headers in `next.config.ts` (Content-Security-Policy, X-Frame-Options, Referrer-Policy, Permissions-Policy, X-Content-Type-Options, Strict-Transport-Security)
- Created typed catalog-backed error copy helper (`src/lib/error-copy.ts`) with pathname-based locale selection
- Added localized route-segment error boundary (`src/app/[locale]/error.tsx`) and root error boundary (`src/app/global-error.tsx`)
- Added `errors` namespace to `messages/es-MX.json` and `messages/en-US.json`
- Implemented structured JSON logger (`src/lib/logger.ts`) with recursive sensitive-data redaction, circular reference handling, and request-scoped logger factory
- Implemented Sentry capture seam (`src/lib/sentry.ts`) with no-op handling for unconfigured environments and sanitized exception formatting

**🧪 Tests**

- Added unit tests for structured logger serialization, redaction, request correlation, and safe unusual values (`src/lib/__tests__/logger.test.ts`)
- Added unit tests for Sentry DSN resolution, environment fallback, and unconfigured no-op behavior (`src/lib/__tests__/sentry.test.ts`)
- Updated message catalog key-naming test to recognize `errors` namespace (`__tests__/i18n/key-naming.test.ts`)

## [2026-08-17 @ 14:45]

**🚀 Features**

- Implemented public runtime configuration boundary (`src/config/app.config.ts`) validating only `NEXT_PUBLIC_*` environment variables using Zod with presence-only check for `NEXT_PUBLIC_APP_URL` and HTTPS validation for `NEXT_PUBLIC_SUPABASE_URL`
- Implemented server-only configuration boundary (`src/config/server.config.ts`) validating `SUPABASE_SECRET_KEY` synchronously at load time with secret redaction
- Added browser Supabase client factory (`src/lib/supabase/browser.ts`) using `@supabase/ssr` `createBrowserClient`
- Added request-context server Supabase client factory (`src/lib/supabase/server.ts`) using `@supabase/ssr` `createServerClient` and modern `getAll`/`setAll` cookie adapter
- Added privileged server-only admin Supabase client factory (`src/lib/supabase/admin.ts`) using `@supabase/supabase-js` `createClient`

**🛠 Architecture**

- Configured ESLint structural restricted import rules (`eslint.config.mjs`) forbidding `@prisma/client` and `prisma` across application code and restricting privileged admin client (`src/lib/supabase/admin`) from client components, shared modules, and middleware
- Added Vitest configuration (`vitest.config.mts`) with path alias resolution

## [2026-08-17 @ 14:34]

**🧪 Tests**

- Corrected `__tests__/config/server.config.test.ts` (TC-CFG-002) Test 1 to assert successful module resolution and `serverConfig` validation when a valid `SUPABASE_SECRET_KEY` is present, aligning with REQ-CFG-004 fail-closed specification.

## [2026-08-15 @ 13:40]

**🚀 Features**

- Implemented localized public application shell using `next-intl`
- Added canonical routes `/`, `/privacidad`, `/en/`, and `/en/privacidad`
- Set `es-MX` as the default locale served without a prefix
- Added `messages/es-MX.json` and `messages/en-US.json` message catalogs
- Generated localized sitemap (`sitemap.ts`) reflecting canonical routes
- Configured robots.txt (`robots.ts`) with `Disallow: /` for non-production environments
- Added localized layout and privacy pages

**🛠 Architecture**

- Added `next-intl` configuration (`routing.ts`, `request.ts`, `types.ts`)
- Configured locale-aware Next.js middleware to enforce canonical routing paths
- Injected dynamic metadata translation support into the root layout
- Migrated standard page structure into `[locale]` segment
