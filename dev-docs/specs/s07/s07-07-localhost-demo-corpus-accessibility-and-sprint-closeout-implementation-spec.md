---
document_id: S07-07-LOCALHOST-DEMO-CORPUS-ACCESSIBILITY-CLOSEOUT-IMPLEMENTATION-SPEC-01
sprint_id: S07
work_item: S07-07
status: ready-for-implementation-plan
created_at: 2026-08-24T11:24:44-06:00
target_environment: jsf-pm-dev
source_plan: dev-docs/specs/s07/s07-e09-visibility-reporting-and-operational-administration-demo-completion-sprint-plan.md
mapping_reference: dev-docs/specs/s07/s07-e09-capability-contract-mapping-reference.md
required_applied_migrations:
  - 20260823140000_s07_e09_calendar-role-safe-feed-and-milestones.sql
  - 20260823143000_s07_e09_scope_calendar_events_direct_select.sql
  - 20260823144000_s07_e09_calendar-task-scoped-milestones-and-pm-authority.sql
  - 20260823141000_s07_e09_finalized-production-archive-and-link-incidents.sql
  - 20260823142000_s07_e09_scoped-operations-metrics-and-admin-projections.sql
  - 20260824080000_s07_e09_notification_history_window_and_filters.sql
  - 20260824110000_s07_e09_scoped-operations-metrics-trend-projection.sql
---

# S07-07 — Localhost Demo Corpus, Accessibility Remediation, and Sprint Closeout

## 1. Objective and authority

This final S07 work item turns the implemented E09 screens into a **truthful, repeatable localhost stakeholder demonstration** and closes only the verified integration gaps. It does not redesign a completed feature, broaden authorization, activate a provider, or create a release claim.

S07-07 has four deliverables:

1. an idempotent `Acme Sandbox Campaign` corpus that exposes every required E09 scenario without mutating named reference/isolation projects;
2. a bounded, mandatory refactor that corrects sub-44px primary touch targets in S07 interaction leaves;
3. reconciled persona/demo documentation plus a concise stakeholder runbook; and
4. a factual closeout record and truthful CHANGELOG entry after actual verification/manual evidence exists.

Authority order: Project Owner direction; applied migration/type baseline; S07-02 through S07-06 specifications; this specification; the reconciled sprint plan/mapping; `GEMINI.md`; current repository conventions. If a live schema/generated type differs from this document, stop. Do not work around it through direct browser table access, casts, a service-role application client, or a new migration without review.

## 2. Migration determination and non-goals

### 2.1 No migration

**No S07-07 migration is required or authorized. Do not create one.** The required data points are ordinary development corpus rows supported by the applied M1-R/M2/M3/M4/M5 shape. The bootstrap script is an approved service-role development tool; it may perform only idempotent DML and Supabase Auth administration already established by its current contract.

Do not modify any migration, generated database type, database function/view/policy/grant/index/trigger, remote configuration, provider setting, or Supabase MCP state.

### 2.2 Explicit exclusions

Do not add or imply:

- provider activation, sender/domain/Meta/QStash/Workflow configuration, external dispatch, receipt, retry, replay, requeue, webhook, polling, schedule, or hosted deployment;
- API/OpenAPI work, Realtime, service worker, offline storage/queueing, browser Supabase, server-side external URL validation/preview/proxy/download, broad UI redesign, new routes, or new authorization helper;
- mutation of `Acme Brand Relaunch`, `Internal Workflow Automation`, `Acme Commercial Q1`, `Acme Teaser 2025`, or `Starlight Summer Campaign` during normal demonstration or corpus reconciliation;
- broad test expansion, snapshots, Playwright, new test harnesses, or a duplicate migration/RLS suite;
- a claim of formal WCAG conformance, external URL validity, provider readiness, hosted reachability, production RLS, release readiness, or production deployment.

## 3. Required Sandbox corpus contract

### 3.1 Corpus boundary and idempotence

Modify only `scripts/bootstrap-dev-demo-data.ts`. Preserve its persona email/password/environment contract and its documented authorized 400-line exception. Do not create a second seed command or a second sandbox project.

