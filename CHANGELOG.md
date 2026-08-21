# JSF PM App Development Changelog

## [2026-08-21 @ 12:55]

**🚀 Deliverables English Localization Completeness & Factual Sprint 04 Closeout Record**

- **🌐 Localization Completeness (Blocker 2 Resolved):**
  - **Deliverable Component String Extraction (`deliverable-edit-dialog.tsx`, `deliverable-create-dialog.tsx`, `deliverable-history.tsx`, `deliverable-link-report-dialog.tsx`):** Extracted all remaining user-visible hardcoded strings into `projects.workspace.deliverables.*` keys across both `messages/es-MX.json` and `messages/en-US.json`. Added localized field labels (`statusLabel`, `versionLabel`, `titleLabel`, `assigneeLabel`, `assigneePlaceholder`, `userFallback`, `specificationsLabel`, `submissionDeadlineLabel`, `internalReviewDeadlineLabel`, `clientDeliveryDeadlineLabel`), submitter fallback (`teamMemberFallback`), and external link disclaimer notice (`truthfulnessNotice`).
  - **100% Translation Parity & Key Hygiene:** Maintained strict dot-delimited lower camelCase key hierarchy verified by `__tests__/i18n/message-catalogs.test.ts` and `__tests__/i18n/key-naming.test.ts`.
- **📝 Factual Sprint 04 Closeout Verification Record (Blocker 1 Resolved):**
  - **DoD & Feature Grounding (`dev-docs/specs/s04/s04-sprint-04-closeout-verification.md`):** Updated the Definition-of-Done and hand-off records to strictly mirror codebase realities: documented PM Watcher advisory commenting capabilities and explicit deferral of E06 Operator / E07 Client workspaces; documented the 5-state task lifecycle (`pending`, `in_progress`, `in_review`, `completed`, `blocked`); clarified that deliverable lifecycle progresses to `awaiting_client_review` with Client decision UI deferred to E07; corrected accessibility declarations (Escape restoration, semantic landmarks, loading live regions); clarified Sentry error boundary vs localized 404 boundary handling; updated handoff contract exports to verbatim symbols (`listProjectsForAdmin`, `listProjectsForPm`, `getProjectDetail`, `createTaskAction`, `transitionTaskStatusAction`, `reportDeliverableLinkAction`, `reviewDeliverableAction`, `markDeliverableDeliveredAction`).
- **🧪 Automated Verification Pipeline:**
  - `npm run verify`: Exited with code 0 across all 7 verification steps.
  - `npm run format:check`: 100% Prettier compliant.
  - `npm run lint`: 0 errors, 0 warnings.
  - `npm run typecheck`: 0 TypeScript errors.
  - `npm run build`: Production Next.js 16.3.1 Turbopack build compiled all 23 routes.
  - `npm run test`: 45 test files passed (344 passed, 0 failed, 9 skipped).
  - `npm run test:coverage`: Full v8 coverage generated across all application modules.
  - `npm run audit:prod`: 0 vulnerabilities.

## [2026-08-21 @ 12:10]

**🚀 Navigation Localization, Route Recovery, Loading Boundaries, and Sprint 04 Closeout (S04-08)**

- **🚀 Features & Integration:**
  - **Locale-Preserving Global Navigation (`src/components/shared/app-nav/app-nav.tsx`, `mobile-nav-toggle.tsx`):** Integrated Next-Intl routing `Link` into `AppNav` and `MobileNavToggle` to preserve canonical `/en` and `/es` locale prefixes. Activated live links for Admin (`/admin/proyectos`) and PM (`/pm/proyectos`), while keeping Operator and Client future-work items visibly unavailable and `aria-disabled="true"`.
  - **Shared Project Recovery State Component (`src/components/shared/projects/project-workspace/project-recovery-state.tsx`):** Created a safe presentational recovery component capturing exceptions to Sentry with `{ boundary: "localized-route" }`, rendering localized title/description, retry button (`reset`), and optional locale-aware return link without leaking raw database exceptions, digests, or stack traces.
  - **Route Error & Not-Found Boundaries:** Updated Admin and PM directory and workspace route error boundaries (`admin/proyectos/error.tsx`, `admin/proyectos/[id]/error.tsx`, `pm/proyectos/error.tsx`, `pm/proyectos/[id]/error.tsx`) to consume `ProjectRecoveryState`. Added safe localized `not-found.tsx` boundaries for unauthorized/missing project handling.
  - **Accessible Internationalized Loading Boundaries:** Updated Admin and PM directory and workspace `loading.tsx` boundaries to Server Components with `role="status"`, `aria-busy="true"`, `aria-live="polite"`, and screen-reader localized loading text from `projects.workspace.recovery.loading`.
  - **100% Translation Parity (`messages/es-MX.json`, `messages/en-US.json`):** Added `projects.workspace.recovery` namespace with full Spanish and English parity covering directory, workspace, retry, and return actions.
- **🛠 Architecture & Code Hygiene:**
  - **ESLint & React Compiler Compliance:** Refactored `deliverable-comments-section.tsx` and `deliverable-review-dialog.tsx` to eliminate synchronous `setState` in `useEffect`. Replaced `watch()` with `useWatch()` in deliverable dialogs for React Compiler compatibility.
  - **Strict TypeScript & Test Suite Hardening:** Eliminated explicit `any` usage in test suites (`deliverable-actions.test.ts`), added `// @vitest-environment jsdom` and `@testing-library/jest-dom/vitest` matchers to DOM tests, and added `@/i18n/routing` mocks to integration tests.
- **🧪 Sprint 04 Closeout & Full Verification:**
  - `npm run verify`: Exited with code 0 across all 7 verification gates.
  - `npm run format:check`: 100% Prettier compliant.
  - `npm run lint`: 0 errors, 0 warnings.
  - `npm run typecheck`: 0 TypeScript errors (`tsc --noEmit`).
  - `npm run build`: Production Next.js 16.3.1 Turbopack build succeeded (all 23 static/dynamic routes compiled).
  - `npm run test`: 45 test files passed (344 passed, 0 failed, 9 skipped).
  - `npm run test:coverage`: Full v8 coverage generated across all application modules.
  - `npm run audit:prod`: 0 vulnerabilities.
  - Closeout verification record written to `dev-docs/specs/s04/s04-sprint-04-closeout-verification.md`.

## [2026-08-21 @ 10:43]

**🚀 Authoritative Internal Review, Resubmission, Release, and Final Delivery (S04-07)**

