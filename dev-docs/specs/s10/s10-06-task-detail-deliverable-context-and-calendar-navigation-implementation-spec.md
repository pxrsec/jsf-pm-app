---
document_id: S10-06-TASK-DETAIL-DELIVERABLE-CONTEXT-CALENDAR-NAVIGATION-IMPLEMENTATION-SPEC-01
sprint_id: S10
work_item_id: S10-06
status: implementation-ready-no-migration-required
created_at: 2026-09-02T00:00:00-06:00
target_environment: jsf-pm-dev
schema_baseline: 20260902190000_s10-04-directory-keyset-cursor-post-repair.sql
migration_decision: no-new-migration-required
---

# S10-06 — Task Detail, Deliverable Context, and Calendar Navigation

## 1. Authority, result, and implementation boundary

This is the complete implementation authority for **S10-06 only**. It replaces the S10 planning-level statement with an executable contract for:

1. a route-addressable Admin/PM task-detail experience;
2. task-centred, role-safe associated-deliverable context;
3. explicit navigation from task and deliverable calendar events to the correct task detail or workspace context;
4. correction of the project-workspace calendar tab’s URL/state divergence; and
5. use of the existing immutable deliverable-version workflow when a link must be replaced.

This specification is based on the applied `jsf-pm-dev` schema through `20260902190000_s10-04-directory-keyset-cursor-post-repair.sql`, the current repository implementation, and read-only inspection of the live `jsf-pm-dev` catalog. No schema object, RLS policy, RPC signature, generated declaration, provider, or infrastructure configuration is changed by S10-06.

### 1.1 Explicit non-goals

S10-06 must not:

- create, apply, edit, or regenerate a database migration or `src/lib/database.types.ts`;
- change role authority, project-membership semantics, client-contact authority, task/deliverable workflows, archive/restore/permanent-deletion behavior, notification delivery, provider configuration, or production environment state;
- grant a Client or Operator any task, deliverable, version, feedback, project, or calendar visibility beyond the current role-safe surfaces;
- create browser-side direct access to privileged tables or service-role access;
- mutate `deliverable_versions.submission_url`, delete a version, or reinterpret an existing historic URL;
- introduce arbitrary return URLs, calendar deep-link query state unrelated to the target, broad navigation refactors, new global dashboard work, public routes, or legal work;
- add broad test suites, E2E work, coverage work, or a build/full-suite requirement. The owner has already verified the preceding implementation; S10-06 implementation uses only focused checks stated in Section 13.

### 1.2 Definition of complete

S10-06 is complete only when an authorized Admin or PM can open a stable, locale-preserving task-detail route from a manager calendar task/deadline event and from a milestone’s associated-task row; the detail shows that task’s real active deliverables and safe current-version context; all role-specific task routes remain scoped; the project-calendar tab has one normalized server-derived range and synchronized client URL state; and every replacement-link journey creates a new immutable version through an existing trusted command.

## 2. Evidence-backed migration decision

### 2.1 Decision

**No migration is required. Do not author or apply M05. Do not regenerate database types for S10-06.**

The originally conditional M05 in the S10 plan was only justified if the applied schema could not safely provide a manager task-detail shape. The live contract already provides the required capability without a new public database surface.

### 2.2 Why no manager projection is necessary

The live database contract establishes all of the following:

| Required S10-06 capability | Applied contract that already provides it | Consequence |
| --- | --- | --- |
| Admin/PM task retrieval | `public.tasks` SELECT RLS admits active Admin/PM through `private.is_pm()`, while excluding deleted/archived task and parent-project rows. | A server-only manager adapter may retrieve one active task by ID, scoped by active parent project. |
| Admin/PM deliverable retrieval | `public.deliverables` SELECT RLS admits active Admin/PM, excludes deleted/archived deliverables and inactive task/project ancestry. | The adapter may return only deliverables whose `task_id` equals the selected task. |
| Version evidence | `public.deliverable_versions` SELECT RLS allows active Admin or PM for a live associated deliverable. | The existing `getDeliverableDetail()` / version-query pattern can expose ordered immutable versions and the current version without an RPC. |
| Feedback context | Existing manager deliverable detail already reads feedback through RLS. | Reuse the existing focused deliverable-detail loader/component rather than exposing raw feedback in a new task DTO unless it is actually rendered. |
| Operator detail | `public.operator_agenda_view` plus `getOperatorTaskDetail()` is security-invoker/scoped to the assignee and returns active-task resources, associated deliverable metadata, and operator-safe milestone context. | Preserve it unchanged; it is already an appropriate role-safe detail contract. |
| Client request detail | `client_task_view`, `client_submission_view`, and `getClientRequestDetail()` expose only a direct Client’s request and directly assigned client-submission deliverables. | Preserve it unchanged; it is already a purpose-limited Client contract. |
| Calendar IDs | `list_role_safe_calendar_events()` returns `task_id`, `project_id`, event type, and only role-authorized rows. | Navigation can be a closed application mapping; no database change is needed. |
| Milestone task IDs | `list_milestone_tasks()` returns active task and project IDs only to Admin/PM. | Milestone associated-task links can target the manager task route directly. |
| Immutable replacement | `submit_deliverable_version()` inserts a new version; `submit_client_deliverable()` inserts a new version after the Manager/Admin reopens the client submission using `reopen_client_deliverable()`. | Link replacement must use these commands and never update a historic version URL. |

The required work is therefore application composition, server-only adapter shaping, route addition, closed navigation mapping, URL synchronization, localized UI, and focused validation—not schema evolution.

### 2.3 Current migration sequence

The repository and live `jsf-pm-dev` both end with:

`20260902190000_s10-04-directory-keyset-cursor-post-repair.sql`

No `20260902..._s10-06-...sql` file is authorized or needed. If a later, separately accepted change genuinely requires a new public SQL contract, it must sort after that exact terminal migration and be a new reviewed forward migration. That condition is not met by this specification.

## 3. Security and role model

### 3.1 Authority source

- `profiles.role` is the application-authority source.
- Active `admin` and active `pm` are global manager roles. They are not restricted by `pm_lead` or `pm_watcher` membership capacity for read access to active manager workspaces.
- `pm_lead` and `pm_watcher` remain workspace metadata and action-level UI state; they do not weaken the global Admin/PM read boundary.
- Every route and Server Action still calls the existing session/role guard. Route visibility is not authorization.

### 3.2 Closed role × task-detail matrix

| Role | Canonical task detail | Allowed data | Forbidden behavior |
| --- | --- | --- | --- |
| Admin | `/admin/tareas/[task-id]` | One active task, its active parent project identity, manager-safe assignee summary, task resources, task-associated active deliverables, existing version/history/feedback data only where the existing manager deliverable contract permits it. | No archived/deleted/missing task disclosure; no client/operator-only route reuse; no arbitrary profile/contact directory expansion. |
| PM | `/pm/tareas/[task-id]` | Same global active-manager read scope and data contract as Admin. UI action affordances remain governed by existing lead/watcher rules and trusted commands. | Do not convert global PM task read authority into membership gating. Do not expose archive-only records. |
| Operator | Existing `/operador/tareas/[task-id]` | Own assigned active task only, through `operator_agenda_view` and current Operator adapter. | No manager route, manager version-history surface, other operator’s work, client task, or arbitrary project detail. |
| Client | Existing `/cliente/tareas/[task-id]` | Own active `client_request` and its direct `client_submission` requirements through existing client-safe views. | No manager route, production deliverables outside the existing released-review surface, other client request, or raw audit/version access. |

### 3.3 Absence and failure behavior

For malformed UUIDs, missing rows, deleted rows, archived rows, inactive parent projects, or an unauthorized caller:

- manager route: render the established locale-aware protected not-found outcome; do not reveal whether the task exists;
- Operator and Client routes: preserve their current null/not-found behavior;
- calendar destination: resolve to `none` when the required ID is absent or the role has no permitted route; render inert text rather than a guessed link;
- adapter/RPC failure: log only through the established server logger and fail closed. Do not render partial privileged data, raw Supabase errors, SQL errors, or an optimistic destination.

