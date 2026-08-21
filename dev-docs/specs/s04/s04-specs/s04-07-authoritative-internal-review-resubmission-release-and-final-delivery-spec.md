# S04-07 — Implement Authoritative Internal Review, Resubmission, Release, and Final Delivery

**Sprint:** S04  
**Work Item:** S04-07  
**Status:** Implementation-ready draft  
**Last reviewed:** 2026-08-21  
**Spec authority:** `dev-docs/specs/s04/s04-e04-e05-project-workspace-and-production-deliverable-lifecycle-sprint-plan.md`, Section 5, S04-07; `s04-02-workspace-command-boundary-spec.md`; and the committed deliverable command/data model.  
**Dependencies:** S04-01 through S04-06, especially the committed `src/lib/deliverables/` actions, schemas, commands, queries, safe view models, and project Deliverables workspace.

---

## 1. Objective

Complete the internal production-deliverable lifecycle without implementing a Client portal or Client review UI.

An authorized Admin or active PM Lead must be able to:

1. make one authoritative, immutable **internal** review decision against the exact current submitted version;
2. require non-empty formal feedback when requesting changes;
3. let the existing eligible submitter/Lead resubmit after an internal change request, producing a successor immutable version that returns to internal review;
4. transition an internally approved deliverable to `awaiting_client_review` only through the authoritative internal-review command; and
5. mark an already authoritative `approved` deliverable as `delivered` through the existing constrained command.

S04-07 must preserve the distinction between formal feedback, informal internal comments, immutable versions, and independent link-report incidents. It must never infer that a Client reviewed content, that a file was sent, or that an external notification provider delivered anything.

---

## 2. Scope and hard boundaries

### 2.1 In scope

- Internal review controls for production deliverables in the existing Admin and PM project workspaces.
- A focused review dialog backed by `review_deliverable` with `stage = "internal"` fixed server-side.
- Immutable, version-scoped review feedback presentation and post-command authoritative refresh.
- The existing resubmission entry point after an internal change request; no alternate upload/version writer.
- Read-only `awaiting_client_review` state presentation.
- A focused, confirmed final-delivery action backed by `mark_deliverable_delivered`, only for an already `approved` deliverable.
- Safe conflict/stale-decision handling, localized error mapping, accessibility, and focused application tests.
- Semantic status/decision presentation additions only where the existing central mapping lacks them.

### 2.2 Explicitly out of scope

- Client portal routes, Client-facing projections, Client review controls, Client feedback entry, Client notification UX, or Client authentication work. Those belong to E7.
- A second release command, direct status selector, typed `deliverables` status update, direct feedback insert, or direct version insert.
- Editing, deleting, correcting, reordering, or replacing a `deliverable_version` or `deliverable_feedback` record.
- File upload, Google Drive API access, link fetch/preview/scan/redirect handling, storage/proxy behavior, or provider authentication.
- Provider dispatch, email, WhatsApp, Realtime expansion, notification delivery receipts, scheduling, hosted-environment changes, or analytics.
- New route handlers, dedicated `/deliverables/[id]` routes, Client routes, Playwright, or a duplicate live database test suite.
- Schema, RLS, RPC, migration, generated-type, or dashboard changes. If the existing committed command boundary is insufficient, stop and request a separately scoped schema decision.

### 2.3 Non-negotiable security and truthfulness rules

- Every mutation derives the actor from `requireSession(await cookies())`. Browser payloads never supply actor ID, role, membership capacity, stage, version number, reviewer identity, status, or authorization facts.
- A PM Watcher may inspect allowed history and post an advisory collaboration comment, but cannot review, release, deliver, edit planning metadata, archive, or submit a version.
- A formal internal decision is an immutable `deliverable_feedback` record attached to the command-selected current `version_id`. A collaboration comment is never formal feedback.
- A successful internal approval means the database recorded the decision and advanced the workflow. It does not mean a Client was contacted, notified, or has reviewed the deliverable.
- A successful final-delivery command means the application recorded the `delivered` lifecycle state. It does not mean a file was uploaded, transferred, received, emailed, messaged, or otherwise externally delivered.
- User-visible errors must be localized, stable, and non-leaking. Never render RPC/PostgREST text, internal function names, RLS details, UUIDs, raw URLs, stack traces, or provider payloads.

