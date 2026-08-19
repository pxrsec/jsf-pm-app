# S04-03 — Build the Project Directory, Project Creation, and Membership Governance

**Sprint:** S04  
**Work Item:** S04-03  
**Status:** Ready for implementation  
**Last reviewed:** 2026-08-19  
**Spec authority:** Sprint plan `s04-e04-e05-project-workspace-and-production-deliverable-lifecycle-sprint-plan.md`, Section 5 (work item S04-03).  
**Dependencies:** S04-01 (shadcn/ui + token-based theming), S04-02 (feature data layer & command boundaries).

---

## 1. Purpose and scope

This specification defines the complete technical, architectural, and visual blueprint for **S04-03: Project Directory, Project Creation, and Membership Governance**. 

S04-03 transforms the authenticated Admin and PM application shells into active, role-safe project management environments. It delivers the core project inventory, responsive directory UI, project creation workflow with strict client vs. internal invariants, the project workspace detail shell, and full team membership governance.

### In scope

1. **Active Role Navigation:**
   - Replace disabled project navigation stubs in `AppNav` and `MobileNavToggle` with active localized links for Admin (`/admin/proyectos`) and PM (`/pm/proyectos`).
   - Preserve disabled stubs for Operator (`/operador/agenda`) and Client (`/cliente/proyectos`) until E6/E7.
2. **Project Directory (`/admin/proyectos` & `/pm/proyectos`):**
   - Server Component reads utilizing `listProjectsForAdmin` and `listProjectsForPm`.
   - Client-side search (by project name and client name/scope) and controlled filters (by `status` and `project_type`).
   - Responsive presentation: desktop dense shadcn `Table` with sortable visual columns; mobile stacked `Card` view avoiding horizontal data trapping.
   - Status and type semantic badges utilizing the centralized token system from S04-01.
   - Role-aware empty states with clear calls-to-action for Admin and PM Leads.
   - Route-level `loading.tsx` skeletons and safe `error.tsx` boundaries.
3. **Project Creation Workflow (`/admin/proyectos/nuevo` & `/pm/proyectos/nuevo`):**
   - Form capturing validated project fields: `name`, `project_type` (`client` vs `internal`), `internal_description`, `deadline_at`, and optional `drive_folder_url`.
   - Dynamic conditional fields:
     - When `project_type = 'client'`: optional selection of an active Client organization (`listActiveClients`), optional `client_scope`, and optional initial Client contact member (`listEligibleClientMembers`). Client projects created in the `planning` stage are permitted to be created without a client organization or initial client member for maximum onboarding flexibility.
     - When `project_type = 'internal'`: hides/clears client organization selection and client scope, and prohibits client members.
   - Initial team composition:
     - PM user creating project: automatically assigned as primary PM Lead (`pm_lead`, `is_primary = true`).
     - Admin user creating project: selects the primary PM Lead from active PM profiles (`listEligiblePmUsers`).
     - Atomic creation via Server Action ensuring database trigger invariants (`validate_project_memberships`) are satisfied.
4. **Project Workspace Shell (`/admin/proyectos/[id]` & `/pm/proyectos/[id]`):**
   - Server Component layout/page fetching project details (`getProjectDetail`), verifying actor authorization, and deriving the actor's effective capacity (`admin`, `pm_lead`, `pm_watcher`).
   - Header with title, type badge, status badge, deadline, primary lead indicator, quick actions, and navigation breadcrumbs.
   - For client projects lacking a client organization or client members in `planning` status: renders an informative setup banner informing the team that client organization/members must be attached before transitioning out of planning or releasing deliverables to client review.
   - Tabbed Information Architecture:
     - **Overview (`Resumen`):** Project metadata, descriptions, client summary (if client project), high-level team summary, status transition controls, and completion cycles / activity preview.
     - **Tasks (`Tareas`):** Structured placeholder tab component ready for S04-04 Kanban/list implementation.
     - **Deliverables (`Entregables`):** Structured placeholder tab component ready for S04-06/07 (internal assignment permitted during planning; client-facing release blocked until client organization and members are assigned; disabled/hidden on internal projects).
     - **Members (`Equipo`):** Full membership governance workspace.
     - **Activity (`Actividad`):** Project lifecycle and completion cycle history view.
5. **Membership Governance (`Members` Tab / Component):**
   - Member inventory table/list displaying avatar, full name, role, capacity badge (`PM Lead` with Primary highlight, `PM Watcher`, `Operator`, `Client`), notification preference, joined timestamp, and capacity-aware action menu.
   - **Add Member Dialog / Drawer:**
     - Select member capacity: `pm_lead`, `pm_watcher`, `operator`, `client` (capacity options filtered by project type and profile compatibility).
     - User selector populated via `listEligiblePmUsers`, `listEligibleOperators`, and `listEligibleClientMembers(clientId)`.
     - Primary PM Lead assignment toggle (when capacity is `pm_lead`).
   - **Promote / Set Primary PM Lead:**
     - Reassigns primary lead designation to another active PM Lead while atomically demoting the prior primary lead to maintain exactly one primary lead.
   - **Update Member Capacity:**
     - Switch capacity (e.g. between `pm_lead` and `pm_watcher`), or toggle notification opt-in.
   - **Remove Member Action:**
     - Localized `AlertDialog` confirmation with soft-delete via `removeProjectMember`.
     - Enforces trigger validation (rejection if removing the sole primary PM Lead or last required member).
6. **Project Metadata & Status Governance:**
   - Edit project metadata modal / sheet (`updateProject`).
   - Status actions: Pause (`paused`), Resume (`in_progress`), Cancel (`cancelled` with `AlertDialog`), Archive / Soft-delete (`archiveProject`), and Admin Restore (`restoreProject`).
7. **Role & Capacity UX Gatekeeping:**
   - Admin & PM Lead: Full management, creation, editing, membership mutation, and status transition affordances.
   - PM Watcher: Read-only access to project directory, workspace overview, and member roster; all mutation controls (buttons, forms, action menus) are hidden.
   - Unrelated PM: Safely denied access; project directory excludes unassigned projects, and direct deep-link to `/pm/proyectos/[id]` results in a safe 404/not-found response.
8. **Localization & Parity:**
   - Comprehensive message namespaces in `messages/es-MX.json` and `messages/en-US.json` (`projects`, `memberships`, `projectWorkspace`, `clients`, `capacities`).

### Explicitly out of scope for S04-03

- Task creation, task assignment, task editing, task comments, and Kanban board (deferred to S04-04).
- Production deliverable creation, Drive URL submission, version history, and formal review (deferred to S04-06 and S04-07).
- Formal project completion readiness evaluation and completion-cycle reopening flow with override confirmation (deferred to S04-05).
- Client portal and Operator execution portal (deferred to E6 and E7).
- Direct database schema alterations, migrations, or manual edits to `database.types.ts`.

