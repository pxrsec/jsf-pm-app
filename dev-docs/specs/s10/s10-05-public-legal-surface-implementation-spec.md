---
document_id: S10-05-PUBLIC-LEGAL-SURFACE-IMPLEMENTATION-SPEC-01
sprint_id: S10
epic_id: E10
work_items: [S10-05]
status: implementation-ready
created_at: 2026-09-02T15:48:30-06:00
target_environment: jsf-pm-dev
implementation_consumer: Antigravity
schema_baseline: []
required_forward_migration: []
generated_types: not-applicable
---

# S10-05 — Public Legal Surface

## 1. Authority, outcome, and boundary

This is the complete implementation authority for **S10-05 only**. It implements stable localized public routes for draft privacy and terms content, a reusable legal footer across the public/auth/recovery/invitation shell, and an intentionally non-production sitemap/robots reconciliation.

Authority precedence for this slice is: direct Project Owner instruction; ADR-025 public-legal decisions; the active E10 epic; the active S10 sprint plan; then this specification. The E10 epic and S10 plan expressly permit only **visibly draft** legal copy until stakeholder approval. That current, work-item-specific boundary controls the implementation posture; it does not represent ADR-025's eventual stakeholder-reviewed legal-text requirement as complete.

### Required outcome

- Public unauthenticated privacy and terms routes exist in both supported locales.
- A single accessible legal footer reaches both routes from every named public/auth/recovery/invitation/legal surface.
- An unauthenticated visitor can reach the minimal public landing and its legal footer; an active session still redirects to its role-default protected destination.
- Sitemap lists only canonical public routes, including both legal locations. `robots.txt` stays globally disallowing crawling in `jsf-pm-dev` while explicitly declaring the sitemap URL.
- The rendered legal content states that it is draft and pending stakeholder approval. It makes no claim of legal approval, publication on the production legal domain, compliance certification, or legal advice.

### Explicit exclusions

- No database, Supabase RPC, RLS, migration, generated-type, server-action, API, provider, deployment, DNS, domain, legal-review, or stakeholder-approval work.
- No public sign-up, authenticated application navigation change, protected-page footer, protected-data projection, contact/support form, cookie-consent system, analytics, telemetry, tracking pixels, or external link/provider integration.
- No production robots policy, domain routing, `joyastarfilms.com` provisioning, external redirects, or hosting claim.
- No substantive legal-policy invention. This slice provides clearly marked draft placeholders and stable locations only.

## 2. Migration and data conclusion

**No migration is required or authorized.** S10-05 is a route, static localized-copy, and metadata-route composition change. It consumes no persisted data, has no new data invariant, and does not alter the applied M01–M04 contracts or `src/lib/database.types.ts`.

Do not create speculative SQL, regenerate types, modify existing migrations, or inspect/use a privileged database client to implement this work item. A request for legal acceptance logging, consent persistence, cookie preferences, policy versioning, or legal-document audit evidence is a new data-policy decision and must stop this implementation for an approved follow-up specification.

## 3. Canonical public route contract

The existing `next-intl` convention is authoritative: Spanish (`es-MX`) is canonical without a locale prefix; English (`en-US`) is canonical under `/en`. The legal route slugs remain Spanish in both locale forms, matching the existing `/privacidad` route. Do not introduce `/es`, `/es-MX`, `/privacy`, `/terms`, `/en/privacy`, `/en/terms`, locale aliases, redirects, or duplicate content routes.

| Subject | Canonical Spanish | Canonical English | Access | Sitemap |
| --- | --- | --- | --- | --- |
| Public landing | `/` | `/en/` | Unauthenticated public; active session redirects to its role default | Yes |
| Privacy | `/privacidad` | `/en/privacidad` | Public, no session/database requirement | Yes |
| Terms | `/terminos` | `/en/terminos` | Public, no session/database requirement | Yes |
| Sign-in/recovery/invitation routes | Existing canonical routes only | Existing locale-prefixed form only | Existing behavior unchanged | No |
| All protected application routes | Existing guarded routes only | Existing locale-prefixed form only | Existing session/role guard unchanged | No |

