# S04-08 — Integrate Navigation, Localization, Focused Evidence, and Sprint Closeout

**Sprint:** S04  
**Work Item:** S04-08  
**Status:** Implementation-ready draft  
**Last reviewed:** 2026-08-21  
**Spec authority:** `dev-docs/specs/s04/s04-e04-e05-project-workspace-and-production-deliverable-lifecycle-sprint-plan.md`, Section 5 (S04-08), Section 6, and Section 7.  
**Dependencies:** Completed S04-01 through S04-07 implementation, especially the established protected layout, `AppNav`, `MobileNavToggle`, localized Admin/PM project routes, project workspace, S04 focused test suites, and the committed `CHANGELOG.md` history.

---

## 1. Objective

S04-08 is the integration and evidence slice that turns Sprint 04 into one coherent internal application capability. It does **not** add a new project, task, deliverable, schema, or workflow feature.

It must ensure that an authorized Admin or PM can reliably travel from the authenticated role shell to the correct localized project directory, into an authorized project workspace, and through the already implemented task and production-deliverable lifecycle without:

- a dead Admin/PM navigation path;
- a competing navigation system;
- hard-coded user-visible recovery copy;
- a locale-losing return link;
- a misleading loading or empty state;
- an error presentation that exposes internal details; or
- an unsupported claim in the Sprint 04 closeout record.

At completion, S04-08 produces the factual sprint-closeout documentation and executes the **one** required full repository verification command after all Sprint 04 integration changes are present.

---

## 2. Scope and hard boundaries

### 2.1 In scope

1. Verify and, only where necessary, correct Admin/PM project navigation in the existing desktop `AppNav` and `MobileNavToggle`.
2. Keep Operator and Client future-work navigation visibly unavailable and non-navigable until E6/E7 supply usable destinations.
3. Preserve locale-aware navigation for Spanish (`es-MX`, unprefixed) and English (`en-US`, `/en` prefixed) protected routes.
4. Reconcile localized Admin/PM project directory and project-detail loading, empty, and recovery/error states using the existing shadcn primitives and current error-capture boundary.
5. Replace S04-touched hard-coded recovery copy with semantic message-catalog keys and maintain exact `es-MX`/`en-US` catalog parity.
6. Add only the focused regression tests necessary to prove S04-08 integration behavior and preserve existing coverage that already proves catalog parity, route guards, theme persistence, project authorization, task behavior, and deliverable lifecycle behavior.
7. Update `CHANGELOG.md` with a factual S04-08 entry after implementation and verification.
8. Create `dev-docs/specs/s04/s04-sprint-04-closeout-verification.md` as a factual, source-backed Sprint 04 closeout record.
9. Run `npm run verify` exactly once for final Sprint 04 closeout after the implementation and focused tests are integrated; record the actual command outcome.

### 2.2 Explicitly out of scope

- New project/task/deliverable lifecycle actions, direct table writes, new RPCs, API routes, migrations, RLS changes, generated-type changes, or Supabase dashboard/MCP operations.
- New navigation destinations, information architecture, sidebar, breadcrumbs, global search, calendar, timeline, archive, notifications UI, or route redesign.
- Enabling `/operador/agenda` or `/cliente/proyectos`; those remain unavailable until E6/E7 respectively.
- Client portal behavior, Client review, Client-facing safe projections, direct client requests, or client submissions (E7).
- Dedicated Operator agenda, mobile task-drawer execution experience, offline functionality, upload experience, or operator portal expansion (E6).
- Provider dispatch, email, WhatsApp, Realtime expansion, webhooks, scheduling, hosted environment changes, production changes, external URL requests, Google Drive reachability checks, or delivery-receipt assertions (E8 and later).
- Playwright, browser automation test suites, exhaustive duplicate tests, snapshot-only tests, visual-regression infrastructure, or a redundant live database suite.
- Refactoring unrelated shell, theme, or component code merely for stylistic consistency.
- Altering the reference corpus to demonstrate a journey. Manual mutations remain in the existing mutable sandbox only.

### 2.3 Non-negotiable truthfulness and security rules

- The protected layout and every project query/command remain separate defense layers. Role-route normalization is **not** project authorization, and a valid role route is **not** permission to read or mutate every project.
- Do not weaken `requireSession`, `ROLE_DEFAULT_PATHS`, `PROTECTED_PATH_PREFIXES`, existing role-route redirects, server-derived project membership checks, RLS, or constrained command boundaries.
- Do not make a recovery UI disclose whether a project exists, whether a particular membership exists, which policy rejected access, an RPC/function name, a database error, a UUID, raw URL, stack trace, or secret.
- Capturing an exception through the established safe `captureException` path is allowed. Rendering `error.message`, `error.digest`, or raw error data to the user is prohibited.
- A closeout record may state only what was actually observed or returned by an executed command. It must never convert a local UI observation into proof of provider dispatch, hosted-environment behavior, file transfer, Google Drive reachability, Client receipt, production readiness, or production deployment.
- The absence of an Admin/PM UI control remains a UX/accessibility requirement; server authorization remains the real boundary.

