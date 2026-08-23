# Future Production Promotion and External Provider Activation Runbook

> **Status:** Draft planning baseline. This document compiles the repository’s current development capability, known activation gaps, and future approval gates as of 2026-08-23.
>
> **It is not authorization to create provider accounts, configure secrets, alter DNS, apply remote migrations, deploy, send messages, receive webhooks, create schedules, or access production systems.** Each externally state-changing phase requires a separately accepted activation decision and an explicitly authorized operator.

## 1. Purpose and Authority

Sprint 06 deliberately delivered an internal notification **capability track**, not a live-provider release. The current application records eligible external deliveries as terminal `suppressed` records with `suppression_reason = provider_disabled`; it does not send email or WhatsApp, schedule background work, or process provider webhooks/receipts.

Use this document when the Project Owner decides to move from the current development capability toward staging and eventually production. Its subject-level authorities are:

1. Direct Project Owner decisions and accepted activation ADR/runbook.
2. Accepted ADR-024 and future accepted activation decisions.
3. Repository migrations for database shape, `contracts/openapi/jsf-pm-api.openapi.yaml` for HTTP contracts, and production security specifications for data controls.
4. Sprint 06 specifications and `dev-docs/specs/s06/s06-sprint-06-closeout-verification.md` for the current capability baseline.

A credential, a production URL, or `NODE_ENV=production` is never authorization by itself.

## 2. Current Baseline: What Exists and What Does Not

### 2.1 Implemented and usable in development

- In-app notification inbox at `/[locale]/notificaciones` for active authenticated roles.
- Internal terminal-suppression operations surfaces at `/[locale]/admin/notificaciones` and `/[locale]/pm/notificaciones`, protected by server authorization.
- Development-only manual alert evaluation, gated by both `NOTIFICATION_DEMO_ALERT_EVALUATION_ENABLED=true` and strict localhost development posture.
- Four reserved provider-facing endpoints that always reject with generic HTTP 404 / `error.code = "not_found"`:
  - `GET` and `POST` `/api/webhooks/whatsapp`
  - `POST` `/api/workflows/notification-processor`
  - `POST` `/api/workflows/alert-scheduler`
- Four committed Sprint 06 migration files and generated TypeScript baseline already applied to the development sandbox before S06-07.

### 2.2 Explicitly not implemented

- Concrete Resend dispatch adapter.
- Concrete WhatsApp dispatch adapter.
- Provider-message ID persistence and receipt-state advancement in an active flow.
- Public webhook signature/replay validation and raw-body policy.
- Upstash QStash/Workflow client, signed job handler, schedule creation, retry/DLQ policy, or observability.
- Production hosting, custom-domain/DNS configuration, production Supabase schema deployment, production RLS validation, and production smoke tests.

### 2.3 Non-negotiable carry-forward invariants

- `suppressed` / `provider_disabled` records are terminal. They have zero attempts and are never auto-claimed, retried, requeued, or replayed after later activation.
- In-app notification behavior, role authorization, recipient eligibility, RLS, and idempotency remain authoritative; a provider integration cannot bypass them.
- Provider secrets stay server-only. Do not expose them through `NEXT_PUBLIC_*`, logs, thrown errors, tests, telemetry, Git, or documentation.
- Inactive provider endpoints remain generic 404 until their exact activation scope is accepted and implemented.
- Navigation visibility is presentation only; it never grants access to queues, actions, RPCs, or data.

## 3. `NODE_ENV` Is Not Provider Activation

### 3.1 Current code meaning

`next.config.ts` reads `process.env.NODE_ENV` only to vary Content Security Policy and whether HSTS is added:

| `NODE_ENV` | Current repository effect |
| --- | --- |
| `development` | CSP permits `unsafe-eval` for development tooling; no HSTS header from this config. |
| `production` | Stricter current CSP and HSTS header. It does **not** construct a provider client, send a message, enable a webhook, create a schedule, or apply a migration. |
| `test` | Intended testing mode; test inputs should be deterministic and not depend on `.env.local`. |

Next.js documents that it normally assigns `development` for `next dev` and `production` for non-dev commands when the variable is otherwise unassigned. Do not use `NODE_ENV` as the project’s deployment-stage, provider, tenant, or feature-control flag. If a later app-level environment label is needed, define a separate reviewed server-only variable such as `APP_ENV`.

### 3.2 Why the review terminal saw `NODE_ENV=production`

The review shell inherited `NODE_ENV=production` from its parent process environment. The repository does not prove where that parent setting was introduced; it may come from a shell profile, launcher, CI runtime, or agent runtime. `next.config.ts` only consumes the value. It cannot export it into the shell.

