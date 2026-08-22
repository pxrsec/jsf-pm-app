
# Sprint 05 — E6 Operator Execution and E7 Client Collaboration

## 1. Sprint purpose

Sprint 05 turns the internal project and production-lifecycle foundation into two complete, deliberately constrained execution experiences:

1. **E6 — Operator Execution Experience:** Operators can see and execute only their assigned work from a fast, mobile-first, online-only agenda, then submit production deliverable versions through the established Google Drive-only command boundary.
2. **E7 — Client Collaboration, Requests, and Production Review:** authenticated Client members can use a minimal, project-safe portal to act on directly assigned requests, submit requested external assets as immutable public-HTTPS URLs, and make a version-scoped decision on production deliverables released to Client review.

**Sprint goal:** Starting from the existing role-safe shell and S04 workspace, an Operator can complete an assigned connected-work journey without seeing other operators or project-internal information; a Client can complete a directly assigned request and its required submissions, then independently approve or request changes to a project production deliverable in `awaiting_client_review`, without observing internal work, comments, audit history, or another Client’s direct assignments.

This sprint is a product workflow sprint. It must consume the established Supabase data policy, RLS, safe projections, constrained commands, immutable-version model, and transactional audit/notification-event boundary. It must not recreate those controls in browser state or route code.

---

## 2. Starting baseline and binding contracts

Treat the integrated S04 baseline on `dev` as the starting point. S05 extends it; it does not redesign it.

### 2.1 Existing contracts to preserve

- **Role and session authority:** `profiles.role` remains the sole application-role authority. Session/profile resolution, protected layouts, route guards, same-origin mutation handling, Zod validation, and safe error mapping remain the established entry boundary.
- **Roles and capacities:** application roles are `admin`, `pm`, `operator`, and `client`. `pm_lead`, `pm_watcher`, `operator`, and `client` are project-membership capacities, not interchangeable roles.
- **Localization:** Spanish (`es-MX`) is the default visible locale; English (`en-US`) is secondary. Protected Spanish routes remain unprefixed and English protected routes remain under `/en/`. All new user-visible text, accessible labels, errors, empty states, confirmations, and urgency descriptions must have semantic-key parity in both catalogs.
- **Rendering and UI structure:** Next.js App Router and Server Components remain the default. Client components are limited to interactive leaves: filters, drawers, forms, confirmation dialogs, intentional outbound-link actions, and mutation feedback. Route-specific components remain route-local; shared application components belong in `src/components/shared/`; shadcn/ui primitives remain in `src/components/ui/`.
- **Theme system:** use the installed semantic token system and persisted light/dark preference. Workflow urgency, status, and review states must never rely on color alone and must remain legible in both themes.
- **Data access and mutation:** use typed `@supabase/ssr` clients, the committed generated `src/lib/database.types.ts`, explicit least-privilege projections, and existing constrained database commands. Never manually edit generated database types, use Prisma, use runtime `DATABASE_URL`, introduce browser privilege, or write authoritative lifecycle fields directly from UI code.
- **Immutable evidence:** `deliverable_versions`, `deliverable_feedback`, and audit history remain immutable. Corrections create an authorized new transition/version; UI code may not mutate historical records.
- **External URLs:** validation is lexical and non-fetching. The application does not resolve, request, preview, proxy, download, scan, host, authenticate against, or otherwise inspect submitted URLs. An outbound link is opened only through deliberate user action.
- **Reference and sandbox data:** preserve the protected reference scenarios. Demonstrations that mutate task, deliverable, review, or submission state use the mutable sandbox only.

### 2.2 S04 handoff assumptions

S05 assumes S04 delivered the internal project/task workspace and internal production lifecycle, including:

- compatible project membership and direct assignment boundaries;
- task planning and constrained task transitions;
- production deliverable planning, immutable Google Drive version submission, internal PM review, release to `awaiting_client_review`, and final delivery controls;
- the mandatory production re-review sequence after Client-requested changes:

```text
changes_requested → pending → awaiting_internal_review → awaiting_client_review
```

S05 must expose the Operator and Client surfaces that consume these capabilities. It must not add a shortcut around the re-review loop.

---

## 3. Scope and explicit boundaries

### 3.1 In scope

- Operator `My Day` agenda, a browseable own-work project index, per-project own-task lists, required concrete single-task detail routes, production submission UX, online failure/retry UX, and role-appropriate navigation.
- Client portal dashboard, browseable client-safe multiple-project access, project detail that combines only the Client’s own direct work with project-scoped released production reviews, directly assigned client-request tasks, client-submission deliverables, Client production-review decisions, and Client-safe archive entry points where the existing projection supports them.
- Reusable, role-safe query/command adapters that map the existing views and constrained commands to application presentation.
- Explicit connection, pending, success, conflict, permission-denied, validation, empty, and error states for the new journeys.
- Focused automated tests and manual localhost journeys that prove both positive paths and cross-actor isolation.
- A factual Sprint 05 closeout record, with exact deferred work and any schema-gap decision recorded plainly.

