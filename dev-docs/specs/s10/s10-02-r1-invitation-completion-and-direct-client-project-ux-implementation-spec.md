---
document_id: S10-02-R1-INVITATION-COMPLETION-AND-DIRECT-CLIENT-PROJECT-UX-IMPLEMENTATION-SPEC-01
sprint_id: S10
work_items: [S10-02-R1]
parent_work_items: [S10-01, S10-02]
status: implementation-ready-baseline-applied
updated_at: 2026-09-01T13:00:00-06:00
target_environment: jsf-pm-dev
schema_baseline:
  - supabase/migrations/20260830110000_s10-direct-client-identity-and-invitation-administration.sql
  - supabase/migrations/20260831100000_s10-02-ordinary-invitation-lifecycle.sql
  - supabase/migrations/20260831114500_s10-association-projection-and-direct-contact-enforcement.sql
  - supabase/migrations/20260831123000_s10-association-projection-integrity-and-invitation-list-index.sql
  - supabase/migrations/20260831153000_s10-active-project-command-enforcement.sql
  - supabase/migrations/20260901120000_s10-02-r1-invitation-completion-profile-authority.sql
  - supabase/migrations/20260901130000_s10-02-r1-cancelled-project-command-enforcement.sql
generated_types: src/lib/database.types.ts
implementation_prerequisite: Apply the final migration to jsf-pm-dev and regenerate src/lib/database.types.ts unchanged before implementation planning or code changes.
---

# S10-02-R1 — Invitation Completion and Direct-Client Project UX

## 1. Scope, authority, and outcome

This specification is the complete implementation authority for **S10-02-R1 only**. It refines the completed S10-01/S10-02 slice at the invitation-completion and Admin/PM project-workspace boundaries. It does not reopen unrelated S10 work.

### Outcome

1. An ordinary Client or Operator invitation can be redeemed successfully through the canonical non-localized API route from either locale.
2. Invitation email remains immutable, pre-bound, and authoritative for identity and future email delivery. The invitee does not edit or confirm email.
3. The invitee supplies the authoritative full name, optional E.164 phone number, password, and WhatsApp preference. Client completion converges the exact linked contact and profile values; Operator completion updates only the profile.
4. WhatsApp consent preference is persisted with truthful timestamp/source evidence while all provider delivery remains disabled.
5. Admin and PM can manage an existing Client project’s identity from its workspace: optional organization, exact direct contact, or no client identity while planning. Direct-contact association and invitation are explicit; neither creates membership implicitly.
6. All work is localized, role-safe, accessible, narrowly tested, and compatible with the applied S10 readiness invariants.

## 2. Controlling product decisions

| Decision | Binding implementation rule |
| --- | --- |
| Invitation email authority | The Client contact email or Operator recipient email entered by Admin/PM is the fixed invitation email. It is never editable by the invitee, never copied into an editable client field, and remains the exact `auth.users.email` match required by trusted completion. |
| Invitee ownership | The invitee owns full name, phone number, password, and WhatsApp notification preference at redemption. For Client invitations, the accepted values become the linked `profiles` and exact `client_contacts` values; the email remains unchanged. |
| Consent evidence | A true WhatsApp preference records `whatsapp_consent_at` and `whatsapp_consent_source = 'invitation'`. No fabricated end-user IP address is stored. Existing source-less true records are labelled `legacy` by the migration. |
| Direct client identity | A direct contact is a person record, not a membership. A project-contact association is readiness metadata, not authorization. |
| Membership | Membership is created only by trusted acceptance of a project-scoped invitation, or by the existing explicit member-management command for an already-authenticated eligible account. No workspace identity selection or association can create a member. |
| Provider boundary | No Resend, WhatsApp, SMS, scheduler, queue, external dispatch, provider secret, or public-signup work is included. Copy-link Model A remains the delivery mechanism. |

## 3. Explicit exclusions

Do not implement or alter:

- S10-03 through S10-06 behavior, migrations, specifications, recycle-bin work, permanent deletion, user deactivation, stale reminders, bug triage, legal routes, task detail, calendar navigation, or provider activation.
- Editable invitation email, public registration, email verification dispatch, provider delivery, invitation-token recovery, token display, or raw token/hash logging.
- Admin/PM invitation roles, arbitrary role assignment, browser role changes, direct `invite_tokens` reads/writes from browser code, direct `project_client_contacts` browser reads/writes, or service-role browser access.
- Contact/organization creation inside the project workspace. The existing `/admin/clientes` and `/pm/clientes` management surfaces own contact creation/editing.
- A new project-creation transaction that attempts to combine project creation, direct association, invitation, and membership. Planning projects may intentionally exist before client identity is bound.

## 4. Applied database contract

### 4.1 Trusted completion command

The applied refinement migration replaces the old command with:

```sql
public.accept_invite(
  p_token_hash bytea,
  p_full_name text,
  p_phone_e164 text,
  p_whatsapp_opt_in boolean
) returns jsonb
```

The command is executable only by `authenticated`, runs as `SECURITY DEFINER` with `search_path = pg_catalog, public`, and must remain the only database command that finalizes ordinary invitation acceptance.

The command atomically:

1. Validates the authenticated caller, opaque hash, pending/unrevoked/unexpired invitation state, ordinary role, and exact pre-bound email match.
2. Validates name `1..120` trimmed characters, optional phone as `^\+[1-9][0-9]{7,14}$`, and non-null boolean preference.
3. Rechecks active non-deleted/non-archived/non-cancelled project eligibility when the invitation carries a project.
4. Rechecks exact Client-contact binding and direct-association/organization-match requirements for Client invitations.
5. Creates a new active profile with invitee-owned fields; a pre-existing profile is rejected.
6. For Client invitations, links and updates exactly the accepted contact’s full name and phone while preserving its pre-bound email.
7. Creates a project member only for a project-scoped invitation.
8. Marks the invitation accepted and records a non-PII audit event.

The command returns only `{ success, role, project_id, client_id }`. It must not return email, phone, full name, token, hash, contact record, audit payload, or arbitrary URL.

### 4.2 Consent rule

`profiles_whatsapp_consent_ck` permits `whatsapp_opt_in = true` only with consent timestamp and source. It no longer requires an application-to-database connection address to masquerade as a user IP.

No application code may directly update `profiles` after completion. In particular, remove the current post-RPC direct profile update from the completion API route.

### 4.3 Final applied project/contact contract

The final baseline migration `20260901130000_s10-02-r1-cancelled-project-command-enforcement.sql` is required before application work. It changes no RPC signature or return shape, but makes every relevant trusted command reject cancelled projects. `planning`, `in_progress`, `paused`, and `completed` remain eligible when not deleted or archived; only `cancelled` is inactive for this slice.

The project-workspace UX must consume these existing trusted primitives only:

| Need | Trusted boundary and non-negotiable behavior |
| --- | --- |
| List management contacts | `list_client_contacts_for_administration` through a server-only adapter. The adapter maps **only active direct contacts** to `{ id, fullName, profileId }`; it never passes the broad administration DTO or email/phone/job title/client/timestamps to workspace UI. |
| Read current direct association | `list_project_client_contact_associations` through a server-only adapter or action. It returns IDs only and rejects deleted, archived, cancelled, non-Client, or unauthorized project scope. An unavailable projection is not an empty association. |
| Associate/disassociate exact direct contact | `set_project_client_contact(projectId, contactId, associated)` through `setProjectClientContactAction`. It rejects deleted, archived, cancelled, non-Client projects, organization contacts on association, and unauthorized callers. It does not create a membership. |
| Set/clear optional organization | A hardened, role-authorized, strict project identity update action over `updateProjectAction`/`UpdateProjectSchema`; it must return safe codes, never raw command messages, and must preserve the database readiness constraint. |
| Create/rotate Client invite | `create_ordinary_invitation` / existing action only after the direct association succeeds. The resolver used by create and rotate rejects deleted, archived, cancelled, or invalid project context. |
| Complete project-scoped invite | Four-argument `accept_invite`; it rechecks deleted/archived/cancelled project state before any membership creation. |