Every S07-07 scenario must be anchored by a stable sandbox project/name plus a stable title or deduplication key. On rerun, query first and create only when absent; never delete/reset existing application rows, change reference rows, or mutate an arbitrary row selected by date/status alone. A pre-existing matching row must be retained, not overwritten into a different lifecycle state.

Use a single `const now = new Date()` captured once in the corpus reconciler and derive all relative timestamps from it. Use distinct relative offsets that keep each scenario inside the explicit latest-90-day range where it is intended to appear. Do not rely on browser time or hard-coded future calendar years.

### 3.2 Required deterministic scenarios

Create the following only under `Acme Sandbox Campaign` and its existing authorized personas/memberships.

| Scenario | Required corpus fact | Required consumer/outcome |
| --- | --- | --- |
| Task-scoped milestone | One non-deleted manual milestone with `project_id = sandbox`, `task_id =` a sandbox task directly assigned to Demo Operator A, title `Sandbox Operator Checkpoint`, safe all-day or timestamp bounds, and stable lookup by project/title. | Admin/PM see it; Operator A sees it through M1-R; Operator B and Client do not. |
| Project-scoped milestone | One non-deleted manual milestone with `project_id = sandbox`, `task_id = null`, title `Sandbox Project Review`. | Admin/PM see it; no Operator/Client sees it. |
| Upcoming attention | One non-completed sandbox task directly assigned to Demo Operator A with deadline inside the next 14 days. | Calendar/metrics attention and Operator agenda. |
| Overdue attention | One non-completed sandbox task directly assigned to Demo Operator B with deadline at least two days before captured `now`. | Metrics overdue attention; does not require a client-side date calculation. |
| Approved archive item | One production deliverable on a sandbox task assigned to Demo Operator A, status `approved`, non-null `approved_at` within the prior 30 days, current version number >= 1, and one stored public HTTPS submission URL on its current version. | M2 archive for Admin/PM/Operator A/authorized Client. |
| Delivered archive item | One separate production deliverable on a sandbox task assigned to Demo Operator B, status `delivered`, non-null `delivered_at` within the prior 21 days, current version number >= 1, and one stored public HTTPS submission URL on its current version. | M2 terminal-status distinction. |
| Archive exclusion control | One sandbox `client_submission` deliverable with a terminal-looking but valid client-submission workflow state, separate from archive items. | It must not appear in M2 archive. Do not falsify workflow transitions to seed this. |
| Link incident | One `deliverable_link_reports` row for the delivered Sandbox archive deliverable/current version, status `open`, stable safe reason, and reported time within prior 14 days. | M2 incident list/Admin operations unresolved count. No resolve/dismiss control. |
| M4 notification history | At least one read and one unread `in_app` recipient row for distinct existing events addressed to a Sandbox-authorized persona. Create them through stable event deduplication keys and preserve recipient ownership. | `/notificaciones` All/Read/Unread and mark-read behavior. |
| Older bounded history | One self-owned `in_app` recipient row between 91 and 93 days before captured `now` for a documented demo persona. | A manually selected bounded older range can prove M4 history without an all-time query. It is intentionally absent from the default latest-90-day view. |
| Suppression truthfulness | One terminal external recipient row in the existing suppressed/provider-disabled posture, attached to a stable Sandbox notification event and without provider message ID/attempt/receipt data. | Authorized operations wording only; never ordinary inbox data. Reuse existing valid enum/type values from generated types. |
| Client-review metric | One qualifying sandbox production deliverable/review chain whose authoritative `deliverable_cycle_metrics_view` has a non-null client-review duration and `client_acted_at` inside the latest-90-day range. | M3/M5 review count and duration. |
| Completion/reopen metric | One sandbox project-completion cycle represented by authoritative audit/lifecycle facts with `completed_at` and later `reopened_at` in latest 90 days. Use the existing project lifecycle/audit vocabulary, exact generated types, and accepted command/data shape; do not invent an audit action or view field. | M3/M5 completion and reopening cohort counts. |
| Invitation state | One existing valid invitation record, preferably pending and unexpired, with Sandbox project context and no raw token copied into docs/UI. If current project invitation creation cannot create this through the bootstrap's authorized service-role DML using generated types, stop and report the exact table/type mismatch rather than creating a fake DTO or UI mutation. | M3 Admin user/invitation stream. |

### 3.3 Corpus safety rules

