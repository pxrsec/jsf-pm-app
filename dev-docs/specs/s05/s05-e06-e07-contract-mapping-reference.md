---
title: Sprint 05 E6/E7 Contract Mapping Reference
created: 2026-08-21
status: implementation-reference
sprint_id: S05
epic_ids: [E6, E7]
work_item: S05-01
project: Joya Star Films Project Management App
repository_baseline: feature/s05-e06-e07-operator-and-client-execution @ 73c2041
sources:
  - dev-docs/specs/s05/s05-e06-e07-operator-and-client-execution-sprint-plan.md
  - dev-docs/specs/s04/s04-specs/s04-02-workspace-command-boundary-spec.md
  - dev-docs/specs/s04/s04-specs/s04-07-authoritative-internal-review-resubmission-release-and-final-delivery-spec.md
  - contracts/openapi/jsf-pm-api.openapi.yaml
  - supabase/migrations/20260818143500_s02_e02_authoritative_data_platform.sql
  - supabase/migrations/20260820153000_s04_06_harden_production_google_drive_submission_urls.sql
  - supabase/migrations/20260821100000_s04_06_allow_incomplete_client_project_planning.sql
  - src/lib/database.types.ts
tags: [s05, e6, e7, contract-mapping, operator, client-portal, authorization, supabase]
---

# Sprint 05 E6/E7 Contract Mapping Reference

## 1. Purpose and authority

This reference is the S05-01 reconciliation artifact. It maps each planned E6/E7 page and user action to the **actual committed repository baseline**: route structure, safe read projection, constrained database command, server-action boundary, expected result, safe failure handling, and refresh target.

It is implementation guidance for S05 work items. It does not change the product, data model, RLS, API contract, or database policy. When it conflicts with an accepted ADR, committed migration, generated type, or repository API contract, that higher authority controls.

### 1.1 Baseline inspected

- Branch: `feature/s05-e06-e07-operator-and-client-execution`
- Current commit: `73c2041 feat: complete Sprint 04 project workspace and deliverable lifecycle (#9)`
- Existing S05 directory was untracked at inspection because the Project Owner had added the approved sprint plan locally.
- No repository code, migration, generated type, Supabase environment, provider, or Git state was changed by S05-01.

### 1.2 Implementation rules carried forward

- `profiles.role` is the application-role authority; a route, payload, UI state, and browser-provided actor ID grant no authority.
- All S05 page reads use an authenticated `@supabase/ssr` server client and the role-safe view named below. Do not use base-table `select("*")` as a role-screen shortcut.
- All lifecycle mutations derive the actor from `requireSession`, validate browser input with narrow Zod schemas, invoke the named RPC, map failures to `CommandResult<T>`, and refresh only concrete affected paths.
- The RPC is authoritative for RLS, membership, workflow type, current state, row locking, immutable version/feedback creation, audit insertion, and notification-event creation.
- Browser code must never append a version/feedback record, increment a version number, or change a status before a successful command response and server refresh.
- User-facing error copy is localized from error codes. Do not render raw Supabase/RPC messages.
- New filenames use lowercase kebab-case. New `"use server"` modules export direct `async` function declarations only; do not re-export Server Actions.
- External links are intentional browser navigation only. No S05 component or server action fetches, previews, proxies, scans, downloads, hosts, or validates remote reachability.

---

## 2. Reconciled database boundary

### 2.1 Existing safe views

All five required views are present in the committed migration and generated types. They are `security_invoker` views; underlying RLS remains effective.

| View | Actual committed fields relevant to S05 | S05 use | Access boundary |
| --- | --- | --- | --- |
| `operator_agenda_view` | task/project identity, `task_title`, `task_description`, task status/priority/deadline/start, deliverable identity/title/status/workflow/current version/review deadlines, `urgency_category` | Operator agenda, safe task drawer, assigned production submission entry | Underlying task RLS confines an Operator to rows where they are the task assignee. |
| `client_project_view` | client-safe project identity/name/scope/status/deadline/archive state/last deliverable activity | Client dashboard and project context | Underlying project RLS requires active project membership. |
| `client_task_view` | direct request identity/project/title/description/status/priority/deadline/resources/child-submission count | Client direct-request queue and detail | Underlying task RLS confines a Client to a task assigned to that Client. |
| `client_submission_view` | direct submission identity/task/title/specifications/status/current version/provider/URL/note/submission deadline | Client-submission queue/detail and correction presentation | Underlying deliverable RLS confines a Client to their direct assignee records. |
| `client_deliverable_view` | released production deliverable identity/project/title/specifications/status/current version/current Drive URL/provider/client deadline/client feedback history | Project-scoped Client production review and client-safe history | Underlying deliverable RLS permits active Client project members only for released/approved/delivered/changes-requested production rows. |

