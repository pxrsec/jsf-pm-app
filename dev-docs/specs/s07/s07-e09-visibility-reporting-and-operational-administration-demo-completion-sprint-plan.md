
# Sprint 07 — E09 Visibility, Reporting, and Operational Administration

## 1. Sprint purpose

Sprint 07 completes **Epic 09’s application capability** so the persistent `jsf-pm-dev` environment can support an end-to-end, role-safe stakeholder demonstration on localhost. It is the final planned feature-integration sprint before E10 quality/compliance/release/handover and the separately authorized external-provider activation program.

**Sprint goal:** A stakeholder can use the localhost application as Admin, PM Lead, PM Watcher, Operator, and Client to see the operational picture each role is entitled to see: a role-safe deadline/milestone calendar, finalized production-deliverable archive, personal notification history, scoped metrics, and the appropriate operational console. Admin and PM Lead users can manage supported operational records through real server/database authorization; Admin can inspect safe system health/configuration-presence diagnostics and user/invitation state. The demonstration remains truthful: external email, WhatsApp, QStash/Workflow, hosted deployment, DNS, backups, legal publication, and production Supabase are not active features.

S07 is **not** an activation or release sprint. It delivers a complete local product demonstration capability, not a beta/production claim.

---

## 2. Authority, starting baseline, and non-negotiable boundaries

### 2.1 Authority order

1. Project Owner direction in this plan request: feature-complete localhost stakeholder demonstration now; external-provider activation later and separately.
2. Accepted ADR-024 and its E08 capability/activation split.
3. Repository-tracked Supabase SQL migrations for final database shape, RLS, functions, views, grants, and indexes.
4. Repository OpenAPI contract for in-scope public/server interface vocabulary.
5. Epic Roadmap v1.4 for E09 scope and acceptance criteria.
6. Existing accepted role, lifecycle, immutable-history, URL, and localization decisions.
7. This plan for S07 sequencing, migration specification, feature scope, evidence, and exclusions.

If any source disagrees, stop the affected work item and resolve the disagreement at the governing source. Do not encode an interpretation in a component, action, dashboard calculation, or direct query.

### 2.2 Confirmed S06 baseline

- Repository baseline is `dev` at `49c9ee8` (`feat(sprint-06): Notification Scheduling & External Providers Capability Track`).
- `jsf-pm-dev` contains 18 public tables, all reported by Supabase MCP as RLS-enabled, including calendar, archive-relevant, audit, notification, and delivery entities.
- Current remote migration history ends with the four S06 migrations: notification suppression, alert evaluation, notification inbox keyset pagination, and notification operations queue keyset pagination.
- Existing schema sources already contain `calendar_events`, `calendar_feed_view`, `deliverable_cycle_metrics_view`, `project_completion_cycles_view`, audit logs, `deliverable_link_reports`, and soft-delete/restore commands. Existing application consumption is incomplete: calendar, archive, metrics, a complete admin operations console, and role-safe administrative management surfaces are not delivered as coherent routes.
- S06 provides `/notificaciones`, `/pm/notificaciones`, `/admin/notificaciones`, terminal external suppression truthfulness, and a local-development-only manual alert evaluator. Preserve those guarantees; S07 must not treat suppression as a retry queue or represent it as live provider delivery.
- `jsf-pm-dev` is the approved persistent localhost demonstration environment. Use the protected reference corpus for inspection and the `Acme Sandbox Campaign` for normal mutable demonstrations.

### 2.3 Mandatory pre-S07 Advisor remediation gate

Before S07-M1/M2/M3 or dependent E09 application work begins, complete the bounded security remediation defined in `project-docs/sprint-plans/s07-supabase-advisor-remediation-assessment.md`:

1. revoke direct `authenticated` execution of `public.rls_auto_enable()` and prove the revoke in the live catalog;
2. relocate `citext` from `public` through a compatibility-reviewed forward migration, including affected function type references/search paths; and
3. choose and implement a secure database/server design that prevents direct authenticated invocation of the alert evaluator from bypassing its development-demo gate.

