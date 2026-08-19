# S04-04 — Deliver the Project Workspace: Task Planning and Constrained Kanban

**Sprint:** S04  
**Work Item:** S04-04  
**Status:** Ready for implementation  
**Last reviewed:** 2026-08-19  
**Spec authority:** Sprint plan `s04-e04-e05-project-workspace-and-production-deliverable-lifecycle-sprint-plan.md`, Section 5 (work item S04-04).  
**Dependencies:** S04-01 (shadcn/ui + token-based theming), S04-02 (command boundary), S04-03 (project workspace shell, membership governance, and placeholder tabs).

---

## 1. Purpose and scope

This specification defines the complete technical, architectural, and visual blueprint for **S04-04: Project Workspace, Task Planning, and Constrained Kanban**.

S04-04 replaces the `TasksTabPlaceholder` component installed in S04-03 with a fully operational task management surface inside the existing project workspace shell. It delivers:

- Task creation, editing, and archival driven by the Server Actions and commands already scaffolded in `src/lib/projects/commands.ts` and `src/lib/projects/actions.ts`.
- Dual presentation modes: **Kanban** (one column per task status) and **List** (sortable, filterable table).
- Constrained status transitions via `transition_task_status` RPC — the same command path for drag-and-drop, menu-driven moves, and inline status selects.
- Semantically correct differentiation of `blocking` **priority** from `blocked` **status**: distinct icons, colors, and accessible labels at every touch point.
- Task-targeted internal collaboration comments using the existing `create_collaboration_comment` RPC through `src/lib/comments/`.
- Capacity-gated UI: PM Watcher reads and comments only; PM Lead and Admin have full management access.

### In scope

1. **Tasks tab — full implementation** inside the existing `ProjectWorkspaceShell` tabs at `value="tasks"`.
2. **Task creation** form (Dialog or Sheet) with all accepted fields: `title`, `description`, `task_type`, `priority`, `deadline_at`, `assignee_id`.
3. **Task editing** via a focused edit form (same dialog/sheet, edit mode), updating `title`, `description`, `priority`, `deadline_at`, `assignee_id`.
4. **Task archival** (soft-delete) via `archiveTask` command with `AlertDialog` confirmation.
5. **Kanban board** with five columns: `pending` → `in_progress` → `in_review` → `completed` → `blocked`. Optional drag-and-drop using `@hello-pangea/dnd` (library is already declared in `package.json`).
6. **List view** with sortable, filterable tabular task rows.
7. **Task detail Sheet/Dialog** (task info, status control, collaboration comments feed, resource links).
8. **Status transitions** via the `transition_task_status` RPC; rejected or conflicting transitions must restore the authoritative server state and render a localized non-leaking error message.
9. **Task-targeted collaboration comments** using `create_collaboration_comment` RPC. Display `author_capacity_snapshot` label alongside author name and timestamp. Comments are distinct from formal review feedback.
10. **`blocking` priority vs `blocked` status** — both visually and semantically distinguished in all views.
11. **Filters** — by `status`, `priority`, `task_type`, and `assignee_id`.
12. **Localization** — full catalog parity in `messages/es-MX.json` and `messages/en-US.json`.
13. **Focused tests** — for task Server Actions, Kanban state restoration, and watcher authorization.

### Explicitly out of scope for S04-04

- Production deliverable creation, submission, review, or version history (deferred to S04-06/S04-07).
- Project completion / reopening lifecycle (deferred to S04-05).
- Client portal / client task execution and submission (deferred to E7).
- Operator execution portal or dedicated mobile agenda view (deferred to E6).
- Timeline, Calendar, Archive, or Activity tab implementations.
- Task resource creation or editing (resources are **read-only** if the task has them — display only).
- Direct database migrations, RLS changes, or edits to `database.types.ts`.

---

## 2. Baseline and architectural contracts

### 2.1 Established data layer (read before implementing)

The following already exist and must be consumed exactly as-is:

**Queries (`src/lib/projects/queries.ts`):**
- `listProjectTasks(supabase, projectId, filters?)` → `TaskWithAssignee[]` — filtered task list with assignee profile join.
- `getTaskDetail(supabase, taskId)` → `TaskWithAssignee | null` — single task with assignee.
- `listTaskResources(supabase, taskId)` → `TaskResource[]` — read-only resource links attached to a task.
- `getProjectMembers(supabase, projectId)` → `ProjectMemberWithProfile[]` — eligible assignees for the project.

**Commands (`src/lib/projects/commands.ts`):**
- `createTask(supabase, input: CreateTaskInput, actorId)` → `CommandResult<Task>`
- `updateTask(supabase, taskId, input: UpdateTaskInput, actorId)` → `CommandResult<Task>`
- `transitionTaskStatus(supabase, input: TransitionTaskStatusInput)` → `CommandResult<TransitionResult>`
- `archiveTask(supabase, taskId, reason?)` → `CommandResult<{ success: boolean }>`

**Schemas (`src/lib/projects/schemas.ts`):**
- `CreateTaskSchema` — `{ project_id, title, description, task_type, priority, deadline_at, assignee_id }`
- `UpdateTaskSchema` — `{ title?, description?, priority?, deadline_at?, assignee_id? }`
- `TransitionTaskStatusSchema` — `{ task_id, next_status, reopen_reason? }`

**Comments (`src/lib/comments/`):**
- `listComments(supabase, targetId, targetType)` → `CollaborationCommentWithAuthor[]`
- `createComment(supabase, input)` — calls `create_collaboration_comment` RPC
- `CreateCommentSchema` — `{ project_id, target_type: "task", target_id, body }`
- `CollaborationCommentWithAuthor` — includes `author_capacity_snapshot`, `body`, `created_at`, `author.full_name`, `author.avatar_url`

**Status maps (`src/lib/status-maps.ts`):**
- `TASK_STATUS_MAP` — `pending`, `in_progress`, `in_review`, `completed`, `blocked` (uses `AlertTriangle` for `blocked`)
- `TASK_PRIORITY_MAP` — `low`, `medium`, `high`, `blocking` (uses `ShieldCheck` + rose hue for `blocking` — **distinct from `blocked` status**)
- `MEMBER_CAPACITY_MAP` — for rendering assignee capacity label

### 2.2 Task field semantics

From the `tasks` table Row (in `database.types.ts`):

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | UUID |
| `project_id` | `string` | FK → projects |
| `assignee_id` | `string` | FK → profiles (non-nullable; must be an active project member) |
| `title` | `string` | min 1, max 200 |
| `description` | `string` | min 1, max 5000 |
| `task_type` | `"internal_work" \| "client_request"` | `client_request` may not enter `in_review` |
| `priority` | `"low" \| "medium" \| "high" \| "blocking"` | `blocking` = this task blocks other work |
| `status` | `"pending" \| "in_progress" \| "in_review" \| "completed" \| "blocked"` | `blocked` = task cannot proceed due to blocker |
| `deadline_at` | ISO datetime string | displayed and sorted |
| `has_deliverables` | `boolean` | read-only flag; set by database when a deliverable is linked |
| `started_at` | `string \| null` | set by status machine |
| `completed_at` | `string \| null` | set by status machine |

### 2.3 Task type authorization constraints

**`client_request` tasks:**
- Can transition to `pending`, `in_progress`, `completed`, `blocked` only.
- Cannot enter `in_review` — this is an E7 client-submission boundary. The UI must hide `in_review` as a next-status option for `client_request` tasks.
- The transition command enforces this at the RPC level; do not trust client-side filtering alone.

