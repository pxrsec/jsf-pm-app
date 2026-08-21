# Sprint 04 Closeout Verification Note

## 1. Sprint Identity & Execution Metadata

- **Sprint ID**: S04
- **Epics**: 
  - **E04**: Project & Task Workspace Governance
  - **E05**: Production Deliverable & Review Lifecycle
- **Feature Slug**: `project-workspace-and-production-deliverable-lifecycle`
- **Branch**: `feature/s04-e04-e05-project-workspace-and-production-deliverable-lifecycle`
- **Completion Date**: 2026-08-21
- **Node.js Environment**: `v24.18.0`
- **Next.js Version**: `16.3.1` (Turbopack compiler)
- **Status**: Sprint Complete / Ready for Review

---

## 2. Definition of Done Checklist

| # | Sprint Plan DoD Criterion (§7) | Verdict | Evidence Citation |
|---|---|---|---|
| 1 | **Role-Authoritative Governance**: Admin has global project/member authority; PM Lead governs assigned project tasks, members, capacity, deliverables; PM Watcher is strictly read-only for planning mutations with advisory collaboration commenting and link reporting privileges; Operator (E06) and Client (E07) workspaces are explicitly deferred | **Met** | `__tests__/projects/membership-governance.test.tsx`, `__tests__/deliverables/deliverable-actions.test.ts`, `__tests__/app-shell/route-guard.test.ts`; Journeys J-01..J-08 |
| 2 | **Directory & Workspace Parity**: Admin and PM project directories filter, sort, and display active and assigned projects with exact status and role attribution | **Met** | `__tests__/projects/directory-view.test.tsx`; `src/components/shared/projects/project-directory/`; Journeys J-01, J-02 |
| 3 | **Task Lifecycle & Kanban Board**: 5-state task lifecycle (`pending`, `in_progress`, `in_review`, `completed`, `blocked`) with kanban board and list view enforcing permitted transitions (including `completed` -> `in_progress`), blocking priority semantics, assignee capacity validation, and activity logging | **Met** | `__tests__/projects/task-workspace.test.tsx`, `__tests__/projects/task-status-semantics.test.tsx`, `__tests__/projects/tasks.test.ts`; `src/lib/projects/task-actions.ts` |
| 4 | **Production Deliverables & Review Lifecycle**: Production deliverables support multi-version submission, internal review by PM Lead, progression to `awaiting_client_review` state with truthful waiting notice (Client review decision UI deferred to E07), final delivery marking, link issue reporting, and immutable audit history | **Met** | `__tests__/deliverables/deliverable-actions.test.ts`, `__tests__/projects/deliverables-workspace.test.tsx`, `__tests__/deliverables/validators.test.ts`, `__tests__/deliverables/schemas.test.ts` |
| 5 | **Authoritative Lifecycle & Completion**: Projects support completed status with review banner, cycle tracking, and reopen governance preserving historical audit trails | **Met** | `__tests__/projects/project-lifecycle.test.tsx`; `src/lib/projects/lifecycle-actions.ts`; `src/components/shared/projects/project-workspace/completed-project-banner.tsx` |
| 6 | **Safe Error & Recovery Boundaries**: Project directory and workspace error boundaries render localized, safe recovery UI with retry and return actions without leaking database exceptions, digests, or stack traces; missing or unauthorized workspaces present safe 404 boundaries | **Met** | `__tests__/projects/project-recovery-state.test.tsx`; `src/components/shared/projects/project-workspace/project-recovery-state.tsx`; `src/app/[locale]/(protected)/admin/proyectos/error.tsx`, `src/app/[locale]/(protected)/pm/proyectos/error.tsx` |
| 7 | **Accessible & Internationalized Loading Boundaries**: Loading states render semantic skeletons with `role="status"`, `aria-busy="true"`, `aria-live="polite"`, and visually hidden localized text from `projects.workspace.recovery.loading` | **Met** | `src/app/[locale]/(protected)/admin/proyectos/loading.tsx`, `src/app/[locale]/(protected)/pm/proyectos/loading.tsx`; `src/app/[locale]/(protected)/admin/proyectos/[id]/loading.tsx`, `src/app/[locale]/(protected)/pm/proyectos/[id]/loading.tsx` |
| 8 | **Global Navigation Integration**: AppNav and MobileNavToggle provide live, locale-preserving links to `/admin/proyectos` for Admin and `/pm/proyectos` for PM; secondary future items remain accessible and `aria-disabled` for Operator and Client | **Met** | `__tests__/app-shell/navigation.test.ts`; `src/components/shared/app-nav/app-nav.tsx`, `src/components/shared/app-nav/_components/mobile-nav-toggle.tsx`; Journeys J-01..J-06 |
| 9 | **Localization Parity**: 100% message catalog key and segment parity between `messages/es-MX.json` and `messages/en-US.json` across all new and pre-existing namespaces | **Met** | `__tests__/i18n/message-catalogs.test.ts`, `__tests__/i18n/key-naming.test.ts` (9/9 tests pass) |
| 10 | **Full Verification Pipeline**: Clean execution of full repository verification pipeline (`npm run verify` exited with code 0; 0 lint errors, 0 type errors, 344 passed tests, 0 vulnerabilities) | **Met** | Full automated verification output recorded in §4 below |

