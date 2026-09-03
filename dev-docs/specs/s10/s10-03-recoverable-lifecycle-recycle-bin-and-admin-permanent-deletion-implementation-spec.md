---
document_id: S10-03-RECOVERABLE-LIFECYCLE-RECYCLE-BIN-AND-ADMIN-PERMANENT-DELETION-IMPLEMENTATION-SPEC-01
sprint_id: S10
work_items: [S10-03]
status: implementation-ready-s10-03-parent-state-correction-applied
updated_at: 2026-09-02T09:37:06-06:00
target_environment: jsf-pm-dev
schema_baseline:
  - supabase/migrations/20260830110000_s10-direct-client-identity-and-invitation-administration.sql
  - supabase/migrations/20260831100000_s10-02-ordinary-invitation-lifecycle.sql
  - supabase/migrations/20260831114500_s10-association-projection-and-direct-contact-enforcement.sql
  - supabase/migrations/20260831123000_s10-association-projection-integrity-and-invitation-list-index.sql
  - supabase/migrations/20260831153000_s10-active-project-command-enforcement.sql
  - supabase/migrations/20260901120000_s10-02-r1-invitation-completion-profile-authority.sql
  - supabase/migrations/20260901130000_s10-02-r1-cancelled-project-command-enforcement.sql
  - supabase/migrations/20260901140000_s10-03-archive-recycle-bin-and-admin-permanent-deletion.sql
  - supabase/migrations/20260902090000_s10-04-account-access-hygiene-bug-triage-and-s10-03-closure.sql
  - supabase/migrations/20260902100000_s10-03-recycle-bin-parent-state-correction.sql
generated_types: src/lib/database.types.ts
---

# S10-03 — Recoverable Lifecycle, Operational Recycle Bin, and Admin-Only Permanent Deletion

## 1. Authority, outcome, and complete boundary

This is the complete implementation authority for **S10-03 only**. It consumes the schema contract declared in its frontmatter. It replaces the application’s legacy use of generic soft deletion for the four named operational entities with a recoverable archive lifecycle, an authorized operational recycle bin, and a narrow Admin-only irreversible command.

The required outcome is exact:

1. Admin and PM have equivalent global authority to archive and restore **projects, tasks, deliverables, and first-class milestones**.
2. Archive is recoverable and distinct from permanent deletion. It is not a status transition and it never means `deleted_at` for an S10-03 entity.
3. Archived operational records are absent from every active work surface: project lists/details, workspace tabs, Kanban/list task views, deliverable views/details, calendar feeds, milestone planning/summary/detail projections, assignment/form selectors, ordinary metrics/reporting, alert evaluation, notification-affordance queries, and every new query added by this work.
4. An Admin-only operational recycle bin is discoverable from both Admin and PM navigation. It is separate from the existing role-scoped `/archivo` finalized-production history. PM may restore but must never see, obtain, call, or bypass permanent deletion.
5. Permanent deletion is limited to **projects, tasks, deliverables, and milestones**, requires the target to be archived first **and dependency-free**, is independently authorized and audited, and never deletes, unlinks, nulls, anonymizes, or otherwise changes a dependent or immutable/history record to make the target eligible.
6. Operator and Client receive no recycle-bin, archive, restore, permanent-delete, lifecycle metadata, or archived-record access through this work.
7. The implementation preserves the existing locale architecture, strict TypeScript, server-only Supabase boundary, Zod input validation, safe error mapping, and no-provider posture.

This specification intentionally does not add user deactivation, contact deletion, organization deletion, invitation deletion, profile deletion, legal routes, provider activation, task-detail redesign, calendar-navigation repair, a new audit viewer, API routes, public routes, RLS weakening, service-role browser use, production work, or VSDD/Kanban artifacts.

## 2. Non-negotiable product and security decisions

| Subject | Binding rule |
| --- | --- |
| Application authority | `profiles.role` is authoritative. Active `admin` and active `pm` have global lifecycle-management authority. `pm_lead` and `pm_watcher` are project membership metadata and never gate S10-03 archive/restore capability. |
| Archive/restore | Admin and PM can archive and restore all four target entity types through the same server/action/RPC authority model. |
| Permanent deletion | Only active Admin may permanently delete the four target entity types. PM, Operator, Client, anonymous callers, stale/revoked sessions, UI-state spoofing, and direct browser RPC/table access fail closed. |
| Archive-first deletion | The target must already be archived. A deletion preview or command returning `archive_required` is not success. The UI offers **Archive instead** without performing any action until the ordinary archive confirmation completes. |
| Immutable/history and dependency preservation | Never permanently delete, unlink, null, anonymize, or mutate profiles/users, contacts, organizations, invitation records, notification events/recipients, audit logs, deliverable versions, deliverable feedback, deliverable-link reports, memberships, comments, calendar events, resources, or milestone links. Their existence makes the corresponding archived target ineligible for permanent deletion. |
| Recycle bin | The recycle bin contains only archived operational entities. It must not reuse, relabel, or merge with finalized-production archive history. |
| Errors | Database/internal error text never reaches the browser. A missing/deleted/unavailable target uses an existing safe not-found/unavailable presentation and reveals no unrelated entity state. |
| Localization | Every visible, tooltip, screen-reader, confirmation, loading, unavailable, success, and error string exists with structurally identical `en-US` and `es-MX` keys. |

## 3. Vocabulary and state model

### 3.1 Canonical terminology

- **Active**: the operational entity exists, has `deleted_at IS NULL`, and has `archived_at IS NULL`; parent active-state requirements also hold.
- **Archived**: the target exists, has `deleted_at IS NULL`, and has `archived_at IS NOT NULL`. It is recoverable only through `restore_archived_operational_entity`.
- **Permanently deleted**: the dependency-free target row no longer exists. It cannot be restored. No dependent, immutable, or historical record is deleted, unlinked, nulled, or changed to permit this state.
- **Deleted_at**: legacy/deprecated soft-delete metadata. It is not an S10-03 archive signal and must not be written by the S10-03 UI/actions.
- **Recycle bin**: the `list_operational_recycle_bin` projection and its UI. It is not `ArchiveListView`, `FinalizedArchivePage`, the `/archivo` route, or a deliverable finalization/history browser.
- **Milestone**: `public.milestones`, the first-class S09-06 model. It is not a legacy `calendar_events` row.

