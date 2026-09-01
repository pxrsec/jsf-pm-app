---
document_id: S10-01-S10-02-DIRECT-CLIENT-AND-INVITATION-ADMINISTRATION-IMPLEMENTATION-SPEC-04
sprint_id: S10
work_items: [S10-01, S10-02]
status: implementation-ready-no-further-migration-required
updated_at: 2026-08-31T15:44:33-06:00
target_environment: jsf-pm-dev
schema_baseline:
  - supabase/migrations/20260830110000_s10-direct-client-identity-and-invitation-administration.sql
  - supabase/migrations/20260831100000_s10-02-ordinary-invitation-lifecycle.sql
  - supabase/migrations/20260831114500_s10-association-projection-and-direct-contact-enforcement.sql
  - supabase/migrations/20260831123000_s10-association-projection-integrity-and-invitation-list-index.sql
  - supabase/migrations/20260831153000_s10-active-project-command-enforcement.sql
generated_types: src/lib/database.types.ts
---

# S10-01 and S10-02 — Direct Client and Ordinary Invitation Administration

## 1. Controlling scope and final schema verdict

Implement **only** S10-01 and S10-02:

1. Admin/PM administration of direct client contacts, optional organizations, and direct-contact/project associations.
2. Admin/PM Model A administration of Client and Operator invitations.

This specification supersedes revision 03 for this implementation slice. It reconciles the applied S10 migration chain, the regenerated declarations, and the current repository code. It is the complete execution authority for the implementation plan and code work.

### Final migration decision

**No further migration is required for S10-01 or S10-02. Do not author, apply, or regenerate types for another S10-01/S10-02 migration during normal implementation.**

The applied chain already supplies every required trusted boundary:

| Need | Applied command/projection | Coverage |
| --- | --- | --- |
| Direct contact create/edit and optional organization link | `save_client_contact` | Admin/PM-only `SECURITY DEFINER`; rejects deleted organization; direct contacts require `is_primary = false`. |
| Contact directory and organization selector | `list_client_contacts_for_administration`, `list_client_organizations_for_administration` | Admin/PM-only; no browser base-table access is needed. |
| Direct-contact association state and mutation | `list_project_client_contact_associations`, `set_project_client_contact` | Active direct contact IDs only; historical rows can be removed; rejects deleted/archived/non-client projects. |
| Model A lifecycle | `create_ordinary_invitation`, `rotate_ordinary_invitation`, `revoke_ordinary_invitation`, `list_ordinary_invitation_administration` | Closed Client/Operator role set; token returned only by create/rotate; bounded safe list projection. |
| Invitation acceptance | `accept_invite` | Exact email/contact binding, expiry/revocation/single-use checks, and deleted/archived project rejection before membership creation. |
| Global Admin/PM project selection | existing `projects` RLS after M01 | Active Admin/PM may read all non-deleted projects. The application selector must filter to `project_type = client` and `archived_at IS NULL`. No new selector RPC is necessary. |

`20260831153000_s10-active-project-command-enforcement.sql` closes the last schema-level lifecycle mismatch by enforcing `archived_at IS NULL` in association set/list, Client and Operator invitation resolution, and invite acceptance. Create and rotate call the repaired resolver; therefore their project predicates are also covered.

A later migration is permitted only if implementation proves an actual deployed-schema contradiction not represented in this baseline. A TypeScript ergonomics issue, a UI state issue, or a recoverable adapter validation issue is **not** a migration reason.

## 2. Explicit non-goals

Do not implement or alter:

- S10-03 through S10-06, archive/recycle-bin/permanent deletion, deactivation, stale reminders, bug reports, legal routes, task-detail work, calendar work, or deliverable-link correction.
- Provider dispatch, email, WhatsApp, SMS, queueing, scheduling, analytics/telemetry, provider secrets, public signup, or production actions.
- Admin/PM invitation creation, arbitrary role selection, browser role changes, browser base-table writes, direct table reads of `invite_tokens` or `project_client_contacts`, or service-role workarounds.
- Project-membership creation/deletion as an association workaround. Association is readiness metadata only.
- Broad project-directory redesign or a refactor unrelated to direct readiness.

