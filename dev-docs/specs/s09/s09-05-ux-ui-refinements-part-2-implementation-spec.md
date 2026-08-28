---
document_id: S09-05-UX-UI-REFINEMENTS-PART-2-IMPLEMENTATION-SPEC-01
sprint_id: S09
work_item: S09-05
status: implementation-ready
created_at: 2026-08-27T00:00:00-06:00
branch: feature/ux-ui-refinements-pt-2
target_environment: jsf-pm-dev
required_applied_migrations:
  - supabase/migrations/20260823140000_s07_e09_calendar-role-safe-feed-and-milestones.sql
  - supabase/migrations/20260823144000_s07_e09_calendar-task-scoped-milestones-and-pm-authority.sql
  - supabase/migrations/20260827123000_s09-04-task-deliverable-bundle-and-workflow-integrity.sql
schema_change: none
---

# S09-05 — UX/UI Refinements, Part 2

## 1. Objective

Deliver one bounded refinement pass that makes the existing role-aware application operationally useful rather than decorative:

1. Replace the empty Admin/PM project-workspace Overview task and deliverable placeholders with truthful counts and status breakdowns.
2. Make every existing Archive copy action work in secure and non-secure browser clipboard contexts, with accurate localized feedback.
3. Replace the broken project-calendar milestone click route transition with an in-place, role-safe milestone detail experience.
4. Turn all protected Inicio dashboards into practical launch surfaces. PM and Operator are the primary corrections; Admin and Client receive the same coherent, role-safe quick-navigation and deadline-attention treatment without widening authority.
5. Add **My projects** to the Operator global desktop and mobile navigation, and make every role-safe Operator calendar event directly actionable.

This is an application/UI refinement. It reuses the current applied calendar RPCs, current generated database types, existing protected routes, existing role/RLS boundaries, existing task and deliverable detail routes, and existing i18n architecture.

## 2. Authority and inspected baseline

Precedence is:

1. Direct Project Owner instruction.
2. This specification.
3. S09-04 where task/deliverable workflow terminology or generated schema is relevant.
4. S09-01 where the existing mobile quick-access model is relevant.
5. `AGENTS.md`, `GEMINI.md`, and existing role-safe route/RLS contracts.

### 2.1 Inspected facts

- `ProjectWorkspaceShell` already receives `initialTasks` and `initialDeliverables`, but passes neither to `ProjectOverviewTab`. The Overview renders literal em-dash placeholders for tasks and deliverables. It also disables Deliverables on an internal project even though S09-04 permits production deliverables on internal projects.
- The existing workspace tab model is `overview`, `tasks`, `deliverables`, `members`, `activity`, `calendar`, and `archive`. It supports selecting a tab through the existing `tab` query parameter.
- `ExternalLinkButton` is shared by Admin, PM, Client, Operator, and project-scoped archive callers. It only calls `navigator.clipboard.writeText`, which fails when the Clipboard API is unavailable or denied. The Overview project-ID button has the same unsupported unhandled direct call.
- Applied calendar function `list_role_safe_calendar_events` returns only the feed DTO: `entity_id`, `project_id`, `project_name`, `task_id`, title/type/date fields, and color. It deliberately omits milestone descriptions.
- Applied `get_calendar_milestone_for_edit(p_event_id)` returns the authorized PM/Admin milestone detail including description. It is already exposed through the server-only query/action boundary. No table read or new RPC is necessary.
- `EventBadge` and `CalendarListView` currently route a milestone title to the containing project, rather than opening milestone data. In the workspace that causes a navigation back into the same `?tab=calendar` route; the tab’s loading fallback then becomes visible while the RSC transition is unresolved.
- The calendar feed already returns Operator-assigned task deadlines and Operator-assigned production-deliverable client-delivery deadlines with a safe `task_id`. Operators intentionally receive no project identifier/link. The current UI explicitly makes Operator events inert. The existing operator task route is `/operador/tareas/[task-id]`.
- Operator already has protected routes `/operador/proyectos` and `/operador/proyectos/[project-id]`; the former is linked only from Agenda. The authorized global navigation model omits this route entirely.
- The PM home loader currently returns only five member-scoped projects; the Operator home loader returns five agenda rows; Admin and Client return project lists. PM/Operator shell cards are plain `<div>` elements and are not actionable. Client already has useful quick links and linked project cards.

