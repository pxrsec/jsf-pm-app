---
document_id: S10-01-S10-02-DIRECT-CLIENT-AND-INVITATION-ADMINISTRATION-IMPLEMENTATION-SPEC-03
sprint_id: S10
work_items: [S10-01, S10-02]
status: implementation-ready-after-migration-application
updated_at: 2026-08-31T11:45:00-06:00
target_environment: jsf-pm-dev
schema_baseline:
  - supabase/migrations/20260830110000_s10-direct-client-identity-and-invitation-administration.sql
  - supabase/migrations/20260831100000_s10-02-ordinary-invitation-lifecycle.sql
  - supabase/migrations/20260831114500_s10-association-projection-and-direct-contact-enforcement.sql
generated_types: src/lib/database.types.ts
---

# S10-01 and S10-02 — Direct Client and Ordinary Invitation Administration

## 1. Scope

Implement only these two capabilities:

1. **S10-01:** Admin/PM administration of direct client contacts, optional client organizations, and client-project contact associations under the M01 readiness and global-management-authority model.
2. **S10-02:** discoverable Admin/PM contact and ordinary invitation administration using **Model A** invitation delivery.

Do not implement account deactivation, archive/recycle-bin, permanent deletion, legal pages, providers, outbound email/WhatsApp delivery, public signup, task-detail work, calendar work, or changes to historical deliverable versions.

## 2. Applied data contract

### 2.1 Domain terms

| Term | Stored model | Meaning | Does not grant or imply |
| --- | --- | --- | --- |
| Contact | `client_contacts` | A person record. `client_id` and `profile_id` are optional. | Account, organization, project membership, project visibility, task authority. |
| Organization | `clients` | Optional grouping for contacts. | A universal client identity/readiness prerequisite or access. |
| Account | `auth.users` plus `profiles` | Authenticated identity with an application role. | Contact-directory authority or membership in every project. |
| Project membership | `project_members` | Explicit project authorization relationship. | Contact administration or organization membership. |
| Project-contact association | `project_client_contacts` | Direct-contact identity/readiness metadata for one client project. | A `project_members` row, RLS visibility, task assignment, or client portal access. |
| Invitation | `invite_tokens` | Opaque, hashed, expiring, revocable, single-use onboarding authorization for an ordinary role. | Public signup, role elevation, general directory visibility. |

### 2.2 Contact invariants

1. A direct contact has `client_id IS NULL`; an organization contact has an active `client_id`.
2. A direct contact always has `is_primary = false`.
3. An active organization contact is unique by `(client_id, email)`; an active direct contact is unique by `email`; an active profile can link to only one active contact.
4. A contact remains valid when no account exists, when an account is deactivated, or when the contact later changes organization.
5. Direct-to-organization and organization-to-direct transitions update the same contact through `save_client_contact`; never delete/recreate a contact solely to change organization association.
6. Contact-directory information is an Admin/PM management surface. Operator and Client roles cannot enumerate contacts, organizations, contact-profile links, or invitation recipient information.

### 2.3 Client-project readiness invariants

1. A planning or cancelled client project may exist without a client organization, direct contact, account, or client member.
2. An active non-planning/non-cancelled client project is ready only when it contains an active `client` project member linked to either:
   - a direct contact associated with that exact project through `project_client_contacts`; or
   - an organization contact whose `client_id` equals `projects.client_id`.
3. A project-contact association alone never satisfies readiness because it does not create an account or project membership.
4. Association/disassociation uses `set_project_client_contact`; no UI path may compensate for a rejected readiness change by creating/deleting memberships or altering a profile.
5. Admin and PM are global management authorities. `pm_lead` and `pm_watcher` are project metadata, never a gate for contacts, organizations, invitations, or S10 project-selection controls.

### 2.4 Ordinary invitation invariants