### 3.2 Explicitly excluded

- External notification dispatch, WhatsApp, Resend, webhooks, QStash, Workflow schedules, delivery receipts, alert cadence, provider activation, and notification-queue operations. Transactional in-app event creation may occur through existing commands, but S05 must not claim an email, WhatsApp, or scheduled reminder was sent. These belong to E8.
- Calendar implementation, archive search/filter expansion, operational metrics, user administration, infrastructure diagnostics, backup/restore work, and system-wide operational screens. These belong to E9/E10. A narrow Client archive entry point is allowed only if it is already safely represented; no new archive policy is invented.
- Offline cache, service worker, persistent agenda cache, deferred action queue, background synchronization, or replay. S05 is online-only.
- Binary upload/storage, Drive API access, link reachability checks, previews, file proxying, or content inspection.
- Public signup, public role selection, new external client authentication model, magic-link notification delivery, and provider configuration changes.
- Broad Realtime publication. `notification_recipients` remains the only approved initial Realtime scope; task and deliverable screens refresh through the established server/rendering path after a completed mutation.
- Preproduction or production changes, direct dashboard edits, generic ad-hoc SQL, destructive reset, and unreviewed database redesign.

---

## 4. Database and Supabase MCP scope

### 4.1 Required S05 Operator-agenda migration

**S05 requires one narrowly scoped Supabase migration for the Project Owner-approved Operator My Day semantics.** It is limited to an authoritative task-assignment timestamp, its lifecycle maintenance on creation/reassignment, and a revised `operator_agenda_view` that supports strict `new` plus completed-task visibility through the end of the current Operator’s stored local calendar day. It must preserve RLS/security-invoker boundaries, regenerate `src/lib/database.types.ts` through Supabase MCP after application to `jsf-pm-dev`, and include focused database/RLS/query evidence.

All other E6/E7 application behavior must consume the existing role-safe views and constrained commands below. S05 does not authorize unrelated schema redesign, direct DDL, dashboard edits, generic ad-hoc SQL, destructive reset, preproduction, or production work.

| S05 consumer | Required existing database boundary |
| --- | --- |
| Operator agenda, own-work project index, per-project own-task list, and canonical task detail | Revised `operator_agenda_view` — only the authenticated Operator’s assigned task/deliverable rows, authoritative `assigned_at`, computed urgency, and completed rows through the Operator’s stored local-day end; server groups/deduplicates returned own rows by project/task. |
| Operator production submission | `submit_deliverable_version()` — locked, authorized production version insertion and transition to `awaiting_internal_review` |
| Client project directory | `client_project_view` — client-safe project information only |
| Client request queue/detail | `client_task_view` plus `transition_task_status()` — only the direct Client assignee may start or complete their own request |
| Client-submission queue/detail | `client_submission_view`, `submit_client_deliverable()`, and `reopen_client_deliverable()` |
| Client production review | `client_deliverable_view` and `review_deliverable()` — project Client decision on the current released version only |
| Link incident reporting | existing constrained link-report command/representation, where exposed |

S05 implementation must first map each read and mutation to the **actual committed migration source and generated types**. Names and fields in the applied repository baseline win over older prose.

### 4.2 When a migration is required

A narrowly scoped Supabase MCP migration is required only if that mapping proves that an E6/E7 requirement has no safe existing projection/command, an existing operation cannot enforce a binding invariant, or the generated types and committed migration source demonstrate a genuine gap.

If such a gap is discovered:

1. Stop only the affected item; do not substitute a direct table write, an elevated browser client, client-side filtering, or a generic API endpoint.
2. Record the missing capability, affected role, exact invariant, required safe columns, and required negative cases in the S05 implementation specification.
3. Limit the migration to that proven gap. It must be forward-only and preserve RLS, `security_invoker` behavior, least-privilege columns, immutable history, audit insertion, notification-event semantics, and existing workflow distinctions.
4. Apply the reviewed migration to **`jsf-pm-dev` only** through Supabase MCP, regenerate `src/lib/database.types.ts` through Supabase MCP, and keep source-migration, applied-environment, and generated-type provenance distinct.
5. Do not apply direct DDL, dashboard edits, generic ad-hoc SQL, destructive reset, preproduction, or production changes.

A discovered schema gap is not permission to broaden E6/E7 scope. It is a precise decision point.

---

## 5. Cross-epic workflow invariants

### 5.1 Operator invariants

- Operators may read only their own assigned tasks and deliverables through the revised operator-safe projection: active work plus completed rows retained only through the current Operator’s stored local-day end.
- Operators cannot enumerate project membership, other operators, project-wide task lists, client assignments, internal PM notes, unreleased Client feedback, audit logs, or operational notification data.
- Operator task detail may show only the authorized description, specifications, and safe resources for the selected assigned task.
- Production submission is available only to the authorized assignee or the existing explicitly authorized PM path, only from the valid state, and only through the constrained submission command.
- Failed reads or submissions remain online failures. A retry is a new user action and stays subject to normal authorization, idempotency, and conflict semantics.