### 2.2 Schema determination

**No new migration is required or permitted for S09-05.**

All required data is already present in applied schema/contracts:

- `tasks.status`, `tasks.deadline_at`, `tasks.project_id`, and `tasks.assignee_id`;
- `deliverables.status`, `workflow_type`, three deadline columns, `task_id`, `project_id`, and `assignee_id`;
- applied role-safe calendar feed and milestone-detail RPCs;
- existing project, task, deliverable, Operator Agenda, and operator-project routes.

Do not create a migration, RPC, view, enum, index, policy, generated type edit, or Supabase type regeneration for this item. Do not query `calendar_events` directly in browser/server application code.

## 3. Strict scope boundaries

### In scope

- Project Overview counts and status breakdowns for Admin/PM project workspaces.
- Resilient clipboard copying for the two current product copy surfaces.
- Calendar event interaction semantics and a reusable read-only milestone-detail dialog.
- Home/Inicio data shaping and UI for Admin, PM, Operator, and Client.
- Operator global-navigation inclusion of the pre-existing My projects route.
- Focused localization and focused tests for the changed public behavior.

### Explicitly out of scope

- New database migrations, RLS/policy/grant changes, new RPCs, direct calendar table reads, generated type changes, metrics changes, notification changes, or provider activation.
- New top-level task/deliverable routes for PM or Admin. Existing project workspace deep links are the canonical route targets.
- A project workspace, general project browsing, or project ID exposure for Operators beyond the already-authorized `/operador/proyectos` own-work projection.
- Changing task/deliverable statuses, assignments, deadlines, review workflow, S09-04 creation behavior, milestone create/edit/delete authorization, or client portal authority.
- Browser E2E, visual snapshot, broad full-suite, coverage, build, or `npm run verify` requirements.
- Any broad dashboard redesign, personalization/persistence, new role, or capacity change.

## 4. Role and route matrix

| Surface | Admin | PM | Operator | Client |
| --- | --- | --- | --- | --- |
| Workspace Overview counts | Full current workspace data | Full current workspace data | N/A: no Admin/PM workspace route | N/A: client project detail remains separate |
| Milestone detail | Open read-only detail; edit/delete only per existing manager capability | Open read-only detail; edit/delete only when existing capability allows | Task-scoped milestone opens assigned task detail; no milestone detail data | Existing project link behavior; no milestone detail |
| Task deadline calendar event | Open current project workspace Tasks tab | Open current project workspace Tasks tab | Open `/operador/tareas/[task-id]` | Preserve existing client project link behavior |
| Deliverable deadline calendar event | Open current project workspace Deliverables tab | Open current project workspace Deliverables tab | Open parent `/operador/tareas/[task-id]` | Preserve existing client project link behavior |
| Project deadline calendar event | Open current project Overview | Open current project Overview | Never exposed by feed | Preserve existing client project link behavior |
| Operator navigation | N/A | N/A | Home, My agenda, **My projects**, Calendar, Archive, Notifications (plus existing mobile quick actions/menu behavior) | N/A |

Never construct a role route from untrusted browser data. The event DTO supplies only the entity/task/project IDs already released by the role-safe feed. The role-aware, closed route mapping is owned by one shared pure calendar-navigation helper.

## 5. Project workspace Overview contract

### 5.1 Data ownership

1. Extend `ProjectOverviewTabProps` with `tasks: readonly TaskWithAssignee[]` and `deliverables: readonly DeliverableListItem[]`.
2. Pass `initialTasks` and `initialDeliverables` directly from `ProjectWorkspaceShell`; do not refetch, call a browser Supabase client, or add a separate endpoint.
3. Treat input arrays as the current server-authorized workspace snapshot. The Overview must never infer hidden records, authorize a user, or read raw database tables.