---

## 2. Baseline and architectural contracts

### 2.1 Dependencies from S04-01 & S04-02

S04-03 builds directly upon:
1. **Visual Foundation (S04-01):**
   - Installed shadcn/ui primitives under `src/components/ui/`: `Button`, `Input`, `Textarea`, `Label`, `Select`, `Badge`, `Card`, `Table`, `Tabs`, `Dialog`, `AlertDialog`, `Sheet`, `DropdownMenu`, `Popover`, `Command`, `Separator`, `Skeleton`, `Tooltip`, `Sonner`.
   - Semantic CSS variable tokens in `globals.css` and `next-themes` ThemeProvider.
2. **Feature Data Layer (S04-02):**
   - `src/lib/projects/queries.ts`: `listProjectsForAdmin`, `listProjectsForPm`, `getProjectDetail`, `getProjectMembers`, `listEligiblePmUsers`, `listEligibleOperators`, `listEligibleClientMembers`.
   - `src/lib/projects/commands.ts`: `createProject`, `updateProject`, `archiveProject`, `restoreProject`, `transitionProjectStatus`, `recoverProjectStatus`, `addProjectMember`, `updateProjectMember`, `removeProjectMember`, `setPrimaryPmLead`.
   - `src/lib/projects/schemas.ts`: `CreateProjectSchema`, `UpdateProjectSchema`, `TransitionProjectStatusSchema`, `AddProjectMemberSchema`, `UpdateProjectMemberSchema`.
   - `src/lib/projects/errors.ts`: `mapSupabaseError`, `CommandResult<T>`, safe app error codes.
   - `src/lib/clients/queries.ts`: `listActiveClients`, `getClientById`, `listClientContacts`.

### 2.2 Database triggers and invariant constraints

The application UI and Server Actions conform to the updated database trigger (`private.validate_project_memberships`):

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        DATABASE INVARIANTS (Enforced by DB Triggers)                    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Active PM Leads: Active project must have >= 1 active PM Lead.                      │
│ 2. Primary PM Lead: Active project must have EXACTLY 1 active primary PM Lead.         │
│ 3. Client Project Membership:                                                          │
│    - In 'planning' status: Client project may have 0 Client members and null client_id │
│      to allow early operational planning before client onboarding is completed.        │
│    - In active non-planning status ('in_progress', 'paused', 'completed'):             │
│      Active client project must have >= 1 active Client member and valid client_id.    │
│ 4. Internal Project Membership: Active 'internal' project must have 0 Client members   │
│    and null client_id always.                                                          │
│ 5. Role Compatibility:                                                                 │
│    - 'pm_lead' / 'pm_watcher' requires profile.role in ('pm', 'admin')                 │
│    - 'operator' requires profile.role in ('operator', 'admin')                         │
│    - 'client' requires profile.role = 'client'                                         │
│ 6. Immutability: 'project_type' cannot be changed after creation.                      │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

> **CRITICAL TRANSACTION NOTE:** The trigger `project_members_deferred_validation_trg` is a `deferrable initially deferred` constraint trigger. When creating a project with initial members, or rotating primary leads, operations execute within a single coordinated Server Action transaction/batch insert so that the database invariants are satisfied upon transaction commit.

---

## 3. Information architecture and route tree

```
src/app/[locale]/(protected)/
├── admin/
│   ├── proyectos/
│   │   ├── page.tsx                     # Admin Project Directory (Server Component)
│   │   ├── loading.tsx                  # Table / Directory Skeleton Loader
│   │   ├── error.tsx                    # Localized Error Boundary
│   │   ├── nuevo/
│   │   │   ├── page.tsx                 # Project Creation Page (Server Component)
│   │   │   └── _components/
│   │   │       └── admin-create-form.tsx# Client form for Admin creation
│   │   └── [id]/
│   │       ├── page.tsx                 # Admin Project Workspace (Server Component)
│   │       ├── loading.tsx              # Workspace Shell Skeleton Loader
│   │       └── error.tsx                # Workspace Error Boundary
│   └── ...
├── pm/
│   ├── proyectos/
│   │   ├── page.tsx                     # PM Project Directory (Server Component)
│   │   ├── loading.tsx                  # Table / Directory Skeleton Loader
│   │   ├── error.tsx                    # Localized Error Boundary
│   │   ├── nuevo/
│   │   │   ├── page.tsx                 # Project Creation Page (Server Component)
│   │   │   └── _components/
│   │   │       └── pm-create-form.tsx   # Client form for PM Lead creation
│   │   └── [id]/
│   │       ├── page.tsx                 # PM Project Workspace (Server Component)
│   │       ├── loading.tsx              # Workspace Shell Skeleton Loader
│   │       └── error.tsx                # Workspace Error Boundary
│   └── ...
```

### Shared component layer (`src/components/shared/projects/`)

To avoid duplicating presentation logic across `/admin/proyectos` and `/pm/proyectos`, common UI components live in `src/components/shared/projects/`:

```
src/components/shared/projects/
├── project-directory/
│   ├── project-directory-view.tsx       # Controlled directory shell (Search, Filters, Table/Card switch)
│   ├── project-table.tsx                # Desktop dense Table presentation
│   ├── project-card-list.tsx            # Mobile responsive Card presentation
│   ├── project-filters.tsx              # Status, Type, and Search controls
│   └── project-empty-state.tsx          # Localized empty state with role-aware CTA
├── project-workspace/
│   ├── project-workspace-shell.tsx      # Main layout with header, badges, actions, and tabs
│   ├── project-header.tsx               # Project title, meta, status badge, primary lead badge
│   ├── project-overview-tab.tsx         # Overview content (details, client info, quick stats, cycles)
│   ├── project-edit-dialog.tsx          # Metadata edit modal
│   ├── project-status-dialog.tsx        # Pause / Cancel / Archive confirmation dialogs
│   └── placeholders/
│       ├── tasks-tab-placeholder.tsx    # S04-04 placeholder with structured preview
│       └── deliverables-tab-placeholder.tsx # S04-06 placeholder
└── project-members/
    ├── member-roster-tab.tsx            # Member list / table with capacity labels
    ├── member-capacity-badge.tsx        # Badge displaying PM Lead (Primary), Watcher, Operator, Client
    ├── add-member-dialog.tsx            # Capacity-aware member addition dialog
    ├── change-capacity-dialog.tsx       # Capacity switch / settings dialog
    ├── remove-member-dialog.tsx         # Alert confirmation for member removal
    └── set-primary-lead-dialog.tsx      # Confirmation to rotate primary PM Lead
```

---

## 4. Detailed component specifications

### 4.1 Navigation updates (`AppNav` & `MobileNavToggle`)

