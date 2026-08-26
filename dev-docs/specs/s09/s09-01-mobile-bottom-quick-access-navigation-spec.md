---
document_id: S09-01-MOBILE-BOTTOM-QUICK-ACCESS-NAVIGATION-SPEC-01
sprint_id: S09
work_item: S09-01
status: implementation-ready
created_at: 2026-08-26T08:30:52-06:00
branch: feature/mobile-ux-ui-refinement
scope: mobile-only protected-shell role-aware bottom quick-access navigation and full-navigation menu relocation
predecessors:
  - dev-docs/specs/s08/s08-02-desktop-global-navigation-drawer-refinement-spec.md
  - dev-docs/specs/s08/s08-03-desktop-drawer-content-reflow-and-collapsed-notification-badge-spec.md
---

# S09-01 — Mobile Bottom Quick-Access Navigation

## 1. Objective

Replace the authenticated mobile shell's top-right menu-only navigation trigger with a persistent, browser-safe bottom quick-access bar. The bar provides five role-safe actions: three approved role-priority destinations, a direct Notifications destination with the existing numerical unread badge, and the complete navigation-menu trigger.

The result must feel like a conventional browser-based mobile application, not a desktop menu compressed onto a phone:

- one-tap access to the destinations each role uses most;
- one-tap notification access and an at-a-glance unread count;
- one-tap access to every other already-authorized destination through the existing full menu;
- no obscured content, unsafe iPhone home-indicator placement, browser-toolbar dependency, duplicate exposed controls, route/authorization drift, or desktop regression.

This is a responsive information-architecture refinement. It does not create a native mobile application, PWA, offline mode, new routes, new permissions, notification data, or a schema/API change.

## 2. Authority, inspected baseline, and accepted decision

Apply authority in this order:

1. Direct Project Owner instruction approving the quick-access matrix in this document.
2. This specification.
3. S08-03 where it governs the existing desktop shell; S08-02 where not superseded by S08-03.
4. `AGENTS.md` and `GEMINI.md`.
5. Existing protected-route authorization, localization, notification, and navigation contracts.

Baseline inspected on `feature/mobile-ux-ui-refinement`:

- `AppNav` builds one server-authorized `AppNavigationItem[]` using `buildNavigationModel`; it already contains all role/capability decisions, localized labels, notification unread count, and count-aware notification accessible name.
- `MobileNavToggle` is a client component rendered within `AppNav`'s `<md` header region. It currently owns the top-right trigger, Escape handling, full-menu visibility, close-on-link behavior, identity, language selector, theme selector, and mobile sign-out action.
- The desktop rail is `hidden md:flex`; the current mobile component is `md:hidden`; the protected layout owns `#main-content` and already applies desktop-only left padding from `DesktopNavigationShell`.
- The existing `NotificationBadge` correctly returns no element at zero, caps visible positive values at localized `99+`, is `aria-hidden`, and merges caller classes with the semantic destructive/rounded badge classes.
- The existing navigation test proves the current authorized route matrix for Admin, PM Lead, PM Watcher, Operator, and Client, plus mobile close-on-link/Escape behavior. It is the focused regression target.

### 2.1 Approved quick-access matrix

The bottom bar always contains exactly five actions, in this visual and DOM order: three role-priority links, Notifications, Menu.

| Role/capacity | Quick action 1 | Quick action 2 | Quick action 3 | Global 4 | Global 5 |
| --- | --- | --- | --- | --- | --- |
| Admin | Home (`/admin`) | Projects (`/admin/proyectos`) | Operations (`/admin/operaciones`) | Notifications (`/notificaciones`) | Menu |
| PM Lead | Home (`/pm`) | Projects (`/pm/proyectos`) | Calendar (`/calendario`) | Notifications (`/notificaciones`) | Menu |
| PM Watcher | Home (`/pm`) | Projects (`/pm/proyectos`) | Calendar (`/calendario`) | Notifications (`/notificaciones`) | Menu |
| Operator | Home (`/operador`) | My Agenda (`/operador/agenda`) | Calendar (`/calendario`) | Notifications (`/notificaciones`) | Menu |
| Client | Home (`/cliente`) | Projects (`/cliente/proyectos`) | Calendar (`/calendario`) | Notifications (`/notificaciones`) | Menu |