This is deliberately not a blanket index sweep. Add or remove performance indexes only under M1–M3 from exact query plans and route consumers. The leaked-password-protection warning is a separate deliberate `jsf-pm-dev` Auth configuration hardening decision, not a SQL migration.

### 2.4 Permanent boundaries

- Spanish is canonical on unprefixed protected routes; English remains under `/en/`. All S07 user-facing copy, errors, labels, chart alternatives, empty states, confirmations, and ARIA strings require exact semantic-key parity.
- `profiles.role` is application-role authority. `pm_lead` and `pm_watcher` are membership capacities and must be derived server-side for the relevant project.
- Prefer RSC/data-first routes. Client components are limited to calendar navigation, filters, forms, copy feedback, chart interaction, dialogs, and small mutation leaves.
- Use typed `@supabase/ssr`, explicit safe columns, Zod at request boundaries, server-only modules, same-origin safeguards, concrete path revalidation, and safe error mapping. Never solve authorization through hidden controls or browser filtering.
- No broad `select("*")`, runtime Prisma, `DATABASE_URL`, service-role browser access, direct client base-table writes, URL dereferencing, offline cache, persistent mutation queue, service worker, polling scheduler, or Playwright.
- Preserve immutable versions, formal feedback, audit history, notification events, and terminal suppressed notification semantics.

---

## 3. S07 scope and explicit exclusions

### 3.1 In scope: E09 application capability

1. **Role-safe calendar.** Calendar/feed routes for all roles using only authorized events: project/task/deliverable deadlines plus manual milestones. Admin/PM Lead can create, edit, and soft-delete manual milestones only in projects they may administer; PM Watcher is read-only; Operator/Client receive only their safe, role-permitted feed and no project-wide internal context.
2. **Finalized production archive.** Project-level and PM/global archive routes limited to production deliverables with status `approved` or `delivered`, preserving the explicit distinction from `client_submission`. The archive exposes only fields authorized for the viewer, deliberate external Drive-folder/open/copy behavior, bounded filters, and no server dereference.
3. **Notification history completion.** Refine the S06 recipient inbox as the E09 history surface: user-scoped, keyset-paginated, read/read-all capable, with a default 90-day visible window and explicit older-history behavior only if the server contract supports it. Ordinary users never see queue/provider data.
4. **Metrics.** Admin-wide and PM-project-scoped operational metrics based only on authoritative current state, `deliverable_cycle_metrics_view`, and `project_completion_cycles_view`/audit-derived facts. Deliver status/deadline/review/completion-cycle summaries and accessible tabular equivalents to every Recharts visualization. No timer service, browser-derived metric authority, unapproved cache, or materialized metric store.
5. **Operational administration.** A bounded Admin console and a scoped PM operations surface that consolidate existing safe notification queue facts, stalled/deadline attention, broken-link incident visibility, user/invitation management state, audit-log access, and metrics links. Existing S06 queue access rules remain intact.
6. **Safe configuration-presence/health diagnostics.** Admin-only diagnostics report a closed, human-safe capability state (for example: development demonstration posture; external delivery inactive; required activation categories incomplete/not configured). They never disclose a raw variable name, value, secret length, provider response, recipient address/phone, or enable activation.
7. **Demo readiness.** Expand the idempotent development corpus only where necessary to give each role deterministic calendar, archive, metric, link-incident, and notification-history scenarios without altering protected references.
8. **Closeout and stakeholder runbook.** Produce an S07 closeout record and a concise localhost demo script that describes completed local capabilities, role order, sandbox reset/reseed procedure, truthful provider language, and known non-demo boundaries.

### 3.2 Explicit exclusions and deferrals

