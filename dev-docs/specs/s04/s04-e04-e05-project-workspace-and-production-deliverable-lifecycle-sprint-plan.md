
# Sprint 04 — E4 Project Workspace and E5 Production Deliverable Lifecycle

## 1. Sprint purpose

Sprint 04 turns the role-safe shell into the first real internal operating workspace. It delivers two connected capabilities:

1. **E4 — Project Workspace and Internal Work Management:** PM Leads can create and govern compliant projects, establish memberships, plan and move work, complete/reopen projects, and collaborate on tasks.
2. **E5 — Production Deliverable Lifecycle and Internal Collaboration:** authorized internal contributors can plan, submit, review, resubmit, release, and deliver production deliverables with immutable version and review history.

This sprint also establishes the application’s durable visual system by installing and using **shadcn/ui**, then implements native **light and dark modes**. Light mode is the initial default; the user’s explicit selection persists in the browser and must be honored on subsequent visits.

**Sprint goal:** an Admin or PM Lead can create a project, form a valid project team, create and manage compatible tasks, create a production deliverable, submit a Google Drive share link, make an authoritative internal review decision, and inspect the resulting versioned history—all through the authenticated application, never through direct database operations or a client-trusted authorization shortcut.

The sprint intentionally stops before the dedicated mobile Operator experience (E6) and the Client portal/review experience (E7). The E5 implementation must nevertheless preserve the exact state-machine and data boundaries those later epics consume.

---

## 2. Starting baseline and stable contracts

Treat the integrated Sprint 03 application as the starting baseline. Do not redesign or replace these working contracts unless a defect makes that unavoidable:

- **Identity/session:** `requireSession`, `getOptionalSession`, `ROLE_DEFAULT_PATHS`, `PROTECTED_PATH_PREFIXES`, and the current server-side protected layout remain the authorization entry point. `profiles.role` is the sole application-role authority.
- **Role routes:** protected Spanish routes are unprefixed (`/admin`, `/pm`, `/operador`, `/cliente`); their English equivalents are `/en/admin`, `/en/pm`, `/en/operador`, and `/en/cliente`. All new protected routes must preserve this rule.
- **Locale behavior:** Spanish (`es-MX`) is the default visible locale and English (`en-US`) is the secondary locale. Every new user-facing string is sourced from both message catalogs with exact semantic-key parity. English is never introduced by hardcoding component copy.
- **Application architecture:** Next.js App Router and React Server Components are the default. Client components exist only at interaction boundaries such as forms, dialogs, Kanban drag/drop, drawers, theme selection, and controlled filters.
- **Component placement:** route-specific components belong in route-local `_components/`; reusable application components belong in `src/components/shared/`; shadcn/ui primitives belong only in `src/components/ui/`.
- **Data access:** use the typed `@supabase/ssr` server/browser clients and `src/lib/database.types.ts`. That generated file is derived source and must never be edited manually. Use existing RLS-safe views and constrained RPCs/commands; do not create a second authorization system in React or route handlers.
- **Security:** privileged Supabase access remains server-only; browser mutation routes are same-origin; unsafe cookie-authenticated requests retain Origin/Host validation; untrusted payloads are validated with Zod; responses, errors, logs, and test fixtures must not expose secrets or internal authorization detail.
- **Existing shell:** extend `AppNav` and its mobile navigation rather than building a competing authenticated header. Replace Sprint 03’s disabled project stub links only when their corresponding workspace routes exist and are actually usable.
- **Reference versus sandbox data:** the persistent reference corpus remains for inspection. Normal mutation demonstrations use the existing mutable sandbox. Do not mutate reference data merely to demonstrate a workflow.

### Architecture facts required for this sprint