---

## 3. Authority reconciliation and lifecycle model

### 3.1 Canonical command behavior

The committed SQL/RPC contract is authoritative over ambiguous shorthand in older prose. S04-07 extends it; it does not redesign it.

| Operation | Authoritative command | Required current-state behavior | Result |
|---|---|---|---|
| Internal approval | `review_deliverable(deliverable_id, 'internal', 'approved', comments?)` | Current status must be `awaiting_internal_review`; actor must be Admin or active PM Lead | Writes immutable internal feedback for the exact current version and moves the deliverable to `awaiting_client_review`. |
| Internal changes requested | `review_deliverable(deliverable_id, 'internal', 'changes_requested', comments)` | Current status must be `awaiting_internal_review`; comments must be non-empty; actor must be Admin or active PM Lead | Writes immutable internal feedback for the exact current version and moves the deliverable to `pending`. |
| Resubmission | Existing `submit_deliverable_version(...)` | Existing eligible submitter, Admin, or PM Lead; current status `pending` or future `changes_requested` | Writes the next immutable version and moves it to `awaiting_internal_review`. |
| Final delivery | `mark_deliverable_delivered(deliverable_id)` | Current status must be `approved`; actor must be Admin or active PM Lead | Moves the deliverable to `delivered` and records the command-owned lifecycle evidence. |

### 3.2 Reconciled meanings of “release” and “changes requested”

1. **No second release control exists or is needed in S04-07.** Internal approval is the one authoritative operation that atomically creates the immutable internal feedback and transitions to `awaiting_client_review`. The UI must not expose a duplicate “Release to Client” button, a generic state picker, or a second action after approval.
2. **An internal change request returns the deliverable to `pending`, not `changes_requested`.** The internal reviewer’s immutable feedback is the authoritative explanation for the rework. The existing resubmission flow then creates a successor version and returns to `awaiting_internal_review`.
3. The `changes_requested` lifecycle state remains displayable because it is consumed by the existing resubmission UI and is required by the later Client-review flow. S04-07 does not manufacture this state through an internal-review action.
4. `approved` is an authoritative state produced by the later Client review command. S04-07 may render and, when such authoritative data already exists, allow the Admin/Lead-only final-delivery action. It must not add Client decision UI or a substitute approval action.

### 3.3 Allowed S04-07 state transitions

| Current state | Authorized S04-07 action | Authoritative result | UI rule |
|---|---|---|---|
| `pending` | Existing submit action after internal changes requested | `awaiting_internal_review` plus next immutable version | Show resubmit only to the existing permitted submitter/Admin/Lead. |
| `awaiting_internal_review` | Internal approve | `awaiting_client_review` plus immutable internal feedback | Admin/Lead-only review dialog. No separate release action. |
| `awaiting_internal_review` | Internal changes requested with required comments | `pending` plus immutable internal feedback | Admin/Lead-only review dialog. Existing submit control becomes available after refresh. |
| `awaiting_client_review` | None in S04-07 | Unchanged | Render truthful waiting state; no Client decision or delivery button. |
| `changes_requested` | Existing submit action only | `awaiting_internal_review` plus next immutable version | This branch is preserved for future Client feedback; no S04-07 review shortcut. |
| `approved` | Mark delivered | `delivered` | Admin/Lead-only confirmed delivery action. |
| `delivered` | None | Unchanged | Read-only history and state only. |

The browser must never optimistically append feedback, increment a version, change a status badge, or mark delivery before the command succeeds and authoritative data is refreshed.

---

## 4. Existing implementation baseline

S04-07 must extend the committed S04-06 architecture rather than recreate or bypass it.