**`internal_work` tasks:**
- May use all five status values.

Both task types are visible to PM and Admin in this sprint. The distinction matters for status transition options only.

### 2.4 Assignee eligibility

An assignee must be an **active project member** (`project_members.deleted_at IS NULL`) with a compatible role:
- `pm_lead` capacity → `profiles.role` in (`pm`, `admin`)
- `pm_watcher` capacity → `profiles.role` in (`pm`, `admin`)
- `operator` capacity → `profiles.role` = `operator`
- `client` capacity → `profiles.role` = `client`

The task creation and edit forms must limit the assignee dropdown to active members of the current project (derived from `project.members` already loaded in the workspace shell). Do not allow a forged `assignee_id` that refers to a non-member; the server command and RLS enforce this independently.

> **Note:** The existing `CreateTaskSchema` requires `assignee_id` to be a non-optional UUID. The UI must always provide a valid value before submitting.

### 2.5 Authorization gates

| Actor | Can create task | Can edit task | Can move status | Can archive task | Can comment | Can see all tasks |
|---|---|---|---|---|---|---|
| `admin` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `pm_lead` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `pm_watcher` | ❌ | ❌ | ❌ | ❌ | ✅ (advisory only) | ✅ |

Hiding a button is a UX improvement only. The Server Actions are the actual security boundary.

---

## 3. Component architecture

### 3.1 Integration point in existing shell

The `ProjectWorkspaceShell` at line 121–123 renders `<TasksTabPlaceholder />` inside `<TabsContent value="tasks">`. **S04-04 replaces that single component** with the fully operational `<TasksTab>` component.

The workspace shell already passes to `ProjectWorkspaceShell`:
- `project: ProjectDetail` — includes `project.members`, `project.id`, `project.project_type`
- `effectiveCapacity: "admin" | "pm_lead" | "pm_watcher"` — determines mutation controls
- `actorRole: "admin" | "pm"`

The `TasksTab` component will receive these as props and will self-manage task data via Server Actions and optimistic UI.

### 3.2 Route-local vs shared component placement

Because tasks are project-scoped and the task surface is used identically by both `/admin/proyectos/[id]` and `/pm/proyectos/[id]`, task components belong in **`src/components/shared/projects/project-tasks/`**.

```
src/components/shared/projects/
├── project-directory/          ← S04-03 (unchanged)
├── project-members/            ← S04-03 (unchanged)
├── project-workspace/          ← S04-03 (unchanged shells/tabs)
│   └── placeholders/
│       └── tasks-tab-placeholder.tsx  ← REPLACED by importing TasksTab
└── project-tasks/              ← NEW in S04-04
    ├── tasks-tab.tsx           ← Top-level Tasks tab (view mode switch, filter bar, Kanban/List)
    ├── task-filters.tsx        ← Status / Priority / Type / Assignee filter controls
    ├── task-kanban-board.tsx   ← Kanban column layout (hello-pangea/dnd DragDropContext)
    ├── task-kanban-column.tsx  ← Single Kanban column (Droppable + column header)
    ├── task-kanban-card.tsx    ← Draggable task card inside a column
    ├── task-list-view.tsx      ← Sortable Table view (fallback / desktop dense)
    ├── task-list-row.tsx       ← Single table row with inline status/priority badges
    ├── task-create-dialog.tsx  ← Create task form dialog
    ├── task-edit-dialog.tsx    ← Edit task form dialog
    ├── task-detail-sheet.tsx   ← Slide-over task detail sheet (mobile + large context view)
    ├── task-status-select.tsx  ← Controlled inline status selector (used in list rows + detail)
    ├── task-priority-badge.tsx ← Priority badge (blocking vs high vs medium vs low)
    ├── task-status-badge.tsx   ← Status badge (blocked vs others — uses TASK_STATUS_MAP)
    ├── task-assignee-select.tsx← Assignee picker from eligible project members
    ├── task-archive-dialog.tsx ← AlertDialog confirmation for task soft-delete
    └── task-comments-section.tsx ← Collaboration comment feed + compose form
```

### 3.3 Component responsibilities

#### `TasksTab` (Client Component)

The top-level container for the Tasks workspace. Receives initial task data as props (server-fetched by the page) and manages:

- `viewMode: "kanban" | "list"` — switchable via toggle buttons in the toolbar.
- `filters: TaskFilters` — status, priority, task_type, assignee_id (client-side filtering against `initialTasks`).
- `openTaskId: string | null` — currently open detail sheet.
- `isCreateOpen: boolean` — create dialog visibility.
- `tasks: TaskWithAssignee[]` — in-memory task list, updated optimistically after mutations.

**Props interface:**
```ts
interface TasksTabProps {
  project: ProjectDetail;
  initialTasks: TaskWithAssignee[];
  effectiveCapacity: "admin" | "pm_lead" | "pm_watcher";
  locale: string;
}
```

The initial tasks are fetched by the workspace page (Server Component) and passed as props to avoid a loading state on tab switch.

**Key behaviors:**
- Renders `<TaskFilters>` at the top, `<TaskKanbanBoard>` or `<TaskListView>` based on `viewMode`.
- "Nueva Tarea" (`New Task`) button visible only for `pm_lead` and `admin`.
- After any Server Action success, calls `router.refresh()` to re-fetch authoritative server state and reconcile with optimistic update.

---

#### `TaskFilters` (Client Component)

Renders filter controls above the Kanban/List:
- **Status** `Select`: `all`, `pending`, `in_progress`, `in_review`, `completed`, `blocked`.
- **Priority** `Select`: `all`, `low`, `medium`, `high`, `blocking`.
- **Type** `Select`: `all`, `internal_work`, `client_request`.
- **Assignee** `Select`: populated from `project.members` (avatar + name).
- **Clear filters** button: visible when any filter is active.

Filters are applied **client-side** against the initial server-fetched task list. Since the task list is bounded to a single project and pagination is not needed at this scale, all tasks are fetched once at page load.

---

#### `TaskKanbanBoard` (Client Component)

Wraps `@hello-pangea/dnd`'s `<DragDropContext>` around five `<TaskKanbanColumn>` components, one per `TaskStatus` value.

**Column order:** `pending` | `in_progress` | `in_review` | `completed` | `blocked`

> ⚠️ `in_review` column must not accept `client_request` tasks as drop targets. If a `client_request` task card is dragged to `in_review`, the drop should be rejected visually and no server command should be called.

**Drag-and-drop behavior:**
1. On `onDragEnd`, if `destination` is null or same as `source`, do nothing.
2. If the task is `client_request` and the destination column is `in_review`, immediately restore the card to the source position and show a localized error toast.
3. Otherwise, optimistically move the card to the target column.
4. Call `transitionTaskStatusAction(taskId, projectId, { task_id, next_status })` Server Action.
5. On `CommandResult.ok === false`, restore the card to the source column position and show the mapped localized error message from `CommandResult.error.code`.
6. On success, call `router.refresh()` to re-sync with server state.

**Accessibility fallback:** All status transitions must also be possible via the `TaskStatusSelect` inline control and the task detail sheet, so users who cannot or prefer not to use drag-and-drop have full task management capability via keyboard.

---

#### `TaskKanbanColumn` (Client Component)

Renders a `<Droppable>` container for one status:
- Column header: status label from `TASK_STATUS_MAP` (icon + text), task count badge.
- For `blocked` column header: renders `AlertTriangle` icon (from `TASK_STATUS_MAP`) in red — **not** the `ShieldCheck` icon used for `blocking` priority.
- Accepts task cards as children.
- Visual styling: distinct background tint per column status (from `TASK_STATUS_MAP.badgeBg` adapted to column header, lighter body fill).
- For `pm_watcher`: drag handles hidden on all cards; no "Move to this column" affordance.

