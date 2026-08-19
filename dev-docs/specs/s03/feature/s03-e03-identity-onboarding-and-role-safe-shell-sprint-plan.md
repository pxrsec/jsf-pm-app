
# Sprint 03 — E3 Identity, Onboarding, and Role-Safe Application Shell

## 1. Sprint purpose

Sprint 03 converts the completed data platform into the first usable authenticated application. Its deliverable is a localhost-ready, invite-only entry path and a role-safe shell that real development personas can use to enter the correct workspace without client-side role claims or direct database shortcuts.

**Sprint goal:** a user can enter through the authorized account path, establish or restore a Supabase session, be routed to the correct protected shell, see only the role-appropriate starting experience, and safely sign out. The shell must be a durable base for Sprint 04 project and work management, not a decorative dashboard.

## 2. Readiness record and implementation gate

Sprint 02 is closed. The Project Owner merged pull request #6 into `dev` after GitHub Actions passed. The remote `dev` tip is `ff6645589e36` (`feat(data): Sprint 02 Authoritative Data Platform, Access Controls & Live Demo Sandbox (#6)`).

The Project Owner’s closeout evidence records all of the following:

1. The S02 migration chain, generated `src/lib/database.types.ts`, bootstrap script, seed posture, and schema-contract tests are integrated together.
2. `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test`, and `npm run audit:prod` passed on the integrated work; the reported unit/contract result was 60 tests across 14 suites and the production dependency audit reported no high or critical vulnerabilities.
3. The local secret boundary was preserved: `.env.local` was not inspected, printed, or committed, and the tracked credential-exposure guard passed.
4. `jsf-pm-dev` contains the persistent reference corpus and the separately mutable `Acme Sandbox Campaign` after the approved local bootstrap.

No Sprint 02 check is rerun as part of this planning update. Before Sprint 03 implementation starts, inspect the integrated `dev` tip only to establish the implementation baseline and confirm the applicable generated types remain synchronized with its committed migration chain. Sprint 03 must not compensate for incomplete database work with mock roles, hand-authored types, local schema changes, or a second authorization system.

## 3. Authorities and non-negotiable constraints

Implementation must follow, in order: direct Project Owner decisions; accepted ADRs; the deployed and versioned S02 data boundary; the repository API contract; current repository rules; and the JSF wiki pages `identity-rbac-and-onboarding`, `frontend-implementation-architecture`, `backend-api-and-workflow-architecture`, `security-and-compliance`, `localized-public-shell-i18n`, `quality-delivery-and-roadmap`, and `product-overview`.

- Application roles remain `admin`, `pm`, `operator`, and `client`. Project capacities are not substitute application roles.
- The authoritative application role is `profiles.role`, resolved server-side after session validation. Auth metadata, URL parameters, form values, browser state, and route names cannot grant authority.
- There is no public signup and no role-selection UI. Invitation redemption is opaque-token, recipient-email-bound, revocable, expiring, and single-use; raw invitation tokens are never stored or logged.
- Browser and server access use `@supabase/ssr`. Privileged access remains narrowly server-only. No secret enters browser code, logs, errors, tests, or repository files.
- Protected unsafe operations retain same-origin Origin/Host validation, Zod validation, safe non-leaking errors, and request-bound actor identity.
- The localized public route convention remains intact: Spanish public pages are unprefixed and English public pages are under `/en/`. Authenticated route localization must be explicitly designed and tested rather than inferred.
- No provider activation, public email delivery, external URL fetching, offline capability, new ORM, direct `DATABASE_URL` access, preproduction, or production work is in scope.

## 4. Broad sprint outcomes

### S03-E03-01 — Invite-only account entry and session lifecycle

**Objective:** provide a secure, comprehensible account-entry experience backed by the established Supabase and invitation boundaries.

**Scope:**

- Build localized entry screens for existing-account sign-in, password reset initiation, password update after an authorized recovery flow, and session-expired/invalid-link outcomes.
- Build invitation redemption and first-account setup only through the established invitation command boundary. Validate the opaque token at the server boundary; never expose invitation role or project context before trusted redemption succeeds.
- Enforce the approved password policy in UI validation and server validation with equivalent user-safe feedback. Do not create duplicate policy logic that can drift.
- Permit magic-link requests only for existing accounts. Make confirmation messages account-enumeration-safe and rate-limit-aware.
- Establish a single session utility that resolves the authenticated user, profile state, and authoritative application role for server components, route handlers, and protected layouts.
- Support safe sign-out, expired sessions, missing/inactive profiles, invitation replay/revocation/expiry, wrong-recipient redemption, and malformed or absent tokens without leaking internal state.

