import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("TC-TST-002 / VC-TST-002: Repository guard against Prisma runtime imports", () => {
  it("eslint config contains rule to reject Prisma imports in application code", () => {
    const eslintPath = path.resolve(__dirname, "../../eslint.config.mjs");
    if (!fs.existsSync(eslintPath)) {
      throw new Error("RED: eslint.config.mjs not found");
    }
    const content = fs.readFileSync(eslintPath, "utf-8");
    // Must have a restricted-imports rule for @prisma/client or prisma
    expect(content).toContain("@prisma/client");
  });

  it("no Prisma runtime imports exist in src/ application code", () => {
    const srcRoot = path.resolve(__dirname, "../../src");
    const trackedExtensions = [".ts", ".tsx", ".js", ".jsx"];
    const violations: string[] = [];

    function scanDir(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (trackedExtensions.some((ext) => entry.name.endsWith(ext))) {
          const content = fs.readFileSync(fullPath, "utf-8");
          // Check for Prisma runtime imports
          const patterns = [
            /from\s+["']@prisma\/client["']/,
            /import\s+.*\s+from\s+["']@prisma\/client["']/,
            /require\(["']@prisma\/client["']\)/,
            /\bprisma\b.*\bClient\b/,
          ];
          for (const pattern of patterns) {
            const matches = content.match(pattern);
            if (matches) {
              violations.push(`${fullPath}: ${matches[0]}`);
            }
          }
        }
      }
    }

    scanDir(srcRoot);

    if (violations.length > 0) {
      throw new Error(
        `RED: Found ${violations.length} Prisma runtime imports:\n${violations.join("\n")}`,
      );
    }
  });

  it("no prisma/ directory exists in repository (schema work uses Supabase migrations only)", () => {
    const prismaDir = path.resolve(__dirname, "../../prisma");
    expect(fs.existsSync(prismaDir)).toBe(false);
  });
});