---

## 3. Changed Files Inventory

### S04-01: Visual Foundation, shadcn/ui Inventory, ThemeProvider & Persisted Theming
- `src/components/ui/alert-dialog.tsx` — Shadcn alert dialog primitive
- `src/components/ui/badge.tsx` — Shadcn badge primitive
- `src/components/ui/button.tsx` — Shadcn button primitive
- `src/components/ui/card.tsx` — Shadcn card primitive
- `src/components/ui/checkbox.tsx` — Shadcn checkbox primitive
- `src/components/ui/command.tsx` — Shadcn command primitive
- `src/components/ui/dialog.tsx` — Shadcn dialog primitive
- `src/components/ui/dropdown-menu.tsx` — Shadcn dropdown menu primitive
- `src/components/ui/input.tsx` — Shadcn input primitive
- `src/components/ui/input-group.tsx` — Input group container
- `src/components/ui/label.tsx` — Shadcn label primitive
- `src/components/ui/popover.tsx` — Shadcn popover primitive
- `src/components/ui/select.tsx` — Shadcn select primitive
- `src/components/ui/separator.tsx` — Shadcn separator primitive
- `src/components/ui/sheet.tsx` — Shadcn sheet/drawer primitive
- `src/components/ui/table.tsx` — Shadcn table primitive
- `src/components/ui/textarea.tsx` — Shadcn textarea primitive
- `src/components/ui/tooltip.tsx` — Shadcn tooltip primitive
- `src/components/shared/theme/theme-provider.tsx` — Client theme provider wrapper
- `src/components/shared/theme/theme-toggle.tsx` — Accessible theme selector dropdown
- `src/config/app.config.ts` — Client configuration constants
- `src/config/server.config.ts` — Server environment configuration
- `__tests__/config/app.config.test.ts` — App config tests
- `__tests__/config/server.config.test.ts` — Server config tests
- `__tests__/config/prisma-guard.test.ts` — ORM guard tests

### S04-02: Workspace Command-Boundary Reconciliation, Mutation Adapters & Status Maps
- `src/lib/projects/commands.ts` — Authoritative project, membership, and task mutation commands
- `src/lib/projects/errors.ts` — Sanitized project error definitions and mapper
- `src/lib/projects/actions.ts` — Project-level Server Actions
- `src/lib/projects/schemas.ts` — Project Zod validation schemas
- `src/lib/status-maps.ts` — Visual status, priority, and decision mappings
- `src/lib/sentry.ts` — Sentry runtime observability wrapper
- `__tests__/projects/actions.test.ts` — Project action tests
- `__tests__/projects/schemas.test.ts` — Project schema tests
- `__tests__/projects/errors.test.ts` — Project error mapping tests
- `__tests__/lib/sentry.test.ts` — Sentry error capture tests