| Asset | Current responsibility | S04-07 requirement |
|---|---|---|
| `src/lib/deliverables/schemas.ts` | Zod schemas including `ReviewDeliverableSchema` | Keep the established review constraints. Add a narrow browser-action input shape only if needed; the server action fixes `stage` to `internal` itself. |
| `src/lib/deliverables/commands.ts` | Typed adapters for `reviewDeliverable` and `markDeliverableDelivered` | Reuse these adapters. Do not write feedback or lifecycle columns directly. |
| `src/lib/deliverables/auth-checks.ts` | Server-derived membership/capacity checks | Reuse or extend focused helpers to verify the target project and Admin/active-Lead authority. Never trust UI-derived capacity. |
| `src/lib/deliverables/actions.ts` | S04-06 planning/submission/detail/link-report actions | Do not grow this file beyond the repository line limit merely for S04-07. |
| `src/lib/deliverables/comment-actions.ts` | Deliverable comment actions | Preserve its separate server-action module and direct imports. |
| `src/lib/deliverables/queries.ts` | Safe deliverable/detail/version/feedback representations | Reuse the safe detail projection; preserve exact `feedback.version_id` grouping. |
| `src/components/shared/projects/project-deliverables/deliverable-detail-sheet.tsx` | Current context sheet and submit/history/comments presentation | Add only state- and capacity-gated review/delivery entry points. |
| `deliverable-history.tsx` and `formal-feedback-history.tsx` | Immutable timeline and version-scoped feedback display | Extend presentation only; no mutable feedback affordance. |
| `deliverable-submit-dialog.tsx` | Existing submission/resubmission interaction | Reuse unchanged as the sole version writer. |
| `src/lib/status-maps.ts` | Central lifecycle semantics | If a formal-decision mapping is necessary, add a single central `REVIEW_DECISION_MAP`; do not hard-code decision colors/icons in multiple components. |

### 4.1 Server-action export constraint

The production build requires every export from a `"use server"` module to be a direct async function declaration. Therefore:

- Create a focused `src/lib/deliverables/review-actions.ts` module for S04-07 if it keeps `actions.ts` below 400 lines.
- Export each Server Action directly from its owning module as `export async function ...`.
- Do **not** re-export a Server Action from another `"use server"` module.
- UI components and tests import review actions directly from `@/lib/deliverables/review-actions`.

This is a module-boundary requirement, not a reason to relax the repository file-size rule.

---

## 5. Authorization and server-action contract

### 5.1 Authorization matrix

| Actor/effective capacity | Read history | Submit/resubmit | Internal review | Transition to `awaiting_client_review` | Mark delivered | Comment/report link |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | Yes | Yes | Yes | Only through internal approval | Yes, only from `approved` | Yes |
| active `pm_lead` | Yes | Yes | Yes | Only through internal approval | Yes, only from `approved` | Yes |
| active `pm_watcher` | Yes | No | No | No | No | Yes, advisory/reporting only |
| active production assignee | Permitted project/detail data | Yes, only via existing command authorization | No | No | No | Existing permitted comment/report behavior |
| unrelated PM, non-member, Client | No safe Admin/PM workspace access | No | No | No | No | No |

### 5.2 Required Server Actions

**New module:** `src/lib/deliverables/review-actions.ts`

| Action | Browser input | Required server behavior | Command | Success effect |
|---|---|---|---|---|
| `reviewDeliverableAction` | `{ deliverableId, decision, comments? }` | Validate UUID/decision/comment shape; require session; obtain safe deliverable/project context; verify Admin or active PM Lead for that exact project; construct command input with `stage: "internal"`; call adapter | `reviewDeliverable` | Revalidate concrete Admin/PM workspace paths; return RPC result only. |
| `markDeliverableDeliveredAction` | `{ deliverableId, projectId }` | Validate IDs; require session; verify Admin or active PM Lead; verify deliverable belongs to supplied project and is visible; call command only if authoritative state is `approved` | `markDeliverableDelivered` | Revalidate concrete Admin/PM workspace paths; return RPC result only. |

### 5.3 Action rules