Rationale: Admin Operations is an approved Admin-only operational destination and is more valuable than a redundant Calendar shortcut. The other roles retain Home plus their primary work surface, with Calendar as the shared time-oriented shortcut. Archive, Link Incidents, Metrics, and Notification Operations remain reachable only through the full authorized menu unless they are already selected above.

### 2.2 Strict non-goals

Do not:

- change any route, redirect, role, PM Lead/Watcher capability, session, RLS policy, notification query/count, deep link, migration, generated database type, API, or external provider behavior;
- add PWA behavior, a service worker, manifest, offline cache, queue, browser push notification, native wrapper, app-store distribution, or device-specific JavaScript bridge;
- make the five quick actions user-configurable, persisted, reordered, or contextual per page;
- introduce a new component library, Sheet/dialog primitive, animation library, dependency, local storage/cookie preference, global event bus, body scroll lock, swipe gesture, or breakpoint JavaScript;
- alter the desktop `md+` rail, header, content offset, desktop nav model, or desktop drawer state;
- retain an exposed top-right mobile menu trigger;
- duplicate the complete authorized route list in the bottom bar or derive route paths/authorization inside a client component;
- restrict browser zoom, set `maximumScale`, set `userScalable: false`, or use viewport policies that reduce accessibility;
- use `100vh`/`min-h-screen` as the mobile bar's positioning mechanism, arbitrary browser sniffing, magic JavaScript viewport heights, or layout shifting based on the address-bar state.

## 3. Responsive composition contract

### 3.1 Breakpoint and ownership

- The new bottom navigation exists only below the existing `md` boundary: maximum 767 CSS px.
- At `md` and above, it is not visually or accessibly exposed. The existing `DesktopNavDrawer` remains the sole global navigation landmark and the protected main content retains the S08-03 desktop offset.
- At `<md`, the desktop rail remains absent and `#main-content` receives no desktop left offset.
- The bottom navigation is the primary mobile global-navigation landmark. The complete menu may expose a separately and distinctly labelled full-navigation region only while open; do not leave a second visible duplicate set of controls in the header.
- CSS controls responsive visibility. Do not add `window.innerWidth`, `matchMedia`, resize listeners, hydration-time breakpoint state, or device/user-agent detection.

### 3.2 Header after relocation

At `<md`, remove the visible `MobileNavToggle` control from the header's right side. Preserve the existing authenticated header's height, brand/home link, semantic styling, desktop controls, and `md+` identity/sign-out composition. Do not add empty spacers or change the brand route.

The new mobile navigation component is rendered once as a sibling after the header, still inside the protected shell. It owns both the bottom bar and the conditionally open full menu. It must not be rendered inside `#main-content`, a route page, a project workspace, or a dialog.

### 3.3 Five-action bar geometry

The outer mobile bar must be:

```text
fixed; inset-inline: 0; bottom: 0; z-index above normal protected content;
md:hidden; width: 100%; border-top; semantic background; safe-area bottom padding
```

Required geometry and presentation:

- Use a fixed normal-viewport bottom anchor (`bottom-0`); the browser repositions this against its visual viewport as mobile browser chrome expands/collapses. Do not calculate address-bar height.
- Its interactive row is `min-height: 4rem` (64 CSS px) before any bottom safe-area extension. Five equal-width actions must fit across the viewport through `grid grid-cols-5` or an equivalent equal-column layout.
- Each action's actual pointer/keyboard target is at least 44 by 44 CSS px. Do not shrink icon buttons to compensate for a narrow screen.
- The bar has a top border and opaque/near-opaque semantic background that remains visually separated from scrollable content in both light and dark themes. It must not rely on a translucent overlay that makes text or controls behind it actionable or illegible.
- Icons are 20–24 CSS px, decorative (`aria-hidden="true"`), and labels are localized visible text below or beside the icon. Labels are single-line, small, and truncate rather than wrapping or widening columns.
- Do not display a text-only bar, hide labels on narrow standard phones, or use a sixth item. A five-item bar is the exact approved information architecture.
- The active route is represented by `aria-current="page"` plus an existing semantic selected treatment that is distinguishable without color alone. Use the same exact-home versus descendant matching rule as the desktop drawer: Home is active only on exact match; every other quick link is active on its route or descendants.
- The Menu control is not a route link. It uses the existing shadcn `Button` semantics, has `aria-expanded`, `aria-controls="mobile-nav-drawer"`, and a localized next-action label: open when closed, close when open.