### 2.2 Existing public RPCs

| RPC | S05 actor and preconditions | Authoritative success result | Transactional effects |
| --- | --- | --- | --- |
| `transition_task_status(p_task_id, p_next_status, p_reopen_reason?)` | Direct Client assignee: only `pending → in_progress`, `pending → completed`, or `in_progress → completed`; pending child client submissions block completion. Operator assignee also has the committed standard task transition path, but task-status UI is not an E6 requirement. | JSON with task ID, old status, and new status. | Updates task timestamps; inserts audit history; creates a task status event. |
| `submit_deliverable_version(p_deliverable_id, p_submission_url, p_submission_note?)` | Production deliverable assignee, active PM Lead, or Admin; workflow is `production`; status is `pending` or `changes_requested`. | New immutable version ID/number and `awaiting_internal_review` status. | Locks deliverable, inserts version, updates current version/status, writes audit/event, fans out in-app records to PM Leads/Watchers. |
| `submit_client_deliverable(p_deliverable_id, p_submission_url, p_submission_note?)` | Direct Client assignee only; workflow is `client_submission`; status is `pending`. | New immutable version ID/number, provider classification, and terminal `submitted` status. | Locks deliverable, inserts immutable version, audit/event, and PM Lead/Watcher in-app recipients. |
| `reopen_client_deliverable(p_deliverable_id, p_reason)` | Active PM Lead or Admin only; workflow is `client_submission`; status is `submitted`; reason required. | Reopened `pending` state. | Preserves prior versions, writes audit/event, and creates direct-assignee notification record. |
| `review_deliverable(p_deliverable_id, p_stage, p_decision, p_comments?)` | For `client` stage: active Client member of the parent project; production workflow; current status `awaiting_client_review`; change request requires non-empty comment. | Immutable feedback ID and next status (`approved` or `changes_requested`). | Locks current version; inserts immutable version-scoped feedback; updates status; writes audit/event; creates in-app records. |
| `report_broken_link(p_deliverable_id, p_version_id, p_reason)` | Existing authorized project member rule; Client eligibility must be confirmed only via the Client-safe representation. | Link-report ID and `open` status. | Creates incident/event without changing version or deliverable lifecycle. |

### 2.3 Existing policy distinctions that S05 must retain

1. A Client is a project-scoped reviewer for released production deliverables, but is a **direct assignee only** for `client_request` tasks and `client_submission` deliverables.
2. A `client_submission` is not production work. Its complete lifecycle is `pending → submitted`; it must not render review, approval, `changes_requested`, delivered, formal feedback, or review-inactivity controls.
3. Client production feedback is visible through `client_deliverable_view` only as Client-stage history. Internal feedback is not a Client screen concern.
4. An Operator may submit an assigned production deliverable but may not receive an internal-review, Client-review, delivery, or PM workspace control.
5. The database, not an optimistic UI, determines current version and first-valid concurrent decision.

---

## 3. Required S05 application modules

The existing S04 modules are not reusable as role actions without changes because they explicitly gate most mutations to Admin/PM/PM Lead and revalidate only Admin/PM workspace paths.