### 5.2 Client invariants

- A Client can see only active projects where they are an active Client member.
- A Client can see and mutate only their directly assigned `client_request` tasks and `client_submission` deliverables. Two Client members on the same project must not see or mutate each other’s direct assignments.
- Client project/review access is project-scoped, but direct Client work remains assignee-scoped.
- Client-safe views must exclude internal project descriptions/notes, operator assignments, internal deadlines, internal tasks, collaboration comments, internal feedback, audit data, operational notification data, and mixed-visibility base-table fields.
- A direct Client may transition a client-request task only `pending → in_progress`, `pending → completed`, or `in_progress → completed`. A Client never reassigns, edits PM-written scope/resources/deadline/priority, sets `blocked`, reopens, or sends a request to `in_review`.
- A client-request task cannot complete while any active child client submission remains non-terminal. The authoritative command must reject the completion; UI preflight is explanatory only.
- `client_submission` uses exactly `pending → submitted`. It never enters internal review, Client review, approval, `changes_requested`, delivered, formal feedback, or review-inactivity behavior.
- Only a PM Lead/Admin may reopen a submitted client submission, with an audited non-empty reason. The next client input is a new immutable version; history is never overwritten.
- A Client review decision concerns the exact current version of a production deliverable in `awaiting_client_review`. The first valid locked decision made by an active Client member is authoritative and records that actor. A stale/competing attempt must surface a safe conflict and reload authoritative state.
- A Client `changes_requested` decision requires a non-empty comment and starts the already-binding internal re-review loop. It cannot return a production deliverable directly to Client review after an operator resubmission.

### 5.3 URL invariants

| Workflow | Accepted URL policy |
| --- | --- |
| Production deliverable submitted by Operator | Raw absolute HTTPS URL; exactly `drive.google.com` or `docs.google.com`; no credentials, explicit port, raw ASCII control character, whitespace, backslash, empty path, unsafe normalization dependency, or value over 2,048 bytes. |
| Client submission | Raw absolute public HTTPS URL; no credentials, control characters, localhost/private/reserved IP literal, or nonstandard port; known hosts classify as Google Drive, Dropbox, OneDrive, WeTransfer, or Frame.io; another syntactically valid public HTTPS host classifies as `other_https`. |

Both policies are lexical only. A detected provider is classification, not reachability or content safety proof.

---

## 6. Work items and delivery sequence

### S05-01 — Reconcile E6/E7 application contracts against the integrated baseline

**Objective:** establish a single exact read/mutation map before UI work consumes role-safe surfaces.

**Scope**

1. Inspect the committed S04 data adapters, current migration sources, generated types, repository OpenAPI source, and existing tests to identify the actual views, RPCs, input fields, safe error outcomes, and return shapes used by the integrated baseline.
2. Produce the implementation-spec mapping for every S05 page/action. It must name the server-side session context, projection/command, role/capacity precondition, allowed state, expected success shape, safe failure classes, audit/notification consequence, and browser refresh behavior.
3. Confirm that role-safe rendering is based on `operator_agenda_view`, `client_project_view`, `client_task_view`, `client_submission_view`, and `client_deliverable_view`, or their committed constrained equivalent. No role-specific screen may read a mixed-visibility base table with `select("*")`.
4. Confirm that E6/E7 mutations use the committed lifecycle command boundary. Route handlers and Server Actions may derive the actor, validate input, enforce same-origin protection where required, call the narrow command, map known safe outcomes, and return a safe representation. They may not encode lifecycle authorization rules independently.
5. Identify any true gap under Section 4 before dependent UI implementation begins.

**Completion conditions**

- Every S05 read and mutation has an exact, committed source boundary and a role-safe output contract.
- The implementation spec identifies the direct-assignee boundary separately from project-member review visibility.
- No presumed field, RPC, endpoint, or type name remains unverified in the spec.
- Any required migration is recorded as a bounded stop condition before application code depends on it.

---

### S05-02 — Deliver the Operator My Day agenda and own-work navigation

**Objective:** replace the Operator placeholder with a mobile-first work surface containing only the signed-in Operator’s active assigned work.

**Scope**

1. Activate the real localized Operator navigation route and remove only the placeholder that it replaces. Preserve existing protected-route behavior and `/en/` equivalents.
2. Render the agenda data-first through the approved operator-safe read boundary. The screen must not perform a broad project/task query and filter it in the browser.
3. Present a clear `My Day` agenda sorted according to the authoritative urgency/deadline representation. The UI must distinguish, with localized text and non-color cues:
   - new/assigned within 24 hours;
   - normal progress with more than 24 hours remaining;
   - due within 24 hours;
   - overdue;
   - completed.