### S04-03: Project Directory, Creation & Membership Governance
- `src/app/[locale]/(protected)/admin/proyectos/page.tsx` — Admin project directory route
- `src/app/[locale]/(protected)/admin/proyectos/nuevo/page.tsx` — Admin project creation route
- `src/app/[locale]/(protected)/pm/proyectos/page.tsx` — PM project directory route
- `src/app/[locale]/(protected)/pm/proyectos/nuevo/page.tsx` — PM project creation route
- `src/components/shared/projects/project-directory/project-directory-view.tsx` — Directory view container
- `src/components/shared/projects/project-directory/project-table.tsx` — Tabular project display
- `src/components/shared/projects/project-directory/project-card-list.tsx` — Responsive card grid
- `src/components/shared/projects/project-directory/project-filters.tsx` — Directory filter and search bar
- `src/components/shared/projects/project-directory/project-empty-state.tsx` — Localized directory empty state
- `src/components/shared/projects/project-members/member-roster-tab.tsx` — Roster management tab
- `src/components/shared/projects/project-members/add-member-dialog.tsx` — Member addition modal
- `src/components/shared/projects/project-members/remove-member-dialog.tsx` — Member removal modal
- `src/components/shared/projects/project-members/change-capacity-dialog.tsx` — Capacity allocation modal
- `src/components/shared/projects/project-members/set-primary-lead-dialog.tsx` — Primary lead transfer modal
- `src/components/shared/projects/project-members/member-capacity-badge.tsx` — Visual capacity indicator
- `src/lib/projects/queries.ts` — Authoritative project and membership queries
- `__tests__/projects/directory-view.test.tsx` — Directory view unit tests
- `__tests__/projects/membership-governance.test.tsx` — Membership governance unit tests

### S04-04: Project Workspace, Task Planning & Constrained Kanban
- `src/app/[locale]/(protected)/admin/proyectos/[id]/page.tsx` — Admin project workspace route
- `src/app/[locale]/(protected)/pm/proyectos/[id]/page.tsx` — PM project workspace route
- `src/components/shared/projects/project-workspace/project-workspace-shell.tsx` — Workspace tabbed container
- `src/components/shared/projects/project-workspace/project-header.tsx` — Workspace header and metadata
- `src/components/shared/projects/project-workspace/project-overview-tab.tsx` — Overview metrics and timeline
- `src/components/shared/projects/project-tasks/tasks-tab.tsx` — Task workspace tab
- `src/components/shared/projects/project-tasks/task-kanban-board.tsx` — 5-column drag/button kanban board
- `src/components/shared/projects/project-tasks/task-kanban-column.tsx` — Kanban column component
- `src/components/shared/projects/project-tasks/task-kanban-card.tsx` — Task summary card
- `src/components/shared/projects/project-tasks/task-list-view.tsx` — Tabular task list
- `src/components/shared/projects/project-tasks/task-list-row.tsx` — Task list row
- `src/components/shared/projects/project-tasks/task-create-dialog.tsx` — Task creation modal
- `src/components/shared/projects/project-tasks/task-edit-dialog.tsx` — Task edit modal
- `src/components/shared/projects/project-tasks/task-archive-dialog.tsx` — Task archiving modal
- `src/components/shared/projects/project-tasks/task-detail-sheet.tsx` — Task detail slide-over
- `src/components/shared/projects/project-tasks/task-status-select.tsx` — Status transition selector
- `src/components/shared/projects/project-tasks/task-priority-badge.tsx` — Priority visual badge
- `src/components/shared/projects/project-tasks/task-status-badge.tsx` — Status visual badge
- `src/components/shared/projects/project-tasks/task-filters.tsx` — Task filtering controls
- `src/components/shared/projects/project-tasks/task-comments-section.tsx` — Task collaboration comments
- `src/lib/comments/commands.ts` — Task comment persistence
- `src/lib/comments/queries.ts` — Task comment queries
- `src/lib/comments/schemas.ts` — Task comment validation schemas
- `src/lib/projects/task-actions.ts` — Server actions for task mutations
- `__tests__/projects/task-workspace.test.tsx` — Task workspace UI tests
- `__tests__/projects/task-status-semantics.test.tsx` — Status machine transition tests
- `__tests__/projects/tasks.test.ts` — Task schema and business rules tests
- `__tests__/comments/schemas.test.ts` — Comment schema tests

### S04-05: Project Completion, Reopening & Audit Context
- `src/components/shared/projects/project-lifecycle/project-complete-dialog.tsx` — Complete project modal
- `src/components/shared/projects/project-lifecycle/project-reopen-dialog.tsx` — Reopen project modal
- `src/components/shared/projects/project-workspace/completed-project-banner.tsx` — Banner for completed projects
- `src/components/shared/projects/project-workspace/completion-cycles-card.tsx` — Completion cycle history
- `src/components/shared/projects/project-workspace/project-activity-tab.tsx` — Project activity and cycle tab
- `src/lib/projects/lifecycle-actions.ts` — Project completion and reopening actions
- `__tests__/projects/project-lifecycle.test.tsx` — Project lifecycle transition tests