- Application roles are `admin`, `pm`, `operator`, and `client`. Project membership capacities are separate: `pm_lead`, `pm_watcher`, `operator`, and `client`.
- A project is either `client` or `internal` and has status `planning`, `in_progress`, `paused`, `completed`, or `cancelled`.
- Each active project must have one or more active PM Leads and **exactly one active primary PM Lead**. PM Watchers are advisory/read-oriented. A Watcher may add an advisory collaboration comment but cannot alter project/work lifecycle or make an authoritative deliverable review decision.
- Client projects require a client organization and one or more active client members. Internal projects have no client membership and cannot host production deliverables.
- Tasks have status `pending`, `in_progress`, `in_review`, `completed`, or `blocked`; priority `low`, `medium`, `high`, or `blocking`. **`blocking` priority and `blocked` status are different concepts and must remain visually and semantically distinct.**
- Production deliverables use `pending → awaiting_internal_review → awaiting_client_review → approved | changes_requested → delivered`. A submission creates an immutable `deliverable_version`; formal review feedback is immutable and belongs to the exact version reviewed.
- After any Client change request and the next authorized re-upload, the required future flow is exactly: `changes_requested → pending → awaiting_internal_review → awaiting_client_review`. Internal PM review cannot be skipped on a resubmission.
- Production submission accepts only a valid Google Drive HTTPS share URL. The server validates the URL lexically; it never fetches, resolves, previews, proxies, downloads, scans, or hosts external content.
- Collaboration comments are informal internal discussion and are distinct from formal immutable `deliverable_feedback` review decisions.
- Link reporting is a separate incident record. It must not invent a deliverable status or mutate the submitted version/lifecycle.
- Notification events may be created by the established transactional boundary, but provider dispatch, Realtime expansion, email, WhatsApp, scheduling, and provider activation are not in this sprint.

---

## 3. Scope boundaries

### In scope

- shadcn/ui setup, a small approved component inventory, theme tokens, ThemeProvider, persisted light/dark selection, and accessible theme control.
- Admin/PM project listing, filtering, creation, editing, and detail workspace.
- Client-organization selection/creation where needed for client projects; project-client membership management; PM Lead, PM Watcher, and Operator membership management.
- Project detail information architecture: Overview, Tasks, Deliverables, Members, and Activity. Timeline, Calendar, and Archive are explicit non-functional integration points or disabled placeholders only when they communicate no false capability.
- Internal task creation, editing, compatible assignment/reassignment, filter/sort, Kanban/list presentation, and constrained status movement.
- Project completion readiness, explicit unfinished-work confirmation, completed-state presentation, auditable reopening, and cycle-history display where the existing safe projection supports it.
- Task-targeted, capacity-labeled internal collaboration comments.
- Production deliverable creation, editing, assignment, deadline display/validation, submission URL validation, immutable version-history display, internal PM review, resubmission, client-review release state, final delivery state, internal collaboration comments, and independent broken-link reporting.
- Focused documentation: a Sprint 04 closeout note that records the implemented route/data-command mapping, human visual decision, user journeys, and actual verification results.

### Explicitly excluded

- Client portal, direct client-request tasks, client submissions, client review actions, and client-facing safe projections (E7).
- Operator-specific mobile agenda/task drawer execution experience and dedicated operator UX (E6). This sprint may assign work to Operators but must not claim that the Operator portal is complete.
- External notification delivery, email, WhatsApp, webhooks, background workers, QStash workflows, calendars, metrics, archive search, and administrative operations (E8–E9).
- File upload, binary storage, Drive API integration, URL previewing, link dereferencing, service workers, offline queues, caching/replay, Playwright, Prisma, schema tooling substitutions, provider activation, preproduction, and production changes.
- New database schema/migration work unless an existing authoritative command/view/projection is demonstrably missing or inconsistent with the accepted schema. Such discovery is a stop condition, not permission to add ad hoc DDL.

---

## 4. Required human visual decision — COMPLETED

The app must use shadcn/ui, but the component library must not impose an accidental brand direction. The Project Owner should make one bounded choice before the shadcn initialization work begins:

| Decision                | Recommended default if no custom art direction is supplied      | Human action                                                                                                                                                                                                                                                                                       |
| ----------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base palette            | **Neutral**                                                     | APPROVED AND SELECTED BY PROJECT OWNER. Neutral is the recommended default because it keeps production-status colors legible and avoids tying workflow semantics to the base palette.                                                                                                              |
| Component style         | **Mira**                                                        | APPROVED AND SELECTED BY PROJECT OWNER. Use one style only; do not mix styles.                                                                                                                                                                                                                     |
| Accent                  | **Indigo** mapped to semantic action tokens                     | APPROVED AND SELECTED BY PROJECT OWNER. Do not encode hex values across components.                                                                                                                                                                                                                |
| Icon set                | **Lucide**                                                      | APPROVED BY PROJECT OWNER.                                                                                                                                                                                                                                                                         |
| Dark appearance         | **Same semantic token system, not an inverted one-off palette** | APPROVED BY PROJECT OWNER. Confirm whether any logo/brand mark needs a dark variant; otherwise use the same mark with accessible foreground treatment. Logo/brand marks currently live in the `public` directory: `public\joyalogo-purple.svg` `public\joyalogo-yellow.svg` `public\joya-icon.svg` |
| Preset Selected/Created | **--preset b2J0x9uLeE**                                         | APPROVED AND SELECTED BY PROJECT OWNER. This preset was created/selected through the shadcn/ui web interface. Font selection from this preset might conflict with the current project fonts, use shadcn/ui preset as authoritative and cleanup previous font imports if necessary.                 |