#### [MODIFY] `src/components/shared/app-nav/app-nav.tsx`
- Replace disabled secondary navigation stub links with active Next.js `Link` components for `admin` and `pm` roles:
  - For `admin`: `<Link href="/admin/proyectos">{t("links.projects")}</Link>`
  - For `pm`: `<Link href="/pm/proyectos">{t("links.projects")}</Link>`
  - For `operator`: Retain disabled stub (`href="/operador/agenda"`, `aria-disabled="true"`).
  - For `client`: Retain disabled stub (`href="/cliente/proyectos"`, `aria-disabled="true"`).
- Highlight active route when the current pathname starts with `/admin/proyectos` or `/pm/proyectos`.

#### [MODIFY] `src/components/shared/app-nav/_components/mobile-nav-toggle.tsx`
- Update mobile drawer navigation to render active links for Admin and PM project routes.

---

### 4.2 Project Directory (`/admin/proyectos` & `/pm/proyectos`)

#### Page specifications:
- **Server Component:** `src/app/[locale]/(protected)/admin/proyectos/page.tsx`
  - Calls `requireSession(cookieStore)` (verifies `role === 'admin'`).
  - Calls `listProjectsForAdmin(supabase)`.
  - Passes projects and `actorRole="admin"` to `ProjectDirectoryView`.
- **Server Component:** `src/app/[locale]/(protected)/pm/proyectos/page.tsx`
  - Calls `requireSession(cookieStore)` (verifies `role === 'pm'`).
  - Calls `listProjectsForPm(supabase, session.user.id)`.
  - Passes projects and `actorRole="pm"` to `ProjectDirectoryView`.

#### Client Component: `ProjectDirectoryView`
- **State Management:**
  - `searchQuery` (string, debounced / controlled): filters by `name` and `client_scope`.
  - `statusFilter` (`all` | `planning` | `in_progress` | `paused` | `completed` | `cancelled`). Default: `all`.
  - `typeFilter` (`all` | `client` | `internal`). Default: `all`.
  - `viewMode` (`table` | `cards` | `auto`): auto switches based on viewport breakpoints.
- **Controls & Actions:**
  - Search input with clear button and Lucide `Search` icon.
  - Status `Select` dropdown.
  - Project Type `Select` dropdown.
  - "Nuevo Proyecto" (`New Project`) primary CTA button linking to `./proyectos/nuevo` (rendered for Admin and PM).
- **Desktop Table View (`ProjectTable`):**
  - Columns:
    1. **Nombre del Proyecto (`Project Name`):** Name linked to `./proyectos/[id]`, with truncated description.
    2. **Tipo (`Type`):** Semantic badge (`Cliente` / `Interno`).
    3. **Estado (`Status`):** Centralized status badge (`Planificación`, `En progreso`, `Pausado`, `Completado`, `Cancelado`).
    4. **Fecha Límite (`Deadline`):** Formatted localized date with relative time indicator (e.g. `15 Oct 2026`).
    5. **Acciones (`Actions`):** `DropdownMenu` with quick links (`Ver Espacio de Trabajo`, `Gestionar Equipo`).
- **Mobile Stacked Cards View (`ProjectCardList`):**
  - Rendered at viewports `< 768px` (or selectable via toggle).
  - Cards using shadcn `Card`:
    - Header: Project name (touch-target link) + status badge.
    - Content: Type badge, truncated internal description, formatted deadline with icon.
    - Footer: "Abrir Proyecto" (`Open Project`) full-width button.
- **Empty State (`ProjectEmptyState`):**
  - If no projects exist in the database: Explanatory message + "Crear primer proyecto" CTA.
  - If filter returns zero results: "No se encontraron proyectos con los filtros seleccionados" + "Limpiar filtros" button.

---

### 4.3 Project Creation Workflow (`/admin/proyectos/nuevo` & `/pm/proyectos/nuevo`)

#### Page specifications:
- Server Component pages authenticate actor, fetch prerequisite dropdown data in parallel:
  - `listActiveClients(supabase)` (for client project selection).
  - `listEligiblePmUsers(supabase)` (for Admin PM lead picker).
  - Pass initial lists to the create form component.

#### Create Form Component: `ProjectCreateForm` (`admin-create-form.tsx` / `pm-create-form.tsx`)
- Uses React Hook Form with `zodResolver(CreateProjectSchema)`.
- **Form Fields:**
  1. **Tipo de Proyecto (`Project Type`):** Segmented control / radio cards:
     - `Cliente` (`client`): "Proyecto para un cliente externo con entregables de producción".
     - `Interno` (`internal`): "Proyecto de trabajo interno sin cliente ni entregables de producción".
  2. **Nombre del Proyecto (`Project Name`):** `Input` (min 1, max 200 chars).
  3. **Descripción Interna (`Internal Description`):** `Textarea` (min 1, max 2000 chars).
  4. **Fecha Límite (`Deadline`):** Date picker / HTML5 `datetime-local` input.
  5. **Carpeta de Google Drive (`Drive Folder URL`):** `Input` (optional, valid URL format).
  6. **Campos Condicionales de Cliente (solo si `project_type === 'client'`):**
     - **Organización Cliente (`Client Organization`):** `Select` dropdown populated with `listActiveClients` (optional in `planning` status for flexible early project onboarding).
     - **Alcance para Cliente (`Client Scope`):** `Textarea` (optional, max 1000 chars).
     - **Contacto de Cliente Inicial (`Initial Client Member`):** Dynamic `Select` populated with client contacts from `listEligibleClientMembers(selectedClientId)` (optional in `planning` status).
  7. **Asignación de PM Lead:**
     - **Para Administrador:** `Select` dropdown to pick the Primary PM Lead from `listEligiblePmUsers`.
     - **Para PM:** Read-only info badge indicating the current PM will be designated as the Primary PM Lead (`is_primary = true`).
- **Submission & Execution Flow:**
  - Triggers Server Action `createProjectAction(payload)`.
  - On success: Displays toast notification and redirects via `router.push(`/${locale}/${role}/proyectos/${newProjectId}`)`.
  - On failure: Displays mapped localized error toast / inline validation message without exposing internal database details.

---

### 4.4 Project Workspace Detail Shell (`/admin/proyectos/[id]` & `/pm/proyectos/[id]`)

#### Page specifications:
- **Server Component:** `src/app/[locale]/(protected)/{admin|pm}/proyectos/[id]/page.tsx`
  1. Calls `requireSession(cookieStore)`.
  2. Calls `getProjectDetail(supabase, projectId)`.
  3. If project is not found or soft-deleted (`archived_at !== null`): renders Next.js `notFound()`.
  4. Authorizes actor:
     - If `role === 'admin'`: Allowed. Effective capacity = `'admin'`.
     - If `role === 'pm'`: Checks if `actor.id` exists in `project.members` where `deleted_at IS NULL`.
       - If found: Effective capacity = member's `member_type` (`'pm_lead'` or `'pm_watcher'`).
       - If not found: Returns 404 / access denied.
  5. Fetches completion cycles: `getCompletionCycles(supabase, projectId)`.
  6. Passes project data, member roster, cycles, and `effectiveCapacity` to `ProjectWorkspaceShell`.

