---
document_id: S08-03-DESKTOP-DRAWER-CONTENT-REFLOW-AND-COLLAPSED-NOTIFICATION-BADGE-SPEC-01
sprint_id: S08
work_item: S08-03
status: implementation-ready
created_at: 2026-08-25T12:10:00-06:00
predecessors:
  - dev-docs/specs/s08/s08-01-desktop-project-workspace-navigation-layout-refinement-spec.md
  - dev-docs/specs/s08/s08-02-desktop-global-navigation-drawer-refinement-spec.md
supersedes:
  - S08-02 desktop-content overlay decision only
implementation_scope: protected application shell and collapsed desktop notification badge
out_of_scope:
  - route, authentication, session, role, capability, or data-query changes
  - mobile navigation behavior and layout
  - drawer visual information architecture, authorized route matrix, or icon choices
  - persistence of desktop drawer state
  - database, Supabase, dependency, shared primitive, or VSDD-Lite changes
verification_level: focused component checks plus manual responsive journeys
---

# S08-03 — Desktop Drawer Content Reflow and Collapsed Notification Badge

## 1. Purpose

S08-02 correctly replaced the crowded desktop header navigation with a persistent desktop drawer. Its original overlay-only content decision is now explicitly retired: when the drawer is visible at desktop widths, it must reserve horizontal layout space rather than cover protected-route content.

This specification implements two tightly scoped corrections:

1. **Desktop content reflow:** every protected main view receives the actual remaining desktop width when the drawer is expanded or collapsed. No protected page content may sit behind the desktop drawer.
2. **Collapsed unread prominence:** the collapsed Notifications link retains a visible red rounded unread-count badge with the actual count whenever unread notifications are greater than zero.

This is a shared protected-shell change. It is not a per-page collection of arbitrary left margins. The protected shell is the single owner of the drawer-width state and the main-content offset, so all existing protected routes receive the behavior consistently.

## 2. Reconciliation and authority

### 2.1 Retired S08-02 decision

S08-02 specified a fixed desktop drawer that overlaid normal-flow main content and intentionally did not change `#main-content` width, padding, margins, or layout. That decision is superseded **only** for desktop main-content geometry.

### 2.2 Active replacement decision

At `md` (768px) and wider:

- expanded drawer width is `16rem` / `w-64`;
- collapsed drawer width is `4rem` / `w-16`;
- `#main-content` uses left padding equal to the current drawer width;
- the main element remains full shell width under border-box sizing, so its usable content box becomes the viewport width minus the drawer width;
- the offset animates in sync with the drawer width transition;
- no protected-route content, local container, grid, table, Kanban board, or calendar is translated independently to compensate for the drawer.

Below `md`, the main-content offset is absent and existing mobile behavior remains untouched.

### 2.3 Preserved S08-02 behavior

The following remain unchanged:

- desktop drawer is persistent, fixed, non-modal, `hidden md:flex`, and starts below the 64px header (`top-16`);
- default desktop state is expanded for every new protected-shell mount;
- the current `PanelLeftClose` / `PanelLeftOpen` toggle icons are approved and must remain;
- the desktop drawer keeps the current authorized navigation model, active-route semantics, localized labels, identity footer, two sign-out actions, and tooltips;
- mobile navigation remains `md:hidden`, uses the existing mobile menu behavior, and has no desktop rail offset;
- modal dialogs, alerts, sheets, portals, and toasts retain their established viewport/modal positioning. They are not page content and must not be shifted by the desktop drawer.

## 3. UX contract

### 3.1 Desktop expanded state (`min-width: 768px`)

When the drawer is expanded:

- the drawer occupies the left `16rem` of the viewport below the header;
- the visual left edge of all normal protected main content begins after that `16rem` reserved area;
- the drawer never covers project headers, workspace tabs, controls, cards, tables, Kanban columns, calendar panels, archive results, metrics, administration screens, notification screens, or role landing pages;
- each existing route retains its own internal responsive layout and receives a narrower containing block, rather than a covered viewport;
- full-width child elements fill the available content box after the offset, not the original viewport under the drawer.

### 3.2 Desktop collapsed state (`min-width: 768px`)

When the drawer is collapsed:

- the rail occupies the left `4rem` below the header;
- the main content expands into the recovered `12rem` immediately and smoothly;
- no content remains positioned as if the drawer were `16rem` wide;
- the active route, drawer identity/footer behavior, tooltips, and notifications remain unchanged except for the wider usable main-content area.

### 3.3 Mobile state (`max-width: 767px`)

When the viewport is below `768px`:

- the shared shell applies no drawer-width offset to main content;
- `#main-content` occupies the normal full width;
- the desktop rail is hidden;
- the existing mobile navigation toggle/drop-down retains its current focus, Escape, close-on-link, language/theme, identity, and sign-out behavior;
- no state persistence or breakpoint-specific JavaScript is added to force a desktop/machine layout on mobile.

## 4. Architecture: one state owner and one layout boundary

### 4.1 Required new client shell

Create this file:

```text
src/components/shared/app-nav/_components/desktop-navigation-shell.tsx
```

It is the only owner of the desktop drawer’s expanded/collapsed state.

Use an explicit client context API:

```ts
export type DesktopNavigationLayoutContextValue = {
  isDesktopNavigationExpanded: boolean;
  toggleDesktopNavigation: () => void;
};

export function DesktopNavigationShell({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement;

export function useDesktopNavigationLayout(): DesktopNavigationLayoutContextValue;
```

Required behavior:

- This is a `"use client"` component.
- Initialize state with `useState(true)`. Expanded is the server and first-client-render default; do not use an effect to change it after hydration.
- `toggleDesktopNavigation` must use a functional state update.
- The provider must wrap both `AppNav` and the protected `<main>` from the shared protected layout.
- Give the provider root a stable `data-slot="desktop-navigation-shell"` attribute.
- The provider root preserves the existing protected-layout root semantics:

```tsx
className="min-h-screen flex flex-col bg-background text-foreground"
```

- The root exposes the current desktop width through exactly one CSS custom property:

```tsx
style={{
  "--desktop-navigation-width": isDesktopNavigationExpanded
    ? "16rem"
    : "4rem",
}}
```

Use the project’s TypeScript-safe custom-property typing approach; do not silence type errors with `any`.

### 4.2 Why context is required

`DesktopNavDrawer` is currently a client component with its own `useState(true)`, while `<main id="main-content">` is a sibling emitted by the protected server layout. Local drawer state cannot safely control that sibling’s layout.

Do not attempt any of the following:

- duplicated `useState` in the drawer and layout;
- `window` event listeners or custom DOM events;
- document-level class mutation;
- `localStorage`, cookies, URL parameters, profile fields, or server actions;
- page-specific drawer-width props;
- hard-coded `ml-64`, `pl-64`, `ml-16`, or `pl-16` classes scattered across individual route files;
- CSS selectors that inspect drawer markup to guess drawer state.

Context plus one CSS custom property is the required narrow coordination boundary. It avoids state duplication, keeps the route tree intact, and gives all protected content one authoritative available width.

### 4.3 Protected layout integration

Modify only this shared layout for content-shell geometry:

```text
src/app/[locale]/(protected)/layout.tsx
```

Keep every existing authentication, redirect, role-path, unread-count, and notification-operations authorization calculation exactly as it is. Replace only the final static outer wrapper composition with this structure:

```tsx
<DesktopNavigationShell>
  <AppNav
    session={session}
    unreadCount={unreadCount}
    canAccessNotificationOperations={canAccessNotificationOperations}
  />

  <main
    id="main-content"
    tabIndex={-1}
    className="w-full min-w-0 flex-1 transition-[padding-left] duration-200 ease-out motion-reduce:transition-none md:pl-[var(--desktop-navigation-width)]"
  >
    {children}
  </main>
</DesktopNavigationShell>
```

Implementation requirements:

- Preserve the existing `id="main-content"` and `tabIndex={-1}` exactly.
- Preserve `flex-1`; add `w-full min-w-0` as shown to establish a reliable available-width boundary for descendant flex/grid/table content.
- Use only `padding-left`, never margin-left or translate transforms. Padding retains the main element’s full shell width while reducing its usable content box under normal border-box sizing.
- The transition must be exactly aligned with the drawer’s existing `transition-[width] duration-200`. Use the same duration (`200ms`) and a compatible simple easing (`ease-out`).
- Include `motion-reduce:transition-none` for the main padding transition. Add the same motion-reduction class to the drawer width transition if it is absent.
- The `md:` prefix is mandatory. No main offset may exist below 768px.
- Do not apply `overflow-hidden`, `overflow-x-hidden`, `position: relative`, or a z-index to `<main>` as a shortcut. Those can break existing local horizontal scrollers, sticky elements, drag-and-drop behavior, and portals.
- Do not change the global header width or offset. The header intentionally spans the viewport; only content below it reserves drawer space.

### 4.4 Server/client composition requirement

`ProtectedLayout` remains a server component. `DesktopNavigationShell` is a client boundary that receives server-rendered `AppNav` and route `children` as children. This is the required composition; do not convert `ProtectedLayout` or `AppNav` into client components.

`DesktopNavDrawer` consumes `useDesktopNavigationLayout()` through the client context. The provider is available to it even though the server `AppNav` is passed through the client shell as a child.

## 5. Desktop drawer changes

Modify:

```text
src/components/shared/app-nav/_components/desktop-nav-drawer.tsx
```

### 5.1 Remove local state

Remove:

```ts
const [isExpanded, setIsExpanded] = useState(true);
```

Use the shared hook instead:

```ts
const {
  isDesktopNavigationExpanded,
  toggleDesktopNavigation,
} = useDesktopNavigationLayout();
```

Use `isDesktopNavigationExpanded` for every existing expanded/collapsed branch:

- rail class: `w-64` vs `w-16`;
- toggle alignment;
- action label;
- panel icon;
- expanded link versus collapsed tooltip rendering;
- footer identity visibility;
- expanded versus icon-only drawer sign-out rendering.

The toggle button calls `toggleDesktopNavigation`. Do not maintain a second state mirror in the drawer.

### 5.2 Drawer transition contract

Keep its existing fixed geometry:

```tsx
"hidden md:flex fixed top-16 bottom-0 left-0 z-30 flex-col"
```

Keep its pinned control, scrollable links, and pinned footer structure.

Its dynamic width class remains:

```tsx
isDesktopNavigationExpanded ? "w-64" : "w-16"
```

Its transition class must become:

```tsx
"transition-[width] duration-200 ease-out motion-reduce:transition-none"
```

The drawer and `#main-content` therefore start and finish their geometry transition together.

### 5.3 Accessibility remains unchanged

- `aria-expanded` reflects the shared expanded state.
- `aria-controls="desktop-nav-links"` remains valid.
- The existing localized next-action label remains the accessible name.
- Panel icons remain `aria-hidden="true"`.
- Links retain count-aware names and active-route behavior.
- Tooltips continue only for collapsed controls.
- Do not change the authorized navigation model, translation keys, or role/capability matrix.

## 6. Collapsed notification badge correction

### 6.1 Current concrete defect

`DesktopNavDrawer` currently passes this custom class to `NotificationBadge` in collapsed mode:

```tsx
className="absolute top-1 right-1"
```

`NotificationBadge` currently treats a caller-supplied `className` as a full replacement for its default class list. Therefore the collapsed badge loses `bg-destructive`, `rounded-full`, foreground color, sizing, and other badge styling. It is positioned but not a visible red unread counter.

### 6.2 Required `NotificationBadge` behavior

Modify only this presentation helper:

```text
src/components/shared/app-nav/_components/notification-badge.tsx
```

It must preserve its default visual class list and merge caller overrides/additions with `cn`, rather than choosing one or the other.

Required shape:

```tsx
const baseClassName =
  "inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-destructive-foreground bg-destructive rounded-full shadow-sm";

<span
  aria-hidden="true"
  className={cn(baseClassName, className)}
>
```

Requirements:

- Import and use the project’s existing `cn` utility.
- Keep `count <= 0` returning `null`.
- Keep the existing `99+` localization behavior.
- Keep `aria-hidden="true"`; the link’s count-aware accessible name and existing live region remain the nonvisual notification announcement mechanisms.
- Do not create a second notification component or alter the shared navigation model.
- Existing expanded-desktop and mobile notification badges must retain their current appearance after this change.

