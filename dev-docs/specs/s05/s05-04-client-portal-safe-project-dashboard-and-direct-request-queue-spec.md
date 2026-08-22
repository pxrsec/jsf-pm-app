# S05-04 — Deliver the Client Portal, Safe Project Dashboard, and Direct-Request Queue

**Sprint:** S05  
**Work item:** S05-04  
**Status:** Implementation-ready  
**Last reviewed:** 2026-08-22  
**Spec authority:** `dev-docs/specs/s05/s05-e06-e07-operator-and-client-execution-sprint-plan.md`, especially Sections 4–7 and 9; `dev-docs/specs/s05/s05-e06-e07-contract-mapping-reference.md`, especially Sections 2–7; committed Supabase migrations and `src/lib/database.types.ts`; accepted S04 protected-shell and command-boundary conventions.  
**Dependencies:** integrated S04 project/task and production-lifecycle baseline; completed S05-01 contract mapping; committed S05-02/S05-03 application baseline where it establishes repository conventions only.  
**Successor boundary:** S05-05 owns Client URL submission and correction mutation UX. S05-06's Client production-review presentation/action scope is absorbed into this item by Project Owner decision S05-DEC-02. S05-07 owns sprint-wide navigation consolidation, manual journeys, full integrated verification, changelog, and closeout.

---

## 1. Objective

Replace the Client placeholder with a minimal, localized, server-rendered Client workspace that safely exposes:

1. every active project to which the authenticated Client is an active Client member;
2. a Client-safe project dashboard for one selected project;
3. only that Client's directly assigned `client_request` tasks across those projects;
4. a safe, accessible detail surface for each directly assigned request;
5. read-only child `client_submission` requirement summaries returned for that request; and
6. exactly the direct Client transitions that are allowed by the established command boundary.

The resulting experience is deliberately not a PM workspace. A Client can discover and act on their own requested work without seeing internal project context, project-wide task lists, another Client's direct work, team membership, internal workflow, comments, audit history, or PM controls.

A Client may start an own request (`pending → in_progress`) and complete an own request (`pending → completed` or `in_progress → completed`) only through `transition_task_status()`. A completion attempt remains subject to the authoritative child-client-submission dependency rule. A page-side child count is explanatory; it never grants completion or replaces command enforcement.

---

## 2. Scope and non-negotiable boundaries

### 2.1 In scope

1. Activate the existing Client project navigation target only after `/cliente/proyectos` is a real, usable route in both locales.
2. Add a Client-only query layer over the four established Client-safe views:
   - `client_project_view`;
   - `client_task_view`;
   - `client_submission_view`; and
   - the project-scoped `client_deliverable_view` representation required for the combined project-detail and canonical Client review experience.
3. Add the localized Client project dashboard at `/cliente/proyectos` and its required project detail at `/cliente/proyectos/[project-id]`.
4. Add a Client direct-request queue at `/cliente/tareas` and a canonical direct-request detail route at `/cliente/tareas/[task-id]`.
5. Add Client-owned Server Action boundaries for fixed start/complete request transitions and fixed Client-stage production-review decisions only.
6. Add route-local Client request and project components, focused loading/empty/error/absence treatment where the existing parent boundary is insufficient, and exact bilingual catalog parity.
7. Present child client-submission requirements only as safe read-only summaries. The S05-05 submission form, public-HTTPS validator, provider classification, terminal-submission UX, and correction loop are excluded.
8. Add the complete Client production-review experience formerly sequenced as S05-06: review queue/detail routes, deliberate opening of the current stored Drive URL, exact-current-version review context, approval, mandatory-comment change request, safe conflict recovery, and authoritative post-decision presentation.
9. Add only focused application tests needed to prove Client query shaping, direct-assignment isolation at the application boundary, request/review action ownership, truthful dependency feedback, route presentation, localization, and accessibility.

### 2.2 Explicitly out of scope

- Client-submission URL entry, lexical URL validation, external-provider classification, confirmation, submission mutation, correction/replacement submission, or PM/Admin reopen controls. These are S05-05.
- Task assignment, task scope/description edit, deadline edit, priority edit, deletion, reassigning, reopening, blocking, Kanban, internal review, project status controls, project administration, membership, comments, audit history, notifications, or PM/Admin workspace controls.
- A project-wide Client task list, Client-member enumeration, any read of another Client's task/submission, or any Client-side filtering used as authorization.
- A general Client archive, archive searching/filtering, activity feed, calendar, metrics, or notification-history surface.
- New database schema, migrations, generated-type changes, Supabase MCP/dashboard/CLI actions, direct DDL, generic SQL, resets, hosted-environment changes, or provider activation.
- New route handlers, CORS changes, public signup, external email/WhatsApp/webhooks/schedules, broad Realtime, polling, client data cache, service worker, offline cache, persistent queue, deferred mutation, or replay.
- External URL dereference, previews, fetching, proxying, downloading, scanning, upload/storage, Drive API authentication, reachability claims, or content-safety claims.
- `CHANGELOG.md` and Sprint 05 closeout updates. S05-07 owns those aggregated records.

### 2.3 Security, data-minimization, and truthfulness rules

- `profiles.role` resolved by `requireSession()` is the sole application-role authority. Route parameters, query strings, component state, a requested target status, and a browser-provided user/project/task identifier grant no authority.
- All Client page reads and mutation preflights use only the applicable Client-safe views through `src/lib/client/queries.ts`. They must use explicit least-privilege projections; `select("*")` is prohibited.
- Client routes must never import or reuse S04 internal workspace query functions such as project/task/deliverable detail helpers, even when the Client is a project member. Those functions are not Client-safe presentation sources.
- `client_project_view` establishes project-scoped Client visibility. `client_task_view` and `client_submission_view` establish **direct-assignee** visibility. These scopes are intentionally different and must stay separate in types, query functions, labels, empty states, and controls.
- `transition_task_status()` remains authoritative for direct-assignee authorization, current state, task type, task ownership, child-submission completion dependency, timestamps, audit insertion, notification-event creation, locking, and conflict behavior. The Server Action must not recreate that state machine.
- The browser may transiently show pending UI but must not optimistically change task status, remove a task, mark it complete, manufacture a child-submission state, or claim success before an accepted command response and authoritative refresh.
- Missing, malformed, non-visible, foreign, stale, or forged IDs converge on generic safe absence/denial behavior. Do not disclose whether the ID exists, which Client owns it, whether it belongs to the same project, or which policy denied it.
- The Client portal must exclude internal descriptions/notes, operator assignments, PM members, internal deadlines, internal tasks, internal feedback, comments, audit data, operational notification data, raw IDs, and mixed-visibility base-table fields. Client-stage feedback returned by `client_deliverable_view` is the sole formal-feedback representation eligible for Client review presentation.
- Any displayed URL is only an already-authorized stored lexical value. S05-04 permits intentional browser opening only for the returned current production-review URL; it never validates, fetches, resolves, previews, proxies, downloads, scans, authenticates against, or tests that URL. Do not state that an asset is uploaded, checked, reachable, delivered, safe, or received.
- User-visible failures map from stable safe error codes and localized catalog keys. Never render raw Supabase/RPC messages, RPC names, RLS details, SQL errors, stack traces, UUIDs, private URLs, or unreturned project context.

---

## 3. Confirmed database and command baseline

S05-01 confirmed that S05-04 has no schema gap and requires no migration. The implementation consumes existing `security_invoker` views under underlying RLS and existing constrained RPCs.

### 3.1 Read sources and allowable use

