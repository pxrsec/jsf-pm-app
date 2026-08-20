# S04-05 — Implement Project Completion, Reopening, and Visible Audit Context
**Sprint:** S04
**Work Item:** S04-05
**Status:** Ready for implementation
**Last reviewed:** 2026-08-19
**Spec authority:** Sprint plan `s04-e04-e05-project-workspace-and-production-deliverable-lifecycle-sprint-plan.md`, Section 5 (work item S04-05).
**Dependencies:** S04-01 (shadcn/ui + token-based theming), S04-02 (command boundary), S04-03 (project workspace shell, header, status dialog scaffold), S04-04 (task workspace).
---## 1. Purpose and scope
This specification defines the full technical, architectural, and visual blueprint for **S04-05: Project Completion, Reopening, and Visible Audit Context**.

S04-05 upgrades the project lifecycle controls that were partially scaffolded in S04-03 (the `ProjectStatusDialog` and `ProjectHeader` dropdown) to deliver the full semantics required by the sprint plan:

1. **Completion flow** — a readiness preflight that surfaces unfinished-work counts from the server as a warning (never a hard block), followed by a deliberate `AlertDialog` confirmation that passes `confirm_unfinished: true` when the actor explicitly overrides the warning.
2. **Completed-state presentation** — a read-oriented workspace banner and suppressed task creation controls when `project.status === "completed"`. General project metadata (e.g. internal description, Drive URL) remains editable via the existing edit dialog.
3. **Reopening flow** — a mandatory non-empty reason field (1–500 chars), an `AlertDialog` confirmation, calling the `reopenProjectAction` Server Action (which calls `transitionProjectStatus` under the hood with `next_status: "in_progress"` and `reopen_reason`), and refreshing the workspace after the command succeeds.
4. **Audit / cycle history upgrade** — surface all available fields from `project_completion_cycles_view` (already fetched as `cycles` in both workspace pages) in a structured, readable card inside the Overview tab.

### In scope
1. **`src/lib/projects/lifecycle-actions.ts`** — new Server Action module housing `getCompletionReadinessAction` and `reopenProjectAction`, re-exported from `src/lib/projects/actions.ts` to keep both modules well under the 400-line limit.
2. **`getCompletionReadinessAction`** — Server Action calling `getCompletionReadiness` command (`get_project_completion_readiness` RPC).
3. **`reopenProjectAction`** — Server Action calling `transitionProjectStatus` command (`transition_project_status` RPC) with `next_status: "in_progress"` and validated `reopen_reason`.
4. **`ProjectCompleteDialog`** — new component; renders readiness summary, warns about unfinished work, requires confirmation, then calls `transitionProjectStatusAction` with `next_status: "completed"` and `confirm_unfinished: true`.
5. **`ProjectReopenDialog`** — new component; requires a non-empty `reopen_reason` (min 1, max 500 chars), calls `reopenProjectAction`.
6. **`CompletedProjectBanner`** — read-only informational banner shown when `project.status === "completed"`, with a "Reopen" CTA for non-watcher actors.
7. **`ProjectHeader` upgrade** — add "Complete Project" and "Reopen Project" as context-aware dropdown items; suppress invalid items for completed status; retain "Editar Proyecto" for metadata maintenance.
8. **`ProjectStatusActionType` extension** — add `"complete"` and `"reopen"` to the exported union. The shell routes these to the new dedicated dialogs; `ProjectStatusDialog` itself does not handle them.
9. **Completion cycles history upgrade** in `ProjectOverviewTab` — display all available `ProjectCompletionCyclesView` fields (completed_at, reopened_at, cycle_duration_days, reopen_reason, unfinished_task_count, override_confirmed).
10. **Tasks tab gate** — hide "Nueva Tarea" button when `project.status === "completed"`.
11. **Message catalog additions** — new keys under `projects.workspace.completion`, `projects.workspace.reopen`, `projects.workspace.completedBanner`, `projects.workspace.header`, and `projects.workspace.overview` in both locales.
12. **Focused automated tests** — new `__tests__/projects/project-lifecycle.test.tsx`.

### Explicitly out of scope for S04-05
- Deliverable completion state (S04-06/S04-07).
- Task-level status transitions (S04-04).
- Client portal, client review actions (E7). Operator portal (E6).
- Archive/restore/cancel flows — already implemented in S04-03.
- Notification dispatch or provider activation.
- Any schema changes, RLS policy changes, or edits to `database.types.ts`.
- A full "Activity" tab implementation.