1. The only ordinary invitation roles are `client` and `operator`.
2. An ordinary invite can be global (`project_id IS NULL`) or explicitly project-scoped.
3. A client invite binds one exact unlinked active `client_contacts` row through `contact_id`; recipient email is derived from that contact inside the trusted command.
4. A project-scoped client invite requires a client project and either an active direct-contact association for that project or an organization contact whose organization matches the project organization.
5. An operator invite uses a validated recipient email, has no `contact_id`, and can reference any active project selected explicitly by an authorized manager.
6. `accept_invite` validates exact recipient-email match, invitation state, role, contact eligibility, and project compatibility. It creates a project member only when that invitation explicitly carries a project.
7. No ordinary flow can create/invite Admin or PM accounts, infer a role from a membership capacity, or mutate an existing user’s role in the browser.

## 3. Model A invitation delivery

Model A is a manual, token-safe join-link workflow with no provider dispatch.

- Create and rotate commands generate a 32-byte cryptographically random URL-safe opaque token, store only `SHA-256(token)` in `invite_tokens`, and return the raw token once to the initiating authenticated Server Action.
- The Server Action builds the locale-safe invitation URL from the one-time token. The client copies that URL immediately through the browser clipboard capability.
- Raw token, hash, and join URL are never persisted in React state beyond the active result interaction, route/search state, local storage, session storage, analytics, telemetry, logs, audit payloads, list projections, or error messages.
- A pending invitation cannot be reconstructed from its hash. Therefore there is no later retrieve/copy-token RPC. If the initiating one-time result is dismissed or clipboard copy fails, **Resend** rotates the invitation and produces a new one-time link.
- Resend means token rotation only. It does not send email, WhatsApp, SMS, or any other external communication, and UI copy must never claim delivery.
- Creating another ordinary invitation for the same Client contact or Operator email supersedes every earlier pending invite for that recipient: expired rows normalize to `expired`; usable rows become `revoked`. Exactly one newly issued Model A link remains usable for that recipient.
- Rotation atomically revokes the prior pending invitation and creates a new pending invitation with the retained, revalidated role/contact/project context. The old link becomes unusable.

## 4. Trusted database commands and projections

All calls below are typed Supabase RPC calls from `server-only` adapters or Server Actions. Browser code must not read or mutate `client_contacts`, `clients`, `project_client_contacts`, or `invite_tokens` directly.

### 4.1 Contacts and associations

| RPC | Inputs | Output | Required use |
| --- | --- | --- | --- |
| `list_client_contacts_for_administration()` | none | active contact directory: `id`, `client_id`, `profile_id`, `full_name`, `email`, `phone_e164`, `job_title`, `is_primary`, timestamps | Directory, contact selector, and form initialization. |
| `list_client_organizations_for_administration()` | none | `id`, `display_name`, `slug` | Optional organization selector only. |
| `save_client_contact(...)` | validated complete contact fields | contact UUID | Create or edit one direct/organization contact. Pass every editable field explicitly. |
| `set_project_client_contact(projectId, contactId, associated)` | exact IDs and Boolean | resulting association Boolean | Associate/disassociate one contact in an authorized client-project context. |
| `list_project_client_contact_associations(projectId)` | exact client-project UUID | active associated direct-contact UUIDs only | Resolve selected-project association state. |

### 4.2 Model A invitation lifecycle

| RPC | Inputs | Output | Required use |
| --- | --- | --- | --- |
| `create_ordinary_invitation(role, contactId?, recipientEmail?, projectId?, expiresInHours?)` | closed role; exact contact for Client or recipient email for Operator; optional selected project; 1–720 hour lifetime | `invitation_id`, `invitation_role`, `expires_at`, one-time `invitation_token` | Create an ordinary invite. Default the UI lifetime to 168 hours. |
| `rotate_ordinary_invitation(invitationId, expiresInHours?)` | listed pending invitation ID and 1–720 hour lifetime | new invitation ID/role/expiry and one-time new token | Resend/reissue. Never reuse an old token. |
| `revoke_ordinary_invitation(invitationId)` | listed invitation ID | `invitation_id`, final `invitation_status`, `changed` | Revoke a pending invite. Treat `changed: false` as an idempotent terminal result and refresh. |
| `list_ordinary_invitation_administration(beforeCreatedAt?, beforeInvitationId?, limit?)` | complete composite cursor or no cursor; limit 1–100 | bounded lifecycle rows without email/token/hash | Management list. Fetch `pageSize + 1`, validate every returned row, then slice locally. |
| `accept_invite(tokenHash)` | hash generated server-side from the recipient’s opaque token | existing safe result | Preserve current recipient onboarding path only. |

