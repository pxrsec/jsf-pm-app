---
document_id: S10-02-R1-INVITATION-COMPLETION-AND-DIRECT-CLIENT-PROJECT-UX-IMPLEMENTATION-SPEC-01
sprint_id: S10
work_items: [S10-02-R1]
parent_work_items: [S10-01, S10-02]
status: implementation-ready-after-applied-baseline
updated_at: 2026-09-01T12:00:00-06:00
target_environment: jsf-pm-dev
schema_baseline:
  - supabase/migrations/20260830110000_s10-direct-client-identity-and-invitation-administration.sql
  - supabase/migrations/20260831100000_s10-02-ordinary-invitation-lifecycle.sql
  - supabase/migrations/20260831114500_s10-association-projection-and-direct-contact-enforcement.sql
  - supabase/migrations/20260831123000_s10-association-projection-integrity-and-invitation-list-index.sql
  - supabase/migrations/20260831153000_s10-active-project-command-enforcement.sql
  - supabase/migrations/20260901120000_s10-02-r1-invitation-completion-profile-authority.sql
generated_types: src/lib/database.types.ts
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
3. Rechecks active non-deleted/non-archived project eligibility when the invitation carries a project.
4. Rechecks exact Client-contact binding and direct-association/organization-match requirements for Client invitations.
5. Creates or reactivates the profile with invitee-owned fields.
6. For Client invitations, links and updates exactly the accepted contact’s full name and phone while preserving its pre-bound email.
7. Creates a project member only for a project-scoped invitation.
8. Marks the invitation accepted and records a non-PII audit event.

The command returns only `{ success, role, project_id, client_id }`. It must not return email, phone, full name, token, hash, contact record, audit payload, or arbitrary URL.

### 4.2 Consent rule

`profiles_whatsapp_consent_ck` permits `whatsapp_opt_in = true` only with consent timestamp and source. It no longer requires an application-to-database connection address to masquerade as a user IP.

No application code may directly update `profiles` after completion. In particular, remove the current post-RPC direct profile update from the completion API route.

### 4.3 Existing project/contact commands reused without a migration

The project-workspace UX must consume existing trusted primitives only:

| Need | Existing trusted boundary |
| --- | --- |
| List management contacts | `list_client_contacts_for_administration` through a server-only adapter; UI receives a minimized direct-contact DTO only. |
| Read current direct association | `list_project_client_contact_associations` through a server-only adapter or existing server action; never read `project_client_contacts` directly. |
| Associate/disassociate exact direct contact | `set_project_client_contact(projectId, contactId, associated)` through `setProjectClientContactAction`. |
| Set/clear optional organization | Existing role-authorized `updateProjectAction` and `UpdateProjectSchema`; never use an organization as a membership shortcut. |
| Create Client invite | Existing `create_ordinary_invitation` action, only after association is successful for a direct contact. |

No S10-02-R1 database command may create membership merely because an organization or contact is selected.

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

### 7.1 Authority and placement

Add one localized **Client identity** action/surface to the Admin and PM project workspace for active non-archived Client projects. It is available to `actorRole === 'admin' || actorRole === 'pm'`; it must not use project membership capacity as an authorization gate. In particular, a globally authorized PM must not lose this management control merely because the current workspace derives `pm_watcher` metadata.

Do not render this surface for Operator or Client routes. Do not expose its contact directory data to either role.

Place the action adjacent to existing project management actions or in the project Overview surface. It must not add a new workspace tab or put management state in the URL.

### 7.2 Client identity modes

The dialog/sheet presents one selected mode at a time:

| Mode | Display | Save behavior |
| --- | --- | --- |
| Organization | Existing active organization selector | Save the selected organization through the existing authorized project update path; clear no direct association automatically. |
| Direct contact | Existing active direct-contact selector, showing only name and linked-account state | On explicit save, call the trusted association action. The organization field remains null for a direct project. |
| No identity yet | Planning-only state | Clear optional organization through the existing project update path; do not create an association, invitation, member, or account. |

A project must never have its organization silently inferred from a direct contact. An organization contact is never selectable in Direct contact mode. A direct contact is never silently converted into an organization contact.

### 7.3 Direct-contact association behavior

- Load only current active direct contacts through an Admin/PM server-authorized minimized DTO: `{ id, fullName, profileId }` or equivalent no-email display shape.
- Load existing direct association IDs through the trusted association projection. Treat an unavailable projection as unavailable; never misrepresent it as no association.
- A selected direct contact can be associated only by an explicit user action. The existing trusted RPC enforces Client project, active/non-archived project, active direct contact, and Admin/PM authority.
- If changing direct contact, require a localized confirmation before disassociating another currently associated direct contact. Do not delete contacts or members.
- If a project has an organization and a direct contact becomes selected, require an explicit organization-clearing save action. Do not leave a misleading combined identity state.
- Association success refreshes only relevant workspace state. Failure retains the selected input and reports a safe localized error.

### 7.4 Explicit invitation action

When the selected associated direct contact has no linked profile, show an explicit **Invite client** action after successful association. It opens/reuses the existing ordinary invitation dialog preconfigured to:

```ts
{ role: 'client', contactId, projectId }
```

The action must retain the existing invitation behavior:

- Exact contact only; no free-form Client email.
- Explicit selected project only; no implicit project inferred outside this direct-contact flow.
- Existing expiry range and one-time copy-link behavior.
- No raw URL/token persistence, rendering, or later recovery.
- No membership creation until accepted trusted completion.

