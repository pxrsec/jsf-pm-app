---
document_id: S10-E10-PRODUCTION-BETA-APPLICATION-READINESS-EPIC-01
epic_id: E10
sprint_id: S10
status: draft-owner-directed-implementation-baseline
created_at: 2026-08-30T00:00:00-06:00
branch: feature/production-readiness-pt-1
target_environment: jsf-pm-dev
---

# E10 — Production-Beta Application Readiness

## Objective

Deliver the missing application controls required before creating `jsf-pm-prod` or activating any external provider. The result is a role-safe, localized internal beta capability for Admin, PM, Operator, and invited Client users, using in-app notifications only.

This epic implements the ADR-025 product decisions. It does **not** create a production Supabase project, configure Vercel/Cloudflare/Hostinger, add secrets, send email, enable Sentry/Resend/QStash, schedule workflows, or activate WhatsApp.

## Authority and fixed decisions

1. Direct Project Owner direction and ADR-025 control product/role/lifecycle policy.
2. ADR-024 retains the fail-closed provider boundary.
3. `profiles.role` is application authority. Active Admin and active PM have the accepted global management authority; `pm_lead` and `pm_watcher` remain project-membership capacities and never narrow global PM authority.
4. Client organizations are optional. A contact may exist without an organization or account; a client account may later link to a direct contact. No universal organization prerequisite is permitted for contact capture, invitation, project planning, or authorized assignment.
5. Archive is recoverable. Admin and PM archive/restore projects, tasks, deliverables, and milestones. Only Admin may permanently delete those four entity types; users, contacts, organizations, invitations, and access records are deactivated/revoked, never permanently deleted in this beta.
6. All providers remain free-tier-only. Provider activation is outside S10. WhatsApp remains explicitly deferred.

## S10 scope

| Work item | Outcome | Database change |
| --- | --- | --- |
| S10-01 | Direct-client/optional-organization data, readiness, and Admin/PM authority reconciliation | M01 applied to `jsf-pm-dev`; generated types refreshed |
| S10-02 | Admin/PM client-contact directory and ordinary operator/client invitation administration | M01 |
| S10-03 | Project operational recycle bin; archive/restore; Admin-only permanent deletion | Required forward migration M03 |
| S10-04 | Account settings, user-access deactivation, stale-access reminder state, authenticated bug-report intake and Admin/PM triage | Required forward migration M04 |
| S10-05 | Public privacy/terms routes, public/auth legal footer, sitemap/robots reconciliation | No schema migration expected |
| S10-06 | Task detail correction: associated deliverables with latest version/link; dedicated manager task pages; calendar task navigation fix | M05 only if role-safe manager task-detail projection cannot be built from M01–M04 contracts; no speculative migration |

## Target role/capability matrix

| Capability | Admin | PM | Operator | Client |
| --- | --- | --- | --- | --- |
| Client/contact directory; direct contact without organization | Global manage | Global manage | No | No |
| Create/resend/revoke/copy ordinary operator/client invitation | Yes | Yes | No | No |
| Privileged Admin/PM provisioning | Manual audited only | No | No | No |
| Archive/restore project/task/deliverable/milestone | Yes | Yes | No | No |
| Permanent delete four permitted entity types | Yes | No | No | No |
| Deactivate/revoke user access | Yes | Yes | Self only: no | Self only: no |
| Account settings / problem report | Own account | Own account | Own account | Own account |
| Bug-report triage | Yes | Yes | Submit only | Submit only |
| Dedicated task detail | Any authorized project task | Any authorized project task | Own assigned task only | Own authorized client task only |

## Required forward migration set

The Project Owner applies reviewed, append-only migrations to `jsf-pm-dev` in filename order before dependent application work. Regenerate and commit `src/lib/database.types.ts` unchanged after each applied database batch. Never edit an applied migration.