The developer performs the CLI initialization. Use the current official shadcn CLI and Tailwind CSS v4-compatible path for the installed project—not copied legacy configuration. The initialization must:

1. create/update `components.json` as the project component-registry contract;
2. target `src/components/ui` and preserve the repository `@/*` aliases;
3. configure CSS variables/tokens in the existing global stylesheet rather than scattering color classes;
4. add only the dependencies generated by the chosen primitives; and
5. avoid overwriting existing application components, locale configuration, security headers, or unrelated Tailwind behavior.

Use the CLI to add only components actually consumed in Sprint 04. The expected initial inventory is: `button`, `input`, `label`, `textarea`, `select`, `checkbox`, `badge`, `card`, `table`, `tabs`, `dialog`, `alert-dialog`, `sheet`, `dropdown-menu`, `popover`, `command`, `separator`, `skeleton`, `tooltip`, and `sonner`. Add `form` only if it cleanly composes with the existing React Hook Form/Zod setup. Add drag-and-drop presentation components only if the existing `@hello-pangea/dnd` dependency is retained for a real Kanban interaction.

Do not install a large component catalog “for later” or fork generated primitives without a concrete Sprint 04 requirement.

---

## 5. Work items and delivery sequence

### S04-01 — Establish the visual foundation: shadcn/ui and persisted native theming

**Objective:** make shadcn/ui the reusable primitive layer and introduce a correct, flicker-resistant light/dark system before the workspace UI expands.

**Implementation requirements**

1. Inspect the current Tailwind v4/global CSS and use the current shadcn installation path compatible with it. Do not manually imitate shadcn/ui or copy an obsolete Tailwind v3 setup.
2. Initialize shadcn/ui using the approved visual decision in Section 4. Keep generated primitives under `src/components/ui/`; keep feature compositions outside that directory.
3. Install `next-themes` if it is not installed and provide a small client-only `ThemeProvider` under `src/components/shared/theme/` (or an equally focused shared path). Its contract is:
   - class-based theme application on the document element;
   - `defaultTheme="light"`;
   - `enableSystem={false}` so a first-time visitor sees light mode rather than an operating-system-driven surprise;
   - a stable project-specific browser storage key;
   - persisted explicit selection across reloads and new visits in the same browser;
   - transition suppression during a switch to prevent a page-wide flash;
   - hydration-safe layout integration (`suppressHydrationWarning` only at the necessary HTML boundary, never as a general mismatch suppression).
4. Replace the current `prefers-color-scheme` global behavior. It conflicts with the required light default. Define complete light and dark semantic CSS variables for background, foreground, cards, popovers, borders, controls, muted content, destructive states, focus rings, and chart/status colors as applicable. shadcn primitives and application CSS must consume those tokens.
5. Add an accessible `ThemeToggle` to both desktop and mobile authenticated navigation. It must be keyboard-operable, have localized labels for the *next action* and current state, expose a pressed/selected state, and use an icon plus accessible text—not color or icon shape alone. A compact menu is acceptable if it explicitly presents Light and Dark choices.
6. Preserve the existing language switcher, sign-out behavior, notification badge, responsive mobile drawer, and role-safe navigation. The current hard-coded neutral dark classes may be replaced with token-based classes only where touched; Consider performing a whole-app restyle.
7. Establish reusable semantic badges/styles for project status, task status, task priority, deliverable state, and member capacity. The mapping must be centralized and must provide text/icon/label information in addition to color.

**Likely files**

- Create: `components.json`, `src/components/ui/*`, `src/components/shared/theme/theme-provider.tsx`, `src/components/shared/theme/theme-toggle.tsx`, and narrowly scoped tests.
- Modify: `src/app/[locale]/layout.tsx` or the actual root locale layout, `src/app/globals.css`, `src/components/shared/app-nav/app-nav.tsx`, `src/components/shared/app-nav/_components/mobile-nav-toggle.tsx`, and both message catalogs.

**Completion criteria**

- shadcn/ui is initialized once, uses the project aliases and CSS-variable token system, and at least the foundational Sprint 04 primitives are used in production UI.
- A first-time visitor gets light mode, and an explicit theme selection survives reload/navigation without a hydration warning or theme flash.
- Both themes preserve legible text, visible focus indication, non-color state identification, and usable contrast for navigation, forms, cards, dialogs, badges, Kanban columns, and destructive confirmations.
- No user-visible copy is hardcoded and no existing auth/locale behavior regresses.