### 6.3 Collapsed rail badge geometry

For the collapsed Notifications link only, use the merged class extension below or an equivalent that preserves every listed outcome:

```tsx
className="pointer-events-none absolute -right-0.5 -top-0.5 z-10 h-5 min-w-5 px-1 text-[10px] leading-none"
```

The collapsed Notification link remains a `relative` 44px minimum interactive target. The badge must:

- render whenever `unreadCount > 0`;
- contain the actual display value (`1` through `99`, then the already-localized `99+` cap);
- be visually red via the merged `bg-destructive` base class;
- be fully rounded via the merged `rounded-full` base class;
- be visibly anchored over the upper-right region of the bell control;
- remain within the 64px collapsed rail and not be clipped by the drawer;
- not alter the 44px pointer target, link semantics, focus ring, or icon centering;
- not intercept clicks independently of the Notifications link;
- remain absent at unread count `0`.

A one-digit count will appear circular. A `99+` counter may naturally become a compact rounded pill so the real count cap stays legible; it must remain red, rounded, and prominent.

Do not use a plain red dot. The user explicitly requires the visible numerical count in collapsed mode.

## 7. Protected-view reflow contract

The shell offset is the primary implementation. It must work for every protected route without route-level drawer knowledge.

### 7.1 Normal responsive content

Existing route shells such as `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8` must remain unchanged unless a manual verification finds a concrete local overflow defect. With the new `#main-content` content box, they naturally re-center and resize inside the remaining desktop width.

This includes, but is not limited to:

- admin, PM, operator, and client landing shells;
- project directories and project workspaces;
- global calendar, archives, metrics, link incidents, operations, notification inbox, and notification operations pages;
- error/loading surfaces rendered inside the protected layout.

Do not add per-page drawer offsets to these surfaces.

### 7.2 Project workspace and S08-01 compatibility

`ProjectWorkspaceShell` currently uses an internal centered `container max-w-7xl` and responsive tab/header composition. It must receive the new main content box unchanged.

Required outcomes when the rail changes state:

- project header, metadata/pills, and action controls remain visible and in their existing responsive hierarchy;
- desktop project tabs remain in their S08-01 placement and are not covered by the drawer;
- the workspace container re-centers within the remaining width; it must not retain visual alignment behind the expanded rail;
- no change to workspace selected-tab state, URL query behavior, role/capacity conditions, or mobile tab placement;
- no change to the workspace’s `min-h-screen`, dialog state, or project lifecycle behavior.

### 7.3 Intentional local horizontal scrollers

Some protected surfaces intentionally use local horizontal overflow because their data representation has a legitimate minimum readable width. They must remain local to their own component and must never cause document-level horizontal overflow or drawer overlap.

Explicit examples discovered in the current tree:

| Surface | Existing behavior to preserve | Required result after shell reflow |
| --- | --- | --- |
| Project Kanban | Five columns, each `min-w-[260px]`, inside its own `overflow-x-auto` board | Board gets the narrower available content width and continues to scroll horizontally inside its board region; no columns sit behind the drawer and no page-level overflow is introduced. |
| Calendar week | `min-w-[700px]` grid inside its own `overflow-x-auto` container | Week grid remains readable through its local horizontal scroller within the remaining main-content width. |
| Task list, tables, metrics charts, status distributions, operations tables | Existing local `overflow-x-auto` wrappers | Their own wrapper handles width; outer main and document do not horizontally overflow. |
| Workspace mobile tab strip | Existing local `overflow-x-auto` below desktop | Unchanged below `md`; desktop S08-01 tab placement remains unchanged. |

Do not force Kanban columns or the week calendar below their current readable minimum widths merely to eliminate their legitimate local horizontal scroll. The required fix is drawer-aware available width, not unreadable data compression.

### 7.4 Grid and flex behavior

The narrowed main content box must allow existing responsive breakpoints to reflow naturally:

- card grids may reduce their column count when their container becomes narrower;
- flex rows may wrap where their existing class contract already permits wrapping;
- truncated labels and existing `min-w-0` areas remain allowed to shrink;
- action buttons retain their existing minimum touch targets;
- no global CSS override, `zoom`, scale transform, fixed zoom level, or font-size reduction may be introduced to fake reflow.

