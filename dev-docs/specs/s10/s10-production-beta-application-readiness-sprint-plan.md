---
document_id: S10-PRODUCTION-BETA-APPLICATION-READINESS-SPRINT-PLAN-02
sprint_id: S10
epic_id: E10
status: active-owner-directed-sprint-plan
created_at: 2026-08-30T00:00:00-06:00
updated_at: 2026-09-01T12:00:00-06:00
branch: feature/production-readiness-pt-1
target_environment: jsf-pm-dev
---

# Sprint 10 — Production-Beta Application Readiness

## Purpose and execution boundary

This plan is the complete **S10 work-item breakdown and sequencing authority**. It names every work item, its deliverable, dependency, acceptance outcome, and stop condition. It is not a substitute for a work-item implementation specification.

`s10-01-production-readiness-foundation-and-task-detail-implementation-spec.md` authorizes the original **S10-01 and S10-02** slice. `s10-02-r1-invitation-completion-and-direct-client-project-ux-implementation-spec.md` separately authorizes the bounded **S10-02-R1** refinement after its applied schema baseline. Neither specification authorizes S10-03 through S10-06. Those work items remain planned and blocked pending their own accepted implementation specifications and stated schema gates.

## Sprint goal

Close the application-level beta-operability gaps in `jsf-pm-dev` without creating a production project or activating an external provider. Execute in dependency order, preserve the Project Owner's applied-M01/type provenance, and keep provider, production, legal-approval, and infrastructure work deferred.

## Entry conditions

- ADR-024 and ADR-025 remain controlling.
- Target environment is `jsf-pm-dev`; no production environment is in scope.
- M01 has been applied and `src/lib/database.types.ts` refreshed from the resulting schema.
- No provider console, secret, DNS, billing, external delivery, scheduling, public signup, or production action is authorized.

## Ordered backlog

### S10-01 — Direct client and optional organization authority foundation

**Objective:** Establish direct-contact identity, optional-organization, project-readiness, and global Admin/PM authority behavior required for S10-02.

**Deliverable:** Repository implementation against applied M01 and regenerated declarations, including direct-contact-aware client/project adapters and replacement of organization-universal assumptions.

**Dependency:** M01 applied to `jsf-pm-dev`. Do not edit the applied migration.

**Required outcome:**

- A contact remains a person record and may have neither organization nor account.
- Organization association is optional and never grants project membership or visibility by itself.
- Direct contact/user or matching organization contact/user can satisfy required client readiness; organization is not universal.
- Active Admin/PM management authority is global. `pm_lead` and `pm_watcher` remain project metadata, not PM authorization gates.
- Operator/Client cannot enumerate contacts, organizations, raw invitation state, or profile/email directory data.
- Existing organization-only query assumptions are replaced/supplemented with M01-safe server adapters.

**Acceptance outcome:** Admin and PM can create/edit direct contacts, later associate an organization where appropriate, associate an eligible contact to a client project without accidentally adding membership, and retain global management behavior. Operator/Client are denied directory access.

**Stop conditions:** Any implementation that requires an organization universally, treats association as access, uses membership capacity to deny PM authority, bypasses M01 commands/projections, or exposes contact/profile data is out of scope and requires a new review.

### S10-02 — Client-contact and invitation administration

**Objective:** Build the Admin/PM operational UI and server boundary that consume the S10-01/M01 foundation.

**Deliverable:** Discoverable locale-safe Admin and PM administration surfaces for contacts, optional organization association, project-contact association, and the ordinary operator/client invitation lifecycle.

**Dependency:** S10-01/M01 contract plus a reviewed/applied S10-02 invitation-lifecycle migration and refreshed generated declarations. M01 exposes acceptance but does not expose the create/list/resend/revoke/copy lifecycle contract required by this work item.

**Required outcome:**

- Admin and PM receive equivalent global administration capability through the established role-aware navigation and locale routing model.
- Contact management supports create/edit and optional organization association without treating a contact as an account or membership.
- Invitation management supports client/operator only: create, copy join link, resend, revoke, and current pending/expired/revoked/accepted state.
- Token values are opaque. No general UI, client log, error, telemetry payload, or audit display exposes raw token hashes, full join links beyond an explicitly requested copy flow, or uninvited contact email/profile data.
- Invitation acceptance remains the trusted M01 path: matching authenticated email, unexpired/unrevoked/single-use token, exact eligible client-contact binding for client invitations, and project membership only when the invite explicitly carries a project.
- No public signup and no ordinary Admin/PM invitation route are added.