Use `Link` from `@/i18n/routing` with pathname-only internal targets (`/privacidad`, `/terminos`, `/iniciar-sesion`) so the locale helper emits the correct canonical path. Do not concatenate `/en`, derive locale from headers, propagate search parameters, or carry invitation tokens into footer links. A footer click from `/invitacion?token=...` must navigate to a static legal route without preserving that token.

### Public landing behavior

`src/app/[locale]/page.tsx` currently redirects an unauthenticated visitor immediately to sign-in, despite the active sprint's explicit public-landing footer requirement. Replace only the no-session branch with a small static public landing surface: localized brand/product heading, concise beta/draft-safe description, one localized sign-in CTA, language/theme controls consistent with the current public auth shell, and the shared legal footer. Keep the existing active-session role-default redirect exactly intact. The landing must not fetch Supabase data beyond the existing optional-session check and must not reveal role, project, invitation, account, or other protected state.

## 4. Shared public-shell composition

Create a narrow, presentational shared component at:

```text
src/components/shared/public-shell/legal-footer.tsx
```

It must be a server-compatible component using the localized routing `Link` and `next-intl` translations. It accepts no user, session, token, pathname, role, or database props. It renders a semantic `<footer>` containing a labeled `<nav aria-label={...}>` with exactly two visible links: Privacy and Terms. Use the existing design tokens, visible keyboard focus treatment, and a compact mobile-first layout that wraps safely without horizontal page overflow.

The component is the sole owner of legal-link markup. Do not duplicate its links in forms, page cards, or protected navigation. It may be rendered only by the named public/auth/recovery/invitation/legal route pages below:

| Surface | Existing route module | Required placement |
| --- | --- | --- |
| Public landing | `src/app/[locale]/page.tsx` | Below the landing content, in a full-height column layout |
| Sign-in | `src/app/[locale]/iniciar-sesion/page.tsx` | Below the sign-in card; preserve language/theme controls and form behavior |
| Password reset request | `src/app/[locale]/restablecer-contrasena/page.tsx` | Below the reset form in the page column |
| Password update/recovery completion | `src/app/[locale]/actualizar-contrasena/page.tsx` | Below the update-password form; preserve existing authenticated recovery guard |
| Invitation completion | `src/app/[locale]/invitacion/page.tsx` | Below the invitation card; never receive or render the query token |
| Invalid/expired-link page | `src/app/[locale]/sesion-expirada/page.tsx` | Below the safe error card |
| Privacy | `src/app/[locale]/privacidad/page.tsx` | Below the legal content |
| Terms | `src/app/[locale]/terminos/page.tsx` | Below the legal content |

Do not add the footer to `(protected)` layouts, app navigation drawers, role shells, or any Admin/PM/Operator/Client workspace. This prevents legal-surface work from exposing protected navigation or broadening authenticated composition scope.

Each affected page must use a `min-h-screen flex flex-col` shell with a `flex-1` content region and a footer that remains reachable below content. Preserve each current route's session/redirect behavior, input/form state, callback URL, token handling, and existing language/theme controls. This is a containment/layout change, not an auth-flow refactor.

## 5. Legal-page content and metadata contract

### Draft-copy boundary

Replace the current privacy placeholder with structured but deliberately non-final content. Add a matching terms page. Both pages must include:

1. localized document title;
2. a conspicuous localized **draft / pending stakeholder approval** status notice;
3. localized explanatory text that the document is not final legal text and does not establish production legal approval;
4. only safe, non-substantive placeholder sections suitable for later replacement; and
5. the shared legal footer.

Do not state retention durations, lawful bases, processor/subprocessor lists, cookie categories, data-subject rights procedures, contact email, jurisdiction, binding terms, effective dates, consent obligations, or compliance certifications. Those are legal-policy content requiring stakeholder approval.

Use server-side `getTranslations` / `generateMetadata` for each legal route so title and description are localized from catalog keys. Metadata may identify the document as a draft; it must not claim it is an approved privacy notice or enforceable terms. Do not add canonical host metadata, Open Graph claims, external URLs, or production-domain assumptions.

### Message catalog contract

Add matching `legal` and `terms` namespaces to `messages/en-US.json` and `messages/es-MX.json`; retain or migrate the old `privacy` namespace only if its current keys become unused. Both catalogs must retain identical key trees. Use semantic keys, including at minimum:

```text
legal.footerNavLabel
legal.links.privacy
legal.links.terms
legal.draftBadge
legal.draftNotice
legal.backToSignIn
privacy.title
privacy.description
privacy.sections.placeholderTitle
privacy.sections.placeholderBody
terms.title
terms.description
terms.sections.placeholderTitle
terms.sections.placeholderBody
landing.title
landing.description
landing.signInAction
```

All visible footer text, route headings, draft status, descriptions, section labels, CTAs, document titles/descriptions, and accessible labels must come from catalogs. No hard-coded English or Spanish text is permitted in newly added/changed public-shell components. Existing unrelated hard-coded auth text is outside S10-05 unless an affected page must replace it to render a new legal-surface string.

## 6. Sitemap and robots reconciliation

Update `src/app/sitemap.ts` to return exactly the six canonical public URLs in the route matrix: `/`, `/en/`, `/privacidad`, `/en/privacidad`, `/terminos`, and `/en/terminos`. Every language-pair entry must retain reciprocal `alternates.languages` values. Use the existing environment-derived `NEXT_PUBLIC_BASE_URL` fallback convention; do not hard-code `joyastarfilms.com` or `app.joyastarfilms.com` in application source.

Do not add sign-in, reset/update-password, invitation, expired-link, API, protected, role, task, project, query-bearing, or alias routes to the sitemap. The sitemap lists public route policy; it does not prove a production host is configured.

Update `src/app/robots.ts` to retain the current non-production rule:

```text
userAgent: "*"
disallow: "/"
```

Add a `sitemap` declaration built from the same safe base-URL convention and `/sitemap.xml`. This makes the relationship explicit without authorizing crawling in `jsf-pm-dev`. Do not add an `allow` rule, environment switch, production-crawl branch, or conditional indexing behavior. A later production/deployment decision owns that policy.

Update the existing `__tests__/i18n/sitemap.test.ts` and `__tests__/i18n/robots.test.ts` expectations only to reflect the six-route public policy and sitemap declaration while preserving the no-crawl assertion. No broad test expansion is authorized.

## 7. Security, accessibility, and localization invariants

- Legal routes must be public server-rendered surfaces with no `requireSession`, role check, Supabase query, server action, direct table access, protected DTO, or sensitive request rendering.
- Legal/footer links are closed, local pathname targets. Never accept a URL, redirect, locale, token, or document identifier from browser input.
- The privacy and terms pages must not expose environment values, host configuration, auth state, invitation token/query text, error internals, contact data, project data, or any privileged navigation.
- Footer links must be keyboard reachable, visibly focused, and identified by a localized navigation label. Link text must not rely on color alone.
- The draft notice must be programmatically perceivable as status/informational content, remain readable in light/dark themes, and not imitate an approval badge.
- Mobile layouts must remain one-column, support 44px-or-larger practical link targets, wrap footer links safely, and avoid page-level horizontal scrolling.
- The locale switcher must preserve the equivalent legal pathname when used on privacy or terms pages. Its existing route-aware behavior is reused; do not create a second locale mechanism.

## 8. Affected-file plan

| File | Change |
| --- | --- |
| `src/components/shared/public-shell/legal-footer.tsx` | New reusable, localized presentational footer. |
| `src/app/[locale]/page.tsx` | Retain active-session redirect; render minimal no-session landing plus footer. |
| `src/app/[locale]/privacidad/page.tsx` | Replace isolated placeholder with localized draft privacy page and footer. |
| `src/app/[locale]/terminos/page.tsx` | New localized draft terms page and footer. |
| `src/app/[locale]/iniciar-sesion/page.tsx` | Add full-height footer composition only. |
| `src/app/[locale]/restablecer-contrasena/page.tsx` | Add footer composition only. |
| `src/app/[locale]/actualizar-contrasena/page.tsx` | Add footer composition only. |
| `src/app/[locale]/invitacion/page.tsx` | Add footer composition only; preserve token boundary. |
| `src/app/[locale]/sesion-expirada/page.tsx` | Add footer composition only. |
| `src/app/sitemap.ts` | Add the two canonical terms entries and preserve canonical reciprocal alternates. |
| `src/app/robots.ts` | Preserve disallow-all and add sitemap declaration. |
| `messages/en-US.json` | Add/update exact public legal and landing keys. |
| `messages/es-MX.json` | Add matching key tree with Spanish copy. |
| `__tests__/i18n/sitemap.test.ts` | Narrow expected canonical URLs/count from four to six. |
| `__tests__/i18n/robots.test.ts` | Preserve no-crawl checks; assert the sitemap declaration. |