## 3. Domain and authority contract

| Term | Stored model | Meaning | Never implies |
| --- | --- | --- | --- |
| Contact | `client_contacts` | Person record; may be direct or organization-associated; may lack an account. | Organization, account, membership, RLS visibility, or work authority. |
| Direct contact | `client_contacts.client_id IS NULL` | Person not associated with an organization. | Invalid data or an implicit organization. |
| Organization contact | `client_contacts.client_id IS NOT NULL` | Contact linked to a non-deleted `clients` row by the trusted save command. | Membership, project access, or a direct-contact association control. |
| Organization | `clients` | Optional grouping metadata. | Universal client identity/readiness prerequisite. |
| Account | `auth.users` and `profiles` | Authenticated identity and application role. | Directory authority or contact membership. |
| Project member | `project_members` | Explicit project authorization. | Contact directory access. |
| Project-contact association | `project_client_contacts` | Direct-contact identity/readiness metadata for one client project. | A member row, project visibility, invitation, activation, or assignment. |
| Invitation | `invite_tokens` | Opaque, hashed, expiring, revocable, single-use onboarding authorization. | Public registration, role elevation, directory access, or token recovery. |

`profiles.role` is the application authority. Active `admin` and active `pm` have equivalent global S10 management authority. `pm_lead` and `pm_watcher` are project metadata only and must never be consulted for this screen, its selector, its actions, or its routes.

## 4. Data invariants that application code must preserve

1. A direct contact has `client_id = null` and `is_primary = false`.
2. Active (non-deleted) direct contacts are unique by email; active organization contacts are unique by `(client_id, email)`; one active profile can link to one active contact.
3. Moving a person direct → organization or organization → direct updates the same contact through `save_client_contact`. Never delete/recreate a person merely to alter `client_id`.
4. A planning or cancelled client project can exist without organization, contact, account, or client membership.
5. A non-planning, non-cancelled client project needs an active Client project member whose linked contact is either associated direct contact for that exact project or an organization contact matching `projects.client_id`. The database enforces this at commit time.
6. Direct association is permitted only for a non-deleted direct contact and a non-deleted, non-archived client project. Disassociation remains valid for an exact historical contact ID to allow cleanup.
7. Association projection returns only IDs for currently non-deleted direct contacts. UI must intersect those IDs with the authorized current contact directory before marking a row associated.
8. Client invitations bind an exact non-deleted contact without a profile. Operator invitations bind no contact and use validated recipient email.
9. Project-scoped Client invitations require direct association or organization match; project-scoped Operator invitations require an explicitly selected available project. Every project-bearing S10 command rejects archived/deleted projects.
10. Only `client` and `operator` are ordinary invitation roles. A project membership is created only on accepted project-scoped invite; association never creates one.

## 5. Required server-only modules

Create/extend only these feature modules. Query modules begin with `import "server-only"`; action modules begin with `"use server"`. No client component imports a query module or Supabase client.

```text
src/lib/clients/types.ts
src/lib/clients/schemas.ts
src/lib/clients/queries.ts
src/lib/clients/actions.ts
src/lib/invitations/types.ts
src/lib/invitations/schemas.ts
src/lib/invitations/queries.ts
src/lib/invitations/actions.ts
src/lib/projects/queries.ts
```

### 5.1 DTO rules

- Public DTO fields are camelCase. Raw RPC fields are snake_case and are mapped only in server-only adapters.
- Do not expose IDs as display text. IDs may be client-side action keys only.
- Do not reuse broad table row types as browser DTOs.
- Raw unexpected RPC errors, malformed rows, null required fields, invalid UUIDs, unexpected enum values, malformed timestamps, and invalid cursor combinations fail closed as `UNAVAILABLE`; never return provider/SQL error text.
- The generated RPC declaration for `save_client_contact` represents `p_contact_id` as `string`, although PostgreSQL accepts explicit SQL `NULL` for create. This is a generator nullability limitation, not a schema defect. Keep the cast isolated in the server-only adapter through a narrow local args type accepting `string | null`; do not hand-edit generated types and do not create a migration solely to change this generated representation.

