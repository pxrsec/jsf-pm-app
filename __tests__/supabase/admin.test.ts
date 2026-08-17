import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("TC-SUP-003 / VC-SUP-003: Privileged Supabase client factory and import boundary", () => {
  const adminPath = path.resolve(__dirname, "../../src/lib/supabase/admin.ts");

  it("source file exists (server-only privileged factory)", () => {
    // RED: admin.ts does not exist yet
    expect(fs.existsSync(adminPath)).toBe(true);
  });

  it("uses createClient from @supabase/supabase-js with SUPABASE_SECRET_KEY", () => {
    if (!fs.existsSync(adminPath)) {
      throw new Error("RED: src/lib/supabase/admin.ts not implemented");
    }
    const content = fs.readFileSync(adminPath, "utf-8");
    expect(content).toContain("createClient");
    expect(content).toContain("@supabase/supabase-js");
    expect(content).toContain("SUPABASE_SECRET_KEY");
  });

  it("makes no remote query or mutation in this work item (factory only)", () => {
    if (!fs.existsSync(adminPath)) {
      throw new Error("RED: src/lib/supabase/admin.ts not implemented");
    }
    const content = fs.readFileSync(adminPath, "utf-8");
    // Should only export factory function, not execute queries
    expect(content).not.toMatch(
      /\.from\(|\.select\(|\.insert\(|\.update\(|\.delete\(|\.upsert\(/,
    );
  });

  it("is server-only and not importable by client components, shared modules, or middleware", () => {
    // This is a static repository check - verify import guard in lint config
    // RED: lint config for import guard does not exist yet
    const eslintPath = path.resolve(__dirname, "../../eslint.config.mjs");
    if (!fs.existsSync(eslintPath)) {
      throw new Error("RED: eslint.config.mjs not found");
    }
    const content = fs.readFileSync(eslintPath, "utf-8");
    // Check for restricted import rule for admin factory
    expect(content).toContain("src/lib/supabase/admin");
  });

  it("is not reachable from client bundle (build-time boundary)", () => {
    // RED: This is a structural boundary - will be verified by lint import guard
    // and the fact that admin.ts is in a server-only path
    const content = fs.readFileSync(adminPath, "utf-8");
    // Should not have 'use client' directive
    expect(content).not.toContain("use client");
  });
});