- **🚀 Features:**
  - **Authoritative PM Review & Final Delivery Actions (`src/lib/deliverables/review-actions.ts`):** Implemented direct async Server Actions (`reviewDeliverableAction`, `markDeliverableDeliveredAction`) with server-side PM Lead / Admin preauthorization, deliverable project verification, strict state transition validation, and RPC invocations (`review_deliverable` with stage pinned to `internal`, and `mark_deliverable_delivered`).
  - **Active-PM-Lead Preauthorization Alignment (`src/lib/deliverables/auth-checks.ts`):** Aligned `verifyPmLeadCapacity` and `verifyProjectMemberAccess` with PostgreSQL authoritative function `private.is_project_lead` by verifying `profiles.is_active = true` and `profiles.deleted_at is null`.
  - **Safe Error Mapping (`src/lib/projects/errors.ts`):** Extended `mapSupabaseError` to recognize RPC authorization phrases (`"Only active PM Lead"`) and safely classify them as `UNAUTHORIZED`.
  - **Review & Delivery Schemas (`src/lib/deliverables/schemas.ts`):** Added `ReviewDeliverableActionSchema` (enforcing mandatory feedback comments on `changes_requested`) and `MarkDeliverableDeliveredActionSchema`.
  - **Review Decision Status Mapping (`src/lib/status-maps.ts`):** Defined `ReviewDecision` and `REVIEW_DECISION_MAP` exporting `approved` (ShieldCheck, green token) and `changes_requested` (RotateCcw, orange token).
  - **Controlled Review & Delivery Dialogs (`deliverable-review-dialog.tsx`, `deliverable-delivery-dialog.tsx`):** Added review modal with immutable notice, decision toggle, and character counter, alongside delivery modal featuring explicit workflow truthfulness disclaimers.
  - **Status-Aware Workspace Gating & Extraction (`deliverables-tab.tsx`, `deliverables-filter-bar.tsx`, `deliverable-detail-sheet.tsx`, `deliverable-list.tsx`, `deliverable-card.tsx`):** Extracted `DeliverablesFilterBar` to keep all components under 300 lines (well under the 400-line repository ceiling). Implemented status-aware action gating suppressing archive/mutation actions on `delivered` status, displaying review CTA for `awaiting_internal_review`, and displaying client review waiting notice for `awaiting_client_review`. Wired `router.refresh()` and detail view re-fetch on mutations.
  - **Full Dual-Locale Localization Parity (`messages/es-MX.json`, `messages/en-US.json`):** Localized all review/delivery dialogs, action labels, error keys, detail sheet banners, and fallback text strings.
- **🧪 Verification & Quality:**
  - `npx vitest run __tests__/deliverables/deliverable-actions.test.ts`: 20/20 passed.
  - `npx vitest run __tests__/deliverables/schemas.test.ts`: 18/18 passed.
  - `npx vitest run __tests__/projects/deliverables-workspace.test.tsx`: 13/13 passed.
  - `npm run typecheck`: 0 errors.
  - `npm run build`: Production Next.js Turbopack build succeeded with code 0.

## [2026-08-21 @ 09:27]

**🚀 Production Deliverable Planning, Submission, and Immutable History (S04-06)**

- **🚀 Features:**
  - **Hardened Google Drive Submission URLs (`validators.ts`, `schemas.ts`):** Enforced strict lexical URL checks rejecting non-HTTPS, raw whitespace, tabs, newlines, control characters, backslashes, userinfo credentials, non-Google hosts, and explicit port specifications (including `:443`). Preserved raw URL string without trimming to maintain boundary fidelity.
  - **PM Capacity & Eligibility Gates (`auth-checks.ts`, `actions.ts`):** Server-side enforcement restricting planning mutations (`createDeliverableAction`, `updateDeliverableAction`, `archiveDeliverableAction`) exclusively to project `pm_lead` or `admin`. Explicitly rejects `pm_watcher` from planning mutations while permitting link reporting, commenting, and read operations. Enforced comprehensive eligibility check (client project type, linked client organization, at least one active non-deleted client member, valid deliverable-enabled task, and active compatible assignee).
  - **Full Workspace Deliverables Module (`src/components/shared/projects/project-deliverables/*`):** Created responsive tab supporting list table and card view layouts, real-time status and assignee filtering, planning modals (`DeliverableCreateDialog`, `DeliverableEditDialog`, `DeliverableArchiveDialog`), version submission modal (`DeliverableSubmitDialog`), full detail sheet (`DeliverableDetailSheet`), immutable version timeline (`DeliverableHistory`), formal review audit history (`FormalFeedbackHistory`), informal collaboration comments (`DeliverableCommentsSection`), and link report alert dialog (`DeliverableLinkReportDialog`).
  - **Project Activity Tab (`project-activity-tab.tsx`):** Integrated dedicated activity view presenting completion cycles history projected from `project_completion_cycles_view`.
  - **Full Dual-Locale Localization (`messages/es-MX.json`, `messages/en-US.json`):** Delivered 100% synchronized, semantic translation keys for `projects.workspace.deliverables.*` and `projects.workspace.activity.*` adhering strictly to `VC-I18N-008` naming rules.
- **🛠 Architecture & Database:**
  - **Supabase Migrations Applied:** Applied `20260820153000_s04_06_harden_production_google_drive_submission_urls.sql` and `20260821100000_s04_06_allow_incomplete_client_project_planning.sql` on remote development database; regenerated `src/lib/database.types.ts`.
  - **Explicit Safe View Projections (`queries.ts`):** Defined strongly-typed projection interfaces (`DeliverableListItem`, `DeliverableDetailView`, `DeliverableVersionView`, `DeliverableFeedbackView`) avoiding wildcard selects or unbounded data models.
  - **Server Action Module Isolation (`comment-actions.ts`):** Modularized deliverable comment actions into dedicated `comment-actions.ts` and eliminated re-export statements from `"use server"` files to ensure strict Turbopack production compilation compliance.
  - **Strict Line Limit Compliance:** All 23 new and modified implementation files strictly satisfy the <= 400 lines repository rule.
- **🧪 Verification & Quality:**
  - `npm run build`: Production Turbopack build succeeded with code 0 (all static and dynamic routes compiled).
  - `npx tsc --noEmit`: 0 TypeScript errors.
  - `npm test`: 44 test suites passing (312 passed tests, 0 failures), including comprehensive unit tests for URL validators, schemas, server actions, and React Testing Library workspace components.


## [2026-08-20 @ 02:04]

**🐛 Next.js Server Action Module Compilation & I18N Key Compliance Hotfixes**

