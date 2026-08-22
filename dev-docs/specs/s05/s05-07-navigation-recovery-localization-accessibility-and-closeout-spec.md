# S05-07 — Integrate Navigation, Recovery States, Localization, Accessibility, and Closeout Evidence

**Sprint:** S05  
**Work item:** S05-07  
**Status:** Implementation-ready  
**Last reviewed:** 2026-08-22  
**Spec authority:** `dev-docs/specs/s05/s05-e06-e07-operator-and-client-execution-sprint-plan.md`, especially Sections 4–10; `dev-docs/specs/s05/s05-e06-e07-contract-mapping-reference.md`; S05-02 through S05-05 implementation specifications; committed Supabase migrations and `src/lib/database.types.ts`; `AGENTS.md`.  
**Dependencies:** S05-02 Operator agenda/navigation, S05-03 Operator task/submission, S05-04 Client portal/request/review (including the absorbed S05-06 scope), and S05-05 Client submission/correction loop are integrated in the shared S05 checkout.  
**Successor boundary:** This is the final Sprint 05 implementation item. It integrates existing E6/E7 capability; it does not add a new workflow, role, schema feature, provider integration, or deployment activity.

---

## 1. Objective

S05-07 turns the completed E6/E7 feature slices into a coherent, role-safe application capability and produces the factual evidence required to close Sprint 05.

At completion:

1. an Operator can enter the real My Day journey from the authenticated shell, browse only their own work, open a canonical task route, and recover safely from unavailable, stale, validation, or interrupted online states;
2. a Client can enter the real project portal from the authenticated shell, reach their own direct requests and project-scoped released reviews through existing real routes, complete permitted actions, and recover safely without learning protected facts;
3. desktop and mobile navigation, loading, empty, not-found/denial, error, form-recovery, locale, theme, keyboard, and touch behavior are internally consistent;
4. all newly touched user-visible strings are catalog-backed in Spanish and English with exact semantic-key parity; and
5. `dev-docs/specs/s05/s05-sprint-05-closeout-verification.md` records only actual integrated evidence, migration status, limitations, and successor scope.

This item is an integration and evidence pass. It must not rewrite S05 data queries, lifecycle commands, role policy, immutable history, URL policy, or review logic merely to make the screens appear uniform.

---

## 2. Scope and hard boundaries

### 2.1 In scope

1. Audit the shared authenticated desktop/mobile navigation and correct it only where an Operator or Client link points to a route that is absent, unusable, role-unsafe, non-localized, or inconsistent between desktop and mobile.
2. Preserve the established two-level global navigation model: role home plus one role-primary secondary destination. Keep Client request/review links in the existing Client home quick-link surface; do not turn the global shell into a PM-style workspace menu.
3. Add route-appropriate loading, safe absence/denial, and error/retry treatment for the real Operator and Client route families listed in Section 4.
4. Reconcile existing E6/E7 empty and recovery states so they are truthful, localized, accessible, non-leaking, and do not fabricate a workflow result.
5. Correct any S05-touched hard-coded user-visible fallback/recovery text discovered in the audited route and component surfaces. In particular, the current fallback strings `Sin título` in the Operator role-home shell and `Sin nombre` in the Client role-home shell are user-visible localization defects and must be replaced with semantic catalog values.
6. Preserve and extend the existing semantic catalog structure under `projects`; maintain exact `es-MX` and `en-US` leaf-key/interpolation parity.
7. Add focused integration regression coverage for role navigation, safe recovery, catalog parity, and accessible primary journeys without duplicating database/RLS/state-machine tests owned by prior work items.
8. Execute the complete final repository verification workflow once after all S05 integration changes are present and record its actual output in the closeout artifact.
9. Run and record the S05 manual localhost journeys from the sprint plan against mutable sandbox data only.
10. Add one factual, chronological S05-07 entry to `CHANGELOG.md` only after the final verification outcome is known.

### 2.2 Explicitly excluded

- New task, deliverable, project, client-submission, or production-review lifecycle states, commands, transitions, data queries, API routes, or browser authority.
- Schema redesign, direct data edits, dashboard edits, generic SQL, destructive reset, generated-type hand editing, or a new migration merely for integration polish.
- Additional global navigation items for Client requests/reviews, Operator project browsing, archive, calendar, metrics, system administration, or notification history.
- External notification dispatch, WhatsApp, email, webhooks, QStash/Workflow schedules, delivery receipts, provider activation, or notification-queue operations. These remain E8.
- Offline cache, persisted mutation queues, service workers, background sync, retry replay, polling, broad Realtime, or optimistic persisted state.
- URL dereference, preview, proxy, content inspection, provider authentication, binary upload/storage, reachability claims, or Drive/third-party API access.
- Playwright, visual-regression infrastructure, hosted browser automation, preproduction, production, deployment, or production-like infrastructure verification.
- Broad refactoring of S04 internal workspace navigation, the locale switcher, theme system, protected-layout/session architecture, or shared error framework.

### 2.3 Non-negotiable security and truthfulness rules

- `requireSession()`, `profiles.role`, route guards, RLS, safe projections, and constrained commands remain the authority. Navigation visibility, a route parameter, browser component state, or an empty response never grants access.
- A role mismatch continues to route to the authenticated actor's localized role home. A same-role deep route must independently use its established safe query boundary; recovery UI must not decide authorization.
- Safe absence, unauthorized visibility, malformed route input, and unexpected data/rendering failure may use the same generic user-visible recovery wording where distinguishing them would disclose a protected fact.
- Do not render raw Supabase/PostgREST/RPC messages, database policy/function names, IDs, raw unreturned URLs, stack traces, `error.message`, error digests, provider payloads, or audit fields.
- Every recovery retry is a fresh normal read or user-initiated mutation. It must not retain a fake accepted state, create a persisted retry queue, or replay a mutation after refresh.
- Lexical validity remains only lexical validity. S05-07 must not claim that a submitted or opened external URL is reachable, safe, uploaded, downloaded, inspected, delivered, or received.
- The closeout record may claim only what was directly observed in the final integrated repository run, a documented focused test, a documented manual localhost journey, or the controlled prior migration evidence. It is not deployment, provider, preproduction/production, external-link, or deployed-RLS proof.