| Source | S05-04 use | Permitted presentation content | Must not expose or infer |
| --- | --- | --- | --- |
| `client_project_view` | Client dashboard, selected-project context | Client-safe project identity/name, status, client scope, relevant client-safe deadline/archive/activity facts returned by the view | `internal_description`, member list, project-wide task count, internal team, internal project schedule, administration state |
| `client_task_view` | Direct-request queue, selected request detail, action target preflight | Direct request/project identity, project name, title, description, task status/priority/deadline, safe resources, child submission count and safe fields returned by the view | Another Client's work, task assignee identity, internal task type/workflow detail, internal comments/audit, project-wide tasks |
| `client_submission_view` | Child requirement summaries within the selected own request | Direct submission/task/project identity, title/specifications, safe current status/version/provider/URL/note/deadline fields only when returned | A submission not directly assigned to the Client, internal feedback/audit/reopen reason, submission mutation behavior in this item |
| `client_deliverable_view` | Project-detail review summary, canonical review queue/detail, and safe Client review preflight | Project-scoped released production title/specifications/status/current version/current stored Drive URL/provider/client delivery deadline/client-stage safe feedback history | Internal feedback, operator identity, unreleased versions, raw audit events, arbitrary version lookup, PM/Admin controls |

The final select list is derived from the currently committed `Database["public"]["Views"][...]` row declarations. Names in migration source/generated types prevail over examples in this spec. A field absent from the Client-safe view is not available merely because another role's query can reach it.

### 3.2 Authoritative request transition contract

S05-04 has exactly two command families: request transitions through `transition_task_status(p_task_id, p_next_status, p_reopen_reason?)` and Client production review through `review_deliverable(p_deliverable_id, p_stage, p_decision, p_comments?)`. Both are invoked only through typed adapters; neither permits a direct table write.

| Client intent | Browser input | Fixed server-side command input | Allowed authoritative outcome | UI result |
| --- | --- | --- | --- | --- |
| Start own request | `task_id` only | `p_next_status = "in_progress"`; no reopen reason | `pending → in_progress` only | Refresh Client request routes and render server state |
| Complete own request | `task_id` only | `p_next_status = "completed"`; no reopen reason | `pending → completed` or `in_progress → completed`, only when all active child client submissions are `submitted` | Refresh Client-safe request/submission state; show success only after command result |

The browser must not send `next_status`, `reopen_reason`, actor ID, role, assignee ID, project ID, task type, status history, child count, version, or redirect path. The two direct Action exports fix the intended transition internally.

### 3.3 Mandatory workflow distinctions

1. A Client who is an active project Client member may see a Client-safe project and released production-review context for that project; this does **not** make that Client the direct assignee of every request or submission.
2. Only the direct Client assignee may see a `client_request` through `client_task_view` or a `client_submission` through `client_submission_view`, including when multiple Client members share the parent project.
3. `blocking` is a priority and `blocked` is a task status. The dashboard must represent them distinctly with localized non-color meaning; neither is a Client mutation control.
4. A `client_request` never receives Client UI for `blocked`, `in_review`, reopen, reassignment, scope/deadline/priority edits, or deletion.
5. A child `client_submission` has its own `pending → submitted` lifecycle. It is not a production deliverable and must not receive internal review, Client review, approval, `changes_requested`, delivered, or feedback controls in this item.
6. A child count is a safe explanatory signal only. Completion must remain possible only when the RPC accepts it; an action race or stale child state must be rendered truthfully after refresh.
7. A Client review concerns the database-selected current version of a production deliverable only when it is currently `awaiting_client_review`. The Client action must fix `stage = "client"`; it must not accept a version ID, stage, reviewer, project, or status from the browser.
8. The first valid locked Client decision is authoritative. `approved` and `changes_requested` feedback are immutable and version-scoped; a Client change request requires a non-empty comment and follows the mandatory internal revision/re-review sequence before any later Client review.

---

## 4. Client query and action architecture

### 4.1 Required module boundaries

Create a dedicated Client feature boundary. It is server-only except for schema types used by an Action module; no Client Component imports a Supabase query/command module.

```text
src/lib/client/
├── types.ts       # explicit narrow presentation/domain types and safe enum maps only
├── queries.ts     # Client-safe view reads, route-target resolution, server-side shaping
├── schemas.ts     # narrow request-action input schemas only
└── actions.ts     # direct async Server Actions for start/complete request only
```

Split responsibilities further only when needed to keep a production file at or below 400 lines. Do not create a generic cross-role `task-detail` abstraction, a Client store, or a new data-access framework.

### 4.2 Required query responsibilities

Exact names may follow established repository conventions, but the following responsibilities must remain discrete and typed.

#### `getClientProjects()`

1. Query `client_project_view` only, with an explicit projection needed by Client project cards.
2. Return every RLS-authorized active Client-member project; do not retain the role-landing shell's limited preview semantics as the project directory.
3. Order only using safe returned facts. Prefer an explicit, deterministic client-safe ordering such as active project status grouping followed by nearest returned deadline and project-name/ID tie-breaker. Do not use an internal activity query to rank results.
4. Shape project cards without project-wide counts or inferred direct-work counts unless those counts are derived solely from separately returned direct Client rows in the same safe query layer and labeled as the Client's own work.
5. Return an empty list as a normal state, not a membership conclusion.

#### `getClientProjectDetail(projectId)`

1. Validate the route parameter with the existing strict UUID convention before a query.
2. Resolve the selected project only through `client_project_view`, constrained by `id = projectId` and RLS.
3. Return `null` for malformed, absent, or non-visible project IDs. Do not query base `projects`, membership, or an internal project helper to distinguish the reason.
4. Read the selected Client's direct requests from `client_task_view`, constrained by `project_id = projectId`, and shape only returned direct records.
5. Read direct child submissions from `client_submission_view`, constrained by `project_id = projectId`, then associate them only with returned direct request task IDs. A result whose `task_id` is not among the already-returned Client task IDs is a safe query-layer inconsistency: do not render it and do not fall back to a broader read.
6. Read the project-scoped released-production representation from `client_deliverable_view`, constrained by `project_id = projectId`; it is never joined to direct-assignee work as though it were Client-owned.
7. Return one explicit dashboard model with separate arrays/sections: `directRequests`, `directSubmissions`, and `releasedProductionReviews`. Never flatten these records into a generic project work list.

#### `getClientRequestDetail(taskId)`

1. Validate the route parameter before querying.
2. Query `client_task_view` only, constrained by the selected task ID. The view itself/RLS determines direct-assignee visibility.
3. Query `client_submission_view` only for child records constrained to the returned visible task ID. Do not use a base deliverable query or a broad project-level child query.
4. Return a detail model containing only the safe task/request fields, safe resource array, child-submission cards, and an explanatory completion-readiness summary.
5. Derive only the following local explanatory states from safe returned data:
   - no child requirements;
   - every returned active child is `submitted`;
   - one or more returned active child submissions are not `submitted`; or
   - an unexpected returned submission status, treated as an unavailable/recovery state rather than silently allowed.
6. This readiness summary must be named and rendered as advisory. It must never alter the fixed action input or claim that completion is guaranteed.
7. Return `null` for malformed, absent, foreign, or non-visible IDs. Do not disclose a distinction.

#### `getClientRequestForTransition(taskId)`