---

### S04-02 — Reconcile the first workspace command boundary

**Objective:** establish one clear, server-authoritative project/work/deliverable command contract before UI mutation code is written.

**Implementation requirements**

1. This is a bounded design/reconciliation task, not an invitation to redesign the data model. Inspect the committed generated types, existing SQL migration functions/views, current repository documentation, and the accepted API contract baseline.
2. Because E4/E5 introduce or consume database-facing application commands, perform the required focused API-contract adoption review before creating a new `/api/v1` mutation surface. The review must produce the repository-local canonical contract artifact only if this sprint actually needs new/changed route handlers. It must resolve stable operation IDs, current Supabase SSR session representation, safe idempotency where applicable, examples/response shapes, and alignment with the no-Prisma/RLS/SQL-migration boundary.
3. Prefer the existing constrained database RPCs for lifecycle-changing operations. A route handler must only: derive the actor from the server session, validate a Zod payload, enforce same-origin protection where unsafe, call the dedicated command boundary, map known outcomes to stable safe errors, and return the role-safe representation. Do not place project, task, membership, or deliverable state-machine rules in the route handler or browser.
4. Create a narrow feature data layer, for example under `src/lib/projects/` and `src/lib/deliverables/`, that owns typed server reads, input schemas, command adapters, and error mapping. Keep reads role-safe and select explicit columns. Do not make browser components query broad base tables.
5. If the accepted E2 schema already exposes a command/view but its name/shape differs from older prose, the generated types and committed SQL source win. Update the implementation plan’s mapping rather than inventing a name.
6. If a required E4/E5 operation is absent, lacks a safe projection, violates an invariant, or would require a schema change, stop the affected work. Record the missing operation and required invariant precisely for a separately authorized schema decision. Do not use direct table writes, an admin client, or client-side filtering as a substitute.

**Minimum command/representation map to establish**

| Domain                                         | Required command or safe representation           | Authority/behavior                                                                                            |
| ---------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Project directory/detail                       | explicit role-safe project list/detail projection | Admin sees allowed administrative inventory; PM sees only projects where their membership permits it.         |
| Project create/edit/archive/cancel/recover     | constrained server command                        | Server derives actor; preserves client/internal rules and audit effects.                                      |
| Membership and primary lead                    | constrained membership command                    | Enforces active Lead cardinality and exactly one primary Lead.                                                |
| Client organization/project-client association | role-safe administrative/PM command               | Required for client project; prohibited for internal project.                                                 |
| Task create/edit/assign/move                   | constrained task command                          | Enforces compatible active assignee, task type, status transitions, and audit effects.                        |
| Project complete/reopen                        | transactional lifecycle command                   | Rechecks unfinished work at confirmation; completion warns rather than blocks; reopening is reasoned/audited. |
| Task/deliverable comments                      | constrained comment command and safe read         | Capacity snapshot is server-derived; comments are not formal review feedback.                                 |
| Deliverable create/edit/assign                 | constrained planning command                      | Only valid for a client project and compatible task/team context.                                             |
| Production submission                          | transactional submission command                  | Validates Google Drive share URL and writes a new immutable version.                                          |
| Internal review                                | transactional review command                      | PM Lead only; immutable version-scoped feedback; change request needs a non-empty comment; conflict-safe.     |
| Release/delivery                               | constrained lifecycle command                     | Enables later Client review and final handoff without client UI in this sprint.                               |
| Link report                                    | independent command                               | Creates incident evidence only; never changes the deliverable status/version.                                 |

**Completion criteria**

- The implementation has a written, exact map from every Sprint 04 mutation/read to its committed command or safe projection.
- Any new application API contract material is aligned before dependent route code is implemented; no broad or undocumented endpoint is introduced.
- No browser route, component, or server action can grant itself authority, bypass an existing RPC, or write a lifecycle state directly.

---

### S04-03 — Build the project directory, project creation, and membership governance

**Objective:** give Admins and PM Leads a usable, role-safe project management surface.

**Route and UI requirements**