### 3.2 Target lifecycle state machine

```text
active --archive--> archived --restore--> active
archived --permanent delete (Admin only)--> permanently deleted
```

No transition may set `deleted_at` for an S10-03 target. No restore path can recreate a permanently deleted row. No deletion path may silently archive an active row. A deletion command that is unauthorized, lacks an archived target, has a missing row, or finds an unavailable scope returns a safe non-success result and must not be represented as successful.

### 3.3 Parent and cascade semantics

| Triggering archive | Automatic archive effect | Restore effect |
| --- | --- | --- |
| Project | Active child tasks, active child deliverables, and active project-scoped milestones are archived. Existing independently archived children remain independently archived. Company milestones are not archived. | Restore project, then restore only children marked as archived by that project. Independently archived children stay archived. |
| Task | Active child deliverables are archived. | Restore task only when its project is active, then restore only deliverables marked as archived by that task and not still project-cascaded. |
| Deliverable | Only that deliverable is archived. Its versions, feedback, and link reports remain intact. | Restore only when both parent task and parent project are active. |
| Project-scoped milestone | Only that milestone is archived. Its `milestone_tasks` associations remain for recovery/audit. | Restore only when its project is active. |
| Company milestone | Only that milestone is archived. It remains unassociated with a project. | Restore without a project-parent condition. |

The UI must not try to reproduce this cascade algorithm. It calls the authoritative command once, then refreshes/revalidates the affected authorized surfaces.

## 4. Applied database contract

### 4.0 Applied-baseline settlement — mandatory reading before implementation

`20260902090000_s10_04_account_access_hygiene_bug_triage_and_s10_03_closure`
is applied to `jsf-pm-dev`. The required forward correction,
`20260902100000_s10_03_recycle_bin_parent_state_correction`, is also applied to
`jsf-pm-dev`, and `src/lib/database.types.ts` was regenerated from that deployed
baseline. It preserves the recycle-bin RPC signature and security posture while
making `parent_is_archived` true for an archived deliverable whose project **or
task** parent is archived. This specification is implementation-ready on that
applied and regenerated baseline.

The M04 file includes two distinct, already-applied concerns:

1. S10-04 account-access-hygiene and bug-triage database capabilities, which are
   out of scope for this S10-03 UI work; and
2. the forward S10-03 active-ancestry closure across 49 existing trusted views,
   RPCs, private helpers, and validation triggers.

Contract ownership is deliberately split: M03 owns lifecycle metadata, cascade
semantics, the five lifecycle RPC definitions, their ACL/ownership/security
posture, retention behavior, and permanent-deletion dependency rules. M04 does
not recreate those five functions. M04 owns the forward repair of all active
surfaces that consume operational entities, the replacement behavior of generic
`soft_delete_entity`/`restore_entity`, and S10-04 access-hygiene state. The
application must consume both applied contracts as one baseline while preserving
their distinct responsibilities.

Do not author another archive-visibility migration, modify M04, reapply M03/M04,
hand-edit `database.types.ts`, weaken RLS, or try to compensate for archive
visibility in browser filtering. Consume the deployed RPC/view contract through
the generated declaration. The application work replaces legacy callers and adds
the authorized recycle-bin experience.

The deployed M04 correction to `set_user_access_state` splits its locked
`public.profiles` composite-row lookup from its `auth.users.email` lookup. That
change is valid and unrelated to S10-03 lifecycle behavior. Do not revert,
refactor, or test it as part of this work item.

The public database enum is broader than the S10-03 product allowlist. Therefore
`Database["public"]["Enums"]["entity_type"]` must never be exposed as the
application's lifecycle input type. The narrow four-value Zod/TypeScript allowlist
in this specification is mandatory even though the RPC accepts the broader enum.

### 4.1 Archive metadata

The generated declaration exposes these applied columns:

- `projects`: existing `archived_at`, plus `archived_by`, `archive_reason`.
- `tasks`: `archived_at`, `archived_by`, `archive_reason`, `archived_parent_project_id`.
- `deliverables`: `archived_at`, `archived_by`, `archive_reason`, `archived_parent_project_id`, `archived_parent_task_id`.
- `milestones`: `archived_at`, `archived_by`, `archive_reason`, `archived_parent_project_id`.

Only trusted database commands write these fields. `archive_reason` is optional; when supplied it is trimmed and limited to 1–1000 characters. Never expose an archive reason to Operator or Client. The recycle-bin manager view may display it only when it is part of the returned role-safe projection.

### 4.2 Trusted RPCs

Use only these signatures for S10-03 lifecycle mutation/read behavior:

```sql
public.archive_operational_entity(
  p_entity_type public.entity_type,
  p_entity_id uuid,
  p_reason text default null
) returns table (success boolean, code text)

public.restore_archived_operational_entity(
  p_entity_type public.entity_type,
  p_entity_id uuid
) returns table (success boolean, code text)

public.list_operational_recycle_bin(
  p_project_id uuid default null
) returns table (
  entity_type public.entity_type,
  entity_id uuid,
  project_id uuid,
  title text,
  archived_at timestamptz,
  archived_by uuid,
  archive_reason text,
  parent_is_archived boolean
)

public.get_operational_deletion_preview(
  p_entity_type public.entity_type,
  p_entity_id uuid
) returns table (
  entity_type public.entity_type,
  entity_id uuid,
  title text,
  can_delete boolean,
  blocker_code text
)

public.permanently_delete_operational_entity(
  p_entity_type public.entity_type,
  p_entity_id uuid
) returns table (success boolean, code text)
```

These lifecycle routines are inherited from M03: all execute only as
`authenticated`; every public routine is `SECURITY DEFINER`, owned by `postgres`,
has `search_path = pg_catalog, public`, revokes `public`, `anon`, and
`service_role`, and independently verifies the active actor. M04 does not change
these lifecycle routine definitions or their grants. Never add a client-side
Supabase RPC call, direct table mutation, service-role route, arbitrary SQL,
generic entity string, or browser-selected URL.