### S04-06: Deliverable Planning, Submission & Immutable History
- `src/components/shared/projects/project-deliverables/deliverables-tab.tsx` — Deliverables workspace tab
- `src/components/shared/projects/project-deliverables/deliverable-list.tsx` — Deliverables listing view
- `src/components/shared/projects/project-deliverables/deliverable-card.tsx` — Deliverable summary card
- `src/components/shared/projects/project-deliverables/deliverable-create-dialog.tsx` — Deliverable creation modal
- `src/components/shared/projects/project-deliverables/deliverable-edit-dialog.tsx` — Deliverable edit modal
- `src/components/shared/projects/project-deliverables/deliverable-submit-dialog.tsx` — Version submission modal
- `src/components/shared/projects/project-deliverables/deliverable-archive-dialog.tsx` — Deliverable archive modal
- `src/components/shared/projects/project-deliverables/deliverable-detail-sheet.tsx` — Deliverable detail slide-over
- `src/components/shared/projects/project-deliverables/deliverable-history.tsx` — Version audit history
- `src/components/shared/projects/project-deliverables/formal-feedback-history.tsx` — Review feedback timeline
- `src/components/shared/projects/project-deliverables/deliverable-comments-section.tsx` — Deliverable discussion
- `src/components/shared/projects/project-deliverables/deliverable-link-report-dialog.tsx` — External link report modal
- `src/components/shared/projects/project-deliverables/deliverable-status-badge.tsx` — Status visual badge
- `src/lib/deliverables/actions.ts` — Server actions for deliverables
- `src/lib/deliverables/comment-actions.ts` — Deliverable comment actions
- `src/lib/deliverables/auth-checks.ts` — Role and membership eligibility gates
- `src/lib/deliverables/commands.ts` — Deliverable mutation commands
- `src/lib/deliverables/queries.ts` — Deliverable view and detail queries
- `src/lib/deliverables/schemas.ts` — Deliverable Zod schemas
- `src/lib/deliverables/validators.ts` — Google Drive URL validation helpers
- `src/lib/deliverables/errors.ts` — Deliverable error definitions
- `__tests__/deliverables/deliverable-actions.test.ts` — Deliverable actions unit test suite
- `__tests__/deliverables/validators.test.ts` — Google Drive URL validator tests
- `__tests__/deliverables/schemas.test.ts` — Deliverable schema tests

### S04-07: Internal Review, Resubmission, Release & Final Delivery
- `src/components/shared/projects/project-deliverables/deliverable-review-dialog.tsx` — Formal review decision modal
- `src/components/shared/projects/project-deliverables/deliverable-delivery-dialog.tsx` — Final delivery modal
- `src/components/shared/projects/project-deliverables/deliverables-filter-bar.tsx` — Deliverables filtering controls
- `src/lib/deliverables/review-actions.ts` — Review and delivery server actions
- `__tests__/projects/deliverables-workspace.test.tsx` — Deliverables UI integration tests

### S04-08: Navigation, Localization, Focused Evidence & Sprint Closeout
- `messages/es-MX.json` — Spanish message catalogs (recovery namespace, deliverable dialogs)
- `messages/en-US.json` — English message catalogs (recovery namespace, deliverable dialogs)
- `src/components/shared/projects/project-workspace/project-recovery-state.tsx` — Shared recovery presentation component
- `src/app/[locale]/(protected)/admin/proyectos/error.tsx` — Admin directory error boundary
- `src/app/[locale]/(protected)/admin/proyectos/[id]/error.tsx` — Admin workspace error boundary
- `src/app/[locale]/(protected)/pm/proyectos/error.tsx` — PM directory error boundary
- `src/app/[locale]/(protected)/pm/proyectos/[id]/error.tsx` — PM workspace error boundary
- `src/app/[locale]/(protected)/admin/proyectos/[id]/not-found.tsx` — Admin missing/unauthorized project not-found boundary
- `src/app/[locale]/(protected)/pm/proyectos/[id]/not-found.tsx` — PM missing/unauthorized project not-found boundary
- `src/app/[locale]/(protected)/admin/proyectos/loading.tsx` — Admin directory loading skeleton
- `src/app/[locale]/(protected)/admin/proyectos/[id]/loading.tsx` — Admin workspace loading skeleton
- `src/app/[locale]/(protected)/pm/proyectos/loading.tsx` — PM directory loading skeleton
- `src/app/[locale]/(protected)/pm/proyectos/[id]/loading.tsx` — PM workspace loading skeleton
- `src/components/shared/app-nav/app-nav.tsx` — Locale-preserving main navigation
- `src/components/shared/app-nav/_components/mobile-nav-toggle.tsx` — Mobile drawer navigation
- `__tests__/projects/project-recovery-state.test.tsx` — Recovery state component unit tests
- `__tests__/app-shell/navigation.test.ts` — Navigation integration tests
- `__tests__/i18n/key-naming.test.ts` — Key naming convention tests
- `__tests__/integration/role-journey.test.ts` — Cross-role journey integration tests
- `dev-docs/specs/s04/s04-sprint-04-closeout-verification.md` — This sprint closeout verification document

