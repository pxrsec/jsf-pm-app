# S04-06 — Build Production Deliverable Planning, Submission, and Immutable History

**Sprint:** S04  
**Work Item:** S04-06  
**Status:** Implementation-ready draft  
**Last reviewed:** 2026-08-20  
**Spec authority:** `dev-docs/specs/s04/s04-e04-e05-project-workspace-and-production-deliverable-lifecycle-sprint-plan.md`, Section 5, S04-06.  
**Dependencies:** S04-01 through S04-05, especially the existing `src/lib/deliverables/`, `src/lib/comments/`, project workspace shell, and centralized status maps.

---

## 1. Objective

Replace the current Deliverables placeholder with the internal planning and submission half of the production-deliverable workflow.

An authorized Admin, PM Lead, or eligible production assignee must be able to:

1. create and maintain a **production** deliverable for an eligible client project and project task;
2. submit a lexically valid Google Drive HTTPS share URL through the existing transactional command;
3. inspect the current state plus every immutable submitted version and version-scoped formal review entry;
4. add capacity-labeled internal collaboration comments; and
5. report a suspected broken link without changing the deliverable lifecycle or asserting that the server checked the link.

This work item deliberately stops before authoritative internal review, release to Client review, and final delivery. Those lifecycle controls belong exclusively to **S04-07**.

---

## 2. Scope and hard boundaries

### 2.1 In scope

- Replace `DeliverablesTabPlaceholder` for client projects with an operational `DeliverablesTab`.
- Server-rendered project-scoped deliverable list data for both Admin and PM workspaces.
- Production deliverable create, edit, and archive planning surfaces.
- Submission of a new immutable production version through `submit_deliverable_version`.
- Immutable version history and version-scoped formal-feedback display.
- Deliverable-targeted internal collaboration comments.
- Independent link-report creation against a selected immutable version.
- Full es-MX/en-US catalog parity and keyboard/mobile-safe interaction paths.
- Focused application-level tests for the new action adapters, validation, UI gating, immutable-history presentation, and link-report non-lifecycle behavior.

### 2.2 Explicitly out of scope

- `review_deliverable`, PM approval, changes-requested decisions, Client release, Client review, final delivery, or any `approved`/`delivered` control. Those are S04-07/E7 concerns.
- Client portal routes, Client submission workflow, and any Client-facing deliverable projection.
- Operator agenda/mobile execution experience.
- Google Drive API use, URL previews, fetches, redirects, file upload/download/proxy/storage/scanning, reachability checks, or provider authentication.
- New API route handlers unless a separately approved API-contract adoption explicitly requires them. Use Server Actions for this work item.
- Unrelated database redesign, direct DDL, dashboard edits, destructive resets, or manual edits to `src/lib/database.types.ts`.
- Provider delivery, email, WhatsApp, Realtime expansion, notifications UI, and hosted-environment changes.

### 2.3 Non-negotiable security and truthfulness rules

- A client component may provide immediate form feedback but is never the authorization or URL-security boundary.
- Every mutation derives the actor from `requireSession`; it never accepts actor, role, capacity, or authorization facts from the browser.
- A submission success means only that the authoritative command recorded an immutable version. It does **not** mean the Drive content exists, is accessible, is safe, or has been inspected.
- A link report means a member reported a suspected access issue. It must not display “verified broken,” mutate `deliverables.status`, create a substitute lifecycle status, or alter a `deliverable_version`.
- Historical versions and `deliverable_feedback` are read-only evidence. The UI must contain no edit, delete, reorder, or “correct history” affordance.
- Errors shown to users are localized, stable, and non-leaking. Do not surface PostgREST/RPC messages, function names, RLS details, UUIDs, raw URLs, or stack traces.

---

## 3. Current implementation baseline

The implementation must extend these committed assets rather than recreate or bypass them.