- Resend sender/domain/API setup or dispatch; Meta business/template/phone verification, webhook registration, WhatsApp dispatch/receipts; Upstash QStash/Workflow schedules; any external provider console action.
- Vercel, Cloudflare, Hostinger, DNS, mailbox, deployed webhook, preproduction, production Supabase, or hosted smoke-test work.
- Actual encrypted nightly backup automation, an external backup destination, a restore drill, or claiming free-tier PITR. S07 may document ownership/readiness facts but cannot claim an operational backup.
- Privacy/legal publication, formal accessibility certification, OWASP release certification, real-device release testing, performance release gates, deployment, controlled real-client onboarding, and handover completion. These remain E10.
- Historical suppressed-notification replay/requeue, provider retry/failure handling, or configuration activation.
- CSV export, advanced archive full-text search, MFA, device inventory, binary storage, file previews/proxies/scanners, and automatic hard deletion.

---

## 4. Required database preparation — specification only; do not apply during planning

S07 requires reviewed, committed, append-only migrations because the current schema has primitive tables/views but does not provide all role-safe E09 read/mutation contracts. **This plan does not authorize or perform any remote migration application.** The Project Owner will select the later manual workflow. No role may substitute generic SQL, dashboard edits, destructive reset, or hand-edited generated types.

The architect must first reconcile each proposed identifier against the current migration chain and generated types. If a name/field already exists with equivalent secure semantics, consume it rather than duplicate it. If the reconciliation changes the contract below, the updated specification requires review before implementation.

### S07-M1 — Calendar feed and milestone command boundary

**Candidate source authored 2026-08-23; not applied:** `supabase/migrations/20260823140000_s07_e09_calendar-role-safe-feed-and-milestones.sql`

1. Keep `public.calendar_events` as manual-milestone storage. Do not create a second event table or copy task/deliverable deadlines into it.
2. Replace or supplement the generic `calendar_feed_view` with role-safe, bounded projections or constrained read functions that expose only: `entity_id`, `project_id` only where the caller is authorized to navigate to that project, safe title, `event_type`, `starts_at`, `ends_at`, `is_all_day`, and permitted `color_override`.
3. The feed must merge existing project deadlines, task deadlines, production review/client-delivery deadlines, client-submission deadlines, and non-deleted manual milestones exactly once. Exclude deleted rows and records outside the caller’s permitted project/direct-work scope.
4. Enforce server/database authorization by authenticated identity:
   - Admin: all permitted non-deleted project events.
   - PM Lead: only projects where active PM-lead authority exists.
   - PM Watcher: read-only only for active watcher/lead project memberships; no milestone mutation.
   - Operator: only deadline context for their own operator-safe assigned work; no project-wide feed/membership data or manual-milestone administration.
   - Client: only client-safe project/deadline/review/submission context already visible to that client; never another client’s direct work or internal review context.
5. Define a bounded date-range input (`from`, `to`, maximum 93 days) and deterministic sort (`starts_at`, `event_type`, `entity_id`). Reject inverted, malformed, or oversized ranges. No unbounded history query.
6. Add constrained milestone create/update/delete commands or RLS-backed mutation policy that derive actor identity, require Admin or active PM Lead on the target project, validate title 1–160 trimmed chars, optional description ≤2000 chars, `starts_at`, optional `ends_at >= starts_at`, `is_all_day`, and a finite accepted color token/nullable override. PM Watcher/Operator/Client must be denied at the authoritative boundary.
7. Write audit rows for milestone create/update/delete with safe changed-field facts; do not emit provider-facing behavior beyond the existing notification model unless an accepted trigger already applies.
8. Add only query-supported indexes, at minimum a partial `(project_id, starts_at)` index for non-deleted manual milestones if no equivalent index covers the safe range query. Do not add redundant indexes.
9. Preserve RLS on `calendar_events`, `security_invoker` semantics for views, least-privilege grants, and no new Realtime publication.

### S07-M2 — Finalized production archive and incident projections

**Candidate source authored 2026-08-23; not applied:** `supabase/migrations/20260823141000_s07_e09_finalized-production-archive-and-link-incidents.sql`