---

## 3. Baseline reconciliation and migration preflight

### 3.1 Reconciled route and feature baseline

The shared S05 checkout already contains these real target routes. S05-07 must verify them rather than create alternatives:

| Role | Route family | Existing capability to preserve |
| --- | --- | --- |
| Operator | `/operador`, `/operador/agenda`, `/operador/proyectos`, `/operador/proyectos/[project-id]`, `/operador/tareas/[task-id]` | Role home, server-rendered own-work agenda, own-work project grouping, own-task project list, canonical task detail, and constrained production submission. |
| Client | `/cliente`, `/cliente/proyectos`, `/cliente/proyectos/[project-id]`, `/cliente/tareas`, `/cliente/tareas/[task-id]`, `/cliente/entregables`, `/cliente/entregables/[deliverable-id]` | Role home, Client-safe project directory/detail, direct-request queue/detail, in-detail direct submission/correction, and project-scoped production review queue/detail. |

Spanish remains unprefixed. English equivalents are created by the project locale routing helper under `/en`. Internal application links touched by this item must use `Link` from `@/i18n/routing`; do not construct `/en` paths manually or fall back to raw `next/link` for internal navigation.

### 3.2 Current global navigation contract

`AppNav` and `MobileNavToggle` currently compute the same role-home and secondary target matrix:

| Role | Role home | Required global secondary destination | Status after S05 |
| --- | --- | --- | --- |
| `admin` | `/admin` | `/admin/proyectos` | Existing S04 behavior; preserve. |
| `pm` | `/pm` | `/pm/proyectos` | Existing S04 behavior; preserve. |
| `operator` | `/operador` | `/operador/agenda` | Live S05-02 destination; retain as a normal locale-aware link. |
| `client` | `/cliente` | `/cliente/proyectos` | Live S05-04 destination; retain as a normal locale-aware link. |

Desktop and mobile must remain equivalent. The mobile secondary link must close the existing drawer before navigation; Escape must close the drawer and restore focus to the menu toggle. Preserve the language switcher, theme toggle, notification affordance, profile display, and sign-out behavior.

Do **not** add global `/cliente/tareas`, `/cliente/entregables`, `/operador/proyectos`, task-detail, project-detail, or review-detail links. The Client home already provides real quick links for projects, requests, and reviews. Operator agenda and project cards provide contextual downstream navigation. This keeps the global shell constrained and avoids navigation that suggests broad role authority.

### 3.3 Migration preflight and conclusion

Before application integration begins, inspect the final S05 migration inventory, generated types, S05-05 implementation, and current working-tree status.

The documented S05 migrations are:

1. `20260821170000_s05_03_operator_task_detail_safe_projection.sql` for the Operator-safe task/detail projection; and
2. `20260822095500_s05_05_harden_client_submission_urls_and_correction_history.sql` for authoritative Client-submission URL validation, provider classification, immutable correction history, and the `client_submission_view.correction_history` representation.

**No additional S05-07 migration is required by the current accepted scope.** Navigation, route recovery, catalog, accessibility, tests, changelog, and closeout consume existing application/data boundaries.

Stop only if final inspection proves a real mismatch between the committed migration source, generated types, and S05 application consumption—for example, a route requires a safe field that is not in its safe view, or a known accepted S05 command cannot produce the represented state. If that occurs, record the exact missing capability, role, invariant, safe fields, and negative cases as a bounded preflight requirement. Do not use an internal query, direct table write, browser filtering, privileged client, or UI-only workaround.

The S05-05 migration itself is prior scope, not a new S05-07 migration. Closeout must state its source path, its `jsf-pm-dev` evidence status, and its generated-type provenance separately from S05-07 changes.

---

## 4. Route integration and recovery contract

### 4.1 Shared route behavior

For every listed route:

1. keep data-first Server Component rendering for route reads;
2. use the existing role-specific query layer only (`src/lib/operator/**` for Operator and `src/lib/client/**` for Client);
3. let the established page/query return safe `null`/absence where its current contract does so, then render a generic localized safe absence/denial presentation;
4. use route-level `notFound()` only where a page has enough safe information to do so without leaking existence or membership;
5. use a route-level error boundary for unexpected render/read failure, not as an authorization branch;
6. capture exceptions only through the established safe capture convention if present in the applicable recovery component; and
7. preserve the actor's current locale on every internal return link.

No route-level recovery component may receive a raw route ID, Supabase record, authorization reason, database error, provider response, or raw submitted URL merely to make its copy more specific.

### 4.2 Loading states

The current role-root `operador/loading.tsx` and `cliente/loading.tsx` already use `Skeleton`, `aria-busy="true"`, and `aria-live="polite"`. Keep their semantic behavior. Add nested `loading.tsx` files only where a real route transition otherwise lacks meaningful localized or visually stable feedback.

Where a new or corrected loading boundary is justified, it must:

- use the installed `Skeleton` primitive and semantic theme tokens;
- expose a meaningful `role="status"` or equivalent associated polite live-region label, with catalog text only if visible/screen-reader text is actually rendered;
- be presentation-only: no fetch, mutation, role branching, fake count, project name, task title, client name, deadline, URL, version, or lifecycle result;
- represent the target layout at a 375px viewport without horizontal page scrolling; and
- not duplicate a parent boundary that already provides equivalent feedback.

### 4.3 Operator route matrix