No S10-02-R1 database command may create membership merely because an organization or contact is selected. No browser code may read/write `project_client_contacts` or call an RPC directly.

## 5. API and routing contract

### 5.1 Canonical completion endpoint

The only completion endpoint remains:

```text
POST /api/v1/auth/invites/complete
```

It is **not locale-prefixed**. Update `src/proxy.ts` so `/api/:path*` bypasses `next-intl` routing while existing locale and session behavior for application pages remains unchanged. Do not add `/en/api/...`, `/es-MX/api/...`, route aliases, or duplicate handlers.

A request from `/en/invitacion?...` must reach `/api/v1/auth/invites/complete` exactly. The same must hold from the default Spanish invitation route.

### 5.2 Request contract

The request body is a strict object with no unknown keys:

```ts
type CompleteInviteRequest = {
  token: string;                    // opaque 43..128 chars
  full_name: string;                // trimmed 1..120
  phone_e164: string | null;        // null or /^\+[1-9][0-9]{7,14}$/
  password: string;                 // 12..128, lower, upper, digit, allowed symbol
  whatsapp_opt_in: boolean;
};
```

The allowed password symbols are exactly:

```text
! @ # $ % ^ & * ( ) _ + - = [ ] { } ; ' : " \ | , . < > / ?
```

Use the same validation semantics on client and server, but do not surface raw Zod text. Server responses contain safe error codes/field keys; localized UI maps those to messages.

Required headers:

- `Content-Type: application/json`
- Same-origin `Origin` validation remains in effect.

### 5.3 Completion route sequence

`src/app/api/v1/auth/invites/complete/route.ts` must perform this sequence:

1. Generate request ID; validate origin, JSON, and strict request object.
2. Hash the token server-side. Never log token, hash, raw request body, password, email, phone, full name, or built invitation URL.
3. Use the server-only admin client solely to resolve the minimal pending invitation context needed to create the Auth identity: fixed email, role, status, expiry, revocation. Return the existing generic terminal result for absent/terminal state.
4. Create the Auth user using only the fixed invitation email, supplied password, `email_confirm: true`, and supplied full name metadata. No user-supplied email field exists.
5. Establish the authenticated server session for that newly created identity.
6. Invoke the four-argument `accept_invite` RPC with hash, full name, nullable phone, and preference.
7. Validate the returned JSON shape and ordinary role before deriving the role-default redirect. Do not trust an arbitrary returned URL.
8. Return a safe `201` response with a localized-router-compatible relative redirect path and no user email, phone, token, contact ID, audit data, or raw provider error.

### 5.4 Cross-system failure compensation

Supabase Auth user creation and PostgreSQL RPC completion are separate systems and cannot be one database transaction. The route therefore must preserve this exact failure discipline:

- Before the Auth user exists, return safe validation/terminal/unavailable responses only.
- If Auth user creation succeeds but session establishment or `accept_invite` fails, call `admin.auth.admin.deleteUser(createdUserId)` as bounded compensation **only for the user created by this request**.
- Never delete an existing user, never delete a user after successful trusted completion, and never expose the compensation error to the browser.
- If compensation itself fails, log only request ID and safe operation category; return a safe unavailable response. The invitation must not be represented as successfully consumed.
- The route must not use an Auth-user-exists error as a substitute for invite acceptance. It returns a safe conflict only when the pre-bound email already has an account before this request.

This is compensating behavior, not a claim of cross-system atomicity.

## 6. Invitation form contract

### 6.1 Visible fields and information

The public invitation form contains exactly:

1. Full name — required, `autocomplete="name"`.
2. Phone — optional E.164, `autocomplete="tel"`, with localized format help.
3. Password — required, `autocomplete="new-password"`, show/hide control with localized accessible label.
4. WhatsApp opt-in checkbox.
5. Submit and existing sign-in path.

Do not render editable email or confirm-email fields. Do not render the pre-bound email, raw token, full invitation URL, contact ID, project ID, invitation role, or server error detail in visible, hidden, data-attribute, title, aria-description, toast, or telemetry content.

The page may use localized neutral text explaining that the invitation is tied to its original recipient email without revealing that address.

