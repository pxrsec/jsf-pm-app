---
document_id: S08-01-DESKTOP-PROJECT-WORKSPACE-NAVIGATION-LAYOUT-REFINEMENT-SPEC-01
sprint_id: S08
work_item: S08-01
status: implementation-ready
created_at: 2026-08-25T09:50:39-06:00
branch: feature/manual-ux-ui-pass
scope: desktop-only project-workspace information-architecture refinement
---

# S08-01 — Desktop Project Workspace Navigation Layout Refinement

## 1. Objective

Correct the desktop information architecture of the internal project workspace so its project navigation is continuously visible in the project header rather than occupying a side/constrained layout or being visually lost behind a task-kanban surface.

For every authorized internal project-workspace user, the desktop vertical order must be exactly:

```text
project breadcrumb
project title and permitted actions
project information pills: status, client/type, primary PM lead, deadline
project navigation tabs
full-width separator
selected project view
```

The navigation tabs must be directly below the information-pill row and directly above the separator. The selected view begins below that separator. The navigation must remain visible and operable while the Tasks tab is in either Kanban or List mode.

This is a narrow desktop UX/UI correction. It must not change workflow behavior, authorization, data access, project lifecycle, the set of tabs available to a role, or the mobile presentation.

## 2. Authority and implementation baseline

Apply authority in this order:

1. Direct Project Owner direction in this S08 request.
2. This specification.
3. `AGENTS.md` and `GEMINI.md`.
4. Existing role-safe page/query/action contracts and focused tests.

Baseline inspected on `feature/manual-ux-ui-pass` at `d70c113`:

- The sole internal project-workspace composer is `src/components/shared/projects/project-workspace/project-workspace-shell.tsx`.
- It is used by the Admin and PM detail routes only:
  - `src/app/[locale]/(protected)/admin/proyectos/[id]/page.tsx`
  - `src/app/[locale]/(protected)/pm/proyectos/[id]/page.tsx`
- `ProjectHeader` currently renders the breadcrumb, title/actions, and information pills, then closes its `border-b` header before the shell renders the `TabsList` in a separate `<main>` region.
- `TasksTab` owns `viewMode` locally. Its default is `kanban`; the Kanban board creates an `overflow-x-auto` horizontal work surface. It does **not** conditionally render or unmount the project navigation.
- `src/components/ui/tabs.tsx` defaults to horizontal orientation. The workspace must pass/retain horizontal orientation explicitly and must not change this shared primitive for a one-workspace layout correction.
- Existing focused shell coverage is in `__tests__/projects/project-workspace-calendar.test.tsx`. It currently verifies tab routing and calendar visibility, but not the header/navigation/view hierarchy.

The source baseline does not show a `viewMode` condition around the project `TabsList`. Therefore the Kanban-only disappearance reported in the desktop UI is a layout/containment regression to prevent, not a reason to add another view-mode state, route parameter, or task-level navigation implementation.

## 3. User and role scope

### 3.1 Included users and routes

This requirement applies wherever `ProjectWorkspaceShell` is rendered:

| User | Route family | Required tab set |
| --- | --- | --- |
| Admin | `/admin/proyectos/[id]` | Overview, Tasks, Deliverables, Members, Activity, Calendar, Archive |
| PM Lead | `/pm/proyectos/[id]` | Overview, Tasks, Deliverables, Members, Activity, Calendar, Archive |
| PM Watcher | `/pm/proyectos/[id]` | The same read-visible tab set, with existing read-only restrictions preserved |

Role and membership authorization remain server-side. The rearranged navigation is not authorization evidence.

### 3.2 Explicitly unaffected project details

Do **not** add, duplicate, or restyle this internal tab system in these separate role-safe experiences:

- Operator own-work project detail: `/operador/proyectos/[project-id]`
- Client project detail: `/cliente/proyectos/[project-id]`

Those routes do not consume `ProjectWorkspaceShell` and intentionally expose different, role-safe information architectures. This item does not broaden their project visibility or navigation.

## 4. Required desktop behavior and layout contract

### 4.1 Desktop breakpoint

Use the existing application desktop convention: `md` and wider (minimum CSS width 768px). Below `md`, preserve the current mobile project-header and tab presentation without visual redesign, altered tab availability, new horizontal scrolling behavior, or duplicated visible controls.

The implementation must use one active, accessible project-tab control set at a viewport. It must not leave two exposed tablists, duplicate tab IDs, duplicate accessible names, or competing roving-focus registrations in the DOM.

### 4.2 Header composition at `md` and wider

At desktop widths, compose the internal project workspace as follows:

1. `ProjectWorkspaceShell` remains the owner of `activeTab`, URL synchronization, role-derived calendar/archive visibility, and all `TabsContent` instances.
2. The selected-tab navigation is rendered in a dedicated header slot owned by `ProjectHeader`, after the existing information-pill row.
3. The navigation slot spans the same `container max-w-7xl` width and horizontal padding as the existing title/pills and selected-view container.
4. The header owns one separator immediately **after** the tab row. Remove the old structural arrangement that produces a separator before the tab row at desktop widths.
5. The selected `TabsContent` region begins below the separator with the existing main-content spacing. Do not wrap content in a narrow side rail, grid column, or viewport-constrained panel.
6. The tab row is a horizontal, left-aligned line navigation. It may horizontally scroll only on the preserved mobile layout. At desktop widths it must not show a horizontal scrollbar and must not consume a left-side vertical/navigation column.
7. The tab bar must remain in normal document flow. This item does not make it sticky or fixed.
8. Preserve the current active-state treatment: clear selected-tab text state plus its bottom border. Preserve keyboard tab semantics, arrow-key behavior supplied by the installed Base UI primitive, focus-visible treatment, and URL update behavior.

### 4.3 Tasks/Kanban invariant

Selecting `Tasks` and toggling between Kanban and List must only change the task content inside `TasksTab`.

The following must remain mounted, visible, and usable on desktop in both modes:

- project header and information pills;
- the complete applicable internal project navigation tab row;
- the selected `Tasks` tab active indicator; and
- navigation to every other already-authorized tab.

The Kanban board may retain its own horizontal scroll surface for columns. That overflow must be contained to the board; it must not change the project workspace orientation, cover the project navigation, shrink the selected content into a left-column layout, or cause page-level horizontal overflow.

### 4.4 Calendar and other wide views

Calendar, Archive, Deliverables, Members, Activity, Overview, Tasks List, and Tasks Kanban must all receive the full available desktop content width beneath the header separator. In particular, the project Calendar must no longer be horizontally constrained by any project-navigation side placement.

Do not introduce special-case tab layout for Calendar or Kanban. The one header-navigation composition applies uniformly to every selected internal workspace view.

## 5. Implementation plan

### Step 1 — Reconfirm the implementation surfaces

Before editing:

1. inspect `git status --short --branch` and preserve all unrelated work;
2. inspect the current `ProjectWorkspaceShell`, `ProjectHeader`, `TasksTab`, `TaskKanbanBoard`, and `src/components/ui/tabs.tsx` source;
3. inspect both Admin and PM page callers to preserve props, role behavior, and query-param handling;
4. inspect `__tests__/projects/project-workspace-calendar.test.tsx` and the repository's message-catalog tests; and
5. run the focused workspace test once to establish the pre-change result.

Stop and report if the checked-out branch no longer uses the shared shell/header composition documented in Section 2. Do not apply this plan to a different role-specific project detail by inference.

### Step 2 — Make the workspace tab root own the full composition

Refactor `src/components/shared/projects/project-workspace/project-workspace-shell.tsx` so that the existing controlled `<Tabs>` root encompasses both:

- the project header (including the desktop navigation slot); and
- the existing main selected-view/content region.

Requirements:

- retain the existing `value={activeTab}` and `onValueChange={handleTabChange}` behavior;
- set/retain `orientation="horizontal"` explicitly at this call site;
- neutralize the shared primitive's default inter-child gap only where needed so header, separator, and content follow the Section 4 geometry;
- retain all existing tab values, conditional Calendar/Archive rendering, counts, loaders, dialogs, and `TabsContent` props exactly;
- retain the current `tab`, `calendar*`, and `archive*` URL parameter behavior; and
- do not move project data loading, role checking, or tab selection into `TasksTab` or a page route.

Do not modify `src/components/ui/tabs.tsx` unless inspection proves that the workspace cannot express the required layout through composition/classes. A shared primitive change is out of scope for a single desktop workspace repair and risks unrelated tab consumers.

### Step 3 — Add a dedicated `ProjectHeader` navigation slot

Extend `src/components/shared/projects/project-workspace/project-header.tsx` with a narrowly typed optional render slot (for example, `navigation?: ReactNode`). Do not pass project records, role state, URLs, task view mode, or callbacks that the header does not need.

Render the supplied navigation slot after the existing badges/pills row. The header must then render its desktop separator immediately after that slot.

The shell, not the header, remains the source of the actual `TabsList` and `TabsTrigger` controls. This preserves the one controlled tab state and avoids duplicating navigation logic in the presentation component.