| Surface | Data/authorization boundary | Required normal behavior | Safe absence/denial/recovery behavior |
| --- | --- | --- | --- |
| `/operador` | Existing shell summary only | Role-home summary and active global Agenda link. | Existing generic role-safe loading/recovery; do not turn it into a duplicate agenda. |
| `/operador/agenda` | `operator_agenda_view` through `src/lib/operator/queries.ts` | Render only returned own-work rows, authoritative urgency text/icons, own-task links, and own project links. | Localized empty state may link to `/operador/proyectos`; unexpected error offers retry and a locale-aware return to `/operador` or `/operador/agenda` only. |
| `/operador/proyectos` | Group/deduplicate only returned Operator rows | Render only projects derived from own agenda rows. | A zero-result state must say no accessible own-work projects, not that no projects exist. Recovery must not expose membership or other assignments. |
| `/operador/proyectos/[project-id]` | Operator-safe project-constrained agenda query | Render only the Operator's own returned tasks for the safe selected project. | Invalid, absent, foreign, or non-visible identifier receives generic localized unavailable/not-found treatment and a locale-aware return to `/operador/proyectos`; never identify project existence. |
| `/operador/tareas/[task-id]` | Operator-safe task query from `operator_agenda_view` | Render the canonical authorized task and its permitted production submission controls. | Invalid, absent, foreign, or non-visible ID receives generic unavailable/not-found treatment and a locale-aware return to `/operador/agenda`; no task/project membership explanation. |

Operator submission recovery remains in the existing focused dialog/action flow:

- malformed Drive URL: field-level localized validation; no action call;
- stale assignment/invalid state/conflict/replay: remove pending state, show generic state-changed copy, refresh authoritative route data, and create no local version/history;
- authorization/not-visible: generic safe unavailable copy and authoritative refresh;
- interrupted/unknown online failure: clear pending state, retain only ephemeral form input, present retry guidance, and do not persist/replay;
- success: use the command result only as a transient acknowledgement, then `router.refresh()` against server-revalidated Operator paths. The UI must show `awaiting_internal_review`, never a direct Client-review release.

### 4.4 Client route matrix

| Surface | Data/authorization boundary | Required normal behavior | Safe absence/denial/recovery behavior |
| --- | --- | --- | --- |
| `/cliente` | Existing shell project summary only | Role-home quick links to the real projects, requests, and reviews queues. | Preserve role-safe empty shell behavior; no internal/project-wide claim. |
| `/cliente/proyectos` | `client_project_view` | Render active Client-member projects only. | Empty copy says no accessible Client projects, not that no projects exist globally. |
| `/cliente/proyectos/[project-id]` | Client-safe project view plus own direct request/submission rows and project-scoped released production review rows | Render only the selected safe project context; project cards remain read-only except real contextual links. | Invalid, absent, inactive, foreign, or non-visible project gets generic unavailable/not-found treatment; return only to `/cliente/proyectos`. |
| `/cliente/tareas` | `client_task_view` | Render only the authenticated Client's direct requests across returned projects. | Empty copy says no direct requests are currently available; it must not imply no project work exists. |
| `/cliente/tareas/[task-id]` | `client_task_view` plus direct child `client_submission_view` | Render only the direct request, current completion guidance, direct child requirements, and permitted actions. | Invalid, foreign, absent, or non-visible request gets generic unavailable/not-found treatment; return only to `/cliente/tareas`. |
| `/cliente/entregables` | `client_deliverable_view` | Render project-scoped released production reviews only. | Empty copy says no production deliverables are currently available for Client review; it must not imply internal work is absent. |
| `/cliente/entregables/[deliverable-id]` | Client-safe production-review detail query | Render the current safe version, Client-stage safe feedback history, and permitted exact-current-version decision action. | Invalid, foreign, absent, stale, or non-visible deliverable gets generic unavailable/not-found treatment; return only to `/cliente/entregables`. |

Client action recovery remains action-specific and command-authoritative:

| Action area | Validation/recovery requirement |
| --- | --- |
| Direct request start/complete | Show no local status mutation before accepted action result and refresh. If child submissions remain pending, give a localized requirement explanation and refresh safe detail; do not reveal unrelated child data. |
| Client submission | Preserve S05-05 raw lexical validation, truthfulness copy, terminal `submitted` presentation, correction-history fail-safe behavior, and no-network guarantee. A malformed correction-history representation suppresses mutation UI and shows generic recovery; it never triggers an audit/version-table fallback. |
| Production review approval/change request | Require confirmation/required comment as already specified. Conflict/stale/competing outcomes clear pending state and refresh from the safe review projection; they must not fabricate feedback or explain another Client's action. |
| External resource/submission/review link | Use deliberate outbound navigation only (`target="_blank"`, `rel="noopener noreferrer"`) with a localized accessible name. No recovery state may claim link validation or reachability. |

### 4.5 Error and not-found component design

Prefer one small shared presentational recovery component only if it prevents real duplicate markup across the new Operator and Client route boundaries. A focused component may accept:

```text
localized title
localized description
localized retry label
reset callback
optional locale-aware safe return destination and label
non-sensitive Error for capture only
```

It must not accept role, capacity, route ID, task/project/deliverable data, raw URL, user identity, Supabase result, policy reason, or a precomputed authorization decision.

Each `error.tsx` remains a client boundary that owns:

1. `error: Error & { digest?: string }` and `reset: () => void`;
2. safe exception capture in an effect, without user-facing `error.message`/digest and without `console.error` UI behavior;
3. its catalog namespace and generic route-specific recovery copy;
4. retry through `reset` only; and
5. its role-safe locale-aware return link when a return is useful.

Each `not-found.tsx` is presentation-only. It must not issue another query, infer the reason for absence, or render a different message for absent versus unauthorized resources. Route pages keep responsibility for deciding whether their safe query result warrants `notFound()`.

Do not replace the protected-root error boundary or create a generic system-wide error framework in this item.

---

## 5. Navigation and information-architecture requirements

### 5.1 Desktop/mobile consistency

For both `AppNav` and `MobileNavToggle`:

- use the exact role matrix from Section 3.2;
- render Operator Agenda and Client Projects as ordinary, keyboard-focusable locale-aware links;
- retain role-home as the first link and the approved secondary target as the second;
- retain the existing `aria-label` for primary navigation and existing accessible menu-toggle labels;
- close mobile navigation on a live link selection;
- preserve Escape-to-close and focus restoration; and
- do not display Admin/PM routes, role labels, or PM-only concepts in the Operator/Client shell.