### 5.2 Definitions

- **Active task:** a non-deleted task currently provided to the workspace whose `status` is not `completed`. `blocked` is active and must be counted.
- **Task status breakdown:** exactly the statuses actually represented in the current supplied task snapshot. Display canonical task status order: `pending`, `in_progress`, `in_review`, `blocked`, `completed`. Omit zero-count entries.
- **Deliverable total:** every supplied current deliverable, regardless of project type or workflow.
- **Deliverable status breakdown:** exact current supplied counts, displayed in canonical deliverable status order: `pending`, `submitted`, `awaiting_internal_review`, `changes_requested`, `approved`, `delivered`. Omit zero-count entries. Do not invent a status from a workflow type.
- A zero total is valid and must render as `0`, not a placeholder, N/A, or an empty breakdown.

### 5.3 Visual and interaction contract

Replace the current two “Quick Stats” panels as follows.

#### Active tasks panel

- Heading remains the existing localized tasks label.
- Primary metric is the localized active-task count, e.g. `8 active` / `8 activas`; it is not a total-task label.
- Below it, render concise localized status chips/text such as `Pending 2 · In progress 3 · Blocked 1`; preserve canonical order and omit zeroes.
- Add a separate muted localized completed count only when completed tasks exist, e.g. `Completed: 4`. Do not mix completed work into the primary active count.
- The entire panel is a semantic locale-aware `Link` to the existing project route with `tab=tasks`, preserving any necessary stable workspace query state through the existing router path construction. It is keyboard reachable, has a localized accessible name that includes the active count, and is not a clickable `<div>`.

#### Deliverables panel

- Heading remains the existing localized deliverables label.
- Primary metric is the total deliverable count.
- Below it, render the current status breakdown as above.
- The whole panel is always a semantic locale-aware `Link` to the current project route with `tab=deliverables`, for both client and internal projects. Remove the client-project-only gate and `N/A` state.
- If count is zero, show `0` with a concise localized no-deliverables detail, while preserving the link: the Deliverables tab is still the authoritative destination for creation/empty-state work.

Both panels retain a visible localized “View” affordance only if it is also localized; do not retain the hard-coded Spanish `Ver`. Use a consistent card-link focus ring, hover state, non-color interaction cue, and at least 44px interactive target. Do not nest a button/link inside the card link.

### 5.4 No regressions

- Preserve Overview description, client scope, storage, metadata, team, edit, and completion-cycle behavior.
- Preserve workspace tab state ownership in `ProjectWorkspaceShell`; Overview only requests an existing selected tab through a link/query, not an independent local state mutation.
- Do not change which roles may enter Admin/PM workspaces or see workspace data.

## 6. Clipboard reliability contract

### 6.1 Shared utility

Create one browser-only utility under the existing application utility/component conventions, for example `src/lib/clipboard.ts`, with a single `copyTextToClipboard(text: string): Promise<boolean>` contract.

Required algorithm:

1. Return `false` for an empty string; never claim success.
2. If `navigator.clipboard?.writeText` exists, await it. If it resolves, return `true`.
3. If it is absent or rejects, attempt the legacy fallback inside the same user-gesture handler:
   - create a temporary off-screen `<textarea>` with the exact text;
   - set `readonly`, append to `document.body`, select it;
   - call `document.execCommand("copy")` only when it exists;
   - always remove the textarea in `finally` and restore the prior selection/focus when safely available;
   - return the boolean copy result.
4. Catch all browser exceptions and return `false`. Do not throw, log the URL/text, use a server action, make a network call, or include any clipboard permission prompt logic.
5. The helper is client-only by runtime usage; it must not access `window`, `document`, or `navigator` at module evaluation time, so server imports remain safe if accidental.

### 6.2 Consumers

Update only the two existing copy feature surfaces:

1. `ExternalLinkButton` for both `submission` and `drive` variants in every Archive caller and breakpoint.
2. `ProjectOverviewTab` project-ID copy button.

Each caller must await the shared helper and update UI state only from its returned boolean:

- success: checked icon/state and existing localized success live announcement;
- failure: normal copy icon remains and a localized error live announcement is rendered;
- the control remains enabled after a failure for retry;
- do not show a success check mark before a copy actually succeeds;
- clear the success state after the current bounded timeout and clean up the timeout on unmount.

Replace hard-coded `aria-label="Copy project ID"` with a catalog key. Add exact en-US/es-MX copy labels, copied message, unavailable message, and project-ID wording. Do not expose clipboard API errors to the user.

## 7. Calendar interaction and milestone detail

### 7.1 Event target resolver

Create one narrowly scoped, pure `resolveCalendarEventDestination(event, role)` helper next to calendar types/queries. It returns one closed discriminated result:

```ts
type CalendarEventDestination =
  | { kind: "milestone-detail"; eventId: string }
  | { kind: "project-overview" | "project-tasks" | "project-deliverables"; href: string }
  | { kind: "operator-task"; href: string }
  | { kind: "none" };
```

Mapping:

| Event | Admin/PM | Operator | Client |
| --- | --- | --- | --- |
| `milestone` | `milestone-detail` | `operator-task` only if non-null `task_id`; otherwise `none` | Existing project-overview link only when safe `project_id` exists; otherwise `none` |
| `project_deadline` | project Overview | `none` | existing client project Overview only when safe project ID exists |
| `task_deadline` | project Tasks | operator task from non-null `task_id` | existing client project Overview only when safe project ID exists |
| `internal_review_deadline` | project Deliverables | `none` (the feed must not expose it) | `none` |
| `client_delivery_deadline` | project Deliverables | operator task from non-null `task_id` | existing client project Overview only when safe project ID exists |

For Admin and PM, a non-milestone target requires non-null `project_id`; otherwise return `none`. For Operator, a task/deliverable target requires non-null `task_id`; otherwise return `none`. Never fallback to a general project, arbitrary URL, or an entity ID route.

### 7.2 Click behavior across every view

Refactor `EventBadge`, `CalendarListView`, and their common `CalendarViewProps` to consume the resolved destination and one `onOpenMilestoneDetail(eventId)` callback supplied by `CalendarCoordinator`.

- Month, week, agenda, and list views must all produce the same destination for the same event.
- A clickable title/card must be a locale-aware `Link` for route destinations and a real `Button` for milestone detail. Do not attach click handlers to inert `<div>`/`<tr>` containers.
- A `none` destination stays presentational text with no pointer cursor, no fake link, and no edit/detail promise.
- Preserve manager milestone edit/delete controls. Their clicks must not trigger a parent target action.
- Event labels expose a localized target-specific accessible name: `Open task: {title}`, `Open deliverables: {title}`, `View milestone details: {title}`, etc.
- Existing Calendar List row actions remain milestone edit/delete only. The title is the event destination; it must not be omitted from keyboard navigation.

### 7.3 Milestone detail dialog

Add a read-only `MilestoneDetailDialog` in the existing calendar component directory. It is controlled by `CalendarCoordinator`, never by a route transition.

State ownership:

```ts
{ isOpen: boolean; eventId?: string; isLoading: boolean; detail?: CalendarMilestoneEditDetailDto; error?: "unavailable" | null }
```

Required flow for Admin/PM:

1. User activates a milestone title/card.
2. Coordinator opens the dialog immediately in a loading state and calls the existing `getCalendarMilestoneForEditAction({ eventId })` once.
3. Success renders exactly the returned safe fields: title, project name, optional task title when the returned `task_id` matches an existing supplied target, start date/time, optional end date/time, all-day state, optional description, and visual color token. Do not render the raw UUID, audit fields, creator, database error, or arbitrary markup.
4. Failure renders a generic localized unavailable state, retains a Close button, and does not navigate or leak whether the milestone was deleted versus unauthorized.
5. Dialog close clears transient detail/error/loading state. Escape and close button work. Focus returns to the initiating event button.
6. Manager users retain existing Edit and Delete actions in their existing positions. If detail is open, an Edit action may close detail and open the existing edit dialog for the same event ID. Do not duplicate milestone mutation implementation.

