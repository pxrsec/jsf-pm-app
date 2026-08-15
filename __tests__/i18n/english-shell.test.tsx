import { describe, it } from "vitest";

describe("VC-I18N-002: English (en-US) served only under /en/ locale prefix", () => {
  it.skip("GET /en/ returns 200 with English content", async () => {
    // RED: Integration test - requires Next.js test server
  });

  it.skip("GET /en/privacidad returns 200 with English privacy content", async () => {
    // RED: Integration test - requires Next.js test server
  });
});