### 3.4 Required icon map

Use installed, verified `lucide-react` icons. The mobile quick map is intentionally conventional and independent of localized labels:

| Stable key | Icon |
| --- | --- |
| `home` | `House` |
| `projects` | `FolderKanban` |
| `agenda` | `CalendarCheck` |
| `calendar` | `CalendarDays` |
| `operations` | `SlidersHorizontal` |
| `notifications` | `Bell` |
| `menu` | `Menu` when closed; `X` when open |

Do not invent a client-only route-key enum. Reuse `AppNavigationItemKey` for supplied destinations. Verify Lucide export names from the installed package before editing imports.

## 4. Authorization and navigation-model contract

### 4.1 One authorized source

`AppNav` remains the server component that calls `buildNavigationModel`. It continues to provide the complete authorized, localized, serializable item model to all renderers.

Create a small adjacent pure helper in `navigation-model.ts`, for example `buildMobileQuickAccessItems`, that receives the already-authorized `items` plus the server-known `role`, selects the three approved keys in the exact matrix order, and returns supplied items only. It must not build hrefs, call translations, inspect a session, fetch data, or grant a fallback destination.

Required behavior:

1. Choose keys by application role exactly as Section 2.1.
2. Resolve each key from the supplied `items` list.
3. Fail closed if a required item is absent: do not synthesize an href, show an unauthorized action, substitute a different destination, or leak a route. Treat this as an implementation/test failure because the current model guarantees the required links.
4. Pass the three selected items plus the same complete items model to the client mobile component.
5. Preserve `canAccessNotificationOperations` solely in the full model. PM Watcher must never acquire Notification Operations through the quick bar or menu.

The global notification action is the existing `notifications` item from the authorized model. It is not a separately hard-coded link.

### 4.2 Full-menu contract

The Menu action opens the existing full mobile navigation surface with its established responsibilities:

- full authorized item order from `items`;
- current identity and localized role;
- language switcher and theme toggle;
- current mobile sign-out action;
- link click closes the menu before normal Link navigation;
- Escape closes the menu and restores focus to the Menu button.

Do not remove quick destinations from the full menu. The complete menu is a complete role-safe route index, not a complementary list.

When open, it must be a fixed, scrollable panel beneath the 64px header and above the complete physical height of the bottom bar. Its lower edge must be calculated as:

```css
bottom: calc(var(--mobile-bottom-navigation-row-height) + env(safe-area-inset-bottom, 0px));
```

with `--mobile-bottom-navigation-row-height: 4rem` defined once by the mobile component or protected shell. The panel itself owns `overflow-y-auto`; it must not be cut behind the bar, create document-level horizontal overflow, or cover the bottom action targets. Preserve the existing no-body-scroll-lock behavior.

Use a `z-index` above the bottom bar for the open panel so all its links remain clickable. The bar remains visible below it. The panel must not cover the header, and no header control should become a second menu trigger.

## 5. Notifications contract

Notifications are essential navigation, not an optional menu entry.

- The fourth quick action is always rendered for every authenticated role and links to the existing `/notificaciones` model item.
- Its accessible name is exactly the current count-aware `item.ariaLabel`: for example, `Notification inbox, 3 unread` / `Bandeja de notificaciones, 3 no leídas` when positive; the existing no-count label at zero.
- Render `NotificationBadge` only through the existing component. It remains `aria-hidden`; do not create a second live region or make the badge independently focusable/clickable.
- At count `0`, show no visual badge. At `1` to `99`, show the numeral. Above `99`, show the existing localized `99+` label. Do not replace it with a red dot.
- Position the badge in the upper-right portion of the Bell control without leaving the 44px target, clipping against the viewport, intercepting pointer events, or pushing the icon/label. Use the existing merged positional-class pattern (`pointer-events-none`, absolute, compact red rounded counter).
- Retain exactly one polite unread-count live announcement per currently exposed navigation surface. When the full mobile menu opens, it must not introduce a second competing live announcement beyond the established mobile-menu behavior. If the bottom bar itself receives the live region, remove the menu duplicate rather than announcing twice.