---

## 2. Baseline and architectural contracts

### 2.1 Established data layer (do not modify)

**Commands (`src/lib/projects/commands.ts`) — all already present:**

| Function | RPC | Notes |
|---|---|---|
| `transitionProjectStatus(supabase, input)` | `transition_project_status` | Accepts `next_status: "completed" \| "in_progress"`, `confirm_unfinished`, `reopen_reason`. Authorized for PM Lead & Admin. |
| `getCompletionReadiness(supabase, projectId)` | `get_project_completion_readiness` | Returns `ProjectCompletionReadiness`. Authorized for PM Lead & Admin. |
| `recoverProjectStatus(supabase, input)` | `recover_project_status` | Admin-only emergency override RPC (used for administrative entity recovery, not standard lifecycle reopening). |

**Exported type `ProjectCompletionReadiness` (from `commands.ts`):**
```ts
export type ProjectCompletionReadiness = {
  project_id: string;
  is_ready: boolean;
  unfinished_task_count: number;
  unfinished_tasks: Array<{
    id: string;
    title: string;
    status: string;
    assignee_id: string;
  }>;
  unfinished_deliverable_count: number;
  unfinished_deliverables: Array<{
    id: string;
    title: string;
    status: string;
    workflow_type: string;
    assignee_id: string;
  }>;
};
```

**Schemas (`src/lib/projects/schemas.ts`) — already present:**

| Schema | Key fields |
|---|---|
| `TransitionProjectStatusSchema` | `{ project_id, next_status, confirm_unfinished?, reopen_reason? }` |
| `RecoverProjectStatusSchema` | `{ project_id, target_status, reason }` — admin recovery only |

**Queries (`src/lib/projects/queries.ts`) — already present:**
- `getCompletionCycles(supabase, projectId)` → `ProjectCompletionCyclesView[]`
- Both workspace pages already fetch cycles in `Promise.all` and pass them to `ProjectWorkspaceShell`.

**`ProjectCompletionCyclesView` shape (from `database.types.ts`):**
```ts
export type ProjectCompletionCyclesView = {
  project_id: string | null;
  project_name: string | null;
  cycle_number: number | null;
  completed_at: string | null;
  completed_by: string | null; // UUID
  unfinished_task_count: number | null;
  unfinished_deliverable_count: number | null;
  override_confirmed: boolean | null;
  reopened_at: string | null;
  reopened_by: string | null; // UUID
  reopen_reason: string | null;
  cycle_duration_days: number | null;
  current_completed_at: string | null;
  current_project_status: Database["public"]["Enums"]["project_status"] | null;
};
```
*Note: The view exposes actor UUIDs (`completed_by`, `reopened_by`) rather than joined profile names. Render only available columns without ad-hoc joins.*

**Existing Server Actions (`src/lib/projects/actions.ts`):**
- `transitionProjectStatusAction(rawInput)` — handles standard transitions.
- `getCompletionReadinessAction` and `reopenProjectAction` will live in `src/lib/projects/lifecycle-actions.ts` and be re-exported from `actions.ts`.

### 2.2 Authorization matrix

| Actor | Complete project | Reopen project | Edit metadata | See readiness preflight | See completed banner | See cycles history |
|---|---|---|---|---|---|---|
| **admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **pm_lead** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **pm_watcher** | ❌ (UI hidden) | ❌ (UI hidden) | ❌ (UI hidden) | ✅ read-only | ✅ | ✅ |

*Hiding a button is UX only. Server Actions enforce the actual authorization boundary.*

### 2.3 Status transitions relevant to S04-05

| From | Action | Command / next_status | Authorized roles |
|---|---|---|---|
| `planning`, `in_progress`, `paused` | Complete | `transition_project_status` → `next_status: "completed"`, `confirm_unfinished: true` | `pm_lead`, `admin` |
| `completed` | Reopen | `transition_project_status` → `next_status: "in_progress"`, `reopen_reason: reason` | `pm_lead`, `admin` |

## 3. Component architecture

### 3.1 New components and modules

```text
src/lib/projects/
└── lifecycle-actions.ts            ← New server actions module (getCompletionReadinessAction, reopenProjectAction)

src/components/shared/projects/project-lifecycle/
├── project-complete-dialog.tsx     ← Completion preflight + AlertDialog confirmation
└── project-reopen-dialog.tsx       ← Reopen reason form + AlertDialog confirmation

src/components/shared/projects/project-workspace/
└── completed-project-banner.tsx    ← Read-only banner for completed state
```