If manual verification exposes a local component that has an actual uncontained overflow after the shared shell is correct, fix only that component using its established responsive convention. The remediation must be documented in the implementation report with the exact component and reason. Do not preemptively churn every route file.

## 8. Files and exact scope

### 8.1 Required changes

| File | Change |
| --- | --- |
| `src/components/shared/app-nav/_components/desktop-navigation-shell.tsx` | New client context/layout owner for expanded state and `--desktop-navigation-width`. |
| `src/app/[locale]/(protected)/layout.tsx` | Wrap existing `AppNav` and main in `DesktopNavigationShell`; add the desktop-only main padding/containment classes. Preserve all auth/data logic. |
| `src/components/shared/app-nav/_components/desktop-nav-drawer.tsx` | Replace local state with shared context; keep width class and synchronize its transition; apply collapsed badge geometry. |
| `src/components/shared/app-nav/_components/notification-badge.tsx` | Merge caller class names with the existing base badge styling using `cn`. |
| `__tests__/app-shell/navigation.test.ts` | Update drawer test rendering for the required shell provider; add the two focused contracts in Section 10. |

### 8.2 Explicitly do not modify

Do not modify any of the following for this slice unless a focused check identifies a directly caused defect and the Project Owner explicitly accepts the additional scope:

- `src/components/shared/app-nav/app-nav.tsx`
- `src/components/shared/app-nav/navigation-model.ts`
- `src/components/shared/app-nav/_components/mobile-nav-toggle.tsx`
- `src/components/shared/app-nav/_components/sign-out-button.tsx`
- `messages/en-US.json` or `messages/es-MX.json` — no new visible wording is needed
- `src/components/ui/button.tsx`, `tooltip.tsx`, `sheet.tsx`, or any other shared primitive
- route authorization, session logic, Supabase code, migrations, dependencies, middleware, or route paths
- individual project workspace, Kanban, calendar, table, chart, or page components solely to add drawer spacing

A truthful `CHANGELOG.md` update is allowed only if the repository’s current working-change convention retains the S08-02 changelog entry. It must describe the behavior actually implemented and must not claim broad test coverage.

## 9. Non-negotiable invariants

1. The expanded drawer is `w-64`; collapsed drawer is `w-16`.
2. At `md+`, `#main-content` uses exactly the same current width (`16rem` or `4rem`) as left padding through the shared CSS variable.
3. At `<md`, no drawer padding is applied to main content.
4. Drawer width and main offset state have exactly one owner: `DesktopNavigationShell`.
5. Drawer toggle state remains session-memory-only and defaults to expanded after a protected shell mount.
6. The desktop drawer never overlays normal protected content after this change.
7. Header geometry remains independent and full-width.
8. Role links, capabilities, routes, sessions, unread data, i18n, and sign-out behavior are unchanged.
9. Local data scrollers remain local; no document-level horizontal overflow is introduced.
10. Collapsed Notifications renders a red rounded numerical unread badge whenever the count is positive.
11. The notification badge does not replace its base styles when positional classes are supplied.
12. Mobile behavior does not inherit a desktop content offset.

## 10. Focused verification

The owner has explicitly rejected exhaustive testing. Do not add snapshots, E2E, visual-regression tooling, coverage targets, broad suite runs, new fixtures, or test-only infrastructure.

### 10.1 Minimal automated checks

Update only `__tests__/app-shell/navigation.test.ts` as needed for the new required context boundary.

Required focused assertions:

1. Render `DesktopNavDrawer` inside `DesktopNavigationShell`; confirm initial shell style has `--desktop-navigation-width: 16rem`, drawer has `w-64`, and toggle says expanded.
2. Trigger collapse; confirm the same shell root now has `--desktop-navigation-width: 4rem`, drawer has `w-16`, and `aria-expanded="false"` is exposed.
3. Render a collapsed Notifications item with a positive unread count. Confirm the unread value is present and its badge retains `bg-destructive` and `rounded-full` after positional class composition.
4. Confirm unread count `0` continues to render no visual `NotificationBadge`.
5. Keep the existing role/capability, mobile navigation, active-route, accessible-name, and sign-out checks. Update their direct `DesktopNavDrawer` fixtures to use the new shell provider; do not rewrite their intent.

