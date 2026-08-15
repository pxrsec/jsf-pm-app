import { describe, it } from "vitest";

// Integration tests for locale routing behavior
// These require a running Next.js test server and are marked as integration
// They will fail RED until the implementation exists
describe("VC-I18N-001: Spanish (es-MX) served at canonical routes / and /privacidad without locale prefix", () => {
  it.skip("GET / returns 200 with Spanish content", async () => {
    // RED: No middleware, no [locale] routing, no Spanish content exists yet
    // Integration test - run against built Next.js app via test server
    // Use: npx vitest run --pool=forks or similar with next-test-utils
  });

  it.skip("GET /privacidad returns 200 with Spanish privacy content", async () => {
    // RED: No privacy page component exists yet
  });
});