### 4.3 Closed entity-type allowlist

The only legal S10-03 entity-type values are exactly:

```ts
type OperationalLifecycleEntityType =
  | "project"
  | "task"
  | "deliverable"
  | "milestone";
```

Do not accept `calendar_event`, `profile`, `client`, `project_member`, `collaboration_comment`, `invite_token`, `notification`, `audit_log`, `deliverable_version`, `feedback`, `link_report`, an arbitrary `entity_type`, an arbitrary table name, or an unchecked string. Validate the UUID and entity type before the server action calls an RPC. The database allowlist remains authoritative.

### 4.4 Legacy command retirement

The legacy `soft_delete_entity`, `restore_entity`, and `soft_delete_milestone` route is not an S10-03 implementation boundary. Existing project/task/deliverable archive callers must be migrated to the new archive command; milestone callers must no longer call `soft_delete_milestone`. Do not add compatibility fallbacks that invoke the old command after a new-command failure.

### 4.5 Permanent deletion behavior

The permanent delete command is safe only for active Admin. It requires an archived, dependency-free row. It returns `success=false, code='not_found_or_archive_required'` for a missing, already-deleted, or still-active target and `success=false, code='dependencies_present'` when any protected/historical or operational dependency exists. Either result is a hard non-success. It writes durable Admin audit evidence for every evaluated deletion outcome and writes a success audit record before the eligible physical deletion commits.

The dependency-free rule is exact and intentionally restrictive:

- A project is blocked by any `project_members`, tasks, deliverables, collaboration comments, calendar events, invitations, notification events, project-scoped milestones, or direct project-contact association.
- A task is blocked by any task resource, child deliverable, milestone association, or linked calendar event.
- A deliverable is blocked by any deliverable version, feedback, or link report.
- A milestone is blocked by any `milestone_tasks` association.

The command never deletes descendants/joins to make a target eligible and never changes foreign keys, nullability, retention semantics, immutable history, or audit history. The archived target remains in the recycle bin after a dependency-blocked result and can be restored.

## 5. Required server architecture

### 5.1 Module ownership

Keep server-only query modules under the established feature libraries and mark them `import "server-only"`. Keep mutations in existing `"use server"` action modules or a narrowly named S10-03 lifecycle action module. Client components receive only role-safe DTOs and invoke actions; they do not import query/command modules.

Expected ownership (inspect actual current paths before editing):

```text
src/lib/projects/commands.ts
src/lib/projects/actions.ts
src/lib/projects/task-actions.ts
src/lib/projects/queries.ts
src/lib/projects/errors.ts
src/lib/deliverables/commands.ts
src/lib/deliverables/actions.ts
src/lib/deliverables/queries.ts
src/lib/milestones/<queries-and-actions-existing-or-new>.ts
src/lib/<new-narrow-operational-lifecycle-module>.ts
src/components/shared/projects/project-workspace/*
src/components/shared/projects/project-tasks/*
src/components/shared/projects/project-deliverables/*
src/components/shared/milestones/*
src/app/[locale]/(protected)/admin/*
src/app/[locale]/(protected)/pm/*
messages/en-US.json
messages/es-MX.json
```

Do not move unrelated project, archive-history, notification, calendar, client-contact, or metric implementation merely to centralize this feature. Keep each new file below 600 lines.

### 5.2 Server action requirements

Every lifecycle action must:

1. Resolve `cookies()` and `requireSession` first.
2. Verify `session.role` is `admin` or `pm` for archive/restore, and exactly `admin` for deletion preview/permanent deletion, before database work.
3. Strictly validate a UUID and closed `OperationalLifecycleEntityType`. For archive, validate optional reason with the exact 1000-character trimmed maximum.
4. Call only the matching new RPC.
5. Parse every returned row exactly. A malformed row, unknown `code`, null value, empty unexpected result, or more than the expected single mutation row fails closed as `UNKNOWN`/unavailable; never coerce it to success.
6. Map safe result codes to existing/new safe `CommandResult` codes. Database messages never reach components.
7. Revalidate only after a successful mutation. Revalidate the exact localized Admin and PM project routes when a project scope is known, role project-list routes, the lifecycle recycle-bin route, calendar/milestone destinations, and only the metrics/notification routes whose existing server render consumes affected active data. Do not revalidate on a failed/no-op response.
8. Return safe structured results usable by local pending state and localized feedback.

Archive/restore actions must not accept a browser-provided project title, status, role, archive metadata, cascade list, or redirect. Deletion confirmation uses a server-derived preview; permanent deletion accepts only the validated entity type and entity ID.

### 5.3 Query requirements

Create one narrow recycle-bin adapter over `list_operational_recycle_bin`. It returns only:

```ts
type OperationalRecycleBinItem = {
  entityType: OperationalLifecycleEntityType;
  entityId: string;
  // Company milestones have no project parent.
  projectId: string | null;
  title: string;
  archivedAt: string;
  // Archive provenance is retained but not rendered by this S10-03 surface.
  archivedBy: string | null;
  // An archive reason is optional.
  archiveReason: string | null;
  parentIsArchived: boolean;
};
```

The adapter validates every RPC row against the generated M04 declaration:
nonempty known entity type, UUID `entityId`, nullable UUID `projectId` only for a
company milestone, nonempty title, ISO timestamps, nullable UUID `archivedBy`,
nullable string `archiveReason`, and boolean `parentIsArchived`. It returns
`{ status: "unavailable" }` for RPC/error/shape failures and never substitutes
`[]`. A valid empty list is `{ status: "available", data: [] }`.

Create one Admin-only deletion-preview adapter. It validates `entity_type`, UUID
`entity_id`, nonempty title, boolean `can_delete`, and string `blocker_code`; it
never accepts a browser title. The generated declaration represents
`blocker_code` as `string`, while a deletable M03 SQL row can contain SQL `NULL`.
After validating exactly one row, normalize only `(canDelete === true,
blockerCode === null)` to the explicit application value `blockerCode: null`.
For `canDelete === false`, require a nonempty known blocker code. Any other null,
unknown code, or mismatch is unavailable. No bulk preview endpoint is needed.