---

#### `TaskKanbanCard` (Client Component)

A `<Draggable>` task card:
- **Title** (truncated to 2 lines).
- **Priority badge** using `TaskPriorityBadge` — renders `TASK_PRIORITY_MAP[task.priority]` icon and label.
  - `blocking` priority card should have a **rose-tinted left border accent** (`border-l-4 border-rose-400`) to make it identifiable at a glance — distinct from the red column that `blocked` tasks live in.
- **Type badge**: `Interno` / `Solicitud Cliente`.
- **Assignee avatar** with tooltip (full name + capacity).
- **Deadline** — if overdue, show in destructive/red color.
- **`has_deliverables` indicator** — small `Paperclip` icon if task has linked production deliverables.
- Click: opens `TaskDetailSheet` for this task.
- Drag handle (visible icon, 44px target) — hidden for `pm_watcher`.

---

#### `TaskListView` (Client Component)

A shadcn `Table` with the following columns:
1. **Título / Title**: linked to open `TaskDetailSheet`.
2. **Tipo / Type**: `Interno` or `Solicitud Cliente` badge.
3. **Estado / Status**: `TaskStatusBadge` inline.
4. **Prioridad / Priority**: `TaskPriorityBadge` inline — `blocking` uses rose hue + `ShieldCheck` icon.
5. **Asignado a / Assignee**: Avatar + name.
6. **Fecha Límite / Deadline**: formatted date; overdue shown in destructive color.
7. **Acciones / Actions**: `DropdownMenu` (Edit, Change Status, Archive) — hidden for `pm_watcher`.

Sortable by clicking column headers: `deadline_at` (asc/desc), `priority` (blocking first), `status`. Sort is client-side.

---

#### `TaskDetailSheet` (Client Component)

A shadcn `Sheet` (`side="right"`, `size="lg"`) providing the full task detail view and interaction surface. On desktop it renders at a comfortable 480–560px width; on mobile it expands to full-screen.

**Content sections:**
1. **Header**: Task title + status badge + priority badge. Close button (X). Edit button (opens `TaskEditDialog`, hidden for `pm_watcher`).
2. **Meta row**: Type badge | Assignee avatar+name | Deadline.
3. **Status control** (hidden for `pm_watcher`): `TaskStatusSelect` to move the task to the next valid status.
4. **Description**: Full text display (pre-wrap; no HTML rendering).
5. **Resources** (read-only): If `task.has_deliverables` or resource links exist, list `TaskResource[]` as clickable external links (lexically sanitized public HTTPS only; do not dereference).
6. **Collaboration comments** (`TaskCommentsSection`): Comment feed + compose form.

**Accessibility:**
- `aria-label="Detalles de la tarea: {title}"` on the sheet.
- Focus trap while open.
- Escape closes the sheet without submitting.
- All interactive elements: min 44×44px touch target.

---

#### `TaskStatusSelect` (Client Component)

An inline select for changing a task's status. Uses shadcn `Select`.

**Allowed transitions per current status:**
- `pending` → `in_progress`, `blocked`
- `in_progress` → `in_review` (internal_work only), `completed`, `blocked`, `pending`
- `in_review` → `completed`, `blocked`, `in_progress`
- `completed` → `in_progress` (reopen)
- `blocked` → `pending`, `in_progress`

For `client_request` tasks, never offer `in_review` as a target.

On change, call `transitionTaskStatusAction`. Show loading spinner; on failure, revert to prior value and show toast error.

> **Stop condition:** If the `transition_task_status` RPC rejects a transition that the UI shows as valid, surface the mapped error. Do not suppress or re-attempt with a different status.

---

#### `TaskPriorityBadge` (Client Component)

A reusable badge consuming `TASK_PRIORITY_MAP`:
- `blocking`: rose/crimson background (`bg-rose-200 dark:bg-rose-950/80`), `ShieldCheck` icon, bold label — **"Bloqueante"** in es-MX / **"Blocking"** in en-US.
- `high`: orange background, `AlertCircle` icon — **"Alta"** / **"High"**.
- `medium`: yellow background, `Flag` icon — **"Media"** / **"Medium"**.
- `low`: green background, `ArrowRight` icon — **"Baja"** / **"Low"**.

Always renders icon + text, never color alone.

---

#### `TaskStatusBadge` (Client Component)

A reusable badge consuming `TASK_STATUS_MAP`:
- `blocked`: red background, `AlertTriangle` icon — **"Bloqueada"** / **"Blocked"**.
- `in_review`: purple, `Eye` icon — **"En revisión"** / **"In Review"**.
- `in_progress`: indigo, `CircleDot` icon — **"En progreso"** / **"In Progress"**.
- `pending`: blue, `Clock` icon — **"Pendiente"** / **"Pending"**.
- `completed`: green, `CheckCircle` icon — **"Completada"** / **"Completed"**.

Always renders icon + text, never color alone.

> **CRITICAL SEMANTIC CONTRACT:** `blocked` (red + AlertTriangle) and `blocking` (rose + ShieldCheck) must never share the same icon, color, or label. Every code path that renders a task badge must import from the centralized maps in `src/lib/status-maps.ts` — never hard-code icon or color values inline.

---

#### `TaskCreateDialog` (Client Component)

A shadcn `Dialog` for creating a new task. Uses React Hook Form with `zodResolver(CreateTaskSchema)`.

**Form fields:**
1. **Tipo de tarea / Task Type** (`task_type`): Segmented toggle — `Trabajo interno` / `Solicitud de cliente`. Defaults to `internal_work`.
   - If `project.project_type === 'internal'`, show only `internal_work` and disable `client_request` with explanatory tooltip: "Las solicitudes de cliente solo están disponibles en proyectos de cliente."
2. **Título / Title** (`title`): `Input`, min 1, max 200.
3. **Descripción / Description** (`description`): `Textarea`, min 1, max 5000.
4. **Prioridad / Priority** (`priority`): `Select` — Low, Medium, High, Blocking.
5. **Asignado a / Assignee** (`assignee_id`): `TaskAssigneeSelect` — filtered to active project members.
6. **Fecha límite / Deadline** (`deadline_at`): Date+time input (HTML5 `datetime-local`, converted to ISO string with timezone offset).

**Submission:**
- Calls `createTaskAction(input)`.
- On success: shows Sonner toast "Tarea creada exitosamente." and calls `router.refresh()`.
- On failure: shows localized mapped error. Never expose database details.

---

#### `TaskEditDialog` (Client Component)

A shadcn `Dialog` for editing an existing task. Uses React Hook Form with `zodResolver(UpdateTaskSchema)`.

**Editable fields:** `title`, `description`, `priority`, `deadline_at`, `assignee_id`.

**Read-only fields (displayed, not editable):** `task_type` (immutable after creation), `status` (managed via `TaskStatusSelect`), `created_at`.

**Submission:**
- Calls `updateTaskAction(taskId, projectId, input)`.
- On success: shows toast and calls `router.refresh()`.
- On failure: shows mapped localized error.

---

#### `TaskArchiveDialog` (Client Component)

A shadcn `AlertDialog` confirming soft-delete of a task.