1. Create role-safe archive projections/read functions over the existing deliverable, version, project, and link-report records; do not duplicate immutable deliverable/version data into an archive table.
2. Include only non-deleted **production** deliverables whose current status is exactly `approved` or `delivered`. Explicitly exclude every `client_submission`, pending/review/changes-requested record, and soft-deleted record from the finalized archive.
3. Return a purpose-limited archive shape: deliverable/project identifiers only when route-authorized, safe title, final status, current version number, approved/delivered timestamp, project name, configured parent Drive folder URL only if the caller already has legitimate project context, and the current stored external submission URL only as a deliberate outbound/copy value. No internal feedback, audit JSON, contact values, raw provider fields, or other clients’ direct assignment data.
4. Authorization: Admin sees all; PM Lead/Watcher see their active project scope with Watcher read-only; Client sees only released project-safe finalized production records in its active client-member projects; Operator sees only their own allowed finalized production work if a safe projection can prove assignment without expanding project visibility. If the existing product authority does not define operator archive visibility precisely, omit the Operator archive route rather than infer it and record the decision request.
5. Define keyset pagination and a fixed filter set: project (within authorized scope), terminal status, and bounded finalized date range. No free-text/external URL search, export, or client-side filtering of a broad result set.
6. Expose a separate safe link-incident list for Admin and authorized PM project scope, with deliverable/project-safe context, status, reported/resolved timestamps, and safe reason/resolution-note representation. Do not expose a reporter’s identity/contact unless an existing accepted internal projection permits it. Client/Operator receive no operations incident queue.
7. Preserve the existing `report_broken_link` and soft-delete/restore integrity boundaries. Do not make an incident mutate a deliverable lifecycle or modify an immutable version.
8. Add partial/filter indexes only if the exact view/function query plan needs them, e.g. production terminal-status plus project/finalized sort and unresolved link reports by project/created time.

### S07-M3 — Scoped metrics, administration, audit, and invitation/user-safe projections

**Candidate source authored 2026-08-23; not applied:** `supabase/migrations/20260823142000_s07_e09_scoped-operations-metrics-and-admin-projections.sql`

1. Retain `deliverable_cycle_metrics_view` and `project_completion_cycles_view` as audit/current-state-derived sources. Add narrow Admin and PM-scope aggregate read functions/projections; do not create a materialized view, background refresh, scheduler, or browser-owned calculation as a source of truth.
2. Metrics output must be aggregate/purpose-limited and include only what S07 renders: project counts by status; active task/deadline attention counts; production deliverable counts by status; finalized delivery count; client-review duration aggregates from `deliverable_cycle_metrics_view`; completion/reopening-cycle counts/durations; unread/suppressed queue aggregate state; and unresolved broken-link count. Return `null`/empty correctly when denominator data is absent; never fabricate a zero-duration review cycle.
3. PM metrics must require active PM membership and aggregate only the caller’s permitted projects. Admin is global. PM Watcher visibility is read-only and limited to authorized project scope; Client/Operator cannot call the operations metrics boundary.
4. Provide a separate, keyset-paginated Admin audit projection with a finite 90-day default and maximum bounded range. It returns safe columns only: audit ID, timestamp, action, entity type/route-safe identifier, project-safe context, actor role, old/new status, and whitelisted human-safe changed-field summary. Do not expose IP address, user agent, request ID, raw JSON, contacts, secrets, or arbitrary actor identity details.
5. Provide Admin-only user/invitation management projections/actions that consume existing profile/invitation authority. The S07 user directory may display safe identity and operational state (full name, application role, active state, preferred locale, notification-preference booleans, invitation status/timestamps) but never password/session/authentication secrets, consent IP, raw token/hash, phone, raw email delivery/provider fields, or arbitrary user metadata. Mutations are limited to the already accepted operations demonstrably supported by existing commands/API: invitation creation/revocation/resend state where safe, and activation/deactivation only if a constrained authoritative operation exists or is added with full audit/RLS checks. S07 must not invent deletion, role escalation, or direct profile editing.
6. If the required safe user-management command does not exist, add one narrow actor-derived command with explicit Admin-only checks, non-self-lockout protection, audit evidence, idempotent safe outcomes, and no access to Supabase Auth admin APIs from browser code. If its behavior changes the accepted role/identity lifecycle, stop for an ADR/Project Owner decision.
7. Preserve all existing S06 notification queue role rules and use its safe operations projection rather than direct base-table reads.
8. Add indexes only after exact aggregate/keyset query shapes are settled. The S07 specification must address the current Supabase advisor findings as a separate quality item: no broad “index every FK” migration. Each added FK or query index needs an explained route/query consumer and measured/explainable rationale; unused-index lints on a small demo corpus are not grounds for destructive removal.