- Replace the active Admin and PM project stub links with real localized routes such as `/admin/proyectos` and `/pm/proyectos`, plus route-local create/detail paths. Preserve the `/en` route prefix through the existing locale architecture.
- Render directory and detail reads as Server Components. Client leaves own filters, dialogs, form state, select/combobox controls, and optimistic display only after the server command has accepted the mutation.
- Use shadcn `Table` or cards responsively: a dense table at larger widths and readable stacked project cards at narrow widths. Do not horizontally trap essential data on mobile.
- Provide status/type filters and a search/filter UI that does not expose data not already returned by the safe projection. Pagination/cursors are introduced only when the underlying approved representation requires them; do not build speculative infinite scrolling.
- Project create/edit UI must capture only accepted project fields. Keep internal and client project types explicit. A client project must collect/select its client organization and valid client membership; internal projects must hide/clear client association and deliverable planning affordances.
- Membership management must differentiate PM Lead, PM Watcher, Operator, and Client capacity. The interface must make the primary Lead clear and prevent a misleading client-only validation model; the server command remains authoritative.
- A Watcher sees the workspace within permitted membership but cannot receive lifecycle buttons, task edit controls, assignment controls, or internal-review controls. Hiding a control improves UX; it is not the security boundary.
- Add project status controls appropriate to the accepted command boundary: pause/resume/cancel/archive/recover only if supported. Destructive/irreversible-feeling operations require localized shadcn `AlertDialog` confirmation and safe error rendering.

**Likely file areas**

- `src/app/[locale]/(protected)/admin/proyectos/**`
- `src/app/[locale]/(protected)/pm/proyectos/**`
- `src/components/shared/projects/**` only for genuinely cross-route UI
- `src/lib/projects/**`
- `src/app/api/v1/projects/**` only if the contract review determines route handlers are required
- `messages/es-MX.json`, `messages/en-US.json`

**Completion criteria**

- An Admin or PM Lead can create a valid internal or client project and reach its detail workspace.
- An authorized PM Lead can establish a compliant team with exactly one primary Lead and compatible client/operator membership.
- A PM Watcher can inspect permitted project context and add advisory discussion, but cannot mutate authoritative project/work state.
- Internal projects do not present or accept client membership or production-deliverable setup; client projects cannot be finalized without the required client organization/membership constraints.

---

### S04-04 — Deliver the project workspace, task planning, and constrained Kanban

**Objective:** make project work visible and manageable without implementing a client or operator portal prematurely.

**Route and UI requirements**

1. Project detail has clear localized tabs/sections: **Overview**, **Tasks**, **Deliverables**, **Members**, and **Activity**. Calendar, Timeline, and Archive are not implemented here; do not add fabricated counts, buttons, or navigation promises.
2. The Overview should present only safe, real project context: status, project type, deadline, primary Lead, high-level member composition, and completion state. It must not leak internal data to a role/capacity that lacks it.
3. The Tasks section supports create/edit, status/priority/type filters, compatible assignment/reassignment, due-date display, resource metadata already represented by the approved model, and a list/Kanban mode.
4. Kanban columns correspond only to the task state machine: `pending`, `in_progress`, `in_review`, `completed`, `blocked`. Drag/drop is optional UX, not a second state-machine implementation. If enabled, it must call the same validated server command as a menu/select move; after conflict/rejection, restore authoritative server state and provide a localized non-leaking message.
5. `blocked` status needs a visible reason/workflow context if the accepted representation supplies one; do not silently conflate it with `blocking` priority. `blocking` priority must be visually identifiable independently in list and Kanban modes.
6. Permit only task types supported by E4. Client-request task behavior can be represented only insofar as the schema/command requires it for planning; do not build client-facing execution or submission behavior reserved for E7. In particular, do not permit a client-request task to enter `in_review`.
7. Add task-targeted internal collaboration comments. Display the server-derived author/capacity label and chronological history. Comments must never masquerade as review approval/change-request evidence.
8. Use shadcn `Sheet` on mobile for task detail/edit interactions when it improves one-handed use. Preserve accessible focus management, Escape behavior, title/description semantics, close control, and 44×44px primary touch targets.

**Completion criteria**

- PM Leads can plan and manage internal work in the project workspace; compatible active members can be assigned only through the authoritative command path.
- Task status changes respect allowed transitions. Rejected moves do not leave the browser in a false state.
- Watchers cannot mutate tasks; no user can use a forged task/project/assignee ID to operate outside their authorized project.
- The Tasks UI is usable by keyboard and at a narrow mobile viewport without relying solely on drag-and-drop.

---

### S04-05 — Implement project completion, reopening, and visible audit context

**Objective:** provide a safe project lifecycle control that reflects the accepted completion semantics.

**Implementation requirements**