4. Provide an own-work project index at `/operador/proyectos` and a project-scoped own-task list at `/operador/proyectos/[project-id]`. Both surfaces derive exclusively from `operator_agenda_view`: they group/deduplicate only the signed-in Operator’s assigned rows by the already-safe `project_id` and `project_name` fields. They must not query a project-wide task list, reveal other Operator/Client/PM assignments, enumerate membership, expose internal project notes, or provide project administration.
5. Provide minimal own-work filtering/grouping within the agenda and project list. A project card may show only the Operator-safe project name and a count/summary derived from their own returned task rows; it must not become a PM-style project workspace.
6. Implement meaningful localized loading, empty, error, and retry states. Error copy must be actionable but must not expose Supabase errors, RLS policy details, IDs, stack traces, or private project context.
7. Use a responsive card/list pattern suitable for a 375px viewport first. Critical information—task title, urgency, deadline, project-safe context, current task state, and the next primary action—must remain usable without horizontal scrolling.
8. Preserve Server Component rendering for the agenda and project-browse pages. Confine interactive sorting/filtering to a small client leaf only when it adds demonstrated value.

**Completion conditions**

- An Operator sees only their own authorized agenda records, can browse a project index built from those own records, and can open each project only to its own assigned tasks.
- Agenda ordering and urgency labels match the revised authoritative server representation; client code does not invent or silently diverge from canonical urgency rules.
- Operator project/task deep links and forged identifiers cannot reveal a different Operator’s task/deliverable or any project-wide task/member data.
- The agenda works at narrow mobile widths, through keyboard navigation, and in both themes/locales.

---

### S05-03 — Deliver Operator task detail and production-submission flow

**Objective:** let an Operator inspect an assigned task and submit a production deliverable without weakening the internal lifecycle boundary.

**Scope**

1. Provide a required localized, bookmarkable single-task route at `/operador/tareas/[task-id]` (and its `/en/` equivalent). A project/agenda card may open the route directly; a mobile `Sheet` may be a progressive interaction layer only when it navigates to and preserves the same canonical task URL. The route contains only the Operator-safe title, description, specifications, safe resources, task status, relevant deadline, assigned production deliverables, and permitted actions. It must resolve the task exclusively through the authenticated Operator agenda projection; no base-table detail read is permitted.
2. Provide intentional outbound resource navigation. Display a provider/host label where useful; never fetch, preview, or validate reachability of a resource URL.
3. Implement a focused production submission form for an assigned eligible deliverable:
   - raw Google Drive URL input with immediate shared-validator feedback;
   - optional allowed submission-note field only if the committed command supports it;
   - submit pending state, double-submit protection, and accessible inline validation;
   - final authoritative server command execution and a truthful confirmation based on its returned result.
4. A valid submission must produce a successor immutable version and move the production deliverable to `awaiting_internal_review` through the command boundary. A form success must refresh the agenda/detail from the authoritative server state.
5. Present safe handling for expected failures: malformed/rejected URL, expired/changed assignment, invalid current state, permission denial, duplicate/replayed attempt, and stale/conflicting state. Do not leave optimistic fake history or a false completed UI state.
6. When a Client has requested changes, the Operator flow must make the revision path clear: transition into the revision cycle, submit the new version, and show that it returns to **internal** review. Never label a new upload as released to the Client.
7. Include only the existing authorized Operator comment affordance if it is already available for the assigned task/deliverable. Comments remain separate from formal immutable feedback and cannot imply a review decision.

**Completion conditions**

- The Operator can open any own assigned task through its canonical task URL, but cannot use a task or project URL to disclose a different Operator’s work or project-wide data.
- The Operator can submit only an assigned, eligible production deliverable through the established constrained command.
- The UI rejects and explains nonconforming production URLs without network access to the submitted target; the server remains authoritative.
- A successful submission yields an immutable new version and authoritative `awaiting_internal_review` state.
- The revision flow preserves `changes_requested → pending → awaiting_internal_review → awaiting_client_review`; E6 provides no bypass.
- Failed online requests are not persisted for deferred replay and do not mutate visible state until the server accepts them.

---

### S05-04 — Deliver the Client portal, safe project dashboard, and direct-request queue

**Objective:** replace the Client placeholder with a minimal, Client-safe workspace for active project context and directly assigned requests.

**Scope**

