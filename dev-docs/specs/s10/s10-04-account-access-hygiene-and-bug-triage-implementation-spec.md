---
document_id: S10-04-ACCOUNT-ACCESS-HYGIENE-AND-BUG-TRIAGE-IMPLEMENTATION-SPEC-01
sprint_id: S10
work_items: [S10-04]
status: implementation-ready
created_at: 2026-09-02T00:00:00-06:00
target_environment: jsf-pm-dev
implementation_consumer: Antigravity
schema_baseline:
  - 20260902090000_s10_04_account_access_hygiene_bug_triage_and_s10_03_closure
required_forward_migration:
  - supabase/migrations/20260902180000_s10-04-access-hygiene-completeness-repair.sql
  - supabase/migrations/20260902130917_s10-04-directory-keyset-cursor-projection-repair.sql
  - supabase/migrations/20260902190000_s10-04-directory-keyset-cursor-post-repair.sql
generated_types: src/lib/database.types.ts
---

# S10-04 — Account, Access Hygiene, and Bug Triage

## 1. Authority, outcome, and hard gate

This is the complete implementation authority for **S10-04 only**. It implements bounded self-account settings, a global Admin/PM access-management surface, stale-access reminder recording, and authenticated bug intake/triage. It does not authorize S10-05, S10-06, provider activation, production work, authentication redesign, invitation administration redesign, user provisioning, or any S10-03 lifecycle change.

The applied database baseline is `20260902090000_s10_04_account_access_hygiene_bug_triage_and_s10_03_closure` on `jsf-pm-dev`, followed by completeness repair `20260902180000_s10-04-access-hygiene-completeness-repair.sql`, cursor repair `20260902130917_s10-04-directory-keyset-cursor-projection-repair.sql`, and post-repair `20260902190000_s10-04-directory-keyset-cursor-post-repair.sql`, all confirmed applied in the remote migration ledger. TypeScript declarations in `src/lib/database.types.ts` are regenerated via Supabase MCP, with `list_user_access_directory` correctly exposing `created_at: string` for composite keyset pagination.

Reason: M04 tracks assignment and membership changes but has no `auth.users.last_sign_in_at` trigger, and its qualifying-access/directory-count predicates did not exclude the S10-defined inactive `cancelled` project state or refresh state on a project status transition. The repair adds a narrowly scoped `auth.users` trigger, extends the existing project lifecycle trigger binding to `status`, aligns both trusted predicates, and performs a truthful post-M04-only data correction. It preserves M04’s rule that activity before M04 initialization cannot be invented as historical evidence.

Do not edit the applied M04 migration. Do not hand-edit generated types. Do not implement an application-side replacement for the trigger, because a reminder-period reset must follow Supabase Auth’s authoritative successful sign-in state rather than an arbitrary protected-page request.

## 2. Accepted policy and role matrix

`profiles.role` is the sole application-role authority. `pm_lead` and `pm_watcher` remain project-membership capacities and never narrow an active PM’s global S10-04 capability.

| Capability | Admin | PM | Operator | Client | Anonymous/inactive/deleted profile |
| --- | --- | --- | --- | --- | --- |
| Read/change own bounded settings | Yes, self only | Yes, self only | Yes, self only | Yes, self only | Deny |
| Submit a bug report | Yes | Yes | Yes | Yes | Deny |
| See global user access directory | Yes | Yes | No | No | Deny |
| Deactivate/reactivate another profile | Yes | Yes | No | No | Deny |
| Deactivate/reactivate self | Never | Never | Never | Never | Deny |
| See stale-access candidates / record reminder | Yes | Yes | No | No | Deny |
| See all bug reports / change status | Yes | Yes | No | No | Deny |
| Change a role, email, Auth user, contact, membership, assignment, consent, or notification history | Never | Never | Never | Never | Never |

No permanent user deletion exists. `profiles.is_active = false` is **application access deactivation only**: it neither deletes/bans/disables `auth.users` nor erases history. Existing server session enforcement already treats an inactive profile as unusable through `requireSession`; do not add client-only guards as a substitute.

