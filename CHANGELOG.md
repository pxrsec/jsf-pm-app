# JSF PM App Development Changelog

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