The `project-lifecycle/` directory is new. It holds completion/reopening lifecycle dialogs that are shared between `/admin/proyectos/[id]` and `/pm/proyectos/[id]`. Do not place them inside `project-workspace/` to avoid conflating workspace presentation with lifecycle-mutation components.

### 3.2 Existing files to modify

| File | Summary of change |
|---|---|
| `src/lib/projects/actions.ts` | Re-export `getCompletionReadinessAction` and `reopenProjectAction` from `lifecycle-actions.ts` |
| `project-status-dialog.tsx` | Extend `ProjectStatusActionType` union with `"complete"` and `"reopen"` |
| `project-workspace-shell.tsx` | Add `isCompleteOpen`/`isReopenOpen` state; route new actions; render new dialogs and banner |
| `project-header.tsx` | Add "Complete Project" and "Reopen Project" dropdown items; suppress cancel for completed status; retain edit button |
| `project-overview-tab.tsx` | Upgrade cycles history card with all available `ProjectCompletionCyclesView` fields |
| `tasks-tab.tsx` | Gate "Nueva Tarea" button on `project.status !== "completed"` |
| `messages/es-MX.json` | New keys under `projects.workspace.completion`, `.reopen`, `.completedBanner`, `.header`, `.overview` |
| `messages/en-US.json` | Mirror all new keys with English equivalents |

---

## 4. New Server Actions (`src/lib/projects/lifecycle-actions.ts`)

To preserve the repository's 400-line file limit (since `src/lib/projects/actions.ts` is currently at ~383 lines), create `src/lib/projects/lifecycle-actions.ts` and re-export the actions from `actions.ts`.

```ts
"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import * as projectCommands from "@/lib/projects/commands";
import type { CommandResult } from "@/lib/projects/errors";
import type { ProjectCompletionReadiness } from "@/lib/projects/commands";

export const ReopenProjectSchema = z.object({
  project_id: z.string().uuid("Invalid project ID"),
  reopen_reason: z
    .string()
    .trim()
    .min(1, "Reopen reason is required")
    .max(500, "Reopen reason cannot exceed 500 characters"),
});

export type ReopenProjectInput = z.infer<typeof ReopenProjectSchema>;

// ── Completion Readiness Preflight ──────────────────────────────────────────

export async function getCompletionReadinessAction(
  projectId: string,
): Promise<CommandResult<ProjectCompletionReadiness>> {
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);

  if (session.role !== "admin" && session.role !== "pm") {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized role" },
    };
  }

  const supabase = createClient(cookieStore);
  return projectCommands.getCompletionReadiness(supabase, projectId);
}

// ── Reopen Project Action ───────────────────────────────────────────────────

export async function reopenProjectAction(
  rawInput: ReopenProjectInput,
): Promise<CommandResult<projectCommands.TransitionResult>> {
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);

  if (session.role !== "admin" && session.role !== "pm") {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized role" },
    };
  }

  const parseResult = ReopenProjectSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: parseResult.error.issues[0]?.message ?? "Invalid input",
      },
    };
  }

  const supabase = createClient(cookieStore);
  const result = await projectCommands.transitionProjectStatus(supabase, {
    project_id: parseResult.data.project_id,
    next_status: "in_progress",
    reopen_reason: parseResult.data.reopen_reason,
    confirm_unfinished: false,
  });

  if (result.ok) {
    revalidatePath(
      `/[locale]/(protected)/admin/proyectos/${rawInput.project_id}`,
      "page",
    );
    revalidatePath(
      `/[locale]/(protected)/pm/proyectos/${rawInput.project_id}`,
      "page",
    );
    revalidatePath("/[locale]/(protected)/admin/proyectos", "page");
    revalidatePath("/[locale]/(protected)/pm/proyectos", "page");
  }

  return result;
}
```

---

## 5. ProjectCompleteDialog component

**File:** `src/components/shared/projects/project-lifecycle/project-complete-dialog.tsx`  
**Type:** Client Component (`"use client"`)

### 5.1 Props
```ts
interface ProjectCompleteDialogProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}
```

### 5.2 Internal state
```ts
const [phase, setPhase] = useState<"loading" | "ready" | "fetch-error">("loading");
const [readiness, setReadiness] = useState<ProjectCompletionReadiness | null>(null);
const [isSubmitting, setIsSubmitting] = useState(false);
const [errorMessage, setErrorMessage] = useState<string | null>(null);
```