---

## 4. Automated Verification Results

Executed command: `npm run verify` (`npm run format:check && npm run lint && npm run typecheck && npm run build && npm run test && npm run test:coverage && npm run audit:prod`)

| Verification Check | Exact Command | Factual Outcome | Exit Code |
|---|---|---|---|
| **Formatting** | `npm run format:check` | **Passed** (`All matched files use Prettier code style!`) | `0` |
| **Linting** | `npm run lint` | **Passed** (`0 errors, 0 warnings`) | `0` |
| **Typecheck** | `npm run typecheck` | **Passed** (`tsc --noEmit` exited cleanly) | `0` |
| **Production Build** | `npm run build` | **Passed** (Next.js 16.3.1 Turbopack build succeeded, 23 routes compiled) | `0` |
| **Unit & Integration Tests** | `npm run test` | **Passed** (45 test files passed, 344 passed, 0 failed, 9 skipped) | `0` |
| **Test Coverage** | `npm run test:coverage` | **Passed** (All suites executed with v8 coverage) | `0` |
| **Dependency Audit** | `npm run audit:prod` | **Passed** (`found 0 vulnerabilities`) | `0` |

### Key Test Suite Breakdown
- `__tests__/i18n/message-catalogs.test.ts`: 6 passed
- `__tests__/i18n/key-naming.test.ts`: 3 passed
- `__tests__/app-shell/navigation.test.ts`: 11 passed
- `__tests__/projects/project-recovery-state.test.tsx`: 6 passed
- `__tests__/deliverables/deliverable-actions.test.ts`: 20 passed
- `__tests__/projects/deliverables-workspace.test.tsx`: 13 passed
- `__tests__/projects/project-lifecycle.test.tsx`: 15 passed
- `__tests__/projects/task-workspace.test.tsx`: 4 passed
- `__tests__/projects/task-status-semantics.test.tsx`: 6 passed
- `__tests__/projects/tasks.test.ts`: 12 passed
- `__tests__/projects/membership-governance.test.tsx`: 4 passed
- `__tests__/projects/directory-view.test.tsx`: 5 passed
- `__tests__/integration/role-journey.test.ts`: 13 passed

---

## 5. Manual Localhost Demonstration Journey Records

The following 8 focused journeys were executed and validated against local sandbox state:

| Journey # | Persona & Context | Entry URL | Action | Expected Result | Observed Result | Verdict |
|---|---|---|---|---|---|---|
| **J-01** | Admin, Spanish desktop | `/admin` | Click "Proyectos" in top navigation bar | Navigates to `/admin/proyectos`; directory is fully usable; no dead or placeholder link | Navigated to `/admin/proyectos`; active project table rendered with complete filters and create project button | **Pass** |
| **J-02** | PM Lead, Spanish desktop | `/pm` | Click "Proyectos" in top navigation, open assigned project, switch to Tasks and Deliverables tabs | Navigates to `/pm/proyectos`; allowed workspace loads; task/deliverable controls governed by role | Navigated to `/pm/proyectos`; workspace opened; Kanban board and Deliverables list responsive | **Pass** |
| **J-03** | Admin, English desktop | `/en/admin/proyectos` | Switch to English, navigate workspace, trigger recovery state | Route renders under `/en`; recovery copy in English; return link redirects to `/en/admin/proyectos` without data leak | English recovery view rendered with "Error loading workspace" and return link to `/en/admin/proyectos` | **Pass** |
| **J-04** | PM, English desktop | `/en/pm/proyectos/[id]` | Open assigned project workspace in English; test recovery action | Recovery copy in English; return action directs to `/en/pm/proyectos`; no authorization facts disclosed | English recovery rendered with "Back to Assigned Projects" link pointing to `/en/pm/proyectos` | **Pass** |
| **J-05** | Operator & Client (desktop & mobile) | `/operador`, `/cliente` | Inspect secondary navigation items ("Agenda", "Proyectos") | Item is visibly unavailable, carries `aria-disabled="true"`, skipped by keyboard tab order | Rendered with `aria-disabled="true"` and non-navigable styling; cannot navigate to unbuilt routes | **Pass** |
| **J-06** | Admin / PM, narrow mobile (375px) | `/admin` or `/pm` | Open hamburger toggle, click "Proyectos", then reopen drawer and press Escape | Drawer opens, "Proyectos" link navigates and closes drawer; Escape key dismisses drawer | Mobile drawer opened smoothly; link navigation closed drawer; Escape key restored focus to toggle button | **Pass** |
| **J-07** | PM Lead, mobile & themes | `/pm/proyectos/[id]` | Execute task and deliverable creation/inspection in Light and Dark themes at 375px | All controls adapt cleanly and maintain WCAG contrast in both themes | Theme toggle adapted workspace; no horizontal scrolling; task/deliverable dialogs usable | **Pass** |
| **J-08** | PM Watcher / Unrelated PM | `/pm/proyectos/[unauthorized-id]` | Direct navigation to unauthorized project workspace | Server safely denies access via generic not-found boundary without leaking project existence | Safe `not-found.tsx` boundary displayed with generic copy and return link to `/pm/proyectos` | **Pass** |

---

## 6. Localization Impact & Message Parity

All message keys added during Sprint 04 are organized under semantic namespaces with 100% key parity between `messages/es-MX.json` and `messages/en-US.json`:

- `projects.directory.*`: `title`, `description`, `adminTitle`, `adminDescription`, `pmTitle`, `pmDescription`, `createProjectAction`, `filters.*`, `table.*`, `card.*`, `emptyState.*`
- `projects.workspace.*`: `title`, `description`, `tabs.*` (`overview`, `tasks`, `deliverables`, `roster`, `activity`), `overview.*`, `activity.*`, `header.*`, `statusDialog.*`, `editDialog.*`
- `projects.workspace.recovery.*`: `directory.title`, `directory.description`, `workspace.title`, `workspace.description`, `pmWorkspace.description`, `retryAction`, `returnToProjectsAction`, `returnToAssignedProjectsAction`, `loading`
- `projects.members.*`: `title`, `description`, `addMemberAction`, `removeMemberAction`, `changeCapacityAction`, `setLeadAction`, `table.*`, `dialogs.*`
- `projects.tasks.*`: `title`, `description`, `createTaskAction`, `editTaskAction`, `archiveTaskAction`, `kanban.*`, `list.*`, `detail.*`, `comments.*`, `status.*`, `priority.*`, `filters.*`
- `projects.lifecycle.*`: `completeProjectAction`, `reopenProjectAction`, `completedBanner.*`, `cyclesCard.*`, `dialogs.*`
- `projects.workspace.deliverables.*`: `title`, `description`, `createDeliverableAction`, `editDeliverableAction`, `archiveDeliverableAction`, `submitVersionAction`, `reviewDialog.*`, `deliveryDialog.*`, `linkReportDialog.*`, `detail.*`, `history.*`, `feedback.*`, `comments.*`, `filters.*`, `status.*`

Parity is enforced automatically by `__tests__/i18n/key-naming.test.ts` and `__tests__/i18n/message-catalogs.test.ts`.

---

## 7. Accessibility Impact (WCAG 2.1 AA)

- **Semantic Landmarks**:
  - Global navigation landmark: `<nav aria-label="Navegación principal">` / `<nav aria-label="Main navigation">`
  - Workspace subnavigation tabs: `<TabsList role="tablist">` with proper `role="tab"` and `role="tabpanel"` associations
  - Main landmark: `<main id="main-content">`
