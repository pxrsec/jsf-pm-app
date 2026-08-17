---
schema_version: 1
spec_id: S01-E01-F02
feature_slug: runtime-config-and-supabase-client-boundary
sprint: S01
epic: E01
feature: F02
status: in-spec-review
version: 0.2
created: 2026-08-17
updated: 2026-08-17
author_profile: architect
risk: high
branch: feature/s01-e01-02-runtime-config-and-supabase-client-boundary
sources:
  - C:\Users\ruben\Desktop\jsf-app-dev-project\jsf-project-vault\project-docs\sprint-plans\s01-e01-application-foundation-and-ci-sprint-plan.md#s01-e01-02
  - C:\Users\ruben\Desktop\jsf-app-dev-project\jsf-pm-app\AGENTS.md#data-api-and-security-boundaries
  - Direct Project Owner instruction (2026-08-17): OQ-01 and OQ-02 resolutions
related_adrs: []
supersedes:
  - dev-docs/specs/s01/runtime-config-and-supabase-client-boundary-v0.1.md
superseded_by: null
---

# Spec: Runtime Configuration and Supabase Client Boundary

## 1. Objective

Provide a fail-closed configuration boundary and typed Supabase client factories without querying or mutating application data. Public configuration is safe for browser use; server-only configuration and privileged Supabase access remain isolated from client, shared, and middleware code. No real credential enters a tracked artifact, test fixture, output, or browser bundle.

## 2. Source Requirements

| REQ ID | Normative requirement | Exact source | Notes / interpretation |
|---|---|---|---|
| REQ-CFG-001 | The application MUST provide `src/config/app.config.ts` as the single public configuration boundary. It MUST export only values derived from explicitly `NEXT_PUBLIC_*` variables and MUST NOT import, validate, or expose server-only values. | `s01-e01-application-foundation-and-ci-sprint-plan.md#s01-e01-02`; `AGENTS.md#data-api-and-security-boundaries` | This module is permitted in browser code because it has no server-only dependency. |
| REQ-CFG-002 | `app.config.ts` MUST require a non-empty `NEXT_PUBLIC_APP_URL`. Presence is sufficient; it MUST NOT reject the value based on URL parsing or URL-format validation. | Direct Project Owner instruction (2026-08-17), OQ-01 resolution | This resolves OQ-01 and succeeds the v0.1 default format-validation assumption. |
| REQ-CFG-003 | `app.config.ts` MUST require a valid public HTTPS `NEXT_PUBLIC_SUPABASE_URL` and a non-empty `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; failure MUST be safe and non-leaking. | `s01-e01-application-foundation-and-ci-sprint-plan.md#s01-e01-02`; `AGENTS.md#data-api-and-security-boundaries` | The URL is an external endpoint used by the Supabase clients; the publishable key is browser-visible by design. |
| REQ-CFG-004 | A server-only configuration boundary MUST validate `SUPABASE_SECRET_KEY` synchronously when that server-only boundary is loaded for a privileged operation, fail closed when absent or invalid, and never export the secret through `app.config.ts` or any shared module. | `s01-e01-application-foundation-and-ci-sprint-plan.md#s01-e01-02`; `.env.example#supabase` | The template states the secret is required only by narrowly isolated privileged/admin operations. This requirement does not impose process-wide startup failure when no privileged operation is imported. |
| REQ-CFG-005 | Configuration failure and diagnostic behavior MUST not disclose a secret value, raw environment dump, stack trace, provider payload, or internal authorization detail. | `AGENTS.md#data-api-and-security-boundaries` | A stable safe error may identify the configuration boundary or a public variable name, but not a secret value. |
| REQ-CFG-006 | No real environment value, credential, or provider key MUST enter a committed file, test fixture, test output, application log, error response, browser bundle, or external telemetry payload. | `s01-e01-application-foundation-and-ci-sprint-plan.md#s01-e01-02`; `AGENTS.md#data-api-and-security-boundaries` | `.env.example` remains a variable-name/placeholder template only. |
| REQ-SUP-001 | The application MUST provide a browser Supabase client factory under RLS using `createBrowserClient` from `@supabase/ssr` and only the public Supabase configuration values. It MUST NOT import `next/headers` or a server cookie store. | `s01-e01-application-foundation-and-ci-sprint-plan.md#s01-e01-02`; installed `@supabase/ssr` 0.12.4 `createBrowserClient.d.ts` | Browser cookie behavior is supplied by the browser-capable `@supabase/ssr` API; no server cookie API belongs in this module. |
| REQ-SUP-002 | The application MUST provide a request-context server Supabase client factory under RLS using `createServerClient` from `@supabase/ssr`, public Supabase configuration values, and the request cookie adapter required by that API. | `s01-e01-application-foundation-and-ci-sprint-plan.md#s01-e01-02`; installed `@supabase/ssr` 0.12.4 `createServerClient.d.ts` | The server cookie adapter must satisfy the installed API's non-deprecated `getAll`/`setAll` contract. |
| REQ-SUP-003 | The application MUST provide a narrowly isolated privileged Supabase client factory using `@supabase/supabase-js` and `SUPABASE_SECRET_KEY`; it MUST be server-only and MUST NOT perform a query or mutation in this work item. | `s01-e01-application-foundation-and-ci-sprint-plan.md#s01-e01-02`; `AGENTS.md#data-api-and-security-boundaries` | Its elevated authority is a security boundary, not an authorization-neutral utility. |
| REQ-SUP-004 | Neither the privileged factory nor the server-only configuration boundary MAY be imported by a client component, shared module, middleware, or browser bundle. The repository MUST enforce this boundary structurally and verify it. | `s01-e01-application-foundation-and-ci-sprint-plan.md#s01-e01-02`; `AGENTS.md#data-api-and-security-boundaries` | Server-only route handlers, server actions, and workflows are permitted consumers when later work explicitly needs privileged access. |
| REQ-TST-001 | The selected evidence MUST cover valid and invalid configuration, safe/redacted configuration failure, expected factory selection, privileged-boundary isolation, and absence of real credential exposure without using real credentials. | `s01-e01-application-foundation-and-ci-sprint-plan.md#s01-e01-02` | Test ownership remains with test-engineer under the assigned VSDD/TDD route. |
| REQ-TST-002 | A repository guard or focused verification MUST reject runtime Prisma imports in application code, including shared modules. | `s01-e01-application-foundation-and-ci-sprint-plan.md#s01-e01-02` | Retained unchanged from v0.1. |
| REQ-TST-003 | Prisma MUST be absent from the project: no runtime import, dependency, Prisma schema, Prisma migration, migration command, generated Prisma client, or alternative ORM/schema-migration system may be introduced. Supabase migrations under `supabase/migrations/` are the sole versioned schema source. | Direct Project Owner instruction (2026-08-17), OQ-02 resolution; `AGENTS.md#architecture-and-implementation-rules`; `AGENTS.md#data-api-and-security-boundaries` | This new requirement supersedes REQ-TST-002's narrower v0.1 scope; REQ-TST-002 remains a subset guard. |