### 5.4 Role matrix

| Surface/command | Admin | PM | Operator | Client | Anonymous |
| --- | ---:| ---:| ---:| ---:| ---:|
| Active project/task/deliverable/milestone views | Existing authorized scope only | Existing authorized scope only | Existing authorized scope only | Existing authorized scope only | No |
| Archive a target | Yes, global | Yes, global; no capacity gate | No | No | No |
| Restore a target | Yes, global | Yes, global; no capacity gate | No | No | No |
| Recycle-bin list | Yes | Yes | No | No | No |
| Deletion preview | Yes | No | No | No | No |
| Permanent deletion | Yes | No | No | No | No |
| Legacy finalized `/archivo` history | Existing role-safe behavior unchanged | Existing role-safe behavior unchanged | Existing role-safe behavior unchanged | Existing role-safe behavior unchanged | No |

A PM with no `project_members` row or with only `pm_watcher` capacity still has the S10-03 global manager controls. Existing project-specific editing rules unrelated to lifecycle are not broadened by this feature.

## 6. Active-surface exclusion inventory

This is mandatory. Do not implement only the recycle bin while leaving an archived entity discoverable or actionable through an existing active projection. Inspect every existing query/RPC/view/component named below and all call sites. Add `archived_at IS NULL` for the target and required active parents; use the applied type contract, not hand-edited declarations.

### 6.1 Projects

Active project list/detail/selectors must require:

```sql
projects.deleted_at is null
and projects.archived_at is null
```

Cover Admin/PM project directories; project workspace loaders/routes; client-management project options; invitation/project identity option queries; project completion/readiness/recovery queries; assignment selectors; status dialogs; project navigation; metrics project filters/options; project deadline calendar rows; notification deep-link target resolution; alert evaluator project joins; and any query that treats `projects` as active based only on `deleted_at` or status.

An archived project route may resolve to a safe unavailable/not-found state outside the recycle bin. It must not render normal workspace tabs/actions or leak archived descendants through the active workspace.

### 6.2 Tasks

Active task list/detail/Kanban/agenda/selectors must require:

```sql
tasks.deleted_at is null
and tasks.archived_at is null
and parent_project.deleted_at is null
and parent_project.archived_at is null
```

Cover project workspace task list and Kanban; `TaskWithAssignee` loaders; task detail actions; Operator agenda and task-detail safe projection; Client task/request projections; task calendar deadlines; milestone target/options/detail/progress/count queries; `create_task_with_deliverables`/task mutation eligibility; assignment options; operational metrics; alert evaluation; notification affordances; and all task route loaders.

### 6.3 Deliverables

Active deliverable list/detail/workflow actions must require:

```sql
deliverables.deleted_at is null
and deliverables.archived_at is null
and parent_task.deleted_at is null
and parent_task.archived_at is null
and parent_project.deleted_at is null
and parent_project.archived_at is null
```

Cover project workspace deliverables; `getDeliverableDetail`; direct Client submission view; Operator task detail; deliverable version submit/review/deliver/reopen/link-report mutation eligibility; finalized archive query; deliverable calendar deadlines; metrics; alert evaluator; notification deep links/context; and associated task/deliverable context.

Archived deliverables must not appear in the existing finalized-production archive merely because their status was approved/delivered. The finalized archive retains its original finalized-history meaning.

### 6.4 Milestones

The target is `public.milestones`, not `calendar_events`. Active milestone reads/mutations require:

```sql
milestones.deleted_at is null
and milestones.archived_at is null
and (
  milestones.scope = 'company'
  or (parent_project.deleted_at is null and parent_project.archived_at is null)
)
```

For associated tasks, include active task and parent-project predicates. Cover `list_task_milestone_options`, `list_milestone_management_targets`, `get_milestone_detail`, `list_milestone_tasks`, `list_project_milestone_summaries`, create/update milestone validation, task bundle/milestone association validation, calendar milestone projection, task progress calculations, project overview milestone sections, and every milestone component/action.

Do not resurrect the retired legacy calendar-event milestone commands. Legacy calendar events must remain out of S10-03 UI scope.

### 6.5 Calendar

The role-safe calendar feed must exclude archived projects, tasks, deliverables, and milestones in every union arm. An archived project must contribute no project deadline, task deadline, deliverable deadline, or milestone event. An archived task must contribute no task deadline and no child deliverable deadline. An archived deliverable must contribute no review/delivery/submission deadline. An archived milestone must contribute no milestone event.

Do not infer exclusion only from the route. Enforce it in the database feed/projection and keep route/UI filtering defensive rather than authoritative.

### 6.6 Reporting, notifications, selectors, and background-safe behavior

- Normal reports and operational metrics exclude archived targets and archived parents. Historical audit records remain retained but are not normal live-work totals.
- Active assignment/member/form selectors exclude archived project/task/deliverable contexts.
- Alert evaluation must not create new alert/notification affordances for archived targets or children of archived parents.
- Notification history remains immutable and visible under its existing recipient policy, but a current target that is archived, deleted, missing, or unauthorized resolves to `none`; never construct a stale deep link.
- Existing notification recipients/events are not deleted by S10-03.
- Invitation commands and client identity flows keep their current project archived checks; do not weaken them.

## 7. Recycle-bin information architecture and interaction contract

### 7.1 Placement and routing

Add one discoverable localized **Archived items** / recycle-bin destination for Admin
and PM using the existing locale-aware protected navigation model. Extend
`src/components/shared/app-nav/navigation-model.ts` once, then update every
authorized desktop/mobile renderer and icon map. Do not add it to Operator or
Client navigation and do not use a hard-coded client-side role check as the
authority source.