| Asset | Current responsibility | S04-06 rule |
|---|---|---|
| `src/lib/deliverables/schemas.ts` | Zod schemas for create, update, submission, review, and link-report input | Use `CreateDeliverableSchema`, `UpdateDeliverableSchema`, `SubmitDeliverableVersionSchema`, and `ReportBrokenLinkSchema`; do not weaken them or add review inputs to this item. |
| `src/lib/deliverables/commands.ts` | Typed insert/update adapters and RPC adapters | Reuse `createDeliverable`, `updateDeliverable`, `submitDeliverableVersion`, `archiveDeliverable`, and `reportBrokenLink`. Do not write status or versions directly. |
| `src/lib/deliverables/queries.ts` | Project list and detail/history reads | Remediate the current broad selects: use explicit least-privilege projections in `listProjectDeliverables`, `getDeliverableDetail`, `listDeliverableVersions`, and `listVersionFeedback`. |
| `src/lib/comments/*` | Internal comments through `create_collaboration_comment` | Use `target_type: "deliverable"`; comments remain separate from formal feedback. |
| `src/lib/status-maps.ts` | Central semantic status mapping | Render all deliverable state labels/icons from `DELIVERABLE_STATUS_MAP`; never hard-code a second state mapping. |
| `ProjectWorkspaceShell` | Shared Admin/PM workspace tabs | Replace only the Deliverables tab placeholder. Preserve Tasks, Members, Overview, and completed-project behavior. |
| Admin/PM project detail pages | Server-side authentication and workspace prerequisites | Add the required deliverable list query to the existing `Promise.all` and pass it to the shell. |

### 3.1 Existing command contract

| Operation | Existing boundary | S04-06 behavior |
|---|---|---|
| Create production deliverable | typed `deliverables` insert through `createDeliverable` | `workflow_type` is always `production`; no browser table write. |
| Edit planning fields | typed update through `updateDeliverable` | Only planning metadata is editable. The UI exposes this only in `pending` or `changes_requested`; the server/data boundary remains authoritative. |
| Submit version | `submit_deliverable_version(p_deliverable_id, p_submission_url, p_submission_note?)` | Sole writer of immutable versions and version number. |
| Read history | `getDeliverableDetail` | Display all returned versions and feedback; bind feedback to `feedback.version_id`. |
| Report link | `report_broken_link(p_deliverable_id, p_version_id, p_reason)` | Creates separate incident evidence only. |
| Add comment | `create_collaboration_comment(p_project_id, 'deliverable', p_target_id, p_body)` | Server derives capacity snapshot. |

### 3.2 Eligibility before planning a production deliverable

The sprint plan and wiki require a valid client-project context. Because the current S04-03 planning relaxation permits an incomplete client project during `planning`, S04-06 must apply a stricter **deliverable eligibility gate** before it creates production work:

1. `project.project_type === "client"`;
2. `project.client_id !== null`;
3. the project has at least one active member with `member_type === "client"`;
4. the selected task belongs to this exact project, is not soft-deleted, and is valid for production work under the committed data model;
5. the selected assignee is an active, compatible project member; and
6. the project is not archived or cancelled.

The UI uses those facts to hide/disable the create affordance and show one localized setup explanation. The Server Action independently reads the authoritative project/task/member context and rejects a forged payload that fails any condition. RLS, triggers, and the command adapter remain the final enforcement layer.

If this server-derived check cannot be implemented with the committed safe reads/RLS policy, **stop S04-06 and record the missing command/projection**. Do not replace it with client-side filtering or a privileged Supabase client.

### 3.3 Accepted planning-stage client-project flexibility

The Project Owner has explicitly accepted the S04-03 model change that a PM may create a **client** project in `planning` before an organization or Client profile has been onboarded. This supports project-scoped internal preparation such as proposals, estimates, vendor coordination, and internal pre-production rather than creating a misleading separate internal project.

During that incomplete planning state:

- PM Leads/Admins may create and manage ordinary internal work tasks and assign them only to compatible active internal members, including PM Leads/Admins and Operators as allowed by the authoritative task command.
- The project remains a client project for reporting and later onboarding; it is not silently recast as an internal project.
- The workspace displays a localized client-onboarding setup notice.
- The project must not create a production deliverable, release a production deliverable, or present Client-facing workflow affordances until the client organization and at least one active Client project member exist.
- The transition boundary must continue to enforce the accepted non-planning requirements. A UI banner is not enforcement.

This is a deliberate reconciliation of the earlier unconditional client-project wording, not a relaxation of production-deliverable safeguards.

### 3.4 Required S04-06 schema reconciliation slices

The Project Owner has authorized two **narrow, related database-policy reconciliations** for S04-06. They implement the planning-stage client-project exception and harden authoritative production Google Drive URL validation. No unrelated schema redesign is implied.