1. Activate Client navigation only for routes that are real and usable after this item. The primary Client entry experience contains a multiple-project index, an own-work queue, and a real entry point to released production reviews. It must not resemble the PM workspace.
2. Render project cards/list from the Client-safe project projection only. A Client may open a required project detail route at `/cliente/proyectos/[project-id]`, which combines only that Client’s own direct requests/submissions for the selected project with project-scoped released production reviews and links those reviews only to the real canonical review routes delivered by this item. It must not expose a project-wide task list, another Client’s direct work, membership, internal description, internal deadlines, comments, audit history, or PM controls.
3. Render the direct-request queue from the direct-assignee Client task projection. It must support all active Client-member projects and may be filtered by a project ID only after the Client-safe server read; sort with the approved priority/overdue/nearest-deadline behavior and distinguish `blocking` priority from `blocked` status without exposing PM-only context.
4. Provide an accessible client-request task detail screen/drawer that contains PM-written client-safe title, description, priority, deadline, safe resources, child client-submission summary, and the currently allowed action.
5. Permit only direct Client transitions `pending → in_progress`, `pending → completed`, and `in_progress → completed`. The UI must not offer assignment, scope edit, deadline edit, priority edit, deletion, reopening, block control, Kanban, internal review, or PM status controls.
6. Before a completion attempt, show a concise server-derived explanation when required child client submissions remain pending. The command result, not a client count, is decisive.
7. Show safe confirmation and result states. If the task completion command is rejected because a child submission is still pending, refresh the client-safe task/submission state and direct the Client to the outstanding requirement without disclosing unrelated details.
8. Deliver the complete Client production-review experience previously sequenced as S05-06: a Client-safe production-review queue at `/cliente/entregables`, bookmarkable detail at `/cliente/entregables/[deliverable-id]`, deliberate outbound opening of the current stored Google Drive URL, approval confirmation, mandatory-comment change request, current-version-safe command handling, and truthful approved/changes-requested results. The Client view remains project-scoped; direct assignment is irrelevant to review access.
9. Client review actions must use `review_deliverable()` with server-fixed `stage = client`; the command selects/locks the current version. Browser input never supplies actor, stage, project membership, status, version identity, or lifecycle target. Stale, competing, unauthorized, and duplicate decisions refresh the authoritative representation without fabricated feedback or state.
10. After approval, show the authoritative `approved` state and explain that final delivery is an existing internal handoff. After a change request, show `changes_requested` and explain that internal revision plus PM re-review are required before a new Client review; neither Client nor Operator UI may bypass that sequence.

**Completion conditions**

- A Client can browse every active client-member project and open a Client-safe project detail containing only their own direct requests/submissions plus project-scoped released production reviews.
- A Client sees only their own direct assignments; two Clients sharing a project remain isolated from each other’s client-request records and client-submission records.
- A Client can start/complete only their own client request through the constrained command.
- A request cannot complete until all active child client submissions are `submitted`; both UI and server outcome remain truthful.
- Any active Client member of a project can open only Client-safe released production-review context for that project, deliberate-open the stored Drive link, and make one authoritative review decision only when the current state is `awaiting_client_review`.
- Client approval/change-request actions are version-scoped, immutable, attributed, conflict-safe, and command-authoritative; a change request requires a non-empty comment and preserves the mandatory internal re-review loop.
- No Client route exposes internal descriptions, comments, internal feedback, audit data, other assignees, or project-wide task views. Client-stage feedback returned by the Client-safe review projection is the sole permitted feedback representation.

---

### S05-05 — Deliver client-submission planning consumption, URL submission, and correction loop

**Objective:** let a Client submit requested external assets while preserving its intentionally separate terminal workflow.

**Scope**

1. In the Client request detail, present only directly assigned `client_submission` deliverables with PM-written title/specifications, submission deadline, current status, current version/provider/URL when available, and safe correction history.
2. Build the Client submission form around the accepted public-HTTPS policy:
   - accept only an absolute public HTTPS URL under the shared validation rule;
   - reject credentials, controls, localhost/private/reserved IP literals, and nonstandard ports;
   - display the detected provider classification only after lexical validation;
   - accept syntactically valid unknown public hosts as `other_https`;
   - never make a server-side remote request.
3. Provide a confirmation summary before the terminal submission. The summary must communicate URL, detected provider, destination deliverable, and the fact that the action records a link—not that the application uploaded, scanned, or verified external content.
4. Submit through the constrained direct-assignee command. On success, refresh Client-safe data and show `submitted` as terminal for that client-submission cycle.
5. Ensure the UI never renders formal review, approval, request-changes, delivered, internal-review deadline, client-review deadline, feedback, or review-inactivity controls for `client_submission`.
6. When a PM Lead/Admin has reopened a submitted Client deliverable with an audited reason, present the safe correction context and allow the direct Client to provide a replacement URL. The replacement becomes a new immutable version. The Client cannot self-reopen or edit the old version.
7. Do not expose raw internal audit data. The safe correction history must contain only fields expressly available in the Client projection.

**Completion conditions**

- Only the direct Client assignee can read or submit a client-submission deliverable.
- A valid public HTTPS submission records a new immutable version, derives provider classification, and transitions `pending → submitted` through the authoritative command.
- `submitted` is terminal for Client action until an authorized PM/Admin reopen; historical submission URLs are never edited.
- Client-submission screens cannot invoke or present production-review lifecycle actions.
- No submitted URL is dereferenced, previewed, scanned, proxied, or treated as reachable by the application.