- Show a completion-readiness summary only from safe server-derived data. It identifies unfinished work as a warning, not a hard block.
- Completion requires a deliberate confirmation through `AlertDialog`. The dialog must state that unfinished work remains when applicable and require the explicit confirmation expected by the command contract.
- The transactional command rechecks the completion condition under its authoritative boundary. The UI must not claim that a preflight count alone guarantees completion is valid.
- Completed projects have a clear read-oriented treatment. Mutations disabled by the lifecycle are not exposed as active controls.
- Reopening requires the accepted reason and confirmation, follows the authorized command, and creates/retains the required immutable completion-cycle/audit history.
- Display a concise completion/reopening activity record only where the safe projection supports it. Do not query raw audit tables broadly to build a timeline.

**Completion criteria**

- Completion warns about unfinished work but allows explicit authorized override.
- A completion/reopen action cannot be performed by a PM Watcher or unrelated PM.
- Current project status and available controls are refreshed from the server after the command; the UI never fabricates an audit/history event.

---

### S04-06 — Build production deliverable planning, submission, and immutable history

**Objective:** implement the internal half of the production deliverable workflow on top of real projects and tasks.

**Implementation requirements**

1. Deliverables are created from a valid **client project** and connected to the appropriate task/work context required by the existing command/model. Internal projects must not show a production-deliverable create action.
2. Deliverable planning UI captures only accepted fields: title, assignee, deadline/specification/resource context as supported by the command model. Assignment must be limited to compatible active project members.
3. Production submission is a focused form. It accepts a Google Drive HTTPS share link only, validates locally for immediate feedback and again at the server command boundary, then creates a new immutable version. Never trust client validation alone.
4. URL handling must reject unsafe/nonconforming inputs according to the existing accepted validator. It must not call the URL, request a preview, or infer the link is reachable. Success means the accepted command recorded the submission, not that Google Drive content was downloaded or inspected.
5. The deliverable detail view displays current state, current version, prior immutable versions, actor/time metadata available from the safe projection, and the review history attached to each exact version. It must not permit editing a historical version or feedback entry.
6. Use state-aware badges/step indicators based on the centralized semantic mapping. They must show text as well as color and remain coherent in both themes.
7. Add a separate localized broken-link report action. It creates a link-report incident against the deliverable/version and confirms receipt. It must not change the displayed deliverable lifecycle state or pretend that a link is verified/broken by the server.
8. Add capacity-labeled internal collaboration comments targeted to deliverables. Keep formal review feedback visually and semantically separate from comments.

**Completion criteria**

- An authorized internal contributor can submit a compliant Drive link and receives a new immutable version record.
- Historical versions and feedback remain visible as immutable history; resubmission creates a successor version rather than overwriting old data.
- Non-Drive, malformed, credential-bearing, non-HTTPS, localhost/private/reserved-IP, or nonstandard-port URLs are rejected according to the approved validator without external fetching.
- A link report is independently recorded and cannot mutate the production state machine.

---

### S04-07 — Implement authoritative internal review, resubmission, release, and final delivery

**Objective:** finish the internal production lifecycle while preserving the future Client review boundary.

**Implementation requirements**

- Only an active PM Lead receives authoritative internal-review controls. A PM Watcher may read/comment but cannot approve, request changes, release to client review, or deliver.
- Internal review operates on the exact current immutable version. Approval and changes-requested outcomes use the constrained command. A changes-requested decision requires a non-empty localized comment at both client validation and server validation boundaries.
- Handle concurrency correctly: if a competing authoritative decision wins first, show a safe conflict message, reload the authoritative deliverable/version history, and never overwrite or append fake local history.
- A change request transitions the deliverable to `changes_requested`; the subsequent authorized resubmission must first return to `pending`, then await internal review. Do not expose a shortcut directly to `awaiting_client_review`.
- Implement the internal control that releases a valid internally approved deliverable to `awaiting_client_review`, and the authorized final handoff to `delivered` only where the underlying state machine permits it. Do not implement Client decision UI in Sprint 04.
- Ensure the internal UI accurately explains state without falsely implying external notification delivery. If a transactional notification event is created, display only the in-app workflow fact supported by the model, not “email sent” or “WhatsApp sent.”

**Completion criteria**

- The lifecycle UI allows only valid next actions for the role and current authoritative state.
- Formal feedback is immutable, exact-version-scoped, attributed to the actual reviewer, and requires commentary for change requests.
- The mandatory resubmission/re-review loop is visible and cannot be bypassed through UI or route payload manipulation.
- An unauthorized actor, PM Watcher, stale reviewer, or invalid state transition is rejected safely and leaves the displayed lifecycle/history truthful.