1. `supabase/migrations/20260821100000_s04_06_allow_incomplete_client_project_planning.sql` replaces only `projects_type_client_ck`. It permits a `client` project with `client_id IS NULL` only while `status = 'planning'`; every non-planning client project still requires `client_id`, and internal projects still require `client_id IS NULL`. The existing deferred membership trigger independently preserves the active Client-member requirement outside planning.
2. `supabase/migrations/20260820153000_s04_06_harden_production_google_drive_submission_urls.sql` adds a private lexical helper and a `BEFORE INSERT` trigger on `deliverable_versions`. The trigger checks the parent deliverable workflow and applies the strict Google Drive policy only to `production`; `client_submission` records retain their separately accepted provider policy. The existing `submit_deliverable_version` command therefore receives the stricter validation within its same transaction without a lifecycle rewrite.

Required implementation sequence:

1. Review both exact append-only migration sources together with this specification. A review finding is resolved only through a new forward migration; do not edit either accepted migration in place.
2. You are authorized to apply each migration using Supabase MCP `apply_migration` in the provided order—first `20260820153000_s04_06_harden_production_google_drive_submission_urls.sql`, then `20260821100000_s04_06_allow_incomplete_client_project_planning.sql`— record the migration path/name and application result for each. Do not substitute dashboard edits, generic ad-hoc DDL, or a destructive reset.
3. After both applications succeed, generate `src/lib/database.types.ts` through Supabase MCP from the resulting schema and write the returned source unchanged. The derived file must not be hand-edited.
4. Application work follows the applied migrations and generated types. A failed or partial remote application blocks dependent implementation until a new reviewed forward migration resolves it.

The target remains `jsf-pm-dev` only. Preproduction and production are out of scope.

---

## 4. Authorization matrix

| Actor/effective capacity | List/detail/history | Create/edit/archive planning | Submit version | Report link | Deliverable comment | Formal review/release/delivery |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | Yes | Yes | Yes | Yes | Yes | Out of scope — no S04-06 control |
| active `pm_lead` | Yes | Yes | Yes | Yes | Yes | Out of scope — no S04-06 control |
| active `pm_watcher` | Yes | No | No | Yes | Yes, advisory | No |
| active production assignee | only permitted project data | No planning governance unless separately a Lead/Admin | Yes, only where RPC authorizes | Yes | Yes if project membership permits | No |
| unrelated PM / non-member / Client | No safe project workspace access | No | No | No | No | No |

The existing current workspace only admits Admin/PM users. This matrix still defines the action boundary so that a future E6 Operator consumer cannot accidentally inherit PM governance capabilities.

---

## 5. Lifecycle boundary for S04-06

### 5.1 States that may be displayed

`pending`, `awaiting_internal_review`, `awaiting_client_review`, `approved`, `changes_requested`, and `delivered` may be rendered from authoritative data using `DELIVERABLE_STATUS_MAP`.

### 5.2 State changes permitted in this item

| Current state | S04-06 action | Result | Evidence created |
|---|---|---|---|
| `pending` | submit a valid production URL | `awaiting_internal_review` through RPC | next immutable `deliverable_version` |
| `changes_requested` | submit a valid production URL | `pending → awaiting_internal_review` through RPC | next immutable `deliverable_version` |
| any state where the RPC rejects submission | no browser state change | safe failure, reload/retain authoritative state | none fabricated |

The exact transition is owned by the database command. S04-06 must not expose a general status select and must not update `deliverables.status` directly.

### 5.3 Actions deliberately deferred to S04-07

- Internal approval and changes-requested feedback.
- Transition to `awaiting_client_review`.
- Any Client-facing decision.
- Transition to `approved` or `delivered`.
- Retry/release shortcuts.

Formal feedback returned in history is read-only context only. Its presence never authorizes a new action in this item.

---

## 6. Component and file architecture

### 6.1 File changes