1. `20260830110000_s10-direct-client-identity-and-invitation-administration.sql` (M01)
   - Make `client_contacts.client_id` nullable while preserving the foreign key/index behavior for organization contacts; add a direct-contact-safe uniqueness rule and replace organization-universal readiness enforcement with direct-contact-or-organization-associated contact/user semantics.
   - Add narrowly scoped Admin/PM trusted commands and role-safe projections for contacts, optional organizations, project association, and ordinary invite lifecycle.
   - Preserve opaque, expiring, revocable, single-use invitation tokens and non-enumeration. Replace the current `(client_id,email)`-only acceptance binding so a trusted direct contact can link without an organization; ordinary invitation roles remain `operator|client` only.
   - **Applied evidence (2026-08-31):** applied to `jsf-pm-dev` remote project `ccaxxmqighpffgpaxjwg` as `20260830110000_s10_direct_client_identity_and_invitation_administration`; `src/lib/database.types.ts` was regenerated from the resulting schema. The applied source uses `min(c.id::text)::uuid` in the legacy-invitation backfill because PostgreSQL has no `min(uuid)` aggregate. This is an equivalent source correction made before successful application, not a post-application edit.
2. `20260830111000_s10-archive-recycle-bin-and-admin-permanent-deletion.sql` (M03)
   - Reconcile trusted archive/restore authority for projects, tasks, deliverables, milestones; active-list/calendar/selector/report exclusion; project recycle-bin projection; dependency-safe Admin-only permanent-delete command; and audit events.
3. `20260830112000_s10-account-access-hygiene-and-bug-triage.sql` (M04)
   - Add bounded account-update command/projection, access-deactivation audit, stale-access reminder decision/delivery state, immutable/append-only bug reports, and role-safe Admin/PM triage commands/projections. Deactivation/re-activation commands must lock target rows, prevent self-lockout and loss of the last active management-capable account, revoke pending invites as applicable, and audit actor/reason/target without raw tokens.
4. `20260830113000_s10-manager-task-detail-projection.sql` (M05, conditional)
   - Create only if existing RLS/read contracts cannot return a narrow authorized manager task-detail projection with associated deliverable/version metadata. It must not expose arbitrary task/project data or alter immutable deliverable-version history.

## Epic acceptance criteria

1. Every S10 database change is a reviewed forward migration with exact owner/grant/search-path/RLS evidence and regenerated types.
2. A direct client contact can be created, managed, assigned, and invited without an organization; later organization association preserves history and does not broaden visibility.
3. Admin and PM have the accepted global management controls; no UI, query, RPC, RLS helper, or membership capacity silently downgrades PM authority.
4. Archive/recovery/deletion semantics are truthful and consistent across UI, server actions, RPCs, RLS, active feeds, calendar, selectors, reports, and audit history.
5. Every active role can manage only their own account fields and submit a bounded bug report. Admin/PM can triage safely. Optional product-email preference never controls essential security notices.
6. Public privacy and terms routes exist with localized public/auth footer links and sitemap/robots decisions; placeholder legal copy is visibly non-final until stakeholder text is approved.
7. The task sheet and dedicated task pages show authorized deliverable names, current version numbers, and safe links. Link correction preserves immutable version evidence rather than overwriting historical submitted URLs.
8. Calendar milestone task links resolve to the appropriate dedicated task route or valid workspace task state; no indefinite loading state remains.
9. Focused authorization, migration-contract, navigation, i18n, and regression evidence is recorded truthfully. No claim of production/provider activation is made.

## Dependencies and sequencing

S10-01 establishes the identity/readiness authority contract. S10-02 consumes it. S10-03 and S10-04 can proceed after their independent migration contracts are accepted. S10-05 is application/public-surface work but cannot be labeled legally approved until stakeholder text/signoff exists. S10-06 starts with the confirmed calendar defect and existing detail models, and must consume the role-safe task projection before presentation work.

## Explicit exclusions

- Production Supabase/Vercel projects, production migrations, DNS/Hostinger/Cloudflare changes, secrets, billing, external providers, email, scheduling, Meta/WhatsApp, public signup, CRM automation, Sentry activation, backup execution, legal-text approval, broad dashboard/metrics changes, and broad redesign. The recorded M01 application to `jsf-pm-dev` is the sole completed remote schema action in this scope.
- Permanent deletion of users, contacts, organizations, invitations, profiles, access history, notification history, audit logs, deliverable versions, or feedback.
- Editing historic `deliverable_versions.submission_url` in place. A correction must use the existing or newly specified audited version/revision command.

## Definition of ready to begin production-foundation planning

S10 is implementation-complete only when its accepted controls have focused evidence in `jsf-pm-dev`, the closeout names each applied migration/type provenance, and the remaining production-foundation work is limited to separately approved environment/account/DNS/provider actions. It is not a hosted or commercial-production declaration.