| New or extended module | Responsibility | Must not do |
| --- | --- | --- |
| `src/lib/operator/queries.ts` | Typed reads from `operator_agenda_view`; map agenda rows to agenda/task-detail representation. | Query broad `tasks`, `deliverables`, project membership, comments, or audit tables for Operator screens. |
| `src/lib/operator/schemas.ts` | Narrow input schema for an Operator production submission, if it differs only by action ownership from existing shared schema. | Duplicate lifecycle policy or accept role/actor/version/status from the browser. |
| `src/lib/operator/actions.ts` | Direct Server Action for Operator production submission; session-derived actor; invoke existing `submitDeliverableVersion` adapter; revalidate concrete Operator routes. | Reuse PM-only action wrappers, mutate tables directly, or introduce an offline queue. |
| `src/lib/client/queries.ts` | Typed reads from the four Client-safe views. | Use S04 PM/Admin project or deliverable queries; use mixed-visibility table joins. |
| `src/lib/client/schemas.ts` | Client request transition, client submission, Client reopen-context display input, Client review, and optional link-report schemas. | Accept `stage`, reviewer identity, version identity, status, project membership, or arbitrary redirect from the browser. |
| `src/lib/client/actions.ts` | Direct Server Actions for Client request transition, client submission, and Client review; session-derived actor; invoke existing RPC adapters/new narrow adapters; revalidate concrete Client routes. | Reuse PM-only action wrappers or expose PM/Admin reopen controls to a Client. |
| `src/lib/deliverables/validators.ts` | Retain strict production Drive validator; add a separate Client-submission lexical validator only if it mirrors the existing SQL rule and accepted/rejected corpus. | Normalize unsafe raw input silently, fetch the URL, or conflate Client and production policies. |
| `src/lib/projects/errors.ts` or a focused role-safe error mapper | Extend only with safe, localized-code-usable mappings that S05 requires. | Return raw database strings or encode user-facing Spanish/English prose in server adapters. |

The following S04 code is **not an S05 role-action dependency**:

- `transitionTaskStatusAction` rejects all roles except Admin/PM before the database command; it cannot serve direct Client transitions.
- `reviewDeliverableAction` validates only internal review and hard-codes `stage: "internal"`; it cannot serve a Client review.
- S04 project/deliverable query modules use internal workspace table/projection paths and are not Client-safe screen data sources.
- `submitDeliverableVersionAction` recognizes an Operator assignee, but it revalidates only Admin/PM paths. S05 must create an Operator-owned wrapper or extend revalidation without turning it into a cross-role mega-action.

---

## 4. Page and read mapping

Routes below are the S05 implementation target. Spanish remains unprefixed; the locale layout provides the `/en/` equivalent. They extend the existing navigation targets already present in `AppNav` and `MobileNavToggle` (`/operador/agenda` and `/cliente/proyectos`).