The exact routes are `/admin/papelera` and `/pm/papelera`. Each is under the
existing `[locale]/(protected)` segment and must render the same role-safe reuse
component backed by the same server-only adapter. The destination is not `/archivo`
and must not import, render, relabel, or reuse `ArchiveListView`,
`FinalizedArchivePage`, `fetchFinalizedArchivePage`, or finalized-production
archive types as its data source.

### 7.2 Recycle-bin page

The page has exactly these states:

1. Loading/skeleton state without fabricated rows.
2. Available empty state: no archived operational items.
3. Available populated state: rows/cards from the lifecycle projection.
4. Unavailable state: adapter/RPC/shape error; do not render an empty bin.
5. Action success/failure feedback localized through the established toast/inline pattern.

Rows show only the returned safe fields: entity type label/icon, title, archived timestamp, project context only when the returned `projectId` and current role-safe page design permits it, optional archive reason, and parent-archived explanation. Do not fetch profile directory data merely to display `archived_by`.

Use stable deterministic sorting supplied by the RPC: newest archive first, then entity type, then ID. Do not implement client-side role filtering or guess parent state.

### 7.3 Restore interaction

- Available to Admin and PM only.
- Restore is an explicit button; it has a localized accessible label containing entity type/title context.
- When `parentIsArchived` is true, disable restore and explain that the archived
  project or task parent must be restored first. The post-correction RPC computes
  this for every relevant parent; the server command still remains authoritative.
- Pending state is per entity row. It disables only that row’s controls, not filtering, other rows, or the entire page.
- Success refreshes the lifecycle page and affected active views. It announces localized success exactly once.
- `not_found_or_parent_archived` maps to a safe unavailable/parent-not-restored message and refreshes the row list; it never claims success.

### 7.4 Admin permanent deletion interaction

The recycle-bin row may provide an Admin-only destructive control. PM markup must not include this control, a hidden dialog, a preview action, or a permanent-delete handler reference. Server action and RPC enforce the same boundary.

Opening the dialog first invokes the Admin-only preview. The dialog must not be shown from a locally cached entity title alone. On a valid preview it displays:

- localized entity type;
- server-derived safe title;
- explicit irreversible warning;
- the exact localized actions: **Confirm permanent deletion**, **Archive instead**, **Cancel**;
- `Archive instead` closes the delete dialog and opens/returns to ordinary archive flow only; it does not mutate by itself.

English semantic baseline:

> Permanently delete this [item type]? This action cannot be undone. Archived items can be restored from Archived items, but permanently deleted items cannot.

The Mexican Spanish message must preserve the same irreversible meaning. Use a destructive styled dialog and explicit confirm button; never use `window.confirm`, a one-click menu command, or an unlabelled trash icon. Confirmation does not require typing the item title unless the repository already has an accepted shared destructive-confirmation primitive that requires it; do not introduce inconsistent confirmation mechanics.

On command success, close dialog, clear preview state, refresh authorized recycle-bin and active surfaces, and announce completion. On a false/malformed/failure response, retain dialog focus, show safe localized error, do not optimistically remove the row, and do not navigate.

### 7.5 Existing active controls

Replace current misnamed archive controls for projects, tasks, deliverables, and milestones with the new archive command and correct localized language. Existing task/deliverable controls currently styled/labelled as destructive must be reviewed: Archive must be visually distinguishable from irreversible deletion and must not use copy claiming permanent removal. Preserve an explicit archive confirmation when current component patterns supply one; do not make archive accidental.

The existing active-workspace `restore` action in
`ProjectStatusDialog`/`ProjectHeader` is obsolete and must be removed. An archived
project must not render a normal active workspace from which it can be restored.
Restore is initiated only by an Admin/PM recycle-bin row. Likewise, do not add
restore buttons to task, deliverable, or milestone active surfaces.

Archive controls are visible to Admin and global PM under the matrix, not only project leads. Preserve read-only limits for Operator/Client. The workspace must disappear/refresh safely when its enclosing project is archived.

## 8. Focused implementation file map

The following is a mandatory inspection map, not permission to refactor unrelated code:

| Area | Existing evidence / required implementation change |
| --- | --- |
| Legacy project lifecycle | `src/lib/projects/commands.ts` currently maps project archive/restore to `soft_delete_entity`/`restore_entity`; replace both with typed new RPC adapters and make PM restore legal. |
| Legacy task lifecycle | `src/lib/projects/task-actions.ts` and command adapter currently archive through `soft_delete_entity`; replace with archive command and add restore integration through recycle-bin only. |
| Legacy deliverable lifecycle | `src/lib/deliverables/commands.ts` and `actions.ts` archive through `soft_delete_entity` and pre-gate by project-lead capacity; replace with global Admin/PM action and new command. |
| Legacy milestone lifecycle | Current first-class milestone action uses `soft_delete_milestone`; replace with the new archive command. Do not alter legacy calendar-event deletion behavior as a substitute. |
| Workspace loaders | `src/lib/projects/queries.ts`, `src/lib/deliverables/queries.ts`, role pages, headers, workspace shell, task and deliverable tabs must consume active-only data and hide management actions for archived scope. |
| Database projections | Consume the applied M03 lifecycle contract plus M04-repaired role-safe calendar, milestone, operator/client, metrics, finalized-history, alert, notification, invitation, link-incident, and validation-trigger contracts. M04 is authoritative for active-ancestry exclusion. Application adapters must use those contracts and must not compensate with browser filtering, direct-table reads, service-role access, or a second migration. |
| Navigation | Shared server-derived role navigation model and all renderers/icon maps receive one archive-bin entry for Admin/PM. |
| Messages | `messages/en-US.json` and `messages/es-MX.json` receive identical key shape; no hard-coded strings in touched UI. |
| Tests | Adapt only focused directly affected tests and add only focused coverage described in §10. |

## 9. Strict input, result, error, and revalidation contract

### 9.1 Zod schemas

Create/reuse strict schemas with `.strict()`/equivalent no-unknown-key behavior:

```ts
OperationalLifecycleEntityTypeSchema = z.enum([
  "project",
  "task",
  "deliverable",
  "milestone",
]);

OperationalLifecycleIdSchema = z.string().uuid();

ArchiveOperationalEntitySchema = z.object({
  entityType: OperationalLifecycleEntityTypeSchema,
  entityId: OperationalLifecycleIdSchema,
  reason: z.string().trim().min(1).max(1000).nullable().optional(),
}).strict();

RestoreOperationalEntitySchema = z.object({
  entityType: OperationalLifecycleEntityTypeSchema,
  entityId: OperationalLifecycleIdSchema,
}).strict();

PermanentDeletionSchema = RestoreOperationalEntitySchema;
```

Normalize empty archive reason to `null` server-side. Never accept `projectId` as authority for a task/deliverable/milestone mutation; derive it from the returned/database target.

### 9.2 Closed codes

Use a finite application result mapping. At minimum distinguish:

```ts
type OperationalLifecycleCode =
  | "archived"
  | "restored"
  | "already_archived"
  | "already_active"
  | "permanently_deleted"
  | "archive_required"
  | "dependencies_present"
  | "not_found"
  | "not_found_or_parent_archived"
  | "not_found_or_archive_required";
```

Unknown database output maps to a safe unavailable/unknown error. Do not display database exception strings, raw PostgREST details, SQL function names, titles from an unvalidated response, or authorization diagnostics.

### 9.3 Revalidation matrix

| Successful action | Required refresh scope |
| --- | --- |
| Archive/restore project | Admin/PM project lists, exact Admin/PM project routes, recycle bin, calendar, milestone surfaces, active project selectors/manager options, normal metrics/notifications only if their existing server page loads affected active data. |
| Archive/restore task | Exact project workspace task/deliverable/milestone views, recycle bin, calendar, manager task selectors, Operator/Client active task routes if they may have held the target, applicable active metrics/notifications. |
| Archive/restore deliverable | Exact project workspace deliverables/task context, recycle bin, calendar, finalized archive projection if it derives active deliverables, applicable active metrics/notifications. |
| Archive/restore milestone | Exact project overview/milestone pages, recycle bin, calendar, milestone form options and progress summaries. |
| Permanent deletion | Same scope as the matching archive plus closure of an open target detail/dialog and removal of now-invalid local selection. |

Use actual locale paths and existing `revalidatePath` conventions. Do not globally revalidate all routes, manually mutate cache data, or rely on optimistic deletion.

## 10. Focused verification

Do not add test-first ceremony, broad regression expansion, coverage runs, E2E, provider work, manual fixture infrastructure, or full-suite verification. Preserve or update existing focused tests that directly consume the replaced command contract.

Run only the smallest applicable focused checks after implementation:

```text
npm run lint
npm run typecheck
npm run test -- <affected project lifecycle tests> <affected deliverable lifecycle tests> <affected milestone/recycle-bin focused tests>
```

Required focused assertions:

1. Archive action accepts only the four entity types, validates UUID/reason, uses the new RPC, and never calls `soft_delete_entity`/`soft_delete_milestone`.
2. Restore accepts Admin and PM, rejects Operator/Client before RPC, uses the new restore RPC, and handles parent-archived/malformed results fail-closed.
3. Admin permanent-delete action and preview reject PM before database invocation. PM UI has no delete control/dialog/handler.
4. Deletion dialog uses server-derived preview title/type, has all three localized actions, has no native browser confirm, does not delete on `Archive instead`, and does not optimistically remove a row after failure.
5. Recycle-bin adapter distinguishes valid empty from unavailable, validates every returned row, preserves allowed DTO minimization, and renders parent-archived restore explanation.
6. At least one active query/projection assertion per target type proves archived entities are excluded, including parent archive exclusion for task/deliverable/milestone where applicable.
7. Locale catalogs have structural key parity for every new lifecycle string.
8. Existing focused action tests are updated for PM restore/global PM archive authority and no longer assert Admin-only restore or PM-lead-only task/deliverable archive behavior.

Manual development-environment evidence, if performed, must remain separate from test claims. It must cover: Admin archive/restore; global PM archive/restore without relying on `pm_lead`; PM permanent-delete denial; Admin preview → cancel; Admin archived-target permanent deletion; archived target absent from active project/task/deliverable/calendar/milestone surface; and finalized `/archivo` history remaining separate from recycle bin.

## 11. Accessibility and localization acceptance criteria

- Every icon-only control has a localized accessible name.
- Dialog has accessible title, description, focus trap/restoration, keyboard Escape behavior where the existing dialog primitive supports it, and destructive action is not the default accidental focus target.
- Pending state is scoped to the initiating row/dialog; unrelated list rows and controls remain operable.
- Status/error/success messages use the established live-region/toast behavior and do not rely on color alone.
- Table and mobile-card recycle-bin presentations expose the same actions/information without duplicate interactive control sets or duplicate IDs.
- Dates use existing locale formatter semantics. Do not format raw timestamps manually.
- Copy says Archive/Restore/Permanently delete accurately. Never label archive as delete, never call permanent delete recoverable, and never imply that historical records were erased.

## 12. Completion-report contract

The implementation report must state only factual evidence:

- exact changed files;
- the consumed M03 lifecycle migration contract and M04 forward-closure migration contract, with their distinct responsibilities;
- generated-type/static-source evidence distinguished from actually executed hosted catalog, RLS, or runtime evidence;
- focused tests changed/added and exact commands/outcomes;
- archive cascade/restore behavior implemented;
- active-surface query families reconciled;
- authorization outcome: Admin/PM archive/restore, Admin-only permanent delete;
- localization/accessibility changes;
- immutable/history preservation behavior for permanent deletion;
- manual environment evidence, if actually performed, clearly separated from automated evidence;
- blockers or known limitations.

Do not claim production deployment, provider activation, all-database RLS proof, permanent deletion of history, successful remote migration, or manual evidence that was not actually executed.

## 13. Binding implementation sequence and current-file migration map

Implement in this order. Do not begin with dialogs or routes before the typed
server boundary exists.

### 13.1 Step A — lifecycle domain boundary

Create this narrow lifecycle module tree exactly:

```text
src/lib/operational-lifecycle/types.ts
src/lib/operational-lifecycle/schemas.ts
src/lib/operational-lifecycle/errors.ts
src/lib/operational-lifecycle/commands.ts
src/lib/operational-lifecycle/queries.ts
src/lib/operational-lifecycle/actions.ts
```

`commands.ts` and `queries.ts` import `server-only`; `actions.ts` contains the
minimal `"use server"` exports. The tree owns only:

- the closed four-value entity-type union and Zod schemas;
- exact RPC argument construction;
- row parsing for archive, restore, recycle-bin list, deletion preview, and
  permanent deletion;
- finite safe result-code mapping;
- the recycle-bin and preview DTOs; and
- one server action boundary for each mutation/read interaction if this is the
  repository's established action organization.

It must not own generic project CRUD, final-production archive history, account
settings, bug-triage, direct-client administration, notifications, or raw UI
state. It must import `server-only` in query/command modules. No component may
call Supabase RPC directly.

Every lifecycle RPC result must be handled as a table-returning result. For each
mutation, require exactly one row containing a boolean `success` and a known
string `code`. `data === true`, `Boolean(data)`, `data?.[0]` without shape
validation, and a successful PostgREST transport response are not success
criteria. A malformed, empty, multi-row, unknown-code, or RPC-error result is a
safe failure. Do not leak its database text.

Preserve `src/lib/projects/commands.ts` project-member legacy soft deletion. It
is not an S10-03 target and is not a license to retain generic operational
project/task/deliverable lifecycle calls.

### 13.2 Step B — retire actual legacy application call sites

Replace, do not wrap, the following current paths:

| Current file | Current behavior to retire | Required S10-03 result |
| --- | --- | --- |
| `src/lib/projects/commands.ts` | `archiveProject` calls `soft_delete_entity`; `restoreProject` calls `restore_entity`; `archiveTask` calls `soft_delete_entity`. | Use the new lifecycle adapter/RPCs. Remove active-workspace project restore ownership. |
| `src/lib/projects/actions.ts` | Project archive/restore actions delegate to legacy project commands. | Archive through the new typed action. Remove/replace active-workspace restore action and preserve route-safe revalidation. |
| `src/lib/projects/task-actions.ts` | `archiveTaskAction` delegates to legacy task archive. | Require active Admin/PM, validate input, call the new archive action, and revalidate the exact project/lifecycle surfaces after success only. |
| `src/lib/deliverables/commands.ts` | `archiveDeliverable` calls `soft_delete_entity`. | Use the new archive lifecycle RPC and strict result parser. |
| `src/lib/deliverables/actions.ts` | Archive pre-gates PM by `verifyPmLeadCapacity`. | Remove that capacity gate for this lifecycle action. Admin and every active PM are allowed; database remains authoritative. |
| `src/lib/calendar/actions.ts` | `softDeleteMilestoneAction` calls `soft_delete_milestone`. | Replace with archive lifecycle behavior for first-class milestones only; preserve unrelated legacy calendar-event behavior. |
| `src/components/shared/projects/project-workspace/project-status-dialog.tsx` | Includes an active-workspace restore branch and hard-coded pending copy. | Remove the restore branch; preserve archive confirmation; replace hard-coded copy with localized key; do not expose raw action errors. |
| `src/components/shared/projects/project-workspace/project-header.tsx` | Offers active-surface restore affordance. | Remove restore affordance. Archive remains correctly role-gated. |
| `src/components/shared/projects/project-tasks/task-archive-dialog.tsx` | Calls legacy task action and styles archive as destructive deletion. | Retain a bounded optional reason, use new action, distinguish archive from permanent delete, and map safe errors. |
| `src/components/shared/projects/project-deliverables/deliverable-archive-dialog.tsx` | Calls legacy deliverable action, has 500-character UI cap, and destructive styling. | Align optional reason UX with database maximum 1000; call new action; accurate archive visual/copy; safe error handling. |
| `src/app/[locale]/(protected)/calendario/_components/delete-milestone-dialog.tsx` | Calls `softDeleteMilestoneAction`. | Replace with archive terminology/action and a safe localized result flow. |
| `src/app/[locale]/(protected)/calendario/_components/calendar-coordinator.tsx` | Hosts the milestone delete dialog/selection lifecycle. | Wire the renamed archive dialog, clear stale selection after success, and preserve non-milestone calendar behavior. |

After implementation, no S10-03 operational caller may reference
`soft_delete_entity`, `restore_entity`, or `soft_delete_milestone`. The legacy
functions remain for non-S10-03 historical uses only. Do not remove them from
the schema or change their non-operational allowlist.

### 13.3 Step C — recycle-bin routes, page, and navigation

Create the two route pages:

```text
src/app/[locale]/(protected)/admin/papelera/page.tsx
src/app/[locale]/(protected)/admin/papelera/loading.tsx
src/app/[locale]/(protected)/admin/papelera/error.tsx
src/app/[locale]/(protected)/pm/papelera/page.tsx
src/app/[locale]/(protected)/pm/papelera/loading.tsx
src/app/[locale]/(protected)/pm/papelera/error.tsx
```

They must require their respective protected manager session before loading data,
invoke the server-only recycle-bin adapter, and pass only its role-safe DTO to a
shared lifecycle component. The PM route must not import an Admin-only preview or
permanent-delete action into a client bundle. The Admin page may compose a narrow
Admin-only deletion dialog around the shared rows.

Update `src/components/shared/app-nav/navigation-model.ts` and each consuming
desktop/mobile navigation renderer to add a single `recycleBin`/equivalent
manager-only destination. Add a matching localized navigation key and icon-map
entry. Do not rename, repoint, or remove the existing Admin/PM/Operator/Client
`/archivo` routes; those remain finalized-production history.

The required navigation edit set is
`src/components/shared/app-nav/navigation-model.ts`,
`src/components/shared/app-nav/_components/desktop-nav-drawer.tsx`, and
`src/components/shared/app-nav/_components/mobile-nav-toggle.tsx`. Update the
`AppNavigationItemKey`, desktop `ICON_MAP`, and mobile drawer icon map. The
recycle bin is visible in the manager full navigation/drawer only; it is
**excluded** from the fixed mobile quick-access row. No Operator or Client
navigation model, quick-access item, icon mapping, or route may include it.