#### Component: `ProjectWorkspaceShell`
- **Header Section (`ProjectHeader`):**
  - Breadcrumbs: `Proyectos > [Nombre del Proyecto]`.
  - Title: Large heading with project name.
  - Badges row:
    - Status Badge: `Planning`, `In Progress`, `Paused`, `Completed`, `Cancelled`.
    - Type Badge: `Cliente: [Client Name]` (or `Cliente: Sin asignar` if unassigned) / `Interno`.
    - Primary Lead Badge: Avatar + Name of primary PM Lead.
    - Deadline Badge: Calendar icon + localized target date.
  - Action Controls (Hidden for `pm_watcher`):
    - "Editar Información" (`Edit Info`): Opens `ProjectEditDialog`.
    - Status Control Dropdown: Pause, Resume, Cancel, Archive.
- **Tabbed Interface (`Tabs`):**
  ```
  [ Resumen (Overview) ]  [ Tareas (Tasks) ]  [ Entregables (Deliverables) ]  [ Equipo (Members) ]  [ Actividad (Activity) ]
  ```
  - Default tab: `overview` (or sync with URL hash / searchParam `?tab=...`).
  - For `internal` projects: `Deliverables` tab shows a clear explanatory disabled state or tooltip ("Los proyectos internos no admiten entregables de producción").
  - For `client` projects without client members: Tasks and Deliverables tabs allow internal creation and assignment; client-review release is guarded until a client member is added.

---

### 4.5 Membership Governance (`Members` Tab / `MemberRosterTab`)

#### Component: `MemberRosterTab`
- **Header:**
  - Section title: "Equipo del Proyecto" (`Project Team`).
  - Summary stats: Total members, PM Leads count, Operators count, Client contacts count.
  - Primary Action: "Agregar Miembro" (`Add Member`) button (opens `AddMemberDialog`, hidden for `pm_watcher`).
- **Members Table / List:**
  - Columns:
    1. **Miembro (`Member`):** Avatar + Full Name + Email.
    2. **Rol del Sistema (`System Role`):** Badge (`PM`, `Operador`, `Cliente`, `Administrador`).
    3. **Capacidad en Proyecto (`Project Capacity`):**
       - `PM Lead` (with golden star / badge if `is_primary = true`).
       - `PM Watcher` (gray badge).
       - `Operador` (blue badge).
       - `Cliente` (purple badge).
    4. **Notificaciones (`Notifications`):** Bell icon indicating `receives_notifications`.
    5. **Fecha de Asignación (`Joined At`):** Formatted date.
    6. **Acciones (`Actions`):** (Hidden for `pm_watcher`)
       - "Nombrar PM Lead Principal" (visible for secondary `pm_lead` members).
       - "Cambiar Capacidad" (e.g. Lead <-> Watcher).
       - "Remover del Proyecto" (destructive red option, opens `RemoveMemberDialog`).

#### Component: `AddMemberDialog`
- Form fields:
  1. **Capacidad (`Capacity`):** `Select` (`pm_lead`, `pm_watcher`, `operator`, `client`).
     - Note: `client` capacity is disabled if project is `internal` or if client project has no `client_id` assigned yet.
  2. **Usuario (`User`):** `Select` populated dynamically based on selected capacity:
     - If `pm_lead` or `pm_watcher`: `listEligiblePmUsers` excluding existing active members.
     - If `operator`: `listEligibleOperators` excluding existing active members.
     - If `client`: `listEligibleClientMembers(project.client_id)` excluding existing active members.
  3. **¿Es Lead Principal? (`Is Primary Lead?`):** `Checkbox` (only visible when capacity is `pm_lead`).
  4. **Recibir Notificaciones (`Receive Notifications`):** `Checkbox` (default `true`).
- Submission: calls `addProjectMemberAction(input)`.

#### Component: `SetPrimaryLeadDialog` / Promotion Flow
- Dialog explaining that promoting the selected PM Lead will reassign primary lead status while keeping the current primary lead as an active secondary PM Lead.
- Confirmation calls `setPrimaryPmLeadAction(projectId, memberId)`.

#### Component: `RemoveMemberDialog`
- `AlertDialog` warning that the member will lose access to the project workspace.
- Calls `removeProjectMemberAction(memberId)`.
- If database trigger rejects the removal (e.g. attempting to delete the only PM Lead or only Client member on an active non-planning project), catches the error and renders an informative localized alert: "No se puede eliminar al único PM Lead del proyecto. Asigne otro Lead antes de continuar."

---

### 4.6 Project Overview & Status Governance (`ProjectOverviewTab`)

#### Component: `ProjectOverviewTab`
- **Setup Warning Banner (when applicable):**
  - If `project.project_type === 'client'` and (`project.client_id === null` or active client members = 0):
    - Renders an informative alert banner: "Configuración de cliente pendiente — Este proyecto de cliente aún no tiene cliente u organización asignada. Puedes planificar y asignar trabajo a miembros internos, pero se requerirá asignar un cliente y contacto antes de iniciar el proyecto o solicitar revisiones de cliente."
    - Quick CTA button: "Vincular Cliente" (opens `ProjectEditDialog`).
- **Grid Layout:**
  - **Left Column (2/3 width):**
    - **Descripción del Proyecto (`Project Description`):** Card displaying `internal_description`.
    - **Alcance para Cliente (`Client Scope`):** Card displaying `client_scope` (if client project).
    - **Almacenamiento y Enlaces (`Storage & Links`):** Card displaying Google Drive folder link with external link button (lexically sanitized public HTTPS URL).
    - **Resumen de Trabajo (`Work Summary`):** Overview card showing high-level counts (tasks count, deliverables count) with quick navigation links to respective tabs.
  - **Right Column (1/3 width):**
    - **Ficha del Proyecto (`Project Meta`):**
      - ID del Proyecto (truncated uuid with copy button).
      - Fecha de Creación.
      - Fecha Límite.
      - Cliente Asociado (if applicable, or badge "Sin asignar").
    - **Equipo Resumido (`Team Summary`):** Mini avatar stack of active members with a "Ver todos" link to the Members tab.
    - **Ciclos de Completado (`Completion Cycles`):** If project has been previously completed or reopened, displays history items from `project_completion_cycles_view`.

#### Component: `ProjectEditDialog`
- Modal allowing PM Lead or Admin to edit mutable fields: `name`, `internal_description`, `client_id` (for client projects), `client_scope`, `deadline_at`, `drive_folder_url`.
- Note: `project_type` is immutable and displayed as read-only.
- Submission calls `updateProjectAction(projectId, payload)`.