When the selected direct contact already has a linked active Client profile, show a clear localized state. The existing explicit Add Member flow may be used to add that eligible account; do not auto-add it from identity selection.

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
src/lib/invitations/actions.ts
src/components/shared/client-administration/invitations-panel.tsx
src/components/shared/projects/project-workspace/project-workspace-shell.tsx
src/components/shared/projects/project-workspace/project-header.tsx
src/components/shared/projects/project-workspace/project-overview-tab.tsx
src/components/shared/projects/project-workspace/<new-client-identity-component>.tsx
src/app/[locale]/(protected)/admin/proyectos/[id]/page.tsx
src/app/[locale]/(protected)/pm/proyectos/[id]/page.tsx
messages/en-US.json
messages/es-MX.json
__tests__/auth/complete-invite.test.ts
__tests__/auth/negative-path.test.ts
__tests__/auth/validation.test.ts
__tests__/clients/clients-administration.test.ts
__tests__/projects/direct-client-member-eligibility.test.ts
```

This list identifies likely touched surfaces, not permission for opportunistic refactors. Keep new feature components route-local or in the established project-workspace shared directory; do not put server-only Supabase code in a client component.

### 8.1 Server-only adapters

- Query modules begin with `import "server-only"`; action modules begin with `"use server"`.
- Add a narrowly mapped direct-contact selection adapter if needed. It receives authorized management contacts only on the server and returns a minimized DTO without email, phone, job title, organization details, token material, or broad profile fields.
- The Admin/PM project pages load the minimized direct contacts only after resolving session and explicitly authorizing role. They pass no raw database rows to client components.
- Actions independently call `requireSession`, require Admin/PM before input handling, validate strict UUID/unknown-key rules, use only trusted command/RPC boundaries, and revalidate the locale route trees after successful mutation.

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
10. Project identity selectors exclude deleted/archived projects and deleted contacts. Direct association rejects organization contacts at the database boundary.
11. Consent source/timestamp must be truthful. Do not write guessed user IP addresses.
12. Errors fail closed and distinguish no internal reason to the browser.

## 10. Focused verification

Run only focused changed checks plus repository lint/typecheck:

```text
npm run lint
npm run typecheck
npm run test -- __tests__/auth/complete-invite.test.ts
npm run test -- __tests__/auth/negative-path.test.ts
npm run test -- __tests__/auth/validation.test.ts
npm run test -- <focused changed project/workspace test files>
```

Do not add provider, production, E2E, coverage, broad full-suite, or unrelated regression work.

### 10.1 Required automated assertions

1. Proxy/middleware route behavior leaves `/api/v1/auth/invites/complete` non-localized and does not produce `/en/api/...`.
2. Strict completion input rejects unknown keys, malformed token, invalid name, malformed E.164 phone, null preference, and every password policy deficiency.
3. Password special-symbol feedback names the exact allowed set through localization, not raw validation text.
4. Completion invokes the four-argument RPC and never directly updates `profiles` after it.
5. Fixed invite email is used for Auth creation; no request email field is accepted.
6. RPC failure after new Auth user creation invokes bounded deletion compensation exactly once; successful completion never invokes it.
7. Safe responses contain no raw token/hash, email, phone, password, SQL/RPC message, compensation detail, or arbitrary redirect URL.
8. Client completion uses name/phone/preference arguments; Operator completion uses the same profile contract without a contact update path.
9. A pre-existing profile, including an existing Client or Operator, is rejected by trusted completion; it cannot have its role reassigned or gain another membership capacity.
10. Direct-contact workspace DTO contains no contact email/phone/token data; organization contacts are unavailable for direct association.
11. Direct association invokes the trusted action only; selecting a contact does not invoke project-member creation.
12. Explicit Client invitation is available only after association and uses exact contact plus explicit project ID.
13. Admin and PM can access the control regardless of PM membership capacity; Operator and Client cannot.
14. English/Mexican Spanish key parity covers every added namespace.

### 10.2 Required manual `jsf-pm-dev` journeys

1. From default Spanish and `/en` invitation pages, redeem a valid project-scoped Client invite. Confirm no `/en/api` request/404 occurs, the accepted Client profile/contact has the invitee name/phone/preference, and membership exists only after acceptance.
2. Redeem a global Operator invite. Confirm the fixed email creates the account, invitee values persist on profile, and no client contact/member is created.
3. Test terminal expired/revoked/used links and malformed form values. Confirm safe localized messaging and no raw reason/token disclosure.
4. Simulate or use a controlled failure after Auth user creation and before/at RPC completion. Confirm the newly created user is removed when bounded compensation succeeds and the invitation is not falsely shown accepted.
5. Create a planning Client project with no organization. From its workspace, select and associate a direct contact, then create/copy a Client invitation. Confirm association itself creates no member/access.
6. Accept that invite and confirm the Client member becomes eligible only after accepted completion. Confirm direct readiness works without organization.
7. Select an organization path and confirm it is optional metadata; organization contacts cannot appear in direct-association controls.
8. Verify Admin and global PM journeys; a PM without project membership and a PM with `pm_watcher` metadata still has the management control. Verify Operator/Client denial.
9. Verify keyboard dialog behavior, focus restoration, one-time link clearing, narrow responsive layout, and English/Mexican Spanish parity.

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