All lifecycle functions are security-definer commands with a fixed safe search path, internal active Admin/PM check, explicit `postgres` owner, no `public`/`anon`/`service_role` execute grant, and `authenticated` grant only. They retain closed base-table RLS and append audit rows containing identifiers/outcomes only—not recipient email, raw token, hash, or URL.

## 5. Server-only adapter and action contract

### 5.1 Module boundaries

Create focused modules under these existing feature roots:

```text
src/lib/clients/
  types.ts                 # management DTOs and closed action result types
  schemas.ts               # add contact/association validation to existing organization schema
  queries.ts               # retain organization helpers only where still domain-specific; add M01 administration adapters
  actions.ts               # contact save and project-contact association Server Actions
src/lib/invitations/
  types.ts                 # lifecycle rows, cursors, one-time link result
  schemas.ts               # create/rotate/revoke/list action payload schemas
  queries.ts               # server-only typed RPC adapter and fail-closed row validation
  actions.ts               # create/rotate/revoke Server Actions and revalidation
```

Use `import "server-only"` in query adapters. Use `"use server"` only in action modules. UI components import Server Actions, never server query adapters or Supabase clients.

### 5.2 Authorization and error behavior

Each Server Action must:

1. obtain cookies, `requireSession`, and the server Supabase client;
2. require `session.role === "admin" || session.role === "pm"` before parsing/using a management operation;
3. validate only untrusted browser values with Zod;
4. call the generated typed RPC with explicit arguments;
5. map any authorization, constraint, unavailable, malformed-projection, conflict, or stale-state failure to a closed localized action code; and
6. call `revalidatePath` for the active Admin/PM management route(s) only after successful mutation.

Do not return SQL messages, RPC names, raw identifiers that were not already present in the rendered management model, profile details, token/hash material, stack traces, or a target-existence distinction to denied callers.

### 5.3 Contact schemas and action inputs

Use strict objects; reject unknown keys.

**Contact save input**

| Field | Rules |
| --- | --- |
| `contactId` | UUID or `null`; `null` means create. |
| `fullName` | Trimmed string, 1–120 characters. |
| `email` | Trimmed valid email, maximum 320 characters. |
| `phoneE164` | Optional `null` or strict E.164 `^\+[1-9][0-9]{7,14}$`; empty becomes `null`. |
| `jobTitle` | Optional `null`; trimmed 1–120 characters when supplied; empty becomes `null`. |
| `clientId` | Optional UUID or `null`. |
| `isPrimary` | Boolean; force/require `false` when `clientId` is null. |

**Association input:** strict `{ projectId: UUID, contactId: UUID, associated: boolean }`.

### 5.4 Invitation schemas and one-time link handling

**Create input**

- strict `role: z.enum(["client", "operator"])`;
- optional `projectId: UUID | null`;
- `expiresInHours: integer 1..720`, UI default `168`;
- Client variant: exact `contactId: UUID`; no recipient email field;
- Operator variant: `recipientEmail`, trimmed valid email, maximum 320; no contact ID.

Use a discriminated union. Do not accept role/context fields outside the selected variant.

**Rotate input:** strict `{ invitationId: UUID, expiresInHours: integer 1..720 }`.

**Revoke input:** strict `{ invitationId: UUID }`.

The create/rotate action returns a narrow one-time object only after RPC success:

```ts
{ ok: true, data: { invitationId, role, expiresAt, invitationUrl } }
```

Build `invitationUrl` server-side as the established locale-aware `/invitacion?token=<encoded opaque token>` route. Keep it in the interactive component only long enough to call clipboard copy. The UI must clear the one-time URL from component state when the dialog closes, after route refresh, and on unmount. It must never render the full URL/token as page text.

For Clipboard API use, attempt `navigator.clipboard.writeText(invitationUrl)` in the same user gesture. If unsupported/failing, use a cleanup-safe temporary textarea fallback in that same gesture. Show only localized “link copied” or “copy failed” feedback; do not include the link in feedback.

### 5.5 Invitation list adapter

The adapter validates every RPC row, including the `limit + 1` continuation row, before pagination. A malformed row fails the page closed.