### 5.3 Mount behavior
When `isOpen` becomes `true`:
1. Set `phase = "loading"` and `readiness = null`.
2. Call `getCompletionReadinessAction(projectId)`.
3. On success: set `readiness = result.data`, `phase = "ready"`.
4. On failure: set `phase = "fetch-error"` and display a safe localized error message. Do not close the dialog.

When `isOpen` becomes `false`, reset `phase` to `"loading"` and `errorMessage` to `null`.

### 5.4 Readiness summary display (when `phase === "ready"`)
- **When `readiness.is_ready === true`:**
  - Green `CheckCircle` icon.
  - Heading: `t("completion.readyTitle")`.
  - Body: `t("completion.readyDescription")`.
- **When `readiness.is_ready === false`:**
  - Amber `AlertTriangle` icon in a warning banner.
  - Body: `t("completion.unfinishedDescription", { taskCount: readiness.unfinished_task_count, deliverableCount: readiness.unfinished_deliverable_count })`.
  - Compact unordered list of at most the first 5 `readiness.unfinished_tasks` by title only.
  - If there are more than 5 tasks: `t("completion.unfinishedTasksMore", { count: total - 5 })`.

*Critical rule: The Confirm button is always enabled when `phase === "ready"`, regardless of `is_ready`. The warning informs; it does not block. The transactional command re-checks authoritatively at submission time.*

### 5.5 Confirmation
```ts
const result = await transitionProjectStatusAction({
  project_id: projectId,
  next_status: "completed",
  confirm_unfinished: true, // explicit override confirmed by user
});
```
- On `result.ok === true`: call `onClose()`, then `router.refresh()`.
- On `result.ok === false`: set `errorMessage` to the mapped localized message. Do not close.

---

## 6. ProjectReopenDialog component

**File:** `src/components/shared/projects/project-lifecycle/project-reopen-dialog.tsx`  
**Type:** Client Component (`"use client"`)

### 6.1 Props
```ts
interface ProjectReopenDialogProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}
```

### 6.2 Internal state
```ts
const [reason, setReason] = useState("");
const [reasonError, setReasonError] = useState<string | null>(null);
const [isSubmitting, setIsSubmitting] = useState(false);
const [errorMessage, setErrorMessage] = useState<string | null>(null);
```

### 6.3 Client-side validation
- `reason.trim().length < 1`: set `reasonError = t("reopen.reasonRequired")`. Do not call Server Action.
- `reason.length > 500`: disable Confirm button and show `t("reopen.reasonTooLong")`.

### 6.4 Form
- shadcn `Textarea` bound to `reason`.
- Character counter `{reason.length}/500` below the textarea.

### 6.5 Submission
```ts
const result = await reopenProjectAction({
  project_id: projectId,
  reopen_reason: reason.trim(),
});
```
- On `result.ok === true`: call `onClose()`, reset state, `router.refresh()`.
- On `result.ok === false`: set `errorMessage` to the mapped localized message. Do not close.

---

## 7. Shell, header, and banner updates

### 7.1 `ProjectStatusActionType` extension
In `src/components/shared/projects/project-workspace/project-status-dialog.tsx`, extend the exported union type only:
```ts
export type ProjectStatusActionType =
  | "pause"
  | "resume"
  | "cancel"
  | "archive"
  | "restore"
  | "complete"    // routed to ProjectCompleteDialog by shell
  | "reopen";     // routed to ProjectReopenDialog by shell
```

### 7.2 `ProjectWorkspaceShell` additions
Add state variables and routing handler:
```ts
const [isCompleteOpen, setIsCompleteOpen] = useState(false);
const [isReopenOpen, setIsReopenOpen] = useState(false);

const handleStatusDialog = (action: ProjectStatusActionType) => {
  if (action === "complete") {
    setIsCompleteOpen(true);
  } else if (action === "reopen") {
    setIsReopenOpen(true);
  } else {
    setStatusAction(action);
  }
};
```
Pass `onOpenStatusDialog={handleStatusDialog}` to `<ProjectHeader>`.

Render `<CompletedProjectBanner>` above `<Tabs>` when `project.status === "completed"`.  
Render `<ProjectCompleteDialog>` and `<ProjectReopenDialog>` at the bottom of the shell.

### 7.3 `CompletedProjectBanner`
**File:** `src/components/shared/projects/project-workspace/completed-project-banner.tsx`  
**Type:** Client Component (`"use client"`)