- Title: "¿Archivar esta tarea?" / "Archive this task?"
- Description: "La tarea se ocultará del espacio de trabajo. Esta acción solo puede revertirse por un administrador." / "The task will be hidden from the workspace. This can only be undone by an administrator."
- Optional reason `Textarea` (not required, max 500 chars).
- On confirm: calls `archiveTaskAction(taskId, projectId, reason?)`.
- On success: removes the card from local state optimistically and calls `router.refresh()`.

---

#### `TaskAssigneeSelect` (Client Component)

A controlled combobox (shadcn `Popover` + `Command`) for selecting an assignee:
- Populated from `project.members` (already in workspace shell props).
- Displays: avatar + full name + capacity badge (pm_lead / pm_watcher / operator / client).
- Filters by search input.
- Excludes soft-deleted members (`deleted_at !== null`).

---

#### `TaskCommentsSection` (Client Component)

An inline comment feed + compose form within `TaskDetailSheet`.

**Comment feed:**
- Chronological list of `CollaborationCommentWithAuthor` for `target_type = "task"` and `target_id = task.id`.
- Each comment renders: avatar, author full name, `author_capacity_snapshot` label (from `MEMBER_CAPACITY_MAP`), relative timestamp, and body text.
- Empty state: "Aún no hay comentarios en esta tarea." / "No comments on this task yet."

**Loading:** Comments for the specific task are fetched client-side when the `TaskDetailSheet` opens. Use a `useEffect` with `listComments` via a Server Action wrapper or a dedicated route for this data (do NOT query in a Server Component for lazily loaded detail data).

**Compose form:**
- `Textarea` (`body`, min 1, max 5000).
- Submit button: "Comentar" / "Comment".
- Calls `createTaskCommentAction(projectId, taskId, body)`.
- On success: appends the comment optimistically to the feed and calls `router.refresh()`.
- On failure: shows toast error.

**Important:** Comments are informal advisory discussion. They must not use labels like "Aprobado" or "Cambios solicitados" — those are formal `deliverable_feedback` terms.

For `pm_watcher`: The compose form is **visible** (Watchers may add advisory comments per the sprint plan). The RPC enforces the capacity check server-side.

---

## 4. Server Actions contract (`src/lib/projects/actions.ts` additions)

The following Server Actions must be **added** to the existing `src/lib/projects/actions.ts` file (which already exists from S04-03). Do not create a new file; extend the existing one.

### New imports to add at the top of `actions.ts`

```ts
import * as commentCommands from "@/lib/comments/commands";
import { CreateCommentSchema } from "@/lib/comments/schemas";
import type { CreateCommentResult } from "@/lib/comments/commands";
import type { TransitionResult } from "@/lib/projects/commands";
import {
  CreateTaskSchema,
  UpdateTaskSchema,
  TransitionTaskStatusSchema,
  type CreateTaskInput,
  type UpdateTaskInput,
  type TransitionTaskStatusInput,
} from "@/lib/projects/schemas";
import type { Task } from "@/lib/projects/queries";
```

> **Note:** `projectCommands` is already imported. Since `createTask`, `updateTask`, `transitionTaskStatus`, and `archiveTask` are all exported from `src/lib/projects/commands.ts`, use named imports or access via the existing `projectCommands` alias. Avoid creating a duplicate import of the same module.

### Task creation action

```ts
export async function createTaskAction(
  rawInput: CreateTaskInput
): Promise<CommandResult<Task>> {
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);

  if (session.role !== "admin" && session.role !== "pm") {
    return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized role" } };
  }

  const parseResult = CreateTaskSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: parseResult.error.errors[0]?.message ?? "Invalid input",
      },
    };
  }

  const supabase = createClient(cookieStore);
  const result = await projectCommands.createTask(supabase, parseResult.data, session.user.id);

  if (result.ok) {
    revalidatePath(`/[locale]/(protected)/admin/proyectos/${rawInput.project_id}`, "page");
    revalidatePath(`/[locale]/(protected)/pm/proyectos/${rawInput.project_id}`, "page");
  }
  return result;
}
```

### Task update action

```ts
export async function updateTaskAction(
  taskId: string,
  projectId: string,
  rawInput: UpdateTaskInput
): Promise<CommandResult<Task>> {
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);

  if (session.role !== "admin" && session.role !== "pm") {
    return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized role" } };
  }

  const parseResult = UpdateTaskSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: parseResult.error.errors[0]?.message ?? "Invalid input",
      },
    };
  }

  const supabase = createClient(cookieStore);
  const result = await projectCommands.updateTask(supabase, taskId, parseResult.data, session.user.id);

  if (result.ok) {
    revalidatePath(`/[locale]/(protected)/admin/proyectos/${projectId}`, "page");
    revalidatePath(`/[locale]/(protected)/pm/proyectos/${projectId}`, "page");
  }
  return result;
}
```

### Task status transition action

```ts
export async function transitionTaskStatusAction(
  taskId: string,
  projectId: string,
  rawInput: TransitionTaskStatusInput
): Promise<CommandResult<TransitionResult>> {
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);

  if (session.role !== "admin" && session.role !== "pm") {
    return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized role" } };
  }

  const parseResult = TransitionTaskStatusSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: parseResult.error.errors[0]?.message ?? "Invalid input",
      },
    };
  }

  const supabase = createClient(cookieStore);
  const result = await projectCommands.transitionTaskStatus(supabase, parseResult.data);

  if (result.ok) {
    revalidatePath(`/[locale]/(protected)/admin/proyectos/${projectId}`, "page");
    revalidatePath(`/[locale]/(protected)/pm/proyectos/${projectId}`, "page");
  }
  return result;
}
```

### Task archive action

```ts
export async function archiveTaskAction(
  taskId: string,
  projectId: string,
  reason?: string
): Promise<CommandResult<{ success: boolean }>> {
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);

  if (session.role !== "admin" && session.role !== "pm") {
    return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized role" } };
  }

  const supabase = createClient(cookieStore);
  const result = await projectCommands.archiveTask(supabase, taskId, reason);

  if (result.ok) {
    revalidatePath(`/[locale]/(protected)/admin/proyectos/${projectId}`, "page");
    revalidatePath(`/[locale]/(protected)/pm/proyectos/${projectId}`, "page");
  }
  return result;
}
```

### Task comment action

```ts
export async function createTaskCommentAction(
  projectId: string,
  taskId: string,
  body: string
): Promise<CommandResult<CreateCommentResult>> {
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);

  // pm_watcher is allowed to comment (advisory capacity)
  if (session.role !== "admin" && session.role !== "pm") {
    return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized role" } };
  }

  const parseResult = CreateCommentSchema.safeParse({
    project_id: projectId,
    target_type: "task",
    target_id: taskId,
    body,
  });
  if (!parseResult.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: parseResult.error.errors[0]?.message ?? "Invalid input",
      },
    };
  }

  const supabase = createClient(cookieStore);
  return commentCommands.createComment(supabase, parseResult.data);
}
```

### Task comment listing action (for lazy loading in TaskDetailSheet)

Because comments are loaded on-demand when a sheet opens (not pre-fetched at page load), a Server Action wrapper is needed for the `listComments` query:

```ts
export async function listTaskCommentsAction(
  taskId: string
): Promise<CollaborationCommentWithAuthor[]> {
  const cookieStore = await cookies();
  await requireSession(cookieStore);
  const supabase = createClient(cookieStore);
  return listComments(supabase, taskId, "task");
}
```

> Add `import { listComments } from "@/lib/comments/queries";` and `import type { CollaborationCommentWithAuthor } from "@/lib/comments/queries";` to the imports in `actions.ts`.