| Page / surface | Route | Session and role gate | Read source and explicit fields | Presentation / refresh rule |
| --- | --- | --- | --- | --- |
| Operator role home | `/operador` | `requireSession`; `role = operator` | Existing shell may remain a concise landing summary; do not make it a second agenda data system. | Link to `/operador/agenda` and `/operador/proyectos`; no role leakage. |
| Operator My Day agenda | `/operador/agenda` | `requireSession`; `role = operator` | Revised `operator_agenda_view`; own task/project/deliverable fields plus `assigned_at` and authoritative urgency category. | Server-rendered cross-project own-work list. Refresh after an accepted Operator submission or explicit retry. |
| Operator own-work project index | `/operador/proyectos` | Same | Group and deduplicate only returned `operator_agenda_view` rows by safe `project_id` and `project_name`; derive project counts only from those own rows. | Shows projects where the Operator currently has returned assigned work; it is not a general project directory. |
| Operator per-project own-task list | `/operador/proyectos/[project-id]` | Same | Constrain `operator_agenda_view` to the requested safe project ID and group/deduplicate only that Operator’s own task rows. | Shows only the Operator’s assigned tasks for that project; no project-wide tasks, membership, notes, or administration. |
| Operator canonical task detail | `/operador/tareas/[task-id]` | Same | Constrain `operator_agenda_view` to the requested safe task ID; use the selected current own-task row plus its assigned deliverables. | Required bookmarkable detail. A mobile sheet may enhance this route only when it preserves the canonical URL. Missing/not-visible ID yields safe not-found/denial treatment. |
| Operator production submission dialog | Child of canonical task detail | Same as task detail plus existing RPC assignee/valid-state enforcement | Existing agenda row identifies production deliverable; current state is re-read from safe source after command. | Success refreshes `/operador/agenda`, `/operador/proyectos`, the selected project list, and canonical task route. |
| Client role home | `/cliente` | `requireSession`; `role = client` | May remain lightweight; do not duplicate project/request/review reads. | Link to `/cliente/proyectos`, Client request queue, and Client review queue only after those paths exist. |
| Client project dashboard | `/cliente/proyectos` | `requireSession`; `role = client` | `client_project_view`: ID/name/client scope/status/deadline/archive/last deliverable activity. | Server-rendered Client-safe multiple-project list. Project cards do not expose internal description, internal deadlines, or member data. |
| Client project detail | `/cliente/proyectos/[project-id]` | Same | `client_project_view` constrained to the selected Client-visible project; `client_task_view` and `client_submission_view` constrained to both the selected project and the authenticated Client’s direct records; `client_deliverable_view` for project-scoped released production review. | One Client-safe project context: own direct requests/submissions plus project-scoped released deliverables only. Never render a project-wide task list, another Client’s direct work, membership, internal comments/feedback, audit data, or PM controls. |
| Client direct-request queue | `/cliente/tareas` | Same | `client_task_view`: ID/project/title/description/status/priority/deadline/resources/child count. Sort by documented priority/overdue/nearest deadline using only returned fields. | Server-rendered queue across all Client-visible projects. Refresh after Client request transition or Client submission. |
| Client direct-request detail | `/cliente/tareas/[task-id]` | Same | Fetch from `client_task_view` constrained to target ID; do not use internal `getTaskDetail`. Child submission cards are read from `client_submission_view` constrained to the same task. | Missing/not-visible target is a safe not-found. |
| Client submission form | Within direct-request detail or `/cliente/tareas/[task-id]/entregables/[deliverable-id]` | Same; direct assignment remains database-enforced | `client_submission_view` constrained to target ID and task ID; only accepted Client fields. | Success refreshes request detail and Client queue. `submitted` is terminal from the Client perspective. |
| Client production-review queue | `/cliente/entregables` | Same | `client_deliverable_view` filtered by Client-visible lifecycle status. | Do not merge this with direct client-submission records. |
| Client production-review detail | `/cliente/entregables/[deliverable-id]` | Same; project Client membership enforced by view/RPC | `client_deliverable_view` constrained to target ID: title/specifications/current version/current Drive URL/client deadline/client feedback history. | Success/conflict refreshes detail and review queue from server. |
| Client-safe archive entry | Deferred unless a later S05 implementation spec proves current `client_deliverable_view` supports the intended archive UX without an archive-specific query/policy change. | n/a | `client_deliverable_view` may display released/approved/delivered records; it is not automatically a full archive implementation. | Do not introduce new archive search/filter behavior in S05. |

---

## 5. Action mapping

### 5.1 Operator actions

| User action | Browser input allowed | Server action contract | Command | Success / refresh | Safe failure behavior |
| --- | --- | --- | --- | --- | --- |
| Open assigned task | Target task ID from current agenda row only | No mutation. Re-query/render only the current Operator-safe agenda representation. | `operator_agenda_view` read | Detail opens with authoritative current row. | Missing/not-visible: safe not-found/denied state. |
| Open safe resource / Drive URL | Current safe resource or production URL | Browser-only intentional navigation with `noopener,noreferrer` policy as applicable. | None | External browser navigation only. | No reachability assertion, fetch, preview, or proxy. |
| Submit production version | Deliverable ID, raw `submission_url`, optional allowed note | Validate UUID and strict production Drive raw URL; require Operator session; call shared production submission adapter. Browser cannot pass actor/status/version/stage. | `submit_deliverable_version` | New immutable version; `awaiting_internal_review`; revalidate concrete Operator agenda/detail route. | Validation: inline field error. Unauthorized/not-found: safe generic denial. Invalid transition/conflict: close pending state, retain no false history, refresh authoritative row. Unknown: generic retry. |
| Retry failed online submission | Same current form input after user action | Repeat normal validation/command path; no persisted queue/replay record. | Same | Only server acceptance changes UI. | Keep online failure copy; no deferred local mutation. |

### 5.2 Client direct-request actions

