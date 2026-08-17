import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("TC-SUP-001 / VC-SUP-001: Browser Supabase client factory (src/lib/supabase/browser.ts)", () => {
  const browserPath = path.resolve(__dirname, "../../src/lib/supabase/browser.ts");

  it("source file exists", () => {
    // RED: browser.ts does not exist yet
    expect(fs.existsSync(browserPath)).toBe(true);
  });

  it("uses createBrowserClient from @supabase/ssr (import check)", () => {
    if (!fs.existsSync(browserPath)) {
      throw new Error("RED: src/lib/supabase/browser.ts not implemented");
    }
    const content = fs.readFileSync(browserPath, "utf-8");
    expect(content).toContain("createBrowserClient");
    expect(content).toContain("@supabase/ssr");
  });

  it("does not import next/headers or server cookie store", () => {
    if (!fs.existsSync(browserPath)) {
      throw new Error("RED: src/lib/supabase/browser.ts not implemented");
    }
    const content = fs.readFileSync(browserPath, "utf-8");
    expect(content).not.toContain("next/headers");
    expect(content).not.toContain("cookies()");
  });
});