1. The review action must never accept `stage`, `version_id`, `version_number`, `reviewed_by`, `status`, or a release flag from the browser. The command selects and locks the actual current version.
2. The review action may use server reads to classify a stale/hidden target before mutation, but the RPC remains the lifecycle and concurrency authority.
3. If a review command is rejected because another decision already changed the current state, map the outcome to safe stale/conflict copy for this workflow, retain no local decision, and refresh the detail/list.
4. Approval comments are optional and limited by the existing review schema. Change-request comments are mandatory after trimming and must be 1–5000 characters.
5. The delivery action requires a localized `AlertDialog` confirmation. It does not accept a delivery note, recipient, provider, URL, or externally asserted receipt because the authoritative command accepts none.
6. Revalidation must target concrete localized routes, including the current Spanish and English Admin/PM project paths. Do not reintroduce App Router route-group strings as cache paths.
7. Return the project-standard `CommandResult<T>` shape. Clients map `error.code` to localized product copy and never render `error.message` as user-facing text.

### 5.4 Review and delivery error handling

| Result code or condition | Required UI behavior |
|---|---|
| `VALIDATION_FAILED` | Keep the dialog open; show field-level error for comments when applicable; do not call the adapter for malformed browser input. |
| `UNAUTHORIZED` | Keep local history unchanged; show safe permission notice; do not reveal membership/capacity details. |
| `NOT_FOUND` | Close stale dialog/sheet safely and refresh the workspace. |
| `INVALID_TRANSITION` or stale review rejection | Treat as stale authoritative state; close only the confirmation/review dialog, show localized stale-review notice, and refresh detail/list. |
| `CONFLICT` | Same stale-state recovery: no local feedback/status creation, refresh authoritative state. |
| `INVARIANT_VIOLATION` | Show safe action-specific copy, such as required change-request feedback. |
| `UNKNOWN` | Preserve entered non-sensitive comments where possible; show generic retry copy; do not alter displayed history/state. |

---

## 6. User interface specification

### 6.1 Detail-sheet action gating

`DeliverableDetailSheet` remains the project-workspace context surface. Extend its props with callback-based review and delivery entry points. It must not call lifecycle adapters directly.

#### `awaiting_internal_review`

- Show a primary **Review current version** CTA only for an Admin or active PM Lead.
- The CTA must name the current authoritative version, for example: “Review v{currentVersion}”.
- Assignees who are not Leads, Watchers, and all other unauthorized actors see read-only current state and history only.
- Do not render actions for a prior version, even if it has no feedback.

#### `pending` after internal changes requested

- Reuse the existing submit/resubmit CTA and dialog.
- The sheet must show the newly recorded internal feedback in the exact prior-version history before the user resubmits.
- It must not show an approve/release shortcut while no current submitted version awaits review.

#### `awaiting_client_review`

- Render a localized, truthful waiting state such as “Released for Client review. Client review is not available in this workspace.”
- Do not render a Client review button, “approve for client,” “send email,” “notify Client,” delivery button, or inferred receipt.

#### `approved`

- Show a **Mark delivered** CTA only to an Admin or active PM Lead.
- The CTA opens the focused confirmation dialog described below.
- It is acceptable for this state to be encountered from existing authoritative data even though the Client-review UI belongs to E7.

#### `delivered`

- Render a read-only delivered state and complete immutable history.
- Do not show submit, review, release, edit, archive-as-completion, or delivery controls.

### 6.2 `DeliverableReviewDialog`

**New shared feature component:** `deliverable-review-dialog.tsx`

Use React Hook Form with a focused Zod resolver. The client form may expose only:

1. **Decision** — `approved` or `changes_requested`.
2. **Formal review comments** — optional for approval; mandatory for changes requested; 5000-character maximum.

The dialog must also render read-only context:

- deliverable title;
- exact current version number;
- current `awaiting_internal_review` status badge;
- a clear formal-review explanation distinct from collaboration comments;
- warning text that a submitted decision becomes immutable.

Behavior:

1. The primary action calls `reviewDeliverableAction` once and disables duplicate submission while pending.
2. On valid approval, close the dialog, announce that the deliverable is now awaiting Client review, then refresh authoritative workspace data.
3. On valid changes requested, close the dialog, announce that rework was requested and a new version is required, then refresh authoritative workspace data.
4. On rejected/stale command, never append local feedback or transition local state. Apply the error matrix in Section 5.4.
5. There is no control for selecting another historical version, editing a formal decision, or changing stage.

