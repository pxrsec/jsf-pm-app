---
spec_id: S03-E03-03
feature_slug: localhost-demonstration-and-sprint-verification
sprint: S03
epic: E03
work_item: S03-E03-03
status: ready-for-implementation
version: 1.0
created: 2026-08-18
updated: 2026-08-18
branch: feature/s03-e03-identity-onboarding-and-role-safe-shell
risk: medium
sources:
  - dev-docs/specs/s03/feature/s03-e03-identity-onboarding-and-role-safe-shell-sprint-plan.md
  - dev-docs/specs/s03/s03-e03-01-invite-only-account-entry-and-session-lifecycle-v1.0.md
  - dev-docs/specs/s03/s03-e03-02-role-safe-protected-shell-and-navigation-v1.0.md
  - scripts/bootstrap-dev-demo-data.ts
  - contracts/openapi/jsf-pm-api.openapi.yaml
---

# S03-E03-03 — Localhost Demonstration Access and Sprint Verification

## 1. Execution objective

This is the final work item of Sprint 03. It closes the sprint by:

1. Documenting and implementing the **development-only persona entry path** that lets the Project
   Owner demonstrate each seeded role persona (Admin, PM Lead, PM Watcher, Operator, Client)
   through the running application without weakening the production authorization boundary.
2. Adding a **focused negative and positive automated test suite** covering the security, isolation,
   and behavioral gaps not individually addressed by S03-E03-01 and S03-E03-02.
3. **Running the complete repository verification pipeline** and recording factual evidence.
4. **Documenting localhost manual journey procedures** for all five demonstration capacities,
   including cross-role denial attempts and public-shell preservation checks.
5. Producing a **sprint closeout verification note** under `dev-docs/specs/s03/` summarizing the
   completed sprint boundary, changed files, test outcomes, and known limitations.

This item makes no changes to the database, schema, migrations, `database.types.ts`, or hosted
Supabase state. It does not activate providers, send external messages, or deploy to any
environment.

## 2. Authority and conflict rule

Precedence, in order:

1. Direct Project Owner instruction.
2. The S03 sprint plan
   (`dev-docs/specs/s03/feature/s03-e03-identity-onboarding-and-role-safe-shell-sprint-plan.md`).
3. This specification and the repository artifacts it identifies.
4. Accepted ADRs → Database Schema v1.6 (reconciled) → OpenAPI contract v1.5.
5. Current repository rules (`GEMINI.md`, `AGENTS.md`).

A discrepancy between an authoritative source and this specification on authorization, token, role,
or data-access behavior is a stop condition; report it and do not silently resolve it.

## 3. Prerequisites — sprint baseline verification

Before implementing any new work, confirm that the following are true on the current branch tip.
If any item fails, stop and report before proceeding.

### 3.1 File presence checks

The following files must exist. Read the installed Next.js docs (`node_modules/next/dist/docs/`)
if uncertain about any App Router behavior observed.

| File | Requirement |
|---|---|
| `src/lib/auth/session.ts` | Exports `requireSession`, `getOptionalSession`, `AuthError`, `SessionContext`, `AppRole` |
| `src/lib/auth/routes.ts` | Exports `ROLE_DEFAULT_PATHS`, `PROTECTED_PATH_PREFIXES`, `ALLOWLISTED_REDIRECT_PREFIXES`, `isAllowlistedRedirectPath` |
| `src/lib/auth/middleware-session.ts` | Exports `updateSession` |
| `src/proxy.ts` | Uses `updateSession` for session-cookie refresh on protected paths |
| `src/app/(protected)/layout.tsx` | Server-only; calls `requireSession`; enforces cross-role redirect |
| `src/app/(protected)/loading.tsx` | Shell-level loading skeleton |
| `src/app/(protected)/error.tsx` | Client component error boundary |
| `src/app/(protected)/admin/page.tsx` | Admin RSC landing page |
| `src/app/(protected)/admin/loading.tsx` | Admin loading skeleton |
| `src/app/(protected)/admin/_components/admin-shell.tsx` | Admin shell content |
| `src/app/(protected)/pm/page.tsx` | PM RSC landing page |
| `src/app/(protected)/pm/loading.tsx` | PM loading skeleton |
| `src/app/(protected)/pm/_components/pm-shell.tsx` | PM shell content |
| `src/app/(protected)/operador/page.tsx` | Operator RSC landing page |
| `src/app/(protected)/operador/loading.tsx` | Operator loading skeleton |
| `src/app/(protected)/operador/_components/operator-shell.tsx` | Operator shell content |
| `src/app/(protected)/cliente/page.tsx` | Client RSC landing page |
| `src/app/(protected)/cliente/loading.tsx` | Client loading skeleton |
| `src/app/(protected)/cliente/_components/client-shell.tsx` | Client shell content |
| `src/components/shared/app-nav/app-nav.tsx` | Global navigation server component |
| `src/components/shared/app-nav/_components/sign-out-button.tsx` | Sign-out client component |
| `src/components/shared/app-nav/_components/mobile-nav-toggle.tsx` | Mobile nav toggle client component |
| `src/components/shared/app-nav/_components/notification-badge.tsx` | Notification badge component |
| `src/lib/shell-data/shell-queries.ts` | Server-only; exports all five typed query functions |
| `src/app/[locale]/iniciar-sesion/` | Sign-in page under locale routing |
| `src/app/[locale]/restablecer-contrasena/` | Password reset request page |
| `src/app/[locale]/actualizar-contrasena/` | Password update after recovery page |
| `src/app/[locale]/sesion-expirada/` | Expired session / invalid link page |
| `src/app/[locale]/invitacion/` | Invitation redemption page |
| `src/app/api/v1/auth/invites/complete/route.ts` | POST handler for invite completion |
| `src/app/api/v1/auth/magic-link/route.ts` | POST handler for magic link request |
| `src/app/api/v1/auth/callback/route.ts` | GET handler for Supabase Auth callback |
| `src/lib/validation/auth.ts` | Zod schemas: `CompleteInviteSchema`, `MagicLinkSchema`, `SignInSchema`, `PasswordUpdateSchema`, `passwordSchema` |
| `scripts/bootstrap-dev-demo-data.ts` | Idempotent dev demo data reconciler (authorized 400-line exception) |
| `messages/es-MX.json` | Contains all `shell.*` keys defined in S03-E03-02 §6.6 |
| `messages/en-US.json` | Same key set as `es-MX.json` with semantic parity |
| `__tests__/auth/session.test.ts` | Session lifecycle tests |
| `__tests__/auth/validation.test.ts` | Password policy and schema tests |
| `__tests__/auth/complete-invite.test.ts` | Invitation completion handler tests |
| `__tests__/auth/magic-link.test.ts` | Magic link handler tests |
| `__tests__/auth/callback.test.ts` | Auth callback handler tests |
| `__tests__/auth/pages.test.ts` | Auth page render tests |
| `__tests__/app-shell/route-guard.test.ts` | Protected layout route-guard tests |
| `__tests__/app-shell/role-landing.test.ts` | Role landing page render tests |
| `__tests__/app-shell/navigation.test.ts` | Navigation render and accessibility tests |
| `__tests__/app-shell/shell-queries.test.ts` | Shell data query unit tests |
| `__tests__/i18n/key-naming.test.ts` | Locale key naming and parity |