| User action | Browser input allowed | Server action contract | Command | Success / refresh | Safe failure behavior |
| --- | --- | --- | --- | --- | --- |
| Start own request | Task ID; fixed target status `in_progress` | Validate ID; require Client session; use Client-owned action; call transition adapter. Do not accept actor/assignee/project/status history. | `transition_task_status` | Task enters `in_progress`; refresh Client request queue/detail. | Not visible/unauthorized: generic safe state. Invalid transition/conflict: refresh; no local status change. |
| Complete own request | Task ID; fixed target status `completed` | Same as start. A UI preflight may show child-submission count, but command outcome decides. | `transition_task_status` | Task enters `completed` only if active child submissions are all `submitted`; refresh queue/detail. | Pending child submissions: localized requirement message; refresh safe detail. Other transition failure: safe stale state + refresh. |
| Inspect child submissions | Task ID / child deliverable ID from current Client task data | Read only from `client_submission_view` and constrain task/deliverable relationship. | View read | Client-safe submission cards. | No internal review/deadline/feedback data. |

### 5.3 Client-submission actions

| User action | Browser input allowed | Server action contract | Command | Success / refresh | Safe failure behavior |
| --- | --- | --- | --- | --- | --- |
| Submit requested asset URL | Deliverable ID, raw public HTTPS `submission_url`, optional note | Validate narrow Client input; require Client session; invoke Client-specific adapter that calls the direct-assignee RPC. Do not accept actor/project/assignee/provider/status/version. | `submit_client_deliverable` | New immutable version, provider classification, terminal `submitted`; refresh request/detail/queue. | Invalid URL: inline error. Unauthorized/not found: safe generic failure. Not pending/conflict: refresh without false success. |
| Inspect prior/current safe correction context | Deliverable ID from direct task | Read from `client_submission_view` only. | View read | May show only fields returned by the Client projection. | Do not read audit or internal correction notes. |
| Submit replacement after internal reopen | Same as Client submission | The Client sees `pending` after an authorized internal reopen and submits a new URL through the same command. | `submit_client_deliverable` | New immutable successor version; `submitted`. | Client cannot call reopen or alter older version. |

### 5.4 Client production-review actions

| User action | Browser input allowed | Server action contract | Command | Success / refresh | Safe failure behavior |
| --- | --- | --- | --- | --- | --- |
| Open released production deliverable | Deliverable ID from Client review queue | Read only `client_deliverable_view`; no internal `getDeliverableDetail` fallback. | View read | Client-safe exact current-version context. | Missing/not-visible: safe not-found. |
| Approve deliverable | Deliverable ID and fixed decision `approved`; no browser-selected stage/version/actor | Validate ID; require Client session; server action fixes `stage: "client"`; invoke shared review adapter. The RPC selects/locks current version. | `review_deliverable` | Immutable Client feedback; status `approved`; refresh review queue/detail. | Conflict/stale: show generic already-changed state; refresh with no local feedback. |
| Request changes | Deliverable ID, fixed decision `changes_requested`, required comment | Validate ID/comment; require Client session; server action fixes `stage: "client"`; invoke shared review adapter. | `review_deliverable` | Immutable Client feedback; status `changes_requested`; refresh. Explain that internal revision and PM re-review are next. | Empty comment: field error. Conflict/stale: refresh/no local feedback. Unauthorized/not found: safe generic message. |
| Report Client-visible broken link | Deliverable ID, exact Client-visible version ID, reason | Implement only after Client-safe view/action mapping proves the current link-report boundary does not reveal non-Client-safe data. | `report_broken_link` | Incident only; version/lifecycle unchanged. | No remote check or "verified broken" claim. |

---

## 6. Validation and refresh contract

### 6.1 Production submission validation

The committed S04 production path is reusable for Operator input:

- shared TypeScript `isValidGoogleDriveUrl()` rejects unsafe raw formatting and parses only for lexical component checks;
- the S04 migration trigger is authoritative for production version inserts;
- the production RPC remains the authoritative lifecycle/authorization boundary;
- accepted input is raw, absolute HTTPS with exact `drive.google.com` or `docs.google.com`, no credentials, explicit port, control/whitespace, backslash, empty path, unsafe normalization dependency, or value above 2,048 bytes.

### 6.2 Client-submission validation

No Client-specific TypeScript validator or Client action adapter currently exists. S05-05 must add a separate lexical validator and one shared accepted/rejected corpus that mirrors the committed `submit_client_deliverable` database contract:

- absolute public HTTPS only;
- no credentials, raw control/whitespace, localhost/private/reserved IP literal, or nonstandard port;
- recognized provider classification for Google Drive, Dropbox, OneDrive, WeTransfer, and Frame.io;
- unknown syntactically valid public host becomes `other_https`;
- no external request at any validation stage.

The Client validator must not reuse the production Google Drive-only validator and must not silently normalize invalid raw input.

### 6.3 Concrete refresh targets

S04 actions revalidate only Admin/PM project workspaces. S05 actions must revalidate concrete Client/Operator paths instead of route-group patterns:

- Operator submission: `/operador/agenda`, `/en/operador/agenda`, `/operador/proyectos`, `/en/operador/proyectos`, concrete per-project own-task paths, and `/operador/tareas/[task-id]` with its English equivalent.
- Client direct request/submission: `/cliente/tareas`, `/en/cliente/tareas`, concrete task/submission paths, `/cliente/proyectos`, `/en/cliente/proyectos`, and the selected Client-safe project-detail path where a summary changes.
- Client review: `/cliente/entregables`, `/en/cliente/entregables`, and concrete review detail paths.

Use `router.refresh()` only as the UI-side follow-up after a server action result; it does not replace server revalidation or authorization.

---

## 7. Reconciliation findings

### 7.1 Supabase migration now required for accepted Operator agenda semantics

All required E6/E7 Client views, lifecycle RPCs, generated type declarations, RLS policies, and S04 production Google Drive trigger source are present in the committed baseline. However, the Project Owner accepted **S05-DEC-01** on 2026-08-21: S05 must add strict `new` (less than 24 hours since assignment) and completed-task agenda semantics.

This decision requires a narrowly scoped, forward-only Supabase migration before E6 implementation can claim those semantics. The migration scope is limited to:

1. an authoritative task-assignment timestamp that is set on task creation and refreshed when the authoritative assignment changes, so `new` is not guessed from task creation time;
2. an updated Operator-safe agenda projection that returns the authoritative assignment timestamp and includes completed assigned tasks under an explicitly accepted retention/window rule;
3. exact urgency derivation that distinguishes at least `new`, `normal`, `upcoming`, `urgent`, `overdue`, and `completed` without client-side invention;
4. RLS/security-invoker preservation, indexes appropriate to the new agenda predicate/order, generated type regeneration, and positive/negative schema/RLS/query evidence.

The accepted Operator project browsing and canonical task-route scope does not require another schema change: the revised agenda projection already carries the safe `project_id`, `project_name`, and task identity needed to group and constrain the signed-in Operator’s own rows. It must never be replaced with a project-wide task or project-membership read.

The missing Client work remains application-layer consumption: Client/Operator query modules, role-specific schemas/actions, route-local UI, focused tests, catalog keys, and concrete route revalidation.

### 7.2 Required implementation gaps — not owner decisions

1. **Client action layer is absent.** There is no Client-owned Server Action for direct request transition, client submission, or Client production review. The existing internal action wrappers cannot be reused because they reject Client roles or hard-code `stage: "internal"`.
2. **Client safe-view query layer is absent.** The generated types and SQL views exist, but application modules query only the shell’s project subset today. S05 must add Client-only view queries.
3. **Operator agenda is a five-item shell summary.** Existing `getOperatorShellData()` selects only six basic fields and uses `limit(5)`. It is not the full E6 My Day route and does not expose the existing safe detail/version fields. S05 must add a dedicated agenda query rather than enlarge the shell summary ad hoc.
4. **Operator submission wrapper needs role-specific refresh.** Existing `submitDeliverableVersionAction()` permits an assigned Operator but refreshes only Admin/PM paths. Add an Operator-owned wrapper or narrowly refactor shared revalidation while preserving direct action exports and file-size limits.
5. **Client URL feedback is absent.** Existing TypeScript validation is production Google Drive-only. S05 must add a separate Client public-HTTPS lexical validator and tests; no database change follows from that application gap.
6. **Navigation already targets absent successor routes.** Current desktop/mobile navigation points Operators to `/operador/agenda` and Clients to `/cliente/proyectos`, but neither page exists. S05 must create them before treating those links as active completed navigation.
7. **Existing S04 internal workspace modules are not Client/Operator safe sources.** Do not adapt their broad internal detail/history reads to the Client portal. Preserve them as internal workspace scope and use the dedicated views for S05.

