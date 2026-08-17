import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("TC-SUP-002 / VC-SUP-002: Server Supabase client factory (src/lib/supabase/server.ts)", () => {
  const serverPath = path.resolve(__dirname, "../../src/lib/supabase/server.ts");

  it("source file exists", () => {
    // RED: server.ts does not exist yet
    expect(fs.existsSync(serverPath)).toBe(true);
  });

  it("uses createServerClient from @supabase/ssr with public config and request cookie adapter", () => {
    if (!fs.existsSync(serverPath)) {
      throw new Error("RED: src/lib/supabase/server.ts not implemented");
    }
    const content = fs.readFileSync(serverPath, "utf-8");
    expect(content).toContain("createServerClient");
    expect(content).toContain("@supabase/ssr");
    // Must use non-deprecated getAll/setAll cookie adapter
    expect(content).toMatch(/getAll|setAll/);
  });

  it("does not use deprecated cookie methods", () => {
    if (!fs.existsSync(serverPath)) {
      throw new Error("RED: src/lib/supabase/server.ts not implemented");
    }
    const content = fs.readFileSync(serverPath, "utf-8");
    expect(content).not.toContain("cookies()");
  });
});