### 6.3 `DeliverableDeliveryDialog`

**New shared feature component:** `deliverable-delivery-dialog.tsx`

Use shadcn `AlertDialog` and require explicit confirmation.

Required content:

- title and description stating that the action records the deliverable as delivered;
- current deliverable title and `approved` state as read-only context;
- a clear notice that the application does not upload, transfer, email, message, or verify external receipt;
- cancel and confirm actions with localized accessible names.

On success, close the dialog, announce the recorded lifecycle result, and refresh. On failure, preserve the sheet’s authoritative state and show mapped safe copy.

### 6.4 Formal feedback and history presentation

`FormalFeedbackHistory` and `DeliverableHistory` must preserve the existing exact-version grouping. For every formal entry, render:

- matching reviewed version number;
- `internal` stage label;
- centralized semantic decision badge with text and icon;
- reviewer identity only when returned by the safe projection;
- localized reviewed timestamp;
- comments as plain text, when present.

Do not describe a formal internal approval as Client approval or final delivery. Formal feedback remains visually distinct from collaboration comments and link reports.

### 6.5 Accessibility and narrow viewport baseline

- Review and delivery dialogs require title/description semantics, keyboard operation, Escape/cancel behavior, visible focus, and focus return to their invoking CTA.
- Decision controls have accessible labels and are never represented only by color/icon.
- The change-request comment error is programmatically associated with its field.
- The current-version label, formal feedback, state badge, and action state remain readable without horizontal scrolling at narrow widths.
- Any status text, reviewer fallback, deadline label, workflow label, or provider label touched by S04-07 must be localized. Do not preserve existing hard-coded Spanish/English text in newly touched output.

---

## 7. File architecture

### 7.1 Expected changes

```text
src/lib/deliverables/
├── review-actions.ts                         # NEW: direct async Server Action exports only
├── schemas.ts                                # MODIFY only if a narrow action input schema is needed
├── errors.ts                                 # MODIFY only for safe stale-review mapping if absent
├── queries.ts                                # MODIFY only for an already-safe required field/projection gap
└── commands.ts                               # REUSE: reviewDeliverable / markDeliverableDelivered

src/components/shared/projects/project-deliverables/
├── deliverable-review-dialog.tsx             # NEW
├── deliverable-delivery-dialog.tsx           # NEW
├── deliverable-detail-sheet.tsx              # MODIFY: state/capacity-gated callbacks and notices
├── deliverable-history.tsx                   # MODIFY only for decision presentation if required
├── formal-feedback-history.tsx               # MODIFY: central decision mapping and localized labels
└── deliverables-tab.tsx                      # MODIFY: owns dialog state and callback wiring

src/lib/status-maps.ts                        # MODIFY only if REVIEW_DECISION_MAP is needed
messages/es-MX.json                           # MODIFY
messages/en-US.json                           # MODIFY
__tests__/deliverables/deliverable-actions.test.ts       # MODIFY
__tests__/deliverables/schemas.test.ts                    # MODIFY if action input schema changes
__tests__/projects/deliverables-workspace.test.tsx        # MODIFY
CHANGELOG.md                                  # MODIFY only through Antigravity’s required changelog workflow
```

Do not create a new route, API handler, migration, or generated source file for this work item.

### 7.2 File-size and Server Action strategy

The repository’s 400-line limit remains appropriate. The S04-06 build issue was caused by a prohibited Server Action re-export, not by the size limit.

For S04-07:

- keep each production implementation file at or below 400 lines;
- split by ownership: planning/submission actions, collaboration-comment actions, and review/delivery actions remain separate modules;
- keep dialog state in `deliverables-tab.tsx` and presentation in focused dialog/sheet/history components;
- do not create a generic lifecycle mega-module or a generic status-update component;
- do not solve file-size pressure by weakening type safety, hiding logic in untyped utility objects, or allowing overloaded components to grow beyond the limit.