---

### S04-08 — Integrate navigation, localization, focused evidence, and sprint closeout

**Objective:** finish the slice as a coherent application capability rather than disconnected screens.

**Implementation requirements**

- Replace only the now-valid Admin/PM project navigation stubs with active links. Keep Operator and Client future-work links unavailable until their own usable workspace exists.
- Ensure deep routes normalize back to the correct role home through the established protected layout; project-level authorization must still occur at the query/command boundary after role routing.
- Add message namespaces that are clear and stable, for example `theme`, `projects`, `projectWorkspace`, `tasks`, `deliverables`, `review`, `comments`, `linkReports`, and `common`. Maintain full catalog parity.
- Provide route-specific `loading.tsx`, empty states, and `error.tsx` treatment using shadcn primitives where appropriate. Errors must help the user recover without leaking Supabase details, role policy, stack traces, raw URL values, or secrets.
- Update `CHANGELOG.md` and write `dev-docs/specs/s04/s04-sprint-04-closeout-verification.md`. The closeout document must distinguish automated assertions from manual localhost observation and must not claim provider, production, or live URL reachability proof.

**Completion criteria**

- A PM can travel from the role shell to project workspace to task/deliverable lifecycle without dead placeholder paths or a competing UI system.
- Both locales, both themes, desktop, and narrow mobile layouts present the same authorized workflow with equivalent semantics.
- The closeout record is factual, scoped, and names remaining E6/E7/E8 dependencies directly.

---

## 6. Focused verification strategy

Do not create exhaustive duplicate tests for database invariants already proven by the accepted data platform. Add focused application-level tests only where this sprint introduces behavior, presentation, or a new route/command adapter. Existing database/RLS/state-machine tests remain the authority for database enforcement.

### Required focused automated coverage

| Area | Minimum evidence |
| --- | --- |
| Theme system | Light is initial default; persisted explicit Light/Dark selection is honored; toggle is labeled/keyboard-operable; no system-preference override violates the default. |
| shadcn integration | At least one representative shared primitive/form/dialog path renders with token-driven light and dark classes; do not test shadcn library internals. |
| Project authorization | PM Lead allowed; PM Watcher read/comment only; unrelated PM denied; forged route/project/member identifiers cannot grant a mutation. |
| Project invariants in UI adapters | Client versus internal project form behavior; explicit primary-Lead/membership error mapping; completion warning/confirmation and reopen reason handling. |
| Task workspace | Compatible assignment/error handling; `blocking` priority is distinct from `blocked` status; rejected Kanban/list move restores server state; Watcher mutation controls/commands are denied. |
| Deliverable lifecycle | Submission adapter validates expected Drive URL shape; change request requires commentary; version/history rendering is exact-version-aware; stale review conflict reloads authoritative state; resubmission cannot skip internal review; link report leaves lifecycle unchanged. |
| Localization/accessibility | New catalog keys have parity; key interactive controls have localized accessible names; dialogs/sheets/toggle/drag alternative are keyboard-operable. |

Use the established Vitest, React Testing Library, and MSW conventions. Do not add Playwright. Avoid snapshot-only tests for stateful forms and do not mock authorization into a false positive: command-adapter tests must assert the server-derived role/project context and safe failure mapping.

### Manual localhost journeys

Run only these representative journeys after focused automated coverage is green:

1. Default light mode, switch to dark, refresh, navigate to a deep protected route, and confirm the explicit theme remains selected; switch back to light and confirm persistence.
2. Admin creates a client project in the mutable sandbox, assigns multiple PM Leads with one primary Lead, adds a Watcher and Operator, and reaches the workspace.
3. PM Lead creates an internal project and confirms the UI neither requests client membership nor offers production-deliverable creation.
4. PM Watcher opens an allowed project, adds an advisory comment, and is denied lifecycle/task/review mutation controls and command attempts.
5. PM Lead creates, assigns, filters, and moves a task; verify `blocking` priority and `blocked` status are clearly different; test a denied/invalid transition.
6. PM Lead completes a project with unfinished work using explicit confirmation, verifies read-oriented completed presentation, then reopens with a reason and sees current status/history update.
7. Authorized contributor creates a production deliverable on a client project, submits a valid Drive share URL, inspects the new version, receives changes requested with required comment, resubmits, and confirms the workflow returns through internal review before client-review release.
8. PM Watcher/unrelated PM attempts an internal review or forged deep-link/action and is safely denied; a simulated stale/conflicting decision is rendered as conflict without false history.
9. Report a link issue and confirm deliverable state/version remain unchanged.
10. Repeat the primary project/task/deliverable journey at a narrow mobile viewport using keyboard and touch-target-compatible controls, in both locales as appropriate.

