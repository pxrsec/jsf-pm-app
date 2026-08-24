# S07 Localhost Stakeholder Demonstration Runbook

> [!CAUTION]
> **LOCAL DEVELOPMENT USE ONLY**
> This runbook is intended exclusively for localhost demonstration of **Sprint 07 (Epic 09: Visibility, Reporting, and Operational Administration)** capabilities using synthetic demonstration data against `jsf-pm-dev`. These accounts, sample Google Drive links, and synthetic tokens **do not exist in production environments**.

---

## 1. Executive Summary & Demonstration Posture

This runbook guides product owners, developers, and stakeholders through an end-to-end verification and demonstration of all Epic 09 visibility, reporting, and operational administration capabilities.

### Truthfulness & System Boundaries

- **Localhost & Dev Data Plane Only**: All walkthroughs execute locally against `jsf-pm-dev`.
- **Outbound Link Behavior**: Deliverable URLs (for example, Google Drive links) represent stored user input. Opening a link triggers a standard browser outbound navigation; copying copies the URL to clipboard with live accessibility feedback. The application performs no server-side URL dereferencing or live reachability checks.
- **Provider-Inactive Posture**: External notification providers (WhatsApp, Resend, QStash, Sentry) remain inactive in development. External delivery records are deterministically `suppressed` with reason `provider_disabled`. Suppression is terminal—no asynchronous dispatch, background worker queue, or automatic retry loop runs.
- **Scope Limits**: Demonstrating these features locally does not constitute production hosting readiness, formal third-party WCAG certification, or external provider SLA compliance.

---

## 2. Prerequisites & Local Environment Setup

### Required Configuration

Ensure local `.env.local` contains valid development values for:

- `NEXT_PUBLIC_APP_URL` (for example, `http://localhost:3000`)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `DEV_DEMO_PASSWORD` (used by demo personas)

Never commit, log, or share secret values or credentials.

### Seed Demonstration Data

Execute the idempotent bootstrap tool:

```bash
npm run db:bootstrap
```

A completed run must end with `🎉 Demo Bootstrap Complete!`. On a first reconciliation after a new immutable-fixture epoch, messages such as `Creating new generation-scoped deliverable and audit log generation`, `Inserting new standard in-app notification pair`, `Inserting new historic notification fixture`, and `Inserting singular suppression notification fixture` are expected. An integrity error is not expected; preserve its exact text and stop rather than resetting or deleting immutable data.

### Start Development Server

```bash
npm run dev
```

Open `http://localhost:3000` or `http://localhost:3000/en` for English.

---

## 3. Demonstration Personas & Password

All demo personas authenticate using the password set in local `DEV_DEMO_PASSWORD`.

| Persona | Email | Role | Core Demo Scope |
| --- | --- | --- | --- |
| **Demo Admin** | `demo-admin@demo.jsf.internal` | `admin` | Workspace health counters, incident review, invite tracking, unrestricted calendar/metrics/archive access |
| **Demo PM Lead A** | `demo-pm-lead-a@demo.jsf.internal` | `pm` | Lead on *Acme Brand Relaunch* and *Acme Sandbox Campaign*; milestone creation, team metrics, archive review |
| **Demo PM Watcher A** | `demo-watcher-a@demo.jsf.internal` | `pm` | Watcher on *Acme Brand Relaunch*; read-only inspection |
| **Demo Operator A** | `demo-operator-a@demo.jsf.internal` | `operator` | Assigned production tasks, task-scoped calendar view, notification history |
| **Demo Operator B** | `demo-operator-b@demo.jsf.internal` | `operator` | Assigned overdue tasks, link incident reporter |
| **Demo Client A1** | `demo-client-a1@demo.jsf.internal` | `client` | Primary *Acme Corp* stakeholder; client deliverable review and task archive |

---

## 4. Corpus Separation & Reseed Rules

- **Reference Corpus (Read-Only by Convention)**: `Acme Brand Relaunch`, `Internal Workflow Automation`, `Acme Commercial Q1`, `Acme Teaser 2025`, and `Starlight Summer Campaign`. These projects model history and must not be mutated during routine demonstrations.
- **Sandbox Corpus (Interactive Walkthrough)**: `Acme Sandbox Campaign`. Perform all milestone edits, filter tests, and permitted task mutations here.
- **Immutable Fixture Rule**: `audit_logs`, `notification_events`, and `deliverable_versions` are insert-only. Rerunning bootstrap reuses a complete valid recent cohort before it creates a new immutable generation. Never attempt to reset them manually.