### 6.2 Password feedback

Provide a localized password-policy aid before submission and localized field feedback after validation. The special-symbol requirement must list the exact allowed symbols from §5.2. The complete policy is length 12–128, lower-case, upper-case, digit, and one allowed symbol.

Client validation may fail fast. Server validation remains mandatory and uses the same constraints. On a validation error, retain entered non-secret name/phone/preference and focus the relevant field. Do not retain, redisplay, log, or expose the password.

### 6.3 Submission and terminal states

- Disable the submit control only for the in-flight request.
- On `201`, navigate once using the locale-aware router and returned allowlisted relative path.
- On terminal invitation response, route to the existing localized expired/invalid session surface. Do not disclose whether the token was absent, used, revoked, expired, contact-mismatched, or project-invalid.
- On conflict or unavailable response, retain non-secret user input, return focus to the form alert, and show localized safe recovery guidance.
- Preserve keyboard interaction, focus restoration, color-independent error/status communication, and responsive one-column layout.

## 7. Admin/PM project-workspace client identity UX

### 7.1 Authority, eligibility, and placement

Add one localized **Client identity** action/surface to Admin and PM project workspaces only when all are true: `project_type === 'client'`, `deleted_at === null`, `archived_at === null`, and `status !== 'cancelled'`. It is available solely from `actorRole === 'admin' || actorRole === 'pm'`; project membership capacity is never an authorization gate. A globally authorized PM retains this control with no membership or `pm_watcher` metadata.

Do not render or server-load this surface for Operator or Client routes. Do not expose its direct-contact directory or association IDs to either role. Do not add a workspace tab or place identity-management state in the URL; place the trigger next to existing project management actions or in Overview.

### 7.2 Client identity modes and readiness

The dialog/sheet presents one selected mode at a time:

| Mode | Display | Explicit save behavior |
| --- | --- | --- |
| Organization | Existing active organization selector | Set the selected organization through the hardened identity update action. It does not alter a direct association. |
| Direct contact | Existing active direct-contact selector, displaying only full name and linked-account state | On save, require organization clearing in the same explicit identity save when an organization is set. Then perform the trusted association sequence below. |
| No identity yet | Planning-only state | Render and permit this option only while `project.status === 'planning'`; clear optional organization through the hardened identity update action. It must not create an association, invitation, member, or account. |

A project must never silently infer organization from a direct contact, convert a direct contact into an organization contact, or remain non-planning/non-cancelled without database-enforced Client readiness. The UI may prevent invalid planning transitions but must not reimplement or weaken trusted readiness checks.

### 7.3 Direct-contact association, replacement, and cache behavior

- Server-load only the minimized direct-contact DTO `{ id, fullName, profileId }` after session resolution and explicit Admin/PM authorization. Filter `clientId === null` before the DTO leaves the server. Email, phone, job title, organization, timestamps, raw rows, and broad profile fields never reach the component.
- Server-load association IDs only through the trusted projection. An unavailable response displays unavailable state and blocks identity mutation; it is never rendered as “no direct contact.”
- Selection alone does nothing. Save uses `setProjectClientContactAction` only; the RPC enforces active non-cancelled Client project, active direct contact, and Admin/PM authority.
- When replacing associated contact(s), display localized confirmation before mutation. On confirmation, disassociate every currently associated non-selected direct contact one at a time, then associate the selected contact. The RPC is pairwise, not an atomic replacement command; retain selection and report a localized safe failure if any step fails. Do not delete contacts or members.
- A direct save against a project with organization must require explicit organization clearing first. Do not leave a combined identity state. Do not offer identity mutation for cancelled projects even if their workspace route remains reachable for historical viewing.
- Successful identity mutation revalidates the exact Admin and PM project-detail locale paths and refreshes only the current workspace; read-only loaders never revalidate.

### 7.4 Explicit invitation action and one-time token lifetime

When the successfully associated selected direct contact has no linked profile, display an explicit **Invite client** action. Reuse the existing invitation infrastructure only through a constrained Client-project mode: fixed `{ role: 'client', contactId, projectId }`, no role selector, no contact directory, no recipient-email input, and no project selector. It may display the minimized contact name but not email. It retains the existing expiry range and invokes `createOrdinaryInvitationAction` only after association success.