## 6. Mobile browser, safe-area, viewport, keyboard, and zoom contract

### 6.1 Root viewport configuration

Modify `src/app/layout.tsx`—the root server layout—to export a typed Next.js `Viewport` object:

```ts
import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};
```

Requirements:

- Keep `generateMetadata` intact; `viewport` is a separate supported Next App Router export.
- `viewportFit: "cover"` enables layout background to reach device edges while CSS `env(safe-area-inset-bottom)` keeps interactive controls out of the iPhone home-indicator/cutout area.
- `interactiveWidget: "resizes-content"` requests content-layout resize when supported mobile virtual keyboards appear. It improves the chance that fixed controls and active input contexts remain mutually visible without manual viewport calculations.
- Do not set `width`, `initialScale`, `maximumScale`, or `userScalable` unless a direct accessibility-reviewed requirement separately authorizes it. Browser defaults preserve user zoom.

### 6.2 Safe-area and content reservation

The protected layout's `#main-content` must reserve physical space for the fixed bar below `md` and must remove that reservation at `md+`:

```text
padding-bottom: calc(4rem + env(safe-area-inset-bottom, 0px)) below md
padding-bottom: 0 at md and above
```

Implementation may express this with Tailwind arbitrary values or a project-scoped CSS custom property, but the exact computed result is required. Keep the S08-03 `md:pl-[var(--desktop-navigation-width)]` behavior intact. Do not add page-specific padding, margins, transforms, or `overflow: hidden` to route components.

The fixed bar receives matching safe-area bottom padding. Its declared 4rem row remains the interactive-control region; the `env()` value is additional non-interactive bottom breathing room. On rectangular Android/desktop-style viewports, the environment variable falls back to zero.

### 6.3 Dynamic browser UI rules

The implementation must be resilient to iOS Safari, iOS Chrome/Brave, Android Chrome/Brave, and Firefox Android browser toolbar expansion/collapse without attempting to predict each browser:

- Fixed bottom positioning plus safe-area insets is the primary contract.
- Do not use `100vh` for shell/bar height; legacy `vh` may include obscured space beneath dynamic browser UI.
- Do not use `100dvh` for the bar or mandatory content reservation. Dynamic units can resize during scroll and cause visible layout movement. They may be considered only after real-device evidence proves a bounded component needs them and the Project Owner accepts the change.
- Do not use `window.visualViewport`, resize loops, CSS variables written by JavaScript, polling, browser user-agent tests, or hard-coded iPhone/Android dimensions in this slice.
- Test address bar shown and hidden; bar movement with the browser's visual viewport is expected, but content must never end beneath it or behind the home indicator.

### 6.4 Keyboard and focused controls

When an editable field is focused:

- The browser must not leave the focused input permanently behind the fixed bar/virtual keyboard.
- The menu may remain open only if the focused control remains usable; Escape behavior remains functional. Do not add keyboard-specific auto-close behavior without evidence.
- Modal dialogs, toasts, comboboxes, date popovers, and project forms retain their existing overlay behavior. Do not force them into main-content stacking contexts or offset them by the bar.
- If a concrete iPhone/Android defect remains after the typed viewport configuration and content reservation, record device/browser/version/reproduction before proposing a minimal follow-up. Do not preemptively add visual-viewport JavaScript.

### 6.5 Orientation, small widths, and display variants

- Portrait phones from 320 CSS px through standard large-phone widths must keep five visible controls, labels, and 44px targets without horizontal scrolling.
- In landscape or a short visual viewport, the bar remains pinned and the full menu becomes independently vertically scrollable between header and bar. It must not exceed the available viewport or hide its sign-out action permanently.
- The design must remain functional on devices with notches, rounded corners, and gesture/home-indicator areas. `env()` is the only required device-specific mechanism.
- Foldables and split-screen browser windows must follow the same CSS-width breakpoint and available-width rules. Do not add foldable-specific logic in this slice.

## 7. Accessibility, localization, and interaction contract

### 7.1 Semantics and focus