If any file is absent, stop and report before proceeding to §4.

### 3.2 Automated baseline check

Run the following before adding any new work:

```
npm run format:check
npm run lint
npm run typecheck
npm run build
npm run test
npm run test:coverage
npm run audit:prod
```

All must pass with 0 errors. If any check fails, identify whether the failure pre-exists from
S03-E03-01 or S03-E03-02 and remediate it before adding new code. Report the remediation.

## 4. Scope

### 4.1 In scope

- A **development-only persona access document** at
  `dev-docs/specs/s03/s03-e03-03-dev-persona-access.md` describing the entry procedure for each
  demonstration persona using the standard sign-in page and seeded demo credentials. This document
  must not contain real credentials, must state its local-development-only applicability, and must
  reference the `DEV_DEMO_PASSWORD` environment variable without revealing its value.
- A **focused negative-path test file** at `__tests__/auth/negative-path.test.ts` covering the
  behaviors listed in §6.1.
- A **focused positive-path test file** at `__tests__/integration/role-journey.test.ts` covering
  the behaviors listed in §6.2.
- A **sprint closeout verification note** at
  `dev-docs/specs/s03/s03-sprint-03-closeout-verification.md` documenting: changed files, test
  outcomes, manual journey records, localization and accessibility impact, known limitations, and
  the hand-off statement to Sprint 04.
- Updates to `CHANGELOG.md` using the `/update-changelog` skill after all other changes are
  complete.

### 4.2 Explicitly out of scope

- Any database schema change, migration file, `database.types.ts` modification, or Supabase MCP
  operation.
- Any change to `scripts/bootstrap-dev-demo-data.ts` unless a specific integration adjustment is
  identified in §3.2 that cannot be resolved otherwise. If a change is necessary, document it in
  completion evidence with precise rationale.
- Changes to `src/lib/auth/`, `src/lib/supabase/`, or any S03-E03-01 or S03-E03-02 implementation
  file, except to fix a pre-existing failure surfaced by the §3.2 baseline check.
- Provider activation, outbound email delivery, production or preproduction environment changes.
- Playwright E2E automation.
- Sprint 04 features: project creation, task management, Kanban, or any project workspace UI.
- Adding Supabase credentials, real passwords, or real user email addresses to any tracked file.

## 5. Non-negotiable implementation boundaries

- The development-only entry path is the **standard sign-in UI** (`/iniciar-sesion`) with demo
  credentials set through `DEV_DEMO_PASSWORD`. No backdoor route, hidden query parameter,
  `NODE_ENV` guard in application code, or browser-supplied bypass is acceptable.
- Demo persona accounts exist in `jsf-pm-dev` only because `npm run db:bootstrap` was run. The
  persona access document must make clear that these accounts do not exist in production and that
  the bootstrap tool requires the operator's own `.env.local` with `DEV_DEMO_PASSWORD`.
