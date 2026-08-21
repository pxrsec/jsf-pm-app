# Sprint 04 Closeout Verification Note

## 1. Sprint Identity & Execution Metadata

- **Sprint ID**: S04
- **Epics**: 
  - **E04**: Project & Task Workspace Governance
  - **E05**: Production Deliverable & Review Lifecycle
- **Feature Slug**: `project-workspace-and-production-deliverable-lifecycle`
- **Branch**: `feature/s04-e04-e05-project-workspace-and-production-deliverables`
- **Completion Date**: 2026-08-21
- **Node.js Environment**: `v24.18.0`
- **Next.js Version**: `16.3.1` (Turbopack compiler)
- **Status**: Sprint Complete / Ready for Review

---

## 2. Definition of Done Checklist

| # | Sprint Plan DoD Criterion (§6) | Verdict | Evidence Citation |
|---|---|---|---|
| 1 | **Role-Authoritative Governance**: Admin has global project/member authority; PM Lead governs assigned project tasks, members, capacity, deliverables; PM Watcher is strictly read-only; Operator and Client access is constrained to assigned tasks/deliverables | **Met** | `__tests__/projects/membership-governance.test.tsx`, `__tests__/deliverables/deliverable-actions.test.ts`, `__tests__/app-shell/route-guard.test.ts`; Journeys J-01..J-08 |
| 2 | **Directory & Workspace Parity**: Admin and PM project directories filter, sort, and display active and assigned projects with exact status and role attribution | **Met** | `__tests__/projects/directory-view.test.tsx`; `src/components/shared/projects/project-directory/`; Journeys J-01, J-02 |
| 3 | **Task Lifecycle & Kanban Board**: 4-column kanban board and list view enforce linear/reopening status semantics, blocking priority, assignee capacity validation, and activity logging | **Met** | `__tests__/projects/task-workspace.test.tsx`, `__tests__/projects/task-status-semantics.test.tsx`, `__tests__/projects/tasks.test.ts`; `src/lib/projects/task-actions.ts` |
| 4 | **Production Deliverables & Versions**: Deliverables support multi-version submission, internal review by PM Lead, client review, link reports, and immutable audit trails | **Met** | `__tests__/deliverables/deliverable-actions.test.ts`, `__tests__/projects/deliverables-workspace.test.tsx`, `__tests__/deliverables/validators.test.ts`, `__tests__/deliverables/schemas.test.ts` |
| 5 | **Authoritative Lifecycle & Completion**: Projects support completed status with review banner, cycle tracking, and reopen governance preserving historical audit trails | **Met** | `__tests__/projects/project-lifecycle.test.tsx`; `src/lib/projects/lifecycle-actions.ts`; `src/components/shared/projects/project-workspace/completed-project-banner.tsx` |
| 6 | **Safe Error & Recovery Boundaries**: Project directory and workspace error boundaries render localized, safe recovery UI with retry and return actions without leaking database exceptions, digests, or stack traces | **Met** | `__tests__/projects/project-recovery-state.test.tsx`; `src/components/shared/projects/project-workspace/project-recovery-state.tsx`; `src/app/[locale]/(protected)/admin/proyectos/error.tsx`, `src/app/[locale]/(protected)/pm/proyectos/error.tsx` |
| 7 | **Accessible & Internationalized Loading Boundaries**: Loading states render semantic skeletons with `role="status"`, `aria-busy="true"`, `aria-live="polite"`, and visually hidden localized text from `projects.workspace.recovery.loading` | **Met** | `src/app/[locale]/(protected)/admin/proyectos/loading.tsx`, `src/app/[locale]/(protected)/pm/proyectos/loading.tsx`; `src/app/[locale]/(protected)/admin/proyectos/[id]/loading.tsx`, `src/app/[locale]/(protected)/pm/proyectos/[id]/loading.tsx` |
| 8 | **Global Navigation Integration**: AppNav and MobileNavToggle provide live, locale-preserving links to `/admin/proyectos` for Admin and `/pm/proyectos` for PM; secondary future items remain accessible and `aria-disabled` for Operator and Client | **Met** | `__tests__/app-shell/navigation.test.ts`; `src/components/shared/app-nav/app-nav.tsx`, `src/components/shared/app-nav/_components/mobile-nav-toggle.tsx`; Journeys J-01..J-06 |
| 9 | **Localization Parity**: 100% message catalog key and segment parity between `messages/es-MX.json` and `messages/en-US.json` across all new and pre-existing namespaces | **Met** | `__tests__/i18n/message-catalogs.test.ts`, `__tests__/i18n/key-naming.test.ts` (9/9 tests pass) |
| 10 | **Full Verification Pipeline**: Clean execution of full repository verification pipeline (`npm run verify` exited with code 0; 0 lint errors, 0 type errors, 344 passed tests, 0 vulnerabilities) | **Met** | Full automated verification output recorded in §4 below |