---

## 3. Authority reconciliation and current baseline

### 3.1 Navigation facts that are already true

The existing implementation already renders the following routes from the shared authenticated shell:

| Application role | Role home | Project/secondary item | S04-08 required treatment |
|---|---|---|---|
| `admin` | `/admin` | `/admin/proyectos` | Active localized application link. It must remain usable from desktop and mobile navigation. |
| `pm` | `/pm` | `/pm/proyectos` | Active localized application link. It must remain usable from desktop and mobile navigation. |
| `operator` | `/operador` | `/operador/agenda` | Future E6 item only. Render unavailable, with `aria-disabled="true"` and removed from sequential keyboard navigation; do not make it an active route. |
| `client` | `/cliente` | `/cliente/proyectos` | Future E7 item only. Render unavailable, with `aria-disabled="true"` and removed from sequential keyboard navigation; do not make it an active route. |

S04-03 already activated the Admin and PM project links. S04-08 must not describe them as stubs, disable them again, create parallel links, or rename the path contract. Rename the local implementation variable `roleSecondaryStub` only if that rename is needed to eliminate active-path ambiguity; if changed, use a truthful neutral name such as `secondaryNavigationItem` and apply the same small change in desktop and mobile components.

### 3.2 Locale-routing facts

The current `next-intl` routing architecture owns locale canonicalization:

- Spanish is `es-MX` and serves protected paths without a locale prefix: `/admin`, `/admin/proyectos`, `/admin/proyectos/[id]`, `/pm`, `/pm/proyectos`, and `/pm/proyectos/[id]`.
- English is `en-US` and serves the equivalent paths under `/en`: `/en/admin`, `/en/admin/proyectos`, `/en/admin/proyectos/[id]`, `/en/pm`, `/en/pm/proyectos`, and `/en/pm/proyectos/[id]`.
- The locale switcher already preserves the semantic pathname through the project `@/i18n/routing` router helpers. S04-08 must not replace it or duplicate its locale selection logic.

All newly touched internal navigation links must use the project locale-aware navigation helpers from `@/i18n/routing`, not a raw `next/link` import, unless the current component already receives a locale-aware destination through an established wrapper. This is required for recovery links and any navigation change made by S04-08. Do not build `/en` manually from browser state, headers, pathname string replacement, or user input.

### 3.3 Protected deep-route rule

The existing protected layout determines the signed-in actor and returns a role mismatch to that actor’s role home. Project pages then use role-safe reads/commands to determine access to the requested project.

S04-08 preserves this sequence:

1. A request enters the normal locale and protected-layout boundary.
2. `requireSession` establishes the actor from the server session.
3. A role mismatch redirects through `ROLE_DEFAULT_PATHS` to that actor’s correct localized role home.
4. The Admin/PM project page performs its existing role-safe project list/detail query.
5. The project query/command boundary independently rejects an unrelated project, forged identifier, inactive membership, or unauthorized mutation.
6. Recovery UI displays a generic localized message and permits only retry or navigation back to the actor’s own project directory.

Do not convert a project-level denial into a redirect based on an untrusted project ID, and do not let the error boundary decide authorization. `NOT_FOUND`, access denial, and an unexpected rendering/data failure may share generic recovery copy where distinguishing them would leak protected facts.

### 3.4 Existing route-surface inventory

S04-08 owns integration across these existing route surfaces. It does not require creation of a route that is already present.

| Surface | Existing path(s) | Required S04-08 outcome |
|---|---|---|
| Authenticated shell | `src/app/[locale]/(protected)/layout.tsx` | Preserve the sole shared shell and its role guard. No second header or workspace-local navigation. |
| Desktop navigation | `src/components/shared/app-nav/app-nav.tsx` | Admin/PM project item is a live locale-aware link; Operator/Client item remains unavailable. |
| Mobile navigation | `src/components/shared/app-nav/_components/mobile-nav-toggle.tsx` | Same role matrix as desktop; drawer closes after a successful live navigation selection; Escape behavior and current toggle semantics remain intact. |
| Admin directory | `src/app/[locale]/(protected)/admin/proyectos/**` | Localized loading, existing empty state, safe recovery, and return path remain coherent. |
| PM directory | `src/app/[locale]/(protected)/pm/proyectos/**` | Localized loading, existing empty state, safe recovery, and return path remain coherent. |
| Admin workspace | `src/app/[locale]/(protected)/admin/proyectos/[id]/**` | Localized loading/recovery, generic safe project-access failure, and locale-preserving return to Admin directory. |
| PM workspace | `src/app/[locale]/(protected)/pm/proyectos/[id]/**` | Localized loading/recovery, generic safe project-access failure, and locale-preserving return to PM directory. |
| Shared workspace | `src/components/shared/projects/project-workspace/**` | Existing Overview, Tasks, Deliverables, Members, and Activity data states remain the only workspace information architecture. |