- The reference corpus (`Acme Brand Relaunch`, `Internal Workflow Automation`, `Acme Commercial Q1`,
  `Acme Teaser 2025`, `Starlight Summer Campaign`) is read-only by convention during demonstration.
  Only the Acme Sandbox Campaign is designated for interactive mutation during demonstration.
- No test file may contain real Supabase credentials, real user email addresses, real invitation
  tokens, or real passwords. All mock values must use `.jsf.internal` or `.example.com` domains
  and placeholder credential shapes.
- New tests must use the same Vitest with `jsdom` environment and mock patterns established in
  `__tests__/auth/` and `__tests__/app-shell/`. Do not introduce a separate test runner or
  framework.
- New test files must not weaken, delete, skip, or rewrite existing test contracts from
  S03-E03-01 or S03-E03-02.
- The sprint closeout verification note is repository documentation — not a code change. It must
  state exactly which checks were static analysis, automated application behavior, or manual
  localhost journeys, and must not claim provider, production, or exhaustive live-security proof.

## 6. Required tests

### 6.1 Negative-path test file — `__tests__/auth/negative-path.test.ts`

This file covers behaviors that span both S03-E03-01 and S03-E03-02 and were not individually
addressed in their respective test suites. Use `vi.mock` for all Supabase and Next.js dependencies.
Never use real credentials.

All behaviors in this table must be covered by at least one test:

| # | Behavior under test | Expected outcome |
|---|---|---|
| N-01 | POST `/api/v1/auth/invites/complete` with an already-used or expired token hash (Supabase returns an error from `accept_invite`) | 400 or 422 response; no session established; no token in response body |
| N-02 | POST `/api/v1/auth/invites/complete` with a token whose recipient email does not match the submitted email (enforced by `accept_invite` RPC) | 400 response; no session established; safe error message without internal detail |
| N-03 | POST `/api/v1/auth/invites/complete` with a replay of a valid token (second call after first succeeded) | 400 or 422 response; idempotent safe outcome |
| N-04 | POST `/api/v1/auth/invites/complete` with a malformed token format (fails Zod validation) | 400 response with Zod validation error shape; no database call made |
| N-05 | POST `/api/v1/auth/magic-link` with an email address that has no matching auth user (account-enumeration-safe response) | 200 response with confirmation message indistinguishable from a successful dispatch; no user data leaked |
| N-06 | POST `/api/v1/auth/magic-link` with an invalid email format | 400 response with validation error; no Supabase call made |
| N-07 | Password schema (`passwordSchema`) tested with a password under 12 characters | `safeParse` returns `success: false` with minimum-length message |
| N-08 | Password schema tested with a password lacking an uppercase letter | `safeParse` returns `success: false` with uppercase message |
| N-09 | Password schema tested with a password lacking a symbol character | `safeParse` returns `success: false` with symbol message |
| N-10 | Direct deep-link to `/admin` by unauthenticated user (requireSession throws UNAUTHENTICATED) | Protected layout redirects to `/iniciar-sesion` |
| N-11 | Direct deep-link to `/pm` by authenticated `client` role user | Protected layout redirects to `/cliente` |
| N-12 | Direct deep-link to `/operador` by authenticated `pm` role user | Protected layout redirects to `/pm` |
| N-13 | Direct deep-link to `/cliente` by authenticated `admin` role user | Protected layout redirects to `/admin` |
| N-14 | Direct deep-link to `/admin` by authenticated `operator` role user | Protected layout redirects to `/operador` |
| N-15 | Accessing a protected route with `is_active = false` profile (requireSession throws INACTIVE_OR_MISSING_PROFILE) | Protected layout redirects to `/sesion-expirada?reason=inactive` |
| N-16 | Accessing a protected route with `deleted_at` set on profile (requireSession throws INACTIVE_OR_MISSING_PROFILE) | Protected layout redirects to `/sesion-expirada?reason=inactive` |
| N-17 | Raw invitation token value does not appear in any test mock fixture, log call, or response body assertion in the `complete-invite.test.ts` suite | Static assertion: grep `__tests__/auth/complete-invite.test.ts` for unpadded base64 tokens > 40 chars that are not identified as mocked hash values; none found |
| N-18 | `SUPABASE_SECRET_KEY` or equivalent privileged key pattern does not appear in any file under `src/` outside `src/config/server.config.ts` and `src/lib/supabase/admin.ts` | Assertion: `credential-exposure.test.ts` or equivalent static check passes |
| N-19 | No `NEXT_PUBLIC_`-prefixed variable contains a value matching a server-secret pattern | Static check passes |
| N-20 | A public route (`/`) rendered while a protected-shell mock session exists | Public page output does not include the `<nav aria-label>` shell nav element |

#### 6.1.1 Implementation guidance

- **N-01 through N-03**: Import `POST` from `@/app/api/v1/auth/invites/complete/route` and
  construct `NextRequest` instances. Mock the admin Supabase client (`@/lib/supabase/admin`) to
  return an RPC error simulating expired, wrong-recipient, and replay conditions. Follow the
  exact pattern in `__tests__/auth/complete-invite.test.ts` — same mock shape, same header setup.