## 4. Route and return-context contract

### 4.1 New canonical routes

Create exactly these protected, locale-aware routes using the established `[locale]/(protected)` route architecture:

- `/admin/tareas/[task-id]`
- `/pm/tareas/[task-id]`

They are the only new S10-06 route family. They must use the project i18n routing `Link`, `useRouter`, and `usePathname` utilities so the current locale is retained. Never construct `/en/...` API-style paths or manually prefix a locale.

### 4.2 Valid return context

The manager detail route accepts no arbitrary `returnTo` URL and no unvalidated external redirect input. The default return is the authorized manager project workspace:

- Admin: `/admin/proyectos/[project-id]?tab=tasks`
- PM: `/pm/proyectos/[project-id]?tab=tasks`

The route may preserve a **closed, internal** calendar-origin context only when it contains the known calendar range keys belonging to the relevant page:

- global calendar keys: `view`, `from`, `to`, and optional `projectId`;
- project-workspace calendar keys: `calendarView`, `calendarFrom`, `calendarTo`.

The implementation must validate and normalize those values with the existing calendar range utilities/schemas before use. If missing, malformed, out of range, incompatible with the task’s project, or not relevant to the source surface, discard them and use the default task-workspace return. It must never reflect unknown parameters or accept an encoded path/URL.

### 4.3 Task detail presentation requirements

The Manager task detail is a first-class page, not a query-only deep link to a sheet. It must:

1. show a clearly labeled back link using the resolved safe return target;
2. show project name with a safe link to the matching manager project workspace Tasks tab;
3. show task title, task type, status, priority, assignee summary, dates, description, and active resources using existing localized primitives/formatters where available;
4. show the real count and list of **active deliverables with `task_id = task.id`**; never use `has_deliverables` as the list source or as proof that a deliverable exists;
5. show each associated deliverable’s title, workflow type, status, assignee summary, relevant deadlines, and current-version number;
6. provide a role-safe route/action to open the existing manager deliverable detail surface for a selected associated deliverable. The target must be constrained to that task/project and must not become an arbitrary deliverable lookup;
7. use the existing deliverable detail/history components or the same server-side loader semantics for versions, feedback, external-link safety, and link-report affordances. Do not duplicate lifecycle logic in the task page;
8. keep mutation controls exactly aligned with existing capability logic. A `pm_watcher` may inspect but must not gain edit, status-transition, review, archive, reopen, delivery, or submission authority through the new route;
9. provide explicit empty states: no task resources, no associated deliverables, no submission version yet, and unavailable/missing detail are distinct states; and
10. meet existing keyboard, focus, semantic-heading, accessible external-link, color-independent status, and locale requirements.

## 5. Manager task-detail data adapter

### 5.1 Ownership and shape

Add a server-only manager task-detail adapter in the existing project/deliverable query layer. It must be typed from `Database`; it must not hand-author database declarations, cast unchecked rows to a broad `any`, or use a browser client.

The adapter accepts one candidate `taskId`, validates UUID syntax before querying, and returns either a fully validated manager DTO or `null`. It is responsible for shaping only the minimum data used by the route.

Recommended DTO boundary:

```ts
type ManagerTaskDetail = {
  taskId: string;
  projectId: string;
  projectName: string;
  title: string;
  description: string;
  taskType: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  deadlineAt: string;
  startedAt: string | null;
  completedAt: string | null;
  assignedAt: string;
  assignee: ProfileSummary | null;
  resources: ManagerTaskResource[];
  deliverables: ManagerTaskDeliverableSummary[];
};
```

`ManagerTaskDeliverableSummary` must contain only the fields necessary for the detail cards and the closed deliverable-detail action: deliverable ID, task ID, project ID, title, specifications if rendered, workflow type, status, assignee summary, current version number, relevant deadline fields, and lifecycle timestamps if rendered. It must not include raw audit records, invitation/contact data, tokens, secrets, or arbitrary payload JSON.

### 5.2 Query requirements

The adapter must:

1. use the current authenticated server Supabase client after the route session guard;
2. query one task by ID from `tasks`, with active ancestry predicates matching current manager query conventions:
   - `tasks.deleted_at IS NULL`;
   - `tasks.archived_at IS NULL`;
   - parent `projects.deleted_at IS NULL`;
   - parent `projects.archived_at IS NULL`;
3. retrieve only manager-safe task/project/assignee fields needed by the route;
4. retrieve task resources only through the current active resource query semantics, with `task_resources.deleted_at IS NULL` and deterministic `sort_order, id` ordering;
5. retrieve deliverables with `deliverables.task_id = taskId`, active deliverable/task/project ancestry, deterministic ordering (deadline then title then ID is preferred where an explicit order is needed), and no unrelated project deliverables;
6. use the existing `getDeliverableDetail()`/version and feedback loader for an opened deliverable, or extract a focused shared server-only equivalent that preserves the existing RLS-filtered table queries and deterministic `version_number DESC` / feedback ordering;
7. treat missing related rows and denied joins as absence, not as a reason to weaken filtering or query a base table with privileged credentials;
8. return `null` if the required task/project identity is missing or malformed. Optional deliverables/resources may be empty arrays; and
9. log safe diagnostic metadata server-side only, never raw error payloads to the client.

### 5.3 No new database surface

The adapter must not call a hypothetical `get_manager_task_detail` RPC. It must not create a view, policy, function, trigger, index, enum, or table. The applied RLS contracts already enforce the active Admin/PM boundary for the required rows.

## 6. Deliverable context and immutable link replacement

### 6.1 Display invariant

A task’s deliverable section is an association projection, not a second workflow engine. It shows active deliverables actually associated to the task. It must not synthesize a deliverable from `tasks.has_deliverables`, infer a version URL from a title, or equate a deliverable’s status with the task status.

For every rendered version:

- display its own immutable `version_number`, submitted timestamp, safe provider label, optional note, and public external HTTPS link;
- use `target="_blank"` and `rel="noopener noreferrer"` for external links;
- preserve the existing link-report behavior, which is an incident/report action and not a lifecycle mutation;
- render prior versions as historical evidence. Never overwrite, hide, relabel as current, or mutate the historical `submission_url`.

### 6.2 Production deliverables

For `production` workflow deliverables, reuse the current command boundary:

- `submit_deliverable_version(deliverable_id, submission_url, submission_note)` creates the next immutable version;
- it is available only to the existing authorized assignee/Admin/PM path and only when the existing status is `pending` or `changes_requested`;
- it validates the existing Google Drive submission URL rule and moves the deliverable to `awaiting_internal_review`.

S10-06 must not add a direct “edit link” action for a submitted, awaiting-review, approved, or delivered production version. If a replacement is needed after a submission has entered review, the existing review workflow must first produce the existing valid resubmission state. This preserves the review record and avoids a hidden URL mutation.

### 6.3 Client-submission deliverables

For `client_submission` workflow deliverables:

- only the existing Manager/Admin authorized `reopen_client_deliverable(deliverable_id, reason)` command may perform `submitted → pending`;
- reopening creates audited correction context and does not alter the submitted version;
- only the direct Client assignee then uses `submit_client_deliverable()` to create a replacement immutable version;
- existing Client correction-history presentation remains the Client-safe source of the reopen reason/context;
- a Manager detail may display existing manager-authorized immutable version/history information, but it must not expose a manager action that rewrites a Client’s historical link or impersonates the Client submission.

### 6.4 Link report distinction

`reportDeliverableLinkAction` / the existing link-report dialog remains a report of a particular immutable version. It does not itself replace a URL, reopen a Client deliverable, change a deliverable status, or prove an external link is broken. S10-06 must preserve that distinction in labels and actions.

## 7. Calendar destination contract

### 7.1 Single closed resolver

Extend `resolveCalendarEventDestination(event, role)` as the only calendar-event-to-route mapping owner. Do not duplicate role/route selection independently in month, week, agenda, list, milestone dialog, global calendar, or project calendar components.

The resolver consumes only the already role-safe `CalendarEventDto`; it must not query the database or infer missing IDs.

