---
document_id: S09-06-MILESTONE-GOALS-AND-TASK-PROGRESS-IMPLEMENTATION-SPEC-01
sprint_id: S09
work_item: S09-06
status: migration-source-ready-pending-project-owner-application
created_at: 2026-08-28T00:00:00-06:00
branch: feature/milestone-improvements
target_environment: jsf-pm-dev
required_applied_migrations:
  - supabase/migrations/20260823144000_s07_e09_calendar-task-scoped-milestones-and-pm-authority.sql
  - supabase/migrations/20260827123000_s09-04-task-deliverable-bundle-and-workflow-integrity.sql
  - supabase/migrations/20260828110000_s09-06-milestone-goals-and-task-progress.sql
---

# S09-06 — Milestone Goals, Task Progress, and Project Timeline

## 1. Objective

Replace the legacy manual-calendar-event milestone feature with a useful top-down planning system:

1. A **Milestone** (`Meta` in Spanish) is a date-bound company or project goal.
2. A milestone may have zero, one, or many associated tasks.
3. A company milestone may collect work from multiple projects; a project milestone may collect work only from its owning project.
4. Milestone progress is derived from associated active task completion. It is never manually entered or manually marked complete.
5. Admins and PMs manage milestones. Operators receive only contextual goal information through their own assigned tasks. Clients do not receive milestones in this scope.
6. PM/Admin project Overview receives a useful timeline without losing the existing task and deliverable intelligence. Storage & Links moves into the compact project metadata panel.
7. Calendar remains a role-safe timeline projection of milestones and existing deadline records; it is no longer the owner of milestone persistence.

This is **Alternative C** accepted by the Project Owner: two deliberate scopes plus many-to-many task association.

## 2. Authority and decisions accepted

### 2.1 Precedence

1. Direct Project Owner direction, including the accepted decisions in this specification.
2. This S09-06 specification.
3. S09-04 for the existing atomic task-plus-deliverables command and task-type/deliverable workflow constraints.
4. S09-05 for current workspace Overview, calendar, localization, and role-safe calendar interaction patterns.
5. `AGENTS.md`, existing authentication/RLS contracts, and current repository conventions.

### 2.2 Accepted product decisions

| Decision | Accepted behavior |
| --- | --- |
| Spanish terminology | Use **Meta** / **Metas** in all Spanish UI copy. English remains **Milestone** / **Milestones**. Database identifiers, API names, and enum values remain `milestone`. |
| Scope | A milestone is either `project` or `company`. |
| Project milestone | Has exactly one owning project and may associate only tasks from that project. |
| Company milestone | Has no owning project and may associate tasks from any active non-cancelled project. |
| No-task milestone | Allowed for either scope. It displays `No tasks associated with this milestone yet` / localized equivalent and has no calculated percentage. This is an explicit **untracked** state, not `0% complete`. |
| Dates | A milestone has one required **target completion date** (`target_date`). It has no start date, end date, time-of-day, duration, or All Day toggle. Calendar renders it as a one-day all-day item. |
| Progress | Derived from active associated tasks: `completed active tasks / all active associated tasks`. |
| Weighting | No points, effort estimates, manual percentages, health score, auto-risk score, or manual milestone completion control. |
| Task relation | Many-to-many. A task may contribute to more than one milestone when that is truly useful. No relation is automatic. |
| Task creation | Authorized task planners may optionally select existing eligible milestones. The task and its selected relations must be created atomically through the extended S09-04 task bundle RPC. |
| Manager access | Every active `admin` and `pm` application role may manage/read milestones. `pm_lead` and `pm_watcher` are project membership capacities, not milestone application roles. |
| Operator access | No milestone management and no calendar goal feed. An operator sees only safe goal context for milestones linked to their directly assigned task. |
| Client access | No milestone visibility or management in this item. Client task, submission, review, and delivery boundaries remain unchanged. |

## 3. Scope boundaries

### In scope

- First-class milestone persistence and migration from legacy `calendar_events` milestones.
- Project/company milestone scope, task association, role-safe projections, mutation commands, progress derivation, audit events, and generated type refresh.
- Calendar projection of first-class milestones.
- Admin/PM create, detail, edit, delete, task-association, and optional task-creation linkage flows.
- Task detail goal-context presentation for the directly assigned operator.
- Project Overview timeline and company-goal-contribution section.
- Relocating Overview Storage & Links into Ficha técnica / project metadata.
- English/Spanish localization and focused tests.