```text
src/lib/deliverables/
├── actions.ts                         # NEW: Server Actions for this item; keep under 400 lines
├── commands.ts                        # REUSE; no lifecycle rewrite
├── queries.ts                         # MODIFY: explicit read shapes only
├── schemas.ts                         # REUSE
└── validators.ts                      # MODIFY: mirror the reviewed lexical contract for immediate feedback

src/components/shared/projects/
├── project-workspace/
│   ├── project-workspace-shell.tsx    # MODIFY: receive initialDeliverables; replace placeholder; add Activity tab
│   ├── project-activity-tab.tsx       # NEW: safe completion/reopen-cycle activity projection
│   └── placeholders/
│       └── deliverables-tab-placeholder.tsx # REMOVE import/use after replacement
└── project-deliverables/              # NEW
    ├── deliverables-tab.tsx           # top-level client interaction boundary
    ├── deliverable-list.tsx           # responsive list/table
    ├── deliverable-card.tsx           # mobile/card presentation
    ├── deliverable-status-badge.tsx   # centralized map renderer
    ├── deliverable-create-dialog.tsx  # planning form
    ├── deliverable-edit-dialog.tsx    # planning metadata only
    ├── deliverable-detail-sheet.tsx   # history, comments, report entry point
    ├── deliverable-submit-dialog.tsx  # focused Drive URL submission form
    ├── deliverable-history.tsx        # immutable version timeline
    ├── formal-feedback-history.tsx    # read-only exact-version feedback
    ├── deliverable-comments-section.tsx
    ├── deliverable-link-report-dialog.tsx
    └── deliverable-archive-dialog.tsx

src/app/[locale]/(protected)/admin/proyectos/[id]/page.tsx # MODIFY
src/app/[locale]/(protected)/pm/proyectos/[id]/page.tsx    # MODIFY
supabase/migrations/20260820153000_s04_06_harden_production_google_drive_submission_urls.sql # APPLY through Supabase MCP
messages/es-MX.json                                         # MODIFY
messages/en-US.json                                         # MODIFY
__tests__/deliverables/deliverable-actions.test.ts          # NEW
__tests__/projects/deliverables-workspace.test.tsx           # NEW
```

Do not create dedicated `/deliverables/[id]` routes in S04-06. The deliverable detail is project-workspace context and belongs in a sheet/dialog. A direct route may be introduced only when a later accepted IA requirement needs it.

### 6.2 Server-rendered data flow

Both project detail pages must extend their existing parallel server query with:

```ts
listProjectDeliverables(supabase, project.id)
```

Pass the result into `ProjectWorkspaceShell` as `initialDeliverables`.

`ProjectWorkspaceShell` passes the project, `initialDeliverables`, effective capacity, and locale to `DeliverablesTab`. It must preserve the internal-project explanation, but the explanation becomes part of `DeliverablesTab` rather than a separate placeholder.

After a successful mutation, the client component calls `router.refresh()` so server-rendered list data returns to the authoritative state. Optimistic UI is permitted only for transient pending feedback; it must be reverted immediately on a rejected command and never invent a version, feedback, link report, or state transition.

### 6.3 Activity-tab completion

S04-06 also completes the currently missing fifth workspace tab: **Activity** (`Actividad`). It is intentionally narrow and truthful.

- Add an `Activity` tab after `Members` in `ProjectWorkspaceShell`.
- Render `ProjectActivityTab` from the already server-fetched `ProjectCompletionCyclesView[]` passed as `cycles`.
- Display only real safe-projection fields: completion/reopen timestamps, cycle number, override flag, unfinished-work counts, duration, and reopen reason where returned.
- Reuse the existing completion-cycle presentation component where it avoids duplication, but do not query raw `audit_logs`, synthesize timeline entries, or claim that every project event is represented.
- When no safe activity exists, render a localized empty state that says no project lifecycle activity is available yet. Do not render fabricated counts or future calendar/archive controls.

---

## 7. Server Action contract

**New module:** `src/lib/deliverables/actions.ts`

This module must begin with `"use server"`, use `requireSession(await cookies())`, create the typed SSR client, validate browser input with the existing Zod schemas, call the narrow command adapter, and revalidate only the affected Admin/PM project workspace paths on success.

### 7.1 Required actions

