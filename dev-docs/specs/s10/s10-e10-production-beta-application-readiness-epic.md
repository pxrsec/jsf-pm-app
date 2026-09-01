---
document_id: S10-E10-PRODUCTION-BETA-APPLICATION-READINESS-EPIC-02
epic_id: E10
sprint_id: S10
status: active-owner-directed-epic-baseline
created_at: 2026-08-30T00:00:00-06:00
updated_at: 2026-09-01T12:00:00-06:00
branch: feature/production-readiness-pt-1
target_environment: jsf-pm-dev
---

# E10 — Production-Beta Application Readiness

## Document purpose and boundary

This is the **epic-level scope and outcome authority** for all S10 work items. It defines the complete production-beta application-readiness outcome, portfolio sequencing, cross-item dependencies, and epic exit conditions. It is not an implementation specification and must not be used to infer implementation scope for a work item that has no accepted work-item specification.

The repository-local implementation specification `s10-01-production-readiness-foundation-and-task-detail-implementation-spec.md` is deliberately limited to the original **S10-01 and S10-02** slice. The bounded S10-02-R1 refinement is separately controlled by `s10-02-r1-invitation-completion-and-direct-client-project-ux-implementation-spec.md`. S10-03 through S10-06 require their own accepted specifications and stated prerequisites before implementation begins.

## Objective

Deliver the missing application controls required before creating `jsf-pm-prod` or activating an external provider. The outcome is a role-safe, localized internal beta capability for Admin, PM, Operator, and invited Client users. In-app application behavior may be implemented; external provider delivery remains fail-closed.

## Controlling decisions

1. Direct Project Owner direction and ADR-025 control product, role, identity, lifecycle, and beta-operability policy.
2. ADR-024 retains the fail-closed deferred-provider boundary.
3. `profiles.role` is application authority. Active Admin and active PM have global management authority. `pm_lead` and `pm_watcher` are project-membership capacities only; they never narrow global PM authority.
4. A client contact, client organization, authenticated account, and project membership are different entities/relationships. A contact may exist without an organization or account. A direct contact may later gain an account or organization association. Association alone never grants membership or access.
5. Archive is recoverable. Admin and PM archive/restore projects, tasks, deliverables, and milestones. Only Admin may permanently delete those four entity types. Users, profiles, contacts, organizations, invitations, access history, audit history, deliverable versions, and feedback are never permanently deleted in E10.
6. Providers remain free-tier-only and inactive. No provider activation, external dispatch, WhatsApp, scheduler, production deployment, DNS, billing, or secret-management work belongs to this epic.

## Work-item map

| Work item | Required outcome | Dependency / readiness gate | Explicit implementation boundary |
| --- | --- | --- | --- |
| S10-01 | Direct-client and optional-organization authority/readiness foundation | M01 applied to `jsf-pm-dev`; generated declarations refreshed | Implement only through narrow trusted commands/projections and role-safe server adapters. |
| S10-02 | Discoverable Admin/PM client-contact and ordinary invitation administration | S10-01/M01 plus a reviewed S10-02 invitation-lifecycle migration and regenerated declarations | Client/operator invitations only; create, list, copy-link, resend, revoke, pending/expiry state; no public signup or privileged invitation. |
| S10-02-R1 | Invitation completion repair and direct-client project-workspace UX | Reviewed/applied M02-R1; regenerated declarations; accepted S10-02-R1 specification | Fixed invitation email; invitee-owned name/phone/preference; trusted completion and explicit direct-contact association/invitation only; no provider or implicit membership. |
| S10-03 | Project operational recycle bin, archive/restore, Admin-only permanent deletion | Reviewed/applied M03; regenerated declarations | Only projects, tasks, deliverables, milestones; lifecycle behavior must be reconciled across active queries and UI. |
| S10-04 | Self account settings, global Admin/PM user access management, deactivation, stale-access state, bug intake/triage | Reviewed/applied M04; regenerated declarations | Role-safe active-user directory/deactivate-reactivate surface; no permanent user deletion or automated provider delivery. |
| S10-05 | Public privacy/terms locations, legal footer, sitemap/robots reconciliation | No migration expected | Legal copy remains visibly draft until stakeholder approval; do not imply legal approval. |
| S10-06 | Role-safe task-detail correction, associated deliverable context, calendar task-navigation repair | Inspect M01–M04 contracts; author/apply M05 only if required; regenerated declarations if M05 exists | Preserve immutable deliverable versions and existing Operator/Client task authority. |

## Role and capability matrix