### Explicitly out of scope

- New project hierarchy, portfolio, program, objective, key-result, sprint, dependency, Gantt, workload, capacity, estimate, weighting, or task-template systems.
- Manually setting milestone progress/status, task weighting, automatic risk scoring, notifications, reminders, escalation, or recurring goals.
- Changing task, deliverable, review, submission, project-completion, client-portal, provider, or metrics workflows.
- Showing company/project milestones to Clients or giving Clients milestone mutation rights.
- Operator access to other contributing tasks, project IDs, project names beyond existing own-task context, or company-wide milestone detail.
- Changing existing task creation authority: task creation remains Admin or active PM Lead according to the existing S09-04/server boundary. Milestone management authority is broader than task-creation authority.
- Broad calendar redesign, arbitrary direct-table browser access, service-role access, or an HTTP API.

## 4. Canonical domain model

### 4.1 Entity relationship

```text
Project milestone                 Company milestone
(scope = project)                 (scope = company)
project_id required               project_id NULL
        │                                  │
        └───────── milestone_tasks ───────┘
                         │
                       Task
```

`milestone_tasks` is a many-to-many association. Its primary key is `(milestone_id, task_id)`. It prevents duplicate links while allowing one task to contribute to several distinct goals.

### 4.2 `milestones`

| Field | Contract |
| --- | --- |
| `id` | UUID primary key. |
| `scope` | Text constrained to `project` or `company`. No new enum is required. |
| `project_id` | Required only when `scope = project`; forbidden when `scope = company`. |
| `title` | Required trimmed text, 1–160 characters. |
| `description` | Optional trimmed text, maximum 2,000 characters. |
| `target_date` | Required `date`, not a timestamp. It is the goal’s target completion date. |
| `color_override` | Optional existing chart token (`chart-1` through `chart-5`). |
| audit fields | `created_by`, `updated_by`, `created_at`, `updated_at`, `deleted_at`. |

### 4.3 `milestone_tasks`

| Field | Contract |
| --- | --- |
| `milestone_id` | Active milestone foreign key. |
| `task_id` | Active task foreign key. |
| `created_by`, `created_at` | Immutable association provenance. |

A trigger enforces all association invariants independently of UI input:

1. The milestone exists and is not soft-deleted.
2. The task exists and is not soft-deleted.
3. The task’s project exists, is not deleted, and is not cancelled.
4. A project milestone’s task belongs to its `project_id`.
5. A company milestone can contain active tasks from any project.

Soft-deleted tasks retain their association rows for history but are excluded from all current progress calculations and list/detail projections.

### 4.4 Progress and derived presentation state

For every milestone:

```text
active_task_count = active associated tasks
completed_task_count = active associated tasks where status = completed
progress_percent = completed_task_count / active_task_count × 100
```

The application must not persist `progress_percent`; compute it from the supplied safe projection.

| Condition | UI state |
| --- | --- |
| `active_task_count = 0` | **Untracked**. No percentage or visually “empty completion” bar. Show localized no-associated-tasks text. |
| `completed_task_count = 0`, task count > 0 | `0% · 0 of N tasks completed` / localized equivalent. |
| `0 < completed < active` | In progress. Render percentage and count. |
| `completed = active`, task count > 0 | Completed. Render `100% · All associated tasks completed`. |

The projection also returns counts of `in_progress`, `in_review`, and `blocked` tasks. Use those only as secondary status context, such as `1 in progress · 1 blocked`; they do not alter the percentage.

## 5. Legacy migration and database contract

### 5.1 Required source file

`supabase/migrations/20260828110000_s09-06-milestone-goals-and-task-progress.sql`

The migration is source only until the Project Owner applies it to the explicitly authorized `jsf-pm-dev` Supabase project through MCP.

### 5.2 Legacy calendar-event conversion

Active legacy manual `calendar_events` records where `event_type = 'milestone'` must be preserved as follows:

1. Create one `project` milestone for each legacy event.
2. Preserve title, description, color token, original creator/update provenance, and creation/update timestamps.
3. Convert the legacy `starts_at` instant to `target_date` using `America/Mexico_City`, the company business timezone.
4. If its legacy `task_id` remains active and valid, create the corresponding `milestone_tasks` association.
5. Soft-delete the legacy calendar row so no direct/legacy read path displays a duplicate.
6. Write an immutable `milestone_migrated_from_calendar_event` audit event with the legacy calendar ID and discarded legacy schedule metadata.
7. Retire the old `create_calendar_milestone`, `update_calendar_milestone`, `soft_delete_calendar_milestone`, `get_calendar_milestone_for_edit`, and `list_calendar_milestone_targets` function surfaces.

Legacy `ends_at` and `is_all_day` are intentionally discarded because the first-class goal model has only `target_date`.

### 5.3 Database access boundary

`milestones` and `milestone_tasks` enable RLS and receive no direct authenticated/anon table grants or policies. Application code must use only the migration’s purpose-limited `SECURITY DEFINER` functions, each with fixed `search_path = pg_catalog, public` and authenticated-only execute grants.

No browser or server application code may select, insert, update, or delete either table directly.

### 5.4 Public read RPCs

| Function | Audience | Contract |
| --- | --- | --- |
| `list_task_milestone_options(project_id)` | Admin/PM | Returns active company milestones plus active project milestones for the supplied project. This is the optional task-create selector projection. |
| `list_milestone_management_targets()` | Admin/PM | Returns active non-cancelled projects and their active tasks, limited to IDs/labels/status required by milestone create/edit association selection. |
| `get_milestone_detail(milestone_id)` | Admin/PM | Returns one safe goal header and exact active/completed/in-progress/in-review/blocked task counts. |
| `list_milestone_tasks(milestone_id)` | Admin/PM | Returns active associated task rows: task/project IDs, project name, task title, status, priority, deadline. |
| `list_project_milestone_summaries(project_id)` | Admin/PM | Returns local project milestones plus company milestones to which that project contributes. Company-goal progress is global. |
| `list_role_safe_calendar_events(from, to, project_id?)` | Existing roles | Preserves existing deadline visibility/DTO. For Admin/PM it adds first-class milestone dates. Operators and Clients receive no milestones. |

A missing/unauthorized milestone detail must produce a safe generic unavailable state in the application; it must not disclose whether the record was deleted or inaccessible.

### 5.5 Public mutation RPCs

| Function | Authority | Contract |
| --- | --- | --- |
| `create_milestone(scope, project_id, title, description, target_date, color_override, task_ids)` | Admin/PM | Creates a local/company milestone and up to 100 initial unique task links transactionally. |
| `update_milestone(milestone_id, scope, project_id, title, description, target_date, color_override, task_ids)` | Admin/PM | Locks the milestone, validates the full replacement association set before deleting existing links, then updates the record and replaces its links transactionally. |
| `soft_delete_milestone(milestone_id)` | Admin/PM | Soft-deletes the milestone and preserves association/audit history. |

All three write auditable `milestone_*` events. UI validation is helpful but never authoritative; forged UUIDs, invalid cross-project local links, duplicate task IDs, deleted records, cancelled projects, invalid scope/project combinations, over-limit task arrays, and invalid color/title/date values must fail at the database boundary.

### 5.6 Atomic task creation extension

The existing S09-04 `public.create_task_with_deliverables(...)` RPC adds an optional final argument:

```text
p_milestone_ids uuid[] default '{}'
```

The response remains unchanged:

```ts
{
  task: Database["public"]["Tables"]["tasks"]["Row"];
  deliverable_ids: string[];
}
```

When one or more milestone IDs are selected, the RPC inserts the new task and its associations in the same transaction as optional deliverables. Any invalid association rolls back the task, every requested association, and all drafted deliverables.

The existing direct `createTaskAction` remains valid when no milestone is selected. The task dialog must route any non-empty milestone selection through the extended bundle RPC even when it contains zero deliverable drafts.

## 6. Roles and visibility matrix

| Surface/action | Admin | PM | Operator | Client |
| --- | ---:|---:|---:|---:|
| Read milestone detail/task list | Yes | Yes | No | No |
| Create/edit/delete milestone | Yes | Yes | No | No |
| Associate/dissociate task | Yes | Yes | No | No |
| Select goals while creating a task | Existing task-create authority | Existing task-create authority | No | No |
| Calendar milestone rows | Yes | Yes | No | No |
| Project Overview timeline | Yes | Yes | No | No |
| Goal context on assigned task | N/A | N/A | Only linked-goal title/scope/target date | No |