- **N-04**: Mock the request body with a token that fails `CompleteInviteSchema` (e.g., a token
  too short or containing disallowed characters). Assert 400 response and that `adminSupabase.rpc`
  was not called.
- **N-05**: Import `POST` from `@/app/api/v1/auth/magic-link/route`. Mock the server Supabase
  client to return `{ data: null, error: { message: 'user not found' } }` from
  `auth.signInWithOtp`. Assert the response status is 200 and the body does not reveal whether
  the user exists.
- **N-06**: Submit an invalid email in the magic-link request body. Assert 400 before any Supabase
  call.
- **N-07 through N-09**: Import `passwordSchema` from `@/lib/validation/auth` and call
  `safeParse`. These are already partially covered in `__tests__/auth/validation.test.ts`. Check
  first — if already covered, do not duplicate; cite in a comment.
- **N-10 through N-16**: Import `ProtectedLayout` from `@/app/(protected)/layout`. Use the
  same mock pattern as `__tests__/app-shell/route-guard.test.ts`. These may already be covered —
  check first and cite rather than duplicate.
- **N-17**: Write a test that reads the content of `__tests__/auth/complete-invite.test.ts` as a
  string and asserts that no base64-like string of 44+ characters (typical raw token length)
  appears outside of clearly labeled mock hash variables. Use `fs.readFileSync` within a Vitest
  test. This is a static repository check.
- **N-18 and N-19**: Verify coverage already exists in `__tests__/config/credential-exposure.test.ts`.
  If the existing tests cover these cases, cite the file and do not duplicate. Extend only if a
  specific gap is identified.
- **N-20**: Use `@testing-library/react` with a minimal next-intl provider to render the public
  home page component (or a simpler component that mocks the absence of a session). Assert that
  the shell navigation `<nav aria-label>` element is absent.

> [!IMPORTANT]
> Before writing any test in `__tests__/auth/negative-path.test.ts`, audit
> `__tests__/auth/complete-invite.test.ts`, `__tests__/auth/session.test.ts`,
> `__tests__/auth/validation.test.ts`, and `__tests__/app-shell/route-guard.test.ts`
> for overlapping coverage. Cite existing coverage with a comment; do not duplicate tests.

### 6.2 Positive-path test file — `__tests__/integration/role-journey.test.ts`

This file covers cross-cutting positive behaviors demonstrating that each role persona reaches the
correct shell and that the locale, accessibility, and sign-out behaviors work end-to-end.

All behaviors in this table must be covered by at least one test:

| # | Behavior under test | Expected outcome |
|---|---|---|
| P-01 | `admin` role session → protected layout with `/admin` pathname | Layout renders; `redirect` not called |
| P-02 | `pm` role session → protected layout with `/pm` pathname | Layout renders; `redirect` not called |
| P-03 | `operator` role session → protected layout with `/operador` pathname | Layout renders; `redirect` not called |
| P-04 | `client` role session → protected layout with `/cliente` pathname | Layout renders; `redirect` not called |
| P-05 | Admin landing shell renders welcoming heading containing `profile.full_name` | Heading text includes full name |
| P-06 | PM landing shell renders welcoming heading containing `profile.full_name` | Heading text includes full name |
| P-07 | Operator landing shell renders welcoming heading containing `profile.full_name` | Heading text includes full name |
| P-08 | Client landing shell renders welcoming heading containing `profile.full_name` | Heading text includes full name |
| P-09 | `AppNav` renders `profile.full_name` for `admin` role | Name text node present in DOM |
| P-10 | `AppNav` renders `profile.full_name` for `pm` role | Name text node present in DOM |
| P-11 | `AppNav` renders `profile.full_name` for `operator` role | Name text node present in DOM |
| P-12 | `AppNav` renders `profile.full_name` for `client` role | Name text node present in DOM |
| P-13 | `SignOutButton` initiates navigation to `/iniciar-sesion` on click | Navigation target confirmed as `/iniciar-sesion`; not a protected path |
| P-14 | Active nav link carries `aria-current="page"` | Attribute present on the home link |
| P-15 | Nav landmark element has `aria-label` attribute | `<nav aria-label>` present in DOM |
| P-16 | `NotificationBadge` renders "99+" when count is 100 | Badge text content is "99+" |
| P-17 | `NotificationBadge` has `aria-label` that includes numeric count | `aria-label` attribute contains the count value |
| P-18 | All `shell.*` keys present in `es-MX.json` | Key-naming parity test passes |
| P-19 | All `shell.*` keys present in `en-US.json` with same key set | Key-naming parity test passes |
| P-20 | Mobile nav toggle has both `aria-expanded` and `aria-controls` attributes | Both attributes present in initial render |
| P-21 | Disabled stub nav links have `aria-disabled="true"` | Attribute present on each stub `<a>` element |
| P-22 | Protected layout renders exactly one `<main>` landmark | One `<main>` element in rendered output |
| P-23 | Sign-in page (`/iniciar-sesion`) renders without protected shell chrome | No `<nav aria-label>` shell nav element present |
| P-24 | Sign-in page renders with `en-US` locale messages | Page renders with en-US copy (e.g., "Sign in" or equivalent English key) |

#### 6.2.1 Implementation guidance