1. Validate UUID shape before querying.
2. Query `client_task_view` only and return the smallest safe action target: task ID, safe project ID required for concrete revalidation, current task status, and child-submission count/summary only if needed for user-safe error recovery.
3. Return `null` for absence/non-visibility. Never fall back to `tasks` or another role's detail function.
4. Treat this as a safe target preflight. The RPC remains final authority for direct-assignee authorization, valid state, and active-child dependency.

### 4.3 Required Client request schema/action boundary

`src/lib/client/schemas.ts` exposes a narrow request-transition schema that accepts exactly:

```text
{ task_id: UUID }
```

The action module exports direct async declarations conceptually equivalent to:

```text
startClientRequestAction(rawInput)
completeClientRequestAction(rawInput)
```

Each action must:

1. obtain `cookies()` and call `requireSession()`; invalid/missing sessions retain the existing `AuthError` behavior;
2. require `session.role === "client"`, otherwise return safe `UNAUTHORIZED` result code;
3. validate only `{ task_id }` before command invocation;
4. create the typed SSR client;
5. obtain the action target through `getClientRequestForTransition()` and return generic `NOT_FOUND` when it is absent;
6. apply a narrow explanatory preflight only where it is safe: start is unavailable unless the returned status is `pending`; completion is unavailable unless it is `pending` or `in_progress`. This must not replace RPC enforcement;
7. call the existing `transitionTaskStatus(supabase, { task_id, next_status: fixedValue })` exactly once;
8. on accepted result, revalidate concrete affected Client paths in both locales:
   - `/cliente/tareas` and `/en/cliente/tareas`;
   - `/cliente/tareas/[task-id]` and `/en/cliente/tareas/[task-id]` using the actual safe task ID;
   - `/cliente/proyectos` and `/en/cliente/proyectos`;
   - `/cliente/proyectos/[project-id]` and `/en/cliente/proyectos/[project-id]` using the safe preflight project ID;
9. return the established `CommandResult<TransitionResult>` shape; and
10. never call `transitionTaskStatusAction()`, which is explicitly Admin/PM-only and revalidates internal workspace paths.

Do not use a universal Client `transitionTaskStatusAction(rawInput)` that accepts arbitrary status. Separate start/complete exports keep browser inputs and UI affordances constrained without duplicating database lifecycle authority.

### 4.4 Required Client production-review query and action boundary

Add the following Client-safe responsibilities to the same feature boundary; do not introduce a second review data layer under the internal deliverables module.

#### `getClientProductionReviewQueue()`

1. Query only `client_deliverable_view` with an explicit projection of the returned Client-safe fields required for the review queue.
2. Include only rows already visible to the authenticated Client through the view/RLS. Filter the returned safe lifecycle representation for Client-visible production review states only: `awaiting_client_review`, `approved`, `changes_requested`, and `delivered` when the committed view returns it. Never query base deliverables to discover unreleased rows.
3. Order active `awaiting_client_review` rows by nearest returned Client delivery deadline, then use a deterministic safe tie-breaker; show terminal/history states in a visually separate, non-actionable section only when the product detail needs them. Do not invent archive/search scope.
4. Keep this project-scoped review queue separate from direct Client submissions in model names, UI labels, and components.

#### `getClientProductionReviewDetail(deliverableId)` and `getClientProductionReviewForDecision(deliverableId)`

1. Validate the untrusted UUID before querying.
2. Query only `client_deliverable_view`, constrained to the selected deliverable ID. Return `null` for malformed, absent, non-visible, or stale IDs; never distinguish existence from invisibility through a base-table fallback.
3. Return only safe title/specifications/project context, current status/version number/current stored URL/provider/submitted context, Client delivery deadline, and parsed Client-stage feedback history where its returned JSON shape is valid.
4. Treat malformed feedback JSON, an unexpected safe-view status, or a null required active-review field as a safe implementation inconsistency/recovery state. Do not repair it by querying `deliverable_versions`, `deliverable_feedback`, or a PM/Admin detail helper.
5. The action preflight may verify only that the returned safe row is in `awaiting_client_review`; it is not an authorization or concurrency replacement. The RPC chooses/locks the current version and returns the final state.

#### Client review schemas and Actions

`src/lib/client/schemas.ts` must add two narrow browser envelopes:

```text
{ deliverable_id: UUID }                                      # approve
{ deliverable_id: UUID, comments: trimmed non-empty <= 5,000 } # request changes
```

The Client action module exports direct async declarations conceptually equivalent to:

```text
approveClientDeliverableAction(rawInput)
requestClientDeliverableChangesAction(rawInput)
```

Each review Action must:

1. preserve `AuthError` behavior for an invalid/missing session and return `UNAUTHORIZED` for a valid non-Client session;
2. validate only the narrow browser-owned envelope;
3. resolve the target exclusively through `getClientProductionReviewForDecision()`;
4. return generic `NOT_FOUND` for an absent/non-visible target and `INVALID_TRANSITION` when the safe target is no longer `awaiting_client_review`;
5. call a narrow typed command adapter exactly once with `{ deliverable_id, stage: "client", decision: fixedValue, comments }`;
6. never reuse `reviewDeliverableAction()`, which is an internal PM/Admin action that reads `deliverables`, verifies PM capacity, fixes `stage: "internal"`, and revalidates internal workspaces;
7. revalidate `/cliente/entregables`, `/en/cliente/entregables`, concrete Spanish/English review detail paths, `/cliente/proyectos`, `/en/cliente/proyectos`, and the selected safe Client project detail paths; and
8. return the existing `CommandResult<ReviewDeliverableResult>` shape without fabricating feedback, version, or status locally.

The current `ReviewDeliverableSchema` is intentionally internal-stage-only. If its input type prevents the existing low-level `reviewDeliverable()` adapter from accepting the server-fixed Client stage, make the smallest coherent adapter-type/schema refactor: preserve the internal action envelope unchanged, add a command-level review input that supports both database enum stages, and keep Client browser schemas under `src/lib/client/schemas.ts`. Do not broaden the internal Action, accept stage from the browser, or use an unsafe type assertion.

### 4.5 Safe error and action-result behavior

| Condition | Required Client behavior |
| --- | --- |
| Local malformed task input | No Action invocation. Render generic localized unavailable/recovery state; route params should normally be rejected before the action becomes reachable. |
| Missing/invalid authenticated session | Preserve existing fail-closed auth behavior. Do not render a partial Client action state. |
| Non-Client role | No command call; return safe `UNAUTHORIZED`. |
| Safe target absent/non-visible or `NOT_FOUND` | Do not reveal existence/ownership. Disable/close stale action UI, show generic safe unavailability, and refresh the route. |
| Local preflight detects ineligible current status | Do not call the command. Explain only that the request is no longer available for that action; refresh authoritative route data. |
| RPC `UNAUTHORIZED` / `NOT_FOUND` | No local state change. Use generic localized safe denial/unavailable feedback, then refresh. |
| RPC `INVALID_TRANSITION` / `CONFLICT` / duplicate/stale attempt | Explain that the request state changed; do not claim success. Refresh the queue/detail/project representation. |
| RPC child-submission dependency rejection (`INVARIANT_VIOLATION` or established equivalent) | Explain that one or more requested submissions remain outstanding without naming other Client records or exposing internal details. Refresh the safe request detail and child summary. |
| Unknown/interrupted online failure | Clear pending state, retain no persisted queue or replay state, provide retry guidance, and do not mutate local status. |
| Accepted start | Announce the authoritative in-progress state, call `router.refresh()` as UI follow-up, and render refreshed server state. |
| Accepted completion | Announce authoritative completion only after accepted result, call `router.refresh()`, and render refreshed safe state. Do not claim a child asset was uploaded/verified/delivered. |

