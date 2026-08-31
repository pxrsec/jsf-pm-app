---
document_id: S10-PRODUCTION-BETA-APPLICATION-READINESS-SPRINT-PLAN-01
sprint_id: S10
epic_id: E10
status: draft-owner-directed-execution-plan
created_at: 2026-08-30T00:00:00-06:00
branch: feature/production-readiness-pt-1
target_environment: jsf-pm-dev
---

# Sprint 10 — Production-Beta Application Readiness

## Sprint goal

Close the application-level beta-operability gaps before any `jsf-pm-prod` migration or provider setup. This is one integrated sprint, but execution is ordered by database authority and independently testable vertical slices.

## Entry conditions

- ADR-024 and ADR-025 remain controlling.
- The Project Owner has confirmed: free tiers only; Hostinger is registrar; Cloudflare will be authoritative DNS later; Rubén/Pxrsec is sole recovery custodian; T1–T3 are deferred; Supabase Auth free-tier support for password/email change notices is accepted; providers will be implemented later.
- No provider console, secret, DNS, production project, billing, or live delivery action is in the sprint.

## Ordered sprint backlog

### S10-01 — Direct client and optional organization authority foundation

**Deliverable:** M01 (applied to `jsf-pm-dev`; types regenerated) plus repository-local contract implementation for client contacts, optional organizations, direct-client readiness, project/member assignment, and global Admin/PM authority.

**Required behavior:**
- A contact is a person record, may have no account and no organization, and remains meaningful after account deactivation or organization change. M01 must make the current `client_contacts.client_id NOT NULL` column nullable, preserve organization-contact foreign-key/index behavior, and provide direct-contact-safe uniqueness.
- An organization is optional grouping; association never grants visibility by itself.
- Direct contact/user or organization-associated contact/user satisfies client readiness where a client-facing workflow requires readiness. Planning remains possible without either where ADR-025 permits it.
- Admin/PM can globally administer contacts/organizations and ordinary `operator|client` invites. PM authority cannot be based on `project_members` membership. Privileged Admin/PM provisioning remains manual/audited; this sprint must not widen the existing `invite_tokens` role ceiling.

**Acceptance evidence:** migration/RLS negative cases; Admin/PM direct-contact creation/edit/assignment; direct client invitation; later organization association; denied Operator/Client access; i18n parity.

### S10-02 — Client-contact and invitation administration

**Deliverable:** discoverable Admin and PM client administration plus invitation management (create, copy link, resend, revoke, expiry/pending state) for `operator` and `client` only.

**Route intent:** role-safe equivalent Admin/PM entry points, with no public signup and no ordinary privileged invite route. Exact paths must follow existing locale routing and navigation model.

**Acceptance evidence:** Admin and PM global journeys; contact without organization; invite lifecycle; opaque token flow; denied role/access paths; no raw email/token disclosure in general UI/logs.

### S10-03 — Recoverable lifecycle and Admin-only permanent deletion

**Deliverable:** project-local operational recycle bin and cross-layer lifecycle reconciliation.

**Required behavior:**
- Archive/restore applies to project/task/deliverable/milestone. Archive removes records from active work lists, Kanban, calendar feeds, assignment selectors, normal reporting, and notification affordances.
- Admin/PM can restore only through trusted dependency-aware paths.
- Admin-only permanent deletion applies only to project/task/deliverable/milestone. It is a distinct trusted command, not `soft_delete_entity` relabeling.
- Localized confirmation must state irreversibility, offer Archive instead, and never use browser-native confirmation.

**Acceptance evidence:** role × entity matrix; active-surface exclusion; restore dependency handling; PM permanent-delete denial; audit rows; no deletion scope expansion.

### S10-04 — Account, access hygiene, and bug triage

**Deliverable:** `<L>/cuenta` (or accepted role-neutral equivalent), user-access management for Admin/PM, stale-access reminder state, authenticated problem reporting, and triage.

**Required behavior:**
- Users manage display name, locale, timezone, phone, and optional product-email preference for themselves only; role remains display-only. Supabase Auth owns password/email change flows.
- User removal is deactivation/revocation, preserves historical evidence, and is not permanent deletion. Trusted deactivation/re-activation prevents self-lockout and loss of the last active Admin/PM management-capable account, locks the target record, revokes relevant pending invites, and audits actor/reason/target without token material.
- One Admin/PM reminder after 45 consecutive days with neither successful authentication nor qualifying active project/task/deliverable assignment/membership; auth or qualifying membership resets the period; no automatic deactivation.
- Every active role submits a bounded report; Admin/PM see and transition `open`, `triaged`, `resolved`, `dismissed` reports.