### 3.5 Known remediation target

The current project-directory and project-detail `error.tsx` files contain hard-coded Spanish user-visible strings and use raw `next/link` for return navigation. This is an S04-08 integration defect.

It must be corrected without broad error-system replacement:

- retain the existing route-level error-boundary ownership;
- use `useTranslations` for user-visible recovery copy;
- use the project locale-aware `Link` helper for the directory return route;
- keep exception capture non-user-facing through the established `captureException` path rather than raw `console.error`; and
- preserve role-specific return destinations (`/admin/proyectos` for Admin and `/pm/proyectos` for PM).

The generic locale-level `src/app/[locale]/error.tsx` and global error boundary are stable existing fallbacks. Do not redesign them unless the focused inspection demonstrates that a project-route change cannot safely compose with them.

---

## 4. Implementation sequence

Perform the sequence below in order. Stop at the stated boundaries rather than expanding S04-08 into feature work.

### Step 1 — Inventory before changing code

1. Inspect the current Admin/PM desktop and mobile navigation implementation.
2. Inspect all four project-route error boundaries, all four project route loading files, and the existing project/workspace empty-state components.
3. Inspect the current message catalogs and the existing message-parity/key-naming test rules before adding a key.
4. Inspect current S04-focused tests and test ownership. Extend an existing suite where it cleanly covers the regression; create one narrow new suite only if no current suite owns the behavior.
5. Confirm the final S04-07 implementation has not introduced another active navigation surface that would compete with `AppNav`.

This is discovery only. Do not alter migrations, generated types, database data, current locale configuration, Sentry configuration, or routing configuration while performing the inventory.

### Step 2 — Normalize the shared navigation contract

Apply the role matrix in Section 3.1 identically to desktop and mobile navigation.

#### Required Admin/PM behavior

- Render the project item as an actual locale-aware `<Link>` for Admin and PM only.
- Preserve the labels from the existing `shell.nav.links.projects` catalog key unless a catalog change is specifically required by a discovered semantic deficiency.
- Keep role-home navigation as the first navigation item and the project directory as the secondary item.
- Do not add project-detail links, recent-project links, tab links, task links, deliverable links, breadcrumbs, or a second workspace header.
- On mobile, the project link must call the existing close-drawer state transition before navigation, exactly as the existing role-home link does.

#### Required Operator/Client behavior

- Keep the existing visible future-work item as a non-actionable affordance only; it remains an `<a>` with `aria-disabled="true"` and `tabIndex={-1}` or a semantically equivalent non-interactive element that communicates unavailable status without a navigation action.
- Do not attach click handlers, use `Link`, call `router.push`, or make the unavailable target focusable.
- Keep its localized label. Do not invent an “under construction” destination, redirect, toast, modal, or fake count.

#### Locale rule

- Import `Link` from `@/i18n/routing` for every S04-08-modified internal link. Use only canonical pathname values such as `/admin/proyectos` and `/pm/proyectos`; the routing helper owns locale prefixing.
- Do not use an ordinary external `<a>` for an active Admin/PM internal route.
- Do not change the language switcher or theme-toggle behavior as part of this item.

### Step 3 — Make route loading states truthful and accessible

The existing project route `loading.tsx` files are the required route-specific loading boundary. Audit and correct them only where a real gap exists.

Every project-directory and project-detail loading state must:

1. use the existing shadcn `Skeleton` primitive and semantic theme tokens;
2. expose `aria-busy="true"` and a polite live-region signal on its outer meaningful loading container, or use a visually hidden localized loading label associated with an equivalent live region;
3. avoid hard-coded visible text, project names, membership facts, task counts, delivery counts, or fabricated lifecycle activity;
4. represent the route’s actual layout shape without requiring a horizontal scroll at narrow widths; and
5. remain presentation-only: no fetch, mutation, authorization branch, or client-only interaction.

Do not add a loading file for a route that already receives the appropriate parent loading boundary unless a real user-visible route-specific gap is documented in task evidence.

### Step 4 — Reconcile empty states without false promises

Use the existing project directory and workspace empty-state components where they already meet the requirements. Do not replace them merely to produce uniform markup.

Audit the following states:

| Context | Required truthful content | Prohibited content |
|---|---|---|
| Admin project directory has no returned projects | Localized empty title/description; Admin may receive the already-authorized project-create action if it exists in that directory’s normal surface. | A claim that no projects exist globally if the safe projection is scoped; fictitious project counts. |
| PM project directory has no returned projects | Localized statement that no accessible/assigned projects are available; no create CTA unless the existing PM create authority and route already support it. | An assertion that no projects exist, an invitation to access Admin data, or an unauthorized creation action. |
| Workspace Tasks tab has no safe returned tasks | Localized empty state appropriate to the project/workspace and existing capacity gating. | Fake Kanban columns/cards, invented task metrics, or Client execution behavior. |
| Eligible client-project Deliverables tab has no returned deliverables | Localized empty state and the existing authorized create action only when the S04-06 eligibility gate says it is allowed. | A claim that a Drive link was validated, reviewed, released, or delivered. |
| Internal/incomplete client-project Deliverables tab | The existing truthful unavailable/setup explanation. | Any production-deliverable create control, Client portal action, or provider claim. |
| Activity has no safe completion-cycle projection | Localized statement that no project lifecycle activity is available yet. | A fabricated audit timeline, calendar, archive, or unrelated system activity. |