That inherited value caused bare Vitest runs to load React’s production export, where `React.act` is unavailable. With `NODE_ENV` removed from the parent process, the normal repository verification gate passed. This is a test-environment reproducibility issue, not a provider-safety issue.

### 3.3 Required follow-up before CI/release hardening

Create a small, reviewed test-environment normalization task:

1. Define the expected mode for Vitest in the repository script or CI job.
2. Ensure it does not depend on private `.env.local` values.
3. Keep `next dev`, `next build`, and production deployment semantics owned by their corresponding commands/platform.
4. Re-run `npm run verify` from a clean shell and record the result.

Do not change `NODE_ENV` to `production` to activate providers. It will not activate them.

## 4. Actual Provider Activation Switches Today

### 4.1 Configuration parser

`src/lib/notifications/config.ts` reads `EXTERNAL_DELIVERY_MODE` and server-only provider configuration shape.

| State | Result today |
| --- | --- |
| Mode missing, blank, placeholder, invalid, or `disabled` | Fail-closed disabled capability; email and WhatsApp report `provider_disabled`. |
| `EXTERNAL_DELIVERY_MODE=active` plus incomplete/malformed/placeholder provider configuration | Fail-closed invalid capability; no dispatch. |
| `EXTERNAL_DELIVERY_MODE=active` plus shape-valid email and WhatsApp configuration | `active-ready` configuration snapshot only. This is **not** dispatch authorization. |

The reviewed local variable-name inventory does not contain `EXTERNAL_DELIVERY_MODE`; current effective state is therefore `mode_missing` and disabled.

### 4.2 The hard stop that prevents sending

`src/lib/notifications/channel-adapters.ts` contains only `DisabledEmailAdapter` and `DisabledWhatsAppAdapter`. Both return:

```ts
{ kind: "not_dispatched", channel, code: "provider_disabled" }
```

They do not use Resend, Meta, `fetch`, a queue, or a network client. Tests explicitly cover that even a configuration-shaped `active-ready` state still selects disabled/no-dispatch adapters.

**Conclusion:** no present environment variable can make the current repository send external email or WhatsApp.

### 4.3 Other present gates

| Control | Purpose | Does it activate a provider? |
| --- | --- | --- |
| `NOTIFICATION_DEMO_ALERT_EVALUATION_ENABLED=true` | Allows the internal evaluator UI only when the localhost development posture also passes. | No. It can create in-app records and terminal suppressions; it does not dispatch. |
| `NEXT_PUBLIC_APP_URL` | Participates in the evaluator’s strict localhost posture gate and application URL configuration. | No. |
| Resend / WhatsApp secret-shaped variables | Parsed only for future configuration readiness. | No. |
| `NODE_ENV=production` | Current build/runtime mode and security-header input. | No. |
| Provider route URLs | Reserved routes are hard 404 guards. | No. |

## 5. Required Architecture Decision Before Activation

Before changing an adapter, endpoint, schedule, or production environment, create and accept an activation ADR/runbook that answers all of the following:

1. **Scope:** which channel(s) activate first: email, WhatsApp, webhook receipts, processor, scheduler, or a limited combination.
2. **Environment:** separate development, staging/preview, and production accounts/projects/tokens; no cross-environment credential reuse.
3. **Recipient safety:** consent/preference policy, approved internal test recipients, volume cap, rate limit, and prohibition on historical suppressed-record replay.
4. **Payload policy:** permitted fields, template/message rendering, localization, redaction, attachment/media policy, and logging/telemetry exclusions.
5. **Dispatch contract:** idempotency key, authoritative state transition, attempt counting, retry/DLQ policy, permanent/transient failure handling, and fallback policy.
6. **Receipt contract:** provider-message ID storage, signature verification, replay defense, raw-body retention/minimization, monotonic status transitions, and safe projection.
7. **Public endpoint policy:** HTTPS/public reachability, CORS posture, Origin/Host controls, timeout limits, abuse controls, and observability.
8. **Operations:** owner, monitoring, alerting, incident response, kill switch, credential rotation, rollback, audit evidence, and release approval.
9. **Evidence:** focused unit/integration tests, staging smoke tests using approved recipients, production canary criteria, acceptance record, and no-send rollback proof.

Until this ADR is accepted, the correct state is disabled regardless of environment variables.

## 6. Future Implementation Work Required

The activation ADR must produce bounded implementation cards. At minimum, do not combine all of these blindly into one change.

### 6.1 Email delivery card