No role should see a visible disabled placeholder in S05. The former deferred targets are now implemented. Conversely, no role should see links to work that remains deferred.

### 5.2 Contextual downstream navigation

Verify, and repair only when broken, these contextual route connections:

| Origin | Destination | Requirement |
| --- | --- | --- |
| Operator agenda task card | `/operador/tareas/[task-id]` | Canonical task link; accessible name identifies the task. |
| Operator agenda project context | `/operador/proyectos/[project-id]` | Limited to own returned safe project context. |
| Operator project list | `/operador/proyectos/[project-id]` | Project count derives only from own returned rows. |
| Operator project task list | `/operador/tareas/[task-id]` | Never becomes a project-wide task list. |
| Client home | `/cliente/proyectos`, `/cliente/tareas`, `/cliente/entregables` | Existing quick links remain visible and real. |
| Client project detail | Existing canonical direct request/review route | No project dashboard mutation surface for Client submissions. |
| Client request detail | Existing Client submission interaction | No standalone Client-submission route and no PM/Admin correction control. |
| Client review list/project summary | `/cliente/entregables/[deliverable-id]` | Review is project-scoped, not direct-assignee scoped. |

All internal links modified by S05-07 must use canonical pathname values with the routing helper. Do not use client-provided redirect parameters, string replacement on the current URL, or direct `/en` prefix construction.

---

## 6. Localization and catalog contract

### 6.1 Authority and namespace decision

The sprint plan's namespace list is illustrative. The repository's executable key-naming test permits only these top-level namespaces:

```text
shell, privacy, errors, auth, theme, projects
```

Therefore, S05-07 must **not** create top-level `operatorAgenda`, `operatorTask`, `operatorSubmission`, `clientPortal`, `clientRequests`, `clientSubmissions`, `clientReview`, `urgency`, or `common` roots.

Continue to use the established nested namespaces under `projects`:

```text
projects.operatorAgenda
projects.operatorProjects
projects.operatorTask
projects.operatorSubmission
projects.clientPortal
projects.clientProjects
projects.clientRequests
projects.clientSubmissions
projects.clientReviews
```

Use existing `shell`, `errors`, and `theme` keys where they express the same semantic concept. Add a narrowly named recovery subtree under the owning role surface only when no existing key has the exact meaning, for example:

```text
projects.operatorAgenda.recovery
projects.operatorProjects.recovery
projects.operatorTask.recovery
projects.clientPortal.recovery
projects.clientProjects.recovery
projects.clientRequests.recovery
projects.clientReviews.recovery
```

The exact final key set must be derived from the audited components. Do not add speculative unused keys, component-name keys, route/path/locale keys, or duplicate generic text merely for symmetry.

### 6.2 Required catalog rules

1. Spanish (`es-MX`) is default visible output; English (`en-US`) is its exact semantic counterpart.
2. Every new leaf must exist in both catalogs, contain a non-empty string, use identical tree shape, and use identical interpolation variable names.
3. Key segments are lower camel case and identify a user concept, not a visual location, library primitive, language, route, URL, color, or implementation component.
4. Reuse existing status, priority, error, theme, navigation, and common-action strings where their meaning exactly matches. Do not duplicate current labels beneath a new recovery namespace.
5. Newly touched Operator/Client code must not hard-code Spanish/English fallback, recovery, form, empty-state, accessible-label, or error text. This includes replacing current role-shell fallback text such as `Sin título` and `Sin nombre` with catalog-backed values.
6. Do not render raw enum values, validator reason codes, error messages, IDs, raw unreturned URLs, or provider payloads as a localization fallback.
7. Keep semantic status meaning in text as well as icon/color. A localization change must not reduce a badge to color-only meaning.

### 6.3 Required localization evidence

Retain the repository-wide tests:

- `__tests__/i18n/message-catalogs.test.ts` for deep structural parity; and
- `__tests__/i18n/key-naming.test.ts` for namespace and semantic-key hygiene.

Extend the existing S05-focused suite that owns the touched subtree(s) only if it is needed to assert the specific new recovery leaves or interpolation contract. For example, extend the Operator route suite for Operator recovery keys and the Client portal suite for Client recovery keys. Do not build a redundant second whole-catalog parity implementation.

---

## 7. Accessibility, responsive, theme, and online-only contract

### 7.1 Required accessibility outcomes

The following must be verified in the integrated surface, not assumed from a component library:

1. Every primary navigation, task/project/review link, outbound link, submit control, confirmation control, cancellation control, retry action, and safe return link has a localized accessible name.
2. Urgency, task status, request readiness, submission terminal/correction state, and review state communicate by text plus icon/description as appropriate; color is supplementary only.
3. Dialogs/sheets used by the existing production submission, Client submission, and Client review actions have a title/description relationship, trap/manage focus, support Escape and explicit cancel, visibly indicate focus, and restore focus to their invoking control when closed.
4. Form fields have persistent labels, associated help/error descriptions, `aria-invalid` when invalid, disabled/pending semantics, and concise live feedback. Validation errors must not be announced as success.
5. Mutation success, generic connection failure, conflict/stale-state, and correction-history unavailable messages use an appropriate polite/assertive live region without exposing sensitive error text.
6. Primary interactive controls have a 44×44 CSS-pixel minimum hit target, including the mobile menu control and primary action buttons. Where an existing visual button is smaller, expand the actionable hit area rather than relying on precision touch.
7. Essential work is keyboard-operable and does not require drag-and-drop, hover-only disclosure, a tooltip, a desktop pointer, or horizontal scrolling.
8. External links identify their external/deliberate-open behavior without claiming link health.
9. Loading and empty states remain semantically meaningful to assistive technology and do not create fake activity or announce sensitive resource identity.

### 7.2 Responsive and theme outcomes

At a 375px viewport:

- Operator agenda cards, own-work project cards, task detail, resource links, submission dialog, and recovery states fit without page-level horizontal scrolling.
- Client project cards, request queue/detail, client-submission confirmation/history, review queue/detail, and recovery states fit without page-level horizontal scrolling.
- Long submitted URLs wrap or truncate safely in display while the deliberate link remains identifiable and actionable; no raw URL becomes a page-width overflow vector.
- Mobile navigation is usable, closes after an intentional internal navigation selection, and remains Escape/focus-restoration safe.
- Light and dark themes retain contrast and non-color status meaning. S05-07 preserves the installed theme system; it does not redesign theme persistence.

### 7.3 Online-only recovery rule

A failed read or mutation must show a user-initiated retry path, but it must not create a local cache mutation, persistent draft queue, deferred mutation, background retry, service-worker message, or replay after refresh.

For form input, retaining the current raw input in in-memory component state during an interrupted attempt is permitted. It must clear only on accepted success or explicit user cancellation and must not be written to browser persistence.

---

## 8. Implementation sequence

### Step 1 — Inventory the final integrated baseline

Before changing code:

1. inspect `git status`, the current branch, the current commit, and the complete S05 working-tree diff so prior uncommitted S05-05 work is preserved;
2. inspect `AppNav`, `MobileNavToggle`, the protected layout/role guard, role homes, and all real S05 route files;
3. inventory existing `loading.tsx`, `error.tsx`, and `not-found.tsx` coverage under both Operator and Client route trees;
4. inspect existing recovery presentation/capture conventions established by S04-08 before extracting a shared S05 recovery component;
5. inspect the current message catalogs and tests before adding a key;
6. inspect S05-focused tests and retain the test-first contracts already owned by prior items;
7. inspect the committed S05 migration sources and generated types to confirm the Section 3.3 no-new-migration conclusion; and
8. map every user-visible hard-coded fallback discovered in touched S05 route/components to either an existing semantic key or one required new key.

This is discovery only. Do not modify migrations, generated types, the locale-routing configuration, provider configuration, dashboard state, or hosted environments during the inventory.

### Step 2 — Normalize navigation without broadening it

1. Confirm the Section 3.2 matrix is identical in desktop and mobile navigation.
2. Correct a role-secondary link only if it is not a real route, is not locale-aware, differs across desktop/mobile, lacks an accessible normal-link state, or fails to close the mobile drawer.
3. Keep the Client home quick-link set as the only shell-level access point to Client projects, requests, and reviews beyond global Client Projects.
4. Confirm contextual S05 links in Section 5.2 resolve to existing canonical destinations and carry accessible labels.
5. Add focused navigation tests only for a real defect or changed behavior.

### Step 3 — Add the smallest safe route-state coverage

1. Retain correct existing role-root loading boundaries.
2. Add nested loading boundaries only after proving a missing transition state. Use the Section 4.2 contract.
3. Add localized safe absence/not-found presentation for canonical parameterized Operator/Client routes where the current route does not already give safe usable feedback.
4. Add localized error/retry boundaries for route families only where unexpected render/read failure currently falls to an insufficient generic boundary.
5. Extract a shared recovery presentation only if at least two real route boundaries would otherwise duplicate the same safe markup. Keep route-specific translation and return-destination ownership in each boundary.
6. Do not use a new route state to perform a second privileged read or distinguish access denial from absence.

### Step 4 — Reconcile visible recovery and fallback text

1. Replace verified hard-coded user-visible fallback text in S05-touched Operator/Client surfaces with catalog keys.
2. Audit mutation forms for raw backend error rendering, false success, missing pending reset, or stale UI after conflict; preserve action-specific behavior from S05-03 through S05-05.
3. Verify empty states make only scope-safe claims.
4. Verify external-link labels and truthfulness notices remain accurate after localization/refactoring.
5. Add only the catalog leaves that correspond to an actual rendered concept.

### Step 5 — Add focused regression evidence

Use Vitest, React Testing Library, MSW, and existing mocks. Do not weaken, delete, skip, or rewrite S05 test-first contracts to get green results.

| Area | Required focused evidence | Preferred test location |
| --- | --- | --- |
| Global role navigation | Operator desktop/mobile Agenda and Client desktop/mobile Projects are live locale-aware links; no Admin/PM target leaks; mobile close behavior remains intact. | `__tests__/app-shell/navigation.test.ts` |
| Operator recovery | Safe task/project absence and unexpected route recovery expose localized generic copy, retry/return behavior where implemented, and no raw ID/error/policy text. | Extend closest Operator route test or add one narrow recovery test only if a shared presentation component exists. |
| Client recovery | Safe project/request/review absence and unexpected route recovery expose localized generic copy, retry/return behavior where implemented, and no raw ID/error/policy text. | `__tests__/client/client-portal.test.tsx` or narrow shared recovery test. |
| Loading semantics | Any newly added nested boundary has truthful busy/live semantics and no fabricated safe data. | Closest route/component suite; avoid testing framework internals. |
| Fallback localization | Operator/Client role-home and touched empty/recovery states use catalog-backed fallback strings. | Closest shell/route test. |
| Accessibility | Changed controls have accessible names; error associations/live feedback/focus restoration remain covered at public behavior level; no color-only state regression. | Existing Operator/Client presentation tests. |
| Catalog integrity | New leaves are non-empty, structurally identical, use matching interpolation, and obey key naming. | Existing i18n suites plus focused subtree assertion only when required. |
| No offline regression | Interrupted/unknown action result clears pending and gives retry guidance without local persisted/replay state. | Existing Operator/Client action/presentation suites; do not create cache implementation tests. |

Do not add tests for shadcn internals, next-intl internals, Next.js boundary internals, Sentry transport, database/RLS/state-machine enforcement already established by prior S05 work, external provider behavior, link reachability, or every string verbatim.

### Step 6 — Manual localhost journeys

Run these only after focused automated evidence is green. Use mutable sandbox data for every state-changing step. Record persona/capacity, locale, viewport, entry route, action, observed result, and verdict. Do not record credentials, secrets, raw URLs not needed to establish the result, or personal data.