#### Component: `ProjectStatusDialog`
- Supports status transitions:
  - **Pausar Proyecto (`Pause Project`):** Changes status to `paused`.
  - **Reanudar Proyecto (`Resume Project`):** Changes status to `in_progress`.
  - **Cancelar Proyecto (`Cancel Project`):** `AlertDialog` requiring confirmation to transition status to `cancelled`.
  - **Archivar Proyecto (`Archive Project`):** Calls `archiveProjectAction(projectId)` to soft-delete the project.
  - **Restaurar Proyecto (`Restore Project`):** (Admin only) Calls `restoreProjectAction(projectId)` to un-archive a project.

---

## 5. Server actions contract (`src/lib/projects/actions.ts`)

All user mutations execute through typed, server-authoritative Next.js Server Actions:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import * as projectCommands from "@/lib/projects/commands";
import * as clientQueries from "@/lib/clients/queries";
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  TransitionProjectStatusSchema,
  AddProjectMemberSchema,
  UpdateProjectMemberSchema,
  type CreateProjectInput,
  type UpdateProjectInput,
  type AddProjectMemberInput,
  type UpdateProjectMemberInput,
} from "@/lib/projects/schemas";
import type { CommandResult } from "@/lib/projects/errors";
import type { Project, ProjectMember } from "@/lib/projects/queries";

// ── Project Creation with Atomic Initial Team ────────────────────────────────

export interface CreateProjectWithTeamInput extends CreateProjectInput {
  initial_pm_lead_user_id?: string;
  initial_client_contact_user_id?: string;
}

export async function createProjectAction(
  rawInput: CreateProjectWithTeamInput
): Promise<CommandResult<Project>> {
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);
  
  if (session.role !== "admin" && session.role !== "pm") {
    return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized role" } };
  }

  const parseResult = CreateProjectSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      ok: false,
      error: { code: "VALIDATION_ERROR", message: parseResult.error.errors[0]?.message ?? "Invalid input" },
    };
  }

  const supabase = createClient(cookieStore);
  const input = parseResult.data;

  // 1. Create project
  const projectResult = await projectCommands.createProject(supabase, input, session.user.id);
  if (!projectResult.ok) return projectResult;
  const project = projectResult.data;

  // 2. Prepare initial team batch to satisfy deferred triggers
  const membersToAdd: Array<{
    project_id: string;
    user_id: string;
    member_type: "pm_lead" | "pm_watcher" | "operator" | "client";
    is_primary: boolean;
    created_by: string;
  }> = [];

  // Determine PM Lead: If PM, assign self as primary; if Admin, assign selected PM lead
  const pmLeadId = session.role === "pm" ? session.user.id : rawInput.initial_pm_lead_user_id;
  if (pmLeadId) {
    membersToAdd.push({
      project_id: project.id,
      user_id: pmLeadId,
      member_type: "pm_lead",
      is_primary: true,
      created_by: session.user.id,
    });
  }

  // If Client Project, assign initial client contact if provided
  if (project.project_type === "client" && rawInput.initial_client_contact_user_id) {
    membersToAdd.push({
      project_id: project.id,
      user_id: rawInput.initial_client_contact_user_id,
      member_type: "client",
      is_primary: false,
      created_by: session.user.id,
    });
  }

  if (membersToAdd.length > 0) {
    const { error: memberError } = await supabase.from("project_members").insert(membersToAdd);
    if (memberError) {
      // Clean up project if member initialization fails
      await supabase.from("projects").delete().eq("id", project.id);
      return { ok: false, error: projectCommands.mapSupabaseError(memberError) };
    }
  }

  revalidatePath(`/[locale]/(protected)/admin/proyectos`, "page");
  revalidatePath(`/[locale]/(protected)/pm/proyectos`, "page");
  return { ok: true, data: project };
}

// ── Project Update ───────────────────────────────────────────────────────────

export async function updateProjectAction(
  projectId: string,
  rawInput: UpdateProjectInput
): Promise<CommandResult<Project>> {
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);
  const supabase = createClient(cookieStore);

  const parseResult = UpdateProjectSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      ok: false,
      error: { code: "VALIDATION_ERROR", message: parseResult.error.errors[0]?.message ?? "Invalid input" },
    };
  }

  const result = await projectCommands.updateProject(supabase, projectId, parseResult.data, session.user.id);
  if (result.ok) {
    revalidatePath(`/[locale]/(protected)/admin/proyectos/${projectId}`, "page");
    revalidatePath(`/[locale]/(protected)/pm/proyectos/${projectId}`, "page");
  }
  return result;
}

// ── Membership Actions ───────────────────────────────────────────────────────

export async function addProjectMemberAction(
  rawInput: AddProjectMemberInput
): Promise<CommandResult<ProjectMember>> {
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);
  const supabase = createClient(cookieStore);

  const parseResult = AddProjectMemberSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      ok: false,
      error: { code: "VALIDATION_ERROR", message: parseResult.error.errors[0]?.message ?? "Invalid input" },
    };
  }

  const result = await projectCommands.addProjectMember(supabase, parseResult.data, session.user.id);
  if (result.ok) {
    revalidatePath(`/[locale]/(protected)/admin/proyectos/${rawInput.project_id}`, "page");
    revalidatePath(`/[locale]/(protected)/pm/proyectos/${rawInput.project_id}`, "page");
  }
  return result;
}

export async function removeProjectMemberAction(
  projectId: string,
  memberId: string,
  reason?: string
): Promise<CommandResult<{ success: boolean }>> {
  const cookieStore = await cookies();
  await requireSession(cookieStore);
  const supabase = createClient(cookieStore);

  const result = await projectCommands.removeProjectMember(supabase, memberId, reason);
  if (result.ok) {
    revalidatePath(`/[locale]/(protected)/admin/proyectos/${projectId}`, "page");
    revalidatePath(`/[locale]/(protected)/pm/proyectos/${projectId}`, "page");
  }
  return result;
}