Accept only:

- UUID `invitation_id`;
- role `client | operator`;
- status `pending | accepted | expired | revoked`;
- non-empty bounded `recipient_label`;
- nullable UUID `contact_id` and `project_id`;
- nullable bounded `project_name`;
- valid ISO timestamps for creation/expiry and nullable accepted/revoked timestamps.

The UI may render role, recipient label, project label, lifecycle status, timestamps, and action controls. IDs are action/navigation keys only and are never displayed. The list must not render recipient email, contact email, raw token, hash, profile data, audit payload, or arbitrary URLs.

## 6. Routes and navigation

Create equivalent protected routes:

```text
/[locale]/admin/clientes
/[locale]/pm/clientes
```

Each page independently requires an active `admin` or `pm` session and loads only server-authorized management DTOs. The PM page must not require membership in any project.

Add one `clients` navigation-model item to `src/components/shared/app-nav/navigation-model.ts` for Admin and PM only. Add its icon mapping to both desktop and mobile navigation renderers. Keep mobile quick access unchanged unless its fixed role matrix has an explicit spare slot; the item remains available in the full authorized navigation drawer/menu.

The administration screen has two tabs or equivalent clearly separated panels:

1. **Contacts** — directory, create/edit interaction, optional organization selection, and project-association management.
2. **Invitations** — create, one-time immediate Copy Link result, bounded history, resend/rotate, revoke, pagination, and state display.

Do not add a route or navigation entry for Operator, Client, or unauthenticated users.

## 7. Contact UI behavior

### 7.1 Directory

- Show contact full name, optional organization display name, optional job title, contact email, direct/organization designation, and linked-account presence only when useful to the manager.
- Use the contact and organization projections to resolve labels; do not run per-row browser queries.
- Direct contacts must be first-class entries, not filtered out, grouped as invalid, or shown as missing organizations.
- Create/edit interaction uses existing dialog/sheet primitives with label associations, described errors, Escape/cancel/focus return, and retained non-secret input after safe failures.

### 7.2 Association

- Association controls appear only for a selected client project and an Admin/PM management context.
- Selecting a project uses a server-only global management-project loader under M01 `projects` RLS; do not use the membership-scoped `listProjectsForPm` helper for this selector.
- Resolve selected-project association state through `list_project_client_contact_associations`; never query `project_client_contacts` from application code or the browser.
- Show explicit copy: association supports identity/readiness planning and **does not invite, activate, add a member, grant project access, or assign work**.
- Associate calls `set_project_client_contact(projectId, contactId, true)`; disassociate calls the same RPC with `false`.
- Show association controls only for direct contacts (`client_id IS NULL`). Organization contacts use organization-match readiness and must neither show nor invoke association controls.
- Do not automatically associate all organization contacts to a project. Organization-contact readiness remains organization-match based.

## 8. Invitation UI behavior

### 8.1 Create

- Role selector contains exactly Client and Operator.
- Selecting Client displays an exact contact selector populated from the M01 administration contact projection. It does not accept free-form recipient email.
- Selecting Operator displays recipient email and never permits client contact selection.
- Optional project selection is explicit and defaults to none. The UI must not infer a project from a contact association.
- A Client selection may include direct and organization contacts. The server command is authoritative for active/unlinked/project-compatible eligibility.
- On success, remain in the invitation panel, surface a single immediate Copy Link control, and refresh list data after the clipboard attempt or dialog close. Do not navigate to the public invitation route.

### 8.2 Lifecycle rows

| State | Display | Actions |
| --- | --- | --- |
| Pending | Pending plus expiration | Resend (rotate), Revoke. No later copy/retrieve action. |
| Accepted | Accepted timestamp | No mutation actions. |
| Expired | Expired state | No mutation actions. Create a new invitation from the creation flow. |
| Revoked | Revoked timestamp | No mutation actions. Create a new invitation from the creation flow. |

- Resend opens a localized confirmation that states the prior link will stop working and a new link must be copied immediately.
- Revoke opens a localized confirmation; it is idempotent and server-revalidated.
- Disable only the affected row/action while its mutation is pending. Do not freeze filters, pagination, other rows, or the contact panel.
- After a mutation failure, retain focus and the current list state. Do not optimistically claim a link was revoked or copied.