---

## 5. Required Manual Evidence Tracker — J-01 through J-10

Record actual observations while executing the journeys. Leave **Observed result**, **Verdict**, and **Checked** blank until the journey is actually run. Do not infer a pass from implementation or automated tests.

| Checked | ID   | Persona / locale / viewport                                     | Entry and action                                                                                                                               | Required observation                                                                                                                                                                                                                      | Observed result                                                                                                                                                                                                       | Verdict        |
| ------- | ---- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| [x]     | J-01 | Demo Admin; Spanish desktop                                     | `/admin`; use Calendar, global Metrics, Admin Operations, Archive, incidents, and notification operations                                      | All Admin destinations work. Diagnostics use only closed-safe tokens; no provider configuration, raw ID, contact, or secret disclosure.                                                                                                   | All destinations work                                                                                                                                                                                                 | pass           |
| [x]     | J-02 | Demo PM Lead A; Spanish desktop                                 | `/pm`; create/edit one **Sandbox-only** milestone; inspect selected-project metrics, archive/incidents, and authorized notification operations | Calendar authority works without Admin console/global-metrics access. Queue wording remains terminal/inactive.                                                                                                                            | all destinations work, milestones get created correctly                                                                                                                                                               | pass           |
| [x]     | J-03 | Demo PM Watcher A; Spanish desktop                              | Inspect calendar, selected-project metrics, archive/incidents; attempt direct PM notification-operation route                                  | Scoped read access only. No queue navigation/data or Admin operations. Record the redirect/denial result.                                                                                                                                 | all destinations work as expected, no notification operations access watcher denial/redirect seems to work correctly                                                                                                  | pass           |
| [x]     | J-04 | Demo Operator A, then Operator B; Spanish desktop               | Inspect Calendar and own Archive                                                                                                               | Operator A sees only assigned-task milestone **Sandbox Operator Checkpoint**. Project-scoped **Sandbox Project Review** and foreign-task milestones are absent. No incident/project/Drive expansion beyond authorization.                 | Initial August view did not show either September fixture. Read-only `jsf-pm-dev` verification confirmed the task-scoped fixture exists at the seeded future date and is attached to Operator A's direct task; the project-scoped fixture exists separately. The role-safe calendar function permits only the direct task-scoped fixture for an Operator. | pass with documented date-range limitation |
| [x]     | J-05 | Demo Client A1; Spanish desktop                                 | Inspect deadline Calendar, final Archive, and notification history                                                                             | Only client-safe context. No manual milestones, incidents, metrics, or Admin operations.                                                                                                                                                  | routes work as expected, scoped properly it seems                                                                                                                                                                     | pass           |
| [x]     | J-06 | Demo PM Lead A or Admin; Spanish desktop                        | `/pm/archivo` or `/admin/archivo`; inspect archive and incident                                                                                | Approved **Sandbox Approved Master Video Cut** and delivered **Sandbox Delivered Social Teaser** appear. Client-submission deliverable is excluded. Open/copy is stored-link behavior only; no reachability claim. Incident is read-only. | tested as demo pm lead a, the archive displays the two items and another one called "Sandbox Metrics Review Cycle — Epoch 689". the open/copy behaviors work as expected. incident is read only                       | pass           |
| [x]     | J-07 | Demo Operator A; Spanish desktop                                | `/notificaciones`; exercise All/Read/Unread and a custom range covering 91–93 days                                                             | Default range contains the current read and unread fixture pair; it may also contain other truthful demo history. Custom bounded range exposes one historic fixture. Mark-one/mark-all remain self-only. No queue/provider data appears. Suppression is truthfully terminal `provider_disabled`.  | Initial default view showed 2 read and 1 unread notifications; marking the unread item read worked. Read-only fixture verification confirmed one current standard read event and one current standard unread event before that user action. | pass           |
| [x]     | J-08 | Demo PM Lead A, then Admin; Spanish desktop                     | `/pm/metricas` scoped to **Acme Sandbox Campaign**, then `/admin/metricas`                                                                     | Cards, trend chart, and visible tables agree. Current client review and project completion/reopen cohort is present. No-data/authority-limited states are not presented as zero when corpus permits a distinction.                        | this seems to work properly,                                                                                                                                                                                          | pass           |
| [x]     | J-09 | Admin and PM Lead A; Spanish and English; 375px; light and dark | Exercise Calendar, Archive, Notification, and drawer/dialog controls with keyboard only                                                        | Target controls are at least 44px. Drawer Escape/focus restore and dialogs work. No essential clipping, overlap, horizontal overflow, or color-only status. English and Spanish date labels/localized routes are correct.                 | keyboard navigation works correctly, theming works correctly it seems.                                                                                                 | pass after remediation with antigravity |
| [x]     | J-10 | Demo Operator A, then signed-out browser; Spanish desktop       | Direct navigate to `/admin`, then sign out and direct navigate to `/pm`                                                                        | Unauthorized role redirects/denies before protected data is exposed. Absence of a navigation item is not accepted as authorization evidence by itself.                                                                                    | this works correctly, as operator A i get redirected to inicio and as logged out i get redirected to the iniciar-sesion route                                                                                         | pass           |