| ID | Journey | Required observation |
| --- | --- | --- |
| J-01 | Operator A, Spanish desktop: use global Agenda; browse own projects; open own project and canonical own task. | All routes are usable and show only Operator A's returned own work. |
| J-02 | Operator A: attempt known Operator B project/task/deep links. | Generic safe absence/denial; no title, project/membership, deliverable, or policy leak. |
| J-03 | Operator A: complete normal production submission through the existing flow. | Pending/confirmation/refresh is truthful; accepted version returns to `awaiting_internal_review`, not Client review. |
| J-04 | Operator A: use controlled interrupted/unknown submission failure where the established local approach permits it. | Pending clears; user can retry; no deferred action survives refresh. Record a limitation if a controlled trigger is unavailable without product changes. |
| J-05 | Client A, Spanish desktop: use global Projects; then Client-home projects, requests, and reviews quick links; open an authorized project/request/review route. | All links are real and Client-safe. Direct work is distinct from project-scoped released review access. |
| J-06 | Client A and Client B on a shared project: attempt each other's direct request/submission URLs and action paths. | Direct-work isolation remains safe; generic recovery does not reveal another Client's records. |
| J-07 | Client A: start/complete direct request, submit/correct a Client submission if sandbox state permits, and make an approval or comment-required change request on a released review. | Existing command-authoritative states, immutable history, correction behavior, and refresh remain truthful; no production/client-submission workflow conflation. |
| J-08 | Client A: exercise stale/conflicting or interrupted Client action through the established local approach. | State-changed/retry behavior does not fabricate feedback/history/status or replay an action. |
| J-09 | Operator and Client, English: switch locale from an S05 route, navigate via global/contextual links, and use a safe return/retry action. | Equivalent `/en` path behavior and English copy; return stays within the correct role route family. |
| J-10 | Operator and Client, 375px, keyboard and touch-target-compatible interactions, light and dark themes. | Primary navigation, task/request/review/submission actions, dialogs, Escape/cancel/focus restoration, status text, and recovery states are usable without horizontal scrolling or color-only meaning. |

Do not fabricate an error merely to create a screenshot. If a controlled local error trigger cannot be invoked without violating scope, record the automated recovery evidence and manual limitation honestly.

### Step 7 — Final full verification and documentation

After all S05-07 source/test changes are integrated:

1. run the repository's full verification workflow exactly once:

   ```text
   npm run verify
   ```

2. record each real stage and outcome: `format:check`, `lint`, `typecheck`, `build`, `test`, `test:coverage`, and `audit:prod`;
3. if the final run fails, mark closeout blocked, record the failing stage and safe summary, correct only the verified cause under proper authority, then run the final workflow again after the fix;
4. create the closeout document described in Section 9 after—not before—the actual evidence exists; and
5. add the S05-07 changelog entry after the closeout verdict is known.

Individual S05 work-item results support the closeout but never replace the final integrated full run.

---

## 9. Required sprint-closeout artifact

Create this exact file after actual implementation and verification:

```text
dev-docs/specs/s05/s05-sprint-05-closeout-verification.md
```

It is a factual completion record, not a plan. Do not prefill it with invented counts, pass claims, completion date/time, environment facts, hashes, secrets, provider results, or manual observations.

### 9.1 Required structure

#### 1. Identity, authority, and verdict

Record:

- Sprint ID: S05.
- Epics: E6 Operator Execution Experience and E7 Client Collaboration, Requests, and Production Review.
- Final status: `complete`, `blocked`, or `ready for review`, determined only by actual evidence.
- Branch/commit only when verified from the authoritative integration source; otherwise say not recorded by this closeout.
- Actual closeout date/time only when observed.
- Authorities: S05 plan, S05-01 mapping reference, S05-02/S05-03/S05-04/S05-05/S05-07 specifications, repository migrations, generated types, and `AGENTS.md`.
- S05-DEC-01 and S05-DEC-02 dispositions: Operator agenda migration/semantics and S05-06 absorbed into S05-04.

#### 2. Definition-of-done traceability

Reproduce every S05 Definition of Done item from plan Section 8 in a table:

| DoD criterion | Verdict | Evidence | Notes |
| --- | --- | --- | --- |

Use only `Met`, `Not met`, or `Blocked`. Evidence must name a concrete changed source/spec path, focused test, manual journey ID, migration evidence, final verification result, or factual limitation.

The table must cover all 16 plan outcomes, including Operator own-work isolation and urgency, production Drive submission/re-review, Client multi-project/direct-work isolation, Client request dependency, Client submission URL/correction separation, Client production review concurrency/re-review, no-leak boundaries, exclusions, accessibility/localization, full verification, and factual closeout/changelog status.

#### 3. Implemented route, projection, and command map

Record the actual final map:

| Domain | Routes/components | Safe projection/action/command | Boundary statement |
| --- | --- | --- | --- |
| Operator navigation and own work | Actual Operator route/component paths | `operator_agenda_view` and Operator query/action modules | Only own returned rows; global role navigation is not task/project authorization. |
| Operator production submission | Actual task/detail/dialog/action paths | `submit_deliverable_version()` adapter | Immutable successor version and internal-review path; lexical Drive URL only. |
| Client project/request work | Actual Client project/request paths | `client_project_view`, `client_task_view`, direct request action | Project membership differs from direct assignee authority. |
| Client submission/correction | Actual request-detail/card/form/action paths | `client_submission_view`, `submit_client_deliverable()` | Direct-assignee only; terminal workflow and safe immutable correction history. |
| Client production review | Actual review paths | `client_deliverable_view`, `review_deliverable()` with server-fixed Client stage | Project-scoped current-version decision; no internal feedback/authority leak. |
| Navigation/recovery/i18n | Actual shared nav, route boundaries, catalog paths | Locale routing/capture/retry presentation | Locale/theme/recovery do not grant authorization or reveal protected facts. |

Use exact symbol/command names only when verified in final source. Do not invent HTTP endpoints or claim external delivery.

#### 4. Changed-file inventory