```ts
interface CompletedProjectBannerProps {
  completedAt: string | null;
  effectiveCapacity: "admin" | "pm_lead" | "pm_watcher";
  onReopenClick: () => void;
}
```
- Green-tinted container (`bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4`).
- `role="status"` on wrapper.
- `CheckCircle` icon in green.
- Shows completed date formatted with `format.dateTime`.
- "Reabrir Proyecto" button (`variant="outline"`, `size="sm"`) shown only when `effectiveCapacity !== "pm_watcher"`.

### 7.4 `ProjectHeader` changes
- Add "Complete Project" dropdown item: visible when `project.status !== "completed" && project.status !== "cancelled" && !isWatcher`.
- Add "Reopen Project" dropdown item: visible when `project.status === "completed" && !isWatcher`.
- Suppress "Cancel Project" when `project.status === "completed"`.
- **Edit button retention:** The "Editar Información" button remains enabled for non-watchers on completed projects so project metadata (e.g. internal description, Drive folder URL) can be maintained without reopening.

### 7.5 `TasksTab` gate for completed projects
In `src/components/shared/projects/project-tasks/tasks-tab.tsx`, hide the "Nueva Tarea" button when `project.status === "completed"`:
```tsx
{!isWatcher && project.status !== "completed" && (
  <Button onClick={() => setIsCreateOpen(true)} size="sm">
    {t("newTaskButton")}
  </Button>
)}
```

---

## 8. Error code mapping

| Error code | es-MX | en-US |
|---|---|---|
| `UNAUTHORIZED` | "No tienes autorización para realizar esta acción." | "You are not authorized to perform this action." |
| `INVALID_TRANSITION` | "Este cambio de estado no está permitido desde el estado actual del proyecto." | "This status transition is not allowed from the project's current state." |
| `UNFINISHED_WORK` | "El proyecto tiene trabajo sin terminar. Confirma para continuar de todas formas." | "The project has unfinished work. Confirm to proceed anyway." |
| `NOT_FOUND` | "No se encontró el proyecto. Recarga la página." | "Project not found. Please refresh the page." |
| `REASON_REQUIRED` | "El motivo de reapertura es obligatorio." | "A reopen reason is required." |
| `VALIDATION_FAILED` | "Los datos enviados no son válidos. Verifica el formulario." | "The submitted data is invalid. Please check the form." |
| `default` | "Error inesperado. Por favor intenta de nuevo." | "Unexpected error. Please try again." |

---

## 9. ProjectOverviewTab — completion cycles upgrade

Upgrade the existing cycles card in `project-overview-tab.tsx` to render all available `ProjectCompletionCyclesView` fields:

| Field | Display rule |
|---|---|
| `cycle_number` | "Ciclo #{number}" header |
| `completed_at` | Formatted date. Label: "Completado el {date}" |
| `cycle_duration_days` | If not null: "Duración: {N} días". If null: omit line. |
| `unfinished_task_count` / `override_confirmed` | If `override_confirmed`: display badge or note indicating completion with unfinished work. |
| `reopened_at` | If not null: "Reabierto el {date}". If null: show "Ciclo activo" badge. |
| `reopen_reason` | If not null: show in italic `<p>`. |

---

## 10. Message catalog specifications