## 3. Database contract after the gate

### 3.1 Direct-table prohibition

The following tables have RLS enabled and all direct browser-role table privileges revoked: `user_access_actions`, `user_access_hygiene_state`, `stale_access_reminders`, and `bug_reports`. The application must access them only through the declared RPCs below. Do not read/write `profiles` directly for this feature, even for self settings. Do not add RLS policies, grants, service-role browser code, views, or a table escape hatch.

The existing `profiles` SELECT policy is not a directory contract; it is not authorization to construct a browser-side user directory. Contact, invitation token/hash, email, Auth metadata, consent, phone, avatar, `last_seen_at`, raw access-action history, reminder decision identity, and audit-log content are excluded from all S10-04 DTOs and UI.

### 3.2 RPC contract: self account

`get_own_account_settings()` returns exactly one row only for the active caller:

```text
user_id, full_name, preferred_locale, timezone,
email_notifications_enabled, role
```

`update_own_account_settings(p_full_name text, p_preferred_locale text, p_timezone text, p_email_notifications_enabled boolean)` returns exactly one `{ success: boolean, code: text }` row.

Only these fields may be edited:

- `full_name`: trim before send; non-empty after trim; maximum 120 characters.
- `preferred_locale`: exactly `en-US` or `es-MX`.
- `timezone`: a non-empty valid IANA name accepted by the RPC/database.
- `email_notifications_enabled`: explicit boolean.

The displayed role is read-only. Do not surface editable role, email, password, phone, avatar, WhatsApp preference/consent, activity timestamps, `is_active`, or deletion state. Password recovery/update remains its existing separate flow and is out of scope.

The action must treat a missing row, RPC error, malformed row, `success !== true`, or unrecognized code as a safe failure. It must not optimistically claim saved state. On success, revalidate every locale variant of `/cuenta` and refresh the active route; update the form from the server-confirmed input only after a successful result.

### 3.3 RPC contract: global access directory

`list_user_access_directory(p_before_created_at timestamptz | null, p_before_user_id uuid | null, p_limit integer)` is callable only by active Admin/PM and returns these role-safe fields:

```text
user_id, full_name, application_role, is_active, last_successful_auth_at,
active_project_membership_count, active_task_assignment_count,
active_deliverable_assignment_count, pending_invitation_count,
last_access_action, last_access_action_at
```

The cursor is composite and inseparable: either both `beforeCreatedAt` and `beforeUserId` are absent for the first page, or both are valid ISO timestamp/UUID values. Use a fixed application page size of 25. Request 26 rows, validate all 26 rows before slicing, set `hasMore` from the extra row, and construct `nextCursor` only from item 25’s creation cursor/value. The SQL order is `profiles.created_at DESC, profiles.id DESC`; application pagination must preserve it. Do not use offset pagination, sorting controls, client-side counts/aggregation, or name search that encourages broader profile retrieval.

Validate UUIDs, timestamp strings, the four allowed app roles, booleans, non-negative safe integers, and `last_access_action` as `null | deactivated | reactivated`. Reject the entire result as unavailable if a row is malformed; never normalize unknown values into a visible user.

All non-deleted profiles are in scope, including inactive users. “Active-user directory” in the sprint plan means a role-safe operational directory with current active/inactive state, not an active-only list that would make reactivation impossible.

### 3.4 Access mutation contract

`set_user_access_state(p_target_user_id uuid, p_is_active boolean)` returns one `{ success, code }` row. Known codes are:

| Code | Client meaning |
| --- | --- |
| `deactivated` / `reactivated` | Mutation committed; close confirmation, announce success, revalidate and refresh. |
| `already_in_requested_state` | Idempotent success; close confirmation and refresh without a false error. |
| `self_lockout_forbidden` | Keep the dialog open; show localized no-self-lockout error; do not refresh as success. |
| `last_management_account_forbidden` | Keep dialog open; show localized continuity-protection error; do not refresh as success. |
| `not_found` | Safe unavailable/not-found state; refresh directory because state is stale. |
| Any unknown/malformed/RPC error | Generic unavailable error; no optimistic mutation. |