Do not make an empty state infer authorization from the absence of data. Server reads and commands remain the authority.

### Step 5 — Localize project recovery/error boundaries

#### 5.1 Required boundary behavior

The four concrete route-level error boundaries are:

```text
src/app/[locale]/(protected)/admin/proyectos/error.tsx
src/app/[locale]/(protected)/admin/proyectos/[id]/error.tsx
src/app/[locale]/(protected)/pm/proyectos/error.tsx
src/app/[locale]/(protected)/pm/proyectos/[id]/error.tsx
```

Each boundary must remain a client component because Next.js error boundaries receive `error` and `reset` on the client. Each must:

1. accept `error: Error & { digest?: string }` and `reset: () => void`;
2. call `captureException(error, { boundary: "localized-route" })` in `useEffect`; do not log raw failure data through `console.error` in this route UI;
3. use `useTranslations` to resolve all title, description, retry, and return-action copy;
4. render the existing shadcn `Button`, semantic destructive icon treatment, and token-based classes;
5. offer a retry button wired only to `reset`;
6. for detail routes only, offer a locale-aware return link to the correct role directory;
7. expose no raw error/digest/database/provider/authorization detail; and
8. remain usable by keyboard, including a visible focus state supplied by the shared `Button` primitive.

A directory error should contain only a localized recovery title, a generic directory-load description, and retry action. A detail error should contain only a localized workspace-load description, retry action, and a role-specific return-to-directory action.

Do not use distinct messages that reveal whether the project was missing versus unauthorized. Generic wording such as “The project workspace could not be loaded. Try again or return to your projects.” is correct when localized.

#### 5.2 Reuse strategy

Avoid four independently maintained hard-coded layouts.

Create a focused presentational shared component only if it reduces duplicated recovery markup while keeping route ownership clear, for example:

```text
src/components/shared/projects/project-workspace/project-recovery-state.tsx
```

If created, it must accept only already-localized title/description/action labels, a `reset` callback, an optional locale-aware directory destination, and a non-sensitive `Error` for safe capture. It must not accept role, raw URL, project ID, Supabase data, or authorization metadata. Each route-level `error.tsx` remains the default export and supplies its own localized semantic copy and role-specific return route.

Do not extract a generic global error framework, alter global error-copy behavior, or introduce a role decision inside the shared presentational component.

### Step 6 — Catalog contract

Use the repository’s established catalog structure. The project’s existing semantic-key test permits top-level namespaces `shell`, `privacy`, `errors`, `auth`, `theme`, and `projects`; therefore, do **not** add a new top-level `common`, `navigation`, `localization`, or route-named namespace merely because the sprint plan gives generic namespace examples.

Add S04-08 keys under the existing project namespace. The required target is:

```text
projects.workspace.recovery
```

The exact lower-camel-case structure must be identical in `messages/es-MX.json` and `messages/en-US.json`. At minimum, supply semantic values for:

```text
projects.workspace.recovery.directory.title
projects.workspace.recovery.directory.description
projects.workspace.recovery.workspace.title
projects.workspace.recovery.workspace.description
projects.workspace.recovery.pmWorkspace.description
projects.workspace.recovery.retryAction
projects.workspace.recovery.returnToProjectsAction
projects.workspace.recovery.returnToAssignedProjectsAction
projects.workspace.recovery.loading
```

Rules:

- `pmWorkspace.description` may explain that the workspace could not be loaded without stating whether the actor lacks membership or the project is absent.
- `returnToProjectsAction` is for Admin detail recovery; `returnToAssignedProjectsAction` is for PM detail recovery.
- `loading` is a non-visible/live-region label only when route loading implementation needs it. Do not add an unused key.
- Reuse existing `shell.nav.links.projects`, `shell.nav.links.home`, and theme/status labels. Do not duplicate them below `projects.workspace.recovery`.
- Every leaf value is a non-empty string in both catalogs. Interpolation names, if any, must be identical; this scope does not require interpolation.
- Key segments must be lower camel case and semantic. Do not use `button`, `input`, `form`, `header`, `footer`, `sidebar`, `route`, `path`, `url`, `locale`, language codes, visual-position terms, color terms, or component library names in new key segments.
- No newly touched component may hard-code Spanish or English user-visible copy or render an adapter/database error message.

Existing whole-catalog parity tests remain the main parity evidence. Do not create a second deep JSON-parity implementation for these same catalogs.