---

## 5. Workspace page modifications (data pre-fetching)

The tasks tab data must be pre-fetched at the Server Component page level so the tab renders immediately without a loading flash. The existing pages at:
- `src/app/[locale]/(protected)/admin/proyectos/[id]/page.tsx`
- `src/app/[locale]/(protected)/pm/proyectos/[id]/page.tsx`

Currently do NOT fetch tasks. Both pages must be modified to additionally call `listProjectTasks(supabase, id)` within the existing `Promise.all` and pass the results to `ProjectWorkspaceShell`.

**Modified `Promise.all` pattern:**
```ts
const [clients, cycles, eligiblePms, eligibleOperators, eligibleClients, initialTasks] =
  await Promise.all([
    listActiveClients(supabase),
    getCompletionCycles(supabase, id),
    listEligiblePmUsers(supabase),
    listEligibleOperators(supabase),
    listEligibleClientMembers(supabase, project.client_id),
    listProjectTasks(supabase, id),  // ← added
  ]);
```

**`ProjectWorkspaceShell` props update:**

Add `initialTasks: TaskWithAssignee[]` to `ProjectWorkspaceShellProps` interface in `project-workspace-shell.tsx`.

The workspace shell replaces:
```tsx
<TabsContent value="tasks" className="outline-hidden">
  <TasksTabPlaceholder />
</TabsContent>
```

With:
```tsx
<TabsContent value="tasks" className="outline-hidden">
  <TasksTab
    project={project}
    initialTasks={initialTasks}
    effectiveCapacity={effectiveCapacity}
    locale={locale}
  />
</TabsContent>
```

The `locale` string is passed from each workspace page through the shell props. Add `locale: string` to `ProjectWorkspaceShellProps`.

The `import { TasksTab }` statement replaces or supplements the `import { TasksTabPlaceholder }` import — the placeholder import can be removed once `TasksTab` is working.

---

## 6. Kanban drag-and-drop implementation notes

### 6.1 Library

The existing `package.json` declares `@hello-pangea/dnd` as a dependency (the community-maintained fork of `react-beautiful-dnd`). Import from it:
```ts
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
```

### 6.2 Hydration safety

`@hello-pangea/dnd` requires client-side rendering. `TaskKanbanBoard` must be a **Client Component** (`"use client"`) and must not be imported directly in a Server Component. The `TasksTab` Client Component imports it without issue.

### 6.3 Disabled drag behavior for PM Watcher

When `effectiveCapacity === "pm_watcher"`:
- Drag handles on `TaskKanbanCard` are visually hidden (`hidden` or `aria-hidden="true"`).
- The `DragDropContext.onDragEnd` handler returns early without calling any server action.
- A `Tooltip` on the card surface reads "Solo lectura — capacidad observador" / "Read-only — Watcher capacity".

### 6.4 Rejected drag handling — error code mapping

On a rejected `transitionTaskStatusAction` call, the UI must:
1. Restore the task card to its original column immediately.
2. Display a Sonner toast with the localized error message mapped from `CommandResult.error.code`:

| Error code | es-MX message | en-US message |
|---|---|---|
| `UNAUTHORIZED` | "No tienes autorización para mover esta tarea." | "You are not authorized to move this task." |
| `INVALID_TRANSITION` | "Este cambio de estado no está permitido para esta tarea." | "This status transition is not allowed for this task." |
| `TASK_TYPE_CONSTRAINT` | "Las solicitudes de cliente no pueden entrar en revisión interna." | "Client requests cannot enter internal review." |
| `NOT_FOUND` | "No se encontró la tarea. Recarga la página." | "Task not found. Please refresh." |
| default | "Error al mover la tarea. Por favor intenta de nuevo." | "Error moving the task. Please try again." |

---

## 7. Information architecture — Task Kanban board layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ TAREAS DEL PROYECTO                                     [+ Nueva Tarea]      │
│ [Estado ▾] [Prioridad ▾] [Tipo ▾] [Asignado a ▾] [Limpiar] | [≡ Lista] [▦ Kanban]  │
├─────────────────────────────────────────────────────────────────────────────┤
│ ⏱ Pendientes (3) │ ◉ En Progreso (2) │ 👁 En Revisión (1) │ ✅ Completadas (5) │ ⚠ Bloqueadas (1) │
│ ┌──────────────┐ │ ┌──────────────┐  │ ┌──────────────┐   │ ┌──────────────┐ │ ┌──────────────┐ │
│ │ Diseño UI    │ │ │ API docs     │  │ │ Copywriting  │   │ │ Wireframes   │ │ │ Integration  │ │
│ │ 🛡 Bloqueante│ │ │ 🔶 Alta      │  │ │ 🟡 Media     │   │ │ 🟢 Baja      │ │ │ ⚠ Bloqueada  │ │
│ │ 📅 15 oct   │ │ │ 📅 12 oct    │  │ │ 📅 20 oct    │   │ │ 📅 01 oct    │ │ │ 📅 10 oct    │ │
│ │ 👤 Ana M.   │ │ │ 👤 Juan R.   │  │ │ 👤 Luis P.   │   │ │ 👤 Sara G.   │ │ │ 👤 Ana M.    │ │
│ └──────────────┘ │ └──────────────┘  │ └──────────────┘   │ └──────────────┘ │ └──────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Design notes:**
- `blocking` priority task card has a **rose-tinted left border accent** (`border-l-4 border-rose-400`) visible in both light and dark mode.
- `blocked` status column header uses **red tinting** on the header strip — distinct from the rose accent on `blocking` cards.
- Kanban columns scroll vertically if the task count exceeds viewport height.
- On mobile (< 768px), the board scrolls horizontally with a minimum column width of 260px.

---

## 8. List view layout

The List view uses a shadcn `Table`:

| Título | Tipo | Estado | Prioridad | Asignado a | Fecha Límite | Acciones |
|--------|------|--------|-----------|-----------|------------|---------|
| Diseño UI | Interno | ⏱ Pendiente | 🛡 Bloqueante | 👤 Ana M. | 15 Oct 2026 | ⋯ |
| Revisión copia | Solicitud | 👁 En revisión | 🔶 Alta | 👤 Juan R. | 12 Oct 2026 | ⋯ |

- `blocking` priority row: rose-tinted left border (`border-l-4 border-rose-400`).
- `blocked` status row: subtle red-tinted background (`bg-red-50/40 dark:bg-red-950/20`).
- Overdue deadline: red text (`text-destructive`).
- Actions column: `DropdownMenu` with "Ver detalles", "Editar", "Cambiar estado", "Archivar".
- Sortable columns: Título, Estado (by sort order), Prioridad (blocking first), Fecha Límite.

---

## 9. Task detail sheet layout

```
┌────────────────────────────────────────────────────┐
│ [← Cerrar]   Diseño de Dashboard   [✏ Editar]    │
│ ⏱ En Progreso | 🛡 Bloqueante | Trabajo Interno   │
├────────────────────────────────────────────────────┤
│ Asignado a: 👤 Ana Morales (PM Lead)               │
│ Fecha límite: 15 oct 2026 · ⏳ 3 días               │
├────────────────────────────────────────────────────┤
│ Cambiar estado: [En Progreso ▾]  (hidden for watcher)│
├────────────────────────────────────────────────────┤
│ Descripción:                                        │
│ Elaborar los componentes del dashboard de KPIs...  │
├────────────────────────────────────────────────────┤
│ Recursos vinculados:                               │
│ 🔗 Mockup Figma  (links open in new tab, HTTPS only)│
├────────────────────────────────────────────────────┤
│ Comentarios (3)                                     │
│ ┌──────────────────────────────────────────┐       │
│ │ 👤 Ana M. · PM Lead · hace 2 horas       │       │
│ │ Listo para revisión de contenidos...     │       │
│ └──────────────────────────────────────────┘       │
│ [Escribe un comentario colaborativo...]  [Comentar]│
└────────────────────────────────────────────────────┘
```

