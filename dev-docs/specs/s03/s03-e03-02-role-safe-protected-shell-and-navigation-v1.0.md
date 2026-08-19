---
spec_id: S03-E03-02
feature_slug: role-safe-protected-shell-and-navigation
sprint: S03
epic: E03
work_item: S03-E03-02
status: ready-for-implementation
version: 1.0
created: 2026-08-18
updated: 2026-08-18
branch: feature/s03-e03-identity-onboarding-and-role-safe-shell
risk: high
sources:
  - contracts/openapi/jsf-pm-api.openapi.yaml
  - dev-docs/specs/s03/feature/s03-e03-identity-onboarding-and-role-safe-shell-sprint-plan.md
  - dev-docs/specs/s02/database-schema-v1.6-s02-reconciled.md
  - supabase/migrations/20260818143500_s02_e02_authoritative_data_platform.sql
  - src/lib/auth/routes.ts
  - src/lib/auth/session.ts
---

# S03-E03-02 — Role-Safe Protected Shell and Navigation

## 1. Execution objective

Implement the production-shaped authenticated application shell that routes each user to the
correct starting workspace based on `profiles.role`, enforces server-side access control, and
provides a responsive, accessible, localized global navigation with sign-out, a bounded
notification-availability indicator, and safe empty/loading/error states for each role.

This item builds directly on the session utility (`requireSession`), the role-route constants
(`ROLE_DEFAULT_PATHS`, `PROTECTED_PATH_PREFIXES`), and the middleware session refresh established
in S03-E03-01. It makes no changes to those files beyond importing the constants they export.

This work item delivers:

1. A single protected route-group layout (`src/app/(protected)/layout.tsx`) that enforces
   authentication, resolves role, and redirects invalid sessions before rendering any shell.
2. Role landing pages for Admin, PM, Operator, and Client, each intentionally narrow but
   role-appropriate and localized.
3. A shared global navigation component with a current-user display, sign-out control, a bounded
   in-app notification badge (unread count only), and role-appropriate nav links.
4. Typed server-side shell data reads using the S02 generated types and the permitted views and
   tables. No broad base-table reads for navigation or badge population.
5. Loading, empty-state, and error boundary handling across all protected routes.
6. Locale catalog additions for all new user-visible copy with es-MX / en-US parity.
7. Focused tests for route guards, role routing, accessibility, responsive layout, locale parity,
   and notification-count reads.

This work item does not create project management features, task forms, Kanban boards, or any
content workspace. Those belong to Sprint 04.

## 2. Authority and conflict rule

Precedence, in order:

1. Direct Project Owner instruction.
2. The S03 sprint plan (`dev-docs/specs/s03/feature/s03-e03-identity-onboarding-and-role-safe-shell-sprint-plan.md`).
3. This specification and the repository artifacts it identifies.
4. Accepted ADRs → Database Schema v1.6 (reconciled) → OpenAPI contract v1.5.
5. Current repository rules (`GEMINI.md`, `AGENTS.md`).

A discrepancy between an authoritative source and this specification on authorization, role
routing, RLS, or data-access boundary is a stop condition; report it and do not silently resolve
it.

## 3. Scope

### 3.1 In scope

- A protected route-group at `src/app/(protected)/` with a shared layout that enforces
  `requireSession` and redirects on `UNAUTHENTICATED` or `INACTIVE_OR_MISSING_PROFILE`.
- Four role-scoped route segments under `(protected)`: `/admin`, `/pm`, `/operador`, `/cliente`.
  Each has its own landing page and a route-local `_components/` directory.
- A shared global navigation component at
  `src/components/shared/app-nav/app-nav.tsx` (server component) with:
  - The Joya Star Films brand mark / wordmark.
  - Role-appropriate navigation links (not the same set across all roles).
  - A current-user affordance showing `profiles.full_name` and role.
  - A sign-out trigger (client component boundary; calls `supabase.auth.signOut`).
  - A bounded in-app notification badge sourced from `notification_unread_counts_view` (unread
    count only; no notification content, no external delivery).