### Step 7 — Preserve workspace integration behavior

S04-08 is an integration pass, not a workspace rewrite. Confirm the project pages still load their existing server-rendered safe data and pass it into the single `ProjectWorkspaceShell`.

The shell must continue to expose only these localized sections:

1. Overview;
2. Tasks;
3. Deliverables;
4. Members; and
5. Activity.

Do not add Timeline, Calendar, Archive, or another status dashboard. Do not reintroduce a Deliverables placeholder, replace the task workspace, or make a project workspace accessible from Operator or Client navigation.

The primary integration journey remains:

```text
Admin or PM authenticated role shell
  → own project directory
  → authorized project workspace
  → Tasks or Deliverables tab
  → existing constrained Server Action / command boundary
  → router.refresh() / safe server-rendered authoritative state
```

No step in this journey creates client-trusted authorization, a second status machine, an optimistic fake history entry, or a notification/provider assertion.

### Step 8 — Focused automated evidence

#### 8.1 Test ownership and minimum scope

Use the current Vitest, React Testing Library, and MSW conventions. Preserve all existing S04 test-first contracts; implementation work must not weaken, delete, skip, or rewrite them to obtain a green suite.

S04-08 needs only the following focused regression evidence. These are necessary because the slice changes shared navigation/recovery behavior and corrects real localization defects.

| Area | Required evidence | Preferred test location |
|---|---|---|
| Active Admin/PM navigation | Admin and PM render the project item as a live internal link to the correct canonical role path; it is not `aria-disabled` and not removed from tab order. | Extend `__tests__/app-shell/navigation.test.ts`. |
| Deferred Operator/Client navigation | Operator and Client still render their future-work item as unavailable, `aria-disabled`, non-focusable, and not a live application `Link`. | Extend `__tests__/app-shell/navigation.test.ts`. |
| Desktop/mobile parity | The same role matrix applies to both `AppNav` and `MobileNavToggle`; on mobile, an Admin/PM live project link uses the existing drawer-close path. | Extend `__tests__/app-shell/navigation.test.ts` only if the current test setup can exercise the state transition without duplicating component internals. |
| Localized safe recovery | The project recovery presentation resolves localized title, description, retry and applicable return action; it contains no supplied raw error message/digest and calls safe exception capture. | Add one narrow `__tests__/projects/project-recovery-state.test.tsx` only if a reusable recovery component is created; otherwise extend the closest existing project workspace component test. |
| Catalog integrity | New recovery leaves have exact catalog parity, non-empty values, and semantic names. | Existing `__tests__/i18n/message-catalogs.test.ts` and `__tests__/i18n/key-naming.test.ts` are sufficient; add only focused required-key assertions if they do not already protect the new recovery contract. |

#### 8.2 Explicitly not required

Do **not** add tests for:

- shadcn primitive internals;
- `next-intl` routing internals;
- Next.js loading-boundary implementation internals;
- Sentry SDK internals;
- database/RLS/state-machine invariants already covered by the accepted command/data platform and S04-02 through S04-07 tests;
- each empty state as a duplicated screen snapshot;
- theme implementation internals already covered by S04-01;
- every locale string verbatim; parity and focused render assertions are sufficient;
- Playwright/hosted browser tests; or
- external provider/file behavior.

#### 8.3 Required assertions for any new recovery test

When a new shared recovery presentation component is introduced, test only its public behavior:

1. it shows supplied localized title and description;
2. retry calls the supplied `reset` callback once;
3. an optional return link renders only when supplied and uses the supplied safe destination/label;
4. it does not render a representative raw `error.message` or `digest`; and
5. it calls the established exception-capture helper once when the error boundary mounts.

Do not assert CSS-class strings, Lucide SVG implementation details, component-library DOM internals, or Sentry transport behavior.

### Step 9 — Manual localhost evidence

After the focused automated coverage is green, execute only the following representative journeys against the existing local development environment and mutable sandbox. Record the persona/role, locale, viewport, entry route, action, observed result, and verdict in the closeout document.