## 9. Existing onboarding integration

Preserve the public recipient path:

```text
/[locale]/invitacion?token=<opaque token>
  → invitation-form.tsx
  → POST /api/v1/auth/invites/complete
  → SHA-256 token hash server-side
  → accept_invite(p_token_hash)
```

Keep the existing completion endpoint’s Origin validation, idempotency-key validation, schema validation, server-only admin client, safe terminal 410 behavior, and role-safe redirect. The invitation lifecycle UI does not read `invite_tokens` directly and does not replace `accept_invite` logic.

For a Client invitation, acceptance binds only the exact stored `contact_id`; no arbitrary profile may be linked. For a project-scoped invitation, acceptance creates membership only after all trusted checks pass. A direct contact association remains non-authorizing before and after acceptance.

## 10. Localization and accessibility

Add matching keys to `messages/en-US.json` and `messages/es-MX.json` for:

- navigation label/ARIA label;
- contact directory, direct-vs-organization designation, linked-account state, form labels/help/errors, association explanation and result states;
- invitation role labels, project optionality, lifecycle statuses, expiry display, create/resend/revoke confirmations, one-time link copy success/failure, pagination, and safe unavailable/conflict states.

Use real links for navigation and buttons for mutations/copy. Do not nest controls. Status and authorization outcomes must not rely on color alone. All new dialogs/sheets require keyboard operation, Escape/cancel behavior, focus return, accessible names/descriptions, and responsive single-column usability.

## 11. Required file changes

```text
supabase/migrations/20260831100000_s10-02-ordinary-invitation-lifecycle.sql
supabase/migrations/20260831114500_s10-association-projection-and-direct-contact-enforcement.sql
src/lib/database.types.ts                           # regenerated artifact; never hand-edit
src/lib/clients/schemas.ts
src/lib/clients/queries.ts
src/lib/clients/actions.ts                          # new
src/lib/clients/types.ts                            # new when needed for narrow DTOs
src/lib/projects/queries.ts                         # global management-project selector only
src/lib/invitations/schemas.ts                      # new
src/lib/invitations/queries.ts                      # new
src/lib/invitations/actions.ts                      # new
src/lib/invitations/types.ts                        # new
src/app/[locale]/(protected)/admin/clientes/**
src/app/[locale]/(protected)/pm/clientes/**
src/components/shared/app-nav/navigation-model.ts
src/components/shared/app-nav/_components/desktop-nav-drawer.tsx
src/components/shared/app-nav/_components/mobile-nav-toggle.tsx
messages/en-US.json
messages/es-MX.json
```

Existing invitation completion files are modified only when necessary to preserve the established acceptance/security contract. Do not edit M01 or manually edit generated database types.

## 12. Focused verification

1. Run `npm run lint` and `npm run typecheck`.
2. Add at most the smallest focused Vitest coverage required for a new Server Action/adapter contract or a reproduced UI regression.
3. After applying the complete schema baseline and regenerating `src/lib/database.types.ts`, verify Admin and PM can independently reach `/admin/clientes` and `/pm/clientes`, create/edit a direct contact, optionally associate an organization, and associate/disassociate a direct contact without membership gating.
4. Verify a direct contact remains visible/selectable without organization and association is never represented as membership/access; verify organization contacts have no association control and `set_project_client_contact(..., true)` rejects them.
5. Verify Client invite creation requires an exact contact; Operator invite creation requires email; both reject all privileged roles.
6. Verify Model A create and resend return a one-time link only to the initiating action, copy feedback does not disclose it, resend revokes the old pending link, and list rows contain no email/token/hash.
7. Verify revoke is idempotent and terminal rows expose no mutation controls.
8. Verify Operator, Client, and unauthenticated callers receive no directory or lifecycle data and cannot execute management actions.
9. Preserve existing valid/mismatched/expired/revoked invitation acceptance behavior and no-enumeration response shape.
10. Verify added English and Mexican Spanish keys are structurally present and interactive paths are keyboard usable.

No provider activation, external-delivery verification, broad suite, E2E suite, or production action is part of this work.