- **ARIA States & Attributes**:
  - Disabled navigation items: `aria-disabled="true"`
  - Mobile drawer toggle: `aria-expanded="false|true"` and `aria-controls="mobile-nav-drawer"`
  - Route loading skeletons: `role="status"`, `aria-busy="true"`, `aria-live="polite"` with `<span className="sr-only">` localized loading text
  - Dialogs and Sheet components: `aria-modal="true"`, `aria-labelledby`, `aria-describedby`
- **Keyboard Navigation & Focus Management**:
  - All interactive elements (kanban cards, buttons, dropdowns, links) are keyboard-operable via `Tab`, `Enter`, `Space`, and arrow keys.
  - Pressing `Escape` reliably dismisses open modals, sheets, and the mobile navigation drawer, restoring focus to the triggering element.

---

## 8. Security & Boundary Statement

1. **Server-Authoritative RBAC**: Authorization checks occur exclusively on the server (`src/lib/auth/session.ts`, `src/lib/deliverables/auth-checks.ts`, `src/app/[locale]/(protected)/layout.tsx`). No client-side role claims are trusted.
2. **Strict RLS & Database Policy**: All database access honors Row Level Security (RLS) under Supabase. No direct Prisma or parallel ORM schema mutation exists.
3. **Secret Isolation**: Privileged secrets (`SUPABASE_SECRET_KEY`) reside exclusively in server-only modules (`src/config/server.config.ts`). Secrets never reach browser bundles, logs, or error responses.
4. **Sanitized Error Boundaries**: Error boundaries (`error.tsx`) capture exceptions to Sentry with `{ boundary: "localized-route" }` without leaking raw database exceptions or stack traces; `not-found.tsx` boundaries render safe, generic, localized not-found views with return actions for missing or unauthorized project access without disclosing authorization details.
5. **Idempotent Mutations & Audit Trails**: Critical lifecycle transitions (completion, reopen, deliverable submission, review decisions) enforce monotonic state progression and immutable audit logging.

---

## 9. Git Mutation Statement

In accordance with `GEMINI.md` execution rules:
- **Git Mutation**: **None** (0 git mutations performed by Antigravity sessions).
- Working tree modifications are confined to tracked source and documentation files.

---

## 10. Sprint 05 Hand-Off & Stable Contracts

Sprint 05 may import and build upon the following stable, tested contracts without modification:

- **Project Data & Actions**:
  - `listProjectsForAdmin`, `listProjectsForPm`, `getProjectDetail`, `getCompletionCycles`, `getProjectMembers` from `@/lib/projects/queries`
  - `createProjectAction`, `updateProjectAction`, `transitionProjectStatusAction`, `archiveProjectAction`, `restoreProjectAction`, `addProjectMemberAction`, `updateProjectMemberAction`, `removeProjectMemberAction`, `setPrimaryPmLeadAction` from `@/lib/projects/actions`
  - `reopenProjectAction`, `getCompletionReadinessAction` from `@/lib/projects/lifecycle-actions`
- **Task Data & Actions**:
  - `listProjectTasks`, `getTaskDetail`, `listTaskResources` from `@/lib/projects/queries`
  - `createTaskAction`, `updateTaskAction`, `transitionTaskStatusAction`, `archiveTaskAction`, `createTaskCommentAction`, `listTaskCommentsAction` from `@/lib/projects/task-actions`
- **Deliverables Data & Actions**:
  - `listProjectDeliverables`, `getDeliverableDetail`, `listDeliverableVersions`, `listVersionFeedback` from `@/lib/deliverables/queries`
  - `createDeliverableAction`, `updateDeliverableAction`, `archiveDeliverableAction`, `submitDeliverableVersionAction`, `reportDeliverableLinkAction`, `getDeliverableDetailAction` from `@/lib/deliverables/actions`
  - `reviewDeliverableAction`, `markDeliverableDeliveredAction` from `@/lib/deliverables/review-actions`
  - `createDeliverableCommentAction`, `listDeliverableCommentsAction` from `@/lib/deliverables/comment-actions`
- **Navigation & Workspace Presentation**:
  - `AppNav`, `MobileNavToggle` from `src/components/shared/app-nav/`
  - `ProjectRecoveryState` from `src/components/shared/projects/project-workspace/project-recovery-state`
  - `ProjectDirectoryView` from `src/components/shared/projects/project-directory/project-directory-view`
  - `ProjectWorkspaceShell` from `src/components/shared/projects/project-workspace/project-workspace-shell`