- Implement a server-only Resend adapter behind the existing channel interface.
- Validate sender identity and recipient eligibility before provider invocation.
- Produce localized/template-rendered message content under the approved payload policy.
- Use stable idempotency keys and persist only permitted safe provider metadata.
- Map provider outcomes into the canonical state machine without replaying historical suppressions.
- Add controlled send/failure tests and a staging test-recipient smoke procedure.

### 6.2 WhatsApp delivery and receipt card

- Implement server-only Meta Cloud API adapter with approved template and recipient policy.
- Create/update only approved WhatsApp template metadata.
- Implement the webhook route only after public HTTPS availability, raw-body bounds, signature verification, replay defense, idempotency, and safe receipt projection are accepted.
- Test monotonic delivery/read receipt transitions and safe rejection paths.

### 6.3 Queue/scheduler card

- Implement a signed QStash processor endpoint only after the signature contract is tested against the raw request body.
- Implement the scheduler only with an explicit schedule ID, timezone/cadence decision, retry/DLQ policy, concurrency/lease policy, and deletion/disable procedure.
- Do not introduce browser polling, local timers, or a scheduler substitute.

## 7. Production Data and Supabase Promotion

### 7.1 Required baseline

A production Supabase project must not be treated as `jsf-pm-dev`. Production needs its own project, credentials, Auth configuration, security review, and acceptance evidence.

All repository schema changes must remain versioned migration files. Do not manually modify production through a dashboard SQL/Table Editor because that bypasses migration history.

### 7.2 Controlled sequence

1. Create or confirm the separate staging and production Supabase projects.
2. Reconcile remote migration history with the committed `supabase/migrations/` baseline before applying anything.
3. Review the exact migration inventory and target project identifier; verify no development credentials or demo records are in scope.
4. Apply migrations to staging through the Project Owner-approved release method.
5. Validate schema, generated-type provenance, RLS/RPC behavior with real authenticated staging identities, and rollback assumptions.
6. Obtain release approval.
7. Apply the same committed, reviewed migration sequence to production through the approved production release method.
8. Record exact environment, migration history, operator/automation identity, time, commit, and verification evidence.

Supabase recommends CI/CD deployment for production migrations. The current repository `AGENTS.md` grants its specialized MCP schema authority only for `jsf-pm-dev`; it does **not** authorize a developer or implementation agent to mutate production through Supabase MCP, dashboard edits, or an ad hoc CLI command. A production migration owner and release mechanism must be explicitly accepted first.

### 7.3 Database-specific release evidence

Static tests do not prove deployed grants, RLS, triggers, RPC behavior, or Auth-bound policy. Before production acceptance, execute a controlled staging and production verification plan with authenticated accounts and isolated test scenarios. Keep seed/demo data separate from release data.

## 8. Hosting, Domains, and Runtime Variables

### 8.1 Environment separation

Provision distinct variables/secrets for Local, Preview/Staging, and Production. Keep these values outside Git and restrict access by environment.

| Variable category | Local | Staging | Production |
| --- | --- | --- | --- |
| Public Supabase URL/publishable key | Development project only | Staging project only | Production project only |
| Supabase server secret/JWT material | Local secret store only | Staging secret store only | Production secret store only |
| Application URL/site URL | Loopback only | Staging HTTPS domain | Verified production HTTPS domain |
| Resend / Meta / Upstash secrets | Omit or disabled placeholders | Separate test credentials | Separate production credentials |
| Delivery posture | Disabled | Disabled until staging activation card passes | Disabled until production canary approval |

Never copy local `.env.local` to a hosted platform. Configure environment values through the approved hosting secret manager, scoped to the intended environment.

### 8.2 Hosting release prerequisites

Before any deployment:

- select hosting, production branch/promotion policy, preview/staging policy, and operator access model;
- establish verified HTTPS domain ownership and redirect/canonical-host rules;
- configure authentication redirect URLs and Supabase Auth settings per environment;
- verify CSP, HSTS, Origin/Host boundary, secret handling, error monitoring, and audit/log retention;
- define a deployment rollback mechanism that disables provider traffic before or with application rollback;
- run deployment smoke tests that do not send real external messages unless the provider activation canary has already been approved.

## 9. Provider-Specific Preconditions

### 9.1 Resend

Before production email:

1. Create a production Resend account/project and a least-privilege sending key restricted to the verified sending domain when possible.
2. Verify the owned sending domain and exact DNS records (SPF/DKIM; assess DMARC) with the DNS owner.
3. Establish approved sender, reply-to, template/content, recipient-consent, suppression, and volume policies.
4. Store the key only in the production secret manager.
5. Perform an approved staging/test-recipient and then limited production-canary delivery with observability and rollback.