---

## 8. Localization contract

Add matching semantic keys under `projects.workspace.deliverables` in `messages/es-MX.json` and `messages/en-US.json`.

At minimum include:

- review CTA, dialog title/description, immutable-decision warning, decision labels, comment field labels/help/validation, approval success, change-request success, stale-review, and generic review failure;
- waiting-for-Client-review title/description that does not imply a notification or Client receipt;
- delivery CTA, confirmation title/description, no-external-delivery truthfulness text, delivery success, and delivery failure;
- internal-stage/formal-feedback labels, reviewer fallback, and decision badge accessible text;
- mapped `UNAUTHORIZED`, `NOT_FOUND`, `INVALID_TRANSITION`, `CONFLICT`, `INVARIANT_VIOLATION`, and `UNKNOWN` messages for review/delivery;
- accessible names/descriptions for decision controls, review submit, dialog close, and delivery confirmation.

Catalog structures must have exact semantic-key parity. Use localized text in every newly touched component; do not render adapter error messages directly.

---

## 9. Focused test contract

Use the established Vitest, React Testing Library, MSW, and current project conventions. Existing database/RPC tests remain the authority for database locking, RLS, immutable-trigger enforcement, and state transitions. Do not add Playwright or a redundant live database suite.

### 9.1 Action and schema tests

Extend `__tests__/deliverables/deliverable-actions.test.ts` to cover:

1. Admin and active PM Lead can invoke internal review; PM Watcher, production assignee without Lead capacity, unauthenticated actor, unrelated PM, and forged project/deliverable IDs are denied.
2. `reviewDeliverableAction` rejects malformed input and whitespace-only changes-request comments before calling the adapter.
3. The action fixes stage to `internal`; a browser cannot request Client stage or supply reviewer/version/status facts.
4. The action verifies target project relationship before command invocation.
5. Approval reaches `reviewDeliverable` once with the required internal stage and produces no browser-invented status/history.
6. Change request reaches the same adapter only with non-empty feedback and preserves the formal-feedback-versus-comment distinction.
7. A stale/invalid-transition/conflict response triggers the safe stale-state result path and does not create local feedback.
8. `markDeliverableDeliveredAction` permits only Admin/Lead, verifies project/deliverable relation, calls the delivery adapter once, and rejects non-`approved` authoritative state before command invocation where safe to determine.
9. Successful review/delivery invalidates all concrete localized Admin/PM project workspace paths.

### 9.2 Workspace component tests

Extend `__tests__/projects/deliverables-workspace.test.tsx` using the existing jsdom/RTL convention.

Minimum assertions:

1. Only Admin/Lead sees Review current version for `awaiting_internal_review`; Watcher and non-Lead assignee do not.
2. The review dialog identifies the exact current version and does not offer historical-version selection or Client stage selection.
3. `changes_requested` requires a formal comment and approval permits an optional comment.
4. Review success refreshes authoritative state and displays the returned formal feedback under the exact reviewed version.
5. Stale/error results leave displayed status/version/history unchanged and show safe localized recovery copy.
6. After an internal change request, the existing resubmit CTA is the only lifecycle continuation; no release shortcut is rendered.
7. `awaiting_client_review` displays a truthful read-only wait state and no Client review, delivery, email, or notification-claiming control.
8. Only Admin/Lead sees Mark delivered for an `approved` deliverable; the confirmation dialog states the no-external-delivery boundary.
9. A delivered deliverable is read-only and has no review, submit, edit, archive-as-completion, or delivery CTA.
10. Formal feedback and collaboration comments use distinct headings/semantics and decision badges use the centralized mapping.
11. Dialog accessible names, required-comment error association, Escape/cancel behavior, and narrow-layout action readability are covered.
12. Both catalogs preserve semantic-key parity for the newly added review/delivery namespace.

### 9.3 Explicitly deferred tests

- Client login, Client portal projection, Client review controls, Client-generated feedback, and Client notifications belong to E7.
- Provider dispatch, email, WhatsApp, delivery receipt, and external file reachability belong to E8 or provider-specific work.
- No test may claim that `delivered` proves external file transfer or Client receipt.