- **🐛 Hotfixes:**
  - **Server Action File Isolation (`src/lib/projects/actions.ts`, `src/lib/projects/lifecycle-actions.ts`):** Resolved Next.js Turbopack compiler failure (`Error: Export updateProjectAction doesn't exist in target module / The module has no exports at all`) by removing `export const` schemas and re-export statements from `"use server"` files. Relocated `ReopenProjectSchema`, `type ReopenProjectInput`, and `interface CreateProjectWithTeamInput` to `src/lib/projects/schemas.ts`. Updated client components and test suites to import actions directly from `@/lib/projects/lifecycle-actions`.
  - **Semantic Translation Key Compliance (`messages/es-MX.json`, `messages/en-US.json`):** Consolidated `projects.workspace.header.*` keys under `projects.workspace.summary.*` and updated `*Button` translation keys (`confirmButton`, `cancelButton`, `reopenButton`) to semantic `*Action` keys (`confirmAction`, `cancelAction`, `reopenAction`) to strictly satisfy `VC-I18N-008` rules forbidding visual/position/element keywords in translation namespaces.
  - **Codebase Formatting & Lint Hygiene:** Executed Prettier code formatting and eliminated unused `@typescript-eslint/no-unused-vars` warning in `actions.ts`.
- **🧪 Verification & Build:**
  - `npm run build`: Production Turbopack build succeeded with code 0 (all static and dynamic routes compiled).
  - `npm run typecheck`: 0 TypeScript errors.
  - `npm run lint`: 0 ESLint errors.
  - `npm run test`: All 42 test suites passing (291 passed tests, 0 failures).

## [2026-08-19 @ 17:48]

**🎯 Project Completion, Reopening, and Visible Audit Context (S04-05)**

- **🚀 Features:**
  - **Completion Preflight & Confirmation Modal (`project-complete-dialog.tsx`):** Built interactive completion flow utilizing `getCompletionReadinessAction` (`get_project_completion_readiness` RPC) to inspect unfinished work. Displays clear green indicator on full completion or amber warning detailing unfinished task and deliverable counts (with compact listing of up to 5 tasks), allowing PM Leads & Admins to execute an explicit confirmed override (`confirm_unfinished: true`).
  - **Reasoned Project Reopening Modal (`project-reopen-dialog.tsx`):** Implemented modal capturing mandatory reopening reason (1–500 characters) with real-time character counter and validation, calling `reopenProjectAction` (`transition_project_status` RPC with `next_status: "in_progress"`).
  - **Completed State Presentation (`completed-project-banner.tsx`):** Created read-only status banner for completed projects with formatted completion timestamp and conditional "Reabrir Proyecto" CTA for non-watcher actors.
  - **Workspace & Task Gating (`project-header.tsx`, `tasks-tab.tsx`):** Added context-aware header dropdown items ("Completar Proyecto" on active projects, "Reabrir Proyecto" on completed projects), suppressed invalid transitions (cancelling on completed state), preserved metadata editing capabilities, and gated "Nueva Tarea" creation controls when `project.status === "completed"`.
  - **Structured Completion Cycles History (`completion-cycles-card.tsx`):** Upgraded Overview tab cycle card to display all `project_completion_cycles_view` fields including cycle number, completion date, cycle duration in days, unfinished work override badges, reopened timestamps, active cycle badges, and recorded reopen reasons.
- **🛠 Architecture & Boundaries:**
  - **Lifecycle Server Actions (`src/lib/projects/lifecycle-actions.ts`):** Created dedicated server actions module housing `getCompletionReadinessAction` and `reopenProjectAction` with session role authorization (`admin` | `pm`), strict Zod validation (`ReopenProjectSchema`), and multi-route cache revalidations.
  - **Strict Line Limits:** Kept all 9 project components and server action files strictly under 400 lines (max 389 lines). Extracted `CompletionCyclesCard` to preserve file modularity.
  - **Full Localization Parity (`messages/es-MX.json` & `messages/en-US.json`):** Added 100% matching translation keys across `projects.workspace.completion.*`, `projects.workspace.reopen.*`, `projects.workspace.completedBanner.*`, `projects.workspace.header.*`, and `projects.workspace.overview.*`.
- **🧪 Verification & Build:**
  - `npm run test -- __tests__/projects/`: All 76 project tests passing across 9 test suites (including 15 dedicated lifecycle tests in `__tests__/projects/project-lifecycle.test.tsx`).
  - `npm run typecheck`: 0 TypeScript errors.
  - `npm run lint`: 0 ESLint errors.

## [2026-08-19 @ 16:48]

**📋 Project Workspace, Task Planning, and Constrained Kanban (S04-04)**

- **🚀 Features:**
  - **Constrained Kanban Board (`task-kanban-board.tsx`, `task-kanban-column.tsx`, `task-kanban-card.tsx`):** Built interactive drag-and-drop Kanban board powered by `@hello-pangea/dnd` across 5 status columns (`pending`, `in_progress`, `in_review`, `completed`, `blocked`) with optimistic updates, rollback on error, blocking priority indicator (`border-l-4 border-l-rose-400`), and watcher-mode view gating.
  - **Sortable Task List (`task-list-view.tsx`, `task-list-row.tsx`):** Implemented table view with multi-column sorting (title, priority, status, deadline) and row action menus.
  - **Multi-Dimensional Filters (`task-filters.tsx`):** Added filter controls for status, priority, task type (`internal_work` vs `client_request`), and assignee with active filter reset.
  - **Slide-Over Task Details (`task-detail-sheet.tsx`):** Built slide-over sheet displaying metadata, linked deliverable indicators, description, status machine transitions, and real-time collaboration comment feed.
  - **Creation, Edit & Archive Modals (`task-create-dialog.tsx`, `task-edit-dialog.tsx`, `task-archive-dialog.tsx`):** Type-safe forms powered by React Hook Form + Zod (`CreateTaskSchema`, `UpdateTaskSchema`), with `useWatch` optimization for React Compiler, client request gating on internal projects, and soft-delete with optional audit reason.
  - **Real-Time Collaboration Comments (`task-comments-section.tsx`):** Collaboration feed and compose form capturing `author_capacity_snapshot` and localized time-ago timestamps.