### Migration verification contract (for the later manual workflow)

Before any application code consumes a new S07 source: review exact SQL, apply it only under the separately chosen manual `jsf-pm-dev` workflow, regenerate `src/lib/database.types.ts` unchanged from MCP output, commit/source-record migration and generated-type provenance separately as applicable, and record migration path/name, target, result, type artifact, and test evidence. A failed/partial application stops the dependent item and is repaired only by a reviewed forward migration.

---

## 5. Work items and sequence

### S07-01 — E09 baseline reconciliation and demo inventory

**Objective:** establish a no-guess implementation map before schema/UI work.

1. Map every E09 behavior to its actual S06 repository baseline: migration source, generated type, existing view/function/table, safe application query/action, route, role/capacity rule, test owner, and demo scenario.
2. Confirm the current calendar feed/view and metrics/completion-cycle shapes; identify each missing safe projection/command against M1–M3.
3. Inventory current Admin, PM, Operator, Client, settings, invitation, project workspace, notification, archive, and link-report routes to avoid duplicate surfaces and dead navigation.
4. Write `dev-docs/specs/s07/s07-e09-capability-contract-mapping-reference.md`, including a matrix for calendar, archive, history, metrics, Admin operations, configuration diagnostics, user/invite operations, and demo data. **Completed 2026-08-23.**
5. Record which E09 clauses are capability deliverable now versus E10/external activation deferral.

**Exit:** no S07 task depends on guessed RPC/view/type/route/role semantics; every proposed migration obligation is explicit.

### S07-02 — Calendar and manual milestones

**Objective:** expose one accurate, role-safe operational timeline without expanding visibility.

1. Implement M1 through the selected later manual workflow; consume its generated types only after provenance is complete.
2. Create localized canonical calendar routes: a shared role-aware entry plus project-scoped context where authorized. Navigation must show only real destinations.
3. Render range-bounded agenda/month/week presentation from the safe feed, with text/list alternative, no color-only semantics, keyboard navigability, 375px behavior, loading/empty/error/retry states, and concrete safe deep links only where destination authorization independently succeeds.
4. Add Admin/PM Lead milestone create/edit/delete dialogs with confirmation, validation, focus handling, pending state, and authoritative refresh. PM Watcher is visibly read-only; Operator/Client never receive management controls.

**Exit:** each role sees only its permitted events; a forged project/event action cannot read or mutate another role’s data; no deadline is duplicated into manual storage.

### S07-03 — Finalized production archive and broken-link operations

**Objective:** make delivered/approved production history demonstrable without blurring workflow distinctions.

1. Implement M2 through the selected later manual workflow and consume only the safe archive/incident contracts.
2. Add project archive integration and global/scoped PM archive routes, with bounded server-side filters and keyset pagination.
3. Deliver deliberate outbound and copy-link interactions that state the application stores/opens an external URL but does not verify, preview, proxy, or download it.
4. Add Admin/PM incident views for broken links using the safe projection, resolve-status handling only if an existing constrained command supports it, and no lifecycle/status mutation workaround.
5. Add Client archive only where M2 delivers a client-safe final-production projection. Resolve the explicit Operator-archive policy before exposing an Operator route.

**Exit:** only `approved`/`delivered` production records appear; client submissions never appear; all archive visibility remains role/project scoped.

### S07-04 — Notification history and operations consolidation

**Objective:** complete the operational visibility around S06 without changing provider posture.