Map error codes to catalog keys. Do not render `error.message` as product copy.

For Client review results: validation keeps the change-request dialog open with associated field feedback; `NOT_FOUND`/`UNAUTHORIZED` closes stale action state and refreshes safely; `INVALID_TRANSITION`/`CONFLICT` renders generic state-changed feedback and refreshes without local feedback; an accepted approval announces only authoritative approval and internal final-delivery ownership; an accepted change request announces the authoritative internal revision plus PM re-review path. Neither outcome claims delivery, remote URL reachability, or an immediate Client re-review.

---

## 5. Route, navigation, and presentation specification

### 5.1 Route matrix

| Surface | Spanish | English | Server gate/read boundary | Required result |
| --- | --- | --- | --- | --- |
| Client role home | `/cliente` | `/en/cliente` | Existing `requireSession`; role `client`; concise shell summary only | Keep lightweight. Once real routes exist, it may link to the project dashboard and direct-request queue without duplicating their data systems. |
| Client project dashboard | `/cliente/proyectos` | `/en/cliente/proyectos` | `requireSession`; role `client`; `getClientProjects()` | Multiple-project directory derived solely from `client_project_view`. |
| Client project detail | `/cliente/proyectos/[project-id]` | `/en/cliente/proyectos/[project-id]` | Same; `getClientProjectDetail(projectId)` | One Client-safe context containing separate own requests, own child submissions, and narrowly resolved released-production summary. |
| Client direct-request queue | `/cliente/tareas` | `/en/cliente/tareas` | Same; `getClientRequestQueue()` over `client_task_view` | Cross-project direct-assignment queue only. |
| Client direct-request detail | `/cliente/tareas/[task-id]` | `/en/cliente/tareas/[task-id]` | Same; `getClientRequestDetail(taskId)` | Canonical safe request detail with child requirement summary and only permitted action(s). |
| Client submission form/detail | Deferred to S05-05 | Deferred | Deferred | S05-04 may show safe child summaries only; it must not create a dead submission link. |
| Client production-review queue | `/cliente/entregables` | `/en/cliente/entregables` | Same; `getClientProductionReviewQueue()` over `client_deliverable_view` | Server-rendered project-scoped released-production review queue, separate from direct submissions. |
| Client production-review detail | `/cliente/entregables/[deliverable-id]` | `/en/cliente/entregables/[deliverable-id]` | Same; `getClientProductionReviewDetail(deliverableId)` | Canonical safe review detail with deliberate stored-URL opening and the only two eligible Client review actions. |

Spanish remains unprefixed; English is delivered by the existing locale routing. All internal navigation uses the locale-aware `Link`/helpers from `@/i18n/routing`. Do not construct `/en/` URLs manually or infer locale from browser pathname in Client Components.

### 5.2 Navigation activation

The shared `AppNav` and `MobileNavToggle` currently render Client project navigation disabled. S05-04 changes only that now-real Client destination.

1. For the Client role, make the existing project navigation item a live locale-aware link to `/cliente/proyectos` in desktop and mobile navigation.
2. The link must be sequentially keyboard reachable and must not have `aria-disabled="true"` or `tabIndex={-1}`.
3. Mobile activation retains the existing drawer-close-on-navigation behavior and Escape/focus-restoration behavior.
4. Do not add a second global Client navigation item merely for direct requests or reviews. The project dashboard must provide visible local entries to both real queues, avoiding a PM-style workspace navigation system.
5. Do not alter Admin, PM, or Operator navigation, language switching, theme switching, sign-out, or notification affordances.

### 5.3 Client project dashboard

The project dashboard is a Server Component.

Required structure:

1. localized page heading and concise Client-safe purpose statement;
2. server-rendered project cards/list for every returned Client-visible project;
3. each project card shows only returned client-safe project name, status with non-color meaning, client-safe scope when present, returned deadline/activity context where present, and a locale-aware link to the selected Client project detail;
4. card labels must not imply that a Client sees project-wide tasks, project members, internal delivery schedule, or overall progress beyond the exact safe status returned;
5. a visible local entry to `/cliente/tareas` labeled as the Client's own requests, not a global task board;
6. localized loading, normal empty, and non-leaking error/retry treatment; and
7. no project editing, member management, task/project counts, Kanban, comments, audit, internal notes, drive-folder link, or generic internal workspace link.

A normal empty state means no Client-visible active projects are currently returned. It must not say that the Client has no organization, that no project exists, or that the Client has no historical work.

### 5.4 Client-safe project detail

The project detail is a Server Component whose model is returned by `getClientProjectDetail(projectId)`.

Required content, in semantic sections:

1. **Project context:** returned project name, Client-visible scope, returned client-safe status, and returned client-safe date/activity context. No internal description, drive folder, member list, or raw identifiers.
2. **Your requests:** only the current Client's direct requests returned through `client_task_view` for this project. Each card shows title, status, priority, deadline, child-submission requirement summary, and a locale-aware link to the canonical own request route.
3. **Your requested submissions:** only the current Client's direct child-submission cards returned through `client_submission_view` for this project and associated to returned direct requests. Each card is read-only in S05-04: title, parent request title where safely returned, specifications, submission deadline, current terminal/pending status, and current version/provider context only when returned. No submit/reopen/edit link is rendered yet.
4. **Released production reviews:** only Client-safe returned production review cards. Each links to the real canonical review detail route and remains visually/semantically separate from direct Client submissions.
5. return navigation to `/cliente/proyectos` and local links to `/cliente/tareas` and `/cliente/entregables`.

A project detail must never render a generic “all tasks” section. Every direct-work label must use ownership language such as “Your requests” and “Your requested submissions,” never “Project tasks” or “Project deliverables.”

If the selected project is invalid/non-visible/absent, render one generic localized safe absence/denial state with a return link to `/cliente/proyectos`. Do not render a partial dashboard from a broad task/submission lookup.

### 5.5 Direct-request queue

The direct-request queue is a Server Component over `client_task_view`, spanning all Client-visible projects.

#### Queue ordering

Order only safe returned rows, deterministically, with this default priority:

1. overdue non-completed requests: oldest deadline first;
2. `blocking` priority active requests: nearest deadline first;
3. `high` priority active requests: nearest deadline first;
4. `medium` priority active requests: nearest deadline first;
5. `low` priority active requests: nearest deadline first;
6. completed requests, if the safe view returns them: most recently completed first; otherwise omit them rather than inferring history.

Use task ID only as a final stable tie-breaker. Do not use client device time, browser timezone, task creation time, another Client's data, or a separate internal query. A returned `blocked` status is displayed as a non-actionable state and must not be mistaken for `blocking` priority.

#### Queue card content

Each card shows only:

- direct request title;
- safe project name as context;
- localized status and priority, distinct from one another and not color-only;
- deadline/overdue context derived from returned safe deadline and existing formatter conventions;
- child submission summary as explanatory text; and
- the locale-aware canonical detail link.

The queue must not expose assignee identity, Client membership, internal task type, internal task comments, project-wide count, PM status controls, drag-and-drop, or client-side filters as an authorization mechanism.

A normal empty state means no directly assigned requests are currently returned. It must not infer that the selected Client has no projects or that the organization has no tasks.

### 5.6 Direct-request detail and action gating

The request detail is the canonical safe action surface. A sheet/drawer may be added later as a progressive interaction only if it preserves and navigates to this canonical URL; S05-04 does not require a duplicate detail presentation.

The page renders only:

1. returned request title and Client-safe description as plain text;
2. localized task status and priority, with distinct textual/icon/accessible meaning;
3. returned deadline and start/completion context when present;
4. approved safe task resources from `client_task_view`, rendered as non-fetching display-only metadata in this item. Do not add outbound link controls unless a later item expressly owns that behavior; a resource label/URL is not a permission to dereference it;
5. child client-submission requirement cards and advisory completion-readiness explanation;
6. exactly one current primary action, where eligible;
7. return navigation to the direct-request queue and safe project detail.

Action eligibility is presentation guidance only:

| Returned task state | Allowed visible primary action | Prohibited controls |
| --- | --- | --- |
| `pending` | Start request; complete request may be presented only as an explicit alternate action if existing interaction design keeps both actions understandable and the child dependency advisory is visible | Assign, edit, block, reopen, in-review, delete, Kanban, PM controls |
| `in_progress` | Complete request | Start, assign, edit, block, reopen, in-review, delete, Kanban, PM controls |
| `completed` | Read-only completed state | Every mutation control |
| `blocked`, `in_review`, unknown/null | Read-only generic unavailable/recovery state | Every Client transition and any explanation of internal workflow |

Implementation preference: for a `pending` request, render **Start request** as the primary action and render **Complete request** as a clearly labeled secondary action only when product design can maintain a simple, accessible hierarchy. If not, show Start only and permit completion after authoritative refresh to `in_progress`; both remain database-allowed, but the UI need not expose every legal shortcut simultaneously.

#### Child requirement summary

For each returned direct child submission, show only safe title/specification/deadline/status/version/provider context returned by the view. The detail must:

- say that a pending requested submission must be completed before the request can be completed;
- state that completion eligibility shown here is based on the current Client-safe representation and will be checked again when submitted;
- show `submitted` as a terminal read-only child state for this item;
- never show a production-review status, feedback, delivery, reopen reason, internal review deadline, or PM/Admin control; and
- never link to a not-yet-implemented submission route/form.

When no child submissions exist, state the neutral truthful condition: no Client submission requirement is currently returned for this request. Do not claim that the request is guaranteed completable; the command remains authoritative.

### 5.7 Transition controls

Use a focused route-local Client Component for action confirmation/pending/result feedback. A simple action area is preferred; use a dialog only when the existing UI pattern requires explicit confirmation for completion. Do not introduce a general task-action component shared with PM/Admin surfaces.

Required behavior:

1. controls invoke only the two Client-specific Server Actions;
2. controls disable while a request is pending and guard against double invocation;
3. controls show a localized pending label and retain no optimistic status mutation;
4. completion must expose the child-submission advisory before submission when outstanding safe children are present;
5. validation/action feedback is field- or control-associated and announced through the existing live-region conventions;
6. success invokes `router.refresh()` only after the Server Action result and relies on server revalidation for durable route freshness;
7. a changed/denied/conflict/invariant outcome refreshes safe data and does not fabricate status/history; and
8. unknown online failure may preserve ephemeral component text/state where relevant, but may never persist a task action in local storage, URL parameters, cache, telemetry, a queue, or replay system.

### 5.8 Client production-review queue and detail

The production-review queue and detail are real S05-04 routes, not a project-detail teaser or a future placeholder. They are Server Component data surfaces backed only by the Client review query functions. They must never be merged with direct `client_submission` cards, forms, or terminology.

#### Queue

The review queue renders only rows already returned by `client_deliverable_view` for the authenticated Client's active project memberships. It has two explicit sections when returned data warrants them:

1. **Awaiting your review:** `awaiting_client_review` rows ordered by Client delivery deadline; and
2. **Recent review outcomes:** returned `approved`, `changes_requested`, or `delivered` rows, read-only and clearly not an archive/search system.

Each card may show only Client-safe project name, deliverable title/specifications, returned current version as `v{n}` when present, Client delivery deadline, localized status, and a locale-aware canonical review-detail link. It must not show internal reviewer identity, operator context, internal feedback, raw history, or project-wide assignment data.

#### Detail

The review detail renders only the selected Client-safe returned production deliverable:

1. Client-safe title, specifications, project name/context, current version number, status, submitted context, and Client delivery deadline;
2. the current stored Google Drive URL as a deliberate outbound link only when a returned non-empty URL exists, using `target="_blank"`, `rel="noopener noreferrer"`, and a localized explicit external-link accessible name;
3. Client-stage feedback history only when returned by `client_deliverable_view`, parsed to a narrow safe model and presented without internal-stage/reviewer/audit fields; and
4. state-specific result/action content described below.

The application must not fetch, preview, proxy, download, scan, authenticate against, or test reachability of the URL. Opening it is an intentional browser navigation only; it does not prove the linked content exists or is safe.

| Returned state | Required Client presentation | Allowed action |
| --- | --- | --- |
| `awaiting_client_review` | Identify the currently returned version as awaiting the Client's decision. | Exactly **Approve deliverable** and **Request changes**. |
| `approved` | Read-only authoritative approval state; explain that final delivery is an internal authorized handoff. | None. |
| `changes_requested` | Read-only authoritative Client change-request state; explain that internal revision plus PM re-review are required before any future Client review. | None. |
| `delivered` | Read-only delivered state if returned by the safe view. | None. |
| unknown/null | Generic safe recovery state. | None. |

#### Review actions

Use focused route-local Client Components. Approval requires an explicit localized confirmation dialog. A change request uses an accessible dialog/form with persistent label, required non-empty comment, maximum 5,000 characters, inline validation, pending/double-submit protection, cancel/Escape/focus-restoration behavior, and live result feedback.

On an accepted review result, clear sensitive transient comment state, close the dialog, call `router.refresh()`, and rely on concrete server revalidation. On conflict, stale, duplicate, invalid-transition, or denial results, do not append local feedback, change the rendered version/status, or claim a decision was stored; render safe state-changed feedback and refresh. A Client review is never a final-delivery action and a Client change request never provides a direct return-to-review control.

---

## 6. Component and file architecture

Keep every production implementation file at or below 400 lines. The inventory is a constrained implementation map, not permission for speculative files.

```text
src/lib/client/
├── types.ts                                        # NEW: narrow Client models/maps only
├── queries.ts                                      # NEW: safe-view reads and shaping only
├── schemas.ts                                      # NEW: UUID-only request-action schema
└── actions.ts                                      # NEW: start/complete Client request actions

src/app/[locale]/(protected)/cliente/
├── page.tsx                                        # MODIFY only to add links to real routes; keep lightweight shell
├── proyectos/
│   ├── page.tsx                                    # NEW: Server Component project dashboard
│   ├── [project-id]/page.tsx                       # NEW: Server Component safe project detail
│   └── _components/
│       ├── client-project-list.tsx                 # NEW: project dashboard presentation
│       ├── client-project-card.tsx                 # NEW only if it keeps files bounded
│       ├── client-project-detail.tsx               # NEW: explicit separated dashboard sections
│       ├── client-production-review-summary.tsx    # NEW: project-scoped review links only
│       ├── client-direct-request-summary.tsx       # NEW only if shared by project/queue without policy duplication
│       └── client-submission-requirement-card.tsx  # NEW: read-only safe child summary
├── tareas/
│   ├── page.tsx                                    # NEW: Server Component own request queue
│   ├── [task-id]/page.tsx                          # NEW: Server Component canonical own request detail
│   └── _components/
│       ├── client-request-list.tsx                 # NEW: queue presentation
│       ├── client-request-card.tsx                 # NEW: safe request summary/navigation
│       ├── client-request-detail.tsx               # NEW: safe request presentation
│       └── client-request-actions.tsx              # NEW: interactive start/complete leaf
├── entregables/
│   ├── page.tsx                                    # NEW: Server Component Client review queue
│   ├── [deliverable-id]/page.tsx                   # NEW: Server Component Client review detail
│   └── _components/
│       ├── client-review-list.tsx                  # NEW: queue presentation
│       ├── client-review-card.tsx                  # NEW only if it keeps files bounded
│       ├── client-review-detail.tsx                # NEW: safe exact-current-version context
│       └── client-review-actions.tsx               # NEW: approve/change-request interaction leaves
└── _components/client-shell.tsx                    # MODIFY only if real-route links replace placeholder-only affordances

src/components/shared/app-nav/
├── app-nav.tsx                                     # MODIFY: activate only Client projects link
└── _components/mobile-nav-toggle.tsx               # MODIFY: same Client link and existing close behavior

messages/es-MX.json                                 # MODIFY: exact Spanish Client keys
messages/en-US.json                                 # MODIFY: exact English Client keys

__tests__/client/client-portal.test.tsx             # NEW: safe query/presentation for projects, requests, and reviews
__tests__/client/client-actions.test.ts             # NEW: Client request/review Action ownership, fixed inputs, refresh/error behavior
__tests__/app-shell/navigation.test.ts              # MODIFY: Client project-nav activation only
```