- **🛠 Architecture & Boundaries:**
  - **Server Actions Layer (`src/lib/projects/task-actions.ts`):** Implemented `createTaskAction`, `updateTaskAction`, `transitionTaskStatusAction`, `archiveTaskAction`, `createTaskCommentAction`, and `listTaskCommentsAction` with role checks, transactional RPC execution, and targeted path revalidation.
  - **Workspace Shell Integration (`project-workspace-shell.tsx`):** Replaced `TasksTabPlaceholder` with `<TasksTab>` in `ProjectWorkspaceShell`.
  - **Server Pre-Fetching:** Updated `/admin/proyectos/[id]` and `/pm/proyectos/[id]` page loaders to pre-fetch tasks via `listProjectTasks(supabase, id)` in parallel with project details.
  - **Strict Line Limits:** Kept all 16 component and server action modules strictly under 400 lines (max 394 lines in `actions.ts`).
  - **Localization Parity (`messages/es-MX.json` & `messages/en-US.json`):** 100% key parity under `projects.tasks.*` adhering strictly to `VC-I18N-008` (pure camelCase segments without forbidden keywords).
- **🐛 Hotfixes:**
  - **Server Action AST Module Transform:** Segregated task actions into dedicated `src/lib/projects/task-actions.ts` to eliminate Next.js server actions re-export bundler conflict and guarantee smooth production Turbopack builds.
- **🧪 Verification & Build:**
  - `npm run test`: All 276 tests across 41 test suites passing (including 61 project tests in `__tests__/projects/`).
  - `npm run typecheck`: 0 TypeScript errors.
  - `npm run lint`: 0 ESLint errors.
  - `npm run build`: Production Turbopack build succeeded with all static & dynamic routes compiled.

## [2026-08-19 @ 14:46]

**🚀 Project Directory, Project Creation, and Membership Governance (S04-03)**

- **Flexible Client Project Creation in Planning Stage:**
  - Added migration `20260819140000_s04_03_flexible_client_project_planning.sql` updating `private.validate_project_memberships()` to permit `0` client members and `null` `client_id` for client projects in `planning` status, while strictly enforcing $\ge 1$ client member and valid `client_id` upon advancing to active non-planning states.
  - Updated `CreateProjectSchema` and `UpdateProjectSchema` to make `client_id` optional and attachable later.
- **Server Actions Layer (`src/lib/projects/actions.ts`):**
  - Implemented `createProjectAction`, `updateProjectAction`, `addProjectMemberAction`, `updateProjectMemberAction`, `removeProjectMemberAction`, `setPrimaryPmLeadAction`, `transitionProjectStatusAction`, `archiveProjectAction`, and `restoreProjectAction` with strict role authorization, atomic rollback on member init failures, and path revalidation.
- **Navigation Integration:**
  - Activated live navigation links for `/admin/proyectos` and `/pm/proyectos` in desktop `AppNav` and responsive `MobileNavToggle`.
- **Project Directory Components (`src/components/shared/projects/project-directory/`):**
  - Created `ProjectDirectoryView`, `ProjectFilters`, `ProjectTable`, `ProjectCardList`, and `ProjectEmptyState` with debounced search, status and type filters, and responsive views.
- **Project Workspace & Governance (`src/components/shared/projects/project-workspace/` & `project-members/`):**
  - Created `ProjectWorkspaceShell`, `ProjectHeader`, `ProjectOverviewTab` (with Setup Warning Banner and quick client linking CTA), `ProjectEditDialog`, and `ProjectStatusDialog`.
  - Created `MemberRosterTab`, `MemberCapacityBadge` (with primary PM Lead star indicator), `AddMemberDialog`, `ChangeCapacityDialog`, `SetPrimaryLeadDialog`, and `RemoveMemberDialog`.
- **App Router Pages (`/admin/proyectos` & `/pm/proyectos`):**
  - Implemented full directory, creation forms (`AdminCreateForm`, `PmCreateForm`), and workspace detail pages with dedicated loading skeletons and error boundaries for both Admin and PM roles.
- **Automated Test Suite:**
  - Added unit and component tests in `__tests__/projects/` (`actions.test.ts`, `directory-view.test.tsx`, `membership-governance.test.tsx`, `schemas.test.ts`, `errors.test.ts`).
- **Verification:** All 254 test cases across 38 test suites passing; `npm run typecheck` and `npm run lint` clean with zero errors.

## [2026-08-19 @ 13:20]

**⚙️ Feature Data Layer & Command Boundary Reconciliation (S04-02)**

- **Authoritative Feature Data Layer (`src/lib/`):**
  - **Projects & Tasks Domain (`src/lib/projects/`):**
    - `schemas.ts`: Added strict Zod schemas with refinements (`CreateProjectSchema` enforcing client/internal organization constraints, `UpdateProjectSchema`, `TransitionProjectStatusSchema`, `RecoverProjectStatusSchema`, `AddProjectMemberSchema`, `UpdateProjectMemberSchema`, `CreateTaskSchema`, `UpdateTaskSchema`, and `TransitionTaskStatusSchema`).
    - `queries.ts`: Implemented typed server reads (`listProjectsForAdmin`, `listProjectsForPm`, `getProjectDetail`, `getCompletionCycles`, `listEligiblePmUsers`, `listEligibleOperators`, `listEligibleClientMembers`, `getProjectMembers`, `listProjectTasks`, `getTaskDetail`, `listTaskResources`).
    - `commands.ts`: Implemented type-safe server command adapters for RPCs (`transition_project_status`, `recover_project_status`, `get_project_completion_readiness`, `transition_task_status`, `soft_delete_entity`, `restore_entity`) and typed table operations (`createProject`, `updateProject`, `addProjectMember`, `updateProjectMember`, `setPrimaryPmLead`, `createTask`, `updateTask`).
    - `errors.ts`: Centralized safe error mapper (`mapSupabaseError`) and `CommandResult<T>` discriminated union for non-leaking error responses.
  - **Deliverables Domain (`src/lib/deliverables/`):**
    - `validators.ts`: Pure lexical Google Drive URL validator (`isValidGoogleDriveUrl` & `GOOGLE_DRIVE_URL_REGEX`) matching server-side RPC constraint `^https://(drive\.google\.com|docs\.google\.com)/` without network dereferencing.
    - `schemas.ts`: Added Zod schemas for deliverable creation (`CreateDeliverableSchema` production-only), planning updates (`UpdateDeliverableSchema`), submission (`SubmitDeliverableVersionSchema`), internal review (`ReviewDeliverableSchema` with mandatory comments on `changes_requested`), and link incident reporting (`ReportBrokenLinkSchema`).
    - `queries.ts`: Implemented typed server reads for deliverables, immutable version history (`listDeliverableVersions`), and version feedback (`listVersionFeedback`).
    - `commands.ts`: Implemented command adapters calling RPCs (`submit_deliverable_version`, `review_deliverable`, `mark_deliverable_delivered`, `report_broken_link`, `soft_delete_entity`) and typed table operations (`createDeliverable`, `updateDeliverable`).
    - `errors.ts`: Re-exported domain error types and safe error mappings.
  - **Collaboration Comments Domain (`src/lib/comments/`):**
    - `schemas.ts`: Added `CreateCommentSchema` validating target types (`project`, `task`, `deliverable`) and non-empty comment body.
    - `queries.ts`: Implemented `listComments` query fetching chronological comments with author profiles.
    - `commands.ts`: Implemented `createComment` command adapter invoking RPC `create_collaboration_comment`.
  - **Client Organizations Domain (`src/lib/clients/`):**
    - `schemas.ts`: Added `CreateClientSchema` enforcing URL-safe lowercase slugs and organization fields.
    - `queries.ts`: Implemented `listActiveClients`, `getClientById`, and `listClientContacts`.
    - `commands.ts`: Implemented `createClient` command adapter for organization creation.