- Validate generated insert types after inspecting `src/lib/database.types.ts`; do not hand-cast invalid data.
- Use raw database IDs only inside the bootstrap process. Do not print them in the normal summary or add them to documentation.
- Do not seed raw provider payloads, token/hash data, email/phone into new user-facing docs, or a real URL. Use only synthetic public HTTPS examples already consistent with current development corpus conventions.
- Do not use a seed row to claim a provider sent anything. A suppressed recipient is an internal terminal state fact only.
- Do not turn the bootstrap script into a generic data reset/cleanup engine.
- Update its final textual summary so it names S07 demo coverage generically without secrets, IDs, or provider claims.

## 4. Mandatory bounded accessibility refactor

This remediation is required before closeout. It is intentionally limited to sizing/interaction presentation; do not alter feature data, authorization, routes, DTOs, or server actions.

### 4.1 Exact files and minimum changes

| File | Required change |
| --- | --- |
| `src/components/shared/archive/external-link-button.tsx` | Both explicit external-open and copy controls must be at least `min-h-[44px] min-w-[44px]` at every breakpoint. Remove all `sm:min-h-[32px]`, `sm:min-w-[32px]`, and 36px target reductions. Preserve `target="_blank"`, `rel="noopener noreferrer"`, explicit text/accessible names, live copy feedback, and no server URL access. |
| `src/components/shared/archive/archive-filter-bar.tsx` | Every interactive project/status/date/reset control used by S07 archive routes must have a 44px minimum target. Preserve native/select semantics, labels, URL query shape, and server normalization. |
| `src/app/[locale]/(protected)/notificaciones/_components/notification-inbox-filters.tsx` | Every read filter, date preset, and reset interaction must have a 44px minimum target at all breakpoints. Remove compact 36/32px overrides. Preserve M4 query shape and locale-preserving URL navigation. |
| `src/app/[locale]/(protected)/calendario/_components/calendar-header.tsx` | Month/week/agenda/list selection, previous/next/today navigation, project filter, and milestone-create controls must meet 44px minimum targets. Preserve current URL/search-state behavior and labels. |
| `src/app/[locale]/(protected)/calendario/_components/event-badge.tsx` | Visible milestone edit/delete controls must be 44px minimum, keyboard reachable, and retain their existing localized accessible names/dialog behavior. |
| `src/app/[locale]/(protected)/calendario/_components/views/calendar-list-view.tsx` | Visible milestone edit/delete controls must be 44px minimum with the same preservation rules. |

Do not make this a repository-wide Tailwind target sweep. S07-07 owns only the controls above plus any direct S07 child control demonstrated by a focused test/manual inspection to remain below 44px. A proposed additional file requires a concrete affected S07 control and acceptance rationale.

### 4.2 Accessibility invariants to preserve

- Use native buttons/links/selects; do not replace controls with div click handlers.
- Keep visible localized text or localized accessible names; no icon-only unlabeled primary control.
- Preserve Escape/focus restoration for the mobile drawer and milestone dialogs.
- Preserve visible focus, textual/non-color status meaning, polite live feedback, alert errors, and the always-visible metric chart tables.
- Validate at 375px in both themes. Larger targets must not hide/overlap essential calendar/filters/dialog actions or create page-level horizontal overflow.

## 5. Navigation and localization reconciliation

Do not rebuild navigation. Inspect the current desktop `AppNav`, mobile `MobileNavToggle`, protected shell, and existing route guards, then make a code change only for a reproducible S07 defect.

The final behavior matrix is fixed:

| Role/capacity | Calendar | Archive | Link incidents | Metrics | Admin operations | Notification operations |
| --- | --- | --- | --- | --- | --- | --- |
| Admin | Present | `/admin/archivo` | `/admin/incidentes-enlaces` | `/admin/metricas` | `/admin/operaciones` | `/admin/notificaciones` |
| PM Lead | Present | `/pm/archivo` | `/pm/incidentes-enlaces` | `/pm/metricas` | Absent | `/pm/notificaciones` only when existing lead check succeeds |
| PM Watcher | Present | `/pm/archivo` | `/pm/incidentes-enlaces` | `/pm/metricas` | Absent | Absent |
| Operator | Present | `/operador/archivo` | Absent | Absent | Absent | Absent |
| Client | Present deadline-only | `/cliente/archivo` | Absent | Absent | Absent | Absent |