Add to `messages/es-MX.json`:
```json
{
  "projects": {
    "workspace": {
      "completion": {
        "dialogTitle": "Completar Proyecto",
        "dialogDescription": "Revisa el estado del trabajo antes de completar el proyecto.",
        "loadingReadiness": "Verificando estado del proyecto...",
        "readyTitle": "El proyecto está listo para completarse.",
        "readyDescription": "No hay trabajo pendiente sin terminar.",
        "unfinishedTitle": "Hay trabajo sin terminar",
        "unfinishedDescription": "Hay {taskCount} tarea(s) sin completar y {deliverableCount} entregable(s) pendiente(s). Puedes completar el proyecto de todas formas, pero el trabajo sin terminar quedará en el historial.",
        "unfinishedTasksLabel": "Tareas sin completar:",
        "unfinishedTasksMore": "...y {count} más",
        "confirmButton": "Completar Proyecto",
        "cancelButton": "Cancelar",
        "submitting": "Completando...",
        "successToast": "Proyecto completado exitosamente.",
        "errors": {
          "unauthorized": "No tienes autorización para completar este proyecto.",
          "invalidTransition": "Este cambio de estado no está permitido desde el estado actual del proyecto.",
          "notFound": "No se encontró el proyecto. Recarga la página.",
          "generic": "Error al completar el proyecto. Por favor intenta de nuevo."
        }
      },
      "reopen": {
        "dialogTitle": "Reabrir Proyecto",
        "dialogDescription": "Para reabrir el proyecto, escribe el motivo. Este registro quedará en el historial de ciclos.",
        "reasonLabel": "Motivo de reapertura",
        "reasonRequired": "El motivo de reapertura es obligatorio.",
        "reasonTooLong": "El motivo no puede exceder 500 caracteres.",
        "reasonPlaceholder": "Ej. El cliente solicitó revisiones adicionales al alcance del proyecto...",
        "confirmButton": "Reabrir Proyecto",
        "cancelButton": "Cancelar",
        "submitting": "Reabriendo...",
        "successToast": "Proyecto reabierto exitosamente.",
        "errors": {
          "unauthorized": "No tienes autorización para reabrir este proyecto.",
          "invalidTransition": "No es posible reabrir el proyecto desde su estado actual.",
          "reasonRequired": "Debes proporcionar un motivo para reabrir el proyecto.",
          "notFound": "No se encontró el proyecto. Recarga la página.",
          "generic": "Error al reabrir el proyecto. Por favor intenta de nuevo."
        }
      },
      "completedBanner": {
        "title": "Proyecto Completado",
        "completedOn": "Este proyecto fue completado el {date}.",
        "reopenButton": "Reabrir Proyecto"
      },
      "header": {
        "completeProject": "Completar Proyecto",
        "reopenProject": "Reabrir Proyecto"
      },
      "overview": {
        "cycleActiveBadge": "Ciclo activo",
        "completedOn": "Completado el {date}",
        "cycleDuration": "Duración: {days} días",
        "reopenedOn": "Reabierto el {date}"
      }
    }
  }
}
```

Mirror exactly in `messages/en-US.json`:
```json
{
  "projects": {
    "workspace": {
      "completion": {
        "dialogTitle": "Complete Project",
        "dialogDescription": "Review work status before completing the project.",
        "loadingReadiness": "Checking project status...",
        "readyTitle": "The project is ready to be completed.",
        "readyDescription": "No unfinished work remains.",
        "unfinishedTitle": "There is unfinished work",
        "unfinishedDescription": "There are {taskCount} unfinished task(s) and {deliverableCount} pending deliverable(s). You can still complete the project, but the unfinished work will remain in the record.",
        "unfinishedTasksLabel": "Unfinished tasks:",
        "unfinishedTasksMore": "...and {count} more",
        "confirmButton": "Complete Project",
        "cancelButton": "Cancel",
        "submitting": "Completing...",
        "successToast": "Project completed successfully.",
        "errors": {
          "unauthorized": "You are not authorized to complete this project.",
          "invalidTransition": "This status transition is not allowed from the project's current state.",
          "notFound": "Project not found. Please refresh the page.",
          "generic": "Error completing the project. Please try again."
        }
      },
      "reopen": {
        "dialogTitle": "Reopen Project",
        "dialogDescription": "To reopen the project, provide a reason. This will be recorded in the completion cycle history.",
        "reasonLabel": "Reopen reason",
        "reasonRequired": "A reopen reason is required.",
        "reasonTooLong": "The reason cannot exceed 500 characters.",
        "reasonPlaceholder": "e.g. Client requested additional scope revisions...",
        "confirmButton": "Reopen Project",
        "cancelButton": "Cancel",
        "submitting": "Reopening...",
        "successToast": "Project reopened successfully.",
        "errors": {
          "unauthorized": "You are not authorized to reopen this project.",
          "invalidTransition": "This project cannot be reopened from its current state.",
          "reasonRequired": "You must provide a reason to reopen the project.",
          "notFound": "Project not found. Please refresh the page.",
          "generic": "Error reopening the project. Please try again."
        }
      },
      "completedBanner": {
        "title": "Project Completed",
        "completedOn": "This project was completed on {date}.",
        "reopenButton": "Reopen Project"
      },
      "header": {
        "completeProject": "Complete Project",
        "reopenProject": "Reopen Project"
      },
      "overview": {
        "cycleActiveBadge": "Active cycle",
        "completedOn": "Completed on {date}",
        "cycleDuration": "Duration: {days} days",
        "reopenedOn": "Reopened on {date}"
      }
    }
  }
}
```

---

## 11. File inventory