## 3. In Scope

- Public configuration at `src/config/app.config.ts` and a separate server-only configuration boundary.
- Validation, safe failure, and redaction behavior for the configuration boundary.
- Browser, request-context server, and server-only privileged Supabase client factories.
- Structural enforcement and verification of server-only privileged imports.
- Focused test/evidence selection for the stated configuration and client-boundary behavior.
- Static verification that Prisma and any parallel ORM/schema-migration system are absent.

## 4. Out of Scope

- Supabase migrations, RLS policies, RPCs, tables, views, functions, triggers, constraints, generated database types, or remote database state.
- Auth flows, invitations, sessions, user provisioning, route authorization behavior, or client-factory database operations.
- Provider provisioning, real credentials, external account configuration, deployments, DNS, or real outbound messages.
- Service workers, offline caching, deferred mutation queues, Playwright E2E automation, public signup, broad CORS, or a replacement ORM/migration system.
- Security headers, Sentry initialization, and structured logging beyond configuration-safe error behavior; those belong to S01-E01-03.

## 5. Existing-System Constraints

- This is a non-schema work item; database mutation and generated-type changes are prohibited. Source: `s01-e01-application-foundation-and-ci-sprint-plan.md#non-schema-route-and-exclusions`.
- The assigned branch is `feature/s01-e01-02-runtime-config-and-supabase-client-boundary`, verified current on 2026-08-17 before this revision.
- `package.json` declares Next.js 16.3.0, `@supabase/ssr` 0.12.4, `@supabase/supabase-js` 2.112.2, Zod 3.25.76, and Vitest 4.1.10.
- Installed `@supabase/ssr` 0.12.4 documents browser cookie handling without `next/headers` and requires a server cookie adapter for `createServerClient`.
- `eslint.config.mjs` currently has no boundary or Prisma restriction; the required guard is planned work, not an existing control.
- `AGENTS.md` prohibits runtime Prisma and any other ORM/schema-migration system; Supabase migrations are the sole versioned schema source.