---

## 10. Acceptance criteria

- [ ] Internal review controls appear only for an Admin or active PM Lead and only while a production deliverable is authoritatively `awaiting_internal_review`.
- [ ] Every internal decision is created solely by the constrained review command, is immutable, uses `stage = internal`, and belongs to the exact command-selected current version.
- [ ] A change request requires non-empty formal comments at browser and server boundaries, creates formal feedback, returns the deliverable to `pending`, and does not create a local fake lifecycle event.
- [ ] Existing resubmission creates a successor immutable version and returns to `awaiting_internal_review`; no review/release shortcut bypasses this loop.
- [ ] Internal approval atomically advances the deliverable to `awaiting_client_review`; no duplicate release control or direct status writer is introduced.
- [ ] `awaiting_client_review` is rendered read-only and truthfully without Client decision UI or provider-delivery claims.
- [ ] Final delivery uses `mark_deliverable_delivered` only for authoritative `approved` records and only for Admin/Lead actors.
- [ ] The final-delivery confirmation clearly states that it records an application lifecycle state and does not perform or verify an external transfer/receipt.
- [ ] PM Watchers, non-Lead assignees, unrelated PMs, unauthenticated actors, and forged inputs cannot review, release, or deliver.
- [ ] Stale, conflict, invalid-transition, and failed actions refresh authoritative state and never add fake feedback, versions, badges, or delivery records.
- [ ] Formal feedback, informal comments, and link reports remain visually and semantically separate.
- [ ] All new visible copy is localized in exact es-MX/en-US parity and review/delivery interactions are keyboard-operable and narrow-viewport usable.
- [ ] No schema/RLS/RPC/type-generation change, Client portal feature, provider activation, URL dereference, direct lifecycle write, route handler, or oversized production implementation file is introduced.
- [ ] Focused tests in Section 9 pass before S04-07 is claimed complete. Full sprint-closeout verification remains S04-08 responsibility.

---

## 11. Stop conditions

| Discovery | Required response |
|---|---|
| The committed review/delivery RPC behavior differs from the state table in Section 3 | Stop. Record the exact command/source discrepancy; do not imitate a lifecycle transition in React or a table update. |
| An internal-review action would need a Client stage, manually selected historical version, direct feedback insert, direct status write, or new release RPC | Stop. Preserve the existing constrained command boundary and request a scoped decision if necessary. |
| The safe deliverable detail cannot identify the current version, exact feedback version relationship, target project, or actor-scoped visibility | Stop. Request a safe projection/command; do not read broad base/audit data from the browser. |
| A review/delivery action cannot distinguish Admin/active Lead from PM Watcher through server-derived membership | Stop. Do not trust client capacity or loosen the role gate. |
| A request adds Client review, Client approval, Client notification, Client portal behavior, email/WhatsApp delivery, or external receipt verification | Defer to E7/E8. |
| A change requires a migration, RLS/RPC update, type regeneration, dashboard operation, or remote schema action | Stop S04-07 and obtain separately scoped schema authorization. |
| A lifecycle, authorization, immutable-history, localization, accessibility, or Server Action module-export defect is found | Block integration until corrected and re-verified at the appropriate scope. |

---

## 12. Handoff to E7 and S04-08

S04-07 leaves a clean boundary for later work:

- E7 owns Client-visible projections, Client review decisions, Client changes-requested state creation, and any Client-side collaboration experience.
- E8 owns notification/provider dispatch and delivery receipts.
- S04-08 owns sprint-wide navigation, closeout evidence, and the single full repository verification run after all Sprint 04 work is integrated.

S04-07 must not rewrite S04-06 planning/submission/history boundaries. It adds only authoritative internal review, the visible mandatory re-review loop, truthful `awaiting_client_review` presentation, and constrained final delivery for already approved records.

---

*Spec written 2026-08-21 from the accepted Sprint 04 plan, S04-02 command-boundary specification, S04-06 handoff, current committed S04-06 implementation structure, and the authoritative deliverable RPC lifecycle.*