### 7.2 Required destination matrix

| Event type / role | Required destination |
| --- | --- |
| `milestone`, Admin/PM | Existing in-place manager milestone-detail dialog. Associated task rows inside that dialog use the manager task route in Section 7.3. |
| `task_deadline`, Admin | `/admin/tareas/[task-id]` when `task_id` is present; otherwise `none`. |
| `task_deadline`, PM | `/pm/tareas/[task-id]` when `task_id` is present; otherwise `none`. |
| `internal_review_deadline`, Admin | `/admin/tareas/[task-id]` when `task_id` is present; otherwise `none`. |
| `internal_review_deadline`, PM | `/pm/tareas/[task-id]` when `task_id` is present; otherwise `none`. |
| `client_delivery_deadline`, Admin | `/admin/tareas/[task-id]` when `task_id` is present; otherwise `none`. |
| `client_delivery_deadline`, PM | `/pm/tareas/[task-id]` when `task_id` is present; otherwise `none`. |
| production/client-submission deadline carrying `task_id`, Admin/PM | Same manager task route, never a generic deliverables tab destination. The task detail then exposes its associated deliverable context. |
| task-associated event, Operator | Existing `/operador/tareas/[task-id]` only when `task_id` is present. |
| task-associated event, Client | Existing `/cliente/tareas/[task-id]` only for a calendar row already permitted by the role-safe calendar RPC and only when `task_id` is present. |
| project deadline, Admin/PM | Existing locale-aware manager project overview target. |
| project deadline, Client | Existing locale-aware Client project target. |
| any event with an absent/ineligible target | `none`, rendered without a link. |

The resolver must not route an Admin/PM task event to `?tab=tasks`; that was the ambiguous state that S10-06 corrects. It must not route a Client task event to an Admin/PM route, and it must not use a project ID as a substitute when a task ID is missing.

### 7.3 Milestone associated-task links

The manager milestone-detail surface already receives active task IDs and parent project IDs from `list_milestone_tasks()`. Replace its ambiguous task-workspace link with the role-specific manager task route:

- Admin: `/admin/tareas/[task-id]`
- PM: `/pm/tareas/[task-id]`

Do not add a Client/Operator milestone association link. Those roles do not receive the manager milestone detail or `list_milestone_tasks()` result.

The task link must be a real locale-aware `Link`, have an accessible name containing the task title, and use no nested interactive element. Its manager route independently authorizes the target on load.

## 8. Calendar URL and state synchronization repair

### 8.1 Root defect to remove

The global coordinator uses `view`, `from`, and `to` when it owns URL state, while the project workspace owns calendar query state as `calendarView`, `calendarFrom`, and `calendarTo`. The project calendar wrapper supplies range state from server props, but the shared coordinator’s local `updateRange()` fallback currently writes the global keys unless the wrapper owns every range change. That creates URL/state divergence and can leave the visible calendar in a loading/incorrect range cycle.

### 8.2 Ownership rule

- The page/server loader is the source of truth for normalized range state.
- The relevant URL key family is the source of truth for the next server render.
- `CalendarCoordinator` is presentation and user-interaction state only. It must receive an explicit range-change callback whenever embedded in a project workspace.
- `ProjectCalendarTab` owns project-calendar key construction and must update only `tab=calendar`, `calendarView`, `calendarFrom`, and `calendarTo`.
- The global calendar retains only `view`, `from`, `to`, and optional `projectId`.

### 8.3 Required behavior