**Acceptance focus:** authorized development personas can sign in and sign out; a valid invitation can establish the intended account path; invalid or replayed invitation attempts fail safely; unauthenticated and inactive users cannot reach protected content.

**Likely implementation areas:**

- `src/app/[locale]/...` for localized account-entry and recovery pages.
- `src/app/...` for protected route groups and session callback handling, subject to the adopted routing design.
- `src/lib/supabase/server.ts`, `src/lib/supabase/browser.ts`, and new narrowly scoped auth/session modules.
- `src/lib/validation/...` for shared Zod schemas.
- `src/proxy.ts` only if required for request-time session refresh or safe redirects.
- Focused authentication, invitation, session, and localization tests under `__tests__/`.

### S03-E03-02 — Role-safe protected shell and navigation

**Objective:** establish the production-shaped authenticated shell that routes each user to the correct starting workspace while preserving database-side enforcement.

**Scope:**

- Create a mobile-first protected application layout with accessible global navigation, current-user affordance, sign-out control, loading behavior, empty states, and safe error boundaries.
- Define explicit role landing routes for Admin, PM, Operator, and Client. The initial pages may be intentionally narrow, but each must identify the user’s permitted starting context without claiming data that has not been implemented.
- Implement server-side route guards and deterministic redirects for unauthenticated, inactive, unknown-role, and unauthorized-role requests. Client-side navigation may improve usability but cannot be the access boundary.
- Establish typed, role-safe shell data reads using the S02 generated types and permitted views/tables. Do not use broad base-table reads merely to populate navigation or badges.
- Provide a bounded in-app representation for notification availability. External delivery remains suppressed; the UI must not claim that a message was sent externally.
- Preserve the public shell, public locale routing, privacy route, error handling, and metadata behavior established in Sprint 01.

**Acceptance focus:** deep links cannot bypass role routing; each valid persona reaches a role-appropriate, responsive, localized shell; unauthorized routes are denied or redirected safely; the shell contains no client-supplied authorization decision and no sensitive cross-role data.

**Likely implementation areas:**

- New protected route-group layouts and route-local `_components/` under `src/app/`.
- Shared shell primitives under `src/components/shared/` and shadcn primitives only under `src/components/ui/`.
- Typed server query modules under `src/lib/` or a clearly scoped data-access boundary.
- Locale catalogs in `messages/en-US.json` and `messages/es-MX.json` with parity and semantic-key coverage.
- Route, role-guard, accessibility, responsive-layout, and message-catalog tests.

### S03-E03-03 — Usable localhost demonstration access and verification

**Objective:** make the persistent development corpus demonstrable through the application while proving the identity and shell boundary with focused automated and manual evidence.

**Scope:**

- Document and implement a development-only, explicitly bounded persona-access path that lets the Project Owner demonstrate the seeded Admin, PM Lead, PM Watcher, Operator, and Client experiences without weakening production authorization. It must be unavailable outside local development and must not reveal or manufacture credentials.
- Keep reference records read-only during routine inspection and direct normal successful demonstrations to the existing interactive sandbox.
- Add focused negative tests for public-signup absence, token handling, invitation replay/expiry/wrong-recipient denial, password-policy enforcement, account-enumeration-safe responses, session expiry, inactive profile rejection, role-route isolation, and secret/token non-exposure.
- Add focused positive tests for authenticated role routing, locale behavior, sign-out, accessible keyboard operation, and mobile touch-target/navigation behavior.
- Run the full repository verification suite on the completed feature branch. Perform documented localhost manual journeys for all five demonstration capacities, including at least one denied deep-link attempt per role and one normal sandbox entry path.
- Record reproducible verification evidence in ordinary repository documentation. State precisely which checks are static, automated application behavior, or manual localhost journeys; do not represent them as provider, production, or exhaustive live-security proof.

**Acceptance focus:** the Project Owner can use the localhost app to enter every persona’s intended shell, demonstrate isolation and controlled denial behavior, and transition to Sprint 04 without inventing temporary access controls.

**Likely implementation areas:**