## 6. Data and API Contracts

No contract change. This work introduces internal configuration and client-factory interfaces only; it creates no API route, no application data effect, no schema change, and no migration.

Public configuration contract:

| Input | Consumer | Required behavior | Exposure |
|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `app.config.ts` | Required non-empty value; no format validation | Browser-visible |
| `NEXT_PUBLIC_SUPABASE_URL` | public browser/server client configuration | Required valid public HTTPS URL | Browser-visible |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public browser/server client configuration | Required non-empty value | Browser-visible |
| `SUPABASE_SECRET_KEY` | privileged server-only factory/configuration boundary | Required only when that boundary is loaded; never exported publicly | Server-only |

Compatibility and forward correction: no existing configuration interface is changed because the sprint baseline states that no runtime config module or Supabase client factory exists. Any discovered schema/RLS need is a stop condition requiring a separately routed schema work item.

## 7. Security and Authorization

- The privileged client is a high-risk server-only authority boundary. It is not importable by client, shared, or middleware code and has no query/mutation behavior in this work item.
- Browser and request-context server clients use only publishable credentials and operate under RLS.
- A public configuration module cannot import server-only configuration or secret-bearing code.
- Safe errors and diagnostics must not leak secret values, raw environment content, provider payloads, stacks, or authorization internals.
- Real values are prohibited from committed files, fixtures, output, logs, browser bundles, and telemetry.
- SecOps review is required by the normal P5 route because this work defines a privileged-access and secret-isolation boundary.

## 8. Error and Edge-Case Behavior

| Scenario | Required behavior |
|---|---|
| `NEXT_PUBLIC_APP_URL` is absent or empty | Public configuration load fails safely; it does not perform URL-format validation. |
| `NEXT_PUBLIC_SUPABASE_URL` is absent, non-HTTPS, or malformed | Public configuration load fails safely without disclosing unrelated environment values. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is absent or empty | Public configuration load fails safely without exposing server-only configuration. |
| `SUPABASE_SECRET_KEY` is absent or invalid when privileged configuration/factory is loaded | The server-only boundary fails closed before creating a privileged client; no secret value or stack is returned. |
| A client component, shared module, middleware, or browser entry imports the privileged factory or server-only config | The structural import guard fails verification/build; the import is not bundled for the browser. |
| A diagnostic receives a configuration object containing secret-like data | Output is redacted and does not serialize a secret value or raw environment dump. |
| A tracked source, dependency, schema, migration tool, or command introduces Prisma or another ORM/schema-migration system | Static repository verification fails; the change is not accepted. |
| A test attempts to use a real credential | The test fixture is rejected by repository verification; selected tests use synthetic values only. |

## 9. Minimum Evidence Plan and Verification Criteria

