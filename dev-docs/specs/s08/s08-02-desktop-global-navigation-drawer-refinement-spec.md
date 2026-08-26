---
document_id: S08-02-DESKTOP-GLOBAL-NAVIGATION-DRAWER-REFINEMENT-SPEC-01
sprint_id: S08
work_item: S08-02
status: implementation-ready
created_at: 2026-08-25T10:49:14-06:00
branch: feature/manual-ux-ui-pass
scope: desktop-only protected-shell global-navigation information-architecture refinement
predecessor: dev-docs/specs/s08/s08-01-desktop-project-workspace-navigation-layout-refinement-spec.md
---

# S08-02 — Desktop Global Navigation Drawer Refinement

## 1. Objective

Replace the crowded desktop top-level link row with a persistent, collapsible left navigation drawer for every authenticated application user.

At desktop widths, the global header must retain only:

1. the Joya Star Films icon centered; wordmark, and existing role-home link where they currently are;
2. the language toggle;
3. the theme selector;
4. the authenticated user’s name and localized role; and
5. the existing top-header sign-out button.

Every route-navigation link currently shown in the desktop header must move to the new left drawer. The drawer must be expanded by default after authentication, collapse and expand from its own lucide react drawer icon control, preserve each user’s existing authorized route set, and provide a second sign-out control under the user identity at its bottom.

This is a standard desktop application-shell navigation change. It exists to remove link wrapping/crowding from the header, not to change routing, permissions, data, session behavior, or mobile navigation.

## 2. Authority, baseline, and diagnosis

Apply authority in this order:

1. Direct Project Owner direction in the S08-02 request.
2. This specification.
3. `AGENTS.md` and `GEMINI.md`.
4. Existing protected-route, authorization, localization, and navigation contracts.

Baseline inspected on `feature/manual-ux-ui-pass` at `ed68057`:

- The protected root layout (`src/app/[locale]/(protected)/layout.tsx`) renders the shared `AppNav` above one `#main-content` element for all authenticated roles.
- `src/components/shared/app-nav/app-nav.tsx` currently renders the complete desktop link set inline beside the brand within a 64px sticky header. At `md` (768px) and wider, long Spanish labels such as `Incidentes de Enlaces` and `Operaciones de Notificaciones`, combined with the identity controls, make that single horizontal row the source of the reported crowding/wrapping risk.
- The desktop link matrix is role-derived in `AppNav`; the same route-selection logic is duplicated in the client `MobileNavToggle`.
- The current mobile drawer is a separate `<md` top drop-down. It already contains the role-safe link matrix, language/theme controls, identity, and sign-out action. It is not a desktop drawer and must remain functionally and visually unchanged in this item.
- The repository already contains the installed shadcn/Base UI `Button` and `Tooltip` primitives. Its installed `Sheet` primitive is modal and backdropped; it is not the correct primitive for a persistent, non-modal desktop navigation drawer.
- `__tests__/app-shell/navigation.test.ts` is the focused existing navigation contract. It already proves all role/capability routes, unread inbox labeling, mobile role matrix, mobile close-on-link behavior, and Escape behavior.
- S08-01 moves internal *project-workspace tabs* into the project header. This global drawer must not become a project-content rail or reduce the available width of any selected project view.

## 3. Scope and explicit non-goals

### 3.1 Included

- Desktop (`md`, CSS width >= 768px) protected-shell header simplification.
- A new persistent, non-modal desktop left navigation drawer containing the current authorized global links.
- Expanded-by-default and in-session collapse/expand behavior.
- Drawer active-route indication, icon-only collapsed mode, localized accessible names/tooltips, unread notification treatment, and bottom user/sign-out area.
- Removal of the desktop top-link `<nav>` from `AppNav`.
- Consolidation of the role-derived navigation model so desktop and mobile render the same server-authorized link set without independently reconstructing role paths.
- A minimal update to the existing navigation test file for the changed contract.

### 3.2 Explicitly excluded