**Acceptance evidence:** own-account boundaries; security-notice preference exception; deactivation/history; exact 45-day state transitions/deduplication; report/triage authorization; no sensitive error leakage.

### S10-05 — Public legal surface

**Deliverable:** public localized privacy/terms routes, footer on sign-in/recovery/invitation/public surfaces, sitemap entries, and deliberate robots policy.

**Boundary:** legal text remains draft/pending stakeholder review. UI must not imply legal approval. This sprint builds stable public locations and navigation only.

**Acceptance evidence:** unauthenticated routes, locale parity, footer reachability, sitemap/robots source inspection, no authenticated-data leak.

### S10-06 — Task detail, deliverable context, and calendar navigation

**Deliverable:** correct task-detail information architecture and the confirmed calendar defect repair.

**Required behavior:**
- Task sheet replaces the boolean deliverable flag with an authorized associated-deliverables section: name, status/current version, latest safe URL presence, and context action.
- Authorized link correction uses an auditable version/revision path. Historical version URLs are immutable; “edit link” must create a valid new/current version according to the existing deliverable workflow, not rewrite past evidence.
- Add dedicated Admin and PM task detail routes under the already authorized project workspace (`/admin/proyectos/[id]/tareas/[task-id]`, `/pm/proyectos/[id]/tareas/[task-id]` unless repository route review identifies an established equivalent). Breadcrumbs return to the project task list/Kanban while preserving locale and a valid `tab=tasks` workspace return.
- Operator and Client retain their existing task-detail routes and own-work/client scope. Do not grant them manager routes.
- Replace the milestone dialog's current link to `?tab=tasks` with a role-safe task-detail destination. The current shell initializes its active tab from an optional raw query value; the implementation must normalize supported tabs and never mount a calendar panel with absent calendar data after navigation.

**Acceptance evidence:** every role's authorized route works; unauthorized/unknown/deleted task gives the existing safe absence/not-found treatment without resource leakage; a milestone task click reaches task detail without an infinite loader; task sheet/list/kanban all expose an accessible “open full details” affordance; i18n and mobile layouts remain usable.

## Migration and implementation order

1. M01 was authored/reviewed, applied by the Project Owner to `jsf-pm-dev`, and followed by unchanged generated-type refresh. The pre-application correction replaces unsupported `min(c.id)` with `min(c.id::text)::uuid` in the unambiguous legacy-contact backfill. Implement S10-01/S10-02 against the refreshed declarations; do not edit the applied migration.
2. Author/review M03 and M04. Apply in order; regenerate types. Implement S10-03/S10-04.
3. Confirm whether a narrow manager task-detail projection is expressible using the applied contracts. Author M05 only if needed; otherwise document no-migration evidence for S10-06.
4. Implement S10-05/S10-06 around the applied authority model.
5. Run focused verification and factual closeout. Do not run production/provider procedures.

## Required verification

Do not create exhaustive TDD, coverage, role-matrix, fixture, or broad regression suites for S10. Preserve an existing controlling test only if the implementation changes its contract. For each implemented slice, add at most the smallest focused test that proves a newly introduced trusted boundary or fixes a reproduced regression; do not duplicate equivalent cases across roles.

For S10-01, repository review and Project Owner-provided Supabase MCP evidence confirm M01 application and refreshed generated types in `jsf-pm-dev`. After application code exists, run only `npm run lint` and `npm run typecheck`; run a single affected Vitest test only when one is added for a concrete new command/route regression. `npm run build` is deferred until integrated route work is complete. Mock/client tests do not prove deployed RLS.

## Sprint exit criteria

1. S10-01 through S10-06 acceptance criteria pass with factual evidence.
2. All applied migration IDs and regenerated-type provenance are recorded.
3. No provider is activated and `EXTERNAL_DELIVERY_MODE` remains disabled/fail-closed.
4. No production project or DNS change occurs.
5. Open legal text/signoff, T1–T3 designation, recovery drill execution, and free-tier console capture remain explicitly deferred operational tasks, not concealed as sprint failures.