### PM capacity clarification

For this feature, `pm_watcher` does **not** reduce an active PM application role’s milestone authority. The current PM project-page membership guard and task-creation guard remain separate concerns. If a PM watcher cannot create a task under the existing task-authority rule, they cannot use the task-create shortcut; they can still manage milestones as a PM.

### Operator goal context

Operator task detail may render a compact read-only section:

```text
Contributes to goals
- [Company goal] Website update with Client XYZ testimony · Target Oct 15
- [Project goal] Final delivery · Target Oct 8
```

It must not expose other associated tasks, completion percentage, project IDs, or a company-goal detail route. It consumes a dedicated task-safe projection only if needed; do not reuse manager detail data or direct milestone tables.

## 7. UX contract

## 7.1 Admin/PM create milestone dialog

Replace the old calendar-event form. The visual order is:

1. **Scope** — single-choice control: `Project milestone` / `Company milestone` (`Meta de proyecto` / `Meta de empresa`).
2. **Project** — required only for Project scope; hidden/cleared for Company scope.
3. **Title** — required.
4. **Description** — optional.
5. **Target completion date** — required date-only field.
6. **Color** — optional existing color token.
7. **Associated tasks (optional)** — searchable multi-select grouped by project.
   - Project scope shows only active tasks from the selected project.
   - Company scope shows active tasks grouped by active project.
   - Selection displays selected count and removable chips/rows.
   - Maximum 100 selected tasks.
8. Cancel/Create controls.

Do not render start date, end date, date-time input, all-day checkbox, duration, manual percent, or manual completion status.

Changing scope or project after selected tasks exist requires an explicit destructive-change confirmation if it would remove invalid selections. Never silently retain a task that violates the selected scope.

## 7.2 Milestone detail dialog/sheet

A manager milestone activation opens an actionable controlled detail surface in place; it does not navigate the calendar route.

Required content:

1. Localized scope badge: `Project milestone` / `Company milestone`.
2. Title, target date, optional description, and optional color token presentation.
3. Owning project name only for project scope.
4. Progress region:
   - tracked: percentage, `completed of total`, accessible progressbar semantics, and secondary non-zero in-progress/review/blocked counts;
   - untracked: no percentage and the accepted no-associated-tasks copy.
5. Associated tasks grouped by project. Each manager task row links only to the current authorized project workspace Tasks tab.
6. Actions for Admin/PM: `Edit`, `Add tasks` (may use the edit form with focus on selection), `Create related task`, and `Delete`.

`Create related task` opens the existing task dialog with this milestone preselected. It does not grant PM watcher task-creation authority. On an unauthorized task-create attempt, preserve the existing safe refusal rather than changing membership authority.

The dialog must support keyboard Escape/close, focus restoration, loading, a generic unavailable failure state, and no raw UUID/database error/audit data exposure.

## 7.3 Edit and deletion behavior

- Edit permits scope, owning project where appropriate, title, description, target date, color, and full association replacement.
- Changing a Company milestone to Project scope is allowed only if every selected task belongs to the selected owning project. Otherwise the UI blocks submission with localized explanation and the database independently rejects it.
- Changing Project scope to Company scope clears the owning project field but retains currently selected valid active tasks.
- Delete is a confirmation-gated soft deletion. It does not delete tasks or associations.
- All relevant calendar, project Overview, task detail, and manager detail routes revalidate after successful mutation.

## 7.4 Task create dialog

Add a planning section after task details/assignee and before the existing Deliverables section:

```text
Contributes to goals (optional)
[Multi-select eligible milestones]
```

Rules:

- Display only for users who can already create the task.
- Load options after the task project is known.
- Include only the task project’s local milestones and company milestones.
- Do not show other projects’ local milestones.
- Preserve selected goal IDs through deliverable-draft changes and task-type changes because milestone relation does not depend on task type.
- With no selected goals and no deliverable drafts, retain existing task-only action.
- With selected goals and/or deliverables, call the extended atomic bundle RPC.
- On safe failure, retain entered form/draft state; never show partial success.

Task edit is out of scope for adding/removing milestone links. Association management occurs from milestone detail/edit in this item.

## 7.5 Calendar behavior

Calendar continues to show deadline records and becomes a projection of milestones:

- Admin/PM see all milestone dates in the global Calendar.
- In a project-filtered Calendar/workspace Calendar, show that project’s local milestones plus company milestones with at least one active associated task in the filtered project.
- Label scope visibly: `[Project]` / `[Company]` and localized equivalents.
- Milestones always render as one-day all-day items on `target_date`.
- Manager activation opens the new milestone detail surface without route/range mutation.
- Operators and Clients receive no milestone calendar rows in this feature.

## 7.6 Project Overview information architecture

### Preserve existing work intelligence

The existing **Active tasks** and **Deliverables** overview panels remain. Their counts, status breakdowns, links, and behavior from S09-05 must not be removed or weakened.

### Move Storage & Links

Remove the large main-column **Storage & Links / Almacenamiento y enlaces** card. Add the Drive folder link/value to the existing right-column **Ficha técnica** / metadata card, below deadline/client metadata. Preserve external-link safety and the existing no-link empty state.

### Add project timeline

In the main column, add a **Project timeline / Cronograma del proyecto** card before the existing work-summary panels.

It contains:

1. Header summary of local project goal count, completed count, and due-this-week count when calculable.
2. A compact chronological list of up to five nearest relevant **project-scope** milestones. Prioritize overdue, then upcoming target date, then title.
3. Every row displays target date, title, progress/untracked state, and a scope-appropriate non-color cue.
4. Every row is a semantic Button opening in-place milestone detail, or a Link only if the existing architecture explicitly establishes an equivalent route. Do not use clickable `<div>` cards.
5. A localized `View project calendar` affordance opens the existing calendar tab.
6. Empty state: concise localized text plus a manager-only `Create milestone` action when current project/page authority allows it.

Add a distinct compact **Company goals this project contributes to** subsection only when applicable. It lists company milestones with at least one active task from this project. Its progress is the global milestone percentage, visibly labeled as Company scope. Do not mix these with project-owned goal totals.

## 8. Application targets

Exact implementation targets may require small responsibility-preserving extraction. Keep non-generated files at or below 400 lines.

| Target | Required change |
| --- | --- |
| `supabase/migrations/20260828110000_s09-06-milestone-goals-and-task-progress.sql` | Apply only after Project Owner review/authorization. |
| `src/lib/database.types.ts` | Replace only with MCP-generated output after successful dev application; never hand edit. |
| `src/lib/calendar/types.ts` | Replace legacy milestone DTOs with typed first-class milestone summary/detail/task/option DTOs and strict normalizers. Retain calendar event DTO compatibility. |
| `src/lib/calendar/queries.ts` | Replace retired legacy RPC adapters with server-only adapters for new projections. Fail closed on RPC error/malformed row. |
| `src/lib/calendar/actions.ts` | Replace retired create/update/delete legacy actions with validated manager-only milestone actions. Use safe errors and exact revalidation. |
| `src/lib/calendar/schemas.ts` | Replace start/end/all-day schemas with scope/project/target-date/task-ID array validation. Enforce client-side max 100 links and safe UUID inputs. |
| `src/components/shared/projects/project-workspace/project-calendar-tab.tsx` | Consume first-class milestone behavior and manager authority, preserve calendar range ownership. |
| `src/app/[locale]/(protected)/calendario/_components/*` | Replace legacy form/detail rendering; wire actionable detail, edit, task association, and scope-aware calendar labels across every calendar view. |
| `src/app/[locale]/(protected)/calendario/page.tsx` | Load new manager-only form targets only for Admin/PM; preserve role-safe feed behavior. |
| `src/app/[locale]/(protected)/admin/proyectos/[id]/page.tsx` | Load project milestone summaries for Overview and new calendar form data only when needed. |
| `src/app/[locale]/(protected)/pm/proyectos/[id]/page.tsx` | Same as Admin page, preserving current page guard behavior. |
| `src/components/shared/projects/project-workspace/project-workspace-shell.tsx` | Pass milestone summaries and manager capability/handlers to Overview. Do not remove task/deliverable data. |
| `src/components/shared/projects/project-workspace/project-overview-tab.tsx` | Move storage into metadata and implement timeline plus company-contribution section while retaining task/deliverable intelligence. |
| `src/components/shared/projects/project-tasks/task-create-dialog.tsx` and focused children | Add optional goal selector and select correct task-only versus extended atomic command path. Extract components/state to stay under file limit. |
| `src/lib/projects/schemas.ts` | Add bounded `milestone_ids` schema to bundled task-create input. Preserve current task/deliverable constraints. |
| `src/lib/projects/commands.ts` | Pass `p_milestone_ids` to generated RPC adapter and validate unchanged response DTO. |
| `src/lib/projects/task-actions.ts` | Route selected-goal create requests through extended bundled action without weakening existing task-authority validation. |
| Operator task-detail query/component | Add a narrow operator-safe linked-goal context projection and renderer, if no existing role-safe task DTO can carry it. No manager data reuse. |
| `messages/en-US.json` | Add all actual milestone/goal, scope, progress, untracked, dialog, task selector, calendar, overview, and storage metadata copy. |
| `messages/es-MX.json` | Add exact matching keys; use `Meta`/`Metas`, never `Hito`/`Hitos`, for all user-facing milestone terminology. |
| Existing focused calendar/project/workspace/task tests | Extend only tests that own changed behavior. |

