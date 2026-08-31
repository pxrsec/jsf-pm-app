---
document_id: S10-01-PRODUCTION-READINESS-FOUNDATION-AND-TASK-DETAIL-IMPLEMENTATION-SPEC-01
sprint_id: S10
work_item: S10-01..S10-06
status: draft-implementation-ready-m01-applied-to-jsf-pm-dev
created_at: 2026-08-30T00:00:00-06:00
branch: feature/production-readiness-pt-1
target_environment: jsf-pm-dev
required_forward_migrations:
  - 20260830110000_s10-direct-client-identity-and-invitation-administration.sql
  - 20260830111000_s10-archive-recycle-bin-and-admin-permanent-deletion.sql
  - 20260830112000_s10-account-access-hygiene-and-bug-triage.sql
conditional_forward_migration:
  - 20260830113000_s10-manager-task-detail-projection.sql
---

# S10 — Production-Readiness Foundation and Task Detail Specification

## 1. Scope and non-goals

Implement the application controls listed in the S10 sprint plan before `jsf-pm-prod` creation and provider activation. This specification is repository-local implementation authority reconciled against ADR-024/ADR-025; it does not copy raw wiki sources as authority.

Out of scope: production database mutation, Vercel/Cloudflare/Hostinger actions, secrets, provider activation, legal approval text, public signup, WhatsApp, permanent deletion outside the four accepted entities, and any rewrite of immutable historical deliverable versions. M01 was applied to `jsf-pm-dev` by the Project Owner before this status update.

## 2. Database and trusted-command contract

### M01: direct client / optional organization / invitations

M01 is applied to `jsf-pm-dev` and its generated declarations are present in `src/lib/database.types.ts`. The reviewed source preserves existing identifiers and adds narrow commands/projections rather than browser base-table access. Its pre-application PostgreSQL compatibility correction is `min(c.id::text)::uuid` in the unambiguous legacy-invitation contact backfill; PostgreSQL does not provide `min(uuid)`.

- `client_contacts` remains a person record. M01 must change the current `client_id NOT NULL` schema to allow `NULL`, preserve the organization-contact foreign key/index behavior, and add a direct-contact-safe uniqueness rule; `profile_id` and organization/client association are then optional.
- A project may retain its existing `client_id` storage until a reviewed migration replaces it, but readiness validation must accept an authorized direct contact/user **or** organization-associated contact/user. It must not require an organization universally.
- Contact creation/edit, optional association/disassociation, project association, and ordinary invite creation/resend/revoke/copy-link state are Admin/PM-only trusted operations. Existing organization-scoped query helpers (`listClientContacts`, `listEligibleClientMembers`) must be replaced or supplemented by purpose-limited direct-contact-aware projections.
- Ordinary invitations accept only `client` or `operator`; role/context is server-derived; token is opaque/hashed, expiring, revocable, single-use, and non-enumerating. No ordinary Admin/PM invitation is added.
- Association does not add project membership or access by itself. Invitation acceptance links an eligible matching contact only through the trusted acceptance path; replace the current `(client_id,email)`-only binding with trusted direct-contact identity handling that cannot bind an arbitrary client profile.
- RLS/projections must deny Operator/Client directory enumeration and must not leak uninvited contact email/profile data.

### M03: archive, restore, recycle bin, permanent deletion

- Use distinct command names/contracts for archive, restore, and permanent delete. Do not present `deleted_at` as permanent deletion.
- Archive/restore authorization: active Admin and active PM. Permanent deletion: active Admin only.
- Permanent-delete command accepts a finite entity discriminator (`project`, `task`, `deliverable`, `milestone`) and UUID; validates caller, entity active/archived state, dependency/referential/retention/audit rules; writes attempt/outcome audit evidence; fails closed without partial cleanup.
- Recycle-bin projection returns only authorized project-scoped archived records, human-readable identity, archived timestamp/actor/reason, restore availability, and safe dependency-block reason. It excludes audit internals and unrelated records.
- Every active-source query/feed/selector listed below filters archived/deleted operational records: project list, task Kanban/list, deliverable list, calendar feed/milestone associations, member/assignment selectors, normal reports/metrics, notifications affordance queries, and task-detail projections.

### M04: account/access hygiene/bug triage