- Any route, redirect, server authorization, RLS, role, membership, notification-count, session, sign-out, or data-query change.
- Any change to the `ProtectedLayout` authentication/route-guard logic or its one `#main-content` ownership.
- Any change to mobile navigation, including its current trigger, open/close behavior, controls, top drop-down geometry, or link order.
- A modal drawer, backdrop, focus trap, body scroll lock, gesture drawer, keyboard shortcut, persisted drawer preference, or new local-storage/cookie state.
- A content-pushing desktop sidebar, a CSS grid/main-width rewrite, per-page left padding, a project-workspace rail, or a change to S08-01’s full-width project-view contract.
- A new shared shadcn primitive, a modification to `src/components/ui/sheet.tsx`, a dependency change, or a migration.
- Broader visual redesign of buttons, header height, typography, theme system, or authenticated pages.
- Full-suite, coverage, browser-E2E, snapshot, or pixel-geometry test work.

## 4. Exact desktop shell contract

### 4.1 Breakpoint and composition

- Apply the desktop drawer only at `md` and wider (minimum 768 CSS px), matching the existing desktop-header breakpoint.
- Below `md`, continue to expose only the existing mobile `MobileNavToggle`; do not mount a second *exposed* desktop navigation landmark at that viewport.
- At `md` and wider, render exactly one exposed global-navigation landmark: the new desktop drawer. The removed header link row must not remain visually or accessibly exposed.
- The header remains `sticky top-0`, 64px high, full width, and above the drawer (`z-40` header; drawer below it, for example `z-30`).
- Keep the protected layout’s existing normal-flow main region unchanged. The drawer is a fixed overlay that begins at `top-16`, ends at the viewport bottom, and is anchored at `left-0`; it must not add margin, padding, grid columns, width calculations, transforms, or layout containment to `#main-content` or route children.
- This overlay behavior is intentional. When expanded, the drawer covers only the left edge of an underlying page; collapsing it immediately restores that screen area. It must never resize, squeeze, reflow, or impose a horizontal-width ceiling on the main application surface.
- The drawer itself owns `overflow-y-auto` for an unusually long localized link/user area. It must not create page-level horizontal overflow.

### 4.2 Simplified header

At `md` and wider, the existing `AppNav` header contains no route-navigation links. Preserve:

- centered: existing linked Joya icon and `Joya Star Films` wordmark, targeting the current role’s existing home route;
- right, in this visual order: existing `LanguageSwitcher`, existing `ThemeToggle`, the full name and localized role, and existing `SignOutButton`.

Implementation details:

- Keep the existing role-home route logic and localized brand text.
- Keep language/theme controls at their existing header location; do not duplicate them in the desktop drawer.
- Keep the existing top-header user identity and sign-out control, even though the drawer supplies a deliberately redundant identity/sign-out area as requested.
- Make the identity wrapper `min-w-0`; truncate a long full name rather than allowing the header row to wrap or expand horizontally. Preserve the role on a distinct small text line.
- Keep controls `shrink-0` as necessary. Do not reduce header touch targets below the current controls’ dimensions.
- The existing `<md` mobile area stays unchanged. It may remain in the DOM under its existing `md:hidden` boundary, but it must not be exposed at desktop widths.

## 5. Desktop drawer contract

### 5.1 Structure and geometry

Create a dedicated client interaction component under `src/components/shared/app-nav/_components/`, named `desktop-nav-drawer.tsx`.

Its outer landmark must be a semantic `<nav aria-label={localizedMainNavigationLabel}>` with these desktop-only properties:

- fixed from below the 64px header to viewport bottom;
- left anchored, vertical, bordered on its right edge, background using existing semantic theme tokens, and a subtle shadow only if it improves edge separation in both themes;
- width transition using the project’s existing Tailwind transition utilities, with a short 150–200ms duration and no JS animation library;
- expanded width: `w-64` (256px);
- collapsed width: `w-16` (64px);
- `overflow-x-hidden`, preventing long translated labels from changing the panel width;
- a flex column layout with a scrollable navigation region and a bottom identity/sign-out region.

Do not use a modal shadcn `Sheet`: the drawer is permanently present, non-modal, does not dim the page, and must not trap focus. Use existing shadcn `Button` for the control and existing shadcn/Base UI `Tooltip` components for collapsed-mode labels.

### 5.2 Expanded initial state and collapse control