### 5.2 Clients adapter contract

`listClientContactsForAdministration(supabase)` calls `list_client_contacts_for_administration`, validates every row, and returns:

```ts
type ClientContactAdministrationDto = {
  id: string;
  clientId: string | null;
  profileId: string | null;
  fullName: string;
  email: string;
  phoneE164: string | null;
  jobTitle: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
};
```

`listClientOrganizationsForAdministration(supabase)` calls its corresponding RPC and returns only `{ id, displayName, slug }`.

`listClientManagementProjects(supabase)` is a new narrow server-only direct query against `projects`. It returns only `{ id, name }`, filters `project_type = "client"`, `deleted_at IS NULL`, and `archived_at IS NULL`, orders by `name`, and is called only after the route has confirmed Admin/PM. It replaces neither `listProjectsForAdmin` nor membership-scoped `listProjectsForPm`; specifically do not use `listProjectsForPm` for this selector.

`loadProjectClientContactAssociationsAction({ projectId })` must validate a strict UUID input, independently require Admin/PM, call the association RPC, validate every returned `contact_id`, and return IDs only. It is read-only and does not revalidate. It must never query `project_client_contacts` directly.

### 5.3 Contact write actions

Use strict Zod objects and reject unknown keys.

```ts
{ contactId: UUID | null, fullName: trimmed 1..120, email: trimmed email <=320,
  phoneE164: null | strict /^\+[1-9][0-9]{7,14}$/, jobTitle: null | trimmed 1..120,
  clientId: UUID | null, isPrimary: boolean }
```

Normalize empty optional text to `null`. Before the RPC call, reject `clientId === null && isPrimary === true`; pass all editable values explicitly. `saveClientContactAction` returns a narrow `{ ok: true, data: { contactId } }` or safe error union.

`setProjectClientContactAction` accepts exactly `{ projectId: UUID, contactId: UUID, associated: boolean }`. It calls the trusted RPC only. On success, return the resulting Boolean; on every failure return a safe code. Neither action may create a profile, membership, invitation, or organization.

Every management action obtains cookies, calls `requireSession`, checks `session.role === "admin" || session.role === "pm"` before handling input, creates the server client, invokes the typed RPC, and calls `revalidatePath` only after a successful mutation for both `/admin/clientes` and `/pm/clientes` localized route trees. Do not log raw inputs with email, token, or URLs.

### 5.4 Invitation adapter and actions

Define local DTOs for role (`client | operator`), status (`pending | accepted | expired | revoked`), and composite cursor. The list DTO contains exactly:

```ts
{ invitationId, role, status, recipientLabel, contactId, projectId,
  projectName, createdAt, expiresAt, acceptedAt, revokedAt }
```

It must not include recipient email, token, token hash, audit payload, profile data, arbitrary URL, or raw error.

`loadOrdinaryInvitationPageAction` accepts either no cursor or a complete strict pair `{ beforeCreatedAt, beforeInvitationId }` plus an integer limit. Request `pageSize + 1`, validate **all** rows before slicing, and derive the next cursor from the last visible row, never the lookahead row. Keep this cursor only in client component state; do not put it in search params, local storage, session storage, or a route URL.

Create input is a strict discriminated union:

- Client: `{ role: "client", contactId: UUID, projectId: UUID | null, expiresInHours: int 1..720 }` and no recipient email.
- Operator: `{ role: "operator", recipientEmail: trimmed email <=320, projectId: UUID | null, expiresInHours: int 1..720 }` and no contact ID.

Default lifetime is 168 hours. Rotate accepts only `{ invitationId: UUID, expiresInHours: int 1..720 }`. Revoke accepts only `{ invitationId: UUID }`.

Create/rotate action consumes exactly one valid RPC row and produces only:

```ts
{ ok: true, data: { invitationId, role, expiresAt, invitationUrl } }
```

Build `invitationUrl` on the server using the established locale-aware invitation route `/invitacion?token=<encoded opaque token>` and the actual next-intl routing model (`en-US` is `/en`; default `es-MX` has no prefix). Never log the raw token, token hash, or built URL. Revoke returns only its safe terminal result. Successful mutations revalidate the two management routes; load actions do not mutate data.