- Account update command is self-only, validates bounded display name/locale/timezone/phone/preference values, and records normal audit evidence. It cannot change role, activation, another profile, or security-delivery policy.
- Access-deactivation command is Admin/PM-only and revokes/deactivates the target while preserving profile, membership, invitation, work, and audit history. It locks the target row, blocks self-lockout and removal of the last active management-capable account, revokes relevant pending invites, and audits actor/reason/target without raw tokens. Admin/PM cannot use it to permanently delete a user record.
- Reminder state must model one notification per uninterrupted inactive period. Eligibility is exactly: active `client`/`operator`; 45 consecutive days; neither successful authentication nor qualifying active project/task/deliverable assignment/membership. Either qualifying event resets the period. Passive activity does not. No job/provider activation is part of this sprint; the data/command contract must remain capable of a later evaluator.
- `bug_reports` must be append-only for reporter content. Required state is `open|triaged|resolved|dismissed`; report creation is authenticated; Admin/PM triage mutation is authorized/audited; no unrestricted client-visible issue tracker exists.

### Conditional M05: manager task detail

Inspect the applied M01–M04 declarations and current RLS first. If direct manager queries cannot safely return the exact detail shape, add one `STABLE SECURITY DEFINER` role-safe projection for active Admin/PM only. It returns task/project context, assignee summary, task state, current authorized associated deliverables, and latest version metadata. It must not return raw audit payloads, arbitrary URLs, contact directory data, private comments beyond existing task authority, or records outside the authorized project.

## 3. Routes and information architecture

| Surface | Required route/placement | Authorization |
| --- | --- | --- |
| Client/contact administration | Discoverable Admin and PM navigation entry; exact route follows established locale model | Active Admin/PM global authority |
| Invitation management | Discoverable Admin and PM operations/users area | Active Admin/PM; ordinary roles only |
| Account | `<L>/cuenta` or a single accepted authenticated equivalent | Active self only |
| Report a problem | Authenticated profile/account navigation | Active self submit; Admin/PM triage |
| Privacy / terms | `<L>/privacidad`, `<L>/terminos` | Public |
| Manager task detail | `<L>/admin/proyectos/[id]/tareas/[task-id]`, `<L>/pm/proyectos/[id]/tareas/[task-id]` | Active Admin/PM with task/project authorization |
| Operator task detail | Existing `<L>/operador/tareas/[task-id]` | Own assigned task only |
| Client task detail | Existing `<L>/cliente/tareas/[task-id]` | Authorized client task only |

Every dynamic page independently checks session role and obtains data only through its role-safe server query. A missing, archived, deleted, or unauthorized task must use the established safe absence treatment; do not disclose which condition occurred.

Manager task pages include breadcrumbs: project list → project → Tasks/Kanban → task title. The back destination preserves locale and uses the valid workspace `?tab=tasks` state. The full page supplements, not replaces, the right-side sheet.

## 4. Task details and deliverable context

### Detail model

Replace the sheet’s current `has_deliverables` message with a section driven by actual associated deliverables. Per authorized deliverable show:

- title;
- workflow/status display;
- current version number (or no submitted version state);
- latest version link only when a valid URL exists;
- a contextual Open deliverable/details action; and
- a role-appropriate correction/submission action.

Use the existing deliverable DTO/model where it has the required fields. Do not duplicate per-deliverable browser queries; pass a server-authorized task detail DTO to the sheet/page or use one bounded server action.

### Link correction

“Edit link” means correct the current deliverable submission through the established deliverable version workflow. The implementation must:

1. preserve the previous `deliverable_versions` row and URL as historical evidence;
2. validate the new URL through the existing trusted submission/correction boundary;
3. create or identify a new auditable current version according to the deliverable workflow;
4. refresh the task sheet/full page to the new current version; and
5. deny Client/Operator/PM Watcher actions not already allowed by the deliverable workflow.

Never mutate a historic `submission_url` in place, never permit free-text raw HTML/URLs, and never claim external-link reachability merely because a URL was saved.

## 5. Calendar regression correction

The current milestone dialog links every task to `/admin|pm/proyectos/[projectId]?tab=tasks`. The workspace shell receives raw `initialTab={tab}` and only fetches calendar data when the server query equals `calendar`; a stale client shell can therefore render a calendar panel with missing data during a task-navigation transition.

Required correction:

1. Normalize workspace `tab` server-side to the finite supported set; absent/invalid values become `overview`.
2. Synchronize client active-tab state when server-derived initial tab/path changes; do not preserve stale calendar-only state across a route transition.
3. Change milestone task links to the new role-safe manager task-detail route, not merely the task tab. The destination is task-specific and eliminates ambiguous selection/loading behavior.
4. If a task-tab return is retained, it must use only normalized `tab=tasks`; the task tab must render from its own supplied data and never show the calendar loader.
5. Add regression coverage for Admin and PM milestone task clicks, locale preservation, browser back, and an unavailable/unauthorized task.

## 6. Lifecycle UI requirements

- The existing `/archivo` historical/finalized archive remains distinct from the project operational recycle bin.
- Recycle bin visibly labels archived, restore, and permanently delete separately.
- The permanent-delete confirmation is localized and explicit. English baseline: `Permanently delete this [item type]?` and `This action cannot be undone. Archived items can be restored from Archive, but permanently deleted items cannot.` Actions are `Confirm permanent deletion`, `Archive instead`, `Cancel`.
- `Archive instead` starts ordinary archive confirmation; it does not delete.
- PM UI must never render a hidden/admin-only permanent-delete action, and server/RPC/RLS deny it independently.

## 7. Public/account UX and accessibility

- All visible text uses `messages/es.json` and `messages/en.json`; no Spanish fallback string belongs in a shared data/query layer.
- Desktop task detail keeps the existing sheet. At narrow widths, full task detail and deliverable associations must remain single-column, keyboard reachable, and not rely on hover.
- Use real links for read-only navigation and buttons only for mutations. Do not nest interactive controls.
- Dialog/sheet/confirmation flows retain Escape/cancel/focus-return behavior. Primary actions meet the established touch target rule and status is not color-only.
- Legal footer is visible on sign-in, password/recovery, invitation, public landing/legal pages. It does not expose protected navigation.

## 8. Expected implementation areas

```text
supabase/migrations/20260830110000_s10-direct-client-identity-and-invitation-administration.sql
supabase/migrations/20260830111000_s10-archive-recycle-bin-and-admin-permanent-deletion.sql
supabase/migrations/20260830112000_s10-account-access-hygiene-and-bug-triage.sql
supabase/migrations/20260830113000_s10-manager-task-detail-projection.sql (conditional)
src/lib/database.types.ts                         (generated unchanged after M01 application)
src/lib/clients/*  src/lib/projects/*  src/lib/archive/*  src/lib/auth/*
src/lib/deliverables/*  src/lib/calendar/*  src/lib/<account/access/bug-report modules>
src/app/[locale]/(protected)/admin/**  src/app/[locale]/(protected)/pm/**
src/app/[locale]/(protected)/operador/**  src/app/[locale]/(protected)/cliente/**
src/components/shared/projects/**  src/components/shared/app-nav/**
src/app/[locale]/privacidad/**  src/app/[locale]/terminos/**  src/app/sitemap.ts  src/app/robots.ts
messages/es.json  messages/en.json
```

This is an inventory, not permission to refactor every listed file. Reuse existing task/detail/deliverable, navigation, dialog, and absence components where their contracts fit.

## 9. Verification and stop conditions

Do not create exhaustive TDD, coverage, fixtures, role-matrix suites, or broad regression tests for S10. Preserve existing controlling tests when their contract changes. Add only the smallest focused test needed for a concrete new trusted command/route boundary or a reproduced defect; never duplicate the same proof across roles.

For M01, inspect the exact applied-equivalent SQL and record the Project Owner's Supabase MCP application/type-generation evidence. For implementation work, run `npm run lint` and `npm run typecheck`; run one affected Vitest test only when a focused test was actually added or updated. Defer `npm run build` until all integrated route work is complete.

Stop and create a new decision/migration review if any implementation would: require an organization universally; use membership capacity to deny global PM management; mutate a historical deliverable version; expose a directory/contact/token/secret; permanently delete an excluded entity; or require provider activation for evidence.

## 10. Completion criteria

The S10 implementation is ready for closeout only when all listed behavior is present and role-safe in `jsf-pm-dev`, exact migration/type provenance is documented, all focused evidence is factual, and provider/production/legal-signoff limits remain clearly deferred. No sprint result may be labeled production live, externally deliverable, legally approved, or commercial-plan compliant.
