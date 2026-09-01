---
document_id: S10-03-RECOVERABLE-LIFECYCLE-RECYCLE-BIN-AND-ADMIN-PERMANENT-DELETION-IMPLEMENTATION-SPEC-01
sprint_id: S10
work_items: [S10-03]
status: implementation-ready-schema-baseline
updated_at: 2026-09-01T16:29:29-06:00
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

All execute only as `authenticated`; every public routine is `SECURITY DEFINER`, owned by `postgres`, has `search_path = pg_catalog, public`, revokes `public`, `anon`, and `service_role`, and independently verifies the active actor. Never add a client-side Supabase RPC call, direct table mutation, service-role route, arbitrary SQL, generic entity string, or browser-selected URL.

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
  projectId: string | null;
  title: string;
  archivedAt: string;
  archivedBy: string | null;
  archiveReason: string | null;
  parentIsArchived: boolean;
};
```

The adapter validates every RPC row, including UUIDs, finite entity type, nonempty title, ISO timestamp, nullable values, and boolean. It returns `{ status: "unavailable" }` for RPC/error/shape failures and never substitutes `[]`. A valid empty list is `{ status: "available", data: [] }`.

Create one Admin-only deletion-preview adapter. It validates `entity_type`, `entity_id`, nonempty title, boolean `can_delete`, and nullable known `blocker_code`; it never accepts a browser title. No bulk preview endpoint is needed.

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

Add one discoverable localized **Archived items** / recycle-bin destination for Admin and PM using the existing locale-aware protected navigation model. Extend the shared server-derived navigation model once; update every authorized renderer/icon map. Do not add it to Operator or Client navigation and do not use a hard-coded client-side role check as the authority source.

The exact path must follow actual repository route conventions and be shared by Admin/PM if their route topology permits. If existing role-specific roots require distinct locale-safe URLs, both must render the same role-safe reuse component and call the same server-only adapter. The destination is not `/archivo` and must not render `ArchiveListView`/`FinalizedArchivePage` as its data source.

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
- When `parentIsArchived` is true, disable restore and explain that the parent must be restored first. The server command still remains authoritative.
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
| Database projections | Consume the M03-reconciled role-safe calendar, milestone, operator/client, metrics, alert, notification, and related SQL projection contracts. Application adapters must use those contracts and must not compensate with browser filtering, direct-table reads, service-role access, or a second migration. |
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
- the M03 migration/type contract consumed;
- focused tests changed/added and exact commands/outcomes;
- archive cascade/restore behavior implemented;
- active-surface query families reconciled;
- authorization outcome: Admin/PM archive/restore, Admin-only permanent delete;
- localization/accessibility changes;
- immutable/history preservation behavior for permanent deletion;
- manual environment evidence, if actually performed, clearly separated from automated evidence;
- blockers or known limitations.

Do not claim production deployment, provider activation, all-database RLS proof, permanent deletion of history, successful remote migration, or manual evidence that was not actually executed.