The database independently locks the target, blocks self-lockout, and prevents deactivation of the last active Admin/PM account. The UI must not attempt to reproduce those checks from directory data; it may only use them for explanatory copy. Deactivation revokes matching live pending ordinary Client/Operator invitations, records a `user_access_actions` row, and writes non-PII audit evidence. It does not remove memberships, assignments, client contacts, or immutable history. Reactivation does not restore revoked invitations.

Use an explicit destructive confirmation dialog for deactivation. Its title and body must name only the displayed full name and explain: app access stops, relevant pending ordinary invitations are revoked, history is retained, and this is not account deletion. Require the user to enter the exact displayed full name (trimmed exact match) before enabling the confirm action. The dialog must use `AlertDialog`/the repository’s accessible destructive primitive, keep focus within while open, return focus to the initiating row on close, disable only its own controls while pending, and expose server errors with `role="alert"`. Reactivation requires a lighter explicit confirmation but no typed phrase.

### 3.5 Stale-access policy and contract

A Client or Operator is a stale-reminder candidate only when all conditions are true:

1. profile is active and not deleted;
2. role is exactly `client` or `operator`;
3. there is no active qualifying project membership, task assignment, or deliverable assignment under active operational ancestry;
4. a current inactivity period exists and no reminder has been recorded for that exact period; and
5. `max(inactivity_period_started_at, auth.users.last_sign_in_at when present) <= now() - 45 days`.

Admin and PM are deliberately excluded from the candidate list. There is no scheduler, email, WhatsApp, external provider dispatch, notification record, automatic deactivation, or automatic reminder in this slice. “Record reminder” means only auditable internal acknowledgement that a human operator handled the one permitted reminder.

`list_stale_access_reminder_candidates()` returns only `user_id`, `full_name`, `application_role`, and `inactivity_period_started_at`. `record_stale_access_reminder(p_target_user_id uuid)` returns `{ success, code }`; `recorded` is success and `not_eligible_or_already_recorded` is a safe stale/not-eligible result. Do not display last sign-in, access counts, reminder history, decision-maker identity, or inferred reasons in this panel.

The repair migration is part of correctness: it excludes `cancelled` projects from qualifying access and all directory active-assignment counts, refreshes affected hygiene state when `projects.status`, `archived_at`, or `deleted_at` changes, and on a post-M04 successful `last_sign_in_at` update clears the prior period’s deduplication marker and uses that sign-in time as the new period start if the person has no qualifying active access; if qualifying access exists, it clears inactive state. Assignment/membership transitions remain covered by M04’s existing triggers. Historical Auth timestamps before the M04 initialization timestamp are never backfilled as activity. Reactivation intentionally does not reset the period: the accepted sprint policy permits resets only from qualifying authentication or active assignment/membership.

### 3.6 Bug report contract

Every active authenticated role may call:

`submit_bug_report(p_title text, p_description text)` → `{ report_id: uuid, status: 'open' }`.

Input is trimmed before send and must satisfy title 1–160 and description 1–5000 characters after trim. Do not add category, severity, attachment, screenshot upload, URL capture, browser/device telemetry, reproduction metadata, public issue links, reporter email, or external delivery. The report form must tell the user not to include passwords, tokens, payment data, or other sensitive information; that warning does not authorize content inspection/logging.

Only Admin/PM may call:

- `list_bug_reports(p_before_created_at, p_before_report_id, p_limit)`, ordered `created_at DESC, id DESC`, returning only `report_id`, `title`, `description`, `status`, `reporter_role`, `created_at`, `status_changed_at`;
- `set_bug_report_status(p_report_id, p_status)` with one of exact enum values `open | triaged | resolved | dismissed`.