- Loading UI (`loading.tsx`) and error boundary (`error.tsx`) at the protected layout level and
  at each role segment level.
- An empty-state component for role landing pages that claim no data has been loaded yet.
- A typed, server-side shell data query module at
  `src/lib/shell-data/shell-queries.ts` (server-only) providing:
  - `getUnreadNotificationCount(supabase, userId)` — `number` from
    `notification_unread_counts_view`.
  - `getAdminShellData(supabase)` — typed result needed by the Admin landing page.
  - `getPmShellData(supabase, userId)` — typed result needed by the PM landing page.
  - `getOperatorShellData(supabase)` — typed result needed by the Operator landing page.
  - `getClientShellData(supabase)` — typed result needed by the Client landing page.
- Locale catalog additions to `messages/es-MX.json` and `messages/en-US.json` covering all new
  user-visible copy under a `shell` namespace (extending the existing `shell.brand` key).
- Tests under `__tests__/app-shell/` for the behaviors described in §7.
- Updates to the existing `__tests__/i18n/key-naming.test.ts` to cover all new `shell.*` keys.

### 3.2 Explicitly out of scope

- Project creation, membership management, task forms, Kanban boards, or any project workspace
  UI. Those are Sprint 04.
- Operator agenda execution, client submission workspace, deliverable review UI, admin operational
  screens. Those are later sprints.
- Notification list or notification detail pages. The badge shows unread count only.
- External delivery of notifications (WhatsApp, email). The badge only reflects in-app records.
- Mark-as-read, mark-all-read, or any notification mutation from this item.
- Schema migration, database type generation, or any Supabase MCP operation.
- Playwright E2E automation.
- Development persona access path and manual demonstration journeys. Those are S03-E03-03.

## 4. Non-negotiable implementation boundaries

- `profiles.role` is the sole authorization authority. The protected layout resolves role from
  `requireSession` and propagates it through layout props or server context. No URL segment,
  cookie value, query parameter, form field, or client-supplied claim may substitute for it.
- Route guards execute server-side in the protected layout (RSC). Client-side navigation may
  improve UX but cannot be the access boundary. A direct deep-link to `/pm` by an `admin` user
  must be rejected or redirected server-side.
- Typed reads use `@supabase/ssr` server client. All shell data queries are server-only
  (`import 'server-only'` in `src/lib/shell-data/shell-queries.ts`). No privileged key enters a
  client bundle, test fixture, log, or response.
- `notification_unread_counts_view` is RLS-restricted; queries for the wrong user return zero or
  empty. The badge must show 0 (not an error) when the view returns nothing.
- Role landing pages must not read data from tables or views that RLS would deny to that role. Use
  only the permitted views documented in §5.3. If a view returns an empty set for a role, display
  an appropriate empty state — do not treat it as an error.
- The global navigation is a React Server Component. The sign-out button is the only element that
  requires a client component boundary (`'use client'`). Extract it into
  `src/components/shared/app-nav/_components/sign-out-button.tsx`.
- Sign-out calls `supabase.auth.signOut()` from the browser client and then navigates to
  `/iniciar-sesion`. It must not redirect to a protected path.
- The public shell (home page, privacy page, error page, sitemap, robots) established in Sprint 01
  must remain unchanged. The new protected route group must not affect the public locale behavior
  or next-intl routing for public paths.
- All protected pages must be keyboard-operable and include appropriate ARIA landmarks, roles,
  and labels. Navigation must not rely on color alone to communicate state.
- The protected shell must be responsive at mobile widths (minimum 375 px viewport). Navigation
  must provide a mobile-appropriate affordance (collapsible menu or drawer).
- The notification badge must not claim that a message was delivered externally. The badge simply
  reflects the total in-app `unread_count` from `notification_unread_counts_view` without
  surfacing delivery channel or status.

## 5. Data model baseline

The following S02 schema objects are the foundation for this item. Do not modify them.

### 5.1 `public.profiles` (from S03-E03-01)