---

## 3. Changed Files Inventory

### S04-01: Shared Design System, Project Directory & Workspace Shell
- `src/app/[locale]/(protected)/admin/proyectos/page.tsx` — Admin project directory route
- `src/app/[locale]/(protected)/admin/proyectos/[id]/page.tsx` — Admin project workspace route
- `src/app/[locale]/(protected)/admin/proyectos/nuevo/page.tsx` — Admin project creation route
- `src/app/[locale]/(protected)/pm/proyectos/page.tsx` — PM project directory route
- `src/app/[locale]/(protected)/pm/proyectos/[id]/page.tsx` — PM project workspace route
- `src/app/[locale]/(protected)/pm/proyectos/nuevo/page.tsx` — PM project creation route
- `src/components/shared/projects/project-directory/project-directory-view.tsx` — Directory view container
- `src/components/shared/projects/project-directory/project-table.tsx` — Tabular project display
- `src/components/shared/projects/project-directory/project-card-list.tsx` — Responsive card grid
- `src/components/shared/projects/project-directory/project-filters.tsx` — Filter and search bar
- `src/components/shared/projects/project-directory/project-empty-state.tsx` — Localized empty state
- `src/components/shared/projects/project-workspace/project-workspace-shell.tsx` — Workspace tabbed shell
- `src/components/shared/projects/project-workspace/project-header.tsx` — Workspace title, status badge, metadata
- `src/components/shared/projects/project-workspace/project-overview-tab.tsx` — Overview metrics and timeline
- `src/components/shared/projects/project-workspace/project-activity-tab.tsx` — Audit and activity timeline
- `src/lib/projects/queries.ts` — Authoritative project queries
- `src/lib/projects/actions.ts` — Server actions for project mutations
- `src/lib/projects/schemas.ts` — Zod validation schemas
- `src/lib/projects/errors.ts` — Sanitized error definitions
- `__tests__/projects/directory-view.test.tsx` — Directory view unit tests

### S04-02: Member Governance, Roster Management & Capacity Allocation
- `src/components/shared/projects/project-members/member-roster-tab.tsx` — Roster management tab
- `src/components/shared/projects/project-members/add-member-dialog.tsx` — Member addition modal
- `src/components/shared/projects/project-members/remove-member-dialog.tsx` — Member removal modal
- `src/components/shared/projects/project-members/change-capacity-dialog.tsx` — Capacity allocation modal
- `src/components/shared/projects/project-members/set-primary-lead-dialog.tsx` — Lead transfer modal
- `src/components/shared/projects/project-members/member-capacity-badge.tsx` — Visual capacity indicator
- `__tests__/projects/membership-governance.test.tsx` — Member governance unit tests