- Use a semantic `<nav aria-label={localizedQuickAccessLabel}>` for the persistent bar. Add distinct `shell.nav.mobileQuickAccessAriaLabel` catalog leaves in both locale files; do not reuse the generic full-navigation label if it leaves two same-name landmarks.
- The open full-menu link region has a distinct localized label, such as `All navigation`, only while visible. Do not expose two indistinguishable navigation landmarks.
- Links use the repository locale-aware `Link`; never use raw anchors or manual locale-prefix construction.
- Buttons and links remain keyboard reachable in DOM order matching visual order. Enter/Space behavior follows native semantics.
- Focus-visible styling uses current project primitives/tokens and remains visible in light and dark mode.
- When the menu closes with Escape, return focus to the Menu control. When a full-menu link is activated, close before navigation; do not attempt focus restoration after route change.
- There is no focus trap, modal backdrop, inert page state, body-scroll lock, outside-click dismissal, or swipe-to-dismiss requirement. Preserve the current mobile model unless a direct accessibility defect is discovered.

### 7.2 Localized text additions

Add matching leaves to `messages/en-US.json` and `messages/es-MX.json` under `shell.nav`:

| Key | English | Spanish |
| --- | --- | --- |
| `mobileQuickAccessAriaLabel` | `Quick access navigation` | `Navegación de acceso rápido` |
| `fullMenuAriaLabel` | `All navigation` | `Toda la navegación` |
| `openQuickAccessMenu` | `Open navigation menu` | `Abrir menú de navegación` |
| `closeQuickAccessMenu` | `Close navigation menu` | `Cerrar menú de navegación` |

Existing `openMenu`/`closeMenu` may be retained instead of the latter two only if the exact existing values and tests are reused; do not create redundant catalog leaves. The implementation must choose one catalog contract and maintain English/Spanish key parity.

All quick links use existing localized `item.label` and `item.ariaLabel`. No quick-link user-visible string is hard-coded in a client component. Menu labels, tooltip text when used, landmark names, and any status text use server-resolved or `next-intl` values following the current mobile component boundary.

### 7.3 Motion, contrast, and touch

- Use only current short CSS transitions, if any. Include `motion-reduce:transition-none` on bar/menu entrance/exit transitions. A no-animation implementation is acceptable.
- Selected, hover, focus, destructive badge, icon, and label treatments must meet the project's existing semantic-theme behavior in light and dark modes. The active indicator must not depend on color alone.
- Do not rely on hover for functionality. Every action is directly touch-accessible.
- Preserve browser pinch zoom and text-size settings. Labels must truncate rather than overflow as system text scale increases; accessibility review must confirm controls remain identifiable through accessible names even where visual text truncates.

## 8. Required implementation sequence

### Step 1 — Preserve scope and inspect current source

Before editing:

1. Confirm branch `feature/mobile-ux-ui-refinement` and preserve unrelated work already present in the working tree.
2. Inspect `AppNav`, `MobileNavToggle`, `navigation-model.ts`, `NotificationBadge`, protected layout, root layout, current navigation tests, locale catalogs, installed Button primitive, and installed Lucide exports.
3. Reconfirm the existing `md` boundary and that `#main-content` remains the single protected main region.
4. Do not start a development server unless the Project Owner explicitly asks the executing agent to do so.

Stop and report if the server-authorized model, role matrix, notification item shape, responsive shell composition, or existing MobileNavToggle behavior differs materially from this specification.

### Step 2 — Make quick-item selection server-safe

Modify `navigation-model.ts` with a narrow pure helper that selects the three approved quick items from the existing `AppNavigationItem[]` using the exact role/key matrix. Add no new authorization source. Add or extend focused tests for exact order and absence of unauthorized routes.

### Step 3 — Refactor the mobile component boundary

Either evolve `mobile-nav-toggle.tsx` into the mobile bottom-navigation component or replace it with a clearly named colocated client component. Prefer a rename only if all imports/tests are updated in the same bounded change.

It receives:

- the complete already-authorized `items` list;
- the three server-selected `quickAccessItems`;
- role/profile presentation inputs already required by the full menu;
- localized landmark/action labels and/or existing next-intl access consistent with current architecture.