Used by `requireSession` to resolve `full_name` and `role`. The `AppNav` server component
receives `profile` from the layout via props; it does not re-query the database independently.

### 5.2 `public.notification_unread_counts_view`

| Column | Type | Notes |
|---|---|---|
| `user_id` | `uuid` | Matches `auth.uid()` via RLS |
| `unread_count` | `bigint` | Count of in-app `notification_recipients` not yet read or cancelled |

RLS restricts this view to the authenticated user's own row. Query pattern:

```typescript
const { data } = await supabase
  .from('notification_unread_counts_view')
  .select('unread_count')
  .eq('user_id', userId)
  .maybeSingle();
const count = Number(data?.unread_count ?? 0);
```

The badge displays the count capped at 99 (display "99+" for higher values).

### 5.3 Role-permitted views for landing pages

Each role landing page may read only from the views and tables that RLS permits for that role.
The initial landing pages are intentionally narrow and must not request data beyond what is needed
to populate a welcoming but honest initial context.

| Role | Permitted read for landing page | Column subset |
|---|---|---|
| `admin` | `projects` (no RLS restriction for admin) | `id`, `name`, `status`, `deadline_at` — limit 5, ordered by `created_at DESC` |
| `pm` | `project_members` (own user_id) joined to `projects` | `project_id`, `member_type`, `is_primary`; `name`, `status`, `deadline_at` — limit 5 |
| `operator` | `operator_agenda_view` (own assignee, RLS-filtered) | `task_id`, `task_title`, `task_status`, `task_priority`, `project_name`, `task_deadline_at` — limit 5, ordered by `task_deadline_at ASC NULLS LAST` |
| `client` | `client_project_view` (own client membership, RLS-filtered) | `id`, `name`, `status`, `deadline_at`, `client_name` — limit 5, ordered by `deadline_at ASC NULLS LAST` |

If a permitted view returns zero rows for a role, display an empty state — not an error. The
sprint plan explicitly allows initial landing pages to be "intentionally narrow."

### 5.4 Existing route constants (from S03-E03-01)

These constants are defined in `src/lib/auth/routes.ts` and must be imported without modification:

```typescript
import {
  ROLE_DEFAULT_PATHS,
  PROTECTED_PATH_PREFIXES,
  type AppRole,
} from '@/lib/auth/routes';
```

`ROLE_DEFAULT_PATHS` maps each `AppRole` to its protected path prefix:

```typescript
{ admin: '/admin', pm: '/pm', operator: '/operador', client: '/cliente' }
```

The protected layout uses `ROLE_DEFAULT_PATHS[session.role]` to enforce that the authenticated
user's role matches the requested path segment.

## 6. Required implementation

### 6.1 Protected route-group layout — `src/app/(protected)/layout.tsx`

This is a React Server Component with `import 'server-only'`. Read the Next.js App Router
documentation in `node_modules/next/dist/docs/` before writing this file; do not assume the
exact API from training data.

High-level behavior contract:

- Call `requireSession(cookieStore)` from `@/lib/auth/session`.
- On `AuthError` with code `UNAUTHENTICATED`: `redirect('/iniciar-sesion')`.
- On `AuthError` with code `INACTIVE_OR_MISSING_PROFILE`:
  `redirect('/sesion-expirada?reason=inactive')`.
- On any other thrown error: re-throw so the Next.js error boundary catches it.
- Extract the current pathname (from `headers()` — check installed Next.js docs for the exact
  API). Determine the role-canonical prefix from `ROLE_DEFAULT_PATHS[session.role]`.
- If the pathname does not start with the user's role path prefix, `redirect` to that prefix.
  This enforces cross-role route isolation server-side.
- Fetch `unreadCount` via `getUnreadNotificationCount(supabase, session.user.id)` from
  `@/lib/shell-data/shell-queries`.
- Render the shell layout wrapping `children`, passing `session` and `unreadCount` to `AppNav`.

#### 6.1.1 Path-segment matching

Do not construct a route-matching regex ad hoc. Use `ROLE_DEFAULT_PATHS[session.role]` directly:

```typescript
const rolePath = ROLE_DEFAULT_PATHS[session.role];
if (!pathname.startsWith(rolePath)) {
  redirect(rolePath);
}
```

If `session.role` is not a key in `ROLE_DEFAULT_PATHS` (should never happen with strict types but
guard defensively), `redirect('/iniciar-sesion')`.

### 6.2 Role landing pages

Each landing page is a React Server Component. Client components are used only within route-local
`_components/` directories for interactive elements.

#### 6.2.1 Admin landing — `src/app/(protected)/admin/page.tsx`

- Receives `session.profile.full_name` via layout props or `requireSession` called from page.
- Calls `getAdminShellData(supabase)` to fetch up to 5 recent projects.
- Renders a welcoming heading with the user's name.
- Renders a project list with name and localized status badge, or the admin empty-state copy if
  zero projects.
- Does not display any project-creation action (Sprint 04 scope).

#### 6.2.2 PM landing — `src/app/(protected)/pm/page.tsx`

- Calls `getPmShellData(supabase, session.user.id)` to fetch the PM's project memberships.
- Renders a welcoming heading with the user's name.
- Renders up to 5 projects with name, status badge, and deadline, or PM empty-state if zero.
- Does not display project creation, task management, or team membership UI.

#### 6.2.3 Operator landing — `src/app/(protected)/operador/page.tsx`

- Calls `getOperatorShellData(supabase)` to fetch the operator's active task agenda (up to 5
  rows from `operator_agenda_view`, ordered by `task_deadline_at ASC NULLS LAST`).
- Renders a welcoming heading with the user's name.
- Renders tasks with `task_title`, `task_status`, `task_priority`, `project_name`, and
  `task_deadline_at`. If zero rows, renders operator empty-state.
- Does not display any task-status-transition UI.

#### 6.2.4 Client landing — `src/app/(protected)/cliente/page.tsx`

- Calls `getClientShellData(supabase)` to fetch the client's projects from `client_project_view`
  (up to 5, ordered by `deadline_at ASC NULLS LAST`).
- Renders a welcoming heading with the user's name.
- Renders projects with `name`, `status`, and `deadline_at`. If zero, renders client empty-state.
- Does not display deliverable submission, feedback, or review UI.

### 6.3 Global navigation — `src/components/shared/app-nav/`

The navigation is rendered by the protected layout and receives `session: SessionContext` and
`unreadCount: number` as props. All state and interactivity is isolated to client components
within `_components/`.

#### 6.3.1 `app-nav.tsx` (server component)

Logical structure:

```
<nav aria-label={t('shell.nav.ariaLabel')}>
  <BrandMark />
  <RoleNavLinks role={session.role} />
  <NotificationBadge count={unreadCount} />
  <UserInfo profile={session.profile} />
  <SignOutButton />
  <MobileNavToggle />   {/* client component; controls mobile drawer */}
</nav>
```

Role-appropriate nav links are server-rendered `<Link>` elements. Only links appropriate for the
user's role are rendered; other role links are never present in the DOM.

| Role | Active links | Disabled stub links |
|---|---|---|
| `admin` | `/admin` (Inicio) | `/admin/proyectos` (stub, `aria-disabled`) |
| `pm` | `/pm` (Inicio) | `/pm/proyectos` (stub, `aria-disabled`) |
| `operator` | `/operador` (Inicio) | `/operador/agenda` (stub, `aria-disabled`) |
| `client` | `/cliente` (Inicio) | `/cliente/proyectos` (stub, `aria-disabled`) |

Disabled stub links must be rendered as `<a aria-disabled="true" tabindex="-1">` (not as
functional `<Link>` components). They signal future navigation without generating 404s.

The active page link must carry `aria-current="page"`.

#### 6.3.2 `_components/sign-out-button.tsx` (client component)

```typescript
'use client';
// 1. Calls createBrowserClient() from @/lib/supabase/browser
// 2. Calls supabase.auth.signOut()
// 3. On completion (success or error), navigates to '/iniciar-sesion'
//    using router.push or window.location.href
// 4. Displays a loading indicator while sign-out is in progress
// Must not redirect to a protected path.
// Must not expose any Supabase error to the user.
```