Run only:

```bash
npm test -- __tests__/app-shell/navigation.test.ts
npm run typecheck
npm run lint
npm run format:check
```

### 10.2 Required manual desktop journeys

Verify in both light and dark themes at viewport widths where the changed geometry matters:

| Journey | Required observable result |
| --- | --- |
| Expanded rail, 1280px desktop | Drawer is 256px; no normal content is under it; content begins to its right; header remains full-width. |
| Collapse/expand transition | Drawer width and main content edge move together over approximately 200ms; no content jump, overlap, horizontal document scrollbar, or route remount. |
| Collapsed rail with 1 unread notification | Bell has a clearly visible red rounded `1` counter at upper right. |
| Collapsed rail with multi-digit and capped count | Counter remains legible and red; `99+` stays a compact rounded badge, does not clip, and does not push/crop the bell. |
| Expanded rail with unread notifications | Existing expanded badge appearance remains intact. |
| Admin project workspace, expanded and collapsed | Header, desktop tabs, overview content, deliverables, members, activity, archive, and calendar surfaces remain visible; no rail coverage. |
| Project Kanban, expanded and collapsed | Board receives remaining width; columns retain readable width and scroll only inside the Kanban board. |
| Calendar week, expanded and collapsed | Calendar grid scrolls only inside its calendar viewport if needed; no drawer coverage or document-level overflow. |
| PM Watcher / Operator / Client route | Authorized links and protected content remain correct; no authorization behavior changed. |
| Global notifications and operations screens | Containers, tables, controls, and local scroll areas stay visible in both rail states. |
| Below 768px | Main is full width; desktop rail is absent; mobile menu behavior is unchanged. |

## 11. Acceptance criteria

### A. Shared geometry

- [ ] `DesktopNavigationShell` is the only state owner for desktop drawer width.
- [ ] Expanded state produces `16rem` main left padding at `md+`.
- [ ] Collapsed state produces `4rem` main left padding at `md+`.
- [ ] Main offset is absent below `md`.
- [ ] Drawer and main transition together and respect reduced-motion preference.
- [ ] `#main-content` remains focusable through its existing ID/tabIndex contract.

### B. Protected-route visibility

- [ ] No ordinary protected content is visually obscured by the drawer in either desktop rail state.
- [ ] Existing centered containers, grids, flex layouts, and responsive breakpoints use the remaining content width naturally.
- [ ] Existing intentional local horizontal scrollers remain contained and usable.
- [ ] No global/page-level horizontal overflow is introduced.
- [ ] Header, modal, dialog, sheet, and toast positioning is not shifted by main-content padding.

### C. Notifications

- [ ] Collapsed Notifications shows a red rounded numeric unread counter when unread count is greater than zero.
- [ ] Counter displays the existing actual count / localized `99+` cap.
- [ ] Counter is absent when unread count is zero.
- [ ] Positional custom classes augment rather than replace base badge styling.
- [ ] Existing accessible notification naming and live-region behavior are unchanged.

### D. Regression boundaries

- [ ] Desktop drawer remains expanded by default and remains non-modal/fixed below the header.
- [ ] Approved PanelLeft icons remain the expand/collapse control.
- [ ] Mobile navigation and layout remain unchanged.
- [ ] Role/capability navigation matrix is unchanged.
- [ ] No data, auth, route, i18n, or dependency change is introduced.
- [ ] Focused test, typecheck, lint, and formatting commands pass.

## 12. Implementation completion report

Antigravity’s implementation report must state:

1. exact changed files;
2. confirmation that S08-02 overlay-only content behavior was replaced only at the shared protected shell;
3. confirmation that drawer state is shared through `DesktopNavigationShell`, not duplicated;
4. notification-badge merge behavior and collapsed positive-count result;
5. each of the four focused command outcomes;
6. manual viewport journeys completed and any concrete local responsive fix made;
7. any blocker or deviation from this specification.

Do not claim that every possible viewport or route has exhaustive automated coverage. State only verified results.