The dialog is read-only for all PM users, including `pm_watcher`; existing `canManageMilestones` remains the sole edit/delete/create control. The existing server action/RPC provides the role-safe data boundary. No direct table query and no client authorization check is allowed.

### 7.4 Workspace calendar loading defect

`ProjectCalendarTab` must not navigate on a milestone activation. Its existing range navigation remains the only operation that calls `router.push` with `calendarView`, `calendarFrom`, and `calendarTo`.

After implementation, clicking a milestone in `/admin/proyectos/[id]?tab=calendar...` or `/pm/proyectos/[id]?tab=calendar...` leaves pathname and calendar range query unchanged, opens detail, and cannot cause the workspace calendar fallback spinner. This is a regression criterion, not a separate route feature.

## 8. Inicio dashboard contract

### 8.1 Shared principles

- Home remains server-rendered and role-authorized. Data loaders remain `server-only`, use the session-bound Supabase client under RLS, and return narrow serializable presentation DTOs.
- Do not hide a fetch failure as a statistic of zero. A loader may return an empty valid collection, but an unavailable optional section must render a localized non-leaking unavailable state—not fabricated counts.
- Sort deadline-bearing work with past deadlines first, then future deadlines ascending, then null deadlines last. Use stored timestamps, not client-local strings, for ordering.
- A dashboard shows at most five direct work/project cards per section. A section-level View all link goes to the pre-existing canonical route.
- Every visible card that promises navigation is a semantic `Link`, not a clickable `<div>`. Never nest links.
- Dates use the current locale formatter; no `toLocaleDateString()` without current locale/options in a server component.
- Status, priority, urgency, count, and deadline labels must be localized. Do not retain hard-coded `Lead`, `Ver`, or Spanish/English status text.

### 8.2 PM Inicio (`/pm`)

Replace the passive project-only surface with:

1. **Quick access**: exactly three role-safe cards:
   - My projects → `/pm/proyectos`
   - Calendar → `/calendario`
   - Metrics → `/pm/metricas`
   Each has an existing/verified Lucide icon, localized title/description, visible directional affordance, focus/hover state, and no new authorization logic.
2. **Deadline attention**: up to five current PM-authorized work items across tasks and deliverables, ordered by the shared deadline rule. Each row declares item kind, title, project name, status, relevant deadline label, and urgency (overdue/due soon/upcoming only when calculable from current timestamp). Task links target `/pm/proyectos/[projectId]?tab=tasks`; deliverable links target the same workspace with `tab=deliverables`.
3. **My projects**: retain no more than five current PM-authorized projects, now sorted by deadline rule rather than created date. Each full project card links to `/pm/proyectos/[id]`, includes current status and formatted deadline, and displays the existing membership-capacity chip as informational metadata only. It must not make PM capacity an authority test.
4. Empty work state: localized explanation plus link to My projects. Empty projects state remains localized.

Do not add an unscoped PM global query that bypasses project access. The PM loader obtains only rows already visible to the current session, preserves existing RLS/server authority, and emits a deep link only when it has the matching role-safe project ID.

### 8.3 Operator Inicio (`/operador`)

Replace the passive Agenda-row display with:

1. **Quick access**: My agenda → `/operador/agenda`; My projects → `/operador/proyectos`; Calendar → `/calendario`.
2. **Deadline attention / assigned work**: use the existing own-work agenda projection. Show at most five unique tasks in current urgency/deadline order; each card links to `/operador/tareas/[taskId]`. Preserve status, priority, project display name, and deadline. Do not expose project IDs or create a generic project link from the home card.
3. **Assigned projects**: show up to five existing `getOperatorOwnWorkProjects` DTOs—or a loader-shaped equivalent from the same role-safe source—sorted by nearest assigned-work deadline. Each links to `/operador/proyectos/[projectId]`, shows own-task count, nearest deadline, and current urgency chips.
4. Empty states link only to the appropriate existing Operator route and do not imply data access beyond own assigned work.