#### 6.3.3 `_components/mobile-nav-toggle.tsx` (client component)

Manages `isOpen` state. When open, renders a navigation drawer overlaying the page on mobile.

Requirements:
- Toggle button has `aria-expanded={isOpen}` and `aria-controls="mobile-nav-drawer"`.
- Drawer has `id="mobile-nav-drawer"`.
- When open, focus is trapped within the drawer.
- Pressing Escape closes the drawer and returns focus to the toggle button.
- Closing animations are acceptable but must not block keyboard interaction.

#### 6.3.4 `_components/notification-badge.tsx`

May be a server component if it only receives the `count: number` prop and renders markup.
Renders a badge with the unread count. If `count === 0`, the badge is hidden or renders `aria-live`
but visually suppressed. If `count > 99`, display "99+". The badge element must have an
`aria-label` that includes the numeric count value for screen readers.

### 6.4 Shell data query module — `src/lib/shell-data/shell-queries.ts`

```typescript
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

type TypedSupabase = SupabaseClient<Database>;

export async function getUnreadNotificationCount(
  supabase: TypedSupabase,
  userId: string,
): Promise<number>

export type AdminShellData = {
  projects: Pick<
    Database['public']['Tables']['projects']['Row'],
    'id' | 'name' | 'status' | 'deadline_at'
  >[];
};

export async function getAdminShellData(supabase: TypedSupabase): Promise<AdminShellData>

export type PmShellData = {
  projects: {
    id: string;
    name: string;
    status: Database['public']['Enums']['project_status'];
    deadline_at: string;
    member_type: Database['public']['Enums']['project_member_type'];
    is_primary: boolean;
  }[];
};

export async function getPmShellData(
  supabase: TypedSupabase,
  userId: string,
): Promise<PmShellData>

export type OperatorShellData = {
  agendaItems: Pick<
    Database['public']['Views']['operator_agenda_view']['Row'],
    'task_id' | 'task_title' | 'task_status' | 'task_priority' | 'project_name' | 'task_deadline_at'
  >[];
};

export async function getOperatorShellData(supabase: TypedSupabase): Promise<OperatorShellData>

export type ClientShellData = {
  projects: Pick<
    Database['public']['Views']['client_project_view']['Row'],
    'id' | 'name' | 'status' | 'deadline_at' | 'client_name'
  >[];
};

export async function getClientShellData(supabase: TypedSupabase): Promise<ClientShellData>
```

All functions must handle Supabase errors gracefully — log the error at debug level only and
return empty arrays or `0`, so landing pages display an empty state without crashing. Do not use
`any`. Do not expose error details to callers.

### 6.5 Loading and error boundaries

- `src/app/(protected)/loading.tsx` — full-shell skeleton for the protected layout (covers nav +
  content area). Rendered while the layout's async work is suspended.
- `src/app/(protected)/error.tsx` — client component. Displays a safe "something went wrong"
  message with a sign-in-again link. Must not display stack traces, Supabase messages, or user
  data.
- `src/app/(protected)/admin/loading.tsx` — page-content skeleton for the Admin landing.
- `src/app/(protected)/pm/loading.tsx` — page-content skeleton for the PM landing.
- `src/app/(protected)/operador/loading.tsx` — page-content skeleton for the Operator landing.
- `src/app/(protected)/cliente/loading.tsx` — page-content skeleton for the Client landing.

### 6.6 Locale catalog additions

Add keys to **both** `messages/es-MX.json` and `messages/en-US.json` with exact semantic parity.
All new keys extend the existing `shell` namespace. Do not remove or rename the existing
`shell.brand` key.

Required key list:

```
shell.nav.ariaLabel
shell.nav.signOut
shell.nav.currentUser.role.admin
shell.nav.currentUser.role.pm
shell.nav.currentUser.role.operator
shell.nav.currentUser.role.client
shell.nav.links.home
shell.nav.links.projects
shell.nav.links.agenda
shell.nav.notifications.badgeLabel
shell.nav.notifications.badgeOverflow

shell.landing.admin.welcome
shell.landing.admin.recentProjects
shell.landing.admin.emptyProjects

shell.landing.pm.welcome
shell.landing.pm.myProjects
shell.landing.pm.emptyProjects

shell.landing.operator.welcome
shell.landing.operator.myAgenda
shell.landing.operator.emptyAgenda

shell.landing.client.welcome
shell.landing.client.myProjects
shell.landing.client.emptyProjects

shell.status.planning
shell.status.inProgress
shell.status.paused
shell.status.completed
shell.status.cancelled

shell.priority.low
shell.priority.medium
shell.priority.high
shell.priority.blocking

shell.loading
shell.error.title
shell.error.message
shell.error.signInAgain
```

Do not add keys not listed above. Additional copy needs are a decision to surface to the Project
Owner.

## 7. Required tests

All tests are under `__tests__/app-shell/`. Use Vitest with `jsdom` environment. Mock Supabase
client calls with `msw` or `vi.mock`; never use real Supabase credentials in tests.

### 7.1 Route guard tests — `__tests__/app-shell/route-guard.test.ts`

| Behavior | Expected outcome |
|---|---|
| Unauthenticated request to `/admin` | Redirects to `/iniciar-sesion` |
| Unauthenticated request to `/pm` | Redirects to `/iniciar-sesion` |
| Unauthenticated request to `/operador` | Redirects to `/iniciar-sesion` |
| Unauthenticated request to `/cliente` | Redirects to `/iniciar-sesion` |
| `is_active = false` profile accessing `/pm` | Redirects to `/sesion-expirada?reason=inactive` |
| `admin` user requesting `/pm` | Redirects to `/admin` |
| `pm` user requesting `/admin` | Redirects to `/pm` |
| `operator` user requesting `/cliente` | Redirects to `/operador` |
| `client` user requesting `/operador` | Redirects to `/cliente` |
| `admin` user requesting `/admin` | No redirect; layout renders |
| `pm` user requesting `/pm` | No redirect; layout renders |
| `operator` user requesting `/operador` | No redirect; layout renders |
| `client` user requesting `/cliente` | No redirect; layout renders |
| Unexpected error from `requireSession` | Error is re-thrown; boundary catches |

### 7.2 Role landing tests — `__tests__/app-shell/role-landing.test.ts`

| Behavior | Expected outcome |
|---|---|
| Admin page with project data | Project names and localized status badges visible |
| Admin page with no projects | Empty-state message visible; no error thrown |
| PM page with project membership data | Project list visible |
| PM page with no memberships | PM empty-state visible |
| Operator page with agenda items | Task list with title, status, priority, project visible |
| Operator page with no agenda items | Operator empty-state visible |
| Client page with project data | Project list visible |
| Client page with no projects | Client empty-state visible |
| Shell data query returns Supabase error | Landing page shows empty-state; no crash |

### 7.3 Navigation tests — `__tests__/app-shell/navigation.test.ts`

| Behavior | Expected outcome |
|---|---|
| `AppNav` renders with `admin` role | Admin nav links present; `/pm`, `/operador`, `/cliente` links absent |
| `AppNav` renders with `pm` role | PM nav links present; `/admin` link absent |
| `AppNav` renders with `operator` role | Operator nav links present; other role links absent |
| `AppNav` renders with `client` role | Client nav links present; other role links absent |
| `AppNav` renders `profile.full_name` | User name visible in nav |
| `NotificationBadge` with count = 0 | Badge hidden or shows 0; not an error state |
| `NotificationBadge` with count = 5 | Badge renders "5" |
| `NotificationBadge` with count = 100 | Badge renders "99+" |
| `SignOutButton` clicked | `supabase.auth.signOut()` called; redirect to sign-in initiated |
| `SignOutButton` loading state during sign-out | Loading indicator visible |
| Active nav link has `aria-current="page"` | Attribute present on the current route link |
| Nav landmark has `aria-label` | `<nav aria-label>` present |
| Notification badge has `aria-label` with count | Screen-reader accessible label present |
| Mobile nav toggle opens drawer | `aria-expanded="true"`; drawer visible |
| Mobile nav toggle closes drawer | `aria-expanded="false"`; drawer hidden |
| Escape key closes open drawer | Drawer closed; focus returns to toggle |
| Sign-out does not redirect to protected path | Redirect target is `/iniciar-sesion` |