Reuse `InvitationCopyDialog` for the one-time URL. The raw URL/token is response-local transient state only: copy-only UI; no text rendering, DOM/data attributes, storage, logs, telemetry, query state, or recovery. Clear it on every close, unmount, navigation, and before `router.refresh`; do not refresh the route while it is the only copy opportunity.

No membership is created until trusted completion. If the selected associated direct contact already has a linked active Client profile, show localized state only; the established Add Member flow remains separately explicit and is never invoked from identity selection.

### 7.5 Project creation handoff

Project creation continues to permit Client projects with `client_id = null`. Do not add a combined project-creation/database transaction in this refinement.

After creation, the workspace Client identity action provides the direct-contact association or organization selection journey. The project may remain planning without identity; transition/readiness constraints remain database-enforced for non-planning, non-cancelled Client projects.

## 8. Required application boundaries and file scope

Implementation must inspect the actual current files and preserve current repository conventions. Expected files include:

```text
src/proxy.ts
src/lib/validation/auth.ts
src/app/api/v1/auth/invites/complete/route.ts
src/app/[locale]/invitacion/_components/invitation-form.tsx
src/app/[locale]/invitacion/_components/invitation-form.test.tsx
src/lib/clients/types.ts
src/lib/clients/queries.ts
src/lib/clients/actions.ts
src/lib/projects/actions.ts
src/lib/projects/schemas.ts
src/lib/invitations/actions.ts
src/components/shared/client-administration/invitation-create-dialog.tsx
src/components/shared/client-administration/invitation-copy-dialog.tsx
src/components/shared/projects/project-workspace/<new-client-identity-component>.tsx
src/components/shared/projects/project-workspace/project-workspace-shell.tsx
src/components/shared/projects/project-workspace/project-header.tsx
src/components/shared/projects/project-workspace/project-overview-tab.tsx
src/app/[locale]/(protected)/admin/proyectos/[id]/page.tsx
src/app/[locale]/(protected)/pm/proyectos/[id]/page.tsx
messages/en-US.json
messages/es-MX.json
__tests__/auth/complete-invite.test.ts
<one-focused-client-identity-test>
__tests__/database/<only-if-schema-contract-repair-is-required>.test.ts
```

This list identifies likely touched surfaces, not permission for opportunistic refactors. Keep new feature components route-local or in the established project-workspace shared directory; do not put server-only Supabase code in a client component.

### 8.1 Required server/client boundaries

- Query modules begin with `import "server-only"`; action modules begin with `"use server"`. Client components never import them.
- Add a narrow server-only direct-contact workspace adapter over `list_client_contacts_for_administration`. After Admin/PM authorization, map only active direct contacts to `{ id, fullName, profileId }`. A query/RPC error or malformed row returns `{ status: 'unavailable' }`, not `[]`.
- The Admin/PM pages load that DTO and association projection only for eligible Client workspaces. They pass no raw Supabase rows, broad administration DTOs, organization contacts, or contact email/phone to client components. The existing active organization selector remains a separate minimal server-loaded projection.
- Harden the project identity update boundary before this surface calls it: require session then Admin/PM role, strict project UUID and unknown-key validation, a strict allowlisted identity payload, safe closed result codes, and revalidation of both locale Admin/PM project-detail paths only after success. Do not expose `CommandResult.message` directly in this new UI.
- `setProjectClientContactAction` remains the association boundary. Do not add direct `project_client_contacts` reads/writes, browser RPC calls, or a new association/membership command.
- Extend `InvitationCreateDialog` only with a constrained fixed Client-project mode, or create a small wrapper that invokes the existing invitation action and `InvitationCopyDialog`; do not pass its existing broad `ClientContactAdministrationDto[]` contract into the workspace. Keep route-local orchestration in the new workspace component and reuse established dialog primitives.
- New/changed implementation files may be up to 600 lines. Do not refactor unrelated files merely to alter line count.

### 8.2 Localization