Existing `project-workspace/project-archive-tab.tsx`,
`ProjectArchiveTab`, and the `archive` workspace tab remain finalized-production
history only. They must retain `fetchFinalizedArchivePage`/`ArchiveListView`
behavior and must not receive recycle-bin data, recycle-bin controls, or a route
link. The operational recycle bin is deliberately excluded from workspace tabs.

### 13.4 Step D — active workspace and route reconciliation

The database now excludes archived state at its trusted boundary. Application
code must still respond safely when a user is holding a stale route, tab, sheet,
or cached client selection:

1. An active project route that no longer resolves must use the existing safe
   unavailable/not-found behavior, not render a partial workspace or redirect
   into a recycle-bin detail that does not exist.
2. Close task/deliverable detail sheets and clear selected IDs after successful
   archive/delete rather than retaining stale component state.
3. Do not construct fresh deep links to archived entities from rows, toasts, or
   callback results.
4. Leave immutable finalized history and notification history intact. Their
   current-target navigation must remain safe when the target is unavailable.
5. Do not add browser filtering intended to conceal archived rows. It is only
   permissible to defensively discard a stale already-authorized DTO after a
   successful action; the next server render remains the source of truth.
6. Preserve M04's access-hygiene behavior. Do not modify or regress
   `private.user_has_qualifying_access`, assignment-change refresh behavior, or
   project-change refresh behavior; archive/restore must retain their
   trigger-driven effect on qualifying active access.

### 13.5 Step E — localization and accessibility delivery

Add structurally identical keys under a new dedicated `operationalLifecycle`
namespace/subtree in `messages/en-US.json` and `messages/es-MX.json`. Do not
overload the existing `archive` namespace because it describes finalized
production history. The new subtree includes, at minimum:

- manager navigation destination and description;
- recycle-bin title, loading, empty, unavailable, entity labels, parent-archived
  explanation, archive timestamp and optional reason presentation;
- archive confirmation, optional-reason label/description, pending, success, and
  finite safe failure states;
- restore confirmation/action, pending, success, parent-archived/unavailable,
  and generic unavailable states;
- deletion-preview loading/unavailable; irreversible warning; confirmed success;
  `Cancel`, `Archive instead`, and `Confirm permanent deletion`; and
- accessible names for row actions, icon controls, and dialog controls.

Do not use `Procesando...`, raw database messages, function names, or ad hoc
English/Spanish literals in touched components. Archive is recoverable and must
not use the destructive red visual treatment reserved for permanent deletion.
Permanent deletion is visually destructive. Existing shared dialog primitives
provide the focus semantics; use them rather than custom modal behavior.

## 14. Focused test and evidence matrix

Update only focused tests directly affected by the changed contract. Current
tests that explicitly mock/assert legacy RPC names are required update points:

| Test file | Required update |
| --- | --- |
| `__tests__/projects/actions.test.ts` | Assert project archive uses the new RPC/result row; remove active-workspace restore assertion and verify safe failure mapping. |
| `__tests__/projects/tasks.test.ts` | Replace `soft_delete_entity` mock/assertion with new typed task archive contract; cover invalid input and PM authority. |
| `__tests__/deliverables/deliverable-actions.test.ts` | Verify every active PM can archive without PM-lead pre-gating and no legacy RPC is called. |
| `__tests__/projects/deliverables-workspace.test.tsx` | Update fixture/action mocks only as required by the new archive DTO/control behavior. |
| `__tests__/projects/project-workspace-calendar.test.tsx` | Preserve final-production archive-tab behavior and add focused separation from the new recycle bin. |
| `src/app/[locale]/(protected)/calendario/__tests__/calendar-coordinator.test.tsx` | Replace the soft-delete milestone mock/expectation with the new archive action and prove stale selection is cleared on success. |
| `__tests__/app-shell/navigation.test.ts` | Assert Admin/PM full-navigation visibility, Operator/Client exclusion, icon-map completeness, and recycle-bin exclusion from fixed mobile quick access. |
| `__tests__/database/schema-contract.test.ts` and `__tests__/database/security-definer-refactor.test.ts` | Preserve legacy-function assertions only for their retained non-operational scope; add/adjust the applied S10-03 RPC contract checks without weakening security assertions. |
| `__tests__/i18n/message-catalogs.test.ts` | Assert exact key-shape parity for the new lifecycle namespace(s). |

Add focused tests for the new server adapter/actions and recycle-bin UI. At a
minimum prove all requirements in §10, plus:

1. UI and server action reject an extra object property, unknown entity type,
   invalid UUID, and a reason longer than 1000 before invoking RPC.
2. Archive/restore/permanent-delete each reject `[]`, two rows, an unknown code,
   a non-boolean success value, and an RPC error without a success toast or
   optimistic state mutation.
3. PM can see/use restore but has no permanent-delete import, button, dialog,
   preview call, or action invocation path.
4. `/admin/papelera` and `/pm/papelera` use lifecycle data; `/admin/archivo` and
   `/pm/archivo` still use finalized-history data.
5. The legacy operational RPC strings are absent from all new lifecycle actions
   and UI paths.

Run the smallest directly applicable checks only after implementation. The
minimum acceptance commands are:

```text
npm run typecheck
npm run lint
npm run test -- __tests__/projects/actions.test.ts __tests__/projects/tasks.test.ts __tests__/deliverables/deliverable-actions.test.ts __tests__/projects/deliverables-workspace.test.tsx __tests__/projects/project-workspace-calendar.test.tsx __tests__/database/schema-contract.test.ts __tests__/database/security-definer-refactor.test.ts __tests__/i18n/message-catalogs.test.ts
```

Do not run coverage, browser E2E, provider checks, local Supabase/Docker, schema
reset, `db:bootstrap`, or broad unrelated test suites for S10-03 unless the
implementation changes those areas or the owner explicitly expands scope.