Rules:

- Keep all view selection, deduplication, child association, ordering, and safe target lookup in `src/lib/client/queries.ts`; pages/components must not reproduce them.
- Do not create a new test file merely to assert a catalog leaf, Tailwind class, icon internals, or a component already adequately covered in `client-portal.test.tsx`.
- Do not modify Operator modules, PM/Admin actions, internal task/detail queries, migrations, generated types, OpenAPI, environment files, hosted configuration, or S05-05/S05-06 owned source files.
- Do not add `loading.tsx`, `error.tsx`, or `not-found.tsx` boilerplate where an existing protected parent boundary already provides correct generic safe handling. Add a route-local boundary only where it materially supplies Client-specific non-leaking recovery.

---

## 7. Localization, accessibility, responsive design, and recovery

### 7.1 Catalog contract

Use the existing `projects` message namespace. Add only the semantic leaves actually used by this item, with a focused structure such as:

```text
projects.clientPortal
projects.clientProjects
projects.clientRequests
projects.clientSubmissions
```

Do not create new top-level route-named or visual-position namespaces. Reuse existing shell navigation, role labels, status/priority maps, date formatting, common buttons, and generic recovery copy where they already match the required meaning.

At minimum, catalog coverage must include:

- Client dashboard, project-detail, and own-request queue headings/descriptions;
- Client-owned-work wording that cannot be mistaken for project-wide work;
- project status and task priority/status accessible meaning where existing maps do not already provide it;
- request action labels, pending/confirmation/success/error feedback, and child-submission prerequisite explanation;
- read-only child requirement labels, submitted/pending meaning, and no-requirement state;
- generic safe absence/denial, loading, empty, retry, return-navigation, and state-changed copy;
- accessible labels for project/request links and action controls; and
- review queue/detail headings, current-version context, deliberate external-link description, approval confirmation, change-request comment/form validation, immutable-result, conflict, and internal-re-review explanation.

Rules:

1. `es-MX` is the default visible locale and `en-US` is its exact semantic counterpart.
2. Every new leaf is present and non-empty in both catalogs. Interpolation variable names match exactly.
3. New keys use semantic lower camel case and do not encode component names, URL paths, visual placement, color, or locale.
4. No new component renders hard-coded Spanish/English user-facing copy, raw enum values, raw error messages, UUIDs, raw URLs, or private fields.

### 7.2 Accessibility and mobile contract

At a 375px viewport and by keyboard alone, a Client must be able to open the project dashboard, open an own project/request/review, understand whether child requirements remain, start/complete an eligible request, deliberately open a stored review URL, approve or request changes where eligible, and understand authoritative results without horizontal scrolling.

Required behavior:

- Use semantic page/section/article/list headings that distinguish project context, own requests, own requested submissions, and any resolved released-review summary.
- Project and request links have localized accessible names that identify the destination, rather than relying on visual card position.
- Primary action controls and interactive links meet the 44×44px minimum target where primary; no hover-only action or tooltip contains essential information.
- Status and priority use localized text plus icon/semantic description; color is supplemental only. `blocking` priority and `blocked` status must remain distinguishable.
- The request action leaf has persistent labels, disabled/pending semantics, safe live feedback, and keyboard operation. If a confirmation dialog is used, it has title/description semantics, Escape/cancel behavior, focus containment, and focus restoration.
- Review confirmation/change-request dialogs meet the same focus/keyboard requirements; the change-request comment is persistently labeled, associated with inline validation, and never prepopulated from hidden feedback.
- Child-submission prerequisite text is readable in normal document order and is not indicated only by color, an icon, or a disabled unexplained button.
- No dense table, horizontal card rail, drag-and-drop, hover-only disclosure, desktop-only gesture, or PM-style Kanban is required.
- Plain-text Client-safe descriptions/specifications wrap safely, preserve reading order, and use existing light/dark semantic tokens.

### 7.3 Loading, empty, absence, and failure states

| Condition | Required treatment | Prohibited treatment |
| --- | --- | --- |
| Project/request route pending | Existing correct parent boundary or a route-local localized skeleton/loading label without data fetch/mutation | Fabricated project titles, task counts, member data, or action state |
| No returned Client projects | Truthful Client-safe empty state: no active Client-visible projects currently available | Claiming no organization, no historical projects, or no projects in the system |
| No returned direct requests | Truthful own-work empty state: no direct requests currently available | Claiming no project tasks, no Client membership, or no work for other Clients |
| No returned production reviews | Truthful review empty state: no Client-visible released production deliverables currently require or retain review context | Claiming no deliverables/project history exists, or exposing unreleased/internal work |
| Project/request ID invalid, absent, foreign, stale, or non-visible | One generic localized safe absence/denial state plus return link to Client-safe parent route | Distinguishing invalid/nonexistent/foreign/archived/not-assigned outcomes |
| No child submissions returned | Neutral requirement state; no Client submission requirement is currently returned | Guaranteeing task completion or implying an asset was not requested internally |
| Action state changed / pending-child command rejection | Safe localized state-changed/prerequisite copy, then authoritative refresh | Raw RPC text, a false completed state, child names not returned to this Client, or an internal workflow explanation |
| Unexpected rendering/data failure | Generic localized retry/recovery through existing safe error boundary convention | Supabase/RLS/SQL detail, raw IDs/URLs, stack/digest, private project context |

A retry repeats the normal route/action path only after user intent. It must not create a persisted query/mutation queue or automatic replay.

---

## 8. Focused verification contract

Use established Vitest, React Testing Library, and MSW conventions. This work item needs focused application evidence only. Existing data-platform migration/RLS/state-machine evidence remains authoritative for database enforcement; do not mechanically duplicate it. Do not add Playwright, a live database suite, snapshot-only coverage, a general visual test framework, or a sprint-wide verification pass.

### 8.1 Minimal test-file strategy

Create only two focused Client test files and extend the existing navigation suite:

1. `__tests__/client/client-portal.test.tsx` owns query-model/presentation behavior for Client project dashboard, project detail, request queue/detail, child requirement summaries, route absence, localization/accessibility semantics, and direct-assignment isolation at the supplied safe-model boundary.
2. `__tests__/client/client-actions.test.ts` owns Client request/review Server Action validation, fixed inputs, role/target preflight, command invocation, concrete revalidation, and safe failure behavior.
3. Extend `__tests__/app-shell/navigation.test.ts` only for Client desktop/mobile project-link activation and preservation of unrelated role navigation.

S05-05 extends these Client test files when its owned behavior is added. S05-06 is absorbed and creates no separate test suite. Do not create one test file per route or component.

### 8.2 Required assertions

#### A. `__tests__/client/client-portal.test.tsx`

Cover the public behavior of the S05-04 Client safe model and presentation:

1. Client project reads use `client_project_view` with explicit fields; direct requests use `client_task_view`; child requirements use `client_submission_view`; production reviews use `client_deliverable_view`; no query uses a base table, internal workspace query, or `select("*")`.
2. Project detail contains only the selected returned Client-safe project, that Client's direct request/submission records for that project, and the separately typed resolved released-production representation. A Client B direct record supplied outside Client A's allowed task IDs is not associated/rendered.
3. A non-visible/malformed/absent project or task target yields generic safe absence rather than identity/ownership disclosure.
4. The request queue ordering distinguishes overdue work, `blocking` priority, and `blocked` status without inventing browser-time semantics or project-wide data.
5. Project cards and request cards use locale-aware navigation paths and label direct work as Client-owned, not project-wide.
6. Request detail renders only safe title/description/status/priority/deadline/resources/child requirement content; it renders no internal descriptions, member/assignee data, comments/audit, PM controls, review controls, or unreturned fields.
7. Child summaries distinguish pending/submitted safely, explain advisory completion dependency, render no submission form/reopen/review/delivery controls, and do not create a dead S05-05 link.
8. Eligible action presentation is limited to start/complete according to returned request state; completed/blocked/in-review/unknown states render no Client mutation control.
9. Empty/loading/recovery output does not leak raw database/RLS/UUID/error detail.
10. Review queue/detail renders only safe project/deliverable/version/status/deadline/Client-feedback context, deliberate `noopener noreferrer` URL opening, and exactly approve/change-request controls for `awaiting_client_review`; approved/changes-requested/delivered are read-only.
11. Review actions render required comment validation, confirmation, pending/double-submit protection, safe conflict refresh, no fabricated feedback, and the mandatory internal re-review explanation.
12. Required semantic headings, accessible link/control names, non-color status/priority cues, keyboard-compatible structure, and narrow-card markup are represented. Do not assert pixel values, Tailwind class strings, SVG internals, or every literal translation.

#### B. `__tests__/client/client-actions.test.ts`

Cover the Client-owned action boundary only:

1. invalid raw input is rejected before any query/command invocation;
2. unauthenticated behavior preserves `AuthError`; any non-Client session receives safe `UNAUTHORIZED` and does not call the command;
3. the action obtains its target only through the Client-safe transition lookup, treats absent/non-visible targets as safe `NOT_FOUND`, and never invokes Admin/PM `transitionTaskStatusAction()`;
4. browser input cannot inject next status, reopen reason, actor, role, project, assignee, task type, status, or redirect path;
5. start invokes the typed command exactly once with fixed `in_progress`; complete invokes it exactly once with fixed `completed`;
6. local stale/ineligible safe target state returns a safe invalid-transition result without command execution;
7. accepted start/complete revalidate exactly the concrete Spanish/English Client queue, request detail, project index, and selected project detail paths;
8. denial, invalid transition, conflict, pending-child invariant rejection, and unknown outcomes expose code-based safe results, cause no local fabricated task state, and request authoritative refresh behavior at the UI boundary; and
9. no action creates persistent retry/offline/replay state.
10. Client review Actions accept only deliverable ID plus required change-request comment, fix `stage: "client"` and decision server-side, reject absent/non-visible/non-`awaiting_client_review` targets safely, invoke the low-level review command exactly once, and never invoke the PM/Admin internal review Action.
11. Client approval/change-request success revalidates exactly the concrete localized review queue/detail, Client project index/detail paths; validation, denial, stale/competing conflict, and unknown outcomes produce code-based safe results without local feedback/status/version fabrication.

#### C. `__tests__/app-shell/navigation.test.ts`

Extend only for changed Client shared navigation:

1. Client projects is a live locale-aware keyboard-focusable link in desktop navigation;
2. the same target is live in the mobile drawer and follows its existing close behavior;
3. Client project navigation is no longer disabled/non-tabbable;
4. Admin, PM, and Operator navigation behavior remains unchanged; and
5. no duplicate PM-style global Client task/review navigation item is introduced; the real local project/dashboard entries remain reachable.

### 8.3 Verification commands

After implementation, run only the focused commands required for the item’s factual evidence:

```text
npm run test -- __tests__/client/client-portal.test.tsx __tests__/client/client-actions.test.ts __tests__/app-shell/navigation.test.ts
npm run typecheck
npm run build
npm run lint
npm run format:check
```

Do not run database commands, hosted-environment checks, S05-wide manual journeys, `npm run verify`, coverage, or a formatter that mutates files for this item unless a controlling owner task explicitly changes scope. S05-07 owns integrated final verification and manual role-isolation journeys.

---

## 9. Acceptance criteria

- [ ] `/cliente/proyectos`, `/en/cliente/proyectos`, `/cliente/proyectos/[project-id]`, `/en/cliente/proyectos/[project-id]`, `/cliente/tareas`, `/en/cliente/tareas`, `/cliente/tareas/[task-id]`, `/en/cliente/tareas/[task-id]`, `/cliente/entregables`, `/en/cliente/entregables`, `/cliente/entregables/[deliverable-id]`, and `/en/cliente/entregables/[deliverable-id]` are real protected Server Component routes with Client role gates and locale-aware navigation.
- [ ] Shared desktop/mobile Client project navigation is activated only after the project dashboard exists; it is keyboard reachable and preserves mobile drawer behavior.
- [ ] Every Client project, request, child-submission, production-review, and action-preflight read is made through `src/lib/client/queries.ts` using only the applicable Client-safe views and explicit fields.
- [ ] No S05-04 Client route/action imports or queries internal S04 PM/Admin project/task/deliverable detail sources, base tables, comments, audit/notification data, membership, or `select("*")`.
- [ ] The Client project dashboard lists every returned active Client-member project but does not display internal descriptions, team/member data, project-wide tasks/counts, internal deadlines, PM controls, or archive/search scope.
- [ ] Selected project detail separates Client-scoped project context, the Client's own direct requests, the Client's own direct submission summaries, and project-scoped released production reviews linking only to implemented review detail. It never flattens them into a project-wide work list.
- [ ] Two active Clients on the same project cannot receive each other's direct request/submission records in Client dashboard/detail/queue models or through forged project/task paths.
- [ ] The Client request queue/detail renders only directly assigned requests and distinguishes overdue behavior, `blocking` priority, and `blocked` status without exposing internal context or inventing status semantics.
- [ ] The canonical request detail renders only Client-safe PM-written title/description/priority/deadline/resources/child summary and exactly the allowed Client action affordance for current safe state.
- [ ] The only mutations available are Client-owned start/complete request actions and approve/change-request review actions. Browser input cannot choose arbitrary task status, stage, decision, actor, role, assignee, project, task type, version, or lifecycle fields.
- [ ] Start/complete invoke only the established `transitionTaskStatus()` adapter/RPC with fixed permitted target state. They do not reuse PM/Admin action wrappers or perform table writes.
- [ ] A completion attempt truthfully explains pending direct child submission requirements where present, but only the command result determines completion. A rejected completion refreshes authoritative Client-safe state without false success.
- [ ] Client-submission cards in this item are read-only. They provide no URL submission, provider validation, correction/reopen, production-review, feedback, approval, change-request, or delivery control.
- [ ] Client review queue/detail uses only `client_deliverable_view`; any active Client project member can deliberately open the returned current Drive URL and make exactly one server-fixed-stage review decision only while the returned authoritative state is `awaiting_client_review`.
- [ ] Client approval/change-request Actions invoke only the narrow review adapter with server-fixed `stage: "client"`; approval and comment-required change request are immutable, version-scoped, conflict-safe, and explain respectively the internal delivery handoff or mandatory internal re-review path.
- [ ] No external URL is fetched, previewed, proxied, scanned, uploaded, stored, checked, or described as verified by S05-04. The sole allowed remote-facing behavior is deliberate Client browser opening of an already-returned production-review URL using safe outbound-link policy.
- [ ] Missing, malformed, foreign, stale, or non-visible routes/actions converge on generic localized safe absence/denial/recovery behavior with no raw errors, IDs, RLS detail, private URLs, or hidden-context disclosure.
- [ ] All new visible content has exact `es-MX`/`en-US` semantic-key/interpolation parity. Primary actions are keyboard operable, focus-safe, screen-reader labeled, non-color-dependent, touch-target compliant, mobile-first, and legible in both themes.
- [ ] Only the two focused Client test files plus the existing navigation suite are required. No Playwright, broad test suite, database suite, provider work, migration, hosted-environment work, changelog, or closeout artifact is introduced.
- [ ] The Section 8.3 commands pass with factual recorded outcomes before S05-04 is reported complete.