- **P-01 through P-04**: These are very likely already covered by
  `__tests__/app-shell/route-guard.test.ts` (the "allows matching role path" tests). Check first
  and cite if already covered. Only add if genuinely missing.
- **P-05 through P-08**: Check `__tests__/app-shell/role-landing.test.ts` for full-name heading
  assertions. If present, cite and skip. If not, render the shell component with a mocked session
  containing a known `full_name` and assert the heading.
- **P-09 through P-12**: Check `__tests__/app-shell/navigation.test.ts`. The test for
  "`AppNav` renders `profile.full_name`" should already exist. Cite if present.
- **P-13 through P-22**: Each of these maps to a specific test in
  `__tests__/app-shell/navigation.test.ts`. Audit that file systematically. For any behavior
  already covered, cite the existing test with a comment. Only add tests for uncovered behaviors.
- **P-18 and P-19**: Covered by `__tests__/i18n/key-naming.test.ts`. Cite; do not duplicate.
- **P-23 and P-24**: Use `@testing-library/react` with minimal next-intl mocks to render the
  sign-in page component. Assert presence of the form and absence of the shell nav. For P-24,
  supply `en-US` messages and assert an English label is visible.

> [!IMPORTANT]
> Before writing any test in `__tests__/integration/role-journey.test.ts`, audit
> `__tests__/app-shell/navigation.test.ts`, `__tests__/app-shell/route-guard.test.ts`,
> `__tests__/app-shell/role-landing.test.ts`, and `__tests__/i18n/key-naming.test.ts`.
> The expected outcome is that most of P-01 through P-22 are already covered. Add only
> the genuinely uncovered subset. An empty or near-empty test file for the already-covered
> behaviors is a correct outcome if the audit confirms full coverage.

## 7. Development persona access document

Create `dev-docs/specs/s03/s03-e03-03-dev-persona-access.md` with the following required sections.
This is a **documentation artifact**, not application code.

### 7.1 Required content

The document must contain these sections:

#### Section 1: Header and safety notice

A prominent caution alert stating this is LOCAL DEVELOPMENT ONLY, that it depends on demo accounts
seeded by `npm run db:bootstrap`, that these accounts do not exist in production, and that no step
in this document should be performed in production or preproduction.

#### Section 2: Prerequisites

1. `.env.local` must be present and contain valid `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `DEV_DEMO_PASSWORD` values (variable names only;
   no actual values).
2. `npm run db:bootstrap` must have been run against `jsf-pm-dev` to provision demo accounts.
3. Development server must be running: `npm run dev` → `http://localhost:3000`.

#### Section 3: Demo persona table

A table listing: Persona, Email, Application Role, and Seeded Context. The nine demo personas
defined in `scripts/bootstrap-dev-demo-data.ts` are:

| Persona | Email | Application Role | Seeded Context |
|---|---|---|---|
| Demo Admin | demo-admin@demo.jsf.internal | admin | All 6 projects visible; full admin workspace |
| Demo PM Lead A | demo-pm-lead-a@demo.jsf.internal | pm | Lead on Acme Brand Relaunch; watcher on Sandbox |
| Demo PM Lead B | demo-pm-lead-b@demo.jsf.internal | pm | Lead on Starlight Summer Campaign |
| Demo Watcher A | demo-watcher-a@demo.jsf.internal | pm | Watcher role on Acme Brand Relaunch |
| Demo Operator A | demo-operator-a@demo.jsf.internal | operator | Assigned tasks on Acme Brand Relaunch |
| Demo Operator B | demo-operator-b@demo.jsf.internal | operator | Assigned tasks on Sandbox Campaign |
| Demo Client A1 | demo-client-a1@demo.jsf.internal | client | Acme Corp projects |
| Demo Client A2 | demo-client-a2@demo.jsf.internal | client | Acme Corp projects |
| Demo Client B1 | demo-client-b1@demo.jsf.internal | client | Starlight Media projects |

The password for all personas is the value of `DEV_DEMO_PASSWORD` from `.env.local`. The document
must not print the password value; reference only the variable name.

#### Section 4: Entry procedure

Step-by-step for signing in as any persona through the standard sign-in UI:

1. Navigate to `http://localhost:3000/iniciar-sesion`.
2. Enter the persona's email address.
3. Enter the password from `DEV_DEMO_PASSWORD` in `.env.local`.
4. Submit the sign-in form.
5. Observe the redirect to the role-appropriate landing shell.

#### Section 5: Reference vs. sandbox corpora

Explain which projects are reference (read-only by convention) vs. sandbox (safe for interactive
mutation). Reference: Acme Brand Relaunch, Internal Workflow Automation, Acme Commercial Q1, Acme
Teaser 2025, Starlight Summer Campaign. Sandbox: Acme Sandbox Campaign. State that re-running
`npm run db:bootstrap` restores reference data.

#### Section 6: Denied access demonstration procedure

Exact steps to demonstrate role-route isolation and unauthenticated denial:

- Sign in as `demo-pm-lead-a@demo.jsf.internal` (PM role), then navigate directly to
  `http://localhost:3000/admin`. Expected: redirected to `/pm`.
