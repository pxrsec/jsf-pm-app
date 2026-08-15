---
schema_version: 1
spec_id: S01-E01-F01
feature_slug: localized-public-application-shell
sprint: S01
epic: E01
feature: F01
status: in-spec-review
version: 0.1
created: 2026-08-15
updated: 2026-08-15
author_profile: architect
risk: medium
branch: feature/s01-e01-01-localized-public-application-shell
sources:
  - /c/Users/ruben/Desktop/jsf-app-dev-project/jsf-wiki/raw/articles/adr-021-2026-08-14-localized-public-shell-i18n-decisions.md
related_adrs:
  - ADR-021
supersedes: []
superseded_by: null
---

# Spec: Localized Public Application Shell

## 1. Objective

Establish the localized public application shell for the Joya Star Films Project Management App using `next-intl`. The shell provides Spanish (`es-MX`) as the default locale served without a URL prefix at canonical routes `/` and `/privacidad`, and English (`en-US`) as the secondary locale served only under `/en/` and `/en/privacidad`. The shell includes locale-aware routing, message catalogs with semantic translation keys, sitemap generation reflecting canonical routes, and focused verification tests proving locale rendering behavior.

## 2. Source Requirements

| REQ ID | Normative requirement | Exact source | Notes / interpretation |
|---|---|---|---|
| REQ-I18N-001 | The application shell MUST serve Spanish (`es-MX`) as the default locale without a locale prefix. | ADR-021 §1.1 | Canonical Spanish routes are `/` and `/privacidad`. |
| REQ-I18N-002 | The application shell MUST serve English (`en-US`) only under the `/en/` locale prefix. | ADR-021 §1.2-1.3 | Canonical English routes are `/en/` and `/en/privacidad`. |
| REQ-I18N-003 | The application shell MUST NOT create a public `/es-MX/` alias route. | ADR-021 §1.4 | A future alias requires its own accepted decision. |
| REQ-I18N-004 | Locale negotiation and routing MUST preserve the canonical mapping and reject unsupported locale segments through the application's normal not-found behavior. | ADR-021 §1.5 | No redirect from `/` to `/es-MX/`. |
| REQ-I18N-005 | The `robots.txt` and sitemap MUST reflect the current non-production posture while listing only the canonical public routes defined in REQ-I18N-001 and REQ-I18N-002. | ADR-021 §1.6 | Non-production posture means `disallow: /` in robots and appropriate sitemap entries. |
| REQ-I18N-006 | Message catalogs MUST be `messages/es-MX.json` and `messages/en-US.json` with identical JSON structure and complete key sets for every user-facing shell string. | ADR-021 §2.1-2.2 | Both catalogs must have the same keys. |
| REQ-I18N-007 | Translation keys MUST be semantic, stable, dot-delimited, and lower camel case by segment. They MUST identify a UI concept, not a visual position, route, locale, typography rule, or source-language sentence. | ADR-021 §2.3 | Example: `shell.header.brandName`, not `shell.topLeft.logo`. |
| REQ-I18N-008 | Translation key namespaces MUST be bounded by feature/domain. Initial public-shell namespaces are `shell` and `privacy`. | ADR-021 §2.4 | Keys prefixed with `shell.` or `privacy.`. |
| REQ-I18N-009 | Spanish MUST be the product source language for visible copy. English is the translated catalog. Code, identifiers, filenames, and test descriptions remain English. | ADR-021 §2.5 | Visible copy originates in Spanish. |
| REQ-I18N-010 | User-visible shell text MUST come from message catalogs. Visible shell text MUST NOT be hardcoded in React/Next components. | ADR-021 §2.6 | Components use `useTranslations()` or equivalent. |

## 3. In Scope

- Next.js App Router locale-aware routing with `next-intl` middleware
- Message catalogs at `messages/es-MX.json` and `messages/en-US.json` with keys under `shell` and `privacy` namespaces
- Canonical routes: `/`, `/privacidad`, `/en/`, `/en/privacidad`
- Locale middleware that enforces canonical mapping and rejects unsupported locales via not-found
- Sitemap generation (`app/sitemap.ts`) listing only canonical public routes
- Robots configuration (`app/robots.ts`) with non-production posture
- Root layout and page components consuming translations via `next-intl`
- Privacy page component at `/privacidad` and `/en/privacidad`
- Focused verification tests proving Spanish at `/` and English at `/en/`
- TypeScript types for message catalog structure

## 4. Out of Scope

- Authenticated/application routes (invite-token auth, dashboard, project workspace)
- `/es-MX/` alias route or redirect from `/` to `/es-MX/`
- Additional locales beyond `es-MX` and `en-US`
- WhatsApp/email notification integration
- Admin operational views
- Database schema changes (selected route: non-schema)
- Server-side Supabase/RLS/RPC changes
- Production deployment configuration
- Legal/privacy policy content beyond placeholder notice

