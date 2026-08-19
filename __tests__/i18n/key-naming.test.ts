import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import path from "path";

const MESSAGES_DIR = path.resolve(__dirname, "../../messages");
const ES_MX_PATH = path.join(MESSAGES_DIR, "es-MX.json");

describe("VC-I18N-008: Translation keys follow semantic naming convention", () => {
  let esCatalog: Record<string, unknown>;

  beforeAll(() => {
    if (!fs.existsSync(ES_MX_PATH)) {
      throw new Error(`RED: Missing message catalog ${ES_MX_PATH}`);
    }
    esCatalog = JSON.parse(fs.readFileSync(ES_MX_PATH, "utf-8"));
  });

  it("all keys are dot-delimited lower camel case by segment", () => {
    function collectKeys(obj: Record<string, unknown>, prefix = ""): string[] {
      return Object.entries(obj).flatMap(([k, v]) => {
        const fullKey = prefix ? `${prefix}.${k}` : k;
        if (typeof v === "object" && v !== null && !Array.isArray(v)) {
          return collectKeys(v as Record<string, unknown>, fullKey);
        }
        return [fullKey];
      });
    }

    const allKeys = collectKeys(esCatalog);

    // Every key segment must be lower camel case (e.g., shell.header.brandName)
    for (const key of allKeys) {
      const segments = key.split(".");
      for (const segment of segments) {
        expect(segment).toMatch(/^[a-z][a-zA-Z0-9]*$/);
      }
    }
  });

  it("keys are namespaced under shell, privacy, errors, or auth", () => {
    function collectKeys(obj: Record<string, unknown>, prefix = ""): string[] {
      return Object.entries(obj).flatMap(([k, v]) => {
        const fullKey = prefix ? `${prefix}.${k}` : k;
        if (typeof v === "object" && v !== null && !Array.isArray(v)) {
          return collectKeys(v as Record<string, unknown>, fullKey);
        }
        return [fullKey];
      });
    }

    const allKeys = collectKeys(esCatalog);
    for (const key of allKeys) {
      expect(key).toMatch(/^(shell|privacy|errors|auth)\./);
    }
  });

  it("keys identify UI concepts, not visual positions or routes", () => {
    function collectKeys(obj: Record<string, unknown>, prefix = ""): string[] {
      return Object.entries(obj).flatMap(([k, v]) => {
        const fullKey = prefix ? `${prefix}.${k}` : k;
        if (typeof v === "object" && v !== null && !Array.isArray(v)) {
          return collectKeys(v as Record<string, unknown>, fullKey);
        }
        return [fullKey];
      });
    }

    const allKeys = collectKeys(esCatalog);

    // Forbidden patterns that indicate visual/position/route coupling
    const forbiddenPatterns = [
      /top/i,
      /bottom/i,
      /left/i,
      /right/i,
      /header|footer|sidebar|nav/i,
      /route|url|path|page/i,
      /locale|lang|es-mx|en-us/i,
      /font|size|color|style/i,
      /logo|button|input|form/i, // unless it's a UI concept like "submitButton"
    ];

    for (const key of allKeys) {
      for (const pattern of forbiddenPatterns) {
        // Allow if it's part of a semantic concept like "brandName" not "topLeftLogo"
        const segments = key.split(".");
        for (const seg of segments) {
          if (
            pattern.test(seg) &&
            !/^(brandName|brand|name|title|label|description|notice|placeholder|action|submit|confirm|cancel|close|open|save|edit|delete|view|list|create|update|remove|nav|links|home|projects|agenda|notifications|badgeLabel|badgeOverflow|landing|admin|pm|operator|client|welcome|recentProjects|emptyProjects|myProjects|emptyAgenda|status|priority|loading|error|message|signInAgain|signIn|forgotPasswordLink|ariaLabel|signOut|currentUser|role|planning|inProgress|paused|completed|cancelled|low|medium|high|blocking)$/i.test(
              seg,
            )
          ) {
            // This is a warning pattern, not a hard fail - but we enforce semantic naming
            throw new Error(
              `RED: Key "${key}" contains visual/position/route coupling in segment "${seg}" (matches ${pattern})`,
            );
          }
        }
      }
    }
  });
});