Use the same complete composite cursor discipline and fixed 25/26 page method as the directory. Validate every enum and nullable timestamp. The triage UI must not show reporter identity, email, full name, profile ID, status changer, audit history, or a fabricated resolution note. A report writer sees only the successful submitted acknowledgement, not a report-history list; no self-history RPC exists and no direct-table substitute is permitted.

Status buttons/selectors must include all four exact states. An unchanged status returns `not_found_or_unchanged`; show neutral “no update applied/record may no longer be available” feedback and refresh, never a false success. A non-`open` report displays its `status_changed_at` if present. Returning to `open` is allowed by the database and clears stored status-change actor/time; the UI must not imply a terminal state machine.

## 4. Required application composition

### 4.1 Route map and guards

Create these protected locale-aware App Router routes:

| Route | Server guard | Contents |
| --- | --- | --- |
| `/cuenta` | `requireSession`; all active roles | Own settings and own bug-report form. |
| `/admin/acceso` | `requireSession`; exact `admin`, otherwise locale-preserving redirect to current role default path | Manager access console. |
| `/pm/acceso` | `requireSession`; exact `pm`, otherwise locale-preserving redirect to current role default path | Same manager access console. |

The locale helper creates `/en/...` for English and unprefixed canonical Spanish routes. Do not create `/en/api`, duplicate API routes, role aliases, public routes, query-selected role modes, or cross-role redirects that expose data. A route guard and the RPC both enforce authority; neither replaces the other.

Add `account` to `AppNavigationItemKey`, the navigation builder, desktop icon map, mobile drawer icon map, and both locale catalogs. It is a regular navigation item for all active roles pointing to `/cuenta`. Add `accessManagement` only for Admin/PM, with role-specific `/admin/acceso` or `/pm/acceso`, and update every exhaustive icon/type map. Keep the existing mobile quick-access matrix unchanged: account/access management are discoverable from the mobile drawer, not silently added to the fixed quick-access controls.

### 4.2 Server-only feature boundary

Create `src/lib/account-access/` with a strict split:

- `types.ts`: readonly application DTOs/result unions/cursor types derived from generated `Database` enum/function types where possible; no database row types escape to clients.
- `schemas.ts`: Zod schemas for raw server-action payloads, UUIDs, complete cursors, locale values, account fields, boolean state, typed confirmation phrase, report text, and closed enums.
- `queries.ts`: `import "server-only"`; typed Supabase RPC wrappers; defensive row parsing; 26-row pagination; return only `{ status: 'available', data } | { status: 'unavailable' }`.
- `actions.ts`: `"use server"`; acquire cookies/session; check application role before RPC; validate raw input; call only RPCs; map failures to finite safe result codes; revalidate exact `/cuenta`, `/admin/acceso`, `/pm/acceso` Spanish/English paths after successful relevant mutations.

No client component imports server-only modules. No query/action logs report text, user data, raw Supabase error messages, Auth data, or RPC payloads. Do not use `as any`, unchecked generated rows, `select('*')`, direct database mutation, or service-role access.

The account route server component obtains initial settings through the feature query and renders an unavailable state if absent/malformed. The two manager pages call their respective initial directory, candidate, and bug-report queries independently and pass only safe DTOs into one shared manager console. A failed optional manager panel renders its local unavailable state without replacing the other valid panels or leaking why it failed.

### 4.3 Client components and mobile-first information architecture

Use route-local page wrappers and shared feature components under `src/components/shared/account-access/`. Keep each file below 600 lines; split settings form, report form, directory section, access-state dialog, stale-candidate section, and bug-triage section by responsibility.

**Account page order, mobile first:**

1. Page heading and concise self-only boundary description.
2. Account settings card with full-width controls, read-only role badge, name, native/select locale control, timezone control, email-notification switch, inline validation, save button, and localized status region.
3. Bug-report card with title, description, character counters, sensitive-content warning, submit button, and successful acknowledgement.