- Sign out, then navigate directly to `http://localhost:3000/admin`. Expected: redirected to
  `/iniciar-sesion`.

#### Section 7: Sign-out procedure

Click the sign-out button in the navigation bar. The session is terminated and the user is
redirected to `/iniciar-sesion`.

### 7.2 Document constraints

- Do not include actual passwords, tokens, or credential values anywhere in the document.
- Do not include internal Supabase project URLs or keys.
- Reference `DEV_DEMO_PASSWORD` by variable name only.
- The document is written in English (developer-facing technical documentation; the localization
  rule applies to user-visible text in the application, not developer docs).
- The document must not describe any mechanism that bypasses the standard sign-in UI.

## 8. Sprint closeout verification note

Create `dev-docs/specs/s03/s03-sprint-03-closeout-verification.md` after all other changes pass
the full verification pipeline.

### 8.1 Required sections

The document must contain all of the following:

1. **Sprint identity**: sprint ID (S03), epic (E03), feature slug, branch name, and completion
   date.
2. **Definition of done checklist**: reproduce each DoD item from the sprint plan §6, with a
   Met / Not Met verdict and specific evidence citation (test file + test name, or command result).
3. **Changed files list**: every file changed or created in this sprint, grouped by work item
   (S03-E03-01, S03-E03-02, S03-E03-03). Include file paths relative to repo root.
4. **Automated verification results**: the exact commands run and their factual outcomes. Include
   test suite count, test case count, coverage percentages (statements, lines, branches, functions),
   and audit vulnerability count. Do not round or estimate.
5. **Manual localhost journey records**: a table with columns — Journey #, Persona (email),
   Entry URL, Action, Expected Result, Observed Result, Pass/Fail — for all 20 journeys in §9.
6. **Localization impact**: list all message keys added under `shell.*` and `auth.*` namespaces
   in this sprint. Confirm es-MX / en-US parity.
7. **Accessibility impact**: list ARIA landmarks added (nav, main), ARIA labels, aria-current,
   aria-expanded, aria-disabled, aria-controls, aria-live behaviors, and keyboard flows verified.
8. **Security boundary statement**: confirm each of the following:
   - No credentials, tokens, secret keys, or internal detail appear in any committed file.
   - The protected layout enforces server-side role checking before rendering.
   - The invitation route hashes the raw token before passing it to the database.
   - The magic link endpoint returns an enumeration-safe response regardless of user existence.
   - All error responses omit stack traces and internal Supabase messages.
9. **Known limitations and deferred items**: explicitly list stub navigation links (admin
   `/proyectos`, PM `/proyectos`, operator `/agenda`, client `/proyectos`) that are `aria-disabled`
   pending Sprint 04. List any other intentionally deferred behavior.
10. **Sprint 04 hand-off**: explicit list of stable contracts that Sprint 04 may import and build
    on without modification:
    - `requireSession` and `getOptionalSession` from `@/lib/auth/session`
    - `ROLE_DEFAULT_PATHS`, `PROTECTED_PATH_PREFIXES`, `isAllowlistedRedirectPath` from `@/lib/auth/routes`
    - `updateSession` from `@/lib/auth/middleware-session`
    - The `(protected)` layout group and its four role landing routes
    - `AppNav`, `SignOutButton`, `NotificationBadge`, `MobileNavToggle` from `src/components/shared/app-nav/`
    - `getAdminShellData`, `getPmShellData`, `getOperatorShellData`, `getClientShellData`, `getUnreadNotificationCount` from `@/lib/shell-data/shell-queries`
    - `shell.*` message namespace in `messages/es-MX.json` and `messages/en-US.json`
    - The seeded demo persona set and `npm run db:bootstrap` script

### 8.2 Document constraints

- Factual only. Do not represent intended behavior as confirmed behavior without verifiable evidence.
- Use "Pass", "Fail", or "N/A" in checklist and journey tables.
- Link to specific test files and line ranges where evidence exists.
- State the exact Node.js version (`node --version`) and Next.js version (from `package.json`)
  under which verification ran.
- This document is a stable sprint record. Do not modify it after the sprint is declared done
  except to correct a factual error.

## 9. Required manual localhost journey records

The following journeys must be performed on a running development server (`npm run dev`) and
recorded in §5 of the closeout verification note.

> [!IMPORTANT]
> Manual journeys require the bootstrap data to be present in `jsf-pm-dev`. Confirm
> `npm run db:bootstrap` has been run before performing journeys. If bootstrap has not been
> run, record each journey as "Blocked — bootstrap required" and note the blocker. Do not
> fabricate observations.