- Initialize drawer state with `useState(true)`. Thus, each fresh authenticated shell mount begins expanded by default.
- Do not persist a collapse preference. A reload/new authenticated shell returns to expanded; retaining state while the protected layout naturally remains mounted during client route changes is acceptable.
- Place the collapse/expand control at the top of the drawer. It must be a 44px minimum interactive button with the Lucide icon `panel-left-open` when it is collapsed and `panel-left-close` when it is expandeded, as its sole visible graphic; the icon is decorative in the control (`alt=""` or equivalent) because the button has its own localized accessible label.
- Expanded state: clicking the lucide icon button collapses the drawer. Collapsed state: clicking it expands the drawer.
- The control exposes `aria-expanded` truthfully and a stable `aria-controls` relationship to the drawer navigation region. Use the required localized, action-oriented labels for the *next* action: `Collapse navigation` / `Expand navigation` in English and `Contraer navegación` / `Expandir navegación` in Spanish. Do not reuse the mobile open/close-menu strings; their semantics are not exact.
- The control retains an obvious `focus-visible` treatment. It remains keyboard-operable by Enter and Space through the shadcn button primitive.

### 5.3 Navigation links

Render the same authorized routes and exact order already exposed today. Build this list once in the server `AppNav` layer and pass the serializable model to both desktop and mobile renderers; do not keep role-path conditionals duplicated inside `MobileNavToggle` and a new desktop component.

Define a narrow shared serializable item contract in the closest app-nav module, for example:

```ts
type AppNavigationItem = {
  key:
    | "home"
    | "projects"
    | "agenda"
    | "calendar"
    | "archive"
    | "linkIncidents"
    | "metrics"
    | "operations"
    | "notifications"
    | "notificationOperations";
  href: string;
  label: string;
  ariaLabel?: string;
  unreadCount?: number;
};
```

Implement this contract in `src/components/shared/app-nav/navigation-model.ts` as a small, non-client app-nav model with no component rendering and no duplicated role decision tree. `AppNav` remains responsible for server-derived authorization/capability decisions and localized labels. Client components only render their supplied model.

Use this exact order and matrix:

| Order | Item | Admin | PM Lead | PM Watcher | Operator | Client |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Home | `/admin` | `/pm` | `/pm` | `/operador` | `/cliente` |
| 2 | Projects / My Agenda | `/admin/proyectos` | `/pm/proyectos` | `/pm/proyectos` | `/operador/agenda` | `/cliente/proyectos` |
| 3 | Calendar | `/calendario` | `/calendario` | `/calendario` | `/calendario` | `/calendario` |
| 4 | Archive | `/admin/archivo` | `/pm/archivo` | `/pm/archivo` | `/operador/archivo` | `/cliente/archivo` |
| 5 | Link Incidents | `/admin/incidentes-enlaces` | `/pm/incidentes-enlaces` | `/pm/incidentes-enlaces` | absent | absent |
| 6 | Metrics | `/admin/metricas` | `/pm/metricas` | `/pm/metricas` | absent | absent |
| 7 | Operations | `/admin/operaciones` | absent | absent | absent | absent |
| 8 | Notifications | `/notificaciones` | `/notificaciones` | `/notificaciones` | `/notificaciones` | `/notificaciones` |
| 9 | Notification Operations | `/admin/notificaciones` | `/pm/notificaciones` | absent | absent | absent |

Rules:

- `Notification Operations` is present only when the existing server-provided `canAccessNotificationOperations` capability is true **and** the role is Admin or PM. This preserves the current PM Lead/PM Watcher distinction.
- The notification item retains its existing unread count display and the existing localized count-aware inbox accessible name. Keep the live unread-count announcement once per exposed navigation surface; do not add a second live region inside a link.
- Use Lucide icons already installed in the repository. Map stable item keys to a concise, conventional set: `House`, `FolderKanban`, `CalendarCheck`, `CalendarDays`, `Archive`, `Link2`, `ChartNoAxesCombined`, `SlidersHorizontal`, `Bell`, and `BellRing`. The final icon import names must be verified against the installed `lucide-react` package before implementation; do not replace a missing icon with untyped code.
- Each link is a single-line, `min-h-[44px]` interactive row with its icon, label, focus treatment, hover treatment, and no text wrapping. In expanded state, use `truncate` for the label as a defensive constraint; the fixed 256px panel is sufficient for the present Spanish labels.
- In collapsed state, render icons centered in the 64px rail. Do not leave the visible text taking space. Each link still has its localized accessible name (`aria-label` when its visual text is hidden) and a right-side tooltip containing its localized label. The notification tooltip remains the notification label; its count-aware accessible name remains on the link.
- For the active route, use a semantic active indicator that does not depend on color alone: `aria-current="page"`, a selected background/border treatment, and the existing focus-visible treatment. The role home link is active only on an exact home-route match. Other items are active on their own route or descendants (`pathname === href || pathname.startsWith(`${href}/`)`). Do not let `/admin` or `/pm` falsely mark every descendant route as Home.
- Use the repository’s locale-aware `usePathname` from `@/i18n/routing` in the desktop client renderer. It must work for Spanish default paths and `/en/...` URLs without manual locale stripping.
- Links must not programmatically close the desktop drawer. It is persistent navigation; its collapsed/expanded state changes only through its explicit icon control.