### 8.4 Admin Inicio (`/admin`)

Keep current global Admin scope and add operational navigation without creating a metrics duplicate:

1. Quick access cards: Projects → `/admin/proyectos`; Calendar → `/calendario`; Operations → `/admin/operaciones`.
2. Recent projects: preserve maximum five current visible projects but sort deadline attention first, then deadline ascending; each card links to `/admin/proyectos/[id]`.
3. Do not add a separate Admin task/deliverable deadline-attention section in this pass. Admin receives direct Projects, Calendar, and Operations access; project-level work remains in the existing workspace. This avoids introducing a broad new global data query outside the user-reported defect scope.

### 8.5 Client Inicio (`/cliente`)

Preserve the existing three quick cards, project cards, client task/review routes, client access rules, and project links. Improve only consistency:

- Sort supplied client projects by deadline attention (overdue then nearest upcoming; null last).
- Add deadline status text to each current project card when a deadline exists.
- Do not add Internal Review, deliverable production, PM, Admin, or Operator destinations.
- Do not expand client data/query shape beyond current `client_project_view` fields unless an existing safe client projection already provides it.

## 9. Operator navigation and calendar actionability

### 9.1 Global navigation model

Extend `AppNavigationItemKey` with `operatorProjects` and add it only for role `operator` in `buildNavigationModel`:

```ts
{ key: "operatorProjects", href: "/operador/proyectos", ... }
```

Requirements:

- Use one existing/new localized `shell.links.myProjects` label, with English/Spanish parity. Do not call this general `Projects` if it would imply authority beyond assigned work.
- Add an installed verified Lucide `FolderKanban` mapping in both desktop and mobile icon maps.
- The item appears in the desktop drawer and complete mobile menu. It is an authorized item from the server model, never synthesized by a client component.
- Preserve existing Operator five-action mobile quick bar exactly unless S09-01 has an accepted successor changing it. My projects is accessible in the full mobile menu; do not turn it into a sixth quick action.
- Update exact role-model tests: Admin, PM, and Client never receive `operatorProjects`; Operator receives it once in the full ordered model between My agenda and Calendar.

### 9.2 Operator calendar events

- All current Operator feed items with a safe `task_id` become a link to `/operador/tareas/[taskId]` in month, week, agenda, and list views.
- This includes task deadlines, assigned production-deliverable client-delivery deadlines, and task-scoped milestones. A deliverable calendar deadline deliberately opens its parent task detail because the existing Operator task detail owns the related deliverable cards and there is no standalone Operator deliverable route.
- Project-deadline events, internal-review events, project-scoped milestones, client-submission events, and any DTO without task ID remain non-interactive or absent as dictated by the existing role-safe feed; do not invent an Operator project route from a calendar DTO.
- The event’s visual title remains unchanged; add a localized accessible name that identifies opening the assigned task.

## 10. Exact file inventory

Required targets, subject to small responsibility-preserving extraction:

| File | Required change |
| --- | --- |
| `src/components/shared/projects/project-workspace/project-workspace-shell.tsx` | Pass initial task/deliverable snapshots to Overview; preserve tab ownership. |
| `src/components/shared/projects/project-workspace/project-overview-tab.tsx` | Render truthful counts/breakdowns and semantic tab links; replace direct clipboard call. |
| `src/lib/clipboard.ts` | New safe browser clipboard helper with API + fallback contract. |
| `src/components/shared/archive/external-link-button.tsx` | Consume clipboard helper and truthful live feedback/timeout cleanup. |
| `src/lib/calendar/types.ts` or narrowly adjacent helper module | Add closed calendar destination type/resolver; no raw table data. |
| `src/app/[locale]/(protected)/calendario/_components/types.ts` | Add open-detail callback/state types as needed. |
| `src/app/[locale]/(protected)/calendario/_components/calendar-coordinator.tsx` | Own milestone-detail state, request existing action, pass event behavior, preserve range handling. |
| `src/app/[locale]/(protected)/calendario/_components/milestone-detail-dialog.tsx` | New controlled read-only dialog. |
| `src/app/[locale]/(protected)/calendario/_components/event-badge.tsx` | Render route/drawer interaction from resolved target; preserve mutation actions. |
| `src/app/[locale]/(protected)/calendario/_components/views/calendar-list-view.tsx` | Make title event destination reachable; preserve only milestone actions in Actions cell. |
| `src/app/[locale]/(protected)/calendario/_components/views/calendar-month-view.tsx` | Pass unified destination callbacks. |
| `src/app/[locale]/(protected)/calendario/_components/views/calendar-week-view.tsx` | Pass unified destination callbacks. |
| `src/app/[locale]/(protected)/calendario/_components/views/calendar-agenda-view.tsx` | Pass unified destination callbacks. |
| `src/components/shared/app-nav/navigation-model.ts` | Add Operator-only My projects server navigation item. |
| `src/components/shared/app-nav/_components/desktop-nav-drawer.tsx` | Add icon mapping only. |
| `src/components/shared/app-nav/_components/mobile-nav-toggle.tsx` | Add icon mapping only if its current map is independent; do not alter quick-bar matrix. |
| `src/lib/shell-data/shell-queries.ts` | Extend only narrow role-safe home DTO/loaders necessary for this spec. |
| `src/app/[locale]/(protected)/pm/_components/pm-shell.tsx` | PM quick access, deadline attention, linked sorted projects. |
| `src/app/[locale]/(protected)/operador/_components/operator-shell.tsx` | Operator quick access, linked work, assigned projects. |
| `src/app/[locale]/(protected)/admin/_components/admin-shell.tsx` | Admin quick access and linked deadline-ordered projects; no new global work-attention query. |
| `src/app/[locale]/(protected)/cliente/_components/client-shell.tsx` | Preserve current feature set; deadline-order and localized deadline text only. |
| `messages/en-US.json` | All actual new messages. |
| `messages/es-MX.json` | Exact matching message keys and Spanish translations. |
| Existing focused calendar/workspace/navigation/home/clipboard tests | Extend only the current owning tests. |

Do not modify migrations, `src/lib/database.types.ts`, package manifests, project auth/RLS code, route pages except where a typed loader prop genuinely requires it, or CHANGELOG for this spec-only implementation item.

## 11. Accessibility, localization, and responsive requirements

- All interactive summary/dashboard/event cards use native Link/Button semantics and visible focus states.
- Do not use color alone for urgency, current status, copied state, or event type.
- Controls have explicit localized accessible names; status breakdown text is readable without icon/color interpretation.
- Dialog has a labelled title, description/value semantics, keyboard close, Escape, focus restoration, and no nested interactive controls.
- Calendar grids retain local overflow behavior. Do not create document horizontal overflow or force all events into inaccessible tiny touch targets.
- All new card/link and event-button targets meet the existing 44px minimum where the design calls for an action control; text links inside desktop tables retain their semantic focus/tap usability.
- Maintain English/Spanish catalog parity. No new user-facing hard-coded strings, raw enum labels, raw errors, or raw IDs.

## 12. Focused verification

Run only:

```text
npm test -- __tests__/projects/project-workspace-calendar.test.tsx
npm test -- __tests__/app-shell/navigation.test.ts
npm test -- src/lib/calendar/__tests__/queries.test.ts src/lib/calendar/__tests__/actions.test.ts
npm run typecheck
npm run lint
npm run format:check
```

Add/extend focused assertions for:

1. Overview receives snapshots, reports active tasks separately from completed tasks, shows status breakdowns, reports zero truthfully, and links to the correct tasks/deliverables tabs for internal and client projects.
2. Clipboard helper succeeds through Clipboard API, falls back after missing/rejected API, returns false after both mechanisms fail, and consumers announce only truthful outcome.
3. Archive submission and drive controls share identical copy behavior in desktop/mobile render paths; project-ID control consumes the same helper.
4. Admin/PM milestone activation opens detail without calling route push; task/deliverable event target mapping selects correct workspace tab.
5. Milestone detail safe success, generic failure, close/Escape, and PM-watcher read-only behavior.
6. Operator event mapping opens only the assigned task with a non-null task ID; it never produces a project link or a guessed deliverable route.
7. Navigation model contains `operatorProjects` only for Operator, in the required position; mobile five-action quick bar remains exactly five and unchanged.
8. PM and Operator home links target only the approved existing routes; project/task/deliverable cards have real hrefs and deadline ordering is deterministic.
9. Client quick links and project routes remain present and client-safe.
10. English/Spanish message keys used by changed components resolve in both catalogs.

### Manual journeys

1. **Admin workspace Overview:** open a project with mixed task/deliverable statuses, verify totals/breakdowns, Tasks/Deliverables targets, and an internal project with deliverables.
2. **Clipboard:** in a normal secure context and a context where `navigator.clipboard` is unavailable/denied, copy Archive submission URL, Archive drive URL, and Overview project ID; verify accurate icon/live feedback and pasted value.
3. **PM milestone:** open project Calendar, activate a milestone in month, week, agenda, and list; confirm in-place detail, no route/query change, no persistent loading state, proper close, and existing edit/delete capability unchanged.
4. **PM/Operator Inicio:** open every quick action, a deadline-attention item, and each project card; verify route, labels, and deadline order.
5. **Operator navigation/calendar:** confirm My projects in desktop drawer and full mobile menu; use task and deliverable deadline events to open assigned task details; confirm no project link is exposed.
6. **Client regression:** confirm existing quick links/project links remain correct and no internal content is exposed.

## 13. Implementation sequence

1. Confirm working tree remains on `feature/ux-ui-refinements-pt-2`; preserve unrelated work.
2. Implement pure data transformations and the shared clipboard helper first, with focused unit coverage.
3. Wire Overview snapshot props/count cards and archive/project-ID clipboard consumers.
4. Implement calendar destination resolver, detail dialog, coordinator ownership, then update all four views consistently.
5. Extend the server-authorized navigation model for Operator My projects; then update only icon maps and focused navigation tests.
6. Extend narrow server-only home DTOs/loaders, then PM/Operator/Admin/Client shells. Keep files below 400 lines by extracting role-local presentational components rather than creating a generic authority layer.
7. Add locale parity and run only Section 12 verification.

## 14. Stop conditions

Stop and return a decision request if any condition is true:

- Existing applied generated types/RPC contracts materially differ from the baseline above.
- The needed PM/Admin home work data cannot be obtained through a narrow existing RLS-safe query without a schema/RLS/API change.
- A calendar event requires a route not named in this spec or has missing safe route identifiers.
- Reusing the existing milestone-detail action exposes raw unauthorized/not-found distinctions or data outside the stated read-only fields.
- The planned responsive composition leaves duplicate interactive event targets or changes S09-01’s exact mobile five-action bar.
- The change appears to require a migration, new RPC, direct `calendar_events` query, generated types, a new role/capacity rule, provider change, or a broad home/dashboard redesign.

## 15. Definition of done

S09-05 is complete only when:

1. Admin/PM Overview task and deliverable cards show truthful current data and status breakdowns, link to their workspace tabs, and never show placeholders/N/A due to project type.
2. Every current Archive and project-ID copy button uses one resilient helper and reports actual success/failure safely.
3. PM/Admin milestone activation opens a read-only in-place detail dialog without changing calendar route/range or leaving the workspace calendar loading.
4. PM and Operator Inicio surfaces contain role-safe quick navigation, linked direct work/project cards, and deadline attention; Admin and Client remain functional and role-safe.
5. Operator has a persistent authorized My projects global navigation entry on desktop and complete mobile navigation.
6. Operator calendar items for assigned tasks/deliverables are actionable only through the existing task detail route, while unauthorized project/detail data remains unavailable.
7. No migration/type generation/schema/RLS/API/provider scope is introduced.
8. Section 12 focused checks and the manual journeys actually executed are reported factually; unexecuted manual journeys remain explicitly unverified.