It owns only mobile interaction state (`isOpen`), Escape focus restoration, current pathname active treatment, rendering of the five bottom actions, and conditional full menu. It must not fetch data, access server session state, calculate authorization, mutate route/query/session state, or own desktop layout state.

### Step 4 — Relocate the trigger and preserve full menu

Update `AppNav` to remove the mobile trigger from header layout and render the mobile bottom component once below the header. Pass the same complete model and server-selected quick model. Preserve desktop header and drawer inputs unchanged.

Render the full mobile menu above—not behind—the fixed bar; preserve its identity, language, theme, sign-out, authorized link ordering, close-on-link behavior, and Escape restoration.

### Step 5 — Establish viewport and main-content safety

Add the typed root `viewport` export. Add only protected-shell mobile bottom reservation to `#main-content`, scoped below `md`, with the safe-area calculation from Section 6.2. Do not change public/auth layouts, page-level wrappers, desktop rail offset, modal primitives, or route components.

### Step 6 — Localize and test

Update both catalogs with the exact new labels actually consumed. Extend only the focused navigation test and any directly necessary catalog parity test. Preserve existing tests rather than rewriting their role/capability intent.

## 9. Required file inventory

| File | Required change |
| --- | --- |
| `src/components/shared/app-nav/navigation-model.ts` | Add pure server-safe selection of the three approved mobile quick items from existing authorized items; no route synthesis. |
| `src/components/shared/app-nav/app-nav.tsx` | Build full and quick models once; remove top-right mobile trigger placement; render the new/evolved mobile bottom component below header; preserve desktop behavior. |
| `src/components/shared/app-nav/_components/mobile-nav-toggle.tsx` | Evolve or replace as the client mobile bottom quick-access bar plus current full-menu controller. Preserve menu interaction contracts while relocating the trigger. |
| `src/app/[locale]/(protected)/layout.tsx` | Add mobile-only safe-area-aware bottom reservation to existing `#main-content`; retain all authorization/data logic and S08-03 desktop padding behavior. |
| `src/app/layout.tsx` | Add typed Next `viewport` export with only `viewportFit: "cover"` and `interactiveWidget: "resizes-content"`; preserve metadata and layout. |
| `messages/en-US.json` | Add actual required mobile navigation labels. |
| `messages/es-MX.json` | Add equivalent Spanish labels and maintain catalog parity. |
| `__tests__/app-shell/navigation.test.ts` | Preserve role/capability and desktop tests; add focused quick-bar/menu/notification/accessibility contracts. |

Conditional only:

| File | Permitted reason |
| --- | --- |
| `src/app/globals.css` | Only if Tailwind cannot express the exact safe-area/custom-property calculation cleanly without duplicating rules. Keep any rule scoped, semantic, and minimal. |
| `__tests__/i18n/message-catalogs.test.ts` | Only if the existing catalog parity contract needs a bounded assertion for the new mobile navigation keys. |

Do not modify database code, migrations, Supabase client/auth code, routes, notification query/action code, desktop drawer/shell code, shared Button/Tooltip primitives, unrelated project pages, dependencies, `next.config.ts`, `package.json`, or CHANGELOG for this slice.

## 10. Focused automated verification

Do not add browser E2E, Playwright, visual snapshots, new test infrastructure, full-suite/coverage requirements, or broad cross-feature tests. Extend `__tests__/app-shell/navigation.test.ts` to prove the public component contract.

Required assertions:

1. **Exact five actions per role:** Admin, PM Lead, PM Watcher, Operator, and Client each expose exactly the approved three quick hrefs, then Notifications, then Menu; no sixth quick item appears.
2. **Server-model safety:** quick selection returns only items present in the supplied authorized model; no missing/unauthorized route is synthesized. PM Watcher has no Notification Operations. Operator/Client have no Admin-only shortcut.
3. **Notification behavior:** all roles have the notification link with its current count-aware accessible name; count `0` has no visual badge; positive count renders existing badge value/classes; a value over `99` renders localized `99+`.
4. **Active state:** exact home matching and non-home descendant matching set `aria-current="page"` correctly; Home does not remain active on a descendant route.
5. **Menu interaction:** Menu truthfully toggles `aria-expanded`; it controls `mobile-nav-drawer`; its icon/name changes to the next action; full authorized menu content appears only when open.
6. **Existing regression behavior:** Escape closes the menu and returns focus to Menu; clicking a full-menu link closes it; language switcher, theme control, identity, and sign-out remain in the open menu.
7. **Responsive composition contract:** static output/class assertions prove no top-header mobile menu button is rendered and the bottom component is `md:hidden`; desktop rail tests remain unchanged.
8. **Content reservation/viewport structure:** protected layout retains `#main-content`, `tabIndex={-1}`, desktop CSS variable padding, and includes the mobile safe-area bottom reservation. Root layout exposes the typed viewport contract if it can be asserted without brittle framework internals; otherwise TypeScript compilation is the contract evidence.
9. **Localization parity:** all newly used leaves resolve in both English and Spanish catalogs; no client fallback key is visible.