| ID | Journey | Required observation |
|---|---|---|
| J-01 | Admin, Spanish desktop: use global Projects navigation from `/admin`. | Navigates to `/admin/proyectos`; directory is usable; no placeholder/dead link. |
| J-02 | PM Lead, Spanish desktop: use global Projects navigation from `/pm`, open an authorized project, then open Tasks and Deliverables. | `/pm/proyectos` and allowed workspace route load; existing task/deliverable controls remain governed by current capacity/state. |
| J-03 | Admin, English: switch to English from an Admin project directory or workspace, use Projects navigation, invoke a detail recovery return action through a controlled local failure if safely available. | Equivalent canonical route is under `/en`; return action remains inside `/en/admin/proyectos`; recovery copy is English and reveals no raw error detail. |
| J-04 | PM, English: navigate to an allowed workspace and use the localized return-to-assigned-projects recovery action through a controlled local failure if safely available. | Return action remains under `/en/pm/proyectos`; generic recovery copy is English and does not disclose authorization/membership facts. |
| J-05 | Operator and Client, desktop and narrow mobile: inspect secondary future-work item. | It is visibly unavailable, `aria-disabled`, skipped by normal keyboard tab order, and cannot navigate to an unfinished route. |
| J-06 | Admin or PM, narrow viewport: open mobile navigation, use Projects, then reopen and press Escape. | Project link is usable and closes the drawer on selection; Escape preserves existing close/focus-return behavior; no competing workspace navigation appears. |
| J-07 | Authorized PM Lead, narrow viewport: execute the existing primary project/task/deliverable journey in both themes. | Existing localized controls remain keyboard/touch-target usable; no horizontal trap and no lifecycle/provider claim is introduced by S04-08. |
| J-08 | PM Watcher and unrelated PM: use a direct project route/action already supported by the sandbox test setup. | Server/query/command boundary safely denies unauthorized access or mutation; recovery UI does not leak why. |

Do not fabricate a failure solely to create a screenshot. If a controlled local recovery trigger is unavailable without changing production behavior, document the recovery component/test evidence and record the manual limitation honestly.

### Step 10 — Sprint closeout documentation

Create this exact repository artifact:

```text
dev-docs/specs/s04/s04-sprint-04-closeout-verification.md
```

The document is a completion record written **after** the actual work and final verification. It must not be prefilled with invented pass results, static counts, personal data, raw local environment values, secrets, or claims beyond the recordable scope.

Use the following required structure.

#### 10.1 Identity and scope

- Sprint ID: S04.
- Epics: E4 Project Workspace and Internal Work Management; E5 Production Deliverable Lifecycle and Internal Collaboration.
- Feature slug/branch only when directly verified from the authoritative integration source; otherwise state “not recorded by this closeout.”
- Completion date/time only from the actual completion event.
- Status: complete, blocked, or ready for review, based on actual evidence.
- Authority references: the Sprint 04 plan and S04-01 through S04-08 specs.

#### 10.2 Definition-of-done traceability

Reproduce every Sprint 04 Definition of Done criterion from sprint-plan Section 7 in a table with:

| Column | Required content |
|---|---|
| DoD criterion | The exact or faithfully scoped criterion from the plan. |
| Verdict | `Met`, `Not met`, or `Blocked`; never “assumed.” |
| Evidence | Specific changed source path, focused test path, manual journey ID, final verification output section, or factual limitation. |
| Notes | Only necessary scope clarification; no raw errors/secrets. |

The table must explicitly cover visual foundation/theme persistence, role-safe project management, membership invariants, task state behavior, completion/reopen semantics, deliverable eligibility/history, internal review/re-review loop, link/comment distinction, localization/accessibility, excluded scope, and focused/full verification.

#### 10.3 Implemented route and command/representation mapping

Record the actual S04 implementation map, at minimum:

| Domain | Routes/components | Server action/data command or safe representation | Boundary statement |
|---|---|---|---|
| Theme/navigation | Existing shell, `ThemeProvider`, `ThemeToggle`, `AppNav`, mobile navigation | Client preference only; role navigation remains server-protected | Theme selection is not authorization. |
| Project directory/governance | Admin/PM directories and workspaces | Existing S04 project actions/queries | Role route is separate from project membership authorization. |
| Tasks | Existing Tasks workspace components | Existing constrained task actions/commands | Kanban/list uses the same state-transition boundary. |
| Completion/reopen | Existing workspace lifecycle controls | Existing project lifecycle command/readiness projection | Warning is not a client-side completion guarantee. |
| Deliverable planning/submission/history | Existing Deliverables workspace components | Existing S04 deliverable actions, safe history representations, submission command | Submission records a version; it does not inspect the external URL. |
| Internal review/delivery | Existing review/delivery controls | Existing review/delivery commands | Internal review is version-scoped; delivery state is not external receipt. |
| Comments/link reports | Existing comment/link-report components | Existing constrained actions | Informal comments and incident reports are not formal lifecycle evidence. |

Use exact symbol/command names only when they are present in the final committed source. Do not infer an API endpoint or provider integration.

#### 10.4 Changed-file inventory

Group actual changed files by S04 work item (`S04-01` through `S04-08`). For each entry, provide its path and one concise factual responsibility. Do not list a file merely because it was inspected. Include migrations/generated types only if they were actually part of the accepted completed S04 work and record their known environment scope as `jsf-pm-dev` when supported by prior verified evidence.

#### 10.5 Automated verification

Record the actual final command exactly:

```text
npm run verify
```

For each stage it invokes, record the executed subcommand, exit result, and factual summary from the actual output:

```text
npm run format:check
npm run lint
npm run typecheck
npm run build
npm run test
npm run test:coverage
npm run audit:prod
```

Rules:

- Do not infer test/suite/coverage/vulnerability counts from a previous sprint or individual work-item changelog entry.
- If a command fails, the closeout is blocked. Record the failing stage and safe failure summary; do not mark the sprint complete.
- Do not rerun the full command repeatedly. One final full run after integrated S04 changes is the required closeout execution.
- Individual work-item verification already recorded in `CHANGELOG.md` may be cited as supporting evidence but does not replace the final full run.

#### 10.6 Manual localhost journeys

Record the actual outcomes for J-01 through J-08 in Section 4, plus any Sprint-plan Section 6 journey that was run and is needed for a DoD criterion. Each row must contain persona/capacity (no password or secret), locale, viewport category, entry route, action, expected result, observed result, and verdict.

Clearly distinguish:

- manual localhost observation;
- focused automated assertion; and
- database/platform evidence already established by an authoritative prior item.

#### 10.7 Localization, theme, accessibility, and security impact

State factual impact under four short subheadings:

1. **Localization:** Spanish default/unprefixed and English `/en` routes; exact catalog parity; no newly touched hard-coded user-visible recovery strings.
2. **Themes:** light initial default plus stored explicit selection, with S04-08 preserving—not redesigning—the S04-01 behavior.
3. **Accessibility:** keyboard navigation, visible focus, accessible labels/states, error recovery actions, dialogs/sheets, and narrow viewport observations actually exercised.
4. **Security/truthfulness:** server-derived authorization, safe non-leaking recovery, lexical-only external URL handling, immutable history, and no provider/external-transfer assertion.

#### 10.8 Deferred scope and limitations

Name these direct successor boundaries explicitly:

- E6: Operator execution experience and its dedicated mobile workspace;
- E7: Client portal, direct client requests/submissions, and Client review decisions;
- E8: notification/provider dispatch, scheduling, delivery receipts, and external-provider activation;
- no production/preproduction deployment, provider activation, file transfer, Drive reachability validation, or external receipt proof in S04.

Also list any actual remaining blocker, test limitation, or approved exception. Do not label a sprint “complete” while an unresolved issue affects authorization, lifecycle correctness, immutable history, locale parity, accessibility, or final verification.

### Step 11 — Changelog update

After the closeout outcome is known, add one chronological S04-08 entry to `CHANGELOG.md`.

It must contain:

- the work-item name;
- actual navigation/recovery/localization integration changes;
- focused tests added or extended and their actual results;
- the actual final `npm run verify` result or an explicit blocked state; and
- the closeout document path.

Do not repeat all Sprint 04 implementation detail in the changelog. Do not call an unavailable Operator/Client path complete. Do not claim deployment, external provider delivery, Drive validation, or Client receipt.

---

## 5. Expected file architecture

Only change files necessary to resolve discovered S04-08 gaps. The expected maximum footprint is:

```text
src/components/shared/app-nav/
├── app-nav.tsx                                      # MODIFY only for locale-aware active-link consistency / truthful naming
└── _components/mobile-nav-toggle.tsx                # MODIFY only for equivalent mobile consistency

src/components/shared/projects/project-workspace/
└── project-recovery-state.tsx                       # NEW only if shared presentational recovery extraction is justified

src/app/[locale]/(protected)/admin/proyectos/
├── loading.tsx                                      # MODIFY only for a real accessibility/truthfulness gap
├── error.tsx                                        # MODIFY: localized safe directory recovery
└── [id]/
    ├── loading.tsx                                  # MODIFY only for a real accessibility/truthfulness gap
    └── error.tsx                                    # MODIFY: localized safe detail recovery and locale-aware return

src/app/[locale]/(protected)/pm/proyectos/
├── loading.tsx                                      # MODIFY only for a real accessibility/truthfulness gap
├── error.tsx                                        # MODIFY: localized safe directory recovery
└── [id]/
    ├── loading.tsx                                  # MODIFY only for a real accessibility/truthfulness gap
    └── error.tsx                                    # MODIFY: localized safe detail recovery and locale-aware return

messages/es-MX.json                                  # MODIFY: parity-matched recovery copy only
messages/en-US.json                                  # MODIFY: parity-matched recovery copy only

__tests__/app-shell/navigation.test.ts               # MODIFY: focused role navigation regressions
__tests__/projects/project-recovery-state.test.tsx   # NEW only if a shared recovery component is created
__tests__/i18n/message-catalogs.test.ts              # MODIFY only if explicit recovery-key contract assertion is absent

CHANGELOG.md                                         # MODIFY after actual S04-08 result
dev-docs/specs/s04/s04-sprint-04-closeout-verification.md # NEW after actual evidence exists
```

The list is an architecture guide, not authorization to modify every listed file. Do not create a `src/app/api/**` route, a migration, a generated type file, a new data-access layer, a generic error system, or another navigation component.

Every production implementation file remains at or below the repository’s 400-line limit. Documentation files are explicitly exempt from that source-file limit.

---

## 6. Acceptance criteria