| Action | Input | Required server checks | Command | Success effect |
|---|---|---|---|---|
| `createDeliverableAction` | `CreateDeliverableInput` | Admin/PM role, project eligibility gate, task/project relation, active compatible assignee | `createDeliverable` | Revalidate workspace; return created deliverable. |
| `updateDeliverableAction` | `{ deliverableId, projectId, input }` | Admin/PM role; deliverable belongs to project; current state allows planning edit | `updateDeliverable` | Revalidate workspace. |
| `archiveDeliverableAction` | `{ deliverableId, projectId, reason? }` | Admin/PM role; deliverable/project relation | `archiveDeliverable` | Revalidate workspace. |
| `submitDeliverableVersionAction` | `SubmitDeliverableVersionInput` plus trusted project context derived server-side | authenticated actor; schema; deliverable exists and is visible to actor | `submitDeliverableVersion` | Revalidate workspace; return version result. |
| `reportDeliverableLinkAction` | `ReportBrokenLinkInput` plus trusted project context derived server-side | authenticated actor; schema; deliverable/version relationship and member visibility | `reportBrokenLink` | Revalidate workspace; return report result only. |
| `createDeliverableCommentAction` | `{ projectId, deliverableId, body }` | Admin/PM in current workspace; schema uses `target_type: "deliverable"` | `createComment` | Revalidate workspace. |
| `listDeliverableCommentsAction` | `deliverableId` | authenticated actor; existing RLS-safe scope | `listComments(supabase, deliverableId, "deliverable")` | Return comments only. |
| `getDeliverableDetailAction` | `deliverableId` | authenticated actor; RLS-safe scope | `getDeliverableDetail` | Return detail/history or safe not-found outcome. |

### 7.2 Action rules

1. The action accepts IDs only as untrusted input. It checks any parent/child relationship from server reads before mutation.
2. A generic PM role is insufficient for governance. A PM Watcher must be denied create/edit/archive. The underlying RLS/RPC is authoritative; the action must not turn a Watcher into a Lead by trusting a passed capacity.
3. The submission action does **not** accept a `version_number`, `submitted_by`, `submission_provider`, or status. The RPC produces all of those facts.
4. The link-report action does **not** mutate local `status`, `current_version_number`, or history. On success, show only a receipt toast and refresh.
5. `revalidatePath` must target real localized concrete paths or use an approved correct invalidation strategy. Do not rely on placeholder route-group strings as a substitute for verifying refresh behavior.
6. Actions must return the shared `CommandResult<T>` shape. Map the public error code to localized user copy in the client; do not render `error.message` directly as product copy.

### 7.3 Error handling matrix

| Error code | UI response |
|---|---|
| `VALIDATION_FAILED` | Highlight the affected form field when known; otherwise show safe localized validation message. |
| `UNAUTHORIZED` | Leave UI state unchanged, close no evidence/history, show safe permission error. |
| `NOT_FOUND` | Close stale detail sheet after safe notice and refresh workspace. |
| `INVALID_TRANSITION` | Retain/reload authoritative detail. Explain that submission is not available in the current state. |
| `INVARIANT_VIOLATION` | Explain only the user-actionable setup requirement, such as incomplete client-project setup or incompatible assignment. |
| `CONFLICT` | Refresh authoritative data and show safe conflict notice. Never fabricate a successor version. |
| `UNKNOWN` | Preserve entered non-sensitive form text in client state where reasonable; show generic retry notice. |

---

## 8. User interface specification

### 8.1 `DeliverablesTab`

**Type:** Client Component.  
**Props:**

```ts
interface DeliverablesTabProps {
  project: ProjectDetail;
  initialDeliverables: DeliverableListItem[];
  effectiveCapacity: "admin" | "pm_lead" | "pm_watcher";
  locale: string;
}
```

Responsibilities:

- Render the internal-project unavailable state without a false CTA.
- Derive `canManagePlanning`, `canComment`, and client-project readiness from server-provided data.
- Render a setup banner when client organization or active Client membership is missing. The banner must say planning setup is incomplete; it must not claim that the Drive link has been checked.
- Render a primary “New deliverable” action only when the actor is Admin/Lead, the project is eligible, and project lifecycle does not suppress the operation.
- Provide status and assignee filters locally over the bounded project list; no client-side filter may reveal data not supplied by the server.
- Offer list and mobile-card presentations. Do not require horizontal scrolling to read status, assignee, deadline, or current version.

### 8.2 Deliverable list/card

Every item displays:

- title;
- `DeliverableStatusBadge` (icon + text + localized accessible label);
- assignee name/avatar when safely available;
- current version number, rendered as `v{n}`; `v0` means no submission exists;
- submission, internal-review, and client-delivery dates when present;
- stalled indicator only when `is_stalled === true` from the safe representation;
- an explicit “Open details” control; and
- contextual planning/submit actions only when authorized.

Do not infer activity, receipt, review outcome, or link availability from a deadline or from a state icon.

### 8.3 `DeliverableCreateDialog`