| VC ID | REQ ID(s) | Required behavior | Evidence selection | Evidence unit / planned method | Selection rationale | Source |
|---|---|---|---|---|---|---|
| VC-CFG-001 | REQ-CFG-001, REQ-CFG-002, REQ-CFG-003 | Public config exports only public values; `NEXT_PUBLIC_APP_URL` is presence-only; Supabase public inputs fail safely when invalid. | strict-test-first | `TC-CFG-001` — `npm run test -- __tests__/config/app.config.test.ts`; isolate module loading with synthetic public environment values. | The browser-safe/public configuration boundary and resolved APP_URL rule are deterministic security-sensitive behavior. | Sprint plan `#s01-e01-02`; PO OQ-01 resolution |
| VC-CFG-002 | REQ-CFG-004, REQ-CFG-005 | Server-only privileged configuration fails closed when needed and safe diagnostics do not disclose secret values. | strict-test-first | `TC-CFG-002` — `npm run test -- __tests__/config/server.config.test.ts`; load only the server boundary with synthetic values and assert safe failure. | Secret isolation and privileged startup behavior are critical boundaries. | Sprint plan `#s01-e01-02`; `AGENTS.md#data-api-and-security-boundaries` |
| VC-CFG-003 | REQ-CFG-006 | No real values appear in tracked source, fixtures, or selected output artifacts. | static-repository-check | Deterministic tracked-file inspection using `git grep` with an explicit allowlist of placeholder/template content; retained task evidence records command, scope, and expected zero prohibited matches. | A static review is more credible than attempting to manufacture real credential data in a test. | Sprint plan `#s01-e01-02`; `AGENTS.md#data-api-and-security-boundaries` |
| VC-SUP-001 | REQ-SUP-001 | Browser factory selects `createBrowserClient` with public config and has no `next/headers` dependency. | focused-automated-test | `TC-SUP-001` — `npm run test -- __tests__/supabase/browser.test.ts`; mock factory seam and module dependencies. | One focused regression check covers factory selection and client-context isolation. | Sprint plan `#s01-e01-02`; installed `createBrowserClient.d.ts` |
| VC-SUP-002 | REQ-SUP-002 | Server factory selects `createServerClient` with public config and required request cookie adapter. | focused-automated-test | `TC-SUP-002` — `npm run test -- __tests__/supabase/server.test.ts`; mock the SSR client seam and request cookie adapter. | One focused regression check covers the distinct request-context factory contract. | Sprint plan `#s01-e01-02`; installed `createServerClient.d.ts` |
| VC-SUP-003 | REQ-SUP-003, REQ-SUP-004 | Privileged factory uses the server-only secret boundary and cannot be reached from client/shared/middleware/browser paths. | strict-test-first + static-repository-check | `TC-SUP-003` — `npm run test -- __tests__/supabase/admin.test.ts`; plus `npm run lint` after a deterministic import-restriction rule is added. | Elevated credential use and import isolation are critical security behavior; the test and structural guard cover complementary failure modes. | Sprint plan `#s01-e01-02`; `AGENTS.md#data-api-and-security-boundaries` |
| VC-TST-001 | REQ-TST-001 | Selected tests/evidence cover the named valid, invalid, redaction, factory, isolation, and non-exposure behavior. | covered-by-shared-evidence | TC-CFG-001, TC-CFG-002, TC-SUP-001, TC-SUP-002, TC-SUP-003, and VC-CFG-003. | No separate test adds credible coverage beyond the selected focused units. | Sprint plan `#s01-e01-02` |
| VC-TST-002 | REQ-TST-002, REQ-TST-003 | Prisma and any parallel ORM/schema-migration system are absent from the specified repository surfaces. | static-repository-check | `npm run lint` for forbidden runtime imports plus deterministic repository inspection of dependency manifests/lockfile, `prisma/`, `supabase/migrations/`, and package scripts. | The Project Owner's absolute-removal decision is a structural repository invariant; one scoped static procedure credibly verifies all affected surfaces. | PO OQ-02 resolution; `AGENTS.md#architecture-and-implementation-rules`; `AGENTS.md#data-api-and-security-boundaries` |

## 10. Traceability Matrix

| REQ ID | VC ID | Evidence selection | TC ID / procedure / covering evidence | Test or evidence path | Implementation location | RED baseline | GREEN / verification evidence | Review / FIND refs | Status |
|---|---|---|---|---|---|---|---|---|---|
| REQ-CFG-001 | VC-CFG-001 | strict-test-first | TC-CFG-001 | `__tests__/config/app.config.test.ts` | `src/config/app.config.ts` | pending | pending | FIND-002, FIND-008 corrective input | planned |
| REQ-CFG-002 | VC-CFG-001 | strict-test-first | TC-CFG-001 | `__tests__/config/app.config.test.ts` | `src/config/app.config.ts` | pending | pending | FIND-008 resolved by PO | planned |
| REQ-CFG-003 | VC-CFG-001 | strict-test-first | TC-CFG-001 | `__tests__/config/app.config.test.ts` | `src/config/app.config.ts` | pending | pending | none | planned |
| REQ-CFG-004 | VC-CFG-002 | strict-test-first | TC-CFG-002 | `__tests__/config/server.config.test.ts` | server-only config boundary | pending | pending | FIND-002 corrective input | planned |
| REQ-CFG-005 | VC-CFG-002 | strict-test-first | TC-CFG-002 | `__tests__/config/server.config.test.ts` | configuration error/redaction boundary | pending | pending | none | planned |
| REQ-CFG-006 | VC-CFG-003 | static-repository-check | tracked-file procedure | retained task evidence | tracked repository surfaces | pending | pending | none | planned |
| REQ-SUP-001 | VC-SUP-001 | focused-automated-test | TC-SUP-001 | `__tests__/supabase/browser.test.ts` | `src/lib/supabase/browser.ts` | pending | pending | FIND-009 resolved | planned |
| REQ-SUP-002 | VC-SUP-002 | focused-automated-test | TC-SUP-002 | `__tests__/supabase/server.test.ts` | `src/lib/supabase/server.ts` | pending | pending | none | planned |
| REQ-SUP-003 | VC-SUP-003 | strict-test-first + static-repository-check | TC-SUP-003 + import guard | `__tests__/supabase/admin.test.ts`; lint configuration | server-only privileged factory | pending | pending | FIND-006 corrective input | planned |
| REQ-SUP-004 | VC-SUP-003 | strict-test-first + static-repository-check | TC-SUP-003 + import guard | `__tests__/supabase/admin.test.ts`; lint configuration | privileged and server-only import boundary | pending | pending | FIND-006, FIND-007 corrective input | planned |
| REQ-TST-001 | VC-TST-001 | covered-by-shared-evidence | selected shared units | shared | shared | pending | pending | none | planned |
| REQ-TST-002 | VC-TST-002 | static-repository-check | lint + repository procedure | lint configuration; retained task evidence | repository surfaces | pending | pending | FIND-007 corrective input | planned |
| REQ-TST-003 | VC-TST-002 | static-repository-check | lint + repository procedure | manifests, scripts, `prisma/`, `supabase/migrations/` | repository surfaces | pending | pending | PO OQ-02 resolution | planned |