Every link must use `@/i18n/routing`; no manual `/en` construction. No unavailable destination may render as disabled/hidden-but-focusable text. Direct-route role checks remain mandatory even when a navigation item is absent.

Catalog policy:

- Do not rename/flatten existing `metrics`, `adminOperations`, `archive`, `linkIncidents`, `notifications`, `calendar`, or `shell.nav` trees.
- Require exact semantic-key parity and matching interpolation sets between `messages/es-MX.json` and `messages/en-US.json` for every new/fixed visible/ARIA string.
- Correct only a proven catalog drift. Do not add provider-health/activation copy.

## 6. Documentation artifacts

### 6.1 Update during implementation

| Path | Required bounded update |
| --- | --- |
| `dev-docs/documentation/s03-e03-03-dev-persona-access.md` | Correct the persona/membership table from live bootstrap source. At minimum, Demo PM Lead A is a Sandbox `pm_lead`, not a Sandbox Watcher; document the specific S07 Sandbox scenarios at a high level without IDs, secrets, or unsupported provider claims. Preserve production/local caution language and reference-vs-sandbox distinction. |
| `CHANGELOG.md` | Add one S07 entry only after actual evidence exists. State local role-safe calendar/archive/history/metrics/Admin operations capability, S07-07 corpus/accessibility closeout, and explicit provider/hosted/production deferral. Do not state sent, delivered by provider, active, deployed, production-ready, or URL validated. |

### 6.2 Create after actual evidence exists

Create `dev-docs/documentation/s07-localhost-stakeholder-demo-runbook.md` after corpus code and manual evidence are known. It must be concise and contain:

1. local-only warning and explicit `jsf-pm-dev` scope;
2. prerequisites by variable **name only**, `npm run db:bootstrap`, and local server start; never include a credential/password value;
3. reference-versus-Sandbox mutation rule and safe reseed statement;
4. persona/role order: Admin, PM Lead, PM Watcher, Operator, Client;
5. exact route-level demonstration order for calendar, archive, incidents, history, metrics, Admin operations, and direct-route denial;
6. truthful stored-link wording: copy/open is explicit user navigation only and does not validate the external resource;
7. provider-inactive wording: external delivery was not sent, is not pending, and will not automatically retry/replay;
8. scope limits: no provider, hosted, deployment, production, backup/restore, legal, or formal accessibility claim.

Create `dev-docs/specs/s07/s07-sprint-07-closeout-verification.md` only after all actual outcomes are known. It must contain:

1. identity, authority, evidence basis, and verdict;
2. S07 DoD traceability with Met/Blocked/Not demonstrated status;
3. current migration/type provenance, explicitly distinguishing Project Owner-provided application provenance from new S07-07 work;
4. implemented route/authorization/navigation matrix;
5. exact changed-file inventory by S07 work item where available;
6. exact focused and final verification commands with actual result totals only;
7. manual journey matrix from section 8;
8. localization/theme/accessibility/security/truthfulness findings and their evidence boundary;
9. external/provider/hosted/production/E10 deferrals; and
10. sign-off/next action with no unverified Git/deployment statement.

## 7. Focused verification and final gate

The Project Owner has already run S07-05/S07-06 verification. Do not re-run those commands now as ceremony. S07-07 must add only focused test updates needed by the code/documentation changes:

1. extend the closest existing navigation test only if navigation behavior changes or a regression is found;
2. extend existing catalog parity/key tests only if catalog keys change;
3. add/update one focused bootstrap contract test only if an established script-test convention exists. It must assert stable scenario identifiers/fixture intent without reading environment values or invoking a remote bootstrap;
4. update focused component tests only for the direct target-size/accessibility controls changed in section 4; test public accessible interaction/labels, not a broad CSS snapshot matrix.

Derive exact commands from the current `package.json` and actual test locations at implementation time. Run focused tests after changes. Then, after implementation, runbook, and CHANGELOG are complete, run the repository's final integrated gate one time in the documented supported test environment. If it fails, closeout is blocked until the verified S07-07 defect is corrected and the gate passes.

