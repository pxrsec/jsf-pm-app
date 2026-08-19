---
spec_id: S03-E03-01
feature_slug: invite-only-account-entry-and-session-lifecycle
sprint: S03
epic: E03
work_item: S03-E03-01
status: ready-for-implementation
version: 1.0
created: 2026-08-18
updated: 2026-08-18
branch: feature/s03-e03-identity-onboarding-and-role-safe-shell
risk: critical
sources:
  - contracts/openapi/jsf-pm-api.openapi.yaml
  - dev-docs/specs/s03/feature/s03-e03-identity-onboarding-and-role-safe-shell-sprint-plan.md
  - dev-docs/specs/s02/database-schema-v1.6-s02-reconciled.md
  - supabase/migrations/20260818143500_s02_e02_authoritative_data_platform.sql
---

# S03-E03-01 — Invite-Only Account Entry and Session Lifecycle

## 1. Execution objective

Implement a secure, localized, invite-only account-entry experience backed by the S02 Supabase data
platform and the repository API contract. This work item delivers:

1. Localized account-entry screens: sign-in, password-reset initiation, password update after
   authorized recovery, and session-expired/invalid-link outcomes.
2. Invitation redemption and first-account setup routed exclusively through the established
   `accept_invite` database boundary and the `POST /api/v1/auth/invites/complete` contract operation.
3. A single, server-authoritative session utility that resolves the authenticated user, `profiles`
   row, and `profiles.role` for server components, route handlers, and protected layouts.
4. Focused authentication, invitation, session, and localization tests.

This work item creates no protected shell, no role landing pages, and no application navigation —
those are S03-E03-02. It does not activate any external provider, alter the database schema, or
generate new database types.

## 2. Authority and conflict rule

Precedence, in order:

1. Direct Project Owner instruction.
2. The S03 sprint plan (`dev-docs/specs/s03/feature/s03-e03-identity-onboarding-and-role-safe-shell-sprint-plan.md`).
3. This specification and the repository artifacts it identifies.
4. Accepted ADRs → Database Schema v1.6 (reconciled) → OpenAPI contract v1.5.
5. Current repository rules (`GEMINI.md`, `AGENTS.md`).

A discrepancy between an authoritative source and this specification on authorization, session,
token, password-policy, or RLS behavior is a stop condition; report it and do not silently
resolve it.

## 3. Scope

### 3.1 In scope

- Localized account-entry pages under `src/app/[locale]/` for sign-in, password-reset request,
  password-update after recovery, expired-session/invalid-link outcomes, and
  invitation-redemption/first-account setup.
- API route handlers under `src/app/api/v1/auth/` for the `completeInvite` and `requestMagicLink`
  contract operations, and the Supabase Auth callback route.
- `src/lib/auth/session.ts` — a single, narrowly scoped server-side session utility.
- `src/lib/validation/auth.ts` — Zod schemas for all auth-boundary inputs, derived from the
  OpenAPI contract shapes.
- Updates to `src/proxy.ts` limited to session-refresh cookie propagation for protected paths.
- Locale catalog additions to `messages/es-MX.json` and `messages/en-US.json` covering all new
  user-visible copy with semantic key parity.
- Focused tests under `__tests__/auth/` for the behaviors listed in §7.

### 3.2 Explicitly out of scope

- Protected application shell, role landing pages, navigation, empty states, or any UI that
  requires an authenticated user to have already reached a role workspace. Those are S03-E03-02.
- Development persona access path and manual demonstration journeys. Those are S03-E03-03.
- Admin invitation creation UI or the `POST /api/v1/auth/invites` route handler. Invites are
  created through external admin tooling; this item implements only redemption and the session
  layer consumed by the shell.
- Provider activation, outbound email or WhatsApp delivery, production or preproduction
  environment changes.
- Schema migration, database type generation, or any Supabase MCP operation.
- Playwright E2E automation.

## 4. Non-negotiable implementation boundaries