Use React Hook Form and `zodResolver(CreateDeliverableSchema)`.

Fields:

1. **Title** — 1–200 characters.
2. **Task/work context** — select only current-project non-deleted tasks returned from safe data. Display title and existing status; do not accept a free-form task ID.
3. **Assignee** — select only compatible active project members. Display name and capacity label.
4. **Specifications** — plain text, 1–5000 characters. Render as text later; never interpret as HTML.
5. **Submission deadline** — optional date/time.
6. **Internal review deadline** — optional date/time.
7. **Client delivery deadline** — optional date/time.

Fixed/non-editable values:

- `project_id` comes from workspace context.
- `workflow_type` is always `"production"` and is not rendered as a choice.
- `status`, version number, timestamps, actor fields, provider, and audit fields never appear in the form.

On success, close the dialog, announce a localized success message, and refresh. The success message must say the deliverable was planned; it must not say it was submitted or sent to a Client.

### 8.4 `DeliverableEditDialog` and archive

- Edit only title, specifications, assignee, and the three existing deadline fields.
- Render status, version count, workflow type, and history as read-only context.
- Suppress edit controls when the actor is a Watcher or state is not `pending`/`changes_requested`.
- Archiving requires `AlertDialog` confirmation with optional bounded reason. It never deletes versions or feedback and must not be offered as a substitute for lifecycle completion.

### 8.5 `DeliverableSubmitDialog`

This is a dedicated, focused submission form, not a generic URL component.

Fields:

1. **Google Drive share URL** (`submission_url`) — required.
2. **Submission note** (`submission_note`) — optional, 1000-character maximum.

Behavior:

1. Validate with `SubmitDeliverableVersionSchema` before network submission for immediate feedback.
2. On submit, call `submitDeliverableVersionAction`; server validation and RPC validation must run again.
3. Disable duplicate submission while pending.
4. On success, close dialog, display a receipt such as “Version v{n} was recorded for internal review,” then `router.refresh()`.
5. On any failure, keep inputs visible, do not increment a local version number, and do not switch local status.

The UI must state that only Google Drive HTTPS share links are accepted and that the application records the link without opening or validating the remote content.

### 8.6 `DeliverableDetailSheet`

Use shadcn `Sheet`, with a full-width mobile treatment, focus trap, Escape close, visible close action, localized title/description, and minimum 44×44px primary targets.

Sections, in order:

1. **Header:** deliverable title, status badge, current version badge, and safe assignee summary.
2. **Planning context:** specifications as plain text and available deadlines.
3. **Next authorized action:** submission CTA only when the actor/state permit it. Never show review/release/delivery controls in S04-06.
4. **Immutable version history:** `DeliverableHistory`.
5. **Formal review history:** `FormalFeedbackHistory`, visually distinct and read-only.
6. **Internal discussion:** `DeliverableCommentsSection`.
7. **Report a link issue:** available only against a concrete historical version.

### 8.7 `DeliverableHistory`

For every `deliverable_version`, in descending version order:

- render exact `version_number`;
- render submitter identity only when supplied by the safe query;
- render submitted timestamp using locale formatting;
- render submission note as plain text when present;
- render provider label as Google Drive for a production record;
- present the stored link as a normal outbound user action using `target="_blank"` and safe `rel` attributes, with clear text that opening it leaves the application; and
- place the version-scoped feedback immediately beneath its matching version.

There is no editable state, drag handle, delete option, “replace version” action, or client-generated timeline event.

### 8.8 `FormalFeedbackHistory`

Formal feedback is not collaboration. Each entry must show:

- exact reviewed version (`version_id` matched to visible version number);
- stage (`internal` or future `client`) as history metadata;
- immutable decision label from authoritative stored value;
- reviewer identity and timestamp when safely returned;
- comments as plain text.

S04-06 renders it but does not create it. Use a visual treatment distinct from normal comments, with an explanatory label such as “Formal review record.”

### 8.9 `DeliverableCommentsSection`

- Fetch only when the detail sheet opens through `listDeliverableCommentsAction`.
- Show author name, capacity snapshot, timestamp, and plain-text body.
- Allow a PM Watcher to post an advisory comment, but not to mutate planning or versions.
- Use the existing comment schema limits.
- Do not label a comment “approval,” “rejection,” or “changes requested.” Those terms are reserved for `deliverable_feedback`.

### 8.10 `DeliverableLinkReportDialog`