| # | Persona | Entry URL | Action | Expected result |
|---|---|---|---|---|
| J-01 | Unauthenticated | `/admin` | Navigate directly | Redirected to `/iniciar-sesion` |
| J-02 | Unauthenticated | `/pm` | Navigate directly | Redirected to `/iniciar-sesion` |
| J-03 | Unauthenticated | `/operador` | Navigate directly | Redirected to `/iniciar-sesion` |
| J-04 | Unauthenticated | `/cliente` | Navigate directly | Redirected to `/iniciar-sesion` |
| J-05 | demo-admin@demo.jsf.internal | `/iniciar-sesion` | Sign in with demo credentials | Redirected to `/admin`; admin landing visible; full name in nav |
| J-06 | demo-admin@demo.jsf.internal (signed in) | `/pm` | Navigate directly | Redirected to `/admin` |
| J-07 | demo-admin@demo.jsf.internal (signed in) | `/operador` | Navigate directly | Redirected to `/admin` |
| J-08 | demo-admin@demo.jsf.internal (signed in) | Sign-out button | Click sign-out | Redirected to `/iniciar-sesion`; subsequent `/admin` visit redirects to sign-in |
| J-09 | demo-pm-lead-a@demo.jsf.internal | `/iniciar-sesion` | Sign in with demo credentials | Redirected to `/pm`; PM landing visible with project list or empty state |
| J-10 | demo-pm-lead-a@demo.jsf.internal (signed in) | `/admin` | Navigate directly | Redirected to `/pm` |
| J-11 | demo-pm-lead-a@demo.jsf.internal (signed in) | `/cliente` | Navigate directly | Redirected to `/pm` |
| J-12 | demo-watcher-a@demo.jsf.internal | `/iniciar-sesion` | Sign in with demo credentials | Redirected to `/pm`; PM landing visible |
| J-13 | demo-operator-a@demo.jsf.internal | `/iniciar-sesion` | Sign in with demo credentials | Redirected to `/operador`; operator agenda or empty state visible |
| J-14 | demo-operator-a@demo.jsf.internal (signed in) | `/admin` | Navigate directly | Redirected to `/operador` |
| J-15 | demo-client-a1@demo.jsf.internal | `/iniciar-sesion` | Sign in with demo credentials | Redirected to `/cliente`; client project list or empty state visible |
| J-16 | demo-client-a1@demo.jsf.internal (signed in) | `/pm` | Navigate directly | Redirected to `/cliente` |
| J-17 | Any signed-in persona | Any protected page, 375 px viewport | Open mobile nav drawer via toggle | Drawer opens; nav links visible and tappable; pressing Escape closes drawer |
| J-18 | Any signed-in persona | Any protected page | Keyboard-only navigation (Tab, Enter, Escape) | All nav links and buttons reachable and activatable without mouse |
| J-19 | Unauthenticated | `/en/sign-in` | Navigate to English public sign-in | Public sign-in page renders; no protected shell nav chrome visible |
| J-20 | Unauthenticated | `/privacidad` | Navigate to public privacy page | Privacy page renders normally; no protected shell chrome |

For each journey, record the exact persona email used, the start URL, the observed redirect or
rendered content, any unexpected behavior, and Pass/Fail. A "Pass" requires the observed result to
match the expected result exactly. A partial or conditional match is a "Fail" with notes.

## 10. File inventory

### 10.1 New files

| Path | Purpose |
|---|---|
| `__tests__/auth/negative-path.test.ts` | Focused negative-path test suite covering §6.1 |
| `__tests__/integration/role-journey.test.ts` | Focused positive-path cross-role test suite covering §6.2 |
| `dev-docs/specs/s03/s03-e03-03-dev-persona-access.md` | Development persona access guide (§7) |
| `dev-docs/specs/s03/s03-sprint-03-closeout-verification.md` | Sprint closeout verification note (§8) |

### 10.2 Potentially modified files

| Path | Condition for modification |
|---|---|
| `__tests__/i18n/key-naming.test.ts` | Only if a gap is discovered in `shell.*` key coverage during §3.2 baseline check |
| `__tests__/config/credential-exposure.test.ts` | Only if N-18 or N-19 reveals a gap in static credential assertions |
| `CHANGELOG.md` | Always — updated last, using the `/update-changelog` skill |
| `scripts/bootstrap-dev-demo-data.ts` | Only if a specific integration adjustment is required per §4.2; document the rationale |

### 10.3 Preserved unchanged

| Path | Reason |
|---|---|
| `src/lib/auth/session.ts` | S03-E03-01 deliverable; must not be modified |
| `src/lib/auth/routes.ts` | S03-E03-01 deliverable; must not be modified |
| `src/lib/auth/middleware-session.ts` | S03-E03-01 deliverable; must not be modified |
| `src/proxy.ts` | S03-E03-01 deliverable; must not be modified |
| `src/app/(protected)/layout.tsx` | S03-E03-02 deliverable; must not be modified |
| `src/lib/shell-data/shell-queries.ts` | S03-E03-02 deliverable; must not be modified |
| `src/components/shared/app-nav/` | S03-E03-02 deliverable; must not be modified |
| `src/app/(protected)/admin/` | S03-E03-02 deliverable; must not be modified |
| `src/app/(protected)/pm/` | S03-E03-02 deliverable; must not be modified |
| `src/app/(protected)/operador/` | S03-E03-02 deliverable; must not be modified |
| `src/app/(protected)/cliente/` | S03-E03-02 deliverable; must not be modified |
| `src/lib/database.types.ts` | MCP-generated tracked exception; must not be modified |
| `supabase/migrations/` | No schema change in this item |
| All `src/app/[locale]/` public pages | Public shell must remain unchanged |
| All `src/app/api/v1/auth/` route handlers | S03-E03-01 deliverables; must not be modified |