---

## 10. Message catalog specifications

Every user-visible string in this work item must be added with exact key parity to both `messages/es-MX.json` and `messages/en-US.json` under the `tasks` namespace.

### Required `tasks` namespace keys (es-MX shown; en-US must mirror with English equivalents)

```json
{
  "tasks": {
    "tabTitle": "Tareas",
    "newTaskButton": "Nueva Tarea",
    "viewKanban": "Tablero Kanban",
    "viewList": "Vista de Lista",
    "filters": {
      "statusLabel": "Estado",
      "priorityLabel": "Prioridad",
      "typeLabel": "Tipo",
      "assigneeLabel": "Asignado a",
      "allStatuses": "Todos los estados",
      "allPriorities": "Todas las prioridades",
      "allTypes": "Todos los tipos",
      "allAssignees": "Todos los asignados",
      "clearFilters": "Limpiar filtros"
    },
    "taskType": {
      "internal_work": "Trabajo interno",
      "client_request": "Solicitud de cliente",
      "internalDescription": "Trabajo interno del equipo sin intervención del cliente.",
      "clientRequestDescription": "Solicitud vinculada a un cliente externo.",
      "clientRequestOnlyForClientProjects": "Las solicitudes de cliente solo están disponibles en proyectos de cliente."
    },
    "taskStatus": {
      "pending": "Pendiente",
      "in_progress": "En progreso",
      "in_review": "En revisión",
      "completed": "Completada",
      "blocked": "Bloqueada"
    },
    "priority": {
      "low": "Baja",
      "medium": "Media",
      "high": "Alta",
      "blocking": "Bloqueante"
    },
    "kanban": {
      "columnEmpty": "Sin tareas en este estado",
      "dragHandleLabel": "Arrastrar tarea: {title}",
      "columnAriaLabel": "Columna: {status} — {count} tareas",
      "clientRequestNoReview": "Las solicitudes de cliente no pueden entrar en revisión interna.",
      "moveNotAllowed": "Este cambio de estado no está permitido para esta tarea.",
      "unauthorizedMove": "No tienes autorización para mover esta tarea.",
      "movedSuccess": "Tarea movida a {status}.",
      "movedError": "Error al mover la tarea. Por favor intenta de nuevo.",
      "notFound": "No se encontró la tarea. Recarga la página."
    },
    "list": {
      "columns": {
        "title": "Título",
        "type": "Tipo",
        "status": "Estado",
        "priority": "Prioridad",
        "assignee": "Asignado a",
        "deadline": "Fecha Límite",
        "actions": "Acciones"
      },
      "actions": {
        "viewDetails": "Ver detalles",
        "edit": "Editar",
        "changeStatus": "Cambiar estado",
        "archive": "Archivar"
      }
    },
    "detail": {
      "assignedTo": "Asignado a",
      "deadline": "Fecha límite",
      "type": "Tipo",
      "statusLabel": "Cambiar estado",
      "description": "Descripción",
      "resources": "Recursos vinculados",
      "noResources": "Sin recursos vinculados.",
      "hasDeliverables": "Esta tarea tiene entregables de producción vinculados.",
      "editButton": "Editar",
      "closeButton": "Cerrar",
      "ariaLabel": "Detalles de la tarea: {title}"
    },
    "create": {
      "title": "Nueva Tarea",
      "description": "Crea una nueva tarea para este proyecto.",
      "form": {
        "typeLabel": "Tipo de tarea",
        "titleLabel": "Título",
        "titlePlaceholder": "Ej. Diseño de portada para campaña Q4",
        "descriptionLabel": "Descripción",
        "descriptionPlaceholder": "Detalla los objetivos, entregables esperados y contexto del trabajo...",
        "priorityLabel": "Prioridad",
        "assigneeLabel": "Asignado a",
        "assigneePlaceholder": "Selecciona un miembro del equipo...",
        "deadlineLabel": "Fecha y hora límite",
        "submitButton": "Crear Tarea",
        "cancelButton": "Cancelar",
        "submitting": "Creando..."
      },
      "successToast": "Tarea creada exitosamente.",
      "errorToast": "No se pudo crear la tarea. Verifica los datos ingresados."
    },
    "edit": {
      "title": "Editar Tarea",
      "description": "Modifica los campos de la tarea. El tipo de tarea no puede cambiarse.",
      "typeReadOnly": "Tipo de tarea (no editable)",
      "form": {
        "titleLabel": "Título",
        "descriptionLabel": "Descripción",
        "priorityLabel": "Prioridad",
        "assigneeLabel": "Asignado a",
        "deadlineLabel": "Fecha y hora límite",
        "submitButton": "Guardar cambios",
        "cancelButton": "Cancelar",
        "submitting": "Guardando..."
      },
      "successToast": "Tarea actualizada correctamente.",
      "errorToast": "No se pudo actualizar la tarea."
    },
    "archive": {
      "title": "¿Archivar esta tarea?",
      "description": "La tarea se ocultará del espacio de trabajo. Esta acción solo puede revertirse por un administrador.",
      "reasonLabel": "Motivo (opcional)",
      "reasonPlaceholder": "Ingresa el motivo del archivado...",
      "confirmButton": "Archivar",
      "cancelButton": "Cancelar",
      "successToast": "Tarea archivada.",
      "errorToast": "No se pudo archivar la tarea."
    },
    "statusChange": {
      "successToast": "Estado actualizado: {status}.",
      "errorToast": "No se pudo cambiar el estado de la tarea.",
      "notAllowed": "Este cambio de estado no está permitido.",
      "clientRequestNoReview": "Las solicitudes de cliente no pueden entrar en revisión interna."
    },
    "comments": {
      "sectionTitle": "Comentarios",
      "emptyState": "Aún no hay comentarios en esta tarea.",
      "composePlaceholder": "Escribe un comentario colaborativo...",
      "submitButton": "Comentar",
      "submitting": "Enviando...",
      "successToast": "Comentario publicado.",
      "errorToast": "No se pudo publicar el comentario.",
      "advisoryNote": "Los comentarios son discusión colaborativa interna y no constituyen decisiones formales de revisión.",
      "loading": "Cargando comentarios...",
      "authorCapacity": {
        "admin": "Administrador",
        "pm_lead": "PM Lead",
        "pm_watcher": "PM Observador",
        "operator": "Operador"
      }
    },
    "emptyState": {
      "noTasks": "Este proyecto aún no tiene tareas.",
      "noTasksDescription": "Crea la primera tarea para comenzar a gestionar el trabajo del equipo.",
      "createFirstTask": "Crear primera tarea",
      "noFilterResults": "No se encontraron tareas con los filtros seleccionados.",
      "clearFilters": "Limpiar filtros"
    },
    "errors": {
      "unauthorized": "No tienes autorización para realizar esta acción.",
      "invalidTransition": "Este cambio de estado no está permitido para esta tarea.",
      "taskTypeConstraint": "Las solicitudes de cliente no pueden entrar en revisión interna.",
      "notFound": "No se encontró la tarea. Recarga la página.",
      "generic": "Error inesperado. Por favor intenta de nuevo."
    },
    "watcherMode": {
      "readOnlyLabel": "Solo lectura — capacidad observador",
      "cannotMutate": "Los observadores de PM solo pueden leer tareas y agregar comentarios colaborativos."
    },
    "overdue": "Vencida",
    "daysRemaining": "{count} días restantes",
    "dueToday": "Vence hoy",
    "hasDeliverablesBadge": "Con entregables"
  }
}
```

