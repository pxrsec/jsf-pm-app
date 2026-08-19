# S03-E03-03 — Development Persona Access Guide

> [!CAUTION]
> **LOCAL DEVELOPMENT USE ONLY**
> This document describes access procedures for synthetic demonstration accounts provisioned exclusively in the local/development database (`jsf-pm-dev`) via `npm run db:bootstrap`. These accounts, domains (`*.jsf.internal`, `*.example.com`), and credentials **do not exist in production or preproduction environments**. Never attempt or apply these procedures against hosted production services.

---

## 1. Safety Notice & Security Posture

The Joya Star Films PM Application enforces an invite-only onboarding model with no public sign-up and no client-side role selection. In development and demonstration environments, the application preserves this exact production authorization architecture:

- **No Backdoors or Bypasses**: There are no hidden developer parameters, query flags, mock authentication headers, or client-side bypass switches.
- **Authoritative Database RBAC**: Every session resolves its role (`admin`, `pm`, `operator`, `client`) server-side from `public.profiles.role` joined with verified Supabase Auth tokens.
- **Standard UI Entry**: Demonstration access occurs exclusively through the standard localized authentication interface (`/iniciar-sesion`).

---

## 2. Prerequisites

Before accessing any demonstration persona, ensure the following local configuration is established:

1. **Local Environment Variables**:
   Your untracked `.env.local` file must define the necessary connection and demo configuration:
   - `NEXT_PUBLIC_APP_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY`
   - `DEV_DEMO_PASSWORD` (used by the bootstrap script to initialize demo persona passwords)

   *(Note: Never log, expose, or commit actual secret values or passwords.)*

2. **Seed Local Database**:
   Execute the idempotent bootstrap tool to reconcile all demo personas, project memberships, and seed tasks:
   ```bash
   npm run db:bootstrap
   ```

3. **Launch Development Server**:
   Start the Next.js development server:
   ```bash
   npm run dev
   ```
   The application is accessible at `http://localhost:3000`.

---

## 3. Demonstration Personas

The database bootstrap reconciles nine personas across all four application roles:

| Persona | Email Address | Application Role | Seeded Demonstration Context |
|---|---|---|---|
| **Demo Admin** | `demo-admin@demo.jsf.internal` | `admin` | Full workspace visibility; all 6 reference and sandbox projects. |
| **Demo PM Lead A** | `demo-pm-lead-a@demo.jsf.internal` | `pm` | Lead on *Acme Brand Relaunch*; Watcher on *Acme Sandbox Campaign*. |
| **Demo PM Lead B** | `demo-pm-lead-b@demo.jsf.internal` | `pm` | Lead on *Starlight Summer Campaign*. |
| **Demo Watcher A** | `demo-watcher-a@demo.jsf.internal` | `pm` | Read-only watcher membership on *Acme Brand Relaunch*. |
| **Demo Operator A** | `demo-operator-a@demo.jsf.internal` | `operator` | Assigned production tasks on *Acme Brand Relaunch*. |
| **Demo Operator B** | `demo-operator-b@demo.jsf.internal` | `operator` | Assigned interactive tasks on *Acme Sandbox Campaign*. |
| **Demo Client A1** | `demo-client-a1@demo.jsf.internal` | `client` | Primary client stakeholder for *Acme Corp* projects. |
| **Demo Client A2** | `demo-client-a2@demo.jsf.internal` | `client` | Secondary client stakeholder for *Acme Corp* projects. |
| **Demo Client B1** | `demo-client-b1@demo.jsf.internal` | `client` | Client stakeholder for *Starlight Media* projects. |

> [!NOTE]
> The password for each demo account is the value defined in `DEV_DEMO_PASSWORD` in your local `.env.local` file.

---

## 4. Persona Entry Procedure

To sign in as any demonstration persona:

1. Navigate to the sign-in page: `http://localhost:3000/iniciar-sesion` (or `http://localhost:3000/en/sign-in` for English).
2. Enter the chosen persona's **Email Address** (from Section 3 above).
3. Enter the demo password (the value configured in `DEV_DEMO_PASSWORD`).
4. Click **Iniciar sesión** (or **Sign in**).
5. Upon successful authentication, the server-authoritative role guard routes the user directly to their respective landing shell:
   - `admin` $\rightarrow$ `/admin`
   - `pm` $\rightarrow$ `/pm`
   - `operator` $\rightarrow$ `/operador`
   - `client` $\rightarrow$ `/cliente`

---

## 5. Reference vs. Sandbox Corpora Distinction

Demonstrations must maintain clear separation between persistent reference records and mutable demonstration data:

- **Reference Corpus (Read-Only by Convention)**:
  - *Acme Brand Relaunch*
  - *Internal Workflow Automation*
  - *Acme Commercial Q1*
  - *Acme Teaser 2025*
  - *Starlight Summer Campaign*
  These projects demonstrate realistic multi-client workflows, team assignments, and varied statuses. They should not be mutated during routine inspection.

- **Sandbox Corpus (Interactive Mutation)**:
  - *Acme Sandbox Campaign*
  This project is designated specifically for live client walkthroughs, task mutations, and interactive role demonstrations.

> [!TIP]
> If test data in the sandbox becomes inconsistent or needs resetting, simply re-run `npm run db:bootstrap` to idempotently restore clean baseline state without database drops.

---

## 6. Access Denial & Role-Isolation Demonstration Procedure

To demonstrate that the protected shell actively defends role boundaries without client-side bypass:

### Cross-Role Access Rejection
1. Sign in as a PM persona (e.g., `demo-pm-lead-a@demo.jsf.internal`).
2. Observe landing on `http://localhost:3000/pm`.
3. In the browser URL bar, attempt to navigate directly to `http://localhost:3000/admin`.
4. **Observed Result**: The server-side layout guard detects the role mismatch and immediately redirects the user back to `/pm`. No admin data or layout chrome is leaked.

### Unauthenticated Access Rejection
1. Sign out (or open an incognito browser window).
2. Navigate directly to `http://localhost:3000/admin` (or `/pm`, `/operador`, `/cliente`).
3. **Observed Result**: The server-side layout guard throws `UNAUTHENTICATED` and redirects directly to `/iniciar-sesion`. No protected shell chrome or data is rendered.

---

## 7. Sign-Out Procedure

1. In the global top navigation bar, locate the user affordance displaying the persona's name and role badge.
2. Click the **Cerrar sesión** button (or press `Tab` to focus and `Enter` to activate).
3. The client calls `supabase.auth.signOut()` and redirects to `/iniciar-sesion`.
4. Attempting to navigate back or access `/admin`, `/pm`, `/operador`, or `/cliente` immediately redirects to `/iniciar-sesion`.