- Opens from a selected concrete version, never from an unsubmitted `v0` deliverable.
- Requires a plain-text report reason, 1–1000 characters.
- Clearly states: “This sends an internal report. The application does not test the link and the deliverable status will not change.”
- On success, close dialog, show a receipt confirmation only, and refresh.
- Do not expose incident status management (`open`, `resolved`, `dismissed`) in S04-06.

---

## 9. URL-validation contract

The current validator mirrors the committed RPC’s Google-host prefix check. S04-06 must use the shared validator; it must not introduce a divergent browser-only regex.

The intended accepted production-link policy is lexical only:

- HTTPS scheme only;
- host is exactly `drive.google.com` or `docs.google.com`;
- no embedded credentials;
- no control characters;
- no localhost/private/reserved IP literal;
- no nonstandard port; and
- no server dereference.

### Approved hardening requirements

The current host-prefix regex is not the complete accepted policy. The S04-06 schema-hardening slice must establish the following exact lexical contract at both the browser-feedback and authoritative database command boundaries:

1. Parse the candidate as an absolute URL without requesting it.
2. Require `https:` exactly.
3. Require hostname exactly `drive.google.com` or `docs.google.com`, case-insensitively after URL normalization; no suffix, subdomain, IP literal, localhost, or alternate host is accepted.
4. Require an empty username, password, and port.
5. Reject raw ASCII control characters and whitespace in the submitted string; do not silently normalize an unsafe raw value into an accepted value.
6. Require a non-empty path beginning with `/`.
7. Limit the submitted URL to 2048 bytes.
8. Never fetch, resolve, preview, download, scan, proxy, or authenticate against the URL.

The database/RPC path is authoritative. The shared TypeScript validator provides identical immediate feedback but must not be represented as the final boundary.

The migration review must include an explicit accepted/rejected corpus exercised against the TypeScript validator and the applied database command. At minimum it covers valid Drive/Docs URLs; HTTP; credentials; port; whitespace/control characters; localhost/IP literals; look-alike hostnames; suffix/subdomain tricks; empty path; malformed URLs; an over-2048-byte URL; and a valid URL with an ordinary query/fragment. A mismatch is a security stop condition.

---

## 10. Localization and accessibility

Add semantically stable keys under `projects.workspace.deliverables`, with matching structures in both catalogs. At minimum cover:

- tab title, empty state, unavailable internal-project state, and incomplete-client setup state;
- create/edit/archive/submit/detail/history/link-report labels and descriptions;
- field labels, placeholders, help text, character counters, and validation errors;
- every lifecycle label used by `DELIVERABLE_STATUS_MAP`;
- immutable version, formal-feedback, and advisory-comment distinctions;
- safe mapped error-code messages;
- no-fetch/link-report truthfulness text; and
- accessible names for external links, filters, sheet close, and destructive confirmation.

Required interaction baseline:

- all dialogs and sheets have meaningful title and description semantics;
- all primary actions, menus, filters, and form controls are keyboard-operable;
- status and submission state are never encoded only by color or an icon;
- list/card rendering remains usable at a narrow mobile viewport;
- focus returns to the invoking control after close; and
- external links communicate that they open a third-party destination.

---

## 11. Focused test contract

Use the established Vitest, React Testing Library, MSW, and current project test conventions. Do not add Playwright or a redundant live database test suite.

### 11.1 Required tests

| Area | Minimum assertions |
|---|---|
| Deliverable action validation | Create/update/submit/report actions reject malformed browser input before calling adapters. |
| Eligibility gate | Internal project, missing client organization, missing active Client member, cross-project task, and incompatible assignee are denied without creating a deliverable. |
| Incomplete planning project | A planning client project without client onboarding still allows only eligible internal task work; its deliverable create CTA/action is denied until organization and Client member prerequisites exist. |
| Authorization | Watcher cannot create/edit/archive/submit; Watcher can open allowed history, comment, and report a version link. Forged IDs do not gain authority. |
| Submission | Valid accepted current Drive shape reaches the command adapter once; duplicate clicks are prevented; success refreshes authoritative state; failure creates no local version/state. |
| Immutable history | Versions render by exact number; feedback appears under the matching `version_id`; no editable history controls render. |
| Formal/informal separation | Formal feedback and comments have distinct labels/sections; comments do not render as review decisions. |
| Link report | Requires a concrete version and non-empty reason; calls report adapter; success leaves displayed lifecycle status/current version unchanged. |
| Status mapping | Every state badge uses `DELIVERABLE_STATUS_MAP` and includes localized text plus icon. |
| Localization/accessibility | New catalogs retain exact semantic-key parity; dialogs/sheets have localized accessible names and keyboard close behavior. |
| Activity tab | Renders only `ProjectCompletionCyclesView` fields, includes a truthful empty state, and does not query raw audit logs or fabricate events. |