---

## 11. File inventory

### Files to CREATE

| File Path | Responsibility |
|---|---|
| `src/components/shared/projects/project-tasks/tasks-tab.tsx` | Top-level Tasks tab container; manages view mode, filters, and open dialogs |
| `src/components/shared/projects/project-tasks/task-filters.tsx` | Filter bar: status, priority, type, assignee |
| `src/components/shared/projects/project-tasks/task-kanban-board.tsx` | DragDropContext wrapper; handles onDragEnd with server call + state restoration |
| `src/components/shared/projects/project-tasks/task-kanban-column.tsx` | Single Droppable Kanban column with header and task count |
| `src/components/shared/projects/project-tasks/task-kanban-card.tsx` | Draggable task card with priority accent, status badge, assignee, deadline |
| `src/components/shared/projects/project-tasks/task-list-view.tsx` | Sortable Table view with status/priority badges and action menu |
| `src/components/shared/projects/project-tasks/task-list-row.tsx` | Single table row (extracted for readability) |
| `src/components/shared/projects/project-tasks/task-detail-sheet.tsx` | Slide-over Sheet: full task context, status control, comments |
| `src/components/shared/projects/project-tasks/task-status-select.tsx` | Controlled status Select with allowed-transition filtering |
| `src/components/shared/projects/project-tasks/task-priority-badge.tsx` | Priority badge consuming TASK_PRIORITY_MAP |
| `src/components/shared/projects/project-tasks/task-status-badge.tsx` | Status badge consuming TASK_STATUS_MAP |
| `src/components/shared/projects/project-tasks/task-assignee-select.tsx` | Combobox assignee picker from active project members |
| `src/components/shared/projects/project-tasks/task-create-dialog.tsx` | Create task Dialog with React Hook Form + CreateTaskSchema |
| `src/components/shared/projects/project-tasks/task-edit-dialog.tsx` | Edit task Dialog with React Hook Form + UpdateTaskSchema |
| `src/components/shared/projects/project-tasks/task-archive-dialog.tsx` | AlertDialog for task soft-delete with optional reason |
| `src/components/shared/projects/project-tasks/task-comments-section.tsx` | Comment feed + compose form for task-targeted collaboration comments |
| `__tests__/projects/tasks.test.ts` | Unit tests for task Server Actions (create, update, transition, archive, comment) |
| `__tests__/projects/task-workspace.test.tsx` | Component tests: filters, Kanban state restoration, watcher gating |
| `__tests__/projects/task-status-semantics.test.tsx` | Tests asserting blocking priority ≠ blocked status in rendering and actions |

### Files to MODIFY

| File Path | Changes |
|---|---|
| `src/lib/projects/actions.ts` | Add `createTaskAction`, `updateTaskAction`, `transitionTaskStatusAction`, `archiveTaskAction`, `createTaskCommentAction`, `listTaskCommentsAction` |
| `src/components/shared/projects/project-workspace/project-workspace-shell.tsx` | Add `initialTasks: TaskWithAssignee[]` and `locale: string` props; replace `<TasksTabPlaceholder />` with `<TasksTab>` |
| `src/app/[locale]/(protected)/admin/proyectos/[id]/page.tsx` | Add `listProjectTasks(supabase, id)` to `Promise.all`; pass `initialTasks` and `locale` to shell |
| `src/app/[locale]/(protected)/pm/proyectos/[id]/page.tsx` | Add `listProjectTasks(supabase, id)` to `Promise.all`; pass `initialTasks` and `locale` to shell |
| `messages/es-MX.json` | Add `tasks` namespace with all keys (full catalog above) |
| `messages/en-US.json` | Add `tasks` namespace with all keys (English equivalents, 100% parity) |

### Files to NOT MODIFY (referenced but unchanged)

- `src/lib/projects/queries.ts` — all required queries already present.
- `src/lib/projects/commands.ts` — all required commands already present.
- `src/lib/projects/schemas.ts` — all required schemas already present.
- `src/lib/comments/queries.ts` — `listComments` already present.
- `src/lib/comments/commands.ts` — `createComment` already present.
- `src/lib/comments/schemas.ts` — `CreateCommentSchema` already present.
- `src/lib/status-maps.ts` — `TASK_STATUS_MAP`, `TASK_PRIORITY_MAP` already present.
- `src/lib/database.types.ts` — **must not be edited manually**.

---

## 12. Responsive and accessibility specifications

### 12.1 Viewport responsiveness

| Component | Desktop (≥ 1024px) | Tablet (768–1023px) | Mobile (< 768px) |
|---|---|---|---|
| **Kanban Board** | 5 columns, full labels | 3–4 visible columns with horizontal scroll | Horizontal scroll, 260px min-width columns |
| **List View** | Full table with all columns | Compact table (assignee + actions in dropdown) | Stacked rows or card-style with key data |
| **TaskDetailSheet** | Fixed `side="right"`, 480–560px wide | `side="right"`, 90% width | Full-screen `side="bottom"` |
| **TaskCreateDialog** | Single-column form in 560px dialog | Same | Full-screen dialog or Sheet |
| **Task Filter Bar** | Horizontal row of selects | Horizontal row, scrollable | Collapsible filter panel |

### 12.2 Accessibility contracts (WCAG 2.1 AA)

1. **Touch Targets:** All task cards, Kanban drag handles, status selects, and action buttons must meet 44×44px minimum touch target.
2. **Keyboard Operability:**
   - Tab through all task cards and action controls.
   - Escape closes the detail Sheet and all dialogs without submitting.
   - `@hello-pangea/dnd` supports keyboard-driven reordering (Space to lift, arrow keys to move, Space to drop).
   - Focus returns to the triggering element when a dialog/sheet closes.
3. **Screen Readers & ARIA:**
   - `aria-label` on drag handles: "Mover tarea {title}" / "Move task {title}".
   - `aria-label` on Kanban columns: "Columna: {status} — {count} tareas" / "Column: {status} — {count} tasks".
   - `aria-live="polite"` region for status transition toast messages.
   - `role="status"` on loading spinners.
4. **Color Contrast:** `blocking` priority rose hue and `blocked` status red must meet 4.5:1 text contrast in both themes. Never communicate status or priority via color alone — always include icon + text label.
5. **Non-color identification:** Task cards with `blocking` priority use both a rose left-border accent AND a `ShieldCheck` icon to be distinguishable in low-contrast or color-blind contexts.

---

## 13. Verification matrix and acceptance criteria

### 13.1 Automated test suite

```bash
# Run all project and task tests
npm run test -- __tests__/projects/

# Typecheck and lint
npm run typecheck
npm run lint
```

#### Required automated test coverage

**1. Task Server Actions (`__tests__/projects/tasks.test.ts`):**
- `createTaskAction`:
  - Rejects actor with role `client` or `operator`.
  - Returns `VALIDATION_ERROR` when required fields are missing.
  - Accepts valid `internal_work` task with all required fields.
  - Accepts valid `client_request` task on a client project.
- `updateTaskAction`:
  - Rejects actor with unauthorized role.
  - Accepts partial updates (priority only, deadline only, etc.).