Group actual changed files by S05-01 through S05-07. For each file, provide path and one concise factual responsibility. List a file only if it changed as part of the accepted S05 work.

For migrations/generated types, state:

- source migration path;
- whether controlled `jsf-pm-dev` application evidence exists;
- whether `src/lib/database.types.ts` was MCP-generated; and
- that this evidence is development-only, not preproduction/production proof.

#### 5. Automated verification

Record the exact final `npm run verify` invocation and per-stage exit outcome/summary. Do not carry test, route, coverage, lint, build, or vulnerability counts forward from an earlier item without copying them from the final run output.

If any final stage failed, state the closeout is blocked and name the safe failure summary. Do not label the sprint complete.

#### 6. Manual localhost evidence

Record J-01 through J-10 from Section 8 with:

- persona/role or capacity (no credentials);
- locale;
- viewport category;
- entry route;
- action;
- expected result;
- observed result;
- verdict; and
- limitation, if any.

Clearly label whether evidence is a manual localhost observation, focused automated assertion, or prior controlled database/migration evidence.

#### 7. Localization, theme, accessibility, security, and truthfulness

Provide short factual subsections:

1. **Localization:** Spanish unprefixed and English `/en`; actual catalog parity evidence; no newly touched hard-coded user-visible strings.
2. **Themes:** light/dark behavior preserved; actual narrow-viewport/theme observations only.
3. **Accessibility:** keyboard, visible focus, named controls, dialog/sheet Escape/cancel/focus restoration, live states, non-color semantics, and touch-target observations actually exercised.
4. **Security and truthfulness:** server-derived role/authorization, role-safe projections, safe generic recovery, immutable command results, lexical-only URL treatment, no external reachability/upload/delivery claim.

#### 8. Migration and environment status

State explicitly:

- S05-02/S05-03 and S05-05 migration source paths actually used by the sprint;
- current `jsf-pm-dev` application/type-generation provenance only when evidence exists;
- whether S05-07 required a new migration (expected: no);
- no dashboard/direct SQL/destructive reset/preproduction/production action in S05-07; and
- no claim that local application tests prove deployed RLS or provider behavior.

#### 9. Deferred scope and known limitations

Name these successors directly:

- E8: notification dispatch, provider operations, schedules, retries, receipts, and review-inactivity handling;
- E9: calendar/feed, archive depth, reporting/metrics, administration, and configuration diagnostics;
- E10: release hardening, real-device evidence, legal/provider readiness, backup/restore, controlled onboarding, deployment, and handover.

Also name any actual residual blocker, approved exception, unavailable controlled manual trigger, or verification limitation. A remaining authorization, lifecycle, immutability, locale-parity, accessibility, or final-verification issue prevents a `complete` verdict.

### 9.2 S05-07 changelog entry

After closeout outcome is known, add one chronological S05-07 section to `CHANGELOG.md` containing:

- the work-item name;
- actual navigation/recovery/localization/accessibility integration changes;
- focused tests added/extended and actual outcomes;
- the actual final `npm run verify` result or an explicit blocked result; and
- the closeout document path.

Keep it factual and concise. Do not restate the whole sprint, use unsupported deployment/provider claims, or state that an external file/link was validated, received, or delivered.

---

## 10. Expected file architecture

Change only files necessary to resolve verified integration gaps. The following is a bounded architecture guide, not authorization to modify every file.

```text
src/components/shared/app-nav/
├── app-nav.tsx                                      # MODIFY only if role matrix/locale/accessibility gap is verified
└── _components/mobile-nav-toggle.tsx                # MODIFY only for matching real mobile behavior gap

src/components/shared/
└── .../role-recovery-state.tsx                      # NEW only if a small shared presentational extraction prevents real duplicate recovery markup

src/app/[locale]/(protected)/operador/
├── loading.tsx                                      # MODIFY only for a verified root-state gap
├── error.tsx                                        # NEW only if root recovery needs a dedicated safe boundary
├── agenda/
│   ├── loading.tsx                                  # NEW only if justified
│   ├── error.tsx                                    # NEW/MODIFY for localized non-leaking recovery
│   └── ...
├── proyectos/
│   ├── loading.tsx                                  # NEW only if justified
│   ├── error.tsx                                    # NEW/MODIFY for localized non-leaking recovery
│   └── [project-id]/
│       ├── not-found.tsx                            # NEW/MODIFY for safe absence presentation
│       └── error.tsx                                # NEW/MODIFY only if justified
└── tareas/[task-id]/
    ├── not-found.tsx                                # NEW/MODIFY for safe absence presentation
    └── error.tsx                                    # NEW/MODIFY only if justified

src/app/[locale]/(protected)/cliente/
├── loading.tsx                                      # MODIFY only for a verified root-state gap
├── error.tsx                                        # NEW only if root recovery needs a dedicated safe boundary
├── proyectos/[project-id]/
│   ├── not-found.tsx                                # NEW/MODIFY for safe absence presentation
│   └── error.tsx                                    # NEW/MODIFY only if justified
├── tareas/[task-id]/
│   ├── not-found.tsx                                # NEW/MODIFY for safe absence presentation
│   └── error.tsx                                    # NEW/MODIFY only if justified
└── entregables/[deliverable-id]/
    ├── not-found.tsx                                # NEW/MODIFY for safe absence presentation
    └── error.tsx                                    # NEW/MODIFY only if justified

src/app/[locale]/(protected)/operador/_components/
└── operator-shell.tsx                               # MODIFY: remove hard-coded fallback only

src/app/[locale]/(protected)/cliente/_components/
└── client-shell.tsx                                 # MODIFY: remove hard-coded fallback only

messages/es-MX.json                                  # MODIFY: actual semantic recovery/fallback keys
messages/en-US.json                                  # MODIFY: exact counterpart

__tests__/app-shell/navigation.test.ts               # MODIFY: focused S05 active navigation/mobile regression
__tests__/operator/...                               # MODIFY only for changed Operator recovery/fallback behavior
__tests__/client/client-portal.test.tsx              # MODIFY only for changed Client recovery/fallback behavior
__tests__/i18n/...                                   # MODIFY only if focused required-key assertion is genuinely absent

CHANGELOG.md                                         # MODIFY after actual final outcome
dev-docs/specs/s05/s05-sprint-05-closeout-verification.md # NEW after actual evidence exists
```