Official references:

- https://resend.com/docs/add-a-domain
- https://resend.com/docs/create-an-api-key
- https://resend.com/docs/api-reference/emails/send-email

### 9.2 Meta WhatsApp Cloud API

Before production WhatsApp:

1. Complete Meta developer/business setup and connect the approved WhatsApp Business Account and phone number.
2. Create a least-privilege permanent system-user token with approved permissions and documented rotation/expiry practice.
3. Obtain approved message templates and establish consent/opt-in, recipient, localization, and 24-hour-window policy.
4. Deploy the signed, replay-safe public webhook handler over verified HTTPS before registering the callback.
5. Configure and test webhook subscription, signature validation, receipt state mapping, rate limits, and kill switch using approved test recipients.

Official references:

- https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started/
- https://developers.facebook.com/docs/whatsapp/webhooks/reference

### 9.3 Upstash QStash / Workflow

Before production scheduler/processor activation:

1. Create separate staging and production QStash resources/tokens.
2. Implement and test signature verification against the exact raw request body and expected destination URL.
3. Define explicit schedule IDs, cadence, timezone, retries, DLQ ownership, maximum concurrency, timeout, and disable/delete procedure.
4. Run a staging-only signed invocation before production schedule creation.
5. Create a production canary schedule only after handler, monitoring, and rollback acceptance.

Official references:

- https://upstash.com/docs/qstash/howto/signature
- https://upstash.com/docs/qstash/features/schedules
- https://upstash.com/docs/qstash/howto/receiving

## 10. Release Gates and Evidence Matrix

| Gate | Minimum evidence | Blocking condition |
| --- | --- | --- |
| G0 — Activation decision | Accepted ADR/runbook, explicit scope and owner | Credentials/config alone are proposed as activation. |
| G1 — Code | Reviewed server-only adapters/routes/workflows, focused negative tests, no historical replay path | Provider call, endpoint, or scheduler exists without signature/idempotency/rollback design. |
| G2 — Data plane | Staging migration history, RLS/RPC/Auth integration evidence, type provenance | Schema was edited remotely outside migrations or security behavior is unproven. |
| G3 — Provider readiness | Verified domain/account/templates/secrets, approved test recipients, kill switch | Production credential is missing, shared across environments, or untracked. |
| G4 — Staging | HTTPS endpoint, signed/webhook smoke, controlled canary, observability, rollback | Any unexpected delivery, unsafe log, unauthorized response, or duplicate transition. |
| G5 — Production | Owner approval, exact deployment/version provenance, limited canary, monitored results | No rollback/disable path, no production release approval, or evidence is incomplete. |

## 11. Rollback and Emergency Disable Contract

Future provider activation must include a tested response that:

1. Stops new external provider calls immediately through an explicit server-side delivery posture/kill switch.
2. Disables/deletes active schedules and rejects provider endpoint traffic safely where appropriate.
3. Does not mutate already terminal `suppressed` records into a queued/retry state.
4. Preserves audit evidence and safe error handling without logging secrets or provider payloads.
5. Rotates suspected secrets through the provider/hosting secret manager and records the incident.
6. Separates application rollback from database rollback; no destructive database rollback without its own reviewed plan.

## 12. Current Decisions and Next Update Trigger

This document must be revised when any of the following happens:

- an activation ADR/runbook is accepted;
- concrete provider adapter, webhook, workflow, or scheduler work is planned;
- staging/production Supabase or hosting release ownership is assigned;
- DNS/domain, provider account, template, or secret-management decisions are made;
- the test/CI environment contract is normalized;
- a provider/API/platform policy changes materially.

Until then, the safe and intended project state remains: **development capability complete; external providers, public endpoints, scheduling, and production release inactive.**

## 13. Official Platform References

- Next.js environment variables: https://nextjs.org/docs/app/guides/environment-variables
- Next.js non-standard `NODE_ENV`: https://nextjs.org/docs/messages/non-standard-node-env
- Supabase database migrations: https://supabase.com/docs/guides/deployment/database-migrations
- Supabase environment management: https://supabase.com/docs/guides/deployment/managing-environments
- Vercel environments and variables: https://vercel.com/docs/deployments/environments and https://vercel.com/docs/environment-variables
- Resend: links in §9.1
- Meta WhatsApp: links in §9.2
- Upstash QStash: links in §9.3

Platform documentation is volatile. Reconfirm these sources and the applicable provider terms/limits immediately before each gated activation action.