**Acceptance outcome:** Admin and PM can complete the same contact and invitation journeys; direct contacts without organizations are supported; operator/client/non-authenticated paths fail closed; lifecycle changes are reflected safely and accessibly.

**Stop conditions:** Any attempt to build browser base-table writes, client-side authorization, arbitrary invitation role assignment, raw-token storage/logging, public registration, provider dispatch, or implicit project membership/access is out of scope.

### S10-02-R1 — Invitation completion repair and direct-client project UX

**Objective:** Repair ordinary invitation redemption, converge invitee-owned profile/contact data under the fixed invitation email, and make direct-client identity management discoverable from Admin/PM project workspaces.

**Deliverable:** M02-R1 plus the bounded application refinement defined by `s10-02-r1-invitation-completion-and-direct-client-project-ux-implementation-spec.md`.

**Dependency:** Applied M01/S10-02 chain, reviewed/applied `20260901120000_s10-02-r1-invitation-completion-profile-authority.sql`, refreshed generated declarations, and the accepted S10-02-R1 implementation specification.

**Required outcome:**

- Invitation completion reaches the non-localized canonical API route from both locales; `/en/api/...` is never a valid API path.
- The invitation email remains pre-bound and exact-match authoritative. Invitees supply full name, optional E.164 phone, password, and WhatsApp preference only.
- Trusted completion atomically persists profile/contact completion, consent evidence, project-scoped membership where applicable, invitation state, and non-PII audit evidence; application code performs no post-completion direct profile/contact write.
- Auth-user creation failure after creation but before trusted completion receives bounded compensating deletion without falsely representing the invitation as accepted.
- Admin/PM project workspaces expose optional organization, exact direct-contact, or planning-without-identity selection. Association and invitation are explicit; no identity selection creates membership or access.

**Acceptance outcome:** Admin/PM can complete the same direct-client project identity journey regardless of PM membership capacity; Client/Operator/non-authenticated paths fail closed; accepted Client and Operator invites persist invitee-owned data while preserving the fixed email boundary; no external provider is activated.

**Stop conditions:** Any editable invitation email, email-confirmation substitute for fixed email binding, raw token exposure, `/en/api` route duplication, browser direct contact/project-association access, implicit member creation, fabricated consent IP, provider activation, or claim of cross-system atomicity is out of scope.

### S10-03 — Recoverable lifecycle and Admin-only permanent deletion

**Objective:** Reconcile archive/restore, operational recycle-bin, and narrow permanent-deletion behavior.

**Deliverable:** M03 plus application controls for projects, tasks, deliverables, and milestones.

**Dependency:** Reviewed/applied M03 and refreshed generated declarations; a separate accepted S10-03 implementation specification.

**Required outcome:** Archive/restore is recoverable for Admin/PM; archived records disappear from active lists, Kanban, calendar, selectors, normal reports, and notification affordances. Admin-only permanent deletion is a separate dependency-aware command limited to the four accepted entity types, with localized irreversible confirmation and audit evidence.

**Acceptance outcome:** Entity/role matrix, restore dependencies, active-surface exclusion, PM permanent-delete denial, and no expansion to users/contacts/history.

### S10-04 — Account, access hygiene, and bug triage

**Objective:** Deliver bounded self-account control, discoverable Admin/PM user access administration, safe access deactivation, stale-access reminder state, and authenticated bug reporting/triage.

**Deliverable:** M04 plus account settings, a role-safe Admin/PM active-user directory and access-management surface, reminder-state, and bug-report surfaces.

**Dependency:** Reviewed/applied M04 and refreshed generated declarations; a separate accepted S10-04 implementation specification.

- Users edit only bounded personal fields; role and activation stay protected. A discoverable Admin/PM global directory returns only role-safe user fields and active/inactive state; it does not expose contact-directory information, token data, or history beyond its authorization purpose. Admin/PM deactivation/re-activation preserves history, prevents self-lockout/last-management-account loss, revokes relevant pending invites, and audits safely. One stale-access reminder eligibility period begins at 45 consecutive inactive days and resets only on qualifying auth or active assignment/membership. Authenticated users submit bounded reports; Admin/PM triage `open|triaged|resolved|dismissed`.