Use a stable structural hook for focused tests, such as `data-testid="project-workspace-navigation"`, on the navigation container only. The hook is for composition evidence; do not render it as user-facing text.

### Step 4 — Preserve mobile without duplicate active tab controls

The user requested a desktop-only change. Preserve the existing mobile (< `md`) visual sequence and overflow behavior.

Implement this with one of the following safe composition strategies, selected only after verifying behavior with the installed `@base-ui/react/tabs` version:

1. **Preferred:** render one project tablist and use responsive layout/reparenting structure that places it in the header at `md` and above while preserving its current mobile placement, without duplicate mounted triggers; or
2. render a breakpoint-selected single tablist only when the implementation can do so without server/client hydration mismatch, focus loss, or duplicated tab registration.

Do **not** mount two live lists of identical `TabsTrigger` values merely to use `hidden md:block` / `md:hidden`. If a visual-only duplicate is unavoidable after primitive verification, it must be excluded from the accessibility tree and primitive registration, contain no duplicate IDs, and be proven not to alter keyboard selection. Prefer redesigning the wrapper over accepting this risk.

The mobile result must preserve:

- current tab labels/counts/availability and active indicator;
- current horizontal overflow behavior where required by narrow width;
- current header actions and pills;
- touch and keyboard access; and
- no page-level horizontal overflow introduced by the change.

### Step 5 — Retain task view ownership and contain Kanban overflow

Do not modify `TasksTab` state ownership, task filters, mutation actions, or task view labels. Do not add project-nav conditionals based on `viewMode`.

Inspect the resulting desktop DOM/CSS to ensure `TaskKanbanBoard` remains the only `overflow-x-auto` horizontal work surface for Kanban columns. If the new composition exposes a flex shrink/min-width regression, apply the smallest scoped class correction to the shell content wrapper or Kanban wrapper. Do not add global overflow rules.

### Step 6 — Keep localization and accessibility stable

No new visible labels are required: all seven existing tab labels are already catalog-backed under `projects.workspace.tabs` in both `messages/es-MX.json` and `messages/en-US.json`.

Do not add catalogs or hard-coded text for this visual move unless a new rendered accessible label is truly needed. If one is needed, add the exact same semantic leaf and interpolation contract to both catalogs and retain existing catalog-parity coverage.

Verify:

- exactly one exposed tablist is present at each viewport;
- every visible tab has its existing localized accessible name;
- selected state is programmatically exposed by the primitive;
- visible focus remains clear;
- no navigation is color-only; and
- PM Watcher has the same readable navigation but no new mutation controls.

## 6. Required file inventory

| File | Required change |
| --- | --- |
| `src/components/shared/projects/project-workspace/project-workspace-shell.tsx` | Make the controlled horizontal Tabs root own header + content composition; render the desktop header navigation slot; preserve all tab content/URL behavior; remove desktop-only old standalone navigation arrangement. |
| `src/components/shared/projects/project-workspace/project-header.tsx` | Accept and render the narrowly scoped desktop navigation slot after project pills and before the header separator; preserve breadcrumb/title/actions/pills. |
| `__tests__/projects/project-workspace-calendar.test.tsx` | Extend the existing focused shell suite, or split a focused shell-layout test from it, to cover header navigation composition and all existing calendar navigation behavior. |

Conditional only:

| File | Permitted reason |
| --- | --- |
| `src/components/shared/projects/project-tasks/task-kanban-board.tsx` | Only a minimal scoped width/overflow correction if direct desktop verification proves the new composition creates a Kanban containment regression. |
| `messages/es-MX.json`, `messages/en-US.json`, closest i18n test | Only if a new rendered accessible label is necessary. Do not create a catalog change for an internal test hook. |

Do not modify page-route data loaders, Supabase code/migrations, generated database types, task lifecycle code, client/operator project pages, global navigation, shared tabs primitive, dependency manifests, or `CHANGELOG.md` for this UI-only work item.

## 7. Focused automated acceptance evidence

Use the existing Vitest/React Testing Library convention. Do not use visual snapshots, Playwright, or new browser-test infrastructure.

### 7.1 Shell composition tests

In the focused workspace suite, prove at least:

1. an Admin workspace exposes the complete seven-tab set in the project header navigation container;
2. a PM Watcher workspace exposes the same permitted navigation without a newly introduced management control;
3. Calendar remains a real tab and selecting it still calls the locale-aware router with `tab=calendar`;
4. the navigation container occurs after the rendered header-pill region and before the selected tab-panel/content region in DOM order; and
5. the shell retains exactly one functional selected tab control in the test viewport/strategy used by the implementation.