### Files to CREATE
| File path | Responsibility |
|---|---|
| `src/lib/projects/lifecycle-actions.ts` | Server actions module for readiness preflight and project reopening |
| `src/components/shared/projects/project-lifecycle/project-complete-dialog.tsx` | Completion preflight + AlertDialog with readiness summary and unfinished-work warning |
| `src/components/shared/projects/project-lifecycle/project-reopen-dialog.tsx` | Reopen reason form + AlertDialog with client + server validation |
| `src/components/shared/projects/project-workspace/completed-project-banner.tsx` | Read-only completed-state banner with conditional Reopen CTA |
| `__tests__/projects/project-lifecycle.test.tsx` | Automated tests for new Server Actions and lifecycle dialog components |

### Files to MODIFY
| File path | Change |
|---|---|
| `src/lib/projects/actions.ts` | Re-export `getCompletionReadinessAction`, `reopenProjectAction` |
| `src/components/shared/projects/project-workspace/project-status-dialog.tsx` | Extend `ProjectStatusActionType` union with `"complete"` and `"reopen"` |
| `src/components/shared/projects/project-workspace/project-workspace-shell.tsx` | Add dialog state; route new action types; render new dialogs + banner |
| `src/components/shared/projects/project-workspace/project-header.tsx` | Add "Complete" + "Reopen" items; suppress "Cancel" for completed status; retain edit button |
| `src/components/shared/projects/project-workspace/project-overview-tab.tsx` | Upgrade cycles history card with all available view fields |
| `src/components/shared/projects/project-tasks/tasks-tab.tsx` | Gate "Nueva Tarea" on `project.status !== "completed"` |
| `messages/es-MX.json` | Add new keys (Section 10) |
| `messages/en-US.json` | Add English equivalents (Section 10) |

### Files NOT to modify
- `src/lib/projects/commands.ts` — all commands already present.
- `src/lib/projects/queries.ts` — all queries already present.
- `src/lib/projects/schemas.ts` — all schemas already present.
- `src/lib/status-maps.ts` — `PROJECT_STATUS_MAP` already covers `completed`.
- `src/lib/database.types.ts` — must not be edited manually.
- Workspace page files (`admin/.../page.tsx`, `pm/.../page.tsx`) — already fetch cycles; no changes needed.

---

## 12. Responsive and accessibility specifications

### 12.1 Dialog accessibility
- Both new dialogs use shadcn `AlertDialog`, providing built-in `role="alertdialog"`, `aria-labelledby`, `aria-describedby`, and focus trapping.
- Cancel action is the initial tab stop to prevent accidental confirmation.
- Escape closes both dialogs without submitting.
- Minimum 44×44px touch targets on interactive elements.

### 12.2 Banner accessibility
- `role="status"` on `CompletedProjectBanner` wrapper.
- Clear button accessible name for screen readers.

### 12.3 Responsive layout
- Dialogs render responsively on narrow viewports.
- `CompletedProjectBanner` stacks vertically on mobile.

---

## 13. Verification matrix and acceptance criteria

### 13.1 Automated test suite
```bash
npm run test -- __tests__/projects/project-lifecycle.test.tsx
npm run typecheck
npm run lint
```

**Required test cases (`__tests__/projects/project-lifecycle.test.tsx`):**
1. **Server Action: `getCompletionReadinessAction`**
   - Rejects operator and client roles with `UNAUTHORIZED`.
   - Returns `ProjectCompletionReadiness` for authorized `pm` and `admin` roles.
   - Forwards error when underlying command fails.
2. **Server Action: `reopenProjectAction`**
   - Rejects unauthorized roles (`operator`, `client`).
   - Returns `VALIDATION_FAILED` when reason is empty string or exceeds 500 characters.
   - Calls `transitionProjectStatus` with `next_status: "in_progress"` and returns success.
3. **Component: `ProjectCompleteDialog`**
   - Renders loading skeleton while readiness is pending.
   - Renders green ready indicator when `is_ready === true`.
   - Renders amber warning with task count when `is_ready === false`.
   - Confirm button is enabled regardless of `is_ready`.
   - On confirm, calls `transitionProjectStatusAction` with `confirm_unfinished: true`.
4. **Component: `ProjectReopenDialog`**
   - Disables confirm button or validates empty reason.
   - Calls `reopenProjectAction` with trimmed reason.