### 7.4 Shell query tests — `__tests__/app-shell/shell-queries.test.ts`

| Behavior | Expected outcome |
|---|---|
| `getUnreadNotificationCount` view returns `{ unread_count: 3 }` | Returns `3` |
| `getUnreadNotificationCount` view returns null | Returns `0` |
| `getUnreadNotificationCount` Supabase error | Returns `0` gracefully |
| `getAdminShellData` returns typed project rows | Correct shape; columns match `AdminShellData` |
| `getPmShellData` returns empty array | Empty array; no throw |
| `getPmShellData` returns membership rows | Correct `PmShellData` shape |
| `getOperatorShellData` returns agenda rows | Correct `OperatorShellData` shape |
| `getClientShellData` returns project view rows | Correct `ClientShellData` shape |
| `getClientShellData` Supabase error | Returns empty projects array; no throw |

### 7.5 Localization tests (extend `__tests__/i18n/key-naming.test.ts`)

| Behavior | Expected outcome |
|---|---|
| All `shell.*` keys present in `es-MX.json` | Parity check passes |
| All `shell.*` keys present in `en-US.json` | Same key set as `es-MX.json` |
| Admin landing renders in `es-MX` | Heading and labels use es-MX copy |
| Admin landing renders in `en-US` | Heading and labels use en-US copy |

### 7.6 Accessibility assertions

At minimum, verify through test assertions (not visual inspection only):

- Protected layout produces a single `<main>` landmark.
- `<nav>` element has `aria-label` attribute.
- Sign-out button has a visible accessible label (not icon-only without `aria-label`).
- Notification badge has `aria-label` that includes the count.
- Mobile nav toggle has `aria-expanded` and `aria-controls`.
- Disabled stub nav links have `aria-disabled="true"`.

## 8. File inventory

### 8.1 New files

| Path | Purpose |
|---|---|
| `src/app/(protected)/layout.tsx` | Protected route-group layout with session guard and role check |
| `src/app/(protected)/loading.tsx` | Shell-level loading skeleton |
| `src/app/(protected)/error.tsx` | Shell-level error boundary (client component) |
| `src/app/(protected)/admin/page.tsx` | Admin landing page (RSC) |
| `src/app/(protected)/admin/loading.tsx` | Admin page loading skeleton |
| `src/app/(protected)/admin/_components/admin-shell.tsx` | Admin shell content component (RSC) |
| `src/app/(protected)/pm/page.tsx` | PM landing page (RSC) |
| `src/app/(protected)/pm/loading.tsx` | PM page loading skeleton |
| `src/app/(protected)/pm/_components/pm-shell.tsx` | PM shell content component (RSC) |
| `src/app/(protected)/operador/page.tsx` | Operator landing page (RSC) |
| `src/app/(protected)/operador/loading.tsx` | Operator page loading skeleton |
| `src/app/(protected)/operador/_components/operator-shell.tsx` | Operator shell content (RSC) |
| `src/app/(protected)/cliente/page.tsx` | Client landing page (RSC) |
| `src/app/(protected)/cliente/loading.tsx` | Client page loading skeleton |
| `src/app/(protected)/cliente/_components/client-shell.tsx` | Client shell content (RSC) |
| `src/components/shared/app-nav/app-nav.tsx` | Global navigation server component |
| `src/components/shared/app-nav/_components/sign-out-button.tsx` | Sign-out client component |
| `src/components/shared/app-nav/_components/mobile-nav-toggle.tsx` | Mobile nav toggle (client) |
| `src/components/shared/app-nav/_components/notification-badge.tsx` | Notification count badge |
| `src/lib/shell-data/shell-queries.ts` | Typed server-only shell data query functions |
| `__tests__/app-shell/route-guard.test.ts` | Protected layout route-guard tests |
| `__tests__/app-shell/role-landing.test.ts` | Role landing page render tests |
| `__tests__/app-shell/navigation.test.ts` | Navigation render and accessibility tests |
| `__tests__/app-shell/shell-queries.test.ts` | Shell data query unit tests |