Adapt the existing `ProjectHeader` mock so it renders/asserts the supplied navigation slot rather than discarding it. Do not weaken existing calendar test assertions.

### 7.2 Tasks regression tests

Extend the closest focused task/workspace test only enough to prove that rendering the default Kanban `TasksTab` does not remove, conditionally hide, or change the `Tasks` project tab selection. Do not attempt to unit-test CSS pixel geometry in jsdom.

Retain current tests for task creation permissions, watcher read-only behavior, task filtering, drag/drop restrictions, and calendar server-fed props.

### 7.3 Commands

Run, in this order after implementation:

```text
npm test -- __tests__/projects/project-workspace-calendar.test.tsx __tests__/projects/task-workspace.test.tsx
npm run typecheck
npm run lint
npm run format:check
```

If a changed message catalog is truly required, also run:

```text
npm test -- __tests__/i18n/message-catalogs.test.ts __tests__/i18n/key-naming.test.ts
```

Run `npm run build` only if a focused check reveals a Next.js compile/route-boundary concern or if the Project Owner requests the broader verification. Do not run the full `npm run verify` merely for this bounded layout correction unless directed.

## 8. Required manual desktop verification

Use the local authenticated demo and real authorized personas. Record only factual observations; do not claim pixel or browser coverage that was not performed.

| ID | Persona and viewport | Steps | Required result |
| --- | --- | --- | --- |
| D-01 | Admin, Spanish, 1280px wide | Open an internal project; visit all seven tabs. | Title → pills → tabs → separator → selected view order; full-width selected content; tabs remain visible. |
| D-02 | PM Lead, Spanish, 1280px wide | Open a project; switch Overview, Deliverables, Members, Activity, Calendar, and Archive. | Same desktop hierarchy and role-authorized tab availability; URL state still updates. |
| D-03 | PM Watcher, Spanish, 1280px wide | Open a project and Calendar; inspect actions. | Tabs remain readable/usable; no new mutation controls or authority. |
| D-04 | Admin or PM Lead, Spanish, 1280px wide | Open Tasks; switch Kanban → List → Kanban; horizontally scroll Kanban columns if needed; change to another project tab. | Project navigation never disappears or becomes a left rail; Kanban overflow remains confined; navigation changes views normally. |
| D-05 | Admin or PM, English, 1280px wide | Repeat an internal tab switch. | Existing English labels and active state render correctly; no hard-coded new text. |
| M-01 | Existing supported mobile width below 768px | Open an internal project and switch tabs. | Mobile presentation and tab behavior remain materially unchanged; no duplicate controls or page-level horizontal overflow introduced. |

Check both light and dark themes during D-01 or D-04. Active state and separator must remain legible in each theme.

## 9. Definition of done

S08-01 is complete only when all conditions are true:

1. Internal desktop project workspaces render the requested title/pills/navigation/separator/view hierarchy.
2. The navigation is always visible in all selected Admin/PM workspace views, including Tasks Kanban and Tasks List.
3. No internal selected view is constrained by a project-navigation side rail; Calendar receives the normal full content width.
4. Existing Admin, PM Lead, and PM Watcher role boundaries and tab availability are unchanged.
5. Client and Operator role-safe project detail experiences are untouched.
6. Mobile behavior is preserved below the `md` breakpoint.
7. Exactly one exposed, keyboard-operable tablist exists per viewport; no duplicate tab semantics are introduced.
8. Focused automated commands in Section 7 pass with real output.
9. Manual journeys D-01 through D-05 and M-01 pass, or any unavailable demo prerequisite is documented as a blocker rather than assumed passed.
10. The working tree contains only the approved implementation/test changes and this S08 specification; no Git mutation is performed unless separately directed.

## 10. Risks and stop conditions

- **Base UI registration risk:** If the installed tabs primitive cannot safely support the responsive structural placement without duplicate controls, stop before shipping a duplicate-trigger workaround. Report the primitive behavior and propose the smallest accessible alternative.
- **Responsive regression risk:** If the implementation changes the mobile hierarchy, scrolling, or touch behavior below `md`, revert that mobile effect and keep the correction desktop-only.
- **Scope regression risk:** If a change appears to require client/operator project-route redesign, global navigation changes, a new database field, migration, or permission rule, stop. Those are separate S08 items.
- **Baseline drift:** If `ProjectWorkspaceShell` callers, tab values, or task view ownership differ materially from Section 2 when work begins, stop and reconcile this specification against the current branch before implementation.