- **Automated Test Coverage & Root Organization:**
  - Consolidated 100% of test suites under the root `__tests__/` directory (`__tests__/projects/`, `__tests__/deliverables/`, `__tests__/comments/`, `__tests__/clients/`, `__tests__/lib/`, `__tests__/theme/`).
- **Verification:** All 237 test cases across 35 test suites passing; `npm run typecheck`, `npm run lint`, and `npm run format:check` clean with 0 errors.

## [2026-08-19 @ 12:25]

**🎨 UI & Branding Enhancement: Iniciar Sesión Route**

- **Joya Purple Logo Integration:** Integrated `/joyalogo-purple.svg` directly onto the `/iniciar-sesion` (sign-in) card panel with responsive dimensions, smooth hover scale, and clean layout without an enclosing container box.
- **Ambient Lighting & Aesthetics:** Added subtle radial gradient backdrop glows matching the brand purple / accent palette in both light and dark modes.
- **Form Controls & Micro-Interactions:**
  - Upgraded input fields with Lucide icons (`Mail` and `Lock`), smooth focus rings, and accessible labels.
  - Implemented password visibility toggle button (`Eye` / `EyeOff`) with accessible ARIA label.
  - Added animated spinner (`Loader2`) for submit button loading states.
  - Enhanced error banner styling with `AlertCircle` icon.
- **Header Controls:** Added `ThemeToggle` alongside `LanguageSwitcher` in the sign-in page header.
- **ThemeToggle Hydration Refinement:** Updated `ThemeToggle` to utilize `useSyncExternalStore` for client mount detection, eliminating cascading renders and satisfying React 19 / ESLint rules.
- **Verification:** All 190 test cases across 29 test suites passing; TypeScript, ESLint, and Prettier passing with zero errors.

## [2026-08-19 @ 12:05]

**🎨 Visual Foundation & UI Architecture (S04-01)**

- **shadcn/ui & Design System Initialization:** Initialized shadcn/ui with Base UI Mira style, Neutral base palette, Indigo accent (`238 75% 60%`), and Lucide icon library configured for Tailwind CSS v4 via `@theme inline` tokens in `src/app/globals.css` and `components.json`.
- **UI Primitives Inventory:** Installed 20 required accessible UI primitives under `src/components/ui/` (`button`, `input`, `label`, `textarea`, `select`, `checkbox`, `badge`, `card`, `table`, `tabs`, `dialog`, `alert-dialog`, `sheet`, `dropdown-menu`, `popover`, `command`, `separator`, `skeleton`, `tooltip`, `sonner`, `input-group`).
- **CSP-Compliant Font Configuration:** Configured Google Fonts `Inter` (`--font-sans`) and `Geist_Mono` (`--font-mono`) self-hosted via `next/font/google` in `src/app/layout.tsx`, fully compliant with strict CSP (`font-src 'self' data:`).
- **Native Theme Switching & Persistence:**
  - Implemented `ThemeProvider` (`src/components/shared/theme/theme-provider.tsx`) wrapping `next-themes` with `defaultTheme="light"`, `enableSystem={false}`, and local storage persistence (`jsf-pm-theme`), with dev-mode console filtering for React 19 SSR anti-FOUC script tags.
  - Created `ThemeToggle` (`src/components/shared/theme/theme-toggle.tsx`) accessible dropdown menu with dynamic ARIA labels describing next actions, `aria-pressed`, `aria-current`, keyboard navigation, and a mounted lifecycle guard to eliminate SSR hydration mismatch with client-stored dark mode.
  - Added global `Toaster` component with `richColors` and bottom-right positioning.
- **Semantic Status Maps:** Created centralized semantic status and priority maps (`src/lib/status-maps.ts`) for `ProjectStatus`, `TaskStatus`, `TaskPriority` (with distinct `blocking` priority), `DeliverableStatus`, and `MemberCapacity`.
- **Global Shell & Auth Sweeps:**
  - Replaced hardcoded zinc/neutral styles and placeholder initials with semantic token classes, shadcn UI primitives, and `public/joya-icon.svg` brand mark across `AppNav`, `MobileNavToggle`, `NotificationBadge`, `SignOutButton`, and `LanguageSwitcher`.
  - Updated protected layouts, loading skeletons (`Skeleton`), and error boundaries across Admin, PM, Operator, and Client dashboards.
  - Upgraded authentication forms (`sign-in-form`, `reset-password-form`, `update-password-form`, `invitation-form`, `sesion-expirada`) to shadcn `Input`, `Label`, `Button`, and `Checkbox` primitives.
- **Localization (i18n):** Added 6 `theme.*` translation keys and navigation ARIA labels in both `messages/es-MX.json` and `messages/en-US.json`.
- **Automated Testing & Accessibility:**
  - Added unit test suites for `ThemeProvider` (`src/components/shared/theme/__tests__/theme-provider.test.tsx`) and `ThemeToggle` (`src/components/shared/theme/__tests__/theme-toggle.test.tsx`), validating default light mode, local storage persistence, `enableSystem={false}`, next-action ARIA labels, and zero `jest-axe` accessibility violations.
  - All 190 tests across 29 test suites passing; TypeScript, ESLint, Prettier, and Next.js production build (`npm run build`) passing with zero errors.

## [2026-08-19 @ 10:50]

**📋 Sprint 04 — Spec Updates (Project Owner decisions recorded)**