- [ ] Desktop `AppNav` and `MobileNavToggle` use one consistent role matrix: Admin/PM project links are active; Operator/Client future-work items remain unavailable and non-navigable.
- [ ] Admin and PM can navigate from their role shell to their own project directory and then to an authorized workspace without a dead placeholder path or a second competing navigation system.
- [ ] S04-08-modified internal links preserve the existing locale architecture: Spanish canonical paths remain unprefixed and English routes remain under `/en`.
- [ ] Role-route normalization remains in the protected layout, while project authorization remains at the server query/command boundary. No UI code accepts a role, capacity, project ID, or authorization fact as trusted authority.
- [ ] All four Admin/PM project route recovery boundaries use catalog-backed user-visible copy, safe exception capture, and non-leaking generic recovery behavior.
- [ ] Admin and PM detail recovery links return to their correct localized project directory and do not reveal whether a protected project exists or why access failed.
- [ ] Route loading states are truthful, use existing shadcn primitives, provide accessible loading semantics, and make no data/authorization/provider claim.
- [ ] Directory, Task, Deliverables, and Activity empty states remain role-safe and truthful; no fabricated data, unsupported CTA, timeline, calendar, archive, or Client/Operator capability is introduced.
- [ ] New message keys use the existing `projects.workspace.recovery` namespace, are semantically named, are non-empty, and have exact `es-MX`/`en-US` structural parity.
- [ ] Existing shell, theme, locale switcher, workspace tabs, task controls, deliverable history/review controls, and command boundaries retain their accepted behavior.
- [ ] Focused navigation/recovery evidence passes without redundant test ceremony, and no existing S04 test-first contract is weakened.
- [ ] One final `npm run verify` run completes after all Sprint 04 changes are integrated; its actual result is recorded. A failed final run blocks sprint completion.
- [ ] `CHANGELOG.md` and `dev-docs/specs/s04/s04-sprint-04-closeout-verification.md` accurately distinguish automated evidence, manual localhost observation, existing platform evidence, excluded scope, and deferred E6/E7/E8 work.
- [ ] No schema/RLS/RPC/generated-type change, direct data mutation, Prisma, API route, Playwright suite, external URL dereference, provider activation, hosted-environment change, production change, or false external-delivery claim is introduced.

---

## 7. Stop conditions

| Discovery | Required response |
|---|---|
| A required Admin/PM navigation destination is absent, unusable, or requires a new route/information architecture | Stop the affected integration work. Record the exact missing destination and request a scoped product/IA decision; do not invent a fallback workspace. |
| The locale-aware routing helper cannot express an existing Admin/PM destination without manually constructing locale paths | Stop and inspect the routing contract. Do not hand-roll `/en` logic or silently switch to raw links. |
| Correcting a route-level recovery boundary would require a protected fact, raw database error, UUID, or client-derived permission explanation | Stop. Use generic recovery copy or request a safe representation; do not leak the fact. |
| An existing project/task/deliverable query, action, RPC, or safe representation is missing or conflicts with accepted S04 behavior | Stop the affected feature path and record the exact command/projection discrepancy. Do not use direct table writes or client-side authorization as a workaround. |
| An integration fix would require a migration, RLS/RPC change, type generation, Supabase MCP/dashboard action, or hosted schema mutation | Stop S04-08 and request separately authorized schema work. |
| A navigation, locale, theme, accessibility, authorization, lifecycle, immutable-history, URL-handling, or safe-error defect is found | Block Sprint 04 closeout until corrected and re-verified at the appropriate scope. |
| A requested closeout claim depends on provider dispatch, external URL reachability, Client receipt, file transfer, preproduction, production, or hosted deployment | State it as out of scope. Do not manufacture evidence or broaden verification. |
| Final `npm run verify` fails | Record the actual failed stage, mark closeout blocked, fix only the verified cause under appropriate authority, and rerun the final verification after the fix. Do not mark the sprint complete. |

---

## 8. Handoff and completion boundary

When S04-08 is complete, Sprint 04 has a clean implementation and evidence boundary:

- **E6** consumes the established task assignments and deliverable submission lifecycle to create the dedicated Operator execution experience; it owns the Operator navigation destination when that workspace is genuinely usable.
- **E7** consumes client-project membership and `awaiting_client_review` state to create Client-safe projections, Client requests/submissions, and actual Client decisions; it owns the Client navigation destination when that workspace is genuinely usable.
- **E8** consumes transactional lifecycle facts but owns provider dispatch, scheduling, delivery receipts, email, WhatsApp, and external-provider activation.

S04-08 closes Sprint 04 by integrating only what S04-01 through S04-07 already implemented, correcting navigation/localization/recovery gaps, and recording factual evidence. It must not smuggle successor scope into the closeout.

---

*Spec written 2026-08-21 from the accepted Sprint 04 plan; the S04-01 through S04-07 specifications; current shared navigation, protected-layout, localization, project-route recovery, workspace, test, and changelog implementation surfaces; and the repository-local `AGENTS.md` operating contract.*