| Capability | Admin | PM | Operator | Client |
| --- | --- | --- | --- | --- |
| Global client/contact and organization administration | Yes | Yes | No | No |
| Direct contact capture and project association | Yes | Yes | No | No |
| Ordinary client/operator invitation lifecycle | Yes | Yes | No | No |
| Privileged Admin/PM provisioning | Manual audited process only | No | No | No |
| Archive/restore permitted operational entities | Yes | Yes | No | No |
| Permanent delete project/task/deliverable/milestone | Yes | No | No | No |
| Self account settings and problem report | Own account | Own account | Own account | Own account |
| Access deactivation/re-activation | Yes | Yes | No | No |
| Bug-report triage | Yes | Yes | Submit only | Submit only |
| Dedicated task detail | Authorized project task | Authorized project task | Own assigned task only | Own authorized client task only |

## Migration and artifact sequence

1. **M01 — `20260830110000_s10-direct-client-identity-and-invitation-administration.sql`:** establishes the S10-01/S10-02 data and trusted-command foundation. It was applied by the Project Owner to `jsf-pm-dev` as `20260830110000_s10_direct_client_identity_and_invitation_administration`; `src/lib/database.types.ts` was regenerated from the applied schema. The pre-application source correction used `min(c.id::text)::uuid` for the legacy-contact backfill because PostgreSQL has no `min(uuid)` aggregate. Never edit the applied migration.
2. **M02-R1 — `20260901120000_s10-02-r1-invitation-completion-profile-authority.sql`:** replaces the one-argument invitation-acceptance command with the profile/contact-completion command and aligns WhatsApp consent evidence. It must be reviewed/applied before S10-02-R1 application work.
3. **M03 — `20260901140000_s10-03-archive-recycle-bin-and-admin-permanent-deletion.sql`:** must be reviewed/applied before S10-03 database-dependent implementation.
4. **M04 — `20260830112000_s10-account-access-hygiene-and-bug-triage.sql`:** must be reviewed/applied before S10-04 database-dependent implementation.
5. **M05 — `20260830113000_s10-manager-task-detail-projection.sql`:** conditional. Create only after inspecting M01–M04 and proving the current role-safe contracts cannot return the S10-06 manager-detail shape.

## Epic-wide invariants

- Browser code does not receive raw invitation-token hashes, arbitrary contact-directory data, secrets, or privileged table access.
- Role-safe server adapters and `SECURITY DEFINER` commands must validate the authenticated actor independently of navigation/UI state.
- Invitation tokens remain opaque, hashed, expiring, revocable, and single-use. Ordinary roles are exactly `client` or `operator`.
- A direct contact or organization-associated contact can satisfy client readiness where needed; no organization is a universal prerequisite for contact capture, invitation, planning, or authorized assignment.
- A client-contact association does not create `project_members` membership and does not grant project visibility.
- Immutable historical records remain immutable. In particular, correcting a deliverable link creates/uses an auditable current version; it never overwrites historical `deliverable_versions.submission_url`.
- Every visible string is localized through the established English and Spanish message catalogs. Routes preserve the locale model.

## Epic acceptance criteria

1. All planned S10 work-item outcomes, including the bounded S10-02-R1 refinement, are delivered only after their individual readiness gates and accepted specifications are satisfied.
2. Direct contact flows work without an organization and do not broaden access or directory visibility.
3. Admin/PM global authority is enforced consistently; project membership capacity never silently downgrades PM authority.
4. Archive, restoration, deactivation, permanent deletion, and immutable-history semantics are distinct and truthfully represented.
5. Account, access, legal-surface, task-detail, and calendar corrections are role-safe, localized, and evidenced through focused checks.
6. Applied migration IDs and generated-type provenance are recorded accurately.
7. No result is described as production live, externally delivered, legally approved, or provider activated.

## Explicit exclusions

- Creating or mutating `jsf-pm-prod`; production migration; Vercel, Cloudflare, Hostinger, DNS, billing, secrets, provider-console, email, Sentry, Resend, QStash, Meta/WhatsApp, scheduler, or public-signup work.
- Permanent deletion outside the four named operational entities.
- Broad dashboard/metrics redesign, CRM automation, recovery-drill execution, legal-text approval, and external-provider activation.
- Using this epic or the sprint plan as an implementation brief for a work item without an accepted work-item specification.

## Epic exit condition

E10 is implementation-complete only when each S10 work item has factual, role-safe acceptance evidence in `jsf-pm-dev`, the migration/type provenance is recorded, and remaining production-foundation work is explicitly limited to separately authorized environment, account, DNS, provider, legal, and operational actions. This is not a hosted-production or commercial-readiness declaration.