### 7.3 Accepted owner decision — Operator agenda urgency semantics

**Decision ID: S05-DEC-01 — strict new and completed agenda semantics.**

**Accepted by Project Owner on 2026-08-21:** S05 will add strict `new` (less than 24 hours since authoritative assignment) and completed-task agenda semantics now. This supersedes the prior recommendation to limit the agenda to the committed active-task categories.

The resulting migration/projection must provide authoritative categories without client-side inference:

| Required S05 category | Authoritative basis |
| --- | --- |
| `new` | Current Operator is the task assignee and the authoritative assignment timestamp is less than 24 hours old. |
| `normal` | Active assigned task that is neither new, upcoming, urgent, nor overdue. |
| `upcoming` | Active assigned task with deadline more than 24 and no more than 72 hours away. |
| `urgent` | Active assigned task with deadline within 24 hours and not overdue. |
| `overdue` | Active assigned task with deadline before the database evaluation time. |
| `completed` | Assigned task that is completed and falls within the separately accepted completed-item retention/window rule. |

The prior committed view is insufficient because it excludes completed tasks and has no authoritative assignment timestamp. The S05 migration must add the necessary task assignment fact, maintain it through the authoritative create/reassignment path, revise `operator_agenda_view`, preserve RLS, generate types through Supabase MCP after remote application, and add a shared database/application test corpus.

**Completed-item retention is accepted:** a completed task remains visible until the end of the Operator’s local calendar day, evaluated with the authenticated Operator’s existing `profiles.timezone` value (default `America/Mexico_City`). The completed-item predicate must compare `tasks.completed_at` and the database evaluation time in that stored IANA timezone; the UI must not substitute browser timezone or locale for this authorization-neutral data rule.

The migration is therefore explicitly scoped to:

1. add a non-null authoritative `tasks.assigned_at` fact, backfilled deterministically for existing rows and set at task creation;
2. update the authoritative task update/reassignment boundary so changing `assignee_id` refreshes `assigned_at`, while unrelated task edits do not;
3. revise `operator_agenda_view` to return `assigned_at`, include active assigned tasks plus the current Operator’s completed tasks through the end of their stored local day, and derive `new`, `normal`, `upcoming`, `urgent`, `overdue`, and `completed` from database time and stored profile timezone;
4. preserve security-invoker/RLS behavior, add only indexes justified by the revised agenda query, regenerate types through Supabase MCP after the reviewed migration is applied to `jsf-pm-dev`, and prove positive/negative query/RLS/transition cases through a shared database/application test corpus.

No Client-facing schema change is implied by S05-DEC-01.

### 7.4 Non-blocking implementation caution — Client URL mirror

The committed client-submission RPC uses a lexical regex and provider classification. S05’s browser validator must mirror the accepted server corpus, including all prohibited values named by the sprint plan. If a shared test corpus exposes a true accepted/rejected mismatch, treat it as a security stop condition and create a narrowly scoped migration decision; do not loosen browser validation or invent a different policy in the Client UI.

---

## 8. Implementation sequencing after S05-01

1. Treat S05-DEC-01 as accepted migration scope; create its test-first and implementation contract before any E6 UI work depends on the revised agenda semantics.
2. Build test-first contracts for the role-safe query modules and each new Client/Operator action; retain the exact S05 mapping rows as traceability reference.
3. Implement E6 using `operator_agenda_view` and a dedicated Operator submission action.
4. Implement E7 Client project/request/submission read/actions from Client views and existing RPCs.
5. Implement Client production review only after Client-safe detail/read tests and Client action tests are in place.
6. Add navigation only as each target route becomes usable.
7. If a live schema/application mismatch appears, stop that item and apply the migration boundary stated in the approved S05 plan; do not use direct DDL, dashboard edits, generated-type edits, or client-side authorization as a substitute.

## 9. S05-01 completion record

S05-01 is complete. This reference is the mapping baseline for successor test-first and implementation specifications. S05-DEC-01 is accepted: E6 now requires the narrowly scoped Operator-agenda migration described in Section 7.3; no other Project Owner decision or default Client schema migration is required before the next S05 contracts.