1. Add the 90-day default history window to `/notificaciones` using S06’s self-only feed/keyset contract; preserve mark-one/read-all and unread behavior.
2. Add safe user-owned filters only when supported by the projection (read state, category, bounded date range); no provider/channel/recipient operational data.
3. Consolidate existing Admin and PM Lead S06 operations queue access into the E09 console through shared server-only query modules. Do not copy queue logic or weaken PM-lead scope.
4. Keep terminal suppression copy explicit: not sent, not automatically queued/retried/replayed, and not proof of an active integration.

**Exit:** notification history is complete for demo use while provider/operations data remains unavailable to ordinary users.

### S07-05 — Scoped metrics and accessible operational dashboards

**Objective:** turn existing authoritative data into useful, non-fabricated operational decisions.

1. Implement M3 metrics contract through the selected later manual workflow.
2. Add an Admin metrics dashboard and PM project-scoped dashboard with date/project filters constrained server-side; show cards, trend/status/review-cycle visualizations, and equivalent accessible data tables/summaries.
3. Render data-quality states distinctly: no data, zero count, incomplete cycle, and query error must not be conflated.
4. Link metrics to existing authorized screens only; charts must not leak a project/entity the caller cannot subsequently open.
5. Do not derive metrics from browser time or load all raw audit rows into the client.

**Exit:** Admin sees global aggregates; PM users see only authorized project aggregates; Client/Operator are denied; every visualization has an accessible alternative.

### S07-06 — Admin console, safe user/invitation state, and diagnostics

**Objective:** make the system operable in the demo without exposing secrets or granting unsupported control.

1. Implement M3 safe admin/user/audit contract through the selected manual workflow.
2. Build Admin overview sections for notifications operations, deadline/stalled attention, link incidents, user/invitation state, bounded audit history, metrics, and development-health/configuration presence.
3. Build PM operations summary limited to active lead/watcher project authority; retain Watcher read-only restrictions.
4. Configuration diagnostics must consume a server-only typed capability summary, not `process.env` values in components. Display only stable states such as `development capability`, `external delivery inactive`, `activation prerequisites not configured`, and `not assessed`; never show raw variable/provider details.
5. User management must be a bounded operational surface, not a hidden Auth console: do not provide role editing, password/session manipulation, token display, raw consent data, deletion, or unverifiable send/resend success claims.

**Exit:** Admin can demonstrate system stewardship safely; no control bypasses existing identity, project, or provider boundaries.

### S07-07 — Localhost demo corpus, navigation, localization, accessibility, and closeout

**Objective:** integrate E09 as a single stakeholder-ready demo experience.

1. Reconcile the bootstrap corpus only as needed to produce deterministic sandbox scenarios: manual milestone, overdue/upcoming deadlines, finalized production archive, safe link incident, notification history, delivery/review metrics, completion/reopen cycle, and user/invite state. Preserve named reference scenarios.
2. Update desktop/mobile navigation in role order; no navigation item may point to a placeholder, unauthorized page, or provider activation path.
3. Add message catalog namespaces with exact `es-MX`/`en-US` parity. Verify locale-preserving links, both themes, keyboard paths, dialogs/focus restoration, 44px primary touch targets, non-color state meaning, chart/table alternatives, and mobile layouts.
4. Write `dev-docs/specs/s07/s07-sprint-07-closeout-verification.md` with exact source/type/migration provenance, actual checks, manual journeys, demo-script readiness, known limits, and all provider/E10 deferrals.
5. Write `dev-docs/documentation/s07-localhost-stakeholder-demo-runbook.md`; update `CHANGELOG.md` only with implemented S07 capability, never activation/release claims.

---

## 6. Verification strategy

Use the repository Vitest/RTL/MSW/database-contract conventions. Do not add Playwright. The later migration workflow must provide database/RLS evidence; component tests do not prove RLS by themselves.

### 6.1 Required automated evidence