---

## 6. Detailed Execution Notes

### J-01 — Admin visibility and operations

1. Sign in as **Demo Admin**.
2. Visit Calendar, Metrics, Admin Operations, Archive, link incident views, and authorized notification-operation views.
3. Confirm all displayed operational posture is local/synthetic and provider-inactive. Do not open or reveal credentials/configuration values.

### J-02 and J-03 — PM authority versus watcher scope

1. As **Demo PM Lead A**, filter Calendar by *Acme Sandbox Campaign*, create and edit only a Sandbox milestone, and verify selected-project metrics and archive behavior.
2. As **Demo PM Watcher A**, inspect the same authorized read surfaces and attempt the known direct PM notification-operation route.
3. Capture the precise watcher denial/redirect. Do not mutate a reference project.

### J-04 and J-05 — Operator and client boundaries

1. As **Demo Operator A**, verify only the assigned task-scoped checkpoint is visible. Repeat archive inspection as Operator B only within that persona's authorized scope.
2. As **Demo Client A1**, verify deadline calendar, final archive, and notification history without Admin/PM operational controls.

### J-06 — Archive and link-incident truthfulness

1. As Admin or PM Lead A, use status and date filters in Archive.
2. Confirm the two named production deliverables and exclusion of the `client_submission` workflow.
3. Use **Open Submission** and **Copy Link** only as stored-link UI behavior. Do not claim external URL reachability.
4. Inspect the open incident on *Sandbox Delivered Social Teaser* without attempting to resolve or mutate it.

### J-07 — Notification history and immutable rollover evidence

1. As **Demo Operator A**, select **Unread**, **Read**, and **All** in Notifications.
2. Confirm the default 90-day window contains the current unread task-assignment and read deliverable-submission records.
3. Apply an explicit custom range that covers 91 through 93 days ago; confirm exactly one historic in-app fixture.
4. Confirm external email state is terminal `suppressed` / `provider_disabled`, with no dispatch/retry claim.

### J-08 — Metrics derivation

1. As **Demo PM Lead A**, open PM Metrics and select *Acme Sandbox Campaign*.
2. Confirm the client-review metric derives from the immutable audit sequence and the completion/reopen metric derives from the project audit sequence.
3. As Admin, confirm global metrics do not contradict the scoped view where the same Sandbox cohort is included.

### J-09 — Accessibility and localization

1. At a 375px viewport, use keyboard-only navigation in both light and dark themes.
2. Verify Calendar switchers, Archive links/filters, Notification filters, drawer, and dialogs are named and usable.
3. Repeat an appropriate Calendar date/header check in Spanish and English. Record visual or interaction defects rather than treating an untested condition as pass.

### J-10 — Direct-route denial

1. As **Demo Operator A**, navigate directly to `/admin`; verify server-side redirect before protected data appears.
2. Sign out, then navigate directly to `/pm`; verify redirect to sign-in before protected data appears.

---

## 7. Evidence Rules and Closeout Gate

- Mark a journey **Pass** only after recording the actual observed result.
- Mark a journey **Blocked** or **Fail** with the exact route, persona, action, and visible error/behavior. Do not repair immutable records manually.
- Keep reference/isolation projects read-only. Record any unexpected mutation as a blocker.
- A successful bootstrap proves reconciliation completed for that execution. It does **not** substitute for the J-01–J-10 UI observations.
- Sprint 07 closeout is eligible only after all J-01–J-10 rows have factual outcomes, any defect is resolved or explicitly accepted, and the closeout record is updated without production/provider claims.
