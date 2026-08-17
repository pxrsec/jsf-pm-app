# P3/G2 Test Contract and RED Evidence Summary

**Work Item:** S01-E01-02
**Feature:** runtime-config-and-supabase-client-boundary
**Phase/Gate:** P3/G2
**Spec:** dev-docs/specs/s01/runtime-config-and-supabase-client-boundary-v0.2.md (v0.2)
**Branch:** feature/s01-e01-02-runtime-config-and-supabase-client-boundary
**G1 Commit:** 097ebcfbdfb629842997c7920511932fa908a37e

---

## Test Contracts (TC) Allocated from Specification Section 10

| TC ID      | VC IDs     | Verification Mode          | Test/Procedure Path                             | RED Status                 |
| ---------- | ---------- | -------------------------- | ----------------------------------------------- | -------------------------- |
| TC-CFG-001 | VC-CFG-001 | strict-test-first          | `__tests__/config/app.config.test.ts`           | RED (module not found)     |
| TC-CFG-002 | VC-CFG-002 | strict-test-first          | `__tests__/config/server.config.test.ts`        | RED (module not found)     |
| TC-CFG-003 | VC-CFG-003 | static-repository-check    | `__tests__/config/credential-exposure.test.ts`  | PASS (static check passes) |
| TC-SUP-001 | VC-SUP-001 | focused-automated-test     | `__tests__/supabase/browser.test.ts`            | RED (file not found)       |
| TC-SUP-002 | VC-SUP-002 | focused-automated-test     | `__tests__/supabase/server.test.ts`             | RED (file not found)       |
| TC-SUP-003 | VC-SUP-003 | strict-test-first + static | `__tests__/supabase/admin.test.ts`; lint config | RED (files/lint not found) |
| TC-TST-002 | VC-TST-002 | static-repository-check    | `__tests__/config/prisma-guard.test.ts`         | RED (lint config missing)  |

**Note:** VC-TST-001 is `covered-by-shared-evidence` per spec — no separate P3 test required.

---

## RED Evidence - Factual Baseline (2026-08-17)

### VC-CFG-001: Public configuration boundary (src/config/app.config.ts)

- **Command:** `npm run test -- __tests__/config/app.config.test.ts`
- **Result:** 4 failed / 1 passed — Expected failure: `Cannot find package '@/config/app.config'`
- **Missing:** `src/config/app.config.ts` implementation

### VC-CFG-002: Server-only configuration boundary

- **Command:** `npm run test -- __tests__/config/server.config.test.ts`
- **Result:** 2 failed / 3 passed — Expected failure: `Cannot find package '@/config/server.config'`
- **Missing:** `src/config/server.config.ts` implementation

### VC-CFG-003: No real credential exposure in repository

- **Command:** `npm run test -- __tests__/config/credential-exposure.test.ts`
- **Result:** 2 passed — Static check passes; `.env.example` uses placeholders; no credentials in tracked files

### VC-SUP-001: Browser Supabase client factory (src/lib/supabase/browser.ts)

- **Command:** `npm run test -- __tests__/supabase/browser.test.ts`
- **Result:** 3 failed — Expected failure: `RED: src/lib/supabase/browser.ts not implemented`
- **Missing:** `src/lib/supabase/browser.ts` implementation

### VC-SUP-002: Server Supabase client factory (src/lib/supabase/server.ts)

- **Command:** `npm run test -- __tests__/supabase/server.test.ts`
- **Result:** 3 failed — Expected failure: `RED: src/lib/supabase/server.ts not implemented`
- **Missing:** `src/lib/supabase/server.ts` implementation

### VC-SUP-003: Privileged Supabase client factory and import boundary

- **Command:** `npm run test -- __tests__/supabase/admin.test.ts`
- **Result:** 5 failed — Expected failures: admin.ts not found; lint import guard missing
- **Missing:** `src/lib/supabase/admin.ts` implementation; eslint import restriction for admin factory

### VC-TST-002: Repository guard against Prisma runtime imports

- **Command:** `npm run test -- __tests__/config/prisma-guard.test.ts`
- **Result:** 1 failed / 2 passed — Expected failure: eslint config missing `@prisma/client` restricted-imports rule
- **Missing:** eslint rule to reject Prisma imports

---

## RED Test Commands Executed

```bash
cd /c/Users/ruben/Desktop/jsf-app-dev-project/jsf-pm-app && npm run test
```

**Exit Code:** 1 (expected — RED baseline confirmed)
**Failed Test Files:** 6 (app.config, server.config, browser, server, admin, prisma-guard)
**Passed Test Files:** 5 (i18n existing + credential-exposure)
**Skipped Test Files:** 4 (i18n integration tests)
**Total Tests:** 18 failed | 23 passed | 9 skipped (50)

---

## Verification Commands Executed

| Command                                                        | Result                          |
| -------------------------------------------------------------- | ------------------------------- |
| `npm run test`                                                 | Exit 1 — RED baseline confirmed |
| `npm run test -- __tests__/config/app.config.test.ts`          | 4 failed (module missing)       |
| `npm run test -- __tests__/config/server.config.test.ts`       | 2 failed (module missing)       |
| `npm run test -- __tests__/supabase/browser.test.ts`           | 3 failed (file missing)         |
| `npm run test -- __tests__/supabase/server.test.ts`            | 3 failed (file missing)         |
| `npm run test -- __tests__/supabase/admin.test.ts`             | 5 failed (file/lint missing)    |
| `npm run test -- __tests__/config/credential-exposure.test.ts` | 2 passed (static check)         |
| `npm run test -- __tests__/config/prisma-guard.test.ts`        | 1 failed (lint rule missing)    |

---

## Matrix Status Update

All 7 selected test contracts (TC-CFG-001 through TC-TST-002) have been established with factual RED evidence matching the specification's minimum evidence plan. No implementation exists for the required modules. Ready for implementation phase (P4).