## 5. Existing-System Constraints

- Next.js 16.3.0 with App Router (package.json)
- `next-intl` 4.13.5 already installed (package.json)
- React 19.2.4, TypeScript 5.x
- Tailwind CSS v4 configured
- Existing `src/app/layout.tsx` and `src/app/page.tsx` are baseline Next.js scaffold
- No existing `messages/` directory or locale middleware
- No existing sitemap/robots configuration
- Project uses `@/*` import alias rooted at `src/`
- Feature components in route-local `_components/`, shared in `src/components/shared/`, shadcn primitives in `src/components/ui/`
- Implementation files at or below 400 lines

## 6. Data and API Contracts

No contract change. This specification does not modify database schema, RPC functions, RLS policies, or Supabase Edge Functions. The `next-intl` configuration and message catalogs are file-based. The middleware reads `Accept-Language` header and URL pathname for locale negotiation. No new API routes are introduced.

## 7. Security and Authorization

Not applicable — this is a public shell with no authentication, authorization, or sensitive data handling. No audit controls required. No SecOps review required. The non-production robots posture is a deliberate operational control.

## 8. Error and Edge-Case Behavior

| Scenario | Behavior |
|---|---|
| Unsupported locale segment (e.g., `/fr/`, `/es-MX/`) | Normal not-found behavior (Next.js 404 page) |
| Missing translation key in catalog | `next-intl` development warning; production fallback to key path |
| Middleware matcher misconfiguration | Route falls through to not-found; test coverage catches regression |
| `Accept-Language` header absent or malformed | Default to `es-MX` (Spanish) |
| Concurrent requests with different locales | Stateless middleware; each request resolved independently |

## 9. Verification Criteria

| VC ID | REQ ID(s) | Required behavior | Verification mode | Planned verification method | Source |
|---|---|---|---|---|---|
| VC-I18N-001 | REQ-I18N-001 | `GET /` returns 200 with Spanish shell content from `messages/es-MX.json` | strict-test-first | Vitest + React Testing Library: render root page, assert Spanish strings from catalog present | ADR-021 §1.1 |
| VC-I18N-002 | REQ-I18N-002 | `GET /en/` returns 200 with English shell content from `messages/en-US.json` | strict-test-first | Vitest + RTL: render `/en/` page, assert English strings from catalog present | ADR-021 §1.2-1.3 |
| VC-I18N-003 | REQ-I18N-003 | `GET /es-MX/` returns 404 (not-found) | strict-test-first | Vitest + SuperTest/Next.js test utils: request `/es-MX/`, assert 404 | ADR-021 §1.4 |
| VC-I18N-004 | REQ-I18N-004 | `GET /fr/` returns 404; `GET /de/privacidad` returns 404 | strict-test-first | Vitest: request unsupported locale segments, assert 404 | ADR-021 §1.5 |
| VC-I18N-005 | REQ-I18N-005 | `GET /sitemap.xml` lists only `/`, `/privacidad`, `/en/`, `/en/privacidad` with correct `alternates` | strict-test-first | Vitest: parse sitemap XML, assert exact route set | ADR-021 §1.6 |
| VC-I18N-006 | REQ-I18N-005 | `GET /robots.txt` contains `User-agent: *` and `Disallow: /` | strict-test-first | Vitest: fetch robots.txt, assert non-production posture | ADR-021 §1.6 |
| VC-I18N-007 | REQ-I18N-006 | Both `messages/es-MX.json` and `messages/en-US.json` exist, have identical key sets, and all keys are non-empty strings | strict-test-first | Vitest: read both JSON files, deep-equal key sets, assert non-empty values | ADR-021 §2.1-2.2 |
| VC-I18N-008 | REQ-I18N-007, REQ-I18N-008 | All translation keys match regex `^[a-z]+(\.[a-z][a-zA-Z0-9]*)+$` and are prefixed with `shell.` or `privacy.` | strict-test-first | Vitest: iterate all keys in catalogs, assert naming convention | ADR-021 §2.3-2.4 |
| VC-I18N-009 | REQ-I18N-010 | No user-visible text in `src/app/**/*.tsx` (shell components) is hardcoded; all visible strings come from `useTranslations()` | verification-first | Manual code review + grep for string literals in JSX; verify `useTranslations` usage | ADR-021 §2.6 |
| VC-I18N-010 | REQ-I18N-001, REQ-I18N-002 | `GET /privacidad` returns 200 with Spanish privacy content; `GET /en/privacidad` returns 200 with English privacy content | strict-test-first | Vitest + RTL: render privacy pages, assert translated strings | ADR-021 §1.1-1.3 |