- Updated `dev-docs/specs/s04/s04-specs/s04-01-visual-foundation-shadcn-theming-spec.md` with two resolved Project Owner decisions:
  - **FLAG 3 resolved — Brand mark:** Use `public/joya-icon.svg` via `next/image` (`<Image src="/joya-icon.svg" alt="Joya" width={32} height={32} />`); fall back to plain `<img>` if SVG intrinsic-dimension issues arise; amber circle remains the last-resort exception
  - **FLAG 4 resolved — Monospace font:** shadcn/ui ships with Geist Mono as its standard mono font; load `Geist_Mono` from `next/font/google` and assign to `--font-mono` CSS variable (self-hosted, CSP-compliant); both `fontSans.variable` and `fontMono.variable` applied to `<html className>` in root layout
  - Updated Step 3b layout code, Step 7 brand mark instruction, acceptance criteria §7.2 checklist, and both FLAG sections to reflect the resolved state

## [2026-08-19 @ 10:37]

**📋 Sprint 04 — Documentation & Spec**

- Created `dev-docs/specs/s04/s04-specs/s04-01-visual-foundation-shadcn-theming-spec.md` (1,089 lines): highly detailed implementation specification for work item S04-01 (Visual Foundation: shadcn/ui initialization and persisted native theming), covering:
  - Pre-implementation baseline inventory (existing font conflicts, globals.css problems, CSP constraint)
  - Authoritative record of all Project Owner visual decisions (Mira style, Neutral palette, Indigo accent, Lucide icons, preset `b2J0x9uLeE`)
  - 12-step ordered implementation sequence with exact code snippets for root layout, ThemeProvider, ThemeToggle, globals.css rewrite, and CLI invocations
  - CSP conflict flag: Google Fonts CDN blocked; font loading must use `next/font/google` only
  - `prefers-color-scheme` conflict flag: existing media query must be removed to support `defaultTheme="light"` requirement
  - Sprint 04 shadcn primitive inventory install command (`button`, `input`, `label`, `textarea`, `select`, `checkbox`, `badge`, `card`, `table`, `tabs`, `dialog`, `alert-dialog`, `sheet`, `dropdown-menu`, `popover`, `command`, `separator`, `skeleton`, `tooltip`, `sonner`, `form`)
  - Full authenticated shell token sweep (AppNav, MobileNavToggle, protected layout, loading, error, auth forms) with old→new class replacement table
  - Semantic status mapping utilities specification (`src/lib/status-maps.ts`) for project status, task status, task priority, deliverable state, and member capacity
  - i18n key additions for `theme` namespace (6 keys) and `shell.nav` aria-label keys in both es-MX and en-US catalogs
  - Focused automated test requirements (ThemeProvider + ThemeToggle, 7+4 cases)
  - 8 acceptance criteria sections and full verification command suite
  - Explicit confirmation that no Supabase MCP operations are required for S04-01

## [2026-08-19 @ 09:31]

**⚙️ CI & Build Automation**

- Configured build-time mock environment variables in `.github/workflows/ci.yml` (`test-build` job), providing dummy `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY` during `npm run build` static route evaluation on headless CI runners

## [2026-08-18 @ 17:53]

**🚀 Features & Accessibility**

- Added global one-click `LanguageSwitcher` client component (`src/components/shared/language-switcher/language-switcher.tsx`) enabling immediate toggle between Spanish (`es-MX`) and English (`en-US`) with instant route replacement and active language highlight (`ES / EN`)
- Integrated `LanguageSwitcher` across the global desktop navigation bar (`AppNav`), mobile navigation drawer (`MobileNavToggle`), and all public account entry pages (`iniciar-sesion`, `restablecer-contrasena`, `actualizar-contrasena`, `invitacion`, `sesion-expirada`, `privacidad`)
- Added dedicated unit test suite (`__tests__/i18n/language-switcher.test.tsx`) verifying language switching, ARIA labels, and active states

## [2026-08-18 @ 17:42]

**🚀 Features & Architecture**

- Relocated protected route group into localized tree (`src/app/[locale]/(protected)/`), establishing clean unprefixed Spanish routes (`/admin`, `/pm`, `/operador`, `/cliente`) alongside localized English prefixed routes (`/en/admin`, `/en/pm`, etc.) under Next.js App Router and next-intl
- Implemented root route (`/` and `/en`) smart auto-redirect in `src/app/[locale]/page.tsx`, seamlessly redirecting unauthenticated visitors to `/iniciar-sesion` (or `/en/iniciar-sesion`) and authenticated sessions directly to their authoritative role dashboard
- Updated Content Security Policy (CSP) in `next.config.ts` to allow `'unsafe-eval'` strictly during development (`process.env.NODE_ENV !== "production"`), resolving React 19 / Turbopack dev-mode callstack reconstruction and eliminating browser console error overlays

## [2026-08-18 @ 16:15]

**🚀 Features & Testing**

- Added negative-path and cross-boundary security test suite (`__tests__/auth/negative-path.test.ts`, 19 tests) covering N-01 through N-20: invitation expiration/replay/mismatch handling, Zod token schema validation, magic link account-enumeration protection, password policy enforcement, deep-link unauthenticated & cross-role redirection, inactive/deleted profile containment, raw token leakage prevention, and credential exposure guards
- Added positive-path cross-role integration test suite (`__tests__/integration/role-journey.test.ts`, 13 tests) covering P-01 through P-24: role landing access for Admin, PM, Operator, and Client; profile full name rendering across all shells and `AppNav`; sign-out button interactions; landmark structure verification (`<nav aria-label>` and `<main id="main-content">`); accessibility attributes (`aria-current`, `aria-expanded`, `aria-disabled`, `aria-controls`, `aria-live`); and sign-in page locale isolation

**📖 Documentation**

- Created development persona access guide (`dev-docs/specs/s03/s03-e03-03-dev-persona-access.md`) documenting local-only authentication procedures for all 9 seeded personas, reference vs. sandbox corpora segregation, and access denial demonstration steps
- Created sprint closeout verification note (`dev-docs/specs/s03/s03-sprint-03-closeout-verification.md`) recording full definition of done compliance, changed file manifest, exact verification metrics (177 tests across 26 suites, 78.57% line coverage, 0 audit vulnerabilities), all 20 manual localhost journey records (J-01 through J-20), localization and accessibility impacts, and the Sprint 04 hand-off contract

## [2026-08-18 @ 15:30]

**🚀 Features**