- `profiles.role` is the sole application-role authority. Never read `raw_user_meta_data`, a URL
  parameter, a form field, a cookie other than the Supabase session, or any browser-supplied value
  as an authorization input.
- Browser and server access use `@supabase/ssr` exclusively. The secret key must never enter a
  client bundle, shared module, log, test fixture, error response, or committed file.
  Server-only code using the admin client must be unreachable from any browser-importable path.
- Protected unsafe server operations retain same-origin Origin/Host validation, Zod input
  validation, and safe non-leaking error responses. Stack traces, Supabase error messages,
  session tokens, and internal authorization details must never reach a response body or log at
  level info or above.
- The localized public route convention is unchanged: Spanish public pages are unprefixed (`/`)
  and English public pages are under `/en/`. Account-entry pages follow the same next-intl
  `as-needed` prefix convention and must be tested with both locales.
- Raw invitation tokens are never stored, logged, or included in error messages. The route handler
  hashes the submitted token with SHA-256 before passing `p_token_hash` to `accept_invite`. The
  unhashed token is present only in memory for the duration of the request.
- Account-enumeration-safe responses: the password-reset initiation route and the magic-link route
  always return the same success shape regardless of whether the email matches an existing account.
- No public signup path may be created. There is no role-selection UI and no
  browser-controllable invitation role.

## 5. Data model baseline

The following S02 schema objects are the foundation for this item. Do not modify them.

### 5.1 `public.profiles`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | FK → `auth.users(id)` |
| `role` | `public.app_role` | `admin`, `pm`, `operator`, `client` |
| `full_name` | `text` | 1–120 chars, btrim |
| `phone_e164` | `text` | nullable |
| `preferred_locale` | `text` | `es-MX` or `en-US` |
| `is_active` | `boolean` | inactive users denied protected access |
| `deleted_at` | `timestamptz` | nullable; soft-deleted profiles denied access |

### 5.2 `public.invite_tokens`

| Column | Type | Notes |
|---|---|---|
| `token_hash` | `bytea` | SHA-256 of the opaque token; never the raw token |
| `email` | `citext` | recipient email; normalized, case-insensitive |
| `role` | `public.app_role` | `operator` or `client` only |
| `project_id` | `uuid` | nullable |
| `client_id` | `uuid` | nullable |
| `status` | `public.invite_status` | `pending`, `accepted`, `expired`, `revoked` |
| `expires_at` | `timestamptz` | token rejected if `<= now()` at redemption |
| `revoked_at` | `timestamptz` | token rejected if not null |
| `accepted_by` | `uuid` | set on successful `accept_invite` |

### 5.3 `public.accept_invite(p_token_hash bytea)` RPC

The trusted database function that:
- Requires `auth.uid()` to be non-null (caller must already have a Supabase Auth session).
- Locks the `invite_tokens` row with `FOR UPDATE`.
- Validates `status = 'pending'`, not expired, not revoked, and caller email matches
  `invite_tokens.email` (case-insensitive).
- Marks the token `accepted`, sets `accepted_by = auth.uid()`, and upserts `public.profiles`
  with the trusted role and project context.
- Writes the required audit event.
- Raises a descriptive exception on any violation (status not pending, expired, revoked, email
  mismatch).