---

### S05-06 — Absorbed into S05-04 by S05-DEC-02

**Disposition:** the Project Owner accepted S05-DEC-02 on 2026-08-22: the complete Client production-review queue/detail/action scope is delivered with S05-04 to avoid a temporary read-only review surface, dead navigation, duplicate presentation, and later replacement work.

**Implementation treatment:** S05-06 creates no separate routes, components, action wrappers, test files, or closeout evidence. Its original scope is binding inside S05-04. Client-safe link-incident reporting remains deferred unless a later accepted scope supplies a Client-safe current version ID; the committed `client_deliverable_view` does not expose one, so S05-04 must not use an internal version lookup as a workaround.

---

### S05-07 — Integrate navigation, recovery states, localization, accessibility, and closeout evidence

**Objective:** make E6/E7 a coherent role-safe application capability rather than disconnected feature pages.

**Scope**

1. Update desktop/mobile authenticated navigation so Operator and Client links point only to implemented routes. Preserve the established language switcher, theme control, sign-out behavior, notification affordance, and role-safe redirect behavior.
2. Add route-specific `loading.tsx`, empty states, error boundaries, and `not-found`/denial treatment where appropriate. Generic errors must not leak security policy, provider responses, raw user URLs, identifiers, stack traces, or database internals.
3. Establish stable catalog namespaces such as `operatorAgenda`, `operatorTask`, `operatorSubmission`, `clientPortal`, `clientRequests`, `clientSubmissions`, `clientReview`, `urgency`, `common`, and `errors`. Maintain exact English/Spanish semantic-key parity.
4. Validate interaction accessibility:
   - primary action controls and resource links have explicit localized accessible names;
   - urgency/status is expressed by text/icon/description as well as color;
   - drawers and dialogs manage focus, support Escape, have title/description semantics, and restore focus on close;
   - forms show labels, inline errors, disabled/pending state, and live feedback as appropriate;
   - primary touch targets meet the 44×44px minimum;
   - essential work can be completed without drag-and-drop, hover-only disclosure, or a desktop-only layout.
5. Preserve Server Component data-first rendering and do not introduce a client-side data cache for agenda/project/task/deliverable data.
6. Write `dev-docs/specs/s05/s05-sprint-05-closeout-verification.md`. It must state changed routes/components/adapters, command/projection mappings, actual automated and manual evidence, role-isolation cases, accessibility/localization checks, schema-operation status, known limitations, and deferred E8/E9/E10 work. It must not claim provider, preproduction, production, live-link reachability, or deployed RLS proof unless separately obtained.
7. Update `CHANGELOG.md` with the implemented user-facing capabilities only.

**Completion conditions**

- An Operator and a Client can navigate from their role shell into the complete S05 journeys without dead placeholders or PM/Admin UI leakage.
- Both locales and themes present equivalent authorized behavior.
- The implementation provides a practical recovery path after validation, authorization, conflict, and connection failures without revealing sensitive detail.
- Closeout documentation states exactly what was implemented, what was verified, whether a migration was required, and what remains deferred.

---

## 7. Focused verification strategy

S05 must add focused coverage for its new role-specific presentation and command-adapter behavior. Existing data-platform migration/RLS/state-machine tests remain the authority for database enforcement; S05 must not duplicate them mechanically. Where S05 discovers a database-policy gap, the affected migration and live database evidence become a bounded prerequisite for that work item.

### 7.1 Required automated evidence

| Area | Required evidence |
| --- | --- |
| Operator agenda isolation and project browsing | Operator agenda/project adapters receive only the authenticated Operator’s rows; grouping and per-project counts derive solely from those rows; foreign project/task/deliverable IDs and another Operator’s deep link are denied or safely absent. |
| Operator task route and urgency | Canonical own-task route renders only the safe selected row; revised server urgency categories and the current-day completed retention rule render with localized text, icon/non-color meaning, and accessible labels. |
| Operator submission | Google Drive local validation mirrors intended feedback; route/adapter sends only safe validated input; pending/double-submit, rejection, conflict, and server-refresh behavior are covered. |
| Online-only behavior | Failed read/submission renders retry guidance but creates no persisted local queue, cache mutation, or deferred replay state. |
| Client project browsing and direct-assignment isolation | Client project detail combines only the selected Client-visible project, that Client’s own requests/submissions, and project-scoped released production review records. Client A cannot receive Client B’s request/submission in list, project detail, or forged route/action attempts, including when both belong to the same project. |
| Client request transitions | Direct Client start/complete behavior is allowed only for the valid task/status; blocked, edit/reassign/reopen/in-review attempts are not offered and safe command failures are handled. |
| Client completion dependency | Pending child client submissions cause a truthful preflight and authoritative rejection; submitted children allow the normal completion path. |
| Client URL submission | Public-HTTPS validation rejects prohibited forms, classifies known/unknown public hosts correctly, never triggers a fetch, and renders `submitted` terminal state. |
| Client correction | A PM/Admin reopen appears only through safe correction context; the Client can submit a new version but cannot modify historical entries or self-reopen. |
| Client production review | Exact-current-version approval and comment-required change request map to the constrained command; stale/competing/unauthorized decisions refresh authoritative state without fabricated feedback. |
| Workflow separation | Client submission never renders production review states/actions; production review never uses the client-submission transition model; change requests preserve the mandatory PM re-review cycle. |
| Localization and accessibility | Catalog parity for all S05 keys; accessible names/states for drawers, forms, confirm dialogs, urgency labels, review actions, and error feedback; keyboard alternatives to every primary action. |