On widths below `sm`, every action is full-width or safely wraps; controls have at least 44px touch targets; no horizontal page overflow. Use `max-w-*` readable cards, `min-w-0` at flex containment boundaries, `text-xs`/`text-sm` consistent with the existing mobile-first surfaces, and local `overflow-x-auto` only for genuinely tabular manager content.

**Manager console order:**

1. Heading/description confirming global Admin/PM authority.
2. A single accessible tablist with three panels: **Users**, **Stale access**, **Bug reports**. Do not mount duplicate responsive tab controls.
3. Users panel: role/status badges; current auth/assignment counts only as returned; recent access state; a per-row deactivate/reactivate action; Load more.
4. Stale panel: explicit internal-only reminder-state explanation, empty state, candidate cards, current role, period-start date, one record-reminder button, and an idempotent safe-result state.
5. Bug panel: status filter is out of scope; show returned newest-first stream with state control, timestamps, report title/body, empty state, and Load more.

On mobile each user/report is a stacked card, never a forced desktop table. If a larger breakpoint uses a table, provide an equivalent card/structured representation at mobile, preserve header associations, and localize any horizontal overflow. Tabs must preserve keyboard arrow/Home/End behavior, `aria-selected`, `aria-controls`, focus visibility, and a single visible panel. Pending state is per record/form; loading one access action, reminder, or status update must not disable unrelated rows or the other panels.

Dates use the session/profile locale and timezone at render time. Do not make date formatting part of authorization or parse localized dates back into commands. Use UTC/ISO values only in validated server DTOs/cursors.

## 5. Localization and accessibility contract

Add matching `accountAccess` namespaces to `messages/en-US.json` and `messages/es-MX.json`, plus nav labels/aria labels for `links.account` and `links.accessManagement`. Both catalogs must contain identical key trees. Use semantic keys rather than English-string keys. Include labels/help/errors/success/failure/empty/loading/pagination/confirmation/sensitive-data warning/status names/role names/time labels and aria labels.

All visible text, placeholder, title, tooltip, toast/status copy, confirmation phrase instruction, and screen-reader announcement is localized. Stored enums and code identifiers remain English. No raw database exception is shown.

Every field has a programmatic label. Required/error/help text is connected with `aria-describedby`; invalid fields set `aria-invalid`; errors use `role="alert"`; successful form feedback uses `role="status"` and `aria-live="polite"`. Dialogs use explicit title/description and restore trigger focus. Icon-only nav or row controls have localized `aria-label`s. Color does not alone communicate active/inactive, report status, or destructive meaning.

## 6. Exact state behavior and exclusions

- Account settings are self-only. A manager must use `/cuenta` to change their own fields; `/admin/acceso` and `/pm/acceso` never become profile editors.
- Deactivation has no permanent-delete affordance and no delete wording. Inactive users appear only in the manager directory and cannot use protected app routes.
- The manager console is global, not membership-scoped. Never use `project_members`, `pm_lead`, or `pm_watcher` to hide a PM’s console or directory results.
- Client/Operator may submit reports but never view global reports, user directory, candidate list, access actions, or manager navigation.
- The browser never derives stale eligibility, infers access history, or decides whether a reminder was sent; it renders authoritative RPC results.
- Do not build reminder delivery, automated jobs, alert rules, notification events, emails, WhatsApp, provider integrations, public ticket pages, attachments, report comments, report deletion, or reporter-facing report history.
- Do not alter M03/S10-03 recycle-bin, archive, permanent-delete, task, deliverable, calendar, client contact, invitation, metrics, legal, or task-detail behavior.

## 7. Required focused verification after implementation