| Area | Required proof |
| --- | --- |
| Calendar feed | Safe role projection; Admin/PM Lead/Watcher scope; Operator/Client isolation; bounded range; deterministic ordering; no duplicate events; no deleted rows. |
| Milestones | Only Admin/active PM Lead can create/update/delete authorized-project milestones; validation, audit, denied roles, forged IDs, and refresh behavior. |
| Archive | Production-only + `approved`/`delivered` inclusion; explicit `client_submission` exclusion; keyset/filter bounds; Client isolation; unresolved-link queue denial outside Admin/authorized PM. |
| Notification history | Self-only 90-day default; keyset/read actions; no external channel, suppression, provider, or operations data leakage. |
| Metrics | Admin global versus PM scope; watcher read-only behavior; Client/Operator denial; accurate null/no-data states; accessible table equivalent for each chart. |
| Admin operations | Bounded audit/user/invite/diagnostic representations; no secret/raw token/phone/IP/session/provider payload exposure; unsupported mutation absence. |
| Diagnostics | Typed server-only status only; placeholder/missing configuration remains inactive; no adapter/network/scheduler invocation. |
| Regression | S04–S06 lifecycle, client isolation, URL policy, notification suppression terminality, operations queue authorization, i18n parity, and app-shell navigation remain green. |

### 6.2 Manual localhost stakeholder-demo journeys

After focused automation is green, use only `Acme Sandbox Campaign` for mutation:

1. **Admin overview:** sign in as Demo Admin; show global calendar, milestones, metrics, terminal notification operations, link incidents, safe user/invitation state, and inactive configuration summary. Confirm no secret/provider values appear.
2. **PM Lead:** open a managed project calendar, create/edit/delete a milestone, inspect project metrics/archive/operations, and verify project scope.
3. **PM Watcher:** show the same permitted read context with no milestone/user/operations mutations.
4. **Operator:** show own agenda/calendar context and any explicitly accepted own-work archive visibility; attempt a foreign project/event deep link and confirm controlled denial/no disclosure.
5. **Client:** show only client-safe project timeline/finalized production archive/history; verify another client’s direct-work context and internal operations do not appear.
6. **Archive and links:** open/copy a stored finalized production URL deliberately; show that no preview/reachability check occurs. Inspect an unresolved broken-link incident as authorized internal user only.
7. **Notification truthfulness:** use inbox history/read behavior and, if shown, operations queue wording proving external delivery was suppressed—not sent or pending replay.
8. **Metrics truthfulness:** demonstrate a completion/reopen cycle, a no-data state, and an authorized chart/table equivalent; confirm exact project scope.
9. **Accessibility/localization:** repeat primary calendar, archive, metrics, and administration paths at 375px, keyboard-only, both themes, Spanish and English.
10. **Regression journey:** demonstrate PM plan → Operator submit → PM internal review → Client review → finalized archive/history/metric update through existing real authorization boundaries; no external provider success is claimed.

### 6.3 Integrated closeout command

Run the supported explicit test posture rather than relying on an inherited `NODE_ENV` value. S06 recorded that `env -u NODE_ENV npm run verify` passes while inherited `NODE_ENV=production` breaks Vitest/React `act`. S07 must either normalize the script/CI environment in a bounded follow-up or record the exact supported invocation; it must not treat a bare environment-dependent command as reproducible evidence.

---

## 7. Definition of Done

S07 is complete only when:

1. E09 calendar, archive, notification history, metrics, and operational administration routes are real, integrated, localized, accessible, role-safe, and usable on localhost.
2. The completed application can demonstrate a coherent Admin, PM Lead, PM Watcher, Operator, and Client journey with no dead/placeholder navigation.
3. Calendar events remain authoritative compositions of existing deadlines plus manual milestones; mutation is constrained/audited and never broadens role visibility.
4. Archive inclusion is restricted to finalized production `approved`/`delivered` records; client submissions remain excluded.
5. Metrics are authoritative, scoped, performant/bounded, accessible, and do not use a materialized store, scheduler, or client-only truth.
6. User/invite, audit, queue, link-incident, and configuration-presence views are bounded operational representations with no secrets, tokens, phone/IP/session data, raw payloads, or provider configuration disclosure.
7. Existing S06 provider-disabled behavior remains terminal and truthful. No provider/account/deployment/hosted operation occurs.
8. Every required S07 migration has reviewed source and separately recorded manual application/type provenance before dependent application code is accepted. This planning document itself applies nothing.
9. Focused database/RLS/server/UI/i18n/accessibility tests, the supported full verification command, and every manual demo journey have factual recorded outcomes.
10. S07 closeout, stakeholder demo runbook, CHANGELOG, and deferred-work register distinguish feature-complete localhost capability from E10 release work and later pre-/post-WhatsApp activation work.