- `transitionTaskStatusAction`:
  - Rejects unauthorized role actor.
  - Returns the mapped error for `INVALID_TRANSITION` from RPC.
- `archiveTaskAction`:
  - Rejects unauthorized role.
  - Accepts optional reason string.
- `createTaskCommentAction`:
  - Accepts `pm_watcher` role (advisory comments allowed for `pm` role).
  - Rejects `client` role.
  - Validates `body` is non-empty.
  - Rejects `body` exceeding 5000 chars.

**2. Task workspace component (`__tests__/projects/task-workspace.test.tsx`):**
- `TaskFilters`: filter by status renders only matching tasks; clear filters resets all.
- `TaskKanbanBoard`: when `transitionTaskStatusAction` returns `ok: false`, the card is restored to its original column and a toast error appears.
- `TaskKanbanBoard`: `client_request` task dragged to `in_review` column is rejected without calling server action.
- `TasksTab` with `effectiveCapacity="pm_watcher"`: "Nueva Tarea" button is not rendered; drag handles are hidden; archive actions absent from dropdown.
- `TasksTab` with `effectiveCapacity="pm_lead"`: all mutation controls are visible.

**3. Status/priority semantic tests (`__tests__/projects/task-status-semantics.test.tsx`):**
- `TaskStatusBadge` with `status="blocked"` renders `AlertTriangle` icon — **not** `ShieldCheck`.
- `TaskPriorityBadge` with `priority="blocking"` renders `ShieldCheck` icon — **not** `AlertTriangle`.
- `TaskKanbanCard` with `priority="blocking"` has `border-rose-400` class applied.
- `TaskKanbanCard` with `status="blocked"` in the `blocked` column does NOT have `border-rose-400`.
- Both badges include a text label (accessibility: non-color identification).
- `TASK_STATUS_MAP.blocked.icon` is not the same reference as `TASK_PRIORITY_MAP.blocking.icon`.

### 13.2 Manual localhost verification journeys

| Journey | Role | Steps | Expected Outcome |
|---|---|---|---|
| **J1: Create task (internal)** | `pm_lead` | Open any project workspace → Tasks tab → "Nueva Tarea" → Select "Trabajo Interno" → Fill all fields → Submit. | Task appears in `pending` Kanban column with correct priority badge and assignee avatar. |
| **J2: Client request restricted on internal project** | `pm_lead` | Open an **internal** project → Tasks tab → "Nueva Tarea". | "Solicitud de cliente" type option is disabled with tooltip. |
| **J3: Kanban drag — valid move** | `pm_lead` | Drag a `pending` task card to `in_progress`. | Card moves to column; toast "Estado actualizado: En progreso."; server state reflects change on refresh. |
| **J4: Kanban drag — client_request to in_review rejected** | `pm_lead` | Drag a `client_request` task card to the `in_review` column. | Card snaps back; toast "Las solicitudes de cliente no pueden entrar en revisión interna." |
| **J5: Status change via select** | `pm_lead` | Open task detail sheet → Use status select to move from `pending` to `blocked`. | Task moves to `blocked` status; badge changes to red AlertTriangle. |
| **J6: blocking vs blocked visual distinction** | `pm_lead` | Create a task with `blocking` priority. Also move another task to `blocked` status. | `blocking` task: rose left-border accent + ShieldCheck badge. `blocked` task: red AlertTriangle badge in blocked column. They share no icon, no color, and no label text. |
| **J7: List view sort and filter** | `pm_lead` | Switch to List view → Sort by priority → Filter by assignee. | Rows reorder correctly; filtered rows match selected assignee; `blocking` rows have rose border-left. |
| **J8: PM Watcher read-only** | `pm_watcher` | Sign in as PM Watcher → Open project workspace → Tasks tab. | "Nueva Tarea" button absent; drag handles hidden; task detail sheet shows no Edit button or Archive option; comment compose form is visible (advisory comments permitted). |
| **J9: Post task comment** | `pm_lead` | Open task detail sheet → Write a comment → Submit. | Comment appears in feed with author name, capacity badge (e.g. "PM Lead"), and timestamp. No "Aprobado" or "Cambios solicitados" labels. |
| **J10: Mobile Kanban scroll** | `pm_lead` | View Tasks tab at 375px viewport width. | Kanban columns scroll horizontally; touch targets ≥ 44px; task cards are readable without horizontal data trapping. |

---

## 14. Stop conditions and explicit boundaries

| Discovery | Required response |
|---|---|
| `transition_task_status` RPC returns an error code not mapped in the UI error map | Add the mapping. Never expose raw RPC error text to the user. |
| `@hello-pangea/dnd` is not present in `package.json` or causes a build error | Fall back to menu-only status transitions. Do not add an alternative DnD library without authorization. |
| A `client_request` task's status transition to `in_review` appears to succeed on the server | Stop. Report as a security/invariant defect. The RPC must enforce this; investigate before proceeding. |
| The task workspace needs a query not available in `listProjectTasks` (e.g. operator-specific view, audit log) | Stop. Return a stop condition report. Do not query raw audit tables or add broad selects. |
| Implementation requires edits to `database.types.ts` or a new SQL migration | Stop. Report the precise missing boundary and obtain separately authorized schema work. |
| A feature for deliverable submission, formal review, or client task completion is discovered in scope | Stop. Defer strictly to S04-06/S04-07/E7. |
| A request requires the Operator execution drawer or mobile-specific agenda view | Stop. Defer to E6. |
| `actions.ts` grows beyond 400 lines after additions | Split task actions into `src/lib/projects/task-actions.ts` and import from there, keeping `actions.ts` as the re-export barrel. |

---

## 15. Definition of done

S04-04 is complete when:

- [ ] `TasksTabPlaceholder` is replaced by the fully operational `TasksTab` component in `ProjectWorkspaceShell`.
- [ ] PM Leads and Admins can create, edit, archive, and view tasks in both Kanban and List modes.
- [ ] All task mutations (create, update, transition, archive) go through typed Server Actions calling the existing command layer; no direct table writes occur in components.
- [ ] `blocking` **priority** and `blocked` **status** are visually and semantically distinct at every touch point. They share no icon, no identical color class, and no shared label text.
- [ ] Task status transitions respect all type constraints: `client_request` tasks cannot enter `in_review`. Rejected moves restore authoritative server state and render a localized, non-leaking error.
- [ ] PM Watcher capacity: no create/edit/archive/status-change affordances exist in the UI; drag handles are hidden; advisory comments are permitted.
- [ ] Task-targeted collaboration comments use the `create_collaboration_comment` RPC, display `author_capacity_snapshot` label, and are clearly not formal review decisions.
- [ ] Both workspace pages (admin and pm) pre-fetch tasks with `listProjectTasks` and pass them as `initialTasks` to the shell, eliminating a loading state on task tab selection.
- [ ] All user-visible strings are localized in `messages/es-MX.json` and `messages/en-US.json` with 100% key parity under the `tasks` namespace.
- [ ] Automated tests pass: task Server Actions, Kanban state restoration, watcher authorization, and `blocking`/`blocked` semantic distinction.
- [ ] The Tasks UI is keyboard-operable and usable at 375px mobile viewport without relying solely on drag-and-drop.
- [ ] `npm run typecheck` and `npm run lint` pass without new errors or suppressed rules.
- [ ] `CHANGELOG.md` is updated per the `/update-changelog` skill as the final step.

---

*Spec written: 2026-08-19. Authority: Sprint S04 Plan (S04-04).*