Add structurally identical English and Mexican Spanish keys for all visible, accessible, confirmation, empty, unavailable, loading, password-policy, invitation-error, client-identity, direct-contact-state, and membership-explanation strings.

No raw validation or database/provider message reaches the UI. Remove hard-coded Spanish/English labels in touched project controls. Stored roles/statuses remain English and are presentation-mapped.

## 9. Security and integrity invariants

1. A raw invitation token exists only in the request URL, immediate form request, server hash operation, and one-time post-create/rotate client state. It is never logged, persisted by browser storage, rendered, emitted in a test fixture, or included in telemetry/audit/error payloads.
2. Email remains pre-bound. The browser cannot choose an Auth, contact, or notification email during redemption.
3. `accept_invite` is the sole trusted finalization command. Completion never writes `profiles` or `client_contacts` directly from application code after invoking that command.
4. `accept_invite` accepts only an Auth identity that has no existing `profiles` row. It never changes an existing application role, reactivates an existing profile, or permits a second project membership capacity through invitation redemption.
5. The trusted completion command locks in the same resource order as ordinary invitation create/rotate: exact client contact where applicable, project where applicable, then the invitation row. Its terminal-state decision occurs only after the invitation-row lock.
6. An invitation creates no project member without an explicit project ID and successful trusted completion.
7. Project-contact association creates no membership, account, task authority, directory authority, or invitation automatically.
8. Admin and PM receive equivalent global management authority; `pm_lead`/`pm_watcher` remain metadata and cannot gate the Client identity control or its server actions.
9. Operator and Client cannot enumerate contacts, organizations, direct associations, invitation data, or profile/email directory fields through any new path.
10. Project identity selectors and every callable association/invitation/completion command reject deleted, archived, and cancelled projects. Planning stays eligible for identity setup; only a non-planning, non-cancelled Client project requires database-enforced readiness. Direct association rejects organization contacts at the database boundary.
11. Consent source/timestamp must be truthful. Do not write guessed user IP addresses.
12. Errors fail closed and disclose no internal reason to the browser.

## 10. Minimal verification

Do **not** use test-first development, broad regression expansion, coverage, E2E, provider, production, or full-suite work. Update only tests directly broken by the changed API/schema and add only the smallest focused assertions required to protect the two changed behavior boundaries.

```text
npm run lint
npm run typecheck
npm run test -- __tests__/auth/complete-invite.test.ts src/app/[locale]/invitacion/_components/invitation-form.test.tsx <one-focused-client-identity-test>
```

The focused evidence is limited to:

1. Completion sends the strict four-argument RPC payload, uses only the fixed invitation email for Auth creation, makes no post-RPC profile write, and compensates only the newly created Auth user when session/RPC completion fails.
2. The public form has no email field, uses the canonical `/api/v1/auth/invites/complete` path from both locales, maps safe server codes to localized copy, and does not surface raw validation/provider/database text.
3. The Client identity surface is available to Admin/global PM (including `pm_watcher` metadata), absent for cancelled/Operator/Client scope, receives no email/phone DTO fields, invokes only the trusted association/invitation actions after explicit save/confirmation, and never creates a member itself.

Maintain existing static schema-contract tests only where the migration’s changed `accept_invite` signature or final migration list makes them fail. Do not add a separate matrix, broad integration harness, snapshot suite, or manual test script.

After the migration is applied, the Project Owner—not the implementation agent—may perform one development-environment smoke journey: planning direct Client project → associate → copy Client invitation → complete acceptance. Report it separately if performed; it is not an implementation blocker.

## 11. Completion-report contract

The implementation report must state:

- Exact changed files and focused tests changed/added.
- The applied refinement migration and regenerated declaration provenance consumed by the work.
- Exact verification commands and factual outcomes.
- Manual `jsf-pm-dev` evidence separated from unverified hosted claims.
- Authorization, token, consent, localization, and accessibility effects.
- The compensating—not cross-system-atomic—Auth failure behavior.
- Remaining blockers, if any.

Do not claim provider delivery, production deployment, live external notification, legal approval, email ownership verification beyond the pre-bound Auth/invitation match, or database/RLS proof not actually exercised.