export async function setPrimaryPmLeadAction(
  projectId: string,
  targetMemberId: string
): Promise<CommandResult<ProjectMember>> {
  const cookieStore = await cookies();
  await requireSession(cookieStore);
  const supabase = createClient(cookieStore);

  // 1. Demote current primary lead(s) on this project
  await supabase
    .from("project_members")
    .update({ is_primary: false })
    .eq("project_id", projectId)
    .eq("member_type", "pm_lead")
    .eq("is_primary", true);

  // 2. Promote target member to primary lead
  const result = await projectCommands.updateProjectMember(supabase, targetMemberId, {
    member_id: targetMemberId,
    is_primary: true,
  });

  if (result.ok) {
    revalidatePath(`/[locale]/(protected)/admin/proyectos/${projectId}`, "page");
    revalidatePath(`/[locale]/(protected)/pm/proyectos/${projectId}`, "page");
  }
  return result;
}
```

---

## 6. Message catalog specifications (Spanish `es-MX` & English `en-US`)

Every user-visible string must be defined with exact key parity in `messages/es-MX.json` and `messages/en-US.json`:

```json
{
  "projects": {
    "directory": {
      "title": "Proyectos",
      "adminSubtitle": "Gestión general de proyectos del sistema",
      "pmSubtitle": "Proyectos asignados a tu gestión",
      "searchPlaceholder": "Buscar por nombre de proyecto o cliente...",
      "filterStatus": "Estado",
      "filterType": "Tipo de proyecto",
      "allStatuses": "Todos los estados",
      "allTypes": "Todos los tipos",
      "newProjectButton": "Nuevo Proyecto",
      "emptyState": {
        "title": "No hay proyectos disponibles",
        "description": "Comienza creando un nuevo proyecto para gestionar tareas y entregables.",
        "noFilterResults": "No se encontraron proyectos que coincidan con los filtros seleccionados.",
        "clearFilters": "Limpiar filtros",
        "createCta": "Crear Proyecto"
      },
      "table": {
        "columns": {
          "name": "Proyecto",
          "type": "Tipo",
          "status": "Estado",
          "deadline": "Fecha Límite",
          "actions": "Acciones"
        },
        "actions": {
          "open": "Abrir espacio de trabajo",
          "manageTeam": "Gestionar equipo",
          "edit": "Editar información"
        }
      }
    },
    "types": {
      "client": "Cliente",
      "internal": "Interno",
      "clientDescription": "Proyecto con cliente externo y entregables de producción.",
      "internalDescription": "Proyecto operativo interno sin entregables de producción."
    },
    "create": {
      "title": "Crear Nuevo Proyecto",
      "subtitle": "Configura los parámetros iniciales y el equipo del proyecto",
      "form": {
        "typeLabel": "Tipo de proyecto",
        "nameLabel": "Nombre del proyecto",
        "namePlaceholder": "Ej. Campaña Navideña 2026",
        "descriptionLabel": "Descripción interna",
        "descriptionPlaceholder": "Detalles operativos, objetivos y contexto para el equipo...",
        "deadlineLabel": "Fecha y hora límite",
        "driveUrlLabel": "Enlace a carpeta de Google Drive (opcional)",
        "driveUrlPlaceholder": "https://drive.google.com/drive/folders/...",
        "clientOrgLabel": "Organización del cliente",
        "clientOrgPlaceholder": "Selecciona un cliente...",
        "clientScopeLabel": "Alcance visible para el cliente (opcional)",
        "clientScopePlaceholder": "Resumen que será visible para el cliente...",
        "initialClientContactLabel": "Contacto del cliente inicial",
        "initialClientContactPlaceholder": "Selecciona el contacto principal del cliente...",
        "primaryPmLeadLabel": "PM Lead principal asignado",
        "primaryPmLeadPlaceholder": "Selecciona un Project Manager Lead...",
        "pmAutoAssignedNote": "Serás asignado automáticamente como el PM Lead principal de este proyecto.",
        "submitButton": "Crear Proyecto",
        "cancelButton": "Cancelar",
        "creating": "Creando proyecto..."
      },
      "successToast": "Proyecto creado exitosamente.",
      "errorToast": "No se pudo crear el proyecto. Revisa los datos ingresados."
    },
    "workspace": {
      "breadcrumbs": {
        "root": "Proyectos",
        "current": "Espacio de Trabajo"
      },
      "header": {
        "primaryLeadLabel": "Lead Principal",
        "deadlineLabel": "Entrega",
        "editButton": "Editar",
        "statusActions": "Estado"
      },
      "tabs": {
        "overview": "Resumen",
        "tasks": "Tareas",
        "deliverables": "Entregables",
        "members": "Equipo",
        "activity": "Actividad"
      },
      "overview": {
        "descriptionCardTitle": "Descripción Interna",
        "clientScopeCardTitle": "Alcance del Cliente",
        "linksCardTitle": "Almacenamiento y Enlaces",
        "openDriveFolder": "Abrir carpeta en Google Drive",
        "noDriveLink": "No se ha configurado una carpeta de Google Drive.",
        "metaCardTitle": "Ficha Técnica",
        "projectId": "ID del Proyecto",
        "createdDate": "Fecha de Creación",
        "associatedClient": "Cliente",
        "quickStatsTitle": "Resumen de Trabajo",
        "tasksCount": "Tareas activas",
        "deliverablesCount": "Entregables",
        "completionCyclesTitle": "Historial de Ciclos de Completado",
        "cycleNumber": "Ciclo #{number}",
        "completedBy": "Completado por {name}",
        "reopenedBy": "Reabierto por {name}",
        "reopenReason": "Motivo: {reason}"
      },
      "editDialog": {
        "title": "Editar Información del Proyecto",
        "description": "Modifica los datos operativos del proyecto. El tipo de proyecto no puede modificarse.",
        "saveButton": "Guardar Cambios",
        "cancelButton": "Cancelar",
        "saving": "Guardando...",
        "successToast": "Proyecto actualizado correctamente."
      },
      "statusDialog": {
        "pauseTitle": "¿Pausar este proyecto?",
        "pauseDescription": "El proyecto pasará a estado pausado. El equipo no podrá avanzar tareas hasta que se reanude.",
        "resumeTitle": "¿Reanudar este proyecto?",
        "resumeDescription": "El proyecto volverá a estar en progreso activo.",
        "cancelTitle": "¿Cancelar este proyecto?",
        "cancelDescription": "Esta acción marcará el proyecto como cancelado. Solo un Administrador podrá recuperarlo.",
        "archiveTitle": "¿Archivar este proyecto?",
        "archiveDescription": "El proyecto se ocultará del directorio general.",
        "confirmButton": "Confirmar",
        "cancelButton": "Volver"
      }
    },
    "members": {
      "title": "Equipo del Proyecto",
      "subtitle": "Gestiona los miembros asignados y sus capacidades operativas",
      "addMemberButton": "Agregar Miembro",
      "stats": {
        "total": "Total de miembros: {count}",
        "pmLeads": "PM Leads: {count}",
        "operators": "Operadores: {count}",
        "clients": "Clientes: {count}"
      },
      "table": {
        "columns": {
          "member": "Miembro",
          "systemRole": "Rol en Sistema",
          "capacity": "Capacidad en Proyecto",
          "notifications": "Notificaciones",
          "joinedAt": "Fecha de Asignación",
          "actions": "Acciones"
        },
        "actions": {
          "setPrimaryLead": "Hacer PM Lead Principal",
          "changeCapacity": "Cambiar Capacidad",
          "remove": "Remover del Proyecto"
        }
      },
      "capacities": {
        "pm_lead": "PM Lead",
        "pm_lead_primary": "PM Lead (Principal)",
        "pm_watcher": "PM Observador",
        "operator": "Operador",
        "client": "Cliente"
      },
      "addDialog": {
        "title": "Agregar Miembro al Proyecto",
        "description": "Selecciona el usuario y define su capacidad operativa en el proyecto.",
        "capacityLabel": "Capacidad operativa",
        "userLabel": "Seleccionar usuario",
        "userPlaceholder": "Busca un usuario...",
        "isPrimaryLeadLabel": "Designar como PM Lead Principal",
        "notificationsLabel": "Recibir notificaciones del proyecto",
        "submitButton": "Agregar Miembro",
        "cancelButton": "Cancelar",
        "successToast": "Miembro agregado exitosamente."
      },
      "setPrimaryDialog": {
        "title": "¿Cambiar PM Lead Principal?",
        "description": "Se asignará a {name} como el PM Lead principal del proyecto. El lead actual permanecerá como PM Lead secundario.",
        "confirmButton": "Confirmar Asignación",
        "cancelButton": "Cancelar",
        "successToast": "Lead principal actualizado."
      },
      "removeDialog": {
        "title": "¿Remover miembro del proyecto?",
        "description": "¿Estás seguro de que deseas remover a {name}? Perderá el acceso al espacio de trabajo.",
        "confirmButton": "Remover",
        "cancelButton": "Cancelar",
        "successToast": "Miembro removido correctamente.",
        "errorSoleLead": "No se puede remover al único PM Lead. Asigna otro Lead principal primero.",
        "errorSoleClient": "Un proyecto de cliente debe tener al menos un miembro cliente activo."
      }
    }
  }
}
```

---

## 7. Responsive and accessibility specifications

### 7.1 Viewport responsiveness

| Component | Desktop (`>= 1024px`) | Tablet (`768px - 1023px`) | Mobile (`< 768px`) |
|---|---|---|---|
| **Project Directory** | Dense `Table` with all columns | Compact `Table` (actions in menu) | Stacked `Card` list (`ProjectCardList`) |
| **Workspace Header** | Horizontal flex with full metadata badges and actions | Wrapped badges with compact action dropdown | Stacked vertical header with bottom-sheet action triggers |
| **Workspace Tabs** | Full horizontal `TabsList` | Scrollable horizontal `TabsList` | Scrollable horizontal `TabsList` or compact tab dropdown |
| **Members Roster** | Full `Table` with avatar and role badges | Responsive `Table` with wrapped columns | Stacked Member cards with action sheet |
| **Project Create Form** | Two-column grid for related fields | Single column stacked | Single column stacked with fixed bottom submit bar |

### 7.2 Accessibility contracts (WCAG 2.1 AA)

1. **Touch Targets:** All interactive elements (buttons, links, table actions, select triggers) must meet a minimum touch target size of 44×44px on mobile devices.
2. **Keyboard Operability:**
   - Full tab-index navigation across Table rows, Card items, Tab triggers, and Dialog forms.
   - Escape key dismisses modals and drawers without submitting.
   - Focus traps in `Dialog`, `AlertDialog`, and `Sheet` components.
3. **Screen Readers & ARIA:**
   - `aria-label` on search inputs, action menus, and icon-only buttons.
   - `role="status"` on live badge indicators and loading skeletons.
   - `aria-selected` on active tab triggers.
4. **Color Contrast:**
   - Text foreground against background meets or exceeds 4.5:1 ratio in both Light and Dark themes.
   - Badge colors (status and capacity) rely on semantic text labels and distinct icon markers, never color alone.

---

## 8. File inventory

### Files to CREATE

| File Path | Responsibility |
|---|---|
| `supabase/migrations/20260819140000_s04_03_flexible_client_project_planning.sql` | Migration updating `validate_project_memberships` trigger for planning-stage client flexibility |
| `src/app/[locale]/(protected)/admin/proyectos/page.tsx` | Admin Project Directory entry point (RSC) |
| `src/app/[locale]/(protected)/admin/proyectos/loading.tsx` | Loading skeleton for admin directory |
| `src/app/[locale]/(protected)/admin/proyectos/error.tsx` | Error boundary for admin directory |
| `src/app/[locale]/(protected)/admin/proyectos/nuevo/page.tsx` | Admin Project Creation page (RSC) |
| `src/app/[locale]/(protected)/admin/proyectos/nuevo/_components/admin-create-form.tsx` | Admin project creation client form |
| `src/app/[locale]/(protected)/admin/proyectos/[id]/page.tsx` | Admin Project Workspace entry point (RSC) |
| `src/app/[locale]/(protected)/admin/proyectos/[id]/loading.tsx` | Loading skeleton for admin workspace |
| `src/app/[locale]/(protected)/admin/proyectos/[id]/error.tsx` | Error boundary for admin workspace |
| `src/app/[locale]/(protected)/pm/proyectos/page.tsx` | PM Project Directory entry point (RSC) |
| `src/app/[locale]/(protected)/pm/proyectos/loading.tsx` | Loading skeleton for PM directory |
| `src/app/[locale]/(protected)/pm/proyectos/error.tsx` | Error boundary for PM directory |
| `src/app/[locale]/(protected)/pm/proyectos/nuevo/page.tsx` | PM Project Creation page (RSC) |
| `src/app/[locale]/(protected)/pm/proyectos/nuevo/_components/pm-create-form.tsx` | PM project creation client form |
| `src/app/[locale]/(protected)/pm/proyectos/[id]/page.tsx` | PM Project Workspace entry point (RSC) |
| `src/app/[locale]/(protected)/pm/proyectos/[id]/loading.tsx` | Loading skeleton for PM workspace |
| `src/app/[locale]/(protected)/pm/proyectos/[id]/error.tsx` | Error boundary for PM workspace |
| `src/lib/projects/actions.ts` | Server actions for projects and membership operations |
| `src/components/shared/projects/project-directory/project-directory-view.tsx` | Controlled directory container |
| `src/components/shared/projects/project-directory/project-table.tsx` | Desktop project table |
| `src/components/shared/projects/project-directory/project-card-list.tsx` | Mobile project cards |
| `src/components/shared/projects/project-directory/project-filters.tsx` | Search and filter controls |
| `src/components/shared/projects/project-directory/project-empty-state.tsx` | Localized empty state |
| `src/components/shared/projects/project-workspace/project-workspace-shell.tsx` | Workspace layout container with tabs |
| `src/components/shared/projects/project-workspace/project-header.tsx` | Workspace top header and action menu |
| `src/components/shared/projects/project-workspace/project-overview-tab.tsx` | Overview tab view with client setup banner |
| `src/components/shared/projects/project-workspace/project-edit-dialog.tsx` | Project metadata & client assignment edit dialog |
| `src/components/shared/projects/project-workspace/project-status-dialog.tsx` | Project status transition dialogs |
| `src/components/shared/projects/project-workspace/placeholders/tasks-tab-placeholder.tsx` | Placeholder for Tasks tab (S04-04) |
| `src/components/shared/projects/project-workspace/placeholders/deliverables-tab-placeholder.tsx` | Placeholder for Deliverables tab (S04-06) |
| `src/components/shared/projects/project-members/member-roster-tab.tsx` | Project members list and governance |
| `src/components/shared/projects/project-members/member-capacity-badge.tsx` | Badge for member capacities |
| `src/components/shared/projects/project-members/add-member-dialog.tsx` | Add member dialog |
| `src/components/shared/projects/project-members/remove-member-dialog.tsx` | Remove member alert dialog |
| `src/components/shared/projects/project-members/set-primary-lead-dialog.tsx` | Reassign primary lead dialog |
| `__tests__/projects/actions.test.ts` | Unit tests for project Server Actions |
| `__tests__/projects/directory-view.test.tsx` | Component tests for directory filtering and rendering |
| `__tests__/projects/membership-governance.test.tsx` | Component tests for membership governance interactions |

### Files to MODIFY

| File Path | Changes |
|---|---|
| `src/lib/projects/schemas.ts` | Allow optional `client_id` for planning client projects and add `client_id` to `UpdateProjectSchema` |
| `src/components/shared/app-nav/app-nav.tsx` | Enable active `Link` components for Admin & PM project paths |
| `src/components/shared/app-nav/_components/mobile-nav-toggle.tsx` | Enable active project links in mobile drawer |
| `messages/es-MX.json` | Add `projects` message dictionary (Spanish) including client setup warning banner |
| `messages/en-US.json` | Add `projects` message dictionary (English) including client setup warning banner |

---

## 9. Verification matrix and acceptance criteria

### 9.1 Automated test suite

```bash
# Run schema and error unit tests
npm run test -- __tests__/projects/