### S04-03: Task Lifecycle, Status Machine & Kanban Board
- `src/components/shared/projects/project-tasks/tasks-tab.tsx` — Task workspace tab
- `src/components/shared/projects/project-tasks/task-kanban-board.tsx` — 4-column drag/button kanban board
- `src/components/shared/projects/project-tasks/task-kanban-column.tsx` — Kanban column component
- `src/components/shared/projects/project-tasks/task-kanban-card.tsx` — Task summary card
- `src/components/shared/projects/project-tasks/task-list-view.tsx` — Tabular task list
- `src/components/shared/projects/project-tasks/task-list-row.tsx` — Task row component
- `src/components/shared/projects/project-tasks/task-create-dialog.tsx` — Task creation modal
- `src/components/shared/projects/project-tasks/task-edit-dialog.tsx` — Task edit modal
- `src/components/shared/projects/project-tasks/task-archive-dialog.tsx` — Task archiving modal
- `src/components/shared/projects/project-tasks/task-detail-sheet.tsx` — Task detail slide-over
- `src/components/shared/projects/project-tasks/task-status-select.tsx` — Status transition select
- `src/components/shared/projects/project-tasks/task-priority-badge.tsx` — Priority visual badge
- `src/components/shared/projects/project-tasks/task-status-badge.tsx` — Status visual badge
- `src/components/shared/projects/project-tasks/task-filters.tsx` — Task filtering controls
- `src/lib/projects/task-actions.ts` — Server actions for task mutations
- `__tests__/projects/task-workspace.test.tsx` — Task workspace UI tests
- `__tests__/projects/task-status-semantics.test.tsx` — Status machine transition tests
- `__tests__/projects/tasks.test.ts` — Task schema and business rules tests

### S04-04: Task Collaboration Comments & Sentry Observability
- `src/components/shared/projects/project-tasks/task-comments-section.tsx` — Collaboration comments component
- `src/lib/comments/commands.ts` — Authoritative comment persistence
- `src/lib/comments/queries.ts` — Comment retrieval queries
- `src/lib/comments/schemas.ts` — Comment validation schemas
- `__tests__/comments/schemas.test.ts` — Comment schema unit tests
- `__tests__/lib/sentry.test.ts` — Sentry error capture tests

### S04-05: Authoritative Project Completion, Reopen Governance & Cycles
- `src/components/shared/projects/project-lifecycle/project-complete-dialog.tsx` — Complete project modal
- `src/components/shared/projects/project-lifecycle/project-reopen-dialog.tsx` — Reopen project modal
- `src/components/shared/projects/project-workspace/completed-project-banner.tsx` — Banner for completed projects
- `src/components/shared/projects/project-workspace/completion-cycles-card.tsx` — Completion cycle history
- `src/lib/projects/lifecycle-actions.ts` — Authoritative project lifecycle actions
- `__tests__/projects/project-lifecycle.test.tsx` — Project lifecycle transition tests

### S04-06 & S04-07: Production Deliverable Planning, Review & Final Delivery
- `src/components/shared/projects/project-deliverables/deliverables-tab.tsx` — Deliverables workspace tab
- `src/components/shared/projects/project-deliverables/deliverable-list.tsx` — Deliverables listing view
- `src/components/shared/projects/project-deliverables/deliverable-card.tsx` — Deliverable summary card
- `src/components/shared/projects/project-deliverables/deliverable-create-dialog.tsx` — Deliverable creation modal
- `src/components/shared/projects/project-deliverables/deliverable-edit-dialog.tsx` — Deliverable edit modal
- `src/components/shared/projects/project-deliverables/deliverable-submit-dialog.tsx` — Version submission modal
- `src/components/shared/projects/project-deliverables/deliverable-review-dialog.tsx` — Formal review decision modal
- `src/components/shared/projects/project-deliverables/deliverable-delivery-dialog.tsx` — Final delivery modal
- `src/components/shared/projects/project-deliverables/deliverable-link-report-dialog.tsx` — External link report modal
- `src/components/shared/projects/project-deliverables/deliverable-archive-dialog.tsx` — Deliverable archive modal
- `src/components/shared/projects/project-deliverables/deliverable-detail-sheet.tsx` — Deliverable detail slide-over
- `src/components/shared/projects/project-deliverables/deliverable-history.tsx` — Version audit history
- `src/components/shared/projects/project-deliverables/formal-feedback-history.tsx` — Review feedback timeline
- `src/components/shared/projects/project-deliverables/deliverable-comments-section.tsx` — Deliverable discussion
- `src/components/shared/projects/project-deliverables/deliverables-filter-bar.tsx` — Deliverables filtering
- `src/components/shared/projects/project-deliverables/deliverable-status-badge.tsx` — Status visual badge
- `src/lib/deliverables/actions.ts` — Server actions for deliverables
- `src/lib/deliverables/review-actions.ts` — Review and delivery server actions
- `src/lib/deliverables/auth-checks.ts` — Role and membership eligibility gates
- `src/lib/deliverables/commands.ts` — Supabase RPC and table mutations
- `src/lib/deliverables/queries.ts` — Deliverable view and detail queries
- `src/lib/deliverables/schemas.ts` — Zod schemas for deliverables
- `src/lib/deliverables/validators.ts` — Validation helpers
- `src/lib/deliverables/errors.ts` — Sanitized error definitions
- `__tests__/deliverables/deliverable-actions.test.ts` — Deliverable actions unit test suite
- `__tests__/projects/deliverables-workspace.test.tsx` — Deliverables UI integration tests
- `__tests__/deliverables/validators.test.ts` — Validator unit tests
- `__tests__/deliverables/schemas.test.ts` — Deliverable schema tests