Do not modify `src/lib/auth/routes.ts`: its existing stale `/en/privacy` redirect allowlist entry is unrelated to footer routing and is not authorization to create an alias. Do not modify middleware, authentication callbacks, protected navigation, schema files, migrations, generated types, external configuration, or `CHANGELOG.md` for this documentation-only planning task.

## 9. Implementation sequence and stop conditions

1. Add the shared footer and complete en-US/es-MX catalog parity for its links, labels, draft messaging, legal pages, and landing text.
2. Implement the minimal no-session landing while preserving the existing active-session redirect.
3. Convert privacy to the draft legal-page composition and add the symmetric terms route.
4. Apply the shared page composition to the named public/auth/recovery/invitation/error routes without changing their security or form logic.
5. Reconcile sitemap/robots and their existing focused expectations.
6. Perform the manual acceptance journeys in Section 10. Do not run repository verification commands or tests for this specification-authoring task; the Project Owner expressly provided prior S10-04 full-repository verification and instructed that no verification command/test run occur now.

Stop and request a Project Owner decision if any of the following becomes necessary:

- final legal prose, legal approval/signoff, an effective date, compliance claim, contact address, data-retention statement, cookie/consent policy, or legal version/audit record;
- a deployed-host/domain redirect, robots crawl permission, production sitemap host, DNS, hosting, or environment configuration change;
- public signup, a public support/contact submission, a new API/server action, data persistence, analytics, or external provider;
- a change to active-session redirect behavior, password-recovery security, invitation token handling, locale canonicalization, or protected navigation;
- repository inspection shows a materially different public route locale convention than the matrix above.

## 10. Manual acceptance matrix

No automated verification is executed as part of authoring this specification. The implementation outcome is accepted only when the following manual checks are truthfully recorded after implementation under the Project Owner's chosen verification instruction:

| Journey | Expected result |
| --- | --- |
| Anonymous `/` and `/en/` | Minimal localized public landing renders; sign-in CTA and both legal links work; no protected data/navigation appears. |
| Active session `/` and `/en/` | Existing role-default redirect remains intact. |
| `/privacidad` ↔ `/en/privacidad` and `/terminos` ↔ `/en/terminos` | Locale switcher preserves the equivalent route; titles, draft notice, footer, and links are localized. |
| Each named sign-in/recovery/invitation/expired-link page | Footer exposes only Privacy and Terms; it does not alter form submission, redirect, callback, or token behavior. |
| Invitation page footer click | Destination contains no `token` query value or carried invitation state. |
| Legal-link keyboard journey | Focus is visible; localized nav label/link names are announced; footer works in light/dark and narrow mobile widths. |
| Sitemap | Exactly six canonical public paths with reciprocal Spanish/English alternates; no protected/auth/API/query routes. |
| Robots | `userAgent: "*"` still disallows `/`; sitemap URL is declared; no allow rule exists. |

## 11. Acceptance criteria

S10-05 is complete only when all conditions below are true:

1. No migration, schema, generated-type, database, API, provider, deployment, or legal-approval work was introduced.
2. Privacy and terms are public at exactly `/privacidad`, `/en/privacidad`, `/terminos`, and `/en/terminos`; no aliases or protected guards were introduced.
3. The shared legal footer is present on the public landing, all named auth/recovery/invitation/error surfaces, and both legal pages, while protected layouts/navigation remain untouched.
4. The public landing is available to an unauthenticated user and preserves the existing active-session role redirect.
5. Every legal route visibly communicates its draft/pending-approval status and makes no legal/prod/compliance approval claim.
6. English and Spanish catalogs have identical key trees for all new/changed public-legal keys; every new visible string and accessible label is localized.
7. The sitemap contains exactly the six canonical public entries with reciprocal language alternates; robots retains global no-crawl behavior and declares the sitemap.
8. Footer/route composition does not leak tokens, auth state, protected navigation, protected data, environment values, or external URLs, and remains keyboard/mobile accessible.