### 5.4 Bottom user and sign-out region

At the bottom of the drawer, below a separator, render:

1. the same authenticated user full name;
2. the same server-localized role label; and
3. a second existing `SignOutButton` directly below that identity block.

Requirements:

- This region is anchored below the navigation list with `mt-auto`; it is not interleaved with route links.
- In expanded mode, the sign-out button is full width and retains at least a 44px target. Its visual and accessible label stays the existing localized `shell.nav.signOut` label.
- In collapsed mode, retain a centered icon-only sign-out action (use `LogOut`) with the same localized accessible label and tooltip. Do not remove sign-out access merely because the user collapsed the drawer.
- User text may be visually hidden in collapsed mode, but the identity must be fully visible again after expand. Do not invent a profile route or modify the authenticated profile.
- Preserve the existing top-header sign-out action exactly. The drawer’s sign-out action is a requested second entry point and calls the same component/session behavior.

## 6. Required implementation sequence

### Step 1 — Reconfirm the bounded surfaces

Before editing:

1. inspect `git status --short --branch` and preserve unrelated work;
2. inspect `AppNav`, `MobileNavToggle`, `SignOutButton`, `NotificationBadge`, `LanguageSwitcher`, `ThemeToggle`, the protected layout, and `__tests__/app-shell/navigation.test.ts`;
3. inspect the installed `Button`, `Tooltip`, and Lucide exports needed by the exact icon map; and
4. confirm that `md` remains the existing desktop boundary and the protected layout still owns the one main-content region.

Stop and report if the role matrix, server capability input, shared protected layout, or existing mobile architecture differs materially from this specification. Do not infer replacement routes or permissions.

### Step 2 — Centralize the server-derived navigation model

In the closest app-nav module, extract the present `AppNav` role/capability/link calculations into one small model builder called by `AppNav`.

It must return only the authorized, localized route data required by renderers, including notification presentation data. It must preserve:

- the current role home paths;
- role-specific secondary/Archive/Incidents/Metrics/Operations paths;
- capability-gated Notification Operations;
- the current unread count, display badge, count-aware inbox `aria-label`, and live-region translation behavior; and
- exact existing translation keys.

Pass the model to `MobileNavToggle` and replace that component’s duplicated path/capability calculations with rendering from the supplied model. Keep the existing mobile visual order, click-to-close behavior, Escape close/focus restoration, and controls unchanged. This is consolidation, not a mobile UX change.

### Step 3 — Add the desktop drawer component

Implement `desktop-nav-drawer.tsx` as the narrow client boundary owning only:

- `isExpanded` state;
- `usePathname` active-route evaluation;
- width/label visibility styling;
- the collapse button;
- item/icon rendering and collapsed tooltips; and
- the requested drawer identity/sign-out presentation.

It receives the server-supplied navigation model, profile display name, localized role display name, navigation landmark label, and any narrowly required already-localized control strings. It must not derive authorization, fetch data, read session state, alter routes, own mobile state, or mutate external state.

Use existing `Button`, `Tooltip`, `TooltipTrigger`, and `TooltipContent`. A `TooltipProvider` may wrap the drawer once if the installed primitive requires it. Do not introduce a new base primitive or copy shadcn source.

### Step 4 — Simplify `AppNav`

Update `AppNav` to:

1. build the server-authorized navigation model once;
2. render the simplified desktop header described in Section 4.2;
3. render `DesktopNavDrawer` as the desktop-only navigation landmark; and
4. pass the same model to the existing mobile component.