- Existing `scripts/bootstrap-dev-demo-data.ts` only if an integration adjustment is necessary; preserve its non-secret contract and keep files within repository size limits.
- New focused tests under `__tests__/auth/`, `__tests__/app-shell/`, and `__tests__/i18n/`.
- A concise repository verification note under `dev-docs/specs/s03/` or an equivalent stable documentation location.

## 5. Delivery sequence

1. **Design review:** reconcile the account-entry routes, callback/redirect behavior, session utility contract, and protected-route topology with the repository API contract and the current S02 generated database types. Stop on an authority conflict.
2. **Test contract:** establish failing focused tests for the account-entry, session, invitation, route-isolation, localization, and accessibility behaviors. Include named verification criteria where an accepted source provides them.
3. **Session foundation:** implement the smallest server-authoritative session/profile/role resolver and protected-layout guard that makes the failing access tests pass.
4. **Account entry:** implement sign-in, recovery, password-update, invitation-redemption, and safe failure paths. Keep external delivery interfaces suppressed and accurately represented.
5. **Application shell:** implement role landing pages, responsive navigation, empty/loading/error states, and typed permitted shell reads.
6. **Demo readiness:** add the strictly development-only persona entry mechanism or documented equivalent, ensuring it cannot be enabled by a browser-supplied flag or deployed as a public backdoor.
7. **Hardening:** complete negative-path, accessibility, locale-parity, and secret-exposure tests; perform the documented manual localhost role journeys against the appropriate reference or sandbox records.
8. **Integration evidence:** run the complete verification suite and provide a factual handoff listing changed files, tests, exact command results, manual journey outcomes, localization/accessibility impact, known limitations, and deferred work.

## 6. Definition of done

Sprint 03 is complete only when all of the following are true on the integrated `dev` tip:

- No unauthenticated user can obtain protected application data or content.
- No public-signup or browser-selectable role path exists.
- Invitation tokens remain opaque, recipient-bound, revocable, expiring, single-use, hash-only at rest, and absent from logs, telemetry, test fixtures, and safe error responses.
- Existing-account sign-in, recovery, session refresh, sign-out, expiry, and inactive-profile behavior are deterministic and safely localized.
- Every valid role reaches its approved protected landing shell; every invalid role-route combination is denied or redirected server-side.
- The application reads role authority from the established server/database boundary and does not duplicate authorization policy in the client.
- The protected shell is keyboard-operable, screen-reader labeled, responsive at mobile widths, and keeps public locale behavior intact.
- The localhost demonstration flow supports the seeded personas without weakening hosted behavior, and separates reference inspection from sandbox mutation.
- `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test`, `npm run test:coverage`, and `npm run audit:prod` pass. Applicable manual localhost journeys are recorded with exact persona, route, expected result, and observed result.
- No provider is activated and no preproduction or production environment is changed.

## 7. Explicit exclusions

- PM project creation, project membership management, task forms, Kanban, project completion, collaboration UI, and project workspace workflows belong to Sprint 04.
- Production deliverable authoring/review UI, operator agenda execution, client submission workspace, provider delivery workers, webhooks, calendar/archive/metrics, and admin operational screens remain later work.
- Provider activation, public email delivery, production telemetry, deployment, legal publication, backup/recovery operations, and offline features remain deferred.

## 8. Stop conditions

| Discovery | Required response |
| --- | --- |
| The integrated S02 migration chain and generated types are discovered out of sync | Stop the affected implementation and reconcile the committed baseline before proceeding. |
| The database, API contract, accepted decision, or repository rule conflicts on invitation, password, session, role, or route behavior | Stop the affected work and request a Project Owner decision. |
| A required flow needs public signup, a privileged browser client, direct SQL, a schema alteration, provider activation, or an undocumented public interface | Stop and create a scoped decision or successor item; do not weaken the boundary. |
| A test exposes an authorization, token, secret-exposure, open-redirect, cross-role isolation, or unsafe error defect | Block integration until remediated and re-verified. |
| A localhost persona flow depends on exposing a credential or permanently bypassing normal authentication | Reject the approach and use a development-only, server-controlled alternative. |

## 9. Immediate successor

Sprint 04 should deliver E4 Project and Work Management on this authenticated shell: PM project creation and membership management, role-safe project workspace reads, task lifecycle interaction, and sandbox-backed demonstration journeys. It must consume the established identity/session boundary and S02 constrained data commands rather than rebuilding either.