Run only:

```text
npm test -- __tests__/app-shell/navigation.test.ts
npm run typecheck
npm run lint
npm run format:check
```

If the project-wide formatter/linter reports unrelated pre-existing failures, identify the exact affected files and separately confirm the changed files satisfy the formatter/linter where the repository tooling permits. Do not format or modify unrelated work to make a global command green.

## 11. Required real-device manual verification

Desktop device emulation is not acceptance evidence for this item. The Project Owner must be able to run the local development server from their own terminal and use an authenticated real device on the same Wi-Fi. Do not claim a journey passed unless it was observed on the stated browser/device.

### 11.1 Required device/browser matrix

| ID | Device/browser | Orientation/state | Required result |
| --- | --- | --- | --- |
| M-01 | iPhone Safari | Portrait; address bar visible and collapsed | Bar stays visible above home indicator; five targets fit; content end is not obscured. |
| M-02 | iPhone Safari | Landscape; short viewport | Bar remains reachable; full menu scrolls between header/bar; all items including sign-out remain reachable. |
| M-03 | iPhone Chrome or Brave | Portrait | Same bar, safe area, links, badge, and menu behavior as Safari. |
| M-04 | Android Chrome | Portrait; address bar visible and collapsed | Bar remains pinned/usable; no content is hidden; no horizontal document overflow. |
| M-05 | Android Brave or Firefox | Portrait | Core fixed-bar/menu/notification behavior matches Chrome. |
| M-06 | Any tested phone/browser | Light then dark | Borders, labels, icons, active state, destructive badge, and full menu remain legible. |
| M-07 | Any tested phone/browser | Keyboard open in a protected form/dialog | Focused field remains usable; bar/keyboard do not trap or permanently cover the field; no page crash or uncontrolled viewport jump. |

If only the iPhone is available initially, M-01, M-02, M-06, and M-07 are the minimum accepted owner evidence. Android/browser variation is still a follow-up validation requirement, not a reason to fake coverage.

### 11.2 Role and interaction journeys

| ID | Persona/route | Steps | Required result |
| --- | --- | --- | --- |
| R-01 | Admin, unread 0 then positive-unread if available | Visit Admin home; open each quick action; inspect bell at 0/positive counts; open Menu. | Home, Projects, Operations, Notifications, Menu in order. Bell badge absent at zero and red numerical at positive. Menu contains all Admin routes including Metrics/Archive/Link Incidents/Notification Operations. |
| R-02 | PM Lead and PM Watcher | Visit PM home; inspect quick bar and open Menu. | Both show Home/Projects/Calendar/Notifications/Menu. PM Lead sees Notification Operations only when current capability allows; Watcher never sees it. |
| R-03 | Operator | Visit operator home and agenda. | Home/My Agenda/Calendar/Notifications/Menu in order; no Admin/PM-only action; full menu retains Archive. |
| R-04 | Client | Visit client home and projects. | Home/Projects/Calendar/Notifications/Menu in order; client-safe full menu only. |
| R-05 | Any role, nested non-home route | Navigate to a descendant of a quick link. | Correct non-home item is semantically/visually active; Home is not falsely active. |
| R-06 | Any role | Open Menu; press Escape; reopen; activate a menu-only item. | Escape returns focus to Menu; link activation closes menu before navigation; bar remains present after route change. |
| R-07 | Any role, long list/table/Kanban/calendar page | Scroll to final content/control with bar visible. | Main content ends above bar; local horizontal scrollers remain local; document has no unintended horizontal overflow. |
| R-08 | Any role, text zoom/system larger text where available | Increase text size or browser zoom. | Controls retain meaningful accessible names and remain tappable; truncation is preferable to overlap/wrapping. |