### S04-08: Navigation Integration, Route Recovery, Loading Boundaries & Closeout
- `messages/es-MX.json` — Added `projects.workspace.recovery` namespace (Spanish)
- `messages/en-US.json` — Added `projects.workspace.recovery` namespace (English)
- `src/components/shared/projects/project-workspace/project-recovery-state.tsx` — Shared presentational recovery component with Sentry capture and locale-aware return link
- `src/app/[locale]/(protected)/admin/proyectos/error.tsx` — Admin directory error boundary
- `src/app/[locale]/(protected)/admin/proyectos/[id]/error.tsx` — Admin workspace error boundary
- `src/app/[locale]/(protected)/pm/proyectos/error.tsx` — PM directory error boundary
- `src/app/[locale]/(protected)/pm/proyectos/[id]/error.tsx` — PM workspace error boundary
- `src/app/[locale]/(protected)/admin/proyectos/[id]/not-found.tsx` — Admin missing/unauthorized project not-found boundary
- `src/app/[locale]/(protected)/pm/proyectos/[id]/not-found.tsx` — PM missing/unauthorized project not-found boundary
- `src/app/[locale]/(protected)/admin/proyectos/loading.tsx` — Admin directory loading skeleton with live region
- `src/app/[locale]/(protected)/admin/proyectos/[id]/loading.tsx` — Admin workspace loading skeleton with live region
- `src/app/[locale]/(protected)/pm/proyectos/loading.tsx` — PM directory loading skeleton with live region
- `src/app/[locale]/(protected)/pm/proyectos/[id]/loading.tsx` — PM workspace loading skeleton with live region
- `src/components/shared/app-nav/app-nav.tsx` — Updated to use `@/i18n/routing` Link and active Admin/PM links
- `src/components/shared/app-nav/_components/mobile-nav-toggle.tsx` — Updated drawer with active Admin/PM links
- `__tests__/projects/project-recovery-state.test.tsx` — Recovery state component unit tests
- `__tests__/app-shell/navigation.test.ts` — Navigation integration tests with active and disabled link assertions
- `__tests__/i18n/key-naming.test.ts` — Key naming convention tests with semantic whitelist update
- `__tests__/integration/role-journey.test.ts` — Cross-role journey integration tests with routing mock
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
| **J-06** | Admin / PM, narrow mobile (375px) | `/admin` or `/pm` | Open hamburger toggle, click "Proyectos", then reopen drawer and press Escape | Drawer opens, "Proyectos" link navigates and closes drawer; Escape key dismisses drawer | Mobile drawer opened smoothly; link navigation closed drawer; Escape key restored focus | **Pass** |
| **J-07** | PM Lead, mobile & themes | `/pm/proyectos/[id]` | Execute task and deliverable creation/inspection in Light and Dark themes at 375px | All controls maintain touch-target sizing (min 44px) and WCAG contrast in both themes | Theme toggle adapted workspace; no horizontal scrolling; task/deliverable dialogs usable | **Pass** |
| **J-08** | PM Watcher / Unrelated PM | `/pm/proyectos/[unauthorized-id]` | Direct navigation to unauthorized project workspace | Server safely denies access via generic not-found/recovery boundary without leaking project existence | Safe `not-found.tsx` boundary displayed with generic copy and return link to `/pm/proyectos` | **Pass** |

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
  - Global navigation landmark: `<nav aria-label="Navegación principal">`
  - Workspace subnavigation tabs: `<TabsList role="tablist">` with proper `role="tab"` and `role="tabpanel"` associations
  - Main landmark: `<main id="main-content">`