Use the established Vitest, React Testing Library, and MSW conventions. Avoid snapshot-only coverage for role isolation, form state, lifecycle outcomes, and accessibility. Do not introduce Playwright under S05.

### 7.2 Manual localhost journeys

Run these journeys against the mutable sandbox after focused automated coverage is green:

1. **Operator isolation, project browsing, and task deep links:** sign in as Operator A, inspect `My Day`, browse `/operador/proyectos`, open each own-work project and a canonical `/operador/tareas/[task-id]` route, then attempt known Operator B project/task/deliverable URLs. Confirm only Operator A’s assigned task rows are visible and no project-wide task/member data is disclosed.
2. **Operator normal submission:** from an assigned production task, submit a conforming Google Drive URL; confirm the new version and `awaiting_internal_review` state appear after authoritative refresh.
3. **Operator revision path:** use a production deliverable already in Client-requested changes, begin the revision path, submit a new valid version, and confirm it returns to `awaiting_internal_review`, not directly to Client review.
4. **Operator online failure:** simulate an interrupted request using the established local test approach; confirm a clear retry state and no deferred queued action after refresh.
5. **Client multi-project and direct-work isolation:** sign in as Client A with multiple active projects, browse `/cliente/proyectos`, open each Client-safe project detail, and confirm each shows only Client A’s direct request/submission work plus project-scoped released production reviews. Confirm Client A cannot see Client B’s direct work on a shared project; repeat from Client B.
6. **Client request:** Client A starts a directly assigned request, attempts completion with a pending child client submission and receives a truthful block, submits the outstanding asset, then completes the request.
7. **Client submission URL policy:** submit one valid known-provider URL and one valid unknown public HTTPS URL; verify provider labels. Attempt credential-bearing, non-HTTPS, localhost/private IP, nonstandard-port, malformed, and whitespace/control-character forms; confirm rejection without an external request.
8. **Client submission correction:** as an authorized internal actor, reopen a submitted client submission with a reason through the established existing path; return as the direct Client and submit a replacement. Confirm the old version remains visible only through permitted safe history and the replacement is a new version.
9. **Client production approval:** as Client A, open a production deliverable in `awaiting_client_review`, intentionally open the Drive link, approve through confirmation, and confirm the authoritative approved state.
10. **Client changes request and concurrency:** on another released production deliverable, request changes with required comment. Confirm `changes_requested`; execute/observe a competing Client review attempt and confirm first valid decision wins with a safe conflict response. Verify the next production upload requires internal re-review.
11. **Accessibility/mobile/localization:** repeat the primary Operator submit and Client request/review actions at a 375px viewport by keyboard and touch-target-compatible controls in both locales; inspect light and dark theme legibility.

### 7.3 Completion verification boundary

At sprint closeout, execute the repository’s established full verification workflow once after S05 integration and record actual results in the closeout document. This sprint-plan creation does not run repository verification, modify the repository, activate providers, apply a migration, or touch hosted environments.

---

## 8. Sprint definition of done

Sprint 05 is complete only when all of the following are true:

1. Operators have a mobile-first `My Day` experience plus a browseable own-work project index, per-project own-task lists, and required canonical task URLs. Every Operator surface renders only their assigned rows through the revised approved safe projection; it never becomes a project-wide workspace.
2. Operator task detail exposes only role-safe task/resources/deliverable context and supports an online-only production submission flow with reliable pending, error, retry, and authoritative-refresh behavior.
3. Operator urgency is server-derived from the accepted `new`, `normal`, `upcoming`, `urgent`, `overdue`, and current-local-day `completed` semantics; it is localized and non-color-dependent.
4. Operator production submissions are Google Drive-only, lexical/non-fetching, immutable-version creating, and route to `awaiting_internal_review` through the established command boundary.
5. Client users have a minimal role-safe portal that supports multiple active client-member projects, Client-safe project detail, direct client requests/submissions, and project-scoped released production-review work.
6. Client A cannot read or mutate Client B’s direct request/submission data even when both are active members of the same project.
7. Client-request task actions remain limited to allowed direct-assignee transitions; a task completion fails while an active child client submission remains pending.
8. Client submissions accept only valid public HTTPS URLs, classify provider lexically, create immutable versions, and transition only `pending → submitted`. They never expose a review or delivery lifecycle.
9. Client-submission reopen/correction is PM Lead/Admin-controlled, reasoned/audited, and preserves prior immutable versions.
10. Client production reviews apply only to the current version of a released production deliverable in `awaiting_client_review`; approvals and changes requests are immutable, attributed, conflict-safe, and use the constrained review boundary.
11. A Client change request preserves the mandatory production re-review loop; neither Operator nor Client UI creates a direct `pending → awaiting_client_review` bypass.
12. No Client or Operator surface exposes internal descriptions, comments, internal feedback, audit logs, operational data, another role’s direct work, broad base-table fields, secrets, or authorization internals.
13. No provider dispatch/activation, calendar/metrics/admin scope, offline queue/cache, external URL dereference, binary storage, Prisma/runtime database URL, direct DDL, generic SQL, preproduction, or production activity is introduced.
14. New user-facing content has full Spanish/English catalog parity. Primary interactions are keyboard-operable, screen-reader labeled, focus-safe, non-color-dependent, touch-target compliant, and usable at narrow mobile widths in both themes.
15. Focused automated coverage and the one final integrated repository verification workflow pass with factual recorded outcomes. Manual localhost journeys record both successful role flows and denial/isolation cases.
16. `dev-docs/specs/s05/s05-sprint-05-closeout-verification.md` and `CHANGELOG.md` accurately document the scope, evidence, migration status, known limitations, and deferred E8/E9/E10 work.

---

## 9. Stop conditions and decision boundaries

| Discovery | Required response |
| --- | --- |
| The committed generated types, SQL migration source, API contract, accepted ADRs, and S04 implementation disagree on an E6/E7 projection, command, role, lifecycle, or URL rule | Stop the affected item. Record the exact contradiction and obtain a scoped authoritative decision. Do not choose an interpretation in a component. |
| A required E6/E7 operation lacks a constrained command, safe projection, correct RLS behavior, immutable evidence, or safe error contract | Stop the affected item. Do not use direct base-table writes, browser authority, admin-client fallback, or client-side policy as a workaround. |
| The mapping proves a genuine missing database capability | Create a narrowly scoped migration requirement under Section 4. Do not broaden the sprint or apply unrelated schema changes. |
| A requested feature needs remote URL access, preview, Drive API integration, file upload/storage, or content inspection | Stop. The accepted boundary is URL storage and lexical validation only. |
| A Client request/submission feature would expose another Client’s direct work or internal context | Block integration until safe projection/RLS/query behavior is corrected and re-verified. |
| A change lets Client submission enter production review/delivery states, or lets production re-upload bypass internal review | Block integration. This violates the binding workflow distinction. |
| A feature requires provider dispatch, magic-link delivery, webhook operation, scheduled reminders, or external-provider activation | Defer to E8. Do not add a partial provider path to S05. |
| A feature requires offline cache, queued mutation, service worker, or replay | Reject/defer. v1 remains online-only pending a new ADR. |
| A test/manual journey exposes cross-role/cross-client data, unauthorized mutation, stale-decision corruption, immutable-history mutation, secret exposure, unsafe error output, or accessible-primary-action failure | Block the affected integration until corrected and re-verified. |

---

## 10. Immediate successors

- **E8 — Notification, Scheduling, and External Provider Operations:** activates outbound in-app/WhatsApp/email delivery, preferences, schedules, retries, receipts, and stalled-review behavior for the S05 event contracts. It must preserve the client-submission exclusion from production review-inactivity reminders.
- **E9 — Visibility, Reporting, and Operational Administration:** adds role-safe calendar/feed, archive depth, metrics, notification history, administrative operations, and configuration-presence diagnostics on top of the established E4–E7 workflows.
- **E10 — Quality, Compliance, Release, and Handover:** turns the integrated workflows into a production release through hardening, real-device evidence, legal/provider readiness, backup/restore, controlled onboarding, and operational handover.

## 11. Planning authority

This plan decomposes the accepted E6/E7 roadmap scope and records S05-DEC-01, the narrow approved Operator-agenda schema/projection decision. It introduces no other product, security, provider, or release decision. Subject-specific authority remains:

1. Project Owner decisions and accepted ADRs for material architectural/security decisions.
2. Repository-tracked Supabase migrations for database shape, RLS, views, functions, and policy.
3. The repository OpenAPI source for HTTP vocabulary and safe interface contracts.
4. The PRD for product behavior and acceptance outcomes.
5. The SAD for application architecture and UI organization.
6. This sprint plan for S05 sequencing, scope boundaries, work-item completion conditions, and closeout evidence.

Any discovered conflict must be resolved at its governing source before implementation proceeds.