## 12. Definition of done

S09-01 is complete only when all are true:

1. At widths below 768 CSS px, authenticated users have one persistent five-action bottom quick-access bar with the exact approved role matrix.
2. Notifications and Menu are present for every role; Notifications is a direct existing inbox link with the existing red numerical unread badge/count behavior.
3. The full role-safe mobile navigation menu remains complete and is opened from the bottom Menu action, not a top-right header trigger.
4. The component consumes the server-authorized navigation model and does not reconstruct routes/permissions on the client.
5. PM Lead/Watcher and all Admin/Operator/Client boundaries remain unchanged.
6. Mobile content reserves bar plus safe-area space; no protected route's last content is hidden by the bar.
7. Root viewport configuration supports safe-area layout and keyboard content resizing without disabling zoom.
8. The bar/menu behave correctly under changing mobile browser chrome without `100vh`, browser sniffing, JavaScript viewport measurement, or hard-coded device dimensions.
9. Safe areas, landscape, keyboard, touch targets, focus behavior, localized labels, live announcements, dark/light contrast, and reduced-motion behavior meet this specification.
10. At `md+`, the bottom bar/top mobile trigger are not exposed and the S08 desktop drawer/header/main-offset contract is unchanged.
11. Focused automated checks in Section 10 pass, except separately documented pre-existing environment/repository blockers.
12. The manual journeys that are actually available are recorded truthfully by device/browser; untested device/browser rows remain explicitly unverified.
13. The final repository diff contains only this specification and the approved implementation/test/catalog/layout files; no database, provider, deployment, package, or unrelated formatting churn is included.

## 13. Risks and stop conditions

- **Authorization/model drift:** Stop if a desired quick item is absent from the current server-authorized model. Do not synthesize a route or “fix” authorization in the client.
- **Duplicate controls/landmarks:** Stop if responsive composition leaves both a top-right menu button and bottom Menu exposed, or makes two indistinguishable navigation landmarks available. Correct the composition before continuing.
- **Unsafe content geometry:** Stop if the fixed bar covers the bottom of main content, an open full menu, a local scroller, or a dialog. Fix the single protected-shell reservation/panel boundary; do not scatter page-level padding.
- **Safe-area regression:** Stop if an iPhone home indicator/cutout obscures a bar control or badge. Do not ship a device-specific pixel workaround; correct `viewportFit`/`env()` usage.
- **Keyboard defect:** Stop if the typed viewport contract still leaves a focused form field inaccessible. Capture a real-device reproduction before proposing a narrow follow-up; do not add speculative visual-viewport JavaScript.
- **Breakpoint regression:** Stop if desktop rail/header behavior changes at `md+`, or CSS visibility creates a client/server hydration mismatch. The mobile bar is CSS-gated only.
- **Localization gap:** Stop if every newly rendered user-facing label cannot be added with English/Spanish parity. Do not hard-code English/Spanish in the client component.
- **Scope expansion:** Stop if implementation appears to require a migration, notification-data change, route/security change, PWA/native runtime, dependency, body-scroll lock, gesture system, or redesign of desktop navigation. Return a decision request instead.
- **Unrelated working tree:** Preserve all pre-existing modifications. Do not run broad formatters or use destructive Git commands to clear another agent's/user's changes.

## 14. Source rationale

This specification is grounded in current platform guidance consulted on 2026-08-26:

- Next.js CLI documents `--hostname` for LAN development access and Next's `allowedDevOrigins` policy for development assets.
- Next.js App Router supports a typed `viewport` export with `viewportFit` and `interactiveWidget` fields.
- MDN documents `env(safe-area-inset-bottom)` for keeping fixed/sticky controls clear of unsafe display regions and dynamic obstructions.
- web.dev documents mobile browser small/large/dynamic viewport behavior and the risks of legacy `100vh` under dynamic browser chrome.

These sources justify the fixed-bottom plus safe-area/padding approach. They do not authorize a native/PWA/offline scope change.