**Acceptance outcome:** Self-only account boundary; discoverable Admin/PM global active-user access management without role escalation or contact-directory leakage; no permanent user deletion; exact reminder reset/deduplication; safe deactivation; and role-safe report/triage behavior.

### S10-05 — Public legal surface

**Objective:** Establish stable public legal locations and legal navigation without falsely claiming legal approval.

**Deliverable:** Localized privacy/terms routes, legal footer on public/auth/invitation surfaces, sitemap/robots reconciliation.

**Dependency:** Separate accepted S10-05 implementation specification. No schema migration expected.

**Required outcome:** Public unauthenticated routes exist for both locales; legal links are reachable from sign-in, recovery, invitation, public landing, and legal pages; protected navigation is not exposed. Copy remains visibly draft/pending stakeholder approval.

**Acceptance outcome:** Locale parity, footer reachability, sitemap/robots inspection, and no protected-data leak.

### S10-06 — Task detail, deliverable context, and calendar navigation

**Objective:** Repair task-detail information architecture and the calendar task-navigation regression without weakening task/deliverable authority.

**Deliverable:** Role-safe associated-deliverable context in task detail, dedicated manager task routes, immutable link-correction path, and corrected milestone task navigation.

**Dependency:** Inspect M01–M04 read/RLS contracts. Create/apply M05 only if a narrow manager detail projection is necessary. Separate accepted S10-06 implementation specification required.

**Required outcome:** Authorized task views show real associated deliverables, current version metadata, and safe actions. Manager routes preserve locale and valid task-workspace return. Operator and Client keep current scoped routes. Calendar tabs are normalized server-side and synchronize client state; milestone task links target a role-safe task detail instead of an ambiguous workspace state. Historic deliverable URLs are never mutated in place.

**Acceptance outcome:** Authorized role journeys, safe absence for inaccessible/deleted tasks, no calendar infinite-loader path, accessible task-detail affordance, and preserved immutable version evidence.

## Migration and implementation order

1. Implement S10-01 and S10-02 only from their bounded accepted specification, against M01 and the refreshed generated declarations. M01 application evidence: `20260830110000_s10_direct_client_identity_and_invitation_administration` on `jsf-pm-dev`; the pre-application legacy backfill correction was `min(c.id::text)::uuid` because PostgreSQL has no `min(uuid)` aggregate.
2. Review, apply, and regenerate from M02-R1 `20260901120000_s10-02-r1-invitation-completion-profile-authority.sql`; then execute only the accepted S10-02-R1 refinement specification and record focused invitation/workspace evidence.
3. Author, review, apply, and regenerate after M03; then create/execute only an accepted S10-03 specification.
4. Author, review, apply, and regenerate after M04; then create/execute only an accepted S10-04 specification that includes the approved Admin/PM active-user access-management surface.
5. S10-05 waits for its own bounded implementation specification; it has no schema dependency.
6. Inspect M01–M04 for S10-06. Author M05 only if a narrow authorized projection is genuinely required; then create/execute only an accepted S10-06 specification.
7. Record focused verification and truthful closeout evidence. Do not run provider or production procedures.

## Verification policy

Use the smallest focused proof for each changed trusted boundary or reproduced regression. Preserve an existing controlling test when its contract changes. Do not create exhaustive TDD, coverage, fixture, role-matrix, E2E, or broad regression suites merely for S10.

For application slices, run `npm run lint` and `npm run typecheck`. Run one affected Vitest test only when a focused test was added or changed. Defer `npm run build` until integrated route work is complete. Client/mock evidence does not prove deployed RLS; only the Project Owner's application/type-generation evidence establishes M01 remote provenance.

## Sprint exit criteria

1. Each planned S10 work item, including S10-02-R1, has its own accepted implementation scope and factual acceptance evidence.
2. Applied migration IDs and regenerated-type provenance are recorded accurately.
3. `EXTERNAL_DELIVERY_MODE` remains disabled/fail-closed; no provider is activated.
4. No production project, production migration, or DNS change occurs.
5. Legal signoff, recovery-drill execution, provider activation, and infrastructure-console work remain explicit deferred operational work, not concealed as sprint failures.