1. Normalize incoming query parameters server-side with the existing range utility/schema before fetching the calendar feed.
2. On a project workspace calendar tab, pass a non-optional `onRangeChange` callback to `CalendarCoordinator`.
3. That callback must create a fresh `URLSearchParams` from current params; set `tab=calendar`; set all three normalized project-calendar range keys atomically; preserve unrelated supported workspace state; and use the locale-aware router to navigate once.
4. The callback must not write `view`, `from`, `to`, or `projectId` for the embedded calendar.
5. `CalendarCoordinator.updateRange()` must call the supplied callback and return without its own fallback navigation when the callback exists.
6. `CalendarCoordinator` must derive rendered range/view exclusively from the latest `initialRange` prop. It must not introduce a second stale local range store.
7. View switching, previous/next, and Today must all use the same callback path and normalized range object.
8. Tab selection must preserve or initialize the project calendar range keys exactly once, as the existing workspace shell is intended to do. It must not introduce duplicate `tab` values, repeated pushes, or a client effect that pushes the current URL on every render.
9. The global calendar remains unaffected except for consuming the centralized destination resolver.
10. Missing/malformed project-calendar parameters normalize once to the project calendar default range and render a stable feed; they must not trigger an infinite router push/refresh loop.

## 9. Localization, accessibility, and visual constraints

All new user-visible strings must be added with exact English/Spanish parity in `messages/en-US.json` and `messages/es-MX.json`. Do not hardcode English or Spanish fallback text in the new routes/components.

Required localized concepts include:

- page title and task/project breadcrumbs/back action;
- associated deliverables heading, singular/plural count, empty state, version/current-version labels, workflow/status/deadline labels, and unavailable state;
- safe external-link accessible text including a meaningful item title/version;
- manager task calendar navigation accessible text;
- milestone associated-task accessible link text; and
- a truthful immutable-replacement explanation that does not say an old link was edited.

Use existing translation namespaces where they are already semantically owned. Add a narrow task-detail namespace only if reuse would cause overloaded/misleading keys. Maintain the repository locale convention (`en-US`, `es-MX`) and existing date/number formatter behavior.

Accessibility requirements:

- one H1 per task page; section headings are semantic and unique;
- all links/buttons have discernible localized names;
- focus moves naturally by navigation; do not use a modal just to implement the route;
- no click-only card with nested link/button conflicts;
- task state, priority, and deadline urgency remain understandable without color alone;
- external links declare their context and use safe `rel` attributes;
- empty/unavailable state is announced/represented without exposing authorization details.

## 10. Expected file-level implementation map

Exact splitting may vary to preserve the repository’s responsibility and line-length rules, but implementation must stay within these boundaries:

1. `src/lib/projects/queries.ts` and/or a narrow server-only sibling: manager task-detail DTO and active, RLS-backed task/resource/deliverable loader.
2. `src/lib/deliverables/queries.ts`: reuse or minimally factor existing manager deliverable/version/history loader. Do not duplicate database access with a divergent field set.
3. `src/app/[locale]/(protected)/admin/tareas/[task-id]/page.tsx`: Admin session guard, server client, manager loader, locale-aware not-found handling, and Admin route composition.
4. `src/app/[locale]/(protected)/pm/tareas/[task-id]/page.tsx`: identical PM composition using the same shared role-safe page/view logic; do not fork data rules.
5. A small route-local or shared protected manager task-detail presentation component: data display and safe actions only. It must not perform privileged fetching in the browser.
6. `src/lib/calendar/types.ts`: centralized closed destination mapping update.
7. `src/app/[locale]/(protected)/calendario/_components/event-badge.tsx` and any shared event renderer only as necessary to consume the resolver output; no duplicate mapping.
8. manager milestone detail component: replace associated-task workspace links with manager task-detail links.
9. `src/components/shared/projects/project-workspace/project-calendar-tab.tsx`, `project-workspace-shell.tsx`, and `calendar-coordinator.tsx`: enforce the range-state ownership contract in Section 8.
10. `messages/en-US.json` and `messages/es-MX.json`: parity changes only.
11. Focused existing test files adjacent to changed routes/components/utility functions, only where an existing contract is amended or a regression guard is indispensable.

Do not modify migrations, generated database types, provider settings, auth route allowlists, general RLS, unrelated dashboard components, or VSDD/Kanban artifacts.

## 11. Server action and mutation constraints

S10-06 adds no new trusted mutation. If the manager task/detail UI surfaces an existing operation, it must call the current server action/command adapter and preserve its existing result parsing, revalidation, validation, and safe error mapping.

Specific prohibitions:

- no direct table UPDATE for task status, deliverable status, submission URL, review, reopening, archive, delivery, or link report;
- no client-side reconstruction of role/capacity authorization;
- no mutation based solely on an ID from the URL or a calendar event;
- no optimistic rewrite of a historical/current version URL;
- no new manager-specific Client-submission correction command;
- no revalidation broadening beyond the affected task/project/calendar paths already owned by the invoked existing action.

## 12. Manual acceptance matrix

The following is the implementation acceptance contract. It is deliberately role-safe and does not claim live RLS proof before a new database change; no database change exists in this work item.

| Journey | Required result |
| --- | --- |
| Admin opens a global-calendar task/deadline event | Locale-preserving `/admin/tareas/[task-id]`; active task, associated active deliverables, and safe return path render. |
| PM opens the equivalent event without project membership | Locale-preserving `/pm/tareas/[task-id]` renders because active PM is global manager authority. |
| PM watcher opens detail | Read-only manager view; no new mutation affordances appear. Existing trusted command enforcement remains authoritative. |
| Milestone dialog task link | Admin/PM task row goes to the dedicated manager task route, not an ambiguous project workspace tab. |
| Operator calendar/agenda task | Continues only to `/operador/tareas/[task-id]`; another user’s/missing/archived task is unavailable. |
| Client task journey | Continues only through existing Client task detail and direct submission context; no manager deliverable/version history leaks. |
| Task with no deliverables | Page renders a truthful localized empty deliverables section; it does not fail because `has_deliverables` is stale/false. |
| Task with current and prior versions | Version chronology shows immutable distinct URLs/metadata; historic version links remain unchanged. |
| Production replacement | Existing valid resubmission workflow creates next version only in existing allowed states; no edit-in-place control is offered. |
| Client submission replacement | Existing Manager/Admin reopen then direct Client replacement produces a new version; prior link/history stays intact. |
| Link report | Reports the selected immutable version; does not claim to replace it or change workflow state. |
| Invalid/deleted/archived/unauthorized task route | Safe not-found/absence without data or authorization disclosure. |
| Project calendar view change / prev / next / Today | URL uses only `calendarView/calendarFrom/calendarTo` with `tab=calendar`; server props and UI synchronize once, no infinite loading/push loop. |
| Global calendar view change | Retains global keys and does not receive workspace-prefixed keys. |

## 13. Focused verification after implementation

The owner explicitly excluded verification commands at specification-authoring time because the preceding implementation was already verified. After S10-06 code exists, use only the smallest relevant proof:

1. Type/lint only if the implementation task requires it under the existing repository practice.
2. Add or amend focused tests only for changed behavior, such as:
   - `resolveCalendarEventDestination()` role/event matrix, including no-ID => `none`;
   - manager milestone task row resolves to the dedicated role route;
   - project-calendar callback writes only `calendar*` keys and does not use global keys;
   - the manager task adapter rejects malformed IDs and does not return unrelated/deleted/archived association rows;
   - immutable replacement UI has no edit-in-place/history mutation path.
3. Perform manual authenticated journeys from Section 12 for Admin, PM, Operator, and Client using authorized development identities.
4. Do not run build, full suite, coverage, E2E, broad RLS fixtures, provider procedures, or production procedures unless separately directed.

## 14. Implementation stop conditions and decisions already resolved

Stop and request a new decision if implementation discovers any of the following:

- the current applied RLS/database contract cannot retrieve one manager task plus active associated deliverables/versions without a new public surface;
- an accepted requirement needs a Manager to replace a submitted/approved/delivered production URL without the existing review/resubmission state transition;
- a Client/Operator is requested to inspect a manager task detail, manager milestone task list, raw deliverable version, feedback, audit, or another user’s task;
- the route requires an arbitrary return URL or a URL key not covered by the closed context contract;
- calendar data omits a required task ID for a task-targeted event and the product request insists on a route rather than safe absence; or
- a necessary new persisted field, database constraint, index, function, policy, or type declaration is discovered.

None of those conditions was found during the S10-06 viability review. Therefore the task is implementation-ready on the present schema baseline with **no migration and no type regeneration gate**.