Do not create `src/app/api/**`, a migration, a generated-type change, a broad client data cache, a new global navigation system, an external URL service, or a second implementation path.

Every production implementation file remains at or below 400 lines. Documentation is exempt.

---

## 11. Acceptance criteria

- [ ] Desktop and mobile navigation use the Section 3.2 role matrix: Operator Agenda and Client Projects are live locale-aware routes, and no role sees links to absent/deferred work or another role's workspace.
- [ ] The Client home continues to expose real quick links for projects, direct requests, and production reviews without adding a broad global shell menu.
- [ ] Contextual Operator/Client links use canonical real routes, preserve locale through `@/i18n/routing`, and do not trust browser-provided redirect targets.
- [ ] All canonical parameterized Operator/Client routes have appropriate truthful loading and generic safe absence/denial/retry treatment, without distinguishing inaccessible from absent protected resources.
- [ ] Route recovery renders no raw error, digest, database policy/function, ID, raw unreturned URL, provider payload, audit data, or authorization/membership reason.
- [ ] Existing S05 action recovery remains command-authoritative: invalid input has field feedback, stale/conflicting/unauthorized outcomes refresh safe server state, interrupted requests allow user retry, and no action persists/replays locally.
- [ ] Current hard-coded S05-touched user-visible fallbacks, including Operator and Client role-home fallback text, are catalog-backed; all new catalog leaves are semantically named, non-empty, and have exact Spanish/English structural and interpolation parity.
- [ ] Primary navigation, mutation, recovery, dialog/sheet, status, and external-link interactions are keyboard-operable, focus-safe, named for assistive technology, non-color-dependent, touch-target compliant, and usable at 375px in both themes.
- [ ] Existing safe query/command boundaries, role redirects, immutable history, URL lexical-only policy, Client direct-assignee isolation, Client project-scoped review access, and mandatory production re-review loop remain unchanged and covered by retained regression evidence.
- [ ] Final inspection confirms no new S05-07 migration is required. The closeout accurately records prior S05 migration/type provenance separately and does not claim preproduction/production/deployed-RLS/provider evidence.
- [ ] Focused integration tests pass without weakening prior S05 contracts.
- [ ] One final integrated `npm run verify` run completes after S05 integration. A failure blocks sprint completion and is recorded factually.
- [ ] Manual localhost J-01 through J-10 evidence is recorded honestly, including any controlled-trigger limitation.
- [ ] `CHANGELOG.md` and `dev-docs/specs/s05/s05-sprint-05-closeout-verification.md` accurately distinguish actual automated evidence, manual observation, prior controlled database evidence, known limitations, and deferred E8/E9/E10 scope.
- [ ] No new schema/RLS/RPC/API route, direct data mutation, Prisma/runtime database access, generated type hand edit, Playwright, external URL dereference, provider activation, offline queue/cache, hosted-environment change, or unsupported delivery/reachability claim is introduced.

---

## 12. Stop conditions and decision boundary

| Discovery | Required response |
| --- | --- |
| A required Operator/Client navigation target is absent, unsafe, or needs a new information architecture rather than a repair | Stop the affected work, record the exact missing route/capability, and obtain a scoped decision. Do not invent a placeholder or redirect to an internal workspace. |
| A locale-aware internal link cannot be expressed through `@/i18n/routing` | Stop and inspect the routing contract. Do not manually compose locale prefixes or use browser string replacement. |
| A safe recovery design needs an ID, raw error, membership fact, provider payload, raw URL, audit field, or authorization reason | Stop. Use generic copy or request a safe representation; do not leak the fact. |
| A route requires a field/query/command not supplied by its established safe boundary | Stop the affected feature. Record the exact role, invariant, required safe field, and negative cases as a bounded preflight requirement; do not use a base-table/internal-query/browser-policy workaround. |
| Final S05 migration/type inspection proves a real contract mismatch | Stop only the affected work and document the exact bounded migration requirement. Do not create unrelated schema work under S05-07. |
| A navigation, recovery, localization, keyboard/focus, touch-target, theme, role isolation, lifecycle, immutable-history, URL-policy, or safe-error defect is found | Block Sprint 05 closeout until corrected and re-verified at the owning scope. |
| A requested claim needs external URL reachability, file transfer, provider dispatch, Client receipt, preproduction, production, hosted deployment, or live deployed-RLS proof | State it as out of scope. Do not fabricate evidence or broaden S05. |
| Final `npm run verify` fails | Record the failing stage and safe summary, mark closeout blocked, fix only the verified cause under proper authority, then rerun after the fix. Do not mark the sprint complete. |

---

## 13. Implementation-readiness conclusion

S05-07 is implementation-ready with **no new migration requirement**. The verified integration work is bounded to route/nav cohesion, safe state recovery, catalog hygiene, accessible responsive behavior, focused regression evidence, final verification, changelog, and factual closeout.

Two repository conditions are already identified and require implementation correction rather than Project Owner escalation:

1. S05's real Operator and Client global secondary destinations are already active and must remain live in both desktop and mobile navigation; no new global navigation decision is needed.
2. The user-visible hard-coded fallbacks `Sin título` and `Sin nombre` violate the S05 localization requirement and must be catalog-backed in this item.

No unresolved product, lifecycle, security, schema, or information-architecture decision blocks the specification. If final baseline inspection contradicts that conclusion, Section 12 controls and the affected implementation must stop rather than invent a workaround.

---

*This specification was written on 2026-08-22 from the accepted S05 sprint plan and contract mapping; the current S05-02 through S05-05 route, navigation, migration, catalog, test, and changelog baseline; the S04-08 integration/closeout pattern; and the repository-local `AGENTS.md` contract.*