## 10. Traceability Matrix

| REQ ID | VC ID | Verification mode | TC ID / procedure | Test or evidence path | Implementation location | RED baseline | GREEN / verification evidence | Review / FIND refs | Status |
|---|---|---|---|---|---|---|---|---|---|
| REQ-I18N-001 | VC-I18N-001 | strict-test-first | pending | `__tests__/i18n/spanish-shell.test.tsx` | `src/app/[locale]/page.tsx` | pending | pending | pending | planned |
| REQ-I18N-002 | VC-I18N-002 | strict-test-first | pending | `__tests__/i18n/english-shell.test.tsx` | `src/app/[locale]/page.tsx` | pending | pending | pending | planned |
| REQ-I18N-003 | VC-I18N-003 | strict-test-first | pending | `__tests__/i18n/unsupported-locale.test.tsx` | `middleware.ts` | pending | pending | pending | planned |
| REQ-I18N-004 | VC-I18N-004 | strict-test-first | pending | `__tests__/i18n/unsupported-locale.test.tsx` | `middleware.ts` | pending | pending | pending | planned |
| REQ-I18N-005 | VC-I18N-005 | strict-test-first | pending | `__tests__/i18n/sitemap.test.ts` | `src/app/sitemap.ts` | pending | pending | pending | planned |
| REQ-I18N-005 | VC-I18N-006 | strict-test-first | pending | `__tests__/i18n/robots.test.ts` | `src/app/robots.ts` | pending | pending | pending | planned |
| REQ-I18N-006 | VC-I18N-007 | strict-test-first | pending | `__tests__/i18n/message-catalogs.test.ts` | `messages/es-MX.json`, `messages/en-US.json` | pending | pending | pending | planned |
| REQ-I18N-007, REQ-I18N-008 | VC-I18N-008 | strict-test-first | pending | `__tests__/i18n/key-naming.test.ts` | `messages/es-MX.json`, `messages/en-US.json` | pending | pending | pending | planned |
| REQ-I18N-009 | VC-I18N-009 | verification-first | pending | Manual review evidence | `src/app/**/*.tsx` (shell) | pending | pending | pending | planned |
| REQ-I18N-010 | VC-I18N-010 | strict-test-first | pending | `__tests__/i18n/privacy-page.test.tsx` | `src/app/[locale]/privacidad/page.tsx` | pending | pending | pending | planned |

## 11. Observability and Audit Requirements

No new observability or audit requirement. The public shell has no authenticated operations, mutations, or sensitive data flows.

## 12. Implementation Constraints

- Use `next-intl` middleware for locale detection and routing (not custom middleware)
- Message catalogs in `messages/` directory at repository root (standard `next-intl` convention)
- Locale segment in route: `src/app/[locale]/` for localized routes
- Default locale (`es-MX`) served at root via middleware rewrite, not via `[locale]` segment
- Components consume translations via `useTranslations('shell')` and `useTranslations('privacy')`
- Sitemap uses `next-sitemap` or Next.js built-in `MetadataRoute.Sitemap` API
- Robots uses Next.js built-in `MetadataRoute.Robots` API
- TypeScript types for message catalog generated via `next-intl` types or manual declaration
- Do not modify `src/lib/database.types.ts` (generated source)
- No Prisma, no ORM, no schema migration (non-schema route)
- Only architect may apply migrations to `jsf-pm-dev` via Supabase MCP; not applicable here

## 13. Dependencies

| Dependency | Owner | Status | Impact / stop condition |
|---|---|---|---|
| ADR-021 approved and ingested | engineering-manager | ready | Blocks P1 if not approved |
| `next-intl` 4.x installed | fullstack-dispatcher | ready | Package.json confirms v4.13.5 |
| Next.js App Router baseline | fullstack-dispatcher | ready | Scaffold exists at `src/app/` |
| Test infrastructure (Vitest, RTL) | test-engineer | ready | Package.json confirms |

## 14. Open Questions and Required Decisions

| OQ ID | Question | Why it matters | Owner | Mode / stop condition |
|---|---|---|---|---|
| OQ-001 | Should the privacy page placeholder notice (`privacy.placeholderNotice`, `privacy.notLegalAdvice`) be included in this spec or deferred to a content-specific work item? | Affects message catalog completeness and test assertions | Project Owner | `non-blocking` — P2/downstream may proceed; placeholder text can be refined later |

## 15. Revision History

| Version | Date | Author / updater | Classification | Affected IDs | Gate impact | Summary |
|---|---|---|---|---|---|---|
| 0.1 | 2026-08-15 | architect | initial draft | REQ-I18N-001..010, VC-I18N-001..010 | none | Initial specification derived from ADR-021 decisions |