### Final verification boundary

At sprint completion, run the repository’s established single full verification command (`npm run verify`) once, after all Sprint 04 changes are integrated. Do not repeatedly run the full suite between every work item. Record actual outcomes only. No provider activation, hosted environment change, production data change, or external Drive request is part of verification.

---

## 7. Definition of done

Sprint 04 is complete only when all of the following are true:

- shadcn/ui is correctly initialized, used for the Sprint 04 component inventory, and kept isolated in `src/components/ui/`.
- Light mode is the first-visit default. An explicit light/dark selection persists per browser and is accessible from desktop and mobile navigation without hydration errors, disruptive flashes, or loss of locale/auth behavior.
- Admins and authorized PM Leads can create and manage compliant projects through the application; PM Watcher advisory behavior remains distinct from Lead authority.
- Project and membership invariants are enforced by existing authoritative commands/data policy, not by client-only checks: one or more active Leads, exactly one primary Lead, valid client/internal distinctions, and compatible active memberships.
- Tasks can be planned, assigned, filtered, and moved only through valid state transitions; `blocking` priority remains visibly distinct from `blocked` status.
- Project completion warns but permits explicit authorized override, rechecks authoritatively, and supports reasoned audited reopening without fabricated history.
- Production deliverables are available only for valid client-project context; valid submissions create immutable versions, while invalid/unsafe URLs are rejected without dereference.
- Internal review is PM Lead-only, version-scoped, immutable, comment-required for change requests, conflict-safe, and preserves the mandatory resubmission/internal-re-review loop.
- Link reports and collaboration comments remain distinct from lifecycle state and formal review evidence.
- No Client portal, client review action, operator execution portal, provider delivery, file handling, direct SQL, schema mutation, generated-type edits, Prisma, offline feature, or external URL dereference has been introduced.
- New user-visible content is fully localized with catalog parity. Primary interactions are keyboard-operable, have accessible names/states, preserve focus behavior, and work at narrow mobile widths.
- Focused coverage and the final full repository verification complete with factual recorded outcomes. The Sprint 04 closeout document lists changed files, affected commands/representations, test/manual evidence, localization/accessibility/theme impact, known limitations, and deferred scope.

---

## 8. Stop conditions

| Discovery | Required response |
| --- | --- |
| The committed generated types, SQL source, existing safe views/RPCs, and accepted product behavior disagree on an E4/E5 operation | Stop the affected work. Write a precise discrepancy and request a scoped authoritative decision; do not choose an interpretation in UI code. |
| A required project/task/deliverable mutation has no constrained command, safe projection, or audit-capable transition boundary | Stop. Do not use direct table writes, browser privilege, or client-side policy as a workaround. |
| The work requires a migration, RLS policy change, type regeneration, or hosted schema alteration | Stop that item and obtain separately authorized schema work. Do not perform database changes in this sprint implementation path. |
| A requested client-project flow requires client portal behavior, a Client review decision, or client submissions | Defer it to E7. Implement only the internal state/representation explicitly required to preserve the lifecycle. |
| A requested operator flow needs a dedicated agenda, offline behavior, upload experience, or mobile execution drawer | Defer it to E6. Do not let task assignment expand into an Operator workspace. |
| A URL requirement needs fetching, previewing, resolving, API access, Drive authentication, file handling, or reachability checks | Stop; the approved boundary is lexical validation only. |
| A visual/theme choice would require a brand asset, color rule, or design direction not supplied by the Project Owner | Pause only that visual decision. Use the approved Neutral/New York/warm-accent default; do not invent a permanent brand system. |
| A security, authorization, role-isolation, immutable-history, state-transition, token/secret-exposure, or theme accessibility defect is found | Block integration until corrected and re-verified. |

---

## 9. Immediate successors

- **E6 — Operator Execution Experience:** consumes the task assignments and production submission lifecycle created here to provide the focused mobile, online-only Operator workspace.
- **E7 — Client Collaboration, Requests, and Production Review:** consumes client-project membership and `awaiting_client_review` deliverable state to add isolated multi-client collaboration, direct requests, client submissions, and actual Client review decisions.
- **E8 — Notification and Provider Operations:** consumes transactional lifecycle event evidence but remains responsible for dispatch, scheduling, delivery receipt, and external-provider activation.
