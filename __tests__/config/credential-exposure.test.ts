import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("TC-CFG-003 / VC-CFG-003: No real credential exposure in repository (static check)", () => {
  it("no real environment values, credentials, or provider keys in tracked files", () => {
    const repoRoot = path.resolve(__dirname, "../..");
    const trackedExtensions = [
      ".ts",
      ".tsx",
      ".js",
      ".jsx",
      ".json",
      ".md",
      ".mjs",
    ];
    const violations: string[] = [];

    function scanDir(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (
            ![
              "node_modules",
              ".git",
              ".next",
              "coverage",
              "__tests__",
            ].includes(entry.name)
          ) {
            scanDir(fullPath);
          }
        } else if (trackedExtensions.some((ext) => entry.name.endsWith(ext))) {
          const content = fs.readFileSync(fullPath, "utf-8");
          // Check for patterns that indicate real credentials
          const patterns = [
            /eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+/, // JWT tokens
            /sb_[a-zA-Z0-9_]{20,}/, // Supabase keys
            /sk_[a-zA-Z0-9_]{20,}/, // Secret keys
            /sk_live_[a-zA-Z0-9_]+/, // Stripe live keys
            /supabase_secret_key\s*[:=]\s*["'][^"']+["']/i, // Secret key in code
            /SUPABASE_SECRET_KEY\s*[:=]\s*["'][^"']+["']/i,
          ];
          for (const pattern of patterns) {
            const matches = content.match(pattern);
            if (matches) {
              // Filter out obvious placeholders
              const match = matches[0];
              if (
                !match.includes("replace_me") &&
                !match.includes("replace-me")
              ) {
                violations.push(`${fullPath}: ${match.substring(0, 50)}...`);
              }
            }
          }
        }
      }
    }

    scanDir(repoRoot);

    // RED: Current repo may have .env.local with real values but those should be gitignored
    // This test checks tracked files only
    if (violations.length > 0) {
      throw new Error(
        `RED: Found ${violations.length} potential credential exposures:\n${violations.join("\n")}`,
      );
    }
  });

  it(".env.example remains a template only (no real values)", () => {
    const envExamplePath = path.resolve(__dirname, "../../.env.example");
    if (!fs.existsSync(envExamplePath)) {
      throw new Error("RED: .env.example not found");
    }
    const content = fs.readFileSync(envExamplePath, "utf-8");
    // Should contain placeholder/template values, not real ones
    expect(content).toContain("NEXT_PUBLIC_APP_URL=");
    expect(content).toContain("NEXT_PUBLIC_SUPABASE_URL=");
    expect(content).toContain("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=");
    expect(content).toContain("SUPABASE_SECRET_KEY=");
    // Should not contain real-looking values
    expect(content).not.toMatch(
      /eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+/,
    );
    // Supabase keys should be explicit placeholders with replace_me
    expect(content).toMatch(
      /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_replace_me/,
    );
    expect(content).toMatch(/SUPABASE_SECRET_KEY=sb_secret_replace_me/);
  });
});