## 9. Localization, accessibility, and responsive requirements

1. No new user-visible hard-coded English/Spanish strings. No raw scope/status/UUID/database-error values.
2. English uses `Milestone`; Spanish uses `Meta`. Do a repository search for user-facing calendar/milestone translation keys and replace legacy Spanish `Hito` references used by this feature.
3. Use `date` inputs and locale-aware date rendering. Do not reconstruct dates through client-local time parsing that can shift `target_date` by timezone.
4. Progress must be understandable without color: text count and percent accompany any bar. The untracked state has explicit text.
5. Progress regions use correct accessible labels/value semantics; do not expose `0 of 0` as a progressbar.
6. Multi-select task associations are keyboard operable, labelled, searchable, have removable selections with accessible names, and do not use color alone to identify project/scope.
7. Dialogs support labelled title/description, Escape, close action, focus restoration, loading, and safe generic failures.
8. Mobile forms are one column. Association controls, selected task lists, and overview timeline rows do not introduce document-level horizontal scroll.
9. All actionable cards/rows use real Button/Link semantics, visible focus, and at least 44px touch targets where appropriate.
10. Do not render duplicate desktop/mobile interactive forms simultaneously.

## 10. Required verification

### 10.1 Owner-controlled migration application

The Project Owner applies only the reviewed migration to **`jsf-pm-dev`** using Supabase MCP, then generates TypeScript declarations from the resulting remote schema and writes them unchanged to `src/lib/database.types.ts`.

Before implementation starts, verify through MCP/application evidence:

1. `milestones` and `milestone_tasks` exist with the defined constraints, indexes, RLS, and no direct authenticated table grants.
2. Existing active legacy calendar milestones migrated exactly once, retained expected metadata, copied valid legacy task association, and legacy rows are soft-deleted.
3. Project scope rejects a task from another project; company scope accepts active tasks across projects.
4. Deleted/cancelled task/project links fail.
5. `create_milestone`/`update_milestone` reject invalid role/scope/project/title/date/color/duplicate/over-limit payloads safely.
6. Company milestone with zero tasks is accepted and reads as `active_task_count = 0`.
7. Project/company summaries return correct active/completed counts and exclude soft-deleted tasks from denominator.
8. Calendar feed preserves deadline rows and returns first-class milestone rows only for Admin/PM.
9. Old calendar milestone RPCs are unavailable; no new legacy calendar event can be created through retired command APIs.
10. Extended `create_task_with_deliverables` rolls back task, deliverables, and milestone associations if any selected milestone relation is invalid.
11. Function grants are authenticated-only and all functions use the declared fixed search path.

### 10.2 Application checks

Run the actual current package scripts after implementation. At minimum:

```bash
npm run typecheck
npm run lint
npm run format:check
```

Run only focused tests owned by affected calendar, workspace, task-create, and operator task-detail modules. Do not add browser E2E, broad full-suite, coverage, build, provider, or deployment ceremony unless the Project Owner explicitly asks.

### 10.3 Focused test assertions

