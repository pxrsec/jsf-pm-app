/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import path from "path";

describe("VC-I18N-006: Robots configuration with non-production posture", () => {
  let robotsContent: string;

  beforeAll(() => {
    const robotsPath = path.resolve(__dirname, "../../src/app/robots.ts");
    if (!fs.existsSync(robotsPath)) {
      throw new Error(`RED: Missing robots.ts at ${robotsPath}`);
    }
    robotsContent = fs.readFileSync(robotsPath, "utf-8");
  });

  it("robots.ts exists and exports a robots function", () => {
    expect(robotsContent).toContain("export");
    expect(robotsContent).toMatch(/robots|Robots/);
  });

  it("robots returns disallow: / for non-production posture", async () => {
    const robotsModule = await import("../../src/app/robots");
    const robots = (await robotsModule.default) || (robotsModule as any).robots;
    const config = await robots();

    expect(config).toHaveProperty("rules");
    expect(Array.isArray(config.rules)).toBe(true);

    const disallowRule = (config.rules as any[]).find(
      (r: { disallow: string }) => r.disallow === "/",
    );
    expect(disallowRule).toBeDefined();
    expect(disallowRule.userAgent).toBe("*");
  });

  it("robots does not allow any paths", async () => {
    const robotsModule = await import("../../src/app/robots");
    const robots = (await robotsModule.default) || (robotsModule as any).robots;
    const config = await robots();

    // All rules should disallow /
    for (const rule of config.rules as any[]) {
      expect(rule.disallow).toContain("/");
    }
  });
});