---

## 8. Stop conditions, conflicts, and Project Owner decisions

| Discovery / decision | Required response |
| --- | --- |
| A required E09 safe projection/command conflicts with generated types, applied schema, RLS, existing lifecycle semantics, or the API contract | Stop the affected item. Write the exact proposed forward migration/spec correction; do not use a direct table/browser/admin-client workaround. |
| Existing archive soft-delete semantics cannot satisfy a visible finalized archive without changing retention behavior | Stop and obtain a retention/visibility decision. Do not reinterpret deletion as archive silently. |
| Operator finalized-archive visibility is not already defined by safe source authority | Do not expose an Operator archive. Request a specific decision; S07 can still be feature-complete for the explicitly established Operator journey. |
| “User management” requires role changes, password/session control, Auth admin browser access, hard deletion, or raw consent/contact data | Exclude it from S07. Escalate identity-policy change; keep the bounded state/invitation surface only. |
| Calendar needs a browser timer, schedule, broad Realtime, or a client-side all-project query | Reject. The feed remains bounded server-authorized data; no scheduler/caching architecture enters S07. |
| A metrics request needs a materialized store, arbitrary audit export, or raw audit JSON | Stop for an architecture decision. S07 uses the specified authoritative aggregates only. |
| A configuration diagnostic exposes variable names/values, secret presence/length, provider error/payload, or permits activation | Block as security defect. Return only closed typed capability states. |
| Backup/restore, hosting, legal/privacy, real devices, provider activation, or production evidence is requested as part of the demo | Defer to E10 or the dedicated external-provider activation program; document the honest limitation. |
| Supabase advisor findings suggest indiscriminate indexing/removal | Do not bulk remediate. Add only query-proven indexes through reviewed migration and defer unrelated lints to quality work. |

### Required Project Owner decision before S07 graph launch

**D-S07-01 — Operator archive policy: resolved 2026-08-23.** Operators may use a standalone archive only for finalized production deliverables assigned directly to them. Its safe M2 projection must exclude project-wide delivery history, other assignees, feedback, audit data, client data, operations incidents, and any privileged fields. This does not create an Operator incident queue or a right to browse a project archive.

Everything else is sufficiently bounded to begin S07 specification/review. The manual migration-application workflow remains deliberately undecided and is not assumed here.

---

## 9. Immediate successors

1. **External-provider activation program, part A (provider-independent):** define/approve activation ADR/runbook; Resend/domain, Vercel/Cloudflare/Hostinger, preproduction, provider-safe deployment, observability, and backup/restore prerequisites where not WhatsApp-blocked.
2. **External-provider activation program, part B (WhatsApp-dependent):** Meta business/phone/template verification, public webhook/security/receipt behavior, QStash/workflow schedules, controlled smoke evidence, and only newly created post-activation notifications—never S06 suppressed history replay.
3. **E10:** release quality/compliance, real-device and performance evidence, legal/privacy publication, backup/restore drill, controlled stakeholder/client onboarding, training, handover, and production release authority.

## 10. Planning authority

This plan decomposes Epic 09 into a localhost-demo-completion capability while preserving ADR-024’s external-provider deferral. It does not activate providers, authorize a migration application, change retention/identity policy, or declare a release. Any material discovered change must be resolved in its governing ADR/PRD/SAD/schema/API authority before implementation.