# Run typecheck and linting
npm run typecheck
npm run lint
```

#### Required Automated Test Coverage:
1. **Server Actions (`__tests__/projects/actions.test.ts`):**
   - `createProjectAction`: Rejects unauthorized actors; validates client project requires client organization; validates internal project rejects client org; sets up initial PM lead atomically.
   - `updateProjectAction`: Rejects modification of `project_type`; allows updating title, description, deadline, drive link.
   - `addProjectMemberAction`: Rejects adding client member to internal project; enforces capacity role compatibility.
   - `setPrimaryPmLeadAction`: Demotes prior primary lead and promotes target lead.
   - `removeProjectMemberAction`: Accurately surfaces error when attempting to remove the last primary lead.
2. **Directory & Filters (`__tests__/projects/directory-view.test.tsx`):**
   - Renders desktop table on wide viewport and mobile card list on narrow viewport.
   - Search filter accurately matches project name and client scope.
   - Status and type dropdown filters filter rows correctly without page reloads.
   - Empty state renders CTA when list is empty.
3. **Membership Governance UI (`__tests__/projects/membership-governance.test.tsx`):**
   - Renders capacity badges correctly (Primary Lead, Watcher, Operator, Client).
   - PM Watcher view hides add/remove/promote action buttons.
   - Add member dialog filters available users by selected capacity.

---

### 9.2 Manual verification journeys

| Journey | Role | Steps | Expected Outcome |
|---|---|---|---|
| **J1: Admin Client Project Creation** | `admin` | Navigate to `/admin/proyectos` → Click "Nuevo Proyecto" → Fill in client project details, pick client org, pick primary PM lead → Submit. | Project is created; user is redirected to `/admin/proyectos/[id]`; team shows assigned PM Lead (Primary) and Client contact. |
| **J2: PM Internal Project Creation** | `pm` | Navigate to `/pm/proyectos` → Click "Nuevo Proyecto" → Select "Interno" → Fill name & description → Submit. | Project is created without client fields; creating PM is automatically designated Primary PM Lead; Deliverables tab is disabled. |
| **J3: Membership Governance & Primary Lead Rotation** | `admin` / `pm_lead` | Open workspace `Members` tab → Click "Agregar Miembro" → Add a secondary PM Lead → Click "Hacer PM Lead Principal" on the new lead. | Target lead becomes primary; previous lead demotes to secondary lead; trigger invariants pass without error. |
| **J4: PM Watcher Read-Only Enforcement** | `pm_watcher` | Sign in as a PM assigned as `pm_watcher` → Open project workspace. | Directory and Workspace are viewable; "Editar", "Pausar", "Agregar Miembro", and action menus are hidden from the UI. |
| **J5: Responsive & Theme Validation** | `admin` | Toggle Light/Dark mode; resize viewport to 375px mobile width. | Theme persists across pages; table shifts to readable stacked cards; touch targets are >= 44px; no horizontal trapping. |

---

## 10. Stop conditions & explicit boundaries

| Condition | Action |
|---|---|
| A database trigger rejects a project mutation due to missing initial members | Do NOT bypass with raw SQL. Use coordinated batch insertion in Server Action so trigger validates upon commit. |
| A requirement asks for task Kanban moves or deliverable uploads in S04-03 | Stop. Defer task Kanban to S04-04 and deliverables to S04-06. Render structured placeholders only. |
| A requirement asks for direct Client portal login or Operator execution drawer | Stop. Defer to E6 and E7. S04-03 governs internal Admin/PM project workspace only. |
| Missing translation keys between `es-MX.json` and `en-US.json` | Block PR until full key parity is achieved. |

---

## 11. Definition of done

S04-03 is complete when:
- [ ] Admin and PM project navigation links in `AppNav` and `MobileNavToggle` are active and functional.
- [ ] Responsive project directories exist at `/admin/proyectos` and `/pm/proyectos` with search, filters, table/card views, and empty states.
- [ ] Project creation works for both client and internal projects, correctly enforcing client organization constraints and establishing initial team members.
- [ ] Project workspace shell is live at `/admin/proyectos/[id]` and `/pm/proyectos/[id]` with Overview, Members, and placeholder tabs.
- [ ] Membership governance allows adding, updating, removing members, and rotating the primary PM Lead within database trigger constraints.
- [ ] PM Watcher capacity is strictly read-only in the UI.
- [ ] All user-visible strings are localized in `es-MX.json` and `en-US.json` with 100% key parity.
- [ ] Automated tests pass (`npm run test`, `npm run typecheck`, `npm run lint`).

---

*Spec written: 2026-08-19. Authority: Sprint S04 Plan (S04-03).*
