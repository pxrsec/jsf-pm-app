# Verification Procedure: VC-I18N-009

**VC-ID:** VC-I18N-009  
**REQ-ID:** REQ-I18N-010  
**Verification Mode:** verification-first (manual code review + grep)  
**Description:** No user-visible text in `src/app/**/*.tsx` (shell components) is hardcoded; all visible strings come from `useTranslations()` or equivalent.

## Procedure

```bash
# Search for string literals in JSX that could be user-visible text
# Exclude: import statements, comments, className, href, alt, src, type, etc.
grep -rn --include="*.tsx" "src/app" | grep -E '["'"'`]]([a-zA-Z][a-zA-Z0-9\s]{3,})["'"'`]]' | grep -v "className\|href\|src\|alt\|type\|rel\|id\|role\|aria-\|data-\|testId\|console\." | head -50
```

## Expected Result (RED baseline - no implementation yet)

- Currently the baseline `src/app/page.tsx` and `src/app/layout.tsx` contain hardcoded English strings
- These will need to be refactored to use `useTranslations('shell')`
- The search should return findings that violate this rule until implementation

## Pass Criteria

- Zero findings of user-visible string literals in `src/app/**/*.tsx` that are not wrapped in `useTranslations()` calls
- All visible text sourced from message catalogs via `useTranslations('shell')` or `useTranslations('privacy')`

## Files to Check

- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/[locale]/page.tsx` (once created)
- `src/app/[locale]/privacidad/page.tsx` (once created)
- Any components in `src/app/_components/`, `src/components/shared/` used by shell routes