- **ARIA States & Attributes**:
  - Active navigation links: `aria-current="page"`
  - Disabled navigation items: `aria-disabled="true"`
  - Mobile drawer toggle: `aria-expanded="false|true"` and `aria-controls="mobile-nav-drawer"`
  - Route loading skeletons: `role="status"`, `aria-busy="true"`, `aria-live="polite"` with `<span className="sr-only">` localized text
  - Dialogs and Sheet components: `aria-modal="true"`, `aria-labelledby`, `aria-describedby`
- **Keyboard Navigation & Focus Management**:
  - All interactive elements (kanban cards, buttons, dropdowns, links) are keyboard-operable via `Tab`, `Enter`, `Space`, and arrow keys.
  - Dialogs and sheets trap focus upon opening and return focus to triggering elements upon closing.
  - Pressing `Escape` reliably dismisses open modals, sheets, and the mobile navigation drawer.

---

## 8. Security & Boundary Statement

1. **Server-Authoritative RBAC**: Authorization checks occur exclusively on the server (`src/lib/auth/session.ts`, `src/lib/deliverables/auth-checks.ts`, `src/app/(protected)/layout.tsx`). No client-side role claims are trusted.
2. **Strict RLS & Database Policy**: All database access honors Row Level Security (RLS) under Supabase. No direct Prisma or parallel ORM schema mutation exists.
3. **Secret Isolation**: Privileged secrets (`SUPABASE_SECRET_KEY`) reside exclusively in server-only modules (`src/config/server.config.ts`). Secrets never reach browser bundles, logs, or error responses.
4. **Sanitized Error Boundaries**: Error and not-found boundaries sanitize all outputs; raw database errors, error digests, and internal stack traces are captured to Sentry and replaced with safe, localized user copy.
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
  - `getProjectDetailQuery`, `listProjectsQuery` from `@/lib/projects/queries`
  - `createProjectAction`, `updateProjectAction` from `@/lib/projects/actions`
  - `completeProjectAction`, `reopenProjectAction` from `@/lib/projects/lifecycle-actions`
- **Task Data & Actions**:
  - `listTasksQuery`, `getTaskDetailQuery` from `@/lib/projects/queries`
  - `createTaskAction`, `updateTaskAction`, `archiveTaskAction`, `updateTaskStatusAction` from `@/lib/projects/task-actions`
- **Deliverables Data & Actions**:
  - `listDeliverablesQuery`, `getDeliverableDetailQuery` from `@/lib/deliverables/queries`
  - `createDeliverableAction`, `updateDeliverableAction`, `archiveDeliverableAction`, `submitDeliverableVersionAction` from `@/lib/deliverables/actions`
  - `reviewDeliverableAction`, `markDeliverableDeliveredAction`, `createLinkReportAction` from `@/lib/deliverables/review-actions`
- **Navigation & Workspace Presentation**:
  - `AppNav`, `MobileNavToggle` from `src/components/shared/app-nav/`
  - `ProjectRecoveryState` from `src/components/shared/projects/project-workspace/project-recovery-state`
  - `ProjectDirectoryView`, `ProjectWorkspaceShell` from `src/components/shared/projects/`