## 11. Observability and Audit Requirements

No new telemetry, audit event, or external log sink is introduced. Retained task evidence for the selected static procedures must record only commands, scope, pass/fail result, and redacted findings; it must not contain real values, raw environment content, or secrets.

## 12. Implementation Constraints

- Use Zod where the stated configuration contract requires schema validation.
- Keep `app.config.ts` browser-safe: it may not import server-only modules, `SUPABASE_SECRET_KEY`, or `next/headers`.
- Implement server-only configuration separately from `app.config.ts`; it is loaded only by the privileged boundary and validates synchronously at that boundary's module load.
- The browser factory uses the installed `@supabase/ssr` browser API and must not use `cookies()` from `next/headers`.
- The server factory uses the installed `@supabase/ssr` server API with its required request cookie adapter; do not use deprecated cookie methods.
- The privileged factory uses the installed `@supabase/supabase-js` API, stays server-only, and makes no remote call in this work item.
- Add the smallest deterministic repository control needed to reject prohibited privileged imports and Prisma runtime imports; do not disable TypeScript or lint rules to pass it.
- Do not modify `src/lib/database.types.ts`, add a migration, apply a migration, access Supabase MCP, use Prisma, add another ORM, or add another migration system.

## 13. Dependencies

| Dependency | Owner | Status | Impact / stop condition |
|---|---|---|---|
| S01-E01-01 integrated test runtime | prior work-item route | required | P3 must block if the approved Vitest test seam cannot execute. |
| Installed package versions and documented SSR APIs | repository baseline | verified | The selected factory requirements are tied to installed `@supabase/ssr` 0.12.4 behavior. |
| Project Owner OQ-01 resolution | Project Owner | resolved | Presence-only `NEXT_PUBLIC_APP_URL` behavior is fixed by this revision. |
| Project Owner OQ-02 resolution | Project Owner | resolved | Absolute Prisma removal is fixed by this revision. |
| No schema/RLS need discovered | implementation route | required | Any discovery requiring schema change stops this non-schema work item and requires a new schema-route decision. |

## 14. Open Questions and Required Decisions

None. OQ-01 and OQ-02 from v0.1 are resolved by the Direct Project Owner instruction dated 2026-08-17. No unresolved decision remains that blocks P2 or downstream work.

## 15. Revision History

| Version | Date | Author / updater | Classification | Affected IDs | Gate impact | Summary |
|---|---|---|---|---|---|---|
| 0.1 | 2026-08-17 | architect | initial submission | REQ-CFG-001..004, REQ-SUP-001..004, REQ-TST-001..002; existing VCs | P2 `needs-fixes` | Immutable predecessor; do not edit. |
| 0.2 | 2026-08-17 | architect | semantic corrective revision | REQ-CFG-001..006, REQ-SUP-001..004, REQ-TST-001..003; VC-CFG-001..003, VC-SUP-001..003, VC-TST-001..002 | Requires new P2 review | Separates public and server-only configuration; resolves OQ-01 and OQ-02; corrects browser cookie constraint; makes privileged isolation and negative paths explicit. |