---

## 10. Stop conditions

| Discovery | Required response |
| --- | --- |
| A required Client project/request/submission field is absent from the committed Client-safe view/generated type | Stop only the affected surface. Record the exact required safe field and request a narrowly scoped authoritative projection decision. Do not use a base-table read, type assertion, manual generated-type edit, or Client-side join. |
| The current migration/source/types/RPC contract conflicts with a direct-assignee rule, task transition, child-submission dependency, project-review visibility, or view field named here | Stop the affected item and record the exact contradiction. Higher subject authority controls; do not decide it in a component. |
| A Client route/action can reveal another Client's direct task/submission, internal project description, team/membership, internal feedback/comments/audit, unreturned resource data, or PM/Admin controls | Block implementation. Correct the projection/query boundary and re-verify; hiding leaked data in presentation is insufficient. |
| A required Client action lacks the constrained command, safe error shape, direct-assignee enforcement, immutable/history preservation, or child-dependency enforcement | Stop. Do not use a direct table update, elevated browser/server fallback, generic API endpoint, or local-only policy. |
| A request transition needs `blocked`, `in_review`, reassignment, scope/deadline/priority edit, delete, reopen, or any arbitrary status selection | Defer/reject. Those behaviors are not Client actions in S05-04. |
| A child submission requirement needs URL input, remote validation, external access, provider behavior, reopening, immutable version display beyond safe view fields, or a submission mutation | Defer to S05-05. Do not add a partial form or dead action. |
| Client review needs a field not returned by `client_deliverable_view`, internal feedback/version access, a direct table read, or an extension to report a link incident | Stop the affected review surface. Do not use an internal lookup or a type assertion. The current view lacks a Client-safe current version ID, so link-incident reporting remains deferred. |
| A feature requires offline cache/queue, replay, service worker, background sync, provider dispatch, webhook, schedule, external notification, hosted configuration, or new API surface | Defer to its owning epic. Do not broaden S05-04. |
| Focused tests expose a Client-isolation leak, arbitrary-status injection, PM-wrapper reuse, false completion, false action success, raw-error leak, dead destination, localization mismatch, or inaccessible primary action | Block S05-04 until corrected and re-verified. |

---

## 11. Handoff to S05-05 and S05-07

S05-04 leaves these stable boundaries:

1. `src/lib/client/queries.ts` as the sole Client-safe application read layer, with explicit distinction between project-scoped Client visibility and direct-assignee work visibility.
2. Canonical Client project and request URLs, safe absence/denial treatment, locale-aware navigation, and a minimal Client dashboard that does not resemble an internal workspace.
3. A Client request detail model that safely associates only direct child `client_submission` records and exposes a truthful advisory completion prerequisite.
4. Client-specific request/review Actions that derive role/actor from session, accept only narrow task/deliverable envelopes, fix allowed transition/stage/decision inputs server-side, invoke constrained adapters, and revalidate concrete Client routes.
5. Canonical Client production-review queue/detail/action routes, deliberate stored-URL opening, immutable feedback result handling, and re-review explanation; S05-06 creates no follow-on implementation slice.
6. Focused Client test seams that S05-05 extends rather than duplicating routes/components/test infrastructure.

S05-05 may add the distinct Client public-HTTPS validator, submission schema/action, immutable version result, terminal `submitted` presentation, and PM/Admin-controlled correction context only through `client_submission_view` and `submit_client_deliverable()`. It must not alter S05-04's request action boundary or turn child summaries into production review UI.

---

## 12. Decision record and implementation-readiness notes

### 12.1 Accepted decision: S05-DEC-02 — absorb Client production review into S05-04

The Project Owner accepted S05-DEC-02 on 2026-08-22. The complete Client production-review queue/detail/action scope originally sequenced as S05-06 is now owned by S05-04.

This removes the temporary review-summary/deferred-review split. S05-04 must deliver the real canonical `/cliente/entregables` and `/cliente/entregables/[deliverable-id]` routes, deliberate safe Drive opening, Client approval/change-request actions, conflict handling, and truthful post-decision state. S05-06 is retained only as an absorbed historical sequencing marker in the sprint plan; it produces no duplicate UI, route, action, test, or closeout work.

The decision does not expand Client submission scope: S05-05 still owns Client-submission URL/correction behavior. It also does not authorize an internal version/feedback lookup, a schema change, a link-report workaround, remote URL inspection, or a production-review lifecycle shortcut.

### 12.2 Confirmed review-adapter implementation gap

The current low-level `reviewDeliverable()` adapter is reusable, but its input type imports `ReviewDeliverableSchema`, which accepts only `stage: "internal"`; the current `reviewDeliverableAction()` is likewise intentionally PM/Admin-only. S05-04 must make the minimal typed command-input split defined in Section 4.4 so Client Actions can call the existing authoritative RPC with server-fixed `stage: "client"` without broadening the internal Action or using an unsafe cast.

### 12.3 No schema gap for review routes; link reporting remains deferred

The committed Client-safe views, review RPC, RLS boundary, and generated types are sufficient for Client review queue/detail/decision work. No migration, type regeneration, or hosted-environment operation is required.

The optional broken-link report remains out of scope because `client_deliverable_view` does not expose a Client-safe current version ID required by `report_broken_link()`. This is intentionally not treated as permission to query immutable versions or add a projection migration within S05-04.

---

*This implementation specification was written and reconciled on 2026-08-22 from the accepted Sprint 05 plan, the S05-01 contract-mapping reference, the completed S05-02/S05-03 specification conventions, the current protected-shell/navigation/action patterns, the committed Client-safe view/command baseline, and Project Owner decision S05-DEC-02. It delivers the combined Client portal/project/request/review surface, keeps Client submission/correction in S05-05, and defers only sprint-closeout work to S05-07.*
