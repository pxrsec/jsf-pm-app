# S07 Localhost Stakeholder Demonstration Runbook

> [!CAUTION]
> **LOCAL DEVELOPMENT USE ONLY**
> This runbook is intended exclusively for localhost demonstration of **Sprint 07 (Epic 09: Visibility, Reporting, and Operational Administration)** capabilities using synthetic demonstration data against `jsf-pm-dev`. These accounts, sample Google Drive links, and synthetic tokens **do not exist in production environments**.

---

## 1. Executive Summary & Demonstration Posture

This runbook guides product owners, developers, and stakeholders through an end-to-end verification and demonstration of all Epic 09 visibility, reporting, and operational administration capabilities.

### Truthfulness & System Boundaries
- **Localhost & Dev Data Plane Only**: All walkthroughs execute locally against `jsf-pm-dev`.
- **Outbound Link Behavior**: Deliverable URLs (e.g., Google Drive links) represent stored user input. Opening a link triggers a standard browser outbound navigation; copying copies the URL to clipboard with live accessibility feedback. The application performs no server-side URL dereferencing or live reachability checks.
- **Provider-Inactive Posture**: External notification providers (WhatsApp, Resend, QStash, Sentry) remain inactive in development. External delivery records are deterministically `suppressed` (reason: `provider_disabled`). Suppression is terminal—no asynchronous dispatch, background worker queue, or automatic retry loop runs.
- **Scope Limits**: Demonstrating these features locally does not constitute production hosting readiness, formal third-party WCAG certification, or external provider SLA compliance.

---

## 2. Prerequisites & Local Environment Setup

### Required Configuration
Ensure your local `.env.local` file contains valid development values for:
- `NEXT_PUBLIC_APP_URL` (e.g., `http://localhost:3000`)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `DEV_DEMO_PASSWORD` (used by demo personas)

*(Note: Never commit, log, or share real secret values or credentials.)*

### Seed Demonstration Data
Execute the idempotent bootstrap tool to reconcile all reference and sandbox records:
```bash
npm run db:bootstrap
```

### Start Development Server
```bash
npm run dev
```
Open `http://localhost:3000` (or `http://localhost:3000/en` for English).

---

## 3. Demonstration Personas & Password

All demo personas authenticate using the password set in your local `DEV_DEMO_PASSWORD` variable.

| Persona | Email | Role | Core Demo Scope |
|---|---|---|---|
| **Demo Admin** | `demo-admin@demo.jsf.internal` | `admin` | Workspace health counters, incident review, invite tracking, unrestricted calendar/metrics/archive access |
| **Demo PM Lead A** | `demo-pm-lead-a@demo.jsf.internal` | `pm` | Lead on *Acme Brand Relaunch* & *Acme Sandbox Campaign*; milestone creation, team metrics, archive review |
| **Demo PM Watcher A**| `demo-watcher-a@demo.jsf.internal` | `pm` | Watcher on *Acme Brand Relaunch*; read-only inspection |
| **Demo Operator A** | `demo-operator-a@demo.jsf.internal` | `operator` | Assigned production tasks, task-scoped calendar view (M1-R), notification history |
| **Demo Operator B** | `demo-operator-b@demo.jsf.internal` | `operator` | Assigned overdue tasks, link incident reporter |
| **Demo Client A1** | `demo-client-a1@demo.jsf.internal` | `client` | Primary *Acme Corp* stakeholder; client deliverable review & task archive |

---

## 4. Corpus Separation & Reseed Rules

- **Reference Corpus (Read-Only by Convention)**:
  `Acme Brand Relaunch`, `Internal Workflow Automation`, `Acme Commercial Q1`, `Acme Teaser 2025`, `Starlight Summer Campaign`. These projects model realistic complex history and must not be mutated during routine demonstrations.
- **Sandbox Corpus (Interactive Walkthrough)**:
  `Acme Sandbox Campaign`. All live walkthroughs, milestone edits, filter tests, and task mutations should be conducted here.
- **Resetting State**:
  To reset the sandbox to its baseline state, re-run `npm run db:bootstrap`. Mutable rows are reconciled by controlled update; immutable audit logs and events use deterministic 90-day bucketed fixtures without deleting prior historical records.

---

## 5. End-to-End Walkthrough Sequence

Execute journeys in the following recommended order:

### Journey 1: Calendar Feed & Milestone Management (M1 / M1-R)
1. Sign in as **Demo Admin** (`demo-admin@demo.jsf.internal`).
2. Navigate to **Calendario** (`/calendario` or `/en/calendar`).
3. **View Switcher**: Toggle across **Mes** (Month), **Semana** (Week), **Agenda**, and **Lista** (List). Observe responsive layouts and full localized date headers.
4. **Project Filter**: Filter by *Acme Sandbox Campaign*. Observe task-scoped milestone (*Sandbox Operator Checkpoint*) and project-scoped milestone (*Sandbox Project Review*).
5. **Create & Edit Milestone**: Click **+ Nuevo hito** (New Milestone). Create a milestone for the sandbox project. Click the action button on an existing milestone to edit or delete it.
6. Sign out and sign in as **Demo Operator A** (`demo-operator-a@demo.jsf.internal`).
7. Navigate to `/calendario`.
8. **Operator Filter (M1-R)**: Observe that Operator A sees only milestones attached to tasks assigned to them (*Sandbox Operator Checkpoint*). The project-scoped milestone (*Sandbox Project Review*) and unassigned milestones are hidden.

---

### Journey 2: Finalized Deliverables Archive (M2)
1. Sign in as **Demo PM Lead A** (`demo-pm-lead-a@demo.jsf.internal`).
2. Navigate to **Archivo** (`/pm/archivo` or `/en/pm/archive`).
3. **Filter Bar**:
   - Filter by status: toggle **Aprobados** (Approved) and **Entregados** (Delivered).
   - Date presets: Click **Últimos 90 días** (Last 90 Days) and **90 días previos** (Previous 90 Days).
4. **Archive Items**:
   - Observe *Sandbox Approved Master Video Cut* (Approved) and *Sandbox Delivered Social Teaser* (Delivered).
   - Note that *Sandbox Client Upload Specification* is excluded because it is a `client_submission` workflow.
5. **Outbound Actions**:
   - Click **Abrir entrega** (Open Submission) $\rightarrow$ opens URL in new tab.
   - Click **Copiar enlace** (Copy Link) $\rightarrow$ copies URL with live polite screen reader feedback.

---

### Journey 3: Link Incidents & Operations Review (M2 / M5)
1. Sign in as **Demo Admin** (`demo-admin@demo.jsf.internal`).
2. Navigate to **Operaciones** (`/admin/operaciones` or `/en/admin/operations`).
3. **Health Counters**: Observe active projects, open tasks, unresolved link incidents, and pending invitations.
4. **Link Incidents List**: Inspect the reported incident on *Sandbox Delivered Social Teaser* (reported by Operator B: *"Link target requires authorization or is unavailable"*).
5. Verify that incident data displays securely without leaking provider internals or credentials.

---

### Journey 4: Notification History & Suppression Truthfulness (M4)
1. Sign in as **Demo Operator A** (`demo-operator-a@demo.jsf.internal`).
2. Navigate to **Notificaciones** (`/notificaciones` or `/en/notifications`).
3. **Read / Unread Filtering**:
   - Click **No leídas** (Unread) $\rightarrow$ displays unread task assignment.
   - Click **Leídas** (Read) $\rightarrow$ displays read deliverable submission.
   - Click **Todas** (All) $\rightarrow$ displays both within the 90-day window.
4. **90-Day Window Filtering**:
   - Notice the default 90-day window notice. The 92-day historical event is excluded.
   - Apply a custom date filter spanning 100 days $\rightarrow$ historical notification appears.
5. **External Notification Suppression**:
   - External email notifications are terminal (`suppressed`, reason: `provider_disabled`). No retry loop or mock dispatch is claimed.

---

### Journey 5: Scoped Operational Metrics (M3)
1. Sign in as **Demo PM Lead A** (`demo-pm-lead-a@demo.jsf.internal`).
2. Navigate to **Métricas** (`/pm/metricas` or `/en/pm/metrics`).
3. **Project Scope**: Filter metrics for *Acme Sandbox Campaign*.
4. **Authoritative Cycle Derivation**:
   - Deliverable client review duration (~72 hours) derived from canonical audit trail.
   - Project completion and reopen duration derived from `project_completed` and `project_reopened` audit records.
5. Sign out and sign in as **Demo Client A1** (`demo-client-a1@demo.jsf.internal`).
6. Navigate to `/cliente/metricas`. Observe that client metrics display strictly sanitized project-level deliverables without leaking internal operator metrics.

---

### Journey 6: Protected Direct-Route Denial
1. Sign in as **Demo Operator A** (`demo-operator-a@demo.jsf.internal`).
2. In the browser address bar, attempt direct navigation to `http://localhost:3000/admin`.
3. **Observed Result**: Server layout guard redirects immediately to `/operador`.
4. Sign out and attempt direct navigation to `http://localhost:3000/pm`.
5. **Observed Result**: Server layout guard redirects immediately to `/iniciar-sesion`.