The factual closeout document is written after that final gate. A narrow documentation formatting check may follow it; it does not replace the final gate.

## 8. Required manual localhost journey matrix

After focused checks pass and `npm run db:bootstrap` has reconciled the Sandbox, record actual observations using the following matrix. Use protected reference data only for read inspection; mutate only the Sandbox.

| ID | Persona and journey | Required result |
| --- | --- | --- |
| J-01 | Admin: calendar, metrics, Admin operations, archive, incidents, and notification operations. | Global Admin destinations work; diagnostics expose only closed safe tokens; no provider/configuration/raw-ID/contact/secret disclosure. |
| J-02 | PM Lead: calendar milestone management, selected-project metrics, archive/incidents, and authorized notification operations. | Calendar authority works without granting Admin console or global metrics; queue wording remains terminal/inactive. |
| J-03 | PM Watcher: calendar, selected-project metrics, archive/incidents, and direct PM notification-operation attempt. | Calendar management follows accepted exception; metrics read is scoped; no queue navigation/data or Admin operations. |
| J-04 | Operator A/B: calendar and own archive. | Direct-task milestone is visible only to assigned Operator; project milestone/foreign task absent; own archive only and no incident/project/Drive expansion. |
| J-05 | Client: deadline calendar, final archive, notification history. | No manual milestones/incidents/metrics/Admin operations; only authorized client-safe context. |
| J-06 | Archive/incidents. | Approved and delivered production rows appear; client-submission exclusion holds; open/copy is explicit stored-link behavior without reachability claim; incident remains read-only. |
| J-07 | Notification history. | All/Read/Unread and an explicit older bounded range work; mark-one/mark-all preserve self-only presentation; no queue/provider data. |
| J-08 | Metrics. | Cards, trend chart, and visible tables agree; overdue/upcoming, review, completion/reopen, zero/no-data/authority-limited states are not conflated where corpus permits. |
| J-09 | Accessibility/localization. | At 375px, keyboard-only, Spanish and English, light/dark: target controls are at least 44px; drawer Escape/focus restore and dialogs work; no essential clipping/overlap/horizontal overflow; status text is non-color dependent. |
| J-10 | Direct-route denial. | Unauthorized role attempts redirect/deny before protected data is exposed; absent navigation does not imply authorization. |

## 9. Acceptance criteria and stop conditions

S07-07 is complete only when all statements are true:

1. No migration was created/applied and no generated type/Supabase/provider/hosted state changed for S07-07.
2. Sandbox-only corpus contains every deterministic scenario in section 3; named reference/isolation scenarios remain unmodified.
3. Bootstrap remains idempotent, secret-free in output/docs, and compatible with its existing environment contract.
4. Every section-4 primary control is at least 44px at every breakpoint; no 36/32px regression remains in those exact S07 controls.
5. Calendar, archive, M4 history, M3/M5 metrics, diagnostics, queue, and route authorization contracts remain unchanged and safe.
6. Final desktop/mobile navigation matches section 5 and preserves locale-aware routing.
7. Persona guide, runbook, CHANGELOG, and closeout record truthfully distinguish local capability from provider/hosted/production work.
8. Focused tests and final integrated gate have actual passing results, or closeout is visibly blocked.
9. J-01 through J-10 are recorded factually with limitations and no fabricated provider/production/accessibility-certification evidence.

Stop immediately if:

- a scenario requires a missing table/function/enum/field, invalid generated type, migration, policy/grant change, or unapproved direct browser access;
- a corpus insert would alter any named reference/isolation project or needs an invented lifecycle/audit vocabulary;
- accessibility remediation requires a broad design-system rewrite or changes authorization/data semantics;
- a route/nav test reveals leaked unauthorized data rather than a presentation-only issue;
- the final integrated gate fails; or
- a requested demo claim depends on provider delivery, hosted environment, external URL validity, production state, backup/restore, or formal conformance.

## 10. Implementation handoff

Antigravity must inspect exact generated types, current bootstrap code, existing tests, component source, and documentation before planning. It must implement only this file's bounded corpus/accessibility/documentation scope. Its completion report must list changed paths, exact focused/final command results, corpus scenarios reconciled, manual evidence source, localization/accessibility/security effect, no-migration confirmation, and blockers. Git mutation remains none.