1. Spanish catalog resolves `Meta` terminology and English resolves `Milestone`; keys remain catalog-parallel.
2. Scope UI clears/validates incompatible project/task selections and never sends a project ID for Company scope.
3. Project scope selection displays only tasks from its selected project; Company scope supports grouped cross-project selection.
4. No-task milestone renders untracked copy and no fake 0% progressbar.
5. Progress math displays correct 0%, partial, and 100% states from supplied counts; blocked/review counts are secondary context only.
6. Detail renders safe values, grouped tasks, correct manager actions, generic unavailable state, Escape/close/focus behavior, and no raw error/UUID output.
7. Calendar activation opens first-class milestone detail without route/range mutation; every calendar view applies the same scope label/behavior.
8. Task creation presents only local/company eligible milestone options, preserves selections across deliverable drafts, and chooses the bundle command when any goal is selected.
9. Extended task command sends milestone IDs and retains entered state after safe failure.
10. Overview retains task/deliverable panels, relocates storage into metadata, shows local timeline plus separate company-contribution list, and links/actions correctly.
11. Operator task view exposes only linked-goal title/scope/date and never manager detail/task-list data.
12. Client surfaces do not acquire milestone rows, controls, or routes.

### 10.4 Manual authenticated journeys

1. **Project goal:** Admin creates a Project milestone with three tasks in one project; verify percentage changes when tasks are completed, calendar placement on target date, detail tasks, edit task replacement, and delete behavior.
2. **Company goal:** PM creates `Website update with Client XYZ testimony`, associates valid tasks from a client project and an internal project, verifies global progress and separate company-contribution presentation on each relevant project overview.
3. **Untracked goal:** Create a Company milestone with no tasks; verify accepted creation, calendar visibility to PM/Admin, no-task text, and later association through edit.
4. **Task create linkage:** Create a new task with a selected local milestone, then with a selected company milestone and optional deliverable draft; verify each association and atomic safe failure behavior for an invalid/stale selection.
5. **Scope conversion:** Convert a Company goal with cross-project tasks to Project scope; verify invalid selection is blocked. Remove incompatible work, convert successfully, and verify only same-project tasks remain selectable.
6. **Overview:** Verify task/deliverable counts remain, Storage & Links resides in Ficha técnica, local timeline remains readable on mobile/desktop, and company contributions are visibly distinct.
7. **Roles:** PM/Admin manage goals. PM watcher may access manager milestone controls but cannot bypass existing task-create authority. Operator sees only safe goal context on an assigned task. Client sees no goals.

## 11. Implementation order

1. Project Owner reviews this spec and the exact migration source.
2. Project Owner applies the migration to `jsf-pm-dev` through Supabase MCP and regenerates `src/lib/database.types.ts` unchanged.
3. Confirm the Section 10.1 database evidence before writing application code.
4. Update calendar types, strict normalizers, server-only queries, action schemas/actions, and revalidation paths against generated types.
5. Replace manager calendar create/edit/detail/list behavior and all calendar-view interactions consistently.
6. Extend the S09-04 bundled task command adapter/schema/action and task-create dialog goal selector.
7. Add manager project-summary loader data and Project Overview timeline/storage information architecture.
8. Add the narrow operator task-goal context projection/rendering.
9. Add catalog parity and focused tests.
10. Run Section 10 checks and record actual results separately from unexecuted manual journeys.

## 12. Stop conditions

Stop and return a decision request if any of the following is true:

- Applied generated types differ materially from the migration contract.
- Existing legacy calendar rows contain a condition that the migration cannot preserve safely.
- A required role-safe projection would expose operator/client data beyond this specification.
- The current project page guard makes every PM application role unavailable and resolving it requires a separate authorization-policy decision.
- The existing task-bundle RPC cannot be extended without changing S09-04 atomicity or task/deliverable workflow enforcement.
- The implementation appears to require milestones visible to Clients, weighted progress, manual completion, notifications, a project hierarchy, or any feature explicitly outside scope.

## 13. Definition of done

S09-06 is complete only when:

1. Milestones are first-class `project` or `company` goals, not mutable calendar events.
2. Existing active legacy milestones are preserved/migrated once and legacy mutation surface is retired.
3. Project goals support many local tasks; company goals support many cross-project tasks; zero-task goals remain valid and visibly untracked.
4. Progress is truthful, derived, accessible, and never manually contradictory to task status.
5. Admin/PM management, task creation linkage, manager calendar/detail, project Overview timeline, operator task context, and client exclusion each obey the stated authority boundary.
6. Storage & Links is compact metadata; task/deliverable overview intelligence is retained.
7. English/Spanish terminology is correct and user-visible Spanish uses `Meta`, not `Hito`.
8. Migration application, unchanged generated types, focused checks, and manual journeys have factual recorded evidence.