### 8.2 Modified files

| Path | Change |
|---|---|
| `messages/es-MX.json` | Add `shell.*` keys listed in §6.6 |
| `messages/en-US.json` | Add `shell.*` keys with semantic parity |
| `__tests__/i18n/key-naming.test.ts` | Extend parity check to cover new `shell.*` keys |

### 8.3 Preserved unchanged

| Path | Reason |
|---|---|
| `src/lib/auth/routes.ts` | Imported as-is; defines `ROLE_DEFAULT_PATHS` |
| `src/lib/auth/session.ts` | Imported as-is; provides `requireSession` |
| `src/lib/auth/middleware-session.ts` | Unchanged; cookie refresh only |
| `src/proxy.ts` | Unchanged; no role authorization added here |
| `src/lib/database.types.ts` | MCP-generated; never modified |
| `supabase/migrations/` | No schema change in this item |
| All `src/app/[locale]/` public pages | Public shell unchanged |

## 9. Verification plan

### 9.1 Automated checks (run before declaring this item complete)

```
npm run format:check
npm run lint
npm run typecheck
npm run build
npm run test
npm run test:coverage
npm run audit:prod
```

All must pass with zero errors. Coverage must include the protected layout guard, all four role
landing pages, `AppNav`, `SignOutButton`, and `shell-queries.ts`.

### 9.2 Minimum manual localhost verification

The following manual checks confirm correct behavior on a running development server
(`npm run dev`). Full multi-persona demonstration journeys with seeded data are S03-E03-03.

1. Sign in as a valid `admin` user → lands on `/admin` → admin landing renders with name and
   project list or empty state.
2. Sign in as a valid `pm` user → lands on `/pm` → PM landing renders.
3. Sign in as a valid `operator` user → lands on `/operador` → Operator landing renders.
4. Sign in as a valid `client` user → lands on `/cliente` → Client landing renders.
5. While signed in as `pm`, navigate to `/admin` directly → redirected to `/pm`.
6. While signed in as `admin`, navigate to `/operador` directly → redirected to `/admin`.
7. Sign out via nav button → redirected to `/iniciar-sesion`; accessing `/admin` while signed out
   → redirected to `/iniciar-sesion`.
8. At 375 px viewport, open the mobile nav → drawer opens; nav links are tappable; Escape closes.
9. Navigate using keyboard only (Tab, Enter) → nav and page are fully operable without mouse.
10. Navigate to `/en/sign-in` → public page unaffected; no protected-shell chrome present.

## 10. Stop conditions

| Discovery | Required response |
|---|---|
| `requireSession` throws a shape that does not match `AuthError` codes | Stop; investigate before implementing the guard redirect |
| A role landing page requires reading from a table not permitted by its RLS policy | Stop; use only the views in §5.3 or request a Project Owner decision |
| The installed Next.js App Router documents a different path-detection API than assumed in §6.1.1 | Read the installed docs in `node_modules/next/dist/docs/`; do not assume training-data patterns |
| Implementing mobile navigation requires more than 400 lines in a single component | Split by responsibility; document in completion evidence |
| A test reveals that an unauthenticated deep-link to a role path is not caught server-side | Block integration; fix the layout guard before proceeding |
| A test reveals cross-role isolation failure (wrong role reaches a role path without redirect) | Block integration; remediate and re-verify |
| The notification badge query returns data belonging to a different user | Stop; RLS may not be enforced; do not suppress |
| Implementing any step requires a schema change, Supabase MCP operation, or `database.types.ts` edit | Stop; this item makes no database changes |