- Implemented server-side protected route layout (`src/app/(protected)/layout.tsx`) utilizing `requireSession` to enforce authentication, profile activity, and cross-role URL containment with canonical redirection (`ROLE_DEFAULT_PATHS`)
- Added global navigation server component `AppNav` (`src/components/shared/app-nav/app-nav.tsx`) with role-safe navigation links, localized user profile affordances, in-app `NotificationBadge`, `SignOutButton` client component, and accessible `MobileNavToggle` drawer
- Created role-safe landing pages for all 4 personas: Admin (`/admin`), PM (`/pm`), Operator (`/operador`), and Client (`/cliente`) with dedicated loading skeletons (`loading.tsx`) and safe error boundary (`error.tsx`)
- Implemented `src/lib/shell-data/shell-queries.ts` server-only typed data query layer reading from S02 security-invoker views (`notification_unread_counts_view`, `operator_agenda_view`, `client_project_view`) and tables with debug logging and fallback resilience
- Added 35 `shell.*` localized message strings across `messages/es-MX.json` and `messages/en-US.json` with 100% key and token parity

**🧪 Tests**

- Added unit test suites for protected shell and navigation: `__tests__/app-shell/route-guard.test.ts` (11 tests), `__tests__/app-shell/role-landing.test.ts` (8 tests), `__tests__/app-shell/navigation.test.ts` (9 tests), and `__tests__/app-shell/shell-queries.test.ts` (11 tests)
- Updated `__tests__/i18n/key-naming.test.ts` to permit semantic naming segments for the `shell` namespace

## [2026-08-18 @ 15:00]

**📖 Documentation**

- Created implementation specification `dev-docs/specs/s03/s03-e03-02-role-safe-protected-shell-and-navigation-v1.0.md` for work item S03-E03-02, covering: protected route-group layout with server-side role guard and cross-role redirect enforcement; four role landing pages (Admin, PM, Operator, Client) with typed shell data reads from S02 permitted views; global `AppNav` server component with role-appropriate links, notification unread-count badge, sign-out client component, and accessible mobile drawer; `shell-queries.ts` server-only data module; loading skeletons and error boundaries; 35 new `shell.*` locale keys with es-MX/en-US parity; and a full test matrix across route guards, role landings, navigation, shell queries, localization, and accessibility assertions

## [2026-08-18 @ 14:45]


**🚀 Features**

- Implemented server-authoritative session utility (`src/lib/auth/session.ts`) with `requireSession` and `getOptionalSession` resolving the authenticated user, active `profiles` row, and authoritative `profiles.role`
- Added OpenAPI-compliant Zod validation schemas (`src/lib/validation/auth.ts`) defining single-source password policy, `CompleteInviteSchema`, `MagicLinkSchema`, `SignInSchema`, and `PasswordUpdateSchema`
- Created API route handlers: `POST /api/v1/auth/invites/complete` (server-side token hashing, admin-client user creation, `accept_invite` RPC execution), `POST /api/v1/auth/magic-link` (account-enumeration-safe existing-account OTP), and `GET /api/auth/callback` (PKCE/OTP session exchange)
- Added localized account-entry pages and client forms under `src/app/[locale]/` for sign-in (`iniciar-sesion`), password reset request (`restablecer-contrasena`), password update (`actualizar-contrasena`), invitation redemption (`invitacion`), and session expired/invalid link feedback (`sesion-expirada`)
- Updated Next.js middleware (`src/proxy.ts` and `src/lib/auth/middleware-session.ts`) to synchronize Supabase session refresh cookies alongside next-intl routing
- Added 28 `auth.*` translation keys to `messages/es-MX.json` and `messages/en-US.json` with 100% key parity
- Adjusted ESLint restricted imports (`eslint.config.mjs`) to permit privileged admin client imports within server-only API routes (`src/app/api/**`) while maintaining strict boundaries across client and shared code

**🧪 Tests**

- Added 6 focused test suites under `__tests__/auth/` with 46 tests covering schema validation, fail-closed session errors, token redemption lifecycle, enumeration safety, recovery flows, and message catalog parity
- Updated `__tests__/i18n/key-naming.test.ts` to include the `auth` namespace

## [2026-08-18 @ 13:45]

**📖 Documentation**

- Created implementation specification `dev-docs/specs/s03/s03-e03-01-invite-only-account-entry-and-session-lifecycle-v1.0.md` for work item S03-E03-01, covering: localized account-entry pages (sign-in, password reset, password update, invitation redemption, session-expired), the `completeInvite` and `requestMagicLink` route handlers, Auth callback, `requireSession` session utility, Zod validation schemas, middleware session-refresh update, locale catalog additions, role-route constants, and full negative/positive/localization test matrix

## [2026-08-18 @ 12:08]


**🚀 Features**

- Applied public table access grants migration (`supabase/migrations/20260818170000_s02_e02_public_table_grants.sql`) establishing PostgREST SQL grants for `service_role` and `authenticated` roles under RLS, with zero table access granted to `anon`
- Applied trigger fix migration (`supabase/migrations/20260818171000_s02_e02_fix_project_membership_trigger.sql`) correcting record polymorphism in `private.validate_project_memberships()` across `projects` and `project_members` tables
- Applied security tightening migration (`supabase/migrations/20260818172000_s02_e02_tighten_rls_auto_enable.sql`) revoking `anon` execution on `public.rls_auto_enable()`
- Applied performance optimization migration (`supabase/migrations/20260818173000_s02_e02_drop_duplicate_indexes.sql`) dropping redundant duplicate unique indexes on `invite_tokens` and `notification_events`
- Updated `scripts/bootstrap-dev-demo-data.ts` with atomic project membership batching and `submission_deadline_at` on client-submission deliverables
- Successfully executed and validated `npm run db:bootstrap` against `jsf-pm-dev` remote database across two consecutive runs, proving 100% idempotency and establishing the complete 6-project demo sandbox

## [2026-08-18 @ 11:45]

**🚀 Features**

- Completed synthetic demo data bootstrap (`scripts/bootstrap-dev-demo-data.ts`) supporting 6 distinct projects: 4 reference projects (`Acme Brand Relaunch`, `Internal Workflow Automation`, `Acme Commercial Q1`, `Acme Teaser 2025`), 1 client isolation project (`Starlight Summer Campaign`), and 1 designated interactive sandbox project (`Acme Sandbox Campaign`)
- Added complete synthetic demo records: low-priority task (`Brand Asset Archiving`), `client_contacts` linking Acme Corp and Starlight Media personas, Deliverable 2 (`Hero Promo Teaser Cut`) under Operator B, `collaboration_comments` across team capacities, and `notification_events` / `notification_recipients` with unread in-app queues
- Implemented `assertDbSuccess` in `scripts/bootstrap-dev-demo-data.ts` to fail loudly on any database mutation failure with contextual entity details
- Seeded canonical completion `audit_logs` entry for `Acme Commercial Q1` enabling `project_completion_cycles_view` derivations