### 11.2 Explicitly deferred test cases

Internal review decisions, stale-review concurrency, resubmission-after-change-request, Client release, Client review, approval, and final delivery are S04-07/E7 test scope. S04-06 must not add a mock implementation simply to cover those scenarios.

---

## 12. Acceptance criteria

- [ ] Internal projects render a truthful unavailable Deliverables state and never present a production-deliverable create form.
- [ ] Production deliverable planning is allowed only from an eligible client project with server-derived client/task/member context.
- [ ] Create/edit/archive operations use Server Actions and the existing command adapters; no browser component writes a table directly.
- [ ] A permitted submitter can submit a valid accepted Google Drive share URL and receive the RPC-produced immutable version result.
- [ ] A failed submission never creates a local fake version, fake status transition, or fabricated history entry.
- [ ] Detail history renders all returned versions and formal feedback exactly as immutable evidence.
- [ ] Formal feedback and collaboration comments remain visibly and semantically distinct.
- [ ] A link report is recorded only against a real version, shows a receipt, and cannot mutate the displayed lifecycle/current version.
- [ ] UI state badges use the centralized semantic mapping with icon and localized text in both themes.
- [ ] Both locales have exact key parity and all primary workflows are keyboard-operable and narrow-viewport usable.
- [ ] The Activity tab is present and limited to the existing safe completion/reopening-cycle projection; no raw-audit or fabricated activity implementation is introduced.
- [ ] The approved production URL-hardening and planning-stage client-project constraint migrations are applied to `jsf-pm-dev` through Supabase MCP in migration-version order, and the resulting `database.types.ts` is generated unchanged as derived source before dependent implementation evidence.
- [ ] No S04-07 review/release/delivery control, Client portal behavior, provider integration, external URL fetch, or unrelated schema change is introduced.
- [ ] Focused tests named in Section 11 pass before the work item is claimed complete; the full repository verification remains the sprint-closeout responsibility in S04-08.

---

## 13. Stop conditions

| Discovery | Required response |
|---|---|
| A production deliverable can be created for an internal project, missing-client project, cross-project task, or incompatible member through the server/data boundary | Stop. Record the exact invariant gap; do not compensate with a browser-only check. |
| The TypeScript validator and authoritative database/RPC validation disagree on any accepted/rejected corpus case | Stop. Correct through a reviewed forward migration and aligned validator; do not ship a browser-only exception. |
| The safe query cannot return a project’s versions, feedback, comments, or actor-scoped deliverable detail without broad/raw access | Stop. Request a role-safe projection/command; do not query broad audit/base tables from the browser. |
| Submission requires Drive access, previewing, downloading, scanning, redirect following, or reachability validation | Stop. The scope permits lexical validation and external navigation only. |
| A request adds internal review, Client review, release, approval, delivery, or Client notification behavior | Defer to S04-07/E7/E8. |
| A mutation needs a schema/RLS/RPC/type-generation change outside the two approved S04-06 reconciliation slices | Stop and obtain separately authorized schema work. |
| An authorization, immutable-history, URL-handling, localization, or accessibility defect is found | Block integration until corrected and re-verified at the appropriate scope. |

---

## 14. Handoff to S04-07

S04-06 provides the data and presentation foundation that S04-07 consumes:

- the current authoritative version and full immutable history;
- the status-aware detail sheet;
- the submission/resubmission entry point;
- localized status/error surfaces; and
- the preserved distinction between formal feedback, comments, and link reports.

S04-07 adds only the authoritative internal-review, changes-requested, release, and delivery controls. It must not rewrite S04-06 history, submission, or link-report boundaries.

---

*Spec updated 2026-08-20 from the Sprint 04 plan, the Project Owner’s accepted planning-stage/client-onboarding and URL-hardening decisions, current repository implementation, and the curated JSF wiki lifecycle, audit, security, and architecture sources.*