The owner requested no broad verification ceremony. Do not run an exhaustive suite, E2E, coverage, build, provider, production, or migration reset workflow. The S10-04 migrations (`20260902180000_s10-04-access-hygiene-completeness-repair.sql`, `20260902130917_s10-04-directory-keyset-cursor-projection-repair.sql`, and `20260902190000_s10-04-directory-keyset-cursor-post-repair.sql`) are already applied to `jsf-pm-dev`, `src/lib/database.types.ts` has already been regenerated, and `list_user_access_directory` exposes `created_at: string`. No migration application or type regeneration is a remaining application-implementation step. Run only `npm run lint` and `npm run typecheck`, plus focused tests that are added/changed for this slice.

Required focused assertions:

1. Server adapters reject malformed/partial cursors, invalid UUIDs, invalid enum values, invalid booleans/text, empty/multi-row RPC results, and malformed continuation rows.
2. Self settings sends only the four allowed fields; inactive/unauthenticated/failed update is safe; role is not editable.
3. Manager actions deny Client/Operator before RPC use; Admin and PM both route/load globally regardless of capacity metadata.
4. Access result codes render correctly; self and last-management-account failures never appear as success; reactivation does not claim invitation restoration.
5. Stale candidate UI exposes only the allowed DTO, records once, handles `not_eligible_or_already_recorded`, and does not fabricate eligibility or delivery.
6. Bug submit enforces trimmed 1–160/1–5000 limits; triage only accepts four statuses; non-manager cannot obtain triage data; no reporter identity is rendered.
7. Navigation model contains account for all roles and access management only for Admin/PM; desktop and mobile icon maps remain exhaustive; fixed mobile quick access remains valid.
8. en-US/es-MX key parity and the named mobile interactions: one-column form/cards, 44px controls, tab keyboard operation, dialog focus return, and no page-level horizontal overflow.

The migration review and application are complete. All verified invariants are active: no public RPC signature/return-shape/grant broadening; qualifying access and directory counts exclude deleted, archived, and `cancelled` project ancestry; project hygiene refresh fires on `status`, `archived_at`, and `deleted_at`; the Auth trigger observes only `auth.users.last_sign_in_at`; private helper EXECUTE is revoked from browser roles; no Auth/profile role/deactivation mutation; valid `user_access_hygiene_state` check invariant; and no pre-M04 Auth timestamp is treated as historical activity.

## 8. Implementation sequence and stop conditions

1. Implement the server-only feature boundary, strict schemas, and focused DTO validation against the regenerated declarations with `created_at: string`.
2. Add protected routes, shared views, controlled actions, navigation model/icon maps, and catalog parity.
3. Add only the focused tests named above, including route-level guard tests.
4. Run the required minimum checks and update `CHANGELOG.md` last, as required by `GEMINI.md` after coding completion.

Stop and request a decision if: an existing route/navigation map has materially changed; the implementation requires reporter identity/history, a new report field, external delivery, role/provisioning changes, a direct table read/write, a new public endpoint, or an API/schema change beyond the applied migrations.

## 9. Acceptance criteria

S10-04 is complete only when all are true:

- All S10-04 migrations are applied to `jsf-pm-dev`, `src/lib/database.types.ts` is regenerated, and `list_user_access_directory` exposes `created_at: string` for composite keyset pagination.
- Every active role can edit only its own bounded account settings and submit one bounded report.
- Admin and PM have equivalent discoverable global `/admin/acceso` and `/pm/acceso` consoles; Operator/Client are denied both in routing and actions.
- The directory exposes only the declared role-safe projection, supports stable cursor pagination, correctly deactivates/reactivates another user, prevents self-lockout/last-manager loss, and never becomes a user delete/role-management surface.
- A valid reminder candidate is limited to the exact 45-day no-auth/no-active-access policy, can be recorded once per genuine period, and has no automatic/external delivery.
- Bug triage supports exactly `open|triaged|resolved|dismissed`, does not expose reporter identity, and does not create a reporter history surface.
- English/Spanish localization, keyboard/screen-reader semantics, and strict mobile-first layout are complete.
- No provider/production work, direct browser database access, raw sensitive data exposure, broad unrelated refactor, or out-of-scope S10 work is introduced.