## 6. Routes, data loading, and navigation

Create these protected route roots and route-local components:

```text
src/app/[locale]/(protected)/admin/clientes/page.tsx
src/app/[locale]/(protected)/admin/clientes/_components/**
src/app/[locale]/(protected)/pm/clientes/page.tsx
src/app/[locale]/(protected)/pm/clientes/_components/**
```

Each page resolves cookies/session before data access. Admin page redirects non-admin roles via the existing `ROLE_DEFAULT_PATHS`; PM page redirects non-PM roles the same way. The PM page never checks project membership. Each page passes only server-authorized DTOs to one shared client administration surface, or to parallel role-local wrappers around it if repository import conventions require that.

Load contacts, organizations, available client projects, and first invitation page in parallel after authorization. A directory/list failure is a safe localized unavailable state, never a fallback direct table query or an empty state that misrepresents unavailable data as no records.

Add `clients` to `AppNavigationItemKey` and `buildNavigationModel` only for Admin and PM. Add its localized `shell.nav.links.clients` key to both catalogs and add the matching icon mapping to both desktop and mobile navigation renderers. Do not add the item for Operator or Client. Do not alter the fixed mobile quick-access matrices; this item remains discoverable in the full authorized navigation.

## 7. Management UI requirements

The route shows one accessible administration surface with local controlled tab state only; tab state must not use search parameters. Use exactly two panels.

### Contacts panel

- Render name, organization label or localized direct designation, optional job title, email, and linked-account presence only for Admin/PM.
- Direct contacts are normal first-class rows; do not group them as invalid or hide them.
- Create/edit uses existing accessible dialog/sheet primitives. It supports choosing no organization, choosing one organization, and only allows primary-contact input when organization is selected.
- Do not create or modify organizations in this slice.
- Project association begins with the global available client-project selector. Show association controls only for a selected project and direct contacts.
- Organization contacts show no association toggle and do not invoke it. Do not infer association from organization matching.
- Display explicit localized explanation: association supports identity/readiness planning only; it does not invite, activate, create membership, grant access, or assign work.
- Disable only the affected form/row during its action. Preserve non-secret form input and focus after recoverable failure.

### Invitations panel

- Role selector contains Client and Operator only.
- Client selection uses the authorized exact contact selector; never permit free-form recipient email. Operator selection shows recipient email and no contact selector.
- Project selection is explicit and optional. It defaults to no project and never infers a project from selected contact or association.
- On successful create/rotate, retain the URL only in the immediate interactive component state. Show one explicit Copy Link action; do not render the URL/token as visible page text, toast content, title, accessible description, HTML data attribute, or hidden DOM text.
- Call the existing `copyTextToClipboard` helper within the initiating user interaction. It already uses Clipboard API followed by a cleanup-safe textarea fallback. Display only localized copied/failed feedback.
- Clear one-time link state on dialog close, after route refresh, and component unmount. If copy fails or result is dismissed, users must use Resend, which rotates and invalidates the prior link.
- Pending rows show expiration and only Resend/Rotate plus Revoke. Accepted, expired, and revoked rows show their terminal timestamp/state and no mutation controls.
- Resend confirmation states that the old link stops working and the replacement must be copied immediately. Revoke confirmation states that the action is terminal for this link. Revoke is idempotent: `changed: false` is a valid terminal outcome and refreshes state.
- Per-row pending state never disables pagination, other rows, tabs, or contact controls. On failure retain focus and list state; do not optimistically mark copied/revoked.

All interactive status text is textual and not color-only. Use buttons for mutations/copy and real next-intl `Link` components for navigation. Dialogs require labels, descriptions, Escape/cancel, focus restoration, keyboard use, and responsive one-column flow.

## 8. Existing project surfaces that must be reconciled

M01 removed organization-universal readiness. Preserve organization selectors where they are still optional metadata, but remove client-ID-only gating where the authoritative database now uses direct-or-organization readiness.

Review and update the direct user-facing assumptions in these existing files:

```text
src/lib/deliverables/auth-checks.ts
src/components/shared/projects/project-workspace/project-overview-tab.tsx
src/components/shared/projects/project-workspace/project-header.tsx
src/components/shared/projects/project-deliverables/deliverables-tab.tsx
src/components/shared/projects/project-deliverables/deliverable-create-dialog.tsx
src/components/shared/projects/project-members/add-member-dialog.tsx
src/app/[locale]/(protected)/admin/proyectos/[id]/page.tsx
src/app/[locale]/(protected)/pm/proyectos/[id]/page.tsx
messages/en-US.json
messages/es-MX.json
```

Required reconciliation:

1. Do not block a client request/deliverable merely because `project.client_id` is null when trusted database readiness is satisfied through an associated direct contact and Client member.
2. Do not describe an organization as universally required for client setup, client review, or client-readiness state. State missing readiness truthfully without exposing contact/private profile data to unauthorized roles.
3. Do not weaken existing role-safe project detail/load logic. Any existing `listClientContacts(clientId)` usage remains organization-specific and must not be repurposed as a direct-contact directory.
4. Project create/edit organization controls remain optional metadata. No new direct-contact project-create flow is required in this slice.
5. No change is required to Client/Operator portal data projections unless an implementation change would otherwise expose management directory information.

## 9. Localization

Add a dedicated, structurally identical administration namespace in both `messages/en-US.json` and `messages/es-MX.json`. Include every visible/accessible string for navigation, page title/description, tabs, empty/unavailable states, contact designation/account state, contact form and validation, organization selection, association explanation/result, invitation role/project/lifetime fields, lifecycle labels/timestamps, pagination, one-time copy, confirmations, safe errors, and ARIA labels.

No user-facing fallback text belongs in query/adaptor code. Do not hard-code English placeholder labels in shared DTOs. Keep stored roles/statuses English and map them at presentation.

## 10. Focused verification and required manual evidence

Run exactly the bounded relevant checks after implementation:

1. `npm run lint`
2. `npm run typecheck`
3. At most the smallest focused Vitest files added/changed for new action/adapter contracts or a reproduced UI regression. Do not add broad coverage, E2E, provider, production, or exhaustive role-matrix suites.

Automated assertions must cover at least any new adapter/action behavior that is introduced: strict unknown-key rejection, role denial, malformed list-row failure, complete keyset cursor validation, lookahead cursor derivation, no email/token/hash in list DTOs, one-time link result shape, no action on terminal invite row, and no direct association action for an organization contact.

Manual journeys in `jsf-pm-dev`:

1. Admin and PM independently reach their `/clientes` route with the correct locale; Operator, Client, and unauthenticated callers cannot retrieve management data or complete management actions.
2. Create/edit a direct contact, retain it without organization, then associate/disassociate an organization through the same contact record.
3. Select an available client project, associate/disassociate a direct contact, and confirm no membership/access is created. Confirm organization contacts have no association control.
4. Create Client invitation only through an exact contact; create Operator invitation only through email; both reject privileged roles and mismatched role fields.
5. Confirm create/rotate produces a one-time copy interaction only, the list contains no email/token/hash, failed/dismissed copy has no recoverable later copy, and Resend invalidates prior link.
6. Confirm revoke is idempotent and accepted/expired/revoked rows have no lifecycle mutation controls.
7. Confirm every project-bearing command rejects a deleted/archived project: association set/list; Client and Operator create; rotation after archive; acceptance must not create membership for archived project. Global invitation remains unaffected.
8. Confirm direct-contact readiness removes no valid client functionality merely because organization is absent, while all original permission boundaries remain intact.
9. Confirm English and Mexican Spanish key parity and keyboard dialog/tabs/controls.

## 11. Completion report contract

The implementation report must state changed files; focused tests added/changed; exact commands and factual output; manual evidence versus unverified hosted claims; authorization/token/localization/accessibility impact; migration statement `none — complete applied baseline consumed`; and remaining blockers, if any.

Do not claim provider delivery, production readiness, deployed RLS proof beyond the Project Owner’s applied migration/type provenance, legal approval, or external dispatch.