5. **Component: `ProjectHeader` dropdown items**
   - "Complete Project" item absent when `status === "completed"`.
   - "Complete Project" item absent when `effectiveCapacity === "pm_watcher"`.
   - "Reopen Project" item present when `status === "completed"` and not watcher.
   - "Cancel" item absent when `status === "completed"`.
   - "Editar Información" button remains available when `status === "completed"`.

### 13.2 Manual localhost verification journeys

| # | Role | Steps | Expected outcome |
|---|---|---|---|
| **J1** | `pm_lead` | Open project with all tasks complete → dropdown → "Completar Proyecto" → dialog shows green ready state → confirm. | Status → `completed`; banner appears; "Nueva Tarea" button gone; dropdown shows "Reabrir Proyecto"; Edit button remains. |
| **J2** | `pm_lead` | Open project with pending tasks → dropdown → "Completar Proyecto" → dialog shows amber warning with task list → confirm. | Project completes despite warning; cycle #1 entry in Overview history. |
| **J3** | `pm_lead` | Open completed project → dropdown → "Reabrir Proyecto" → enter reason "Revisión adicional solicitada" → confirm. | Status → `in_progress`; banner disappears; cycle #1 shows completed_at, reopened_at, and reason. |
| **J4** | `pm_lead` | Open reopen dialog → click confirm without entering reason. | Inline error appears; no server call; dialog stays open. |
| **J5** | `pm_watcher` | View project workspace → inspect header dropdown. | "Completar Proyecto" and "Reabrir Proyecto" absent from dropdown. |
| **J6** | `pm_lead` | After J2+J3, view Overview tab. | Cycles card shows all available fields: completed_at, duration (if available), reopened_at, reason. |
| **J7** | `pm_lead` | View a completed project. | Green banner displays "Proyecto completado el {date}" with "Reabrir Proyecto" button visible. |
| **J8** | `pm_lead` | View completed project → Tasks tab. | "Nueva Tarea" button absent. |
| **J9** | `admin` | Repeat J1 in English locale (`/en/admin/proyectos/[id]`). | All text appears in English with correct formatting. |

---

## 14. Stop conditions and explicit boundaries

| Discovery | Required response |
|---|---|
| `transition_project_status` rejects `next_status: "in_progress"` on reopen | Stop. Report the exact error. Verify database trigger invariants. |
| `transition_project_status` rejects `next_status: "completed"` from planning status | Stop. Report exact error. Verify allowed source statuses. |
| Any component requires reading from profiles or unjoined tables for cycle history | Stop. Report the missing data boundary. Do not add ad hoc queries. |
| Implementation requires edits to `database.types.ts` or a new SQL migration | Stop. Report and obtain separately authorized schema work. |

---

## 15. Definition of done

S04-05 is complete when:
- [ ] `src/lib/projects/lifecycle-actions.ts` exists, exposes `getCompletionReadinessAction` and `reopenProjectAction`, and is re-exported from `actions.ts`.
- [ ] `ProjectCompleteDialog` fetches readiness on open, shows green ready state or amber warning (with task list), keeps Confirm button enabled, and calls `transitionProjectStatusAction` with `confirm_unfinished: true`.
- [ ] `ProjectReopenDialog` validates reason (1–500 chars) client-side and server-side, and calls `reopenProjectAction`.
- [ ] `ProjectStatusActionType` union includes `"complete"` and `"reopen"`. The shell routes these to the new dialogs.
- [ ] `ProjectHeader` renders "Completar Proyecto" for authorized non-watchers on active projects, and "Reabrir Proyecto" on completed projects. "Cancelar" is hidden on completed projects, while "Editar Información" remains enabled.
- [ ] `CompletedProjectBanner` appears when `project.status === "completed"`, shows formatted completion date, and offers a non-watcher reopen CTA.
- [ ] The Tasks tab "Nueva Tarea" button is hidden when `project.status === "completed"`.
- [ ] The completion cycles history card in `ProjectOverviewTab` renders all available `ProjectCompletionCyclesView` fields.
- [ ] A PM Watcher can read all completion context but receives no lifecycle mutation controls or Server Action authorization.
- [ ] All new user-visible strings are localized under the specified keys in both `es-MX.json` and `en-US.json` with 100% key parity.
- [ ] Automated tests pass (`npm run test -- __tests__/projects/project-lifecycle.test.tsx`).
- [ ] `npm run typecheck` and `npm run lint` pass without errors.
- [ ] `CHANGELOG.md` is updated per the `/update-changelog` skill as the final step.

Spec written: 2026-08-19. Authority: Sprint S04 Plan (S04-05).