**🧪 Tests**

- Tightened static schema contract suite (`__tests__/database/schema-contract.test.ts`) with scoped enum declaration block verification, per-view `WITH (security_invoker = true)` clause assertions, and workspace-wide Prisma absence scans

**📖 Documentation**

- Updated manual verification checklist (`dev-docs/specs/s02/s02-e02-data-plane-manual-verification.md`) to version 1.2, defining inspection protocols for all 6 projects, Deliverable 2, notification queues, collaboration comments, and interactive sandbox mutations

## [2026-08-18 @ 10:50]

**🚀 Features**

- Added persistent development-demo data bootstrap script (`scripts/bootstrap-dev-demo-data.ts`) with opt-in package command (`npm run db:bootstrap`) that idempotently reconciles 9 synthetic Auth personas (`@demo.jsf.internal`), client organizations, multi-lead client projects, internal projects, tasks, production review chains, client submissions, and milestones in `jsf-pm-dev`
- Added Auth-independent idempotent static configuration seed (`supabase/seed.sql`) for logical WhatsApp templates with partial unique index conflict handling

**🧪 Tests**

- Added static schema-contract test suite (`__tests__/database/schema-contract.test.ts`) validating 18 public tables, 22 enums (including `review_decision`), 9 security-invoker views, 16 public RPC functions, and the complete absence of Prisma

**📖 Documentation**

- Created manual data-plane verification checklist (`dev-docs/specs/s02/s02-e02-data-plane-manual-verification.md`) defining milestone-based manual verification across all 9 synthetic roles and isolation boundaries
- Documented `DEV_DEMO_PASSWORD` placeholder in `.env.example`

## [2026-08-18 @ 08:55]

**🚀 Features**

- Implemented authoritative Postgres data platform and access control schema (`supabase/migrations/20260818143500_s02_e02_authoritative_data_platform.sql`) covering 22 enums, 18 tables, 12 private authorization functions, 18 transactional RPCs, 24 partial/unique indexes, and 9 security-invoker views
- Enforced strict RLS policies across all public tables with `auth.uid()` subquery encapsulation and immutable audit/event triggers
- Applied migration to `jsf-pm-dev` remote Supabase database and generated untouched TypeScript database contract (`src/lib/database.types.ts`)
- Added realtime publication for `notification_recipients` and seeded initial WhatsApp notification templates

**🧪 Tests**

- Updated `__tests__/config/credential-exposure.test.ts` key regex boundary patterns to prevent substring false-positives on identifier tokens like `task_resources_task_id_fkey`

## [2026-08-17 @ 16:15]

**🛠 Architecture**

- Migrated deprecated Next.js `middleware.ts` to `proxy.ts` (`src/proxy.ts`) in accordance with Next.js 16 file conventions
- Updated ESLint restricted imports config (`eslint.config.mjs`) to include `proxy.ts` in structural isolation rules for privileged admin client

## [2026-08-17 @ 16:02]

**🚀 Features**

- Added global browser-security response headers in `next.config.ts` (Content-Security-Policy, X-Frame-Options, Referrer-Policy, Permissions-Policy, X-Content-Type-Options, Strict-Transport-Security)
- Created typed catalog-backed error copy helper (`src/lib/error-copy.ts`) with pathname-based locale selection
- Added localized route-segment error boundary (`src/app/[locale]/error.tsx`) and root error boundary (`src/app/global-error.tsx`)
- Added `errors` namespace to `messages/es-MX.json` and `messages/en-US.json`
- Implemented structured JSON logger (`src/lib/logger.ts`) with recursive sensitive-data redaction, circular reference handling, and request-scoped logger factory
- Implemented Sentry capture seam (`src/lib/sentry.ts`) with no-op handling for unconfigured environments and sanitized exception formatting

**🧪 Tests**

- Added unit tests for structured logger serialization, redaction, request correlation, and safe unusual values (`src/lib/__tests__/logger.test.ts`)
- Added unit tests for Sentry DSN resolution, environment fallback, and unconfigured no-op behavior (`src/lib/__tests__/sentry.test.ts`)
- Updated message catalog key-naming test to recognize `errors` namespace (`__tests__/i18n/key-naming.test.ts`)

## [2026-08-17 @ 14:45]

**🚀 Features**

- Implemented public runtime configuration boundary (`src/config/app.config.ts`) validating only `NEXT_PUBLIC_*` environment variables using Zod with presence-only check for `NEXT_PUBLIC_APP_URL` and HTTPS validation for `NEXT_PUBLIC_SUPABASE_URL`
- Implemented server-only configuration boundary (`src/config/server.config.ts`) validating `SUPABASE_SECRET_KEY` synchronously at load time with secret redaction
- Added browser Supabase client factory (`src/lib/supabase/browser.ts`) using `@supabase/ssr` `createBrowserClient`
- Added request-context server Supabase client factory (`src/lib/supabase/server.ts`) using `@supabase/ssr` `createServerClient` and modern `getAll`/`setAll` cookie adapter
- Added privileged server-only admin Supabase client factory (`src/lib/supabase/admin.ts`) using `@supabase/supabase-js` `createClient`

**🛠 Architecture**

- Configured ESLint structural restricted import rules (`eslint.config.mjs`) forbidding `@prisma/client` and `prisma` across application code and restricting privileged admin client (`src/lib/supabase/admin`) from client components, shared modules, and middleware
- Added Vitest configuration (`vitest.config.mts`) with path alias resolution

## [2026-08-17 @ 14:34]

**🧪 Tests**

- Corrected `__tests__/config/server.config.test.ts` (TC-CFG-002) Test 1 to assert successful module resolution and `serverConfig` validation when a valid `SUPABASE_SECRET_KEY` is present, aligning with REQ-CFG-004 fail-closed specification.

## [2026-08-15 @ 13:40]

**🚀 Features**

- Implemented localized public application shell using `next-intl`
- Added canonical routes `/`, `/privacidad`, `/en/`, and `/en/privacidad`
- Set `es-MX` as the default locale served without a prefix
- Added `messages/es-MX.json` and `messages/en-US.json` message catalogs
- Generated localized sitemap (`sitemap.ts`) reflecting canonical routes
- Configured robots.txt (`robots.ts`) with `Disallow: /` for non-production environments
- Added localized layout and privacy pages

**🛠 Architecture**

- Added `next-intl` configuration (`routing.ts`, `request.ts`, `types.ts`)
- Configured locale-aware Next.js middleware to enforce canonical routing paths
- Injected dynamic metadata translation support into the root layout
- Migrated standard page structure into `[locale]` segment