Remove only the old desktop inline link `<nav>` and its individual duplicated link JSX. Keep the brand link, translations, unread count, live announcement semantics, identity, language/theme controls, top sign-out button, and mobile toggle behavior intact.

Do not modify `src/app/[locale]/(protected)/layout.tsx` unless direct inspection proves a required, minimal wrapper is impossible without it. The intended result needs no main/content-width layout change.

### Step 5 — Preserve interaction and responsive boundaries

Confirm in implementation that:

- the expanded drawer is visible immediately at a new desktop authenticated shell mount;
- width transitions occur without shifting/reflowing main content;
- collapsed links and sign-out retain accessible names and tooltips;
- Enter/Space work on the control, Tab enters each link/action, and focus is visibly preserved;
- the drawer is not modal: it does not backdrop, trap focus, lock scrolling, or close on unrelated main-content clicks;
- screen readers see one exposed desktop navigation landmark at `md+` and the existing one exposed mobile navigation at `<md`;
- all currently authorized routes remain reachable and all currently unauthorized routes remain absent; and
- the mobile drawer’s current close-on-link and Escape behavior remains untouched.

### Step 6 — Add the required localized control labels

Add matching leaves in `shell.nav` in both catalogs:

```text
collapseNavigation
expandNavigation
```

The Spanish values are `Contraer navegación` and `Expandir navegación`; the English values are `Collapse navigation` and `Expand navigation`. Pass these server-resolved labels to the client drawer; do not hard-code user-visible strings in the component. Preserve catalog parity.

No `CHANGELOG.md` change is required for this bounded UI specification/implementation unless the Project Owner separately authorizes normal changelog maintenance.

## 7. Required file inventory

| File | Required change |
| --- | --- |
| `src/components/shared/app-nav/app-nav.tsx` | Build the one server-authorized localized navigation model; remove the desktop inline route row; preserve only the specified desktop header controls; render the desktop drawer; pass the shared model to mobile. |
| `src/components/shared/app-nav/_components/desktop-nav-drawer.tsx` | New client component implementing the fixed, non-modal desktop overlay drawer, expanded state, lucide icon control, active route behavior, collapsed tooltips, and bottom identity/second sign-out. |
| `src/components/shared/app-nav/_components/mobile-nav-toggle.tsx` | Receive/render the shared item model instead of locally duplicating role/capability route derivation; preserve all current mobile behavior and layout. |
| `src/components/shared/app-nav/navigation-model.ts` | New small serializable `AppNavigationItem` type and role/capability model builder. Keep it adjacent to app-nav; do not create a general-purpose navigation framework. |
| `__tests__/app-shell/navigation.test.ts` | Adjust existing focused navigation contract for the model consolidation and add bounded desktop-drawer interaction/accessibility coverage. |
| `messages/es-MX.json`, `messages/en-US.json` | Add the matching `shell.nav.collapseNavigation` and `shell.nav.expandNavigation` control labels. |

Conditional only:

| File | Permitted reason |
| --- | --- |
| `src/components/shared/app-nav/_components/sign-out-button.tsx` | Only the smallest prop extension needed to correctly render an icon-only collapsed drawer action while preserving its current header/mobile callers and sign-out behavior. |

Do not modify `ProtectedLayout`, route pages, project-workspace components, `src/components/ui/sheet.tsx`, other shadcn primitives, database/migrations, generated types, dependencies, or unrelated tests.

## 8. Minimal acceptance evidence

This item deliberately requires no exhaustive test campaign. Extend the existing focused navigation test only enough to protect the changed public contract; do not create a second test suite or test CSS pixels in jsdom.

### 8.1 Focused automated checks

In `__tests__/app-shell/navigation.test.ts`, preserve the existing role/capability assertions and add only these desktop-drawer checks:

1. a new desktop drawer starts expanded and exposes the supplied Admin authorized items, localized identity, and second sign-out entry;
2. its icon control truthfully changes `aria-expanded` and the drawer state between expanded/collapsed;
3. a collapsed global link and collapsed sign-out control retain their localized accessible names; and
4. a descendant route marks the correct non-home item `aria-current="page"`, while the home link is not incorrectly active on that descendant.

Keep existing mobile tests as regression coverage for its unchanged behavior. Do not add visual snapshots, E2E, coverage targets, broad role-journey duplication, or full-suite execution.

Run only:

```text
npm test -- __tests__/app-shell/navigation.test.ts
npm run typecheck
npm run lint
npm run format:check
```

Do not add a separate catalog test merely for these two leaves; the existing navigation test’s translation mock consumes the Spanish catalog directly. Do not run `npm run verify`, coverage, `npm run build`, or a full test suite unless a focused command exposes a real framework-boundary failure that needs escalation.

### 8.2 Concise manual verification

Use an authenticated local demo only when available. Record factual results; do not claim an unavailable persona or viewport passed.

| ID | Viewport/persona | Steps | Required result |
| --- | --- | --- | --- |
| D-01 | 1280px, Admin, Spanish | Load an authenticated admin page. | Header has brand plus language/theme/user/top sign-out only; drawer begins expanded; all nine authorized global items appear in order; no inline header links wrap. |
| D-02 | 1280px, PM Watcher, Spanish | Load an authenticated PM page. | Drawer has permitted PM items; Notification Operations and Admin Operations are absent; no new authority appears. |
| D-03 | 1280px, Operator or Client, English | Load an authenticated role page; collapse then expand; activate a non-home nested route. | Main page geometry does not resize when drawer changes width; collapsed controls have usable tooltips/accessible labels; correct link is active; localized labels remain correct. |
| D-04 | 1280px, any role, light then dark | Visit a project workspace and switch a project tab/Kanban if available. | Global drawer overlays rather than constrains content; S08-01 project-header tabs and selected content retain normal full width; drawer/header/dividers/icons remain legible in both themes. |
| M-01 | Existing supported width below 768px | Open and use the current mobile navigation drawer. | Existing mobile trigger, link order, close-on-link behavior, identity, language/theme controls, and sign-out behavior remain materially unchanged; no desktop drawer is exposed. |

## 9. Definition of done

S08-02 is complete only when all of the following are true:

1. At desktop widths, no global route links remain in the top header.
2. The simplified top header retains exactly the requested brand, language toggle, theme selector, user name/role, and top sign-out entry.
3. A left fixed, non-modal desktop drawer is expanded by default and collapses/expands through its lucide icon button.
4. The drawer uses the exact existing role/capability route matrix; no unauthorized item becomes visible and no authorized existing item disappears.
5. The drawer includes its own bottom user/role display and second sign-out control.
6. Expanded and collapsed states remain keyboard-accessible, localized, and readable in light/dark themes; collapsed icon controls retain names/tooltips.
7. Route-active state is correct and is not color-only.
8. Main content, including S08-01 project workspaces, does not resize, reflow, or lose available width when the drawer is expanded/collapsed.
9. Mobile navigation remains unchanged below `md`.
10. The four focused commands in Section 8.1 pass with real output, except a documented environment blocker.
11. Manual checks D-01 through D-04 and M-01 are passed or honestly recorded as unavailable/blocking.
12. The final working tree contains only this specification and the approved implementation/test/catalog files; no Git mutation occurs unless separately authorized.

## 10. Risks and stop conditions

- **Role-model drift:** Stop if current route authorization, capability logic, or role paths differ from the matrix in Section 5.3. Reconcile the discrepancy before rendering an item.
- **Main-layout pressure:** Stop if an approach requires changing global main widths, route-page padding, or project-workspace layout to make the drawer fit. The required design is overlay navigation, not a content-pushing sidebar.
- **Primitive mismatch:** Stop if the installed shadcn/Base UI `Tooltip` or `Button` API differs from the documented local primitive source. Adapt only to the installed API; do not vendor or upgrade a component library to solve this item.
- **Accessibility duplication:** Stop if the responsive composition leaves two exposed navigation landmarks or duplicate usable link controls at a viewport. Correct the breakpoint composition rather than hiding an accessibility conflict cosmetically.
- **Localization gap:** Stop if a required new control label has no correct catalog entry and a matching bilingual catalog update cannot be made in scope. Do not hard-code it.
- **Unexpected mobile impact:** If navigation-model consolidation changes mobile visual order, close behavior, Escape handling, or content geometry, restore the current mobile presentation before continuing.
- **Scope expansion:** Stop if implementation appears to require a modal/Sheet rewrite, session persistence, profile work, a navigation redesign for Client/Operator pages, data/schema changes, or modification of S08-01 project components. Those are separate decisions.