**Implementation consequence:** the invitation redemption flow must create a Supabase Auth user
first (using the admin client's `createUser`), then call `accept_invite` using an authenticated
server client for that new user. The route handler orchestrates this two-step sequence from the
server; no client code participates in the token hash or the RPC call.

### 5.4 OpenAPI contract operations implemented by this item

| Operation | Contract path | HTTP method | Auth required |
|---|---|---|---|
| `completeInvite` | `/api/v1/auth/invites/complete` | `POST` | No (creates the session) |
| `requestMagicLink` | `/api/v1/auth/magic-link` | `POST` | No |
| Auth callback | `/api/auth/callback` | `GET` | N/A (PKCE/OTP exchange) |

Standard Supabase Auth flows (sign-in, password reset, password update) use Supabase client
methods surfaced from server actions or client components at interaction boundaries; they do not
have custom API route handlers.

## 6. Required implementation

### 6.1 Session utility — `src/lib/auth/session.ts`

Create a single exported function with a server-only guard (`import 'server-only'`):

```typescript
export type SessionContext = {
  user: User;     // supabase auth User
  profile: Profile; // public.profiles row typed from database.types.ts
  role: AppRole;  // profiles.role — the authoritative application role
};

export async function requireSession(
  cookieStore: CookieStore,
): Promise<SessionContext>
```

Behavior contract:

- Calls `supabase.auth.getUser()` (not `getSession()`) to validate the token server-side.
- If no authenticated user exists, throws a typed `AuthError` with code `UNAUTHENTICATED`.
- Fetches the `profiles` row for `user.id` via the server Supabase client.
- If the profile is missing, `is_active = false`, or `deleted_at IS NOT NULL`, throws a typed
  `AuthError` with code `INACTIVE_OR_MISSING_PROFILE`.
- Returns the `SessionContext` object containing all three values.
- Never logs the session, user object, profile row, or any token value at any log level.
- Is callable from server components, route handlers, and protected layouts; never imported by
  client components.

A companion `getOptionalSession` function that returns `SessionContext | null` (no throw) may be
added if needed by the sign-in page redirect logic; it must apply the same active-profile check.

### 6.2 Zod validation schemas — `src/lib/validation/auth.ts`

Derive all schemas from the OpenAPI contract shapes. Do not create a second source of truth for
password policy or token format.

#### 6.2.1 Password policy

Derived from `CompleteInviteRequest.password` in the OpenAPI contract:
- Minimum 12 characters, maximum 128 characters.
- Must contain at least one uppercase letter, one lowercase letter, one digit, and one allowed
  symbol.
- The Zod schema is the single implementation of this policy. UI validation and server validation
  use the same exported schema; do not inline the regex separately.

#### 6.2.2 Required schemas

```typescript
export const CompleteInviteSchema   // token, full_name, phone_e164, password, whatsapp_opt_in
export const MagicLinkSchema        // email, redirect_path (relative path only)
export const SignInSchema           // email, password (server action validation)
export const PasswordUpdateSchema   // password (matches CompleteInviteSchema.password rules)
```

`redirect_path` in `MagicLinkSchema` must validate: starts with exactly one `/`, does not start
with `//`, contains no `\` or control characters, and matches an allowlist of permitted application
path prefixes (derived from the API contract description). Reject absolute URLs.

### 6.3 Account-entry pages

All pages are React Server Components at the route level. Client form components (`'use client'`)
are placed in route-local `_components/` directories.

#### 6.3.1 Sign-in page

- **Route:** `[locale]/iniciar-sesion` (es-MX, unprefixed), `/en/sign-in` (en-US)
- Supabase email+password sign-in via a server action or a client-side
  `supabase.auth.signInWithPassword` call from the browser client.
- On success: redirect to the role-appropriate protected path determined by reading
  `profiles.role` via `requireSession`. The redirect target for each role is declared as a
  named constant in `src/lib/auth/routes.ts`: `/admin`, `/pm`, `/operador`, `/cliente`.
- On failure: display a user-safe, account-enumeration-safe message. Never distinguish "wrong
  password" from "email not found" in the UI.
- If the user already has an active session, redirect away from the sign-in page without
  displaying it (no infinite loop).

#### 6.3.2 Password-reset initiation page

- **Route:** `[locale]/restablecer-contrasena` (es-MX), `/en/reset-password` (en-US)
- Calls `supabase.auth.resetPasswordForEmail` with `redirectTo` pointing to the password-update
  page.
- Always displays the same confirmation message regardless of whether the email matched an account
  (account-enumeration safety).
- If Supabase returns a rate-limit error, display a message asking the user to wait before
  retrying. Do not surface the rate-limit error code or count.

#### 6.3.3 Password-update page (post-recovery)

- **Route:** `[locale]/actualizar-contrasena` (es-MX), `/en/update-password` (en-US)
- Accessible only after a valid Supabase recovery link is followed (the Auth callback establishes
  the recovery session).
- Validates the new password client-side and server-side using `PasswordUpdateSchema`.
- Calls `supabase.auth.updateUser({ password })` from a server action or browser client after
  confirming the recovery session is present.
- On success: redirect to sign-in with a success query param message.
- If no recovery session is present, redirect to the expired/invalid-link outcome page.

#### 6.3.4 Invitation redemption page

- **Route:** `[locale]/invitacion` (es-MX), `/en/invitation` (en-US)
- Accepts the opaque token via URL query parameter `?token=<value>`. The token is read
  server-side from `searchParams`; it is never written to client state, logged, or reflected
  in error messages.
- Displays the account-setup form: `full_name`, `password`, optionally `phone_e164` and
  `whatsapp_opt_in`.
- On submit, a server action or the `completeInvite` route handler performs the sequence in §6.5.
- On terminal token errors (`expired`, `revoked`, `already accepted`, `email mismatch`): redirect
  to the session-expired/invalid-link outcome page with a `?reason=` query param indicating the
  failure class. Do not include the token value in the redirect URL.
- On success: establish the session and redirect to the role-appropriate path from
  `src/lib/auth/routes.ts`.

#### 6.3.5 Session-expired / invalid-link outcome page

- **Route:** `[locale]/sesion-expirada` (es-MX), `/en/session-expired` (en-US)
- Accepts an optional `?reason=` query param (values: `expired`, `invalid`, `already_used`) to
  select the appropriate localized copy. Never displays raw error text or token values.
- Provides a link back to the sign-in page.
- No authentication required.

### 6.4 API route handlers

#### 6.4.1 `POST /api/v1/auth/invites/complete` — `completeInvite`

- File: `src/app/api/v1/auth/invites/complete/route.ts`
- Unauthenticated endpoint (no session cookie required on entry).
- Validates `Idempotency-Key` header presence (required per OpenAPI contract).
- Parses and validates the request body with `CompleteInviteSchema`.
- Performs the token-hash-and-redemption sequence described in §6.5.
- Returns `201 AuthCompletionResponse` on success.
- Returns `400 ValidationError`, `409 Conflict`, or `410 InviteTerminal` per the OpenAPI
  contract.
- Same-origin validation: reject requests whose `Origin` header does not match
  `NEXT_PUBLIC_APP_URL`.
- Never logs the raw token or the token hash.

#### 6.4.2 `POST /api/v1/auth/magic-link` — `requestMagicLink`

- File: `src/app/api/v1/auth/magic-link/route.ts`
- Unauthenticated endpoint.
- Validates `Idempotency-Key` header presence.
- Parses and validates the request body with `MagicLinkSchema`.
- Calls `supabase.auth.signInWithOtp` with `shouldCreateUser: false` (existing-account only).
- Always returns `202` regardless of whether the email matched an account. The response body must
  not contain any field that distinguishes account existence.
- On Supabase rate-limit response: return `429 RateLimited` per the contract shape.
- Same-origin validation applies.

#### 6.4.3 Auth callback — `GET /api/auth/callback`

- File: `src/app/api/auth/callback/route.ts`
- Handles the `code` (PKCE) or `token_hash` + `type` parameters from Supabase Auth email links
  (magic-link OTP, password recovery).
- Exchanges the code or token for a session using `supabase.auth.exchangeCodeForSession` or
  `supabase.auth.verifyOtp` as appropriate.
- On success: redirect to the `next` query parameter value if it passes the same relative-path
  allowlist as `MagicLinkSchema.redirect_path`; otherwise redirect to the role-appropriate path
  or the password-update page (for recovery flows).
- On failure: redirect to `/sesion-expirada?reason=invalid`.
- Applies `setAll` on the cookie store to propagate the new session cookie.

### 6.5 Invitation redemption — required server boundary approach

The `accept_invite` RPC requires `auth.uid()` to be non-null, meaning the calling user must
already have a Supabase Auth session. The invitation flow creates a new user. The required
server-only sequence:

1. The `completeInvite` route handler (server-only) uses the **admin client** (`createAdminClient`)
   to hash the submitted token and look up the `invite_tokens` row server-side. This resolves the
   recipient email without any client input.
2. The route handler calls `supabase.auth.admin.createUser({ email, password, email_confirm: true
   })` using the admin client. The email comes from the `invite_tokens` row, not the request body.
3. The route handler creates a short-lived server session for the new user (using
   `supabase.auth.admin.generateLink` or signing in directly server-side) and calls
   `public.accept_invite(p_token_hash)` on an authenticated server client for that user.
4. Returns `AuthCompletionResponse` on success; appropriate error shape otherwise.

The admin client is never imported by any file reachable from the browser bundle. Its import path
(`@/lib/supabase/admin`) must remain in server-only files enforced by `import 'server-only'`
guards on the caller.

### 6.6 Middleware update — `src/proxy.ts`

Update the middleware to also refresh the Supabase session cookie on protected paths:

- Use `supabase.auth.getUser()` (not `getSession()`) inside middleware to avoid relying on a
  potentially stale cookie.
- Protected route groups are identified by path prefix (declared in `src/lib/auth/routes.ts`
  as `PROTECTED_PATH_PREFIXES`).
- The middleware does _not_ perform role authorization; it only refreshes the cookie. Role
  authorization occurs in the protected layout (S03-E03-02).
- Keep the next-intl middleware composable. Chain the Supabase session-refresh logic around the
  existing `createMiddleware(routing)` call.
- The existing matcher config must still cover internationalized pathnames and exclude `_next`,
  `_vercel`, and static asset paths.

Keep `proxy.ts` at or below 80 lines. If the session-refresh logic requires more, extract it into
`src/lib/auth/middleware-session.ts` (server-only).

### 6.7 Locale catalog additions

Add keys to **both** `messages/es-MX.json` and `messages/en-US.json` with exact semantic parity.
All keys live under an `auth` namespace.

Required key list:

```
auth.signIn.title
auth.signIn.emailLabel
auth.signIn.passwordLabel
auth.signIn.submitLabel
auth.signIn.forgotPasswordLink
auth.signIn.errorGeneric
auth.signIn.errorRateLimit

auth.resetPassword.title
auth.resetPassword.emailLabel
auth.resetPassword.submitLabel
auth.resetPassword.successMessage

auth.updatePassword.title
auth.updatePassword.passwordLabel
auth.updatePassword.confirmLabel
auth.updatePassword.submitLabel
auth.updatePassword.successMessage
auth.updatePassword.errorPolicy

auth.invitation.title
auth.invitation.fullNameLabel
auth.invitation.phoneLabel
auth.invitation.passwordLabel
auth.invitation.whatsappOptInLabel
auth.invitation.submitLabel
auth.invitation.errorPolicy
auth.invitation.errorGeneric

auth.sessionExpired.title
auth.sessionExpired.messageExpired
auth.sessionExpired.messageInvalid
auth.sessionExpired.messageAlreadyUsed
auth.sessionExpired.signInLink
```

Do not add keys not listed above. Additional copy needs are a decision to surface to the Project
Owner.

### 6.8 Role-route constants — `src/lib/auth/routes.ts`

```typescript
// Server-safe constants; no browser import; no dynamic values.
export const ROLE_DEFAULT_PATHS: Record<AppRole, string> = {
  admin:    '/admin',
  pm:       '/pm',
  operator: '/operador',
  client:   '/cliente',
};

// Path prefixes that require an active session (used by middleware and shell guard).
export const PROTECTED_PATH_PREFIXES: readonly string[] = [
  '/admin', '/pm', '/operador', '/cliente',
];
```

These constants are the single source of truth for route-role association. S03-E03-02 imports
them without modification.

## 7. Required tests

All tests are under `__tests__/auth/`. Use Vitest with `jsdom` environment. Mock Supabase client
calls with `msw` or `vi.mock`; never use real Supabase credentials in tests.

### 7.1 Negative-path tests (must fail safely)

| Behavior | Expected outcome |
|---|---|
| `completeInvite` with a malformed token (too short, wrong charset) | `400 ValidationError`; token not logged |
| `completeInvite` with an expired token hash | `410 InviteTerminal`; no account created |
| `completeInvite` with a revoked token | `410 InviteTerminal` |
| `completeInvite` with a token already accepted | `410 InviteTerminal` |
| `completeInvite` with a mismatched recipient email | `410 InviteTerminal`; no cross-account info leaked |
| `completeInvite` with a password below policy | `400 ValidationError`; no raw Supabase error in body |
| `requestMagicLink` with a non-existent email | `202`; body indistinguishable from success |
| `requestMagicLink` with an absolute `redirect_path` | `400 ValidationError` |
| `requestMagicLink` when rate limited by Supabase | `429 RateLimited` |
| Sign-in with wrong credentials | Generic error message; no account-existence signal |
| `requireSession` with no active session | Throws `UNAUTHENTICATED` |
| `requireSession` with `is_active = false` profile | Throws `INACTIVE_OR_MISSING_PROFILE` |
| `requireSession` with `deleted_at` set | Throws `INACTIVE_OR_MISSING_PROFILE` |
| `requireSession` with missing profile row | Throws `INACTIVE_OR_MISSING_PROFILE` |
| Auth callback with invalid/expired code | Redirects to `/sesion-expirada?reason=invalid` |
| Auth callback with a non-allowlisted `next` param | Ignores `next`; redirects to default path |
| `completeInvite` with wrong `Origin` header | `403` or `400`; request rejected at same-origin check |

### 7.2 Positive-path tests

| Behavior | Expected outcome |
|---|---|
| `requireSession` with valid session and active profile | Returns `SessionContext` with correct `role` |
| `CompleteInviteSchema` with valid input | Passes validation |
| `PasswordUpdateSchema` with a policy-compliant password | Passes validation |
| `MagicLinkSchema` with a valid relative path | Passes validation |
| `MagicLinkSchema.redirect_path` with `null` | Passes validation |
| Auth callback with a valid PKCE code and `next=/pm` | Redirects to `/pm` |
| Auth callback for a recovery flow | Redirects to password-update page |
| Invitation page renders with a `?token=` query param | Form visible; token not in DOM or logs |
| Session-expired page renders with `?reason=expired` | Displays the correct localized message |

### 7.3 Localization tests

| Behavior | Expected outcome |
|---|---|
| All `auth.*` keys present in `es-MX.json` | Parity check passes |
| All `auth.*` keys present in `en-US.json` | Same key set as `es-MX.json` |
| Sign-in page renders in `es-MX` locale | Title and labels use es-MX copy |
| Sign-in page renders in `en-US` locale | Title and labels use en-US copy |

## 8. File inventory

### 8.1 New files

| Path | Purpose |
|---|---|
| `src/lib/auth/session.ts` | `requireSession` and `getOptionalSession` |
| `src/lib/auth/routes.ts` | `ROLE_DEFAULT_PATHS`, `PROTECTED_PATH_PREFIXES` |
| `src/lib/auth/middleware-session.ts` | Session-refresh helper for middleware (if needed to keep proxy.ts ≤80 lines) |
| `src/lib/validation/auth.ts` | Zod schemas: `CompleteInviteSchema`, `MagicLinkSchema`, `SignInSchema`, `PasswordUpdateSchema` |
| `src/app/api/v1/auth/invites/complete/route.ts` | `completeInvite` handler |
| `src/app/api/v1/auth/magic-link/route.ts` | `requestMagicLink` handler |
| `src/app/api/auth/callback/route.ts` | Supabase Auth PKCE/OTP callback |
| `src/app/[locale]/iniciar-sesion/page.tsx` | Sign-in page (RSC) |
| `src/app/[locale]/iniciar-sesion/_components/sign-in-form.tsx` | Sign-in client form |
| `src/app/[locale]/restablecer-contrasena/page.tsx` | Password-reset initiation page |
| `src/app/[locale]/restablecer-contrasena/_components/reset-password-form.tsx` | Reset form (client) |
| `src/app/[locale]/actualizar-contrasena/page.tsx` | Password-update page |
| `src/app/[locale]/actualizar-contrasena/_components/update-password-form.tsx` | Update form (client) |
| `src/app/[locale]/invitacion/page.tsx` | Invitation redemption page |
| `src/app/[locale]/invitacion/_components/invitation-form.tsx` | Invitation client form |
| `src/app/[locale]/sesion-expirada/page.tsx` | Session-expired/invalid-link outcome page |
| `__tests__/auth/session.test.ts` | `requireSession` unit tests |
| `__tests__/auth/validation.test.ts` | Zod schema unit tests |
| `__tests__/auth/complete-invite.test.ts` | `completeInvite` handler tests |
| `__tests__/auth/magic-link.test.ts` | `requestMagicLink` handler tests |
| `__tests__/auth/callback.test.ts` | Auth callback handler tests |
| `__tests__/auth/pages.test.ts` | Page render and localization tests |

### 8.2 Modified files

| Path | Change |
|---|---|
| `src/proxy.ts` | Add Supabase session-refresh for protected paths; keep next-intl middleware |
| `messages/es-MX.json` | Add `auth.*` keys |
| `messages/en-US.json` | Add `auth.*` keys with semantic parity |

### 8.3 Preserved unchanged

| Path | Reason |
|---|---|
| `src/lib/supabase/server.ts` | Existing factory; used by `requireSession` via caller-supplied `cookieStore` |
| `src/lib/supabase/browser.ts` | Used by client form components |
| `src/lib/supabase/admin.ts` | Used by `completeInvite` handler (server-only) |
| `src/lib/database.types.ts` | MCP-generated; never modified |
| `supabase/migrations/` | No schema change in this item |

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

All must pass with zero errors. Coverage must include the session utility, Zod schemas, and route
handlers.

### 9.2 Minimum manual localhost verification

1. Navigate to `/iniciar-sesion` as an unauthenticated user → sign-in form appears.
2. Submit incorrect credentials → generic error message; no account-existence signal.
3. Navigate to `/iniciar-sesion` as an already-signed-in user → redirected away (no loop).
4. Navigate to `/sesion-expirada?reason=expired` → correct localized copy displayed.
5. Navigate to `/sesion-expirada?reason=invalid` → correct localized copy displayed.
6. Navigate to `/invitacion` with no `?token=` → redirect to `/sesion-expirada?reason=invalid`.
7. Navigate to `/en/sign-in` → English copy displayed correctly.

Full multi-persona demonstration journeys are part of S03-E03-03.

## 10. Stop conditions

| Discovery | Required response |
|---|---|
| `accept_invite` RPC signature or behavior differs from §5.3 | Stop; reconcile with the committed migration before implementing the route handler |
| The OpenAPI contract does not define `completeInvite` or `requestMagicLink` | Stop; do not create an undocumented public endpoint |
| Password policy in the OpenAPI contract differs from `CompleteInviteSchema.password` constraints | Stop; request a Project Owner decision before implementing |
| A required flow needs admin secret key access from a client-reachable path | Reject the approach; redesign the server boundary |
| A test reveals a token-exposure, account-enumeration, open-redirect, same-origin bypass, or session-fixation defect | Block integration; remediate and re-verify before proceeding |
| The middleware Supabase session refresh requires importing a secret into a non-server-only file | Stop; redesign using a server action or edge-safe pattern |
| Implementing any step requires a schema change, Supabase MCP operation, or `database.types.ts` edit | Stop; this item makes no database changes |