## 11. Verification plan

### 11.1 Automated checks (run after all new work is added)

```
npm run format:check
npm run lint
npm run typecheck
npm run build
npm run test
npm run test:coverage
npm run audit:prod
```

All must pass with 0 errors and 0 warnings. New test files must not introduce new failures. Test
coverage must not regress below the S03-E03-02 baseline (statements ≥ 77.99%, lines ≥ 78.32%).

### 11.2 Manual journeys

Complete all 20 journeys in §9 against a running `npm run dev` server with bootstrap data present.
Record results factually in the sprint closeout verification note.

### 11.3 Definition of done cross-reference

Each sprint-level DoD item from the sprint plan §6 maps to these verification methods:

| DoD Item | Automated evidence | Manual evidence |
|---|---|---|
| No unauthenticated user obtains protected data | N-10 through N-16; `route-guard.test.ts` | J-01 through J-04 |
| No public signup or browser-selectable role | Static check: no `/signup` route; no role param in sign-in | — |
| Invitation tokens opaque, hash-only, absent from logs | N-01 through N-04, N-17; `complete-invite.test.ts` | — |
| Sign-in, recovery, sign-out, expiry, inactive are deterministic | `session.test.ts`, `validation.test.ts`, `callback.test.ts` | J-05 through J-08 |
| Every valid role reaches correct landing; invalid denied server-side | `route-guard.test.ts`; P-01 through P-04 | J-05, J-09, J-12, J-13, J-15 |
| Role authority from server/database boundary; no client duplication | Code inspection: no client-side role claim | — |
| Shell keyboard-operable, ARIA-labeled, responsive, public locale intact | `navigation.test.ts`; P-15, P-20, P-21, P-22 | J-17, J-18, J-19, J-20 |
| Localhost demo supports seeded personas; reference vs. sandbox separated | Persona access document; bootstrap script | J-05 through J-16 |
| Full verification pipeline passes | `npm run verify` exit 0 | — |
| No provider activated; no production or preproduction change | No provider config in changed files | — |

## 12. Execution sequence

Execute strictly in this order. Do not proceed to the next step if the current step fails.

1. **Baseline verification** (§3.2): run the full pipeline. Record pass/fail. If any check fails,
   identify the source file and remediate before adding new work.
2. **Existing coverage audit**: inspect `__tests__/app-shell/navigation.test.ts`,
   `__tests__/app-shell/route-guard.test.ts`, `__tests__/app-shell/role-landing.test.ts`,
   `__tests__/auth/validation.test.ts`, `__tests__/auth/complete-invite.test.ts`, and
   `__tests__/i18n/key-naming.test.ts`. Produce a written inventory of which §6.1 and §6.2
   behaviors are already covered and which are genuinely missing.
3. **Write negative-path tests** (`__tests__/auth/negative-path.test.ts`) for only the genuinely
   missing behaviors from the §6.1 table. Run `npm run test` to confirm they pass.
4. **Write positive-path tests** (`__tests__/integration/role-journey.test.ts`) for only the
   genuinely missing behaviors from the §6.2 table. Run `npm run test` to confirm they pass.
5. **Write the persona access document** (`dev-docs/specs/s03/s03-e03-03-dev-persona-access.md`)
   per §7. No code changes required for this step.
6. **Run the full pipeline** one final time (all seven checks in §11.1). Record exact output.
7. **Perform manual journeys** (§9) against `npm run dev`. Record all results table rows.
8. **Write the sprint closeout verification note**
   (`dev-docs/specs/s03/s03-sprint-03-closeout-verification.md`) per §8, populating all ten
   required sections with factual evidence from steps 6 and 7.
9. **Update CHANGELOG.md** using the `/update-changelog` skill. This is the final step; no code
   or documentation changes may follow it.

## 13. Stop conditions

| Discovery | Required response |
|---|---|
| §3.2 baseline check reveals a failure in S03-E03-01 or S03-E03-02 code | Identify the failing file; report before adding any new test or doc |
| A test in §6.1 or §6.2 reveals an unauthenticated deep-link to a role path not caught server-side | Block sprint closeout; fix the layout guard before declaring the sprint done |
| A test reveals cross-role isolation failure (wrong role reaches a role path without redirect) | Block integration; remediate and re-verify |
| A test reveals a raw invitation token in a log, response body, or fixture | Block; remediate before closeout |
| A test reveals the Supabase secret key or any real credential in a client-importable module | Block immediately; treat as R0 security defect; report with exact file and line |
| A manual journey reveals a public page rendering protected shell chrome | Stop; investigate and fix before declaring the sprint done |
| Implementing any test requires a schema change, database access, or `database.types.ts` edit | Stop; this item makes no database changes |
| The bootstrap script requires a change that alters the persona email set or credential contract | Stop; request Project Owner decision before modifying |
| The sprint closeout note would need to claim passing behavior that was not actually verified | Stop; record the gap as a known limitation instead of fabricating evidence |
| Coverage regresses below the S03-E03-02 baseline | Stop; identify the cause and restore coverage before declaring done |
