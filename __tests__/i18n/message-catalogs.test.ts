import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import path from "path";

const MESSAGES_DIR = path.resolve(__dirname, "../../messages");
const ES_MX_PATH = path.join(MESSAGES_DIR, "es-MX.json");
const EN_US_PATH = path.join(MESSAGES_DIR, "en-US.json");

describe("VC-I18N-007: Message catalogs exist with identical JSON structure and complete key sets", () => {
  let esCatalog: Record<string, unknown>;
  let enCatalog: Record<string, unknown>;

  beforeAll(() => {
    // These files don't exist yet - RED baseline
    if (!fs.existsSync(ES_MX_PATH)) {
      throw new Error(`RED: Missing message catalog ${ES_MX_PATH}`);
    }
    if (!fs.existsSync(EN_US_PATH)) {
      throw new Error(`RED: Missing message catalog ${EN_US_PATH}`);
    }
    esCatalog = JSON.parse(fs.readFileSync(ES_MX_PATH, "utf-8"));
    enCatalog = JSON.parse(fs.readFileSync(EN_US_PATH, "utf-8"));
  });

  it("both catalogs exist as valid JSON", () => {
    expect(esCatalog).toBeDefined();
    expect(enCatalog).toBeDefined();
    expect(typeof esCatalog).toBe("object");
    expect(typeof enCatalog).toBe("object");
  });

  it("both catalogs have identical top-level keys (namespaces)", () => {
    const esKeys = Object.keys(esCatalog).sort();
    const enKeys = Object.keys(enCatalog).sort();
    expect(esKeys).toEqual(enKeys);
  });

  it("both catalogs contain required namespaces: shell, privacy, and notifications", () => {
    expect(esCatalog).toHaveProperty("shell");
    expect(esCatalog).toHaveProperty("privacy");
    expect(esCatalog).toHaveProperty("notifications");
    expect(enCatalog).toHaveProperty("shell");
    expect(enCatalog).toHaveProperty("privacy");
    expect(enCatalog).toHaveProperty("notifications");
  });

  it("both catalogs contain future-only shell.nav.links.notifications", () => {
    const esShell = esCatalog.shell as {
      nav?: { links?: { notifications?: string } };
    };
    const enShell = enCatalog.shell as {
      nav?: { links?: { notifications?: string } };
    };
    expect(esShell?.nav?.links?.notifications).toBeDefined();
    expect(enShell?.nav?.links?.notifications).toBeDefined();
  });

  it("all 15 category title/description pairs exist under notifications.categories in both catalogs", () => {
    const requiredCategories = [
      "invitation",
      "projectAssignment",
      "taskAssignment",
      "taskStatusChanged",
      "clientTaskBlocking",
      "clientSubmission",
      "deliverableSubmitted",
      "changesRequested",
      "reviewApproved",
      "deliverableDelivered",
      "deadlineReminder",
      "deadlineOverdue",
      "reviewInactivityReminder",
      "linkReportedBroken",
      "system",
    ];

    const esCategories = (
      esCatalog.notifications as {
        categories: Record<string, { title?: string; description?: string }>;
      }
    ).categories;
    const enCategories = (
      enCatalog.notifications as {
        categories: Record<string, { title?: string; description?: string }>;
      }
    ).categories;

    for (const cat of requiredCategories) {
      expect(esCategories[cat]?.title).toBeDefined();
      expect(esCategories[cat]?.description).toBeDefined();
      expect(enCategories[cat]?.title).toBeDefined();
      expect(enCategories[cat]?.description).toBeDefined();
    }
  });

  it("all keys under shell namespace are identical between catalogs", () => {
    const esShellKeys = Object.keys(
      esCatalog.shell as Record<string, unknown>,
    ).sort();
    const enShellKeys = Object.keys(
      enCatalog.shell as Record<string, unknown>,
    ).sort();
    expect(esShellKeys).toEqual(enShellKeys);
  });

  it("all keys under privacy namespace are identical between catalogs", () => {
    const esPrivacyKeys = Object.keys(
      esCatalog.privacy as Record<string, unknown>,
    ).sort();
    const enPrivacyKeys = Object.keys(
      enCatalog.privacy as Record<string, unknown>,
    ).sort();
    expect(esPrivacyKeys).toEqual(enPrivacyKeys);
  });

  it("all keys under notifications namespace are identical between catalogs", () => {
    function collectKeys(obj: Record<string, unknown>, prefix = ""): string[] {
      return Object.entries(obj).flatMap(([k, v]) => {
        const fullKey = prefix ? `${prefix}.${k}` : k;
        if (typeof v === "object" && v !== null && !Array.isArray(v)) {
          return collectKeys(v as Record<string, unknown>, fullKey);
        }
        return [fullKey];
      });
    }

    const esNotificationKeys = collectKeys(
      esCatalog.notifications as Record<string, unknown>,
    ).sort();
    const enNotificationKeys = collectKeys(
      enCatalog.notifications as Record<string, unknown>,
    ).sort();

    expect(esNotificationKeys).toEqual(enNotificationKeys);
    expect(esNotificationKeys).toHaveLength(54);
  });

  it("no missing keys in either catalog (complete key sets)", () => {
    // Deep check: every key path in es-MX must exist in en-US and vice versa
    function collectKeys(obj: Record<string, unknown>, prefix = ""): string[] {
      return Object.entries(obj).flatMap(([k, v]) => {
        const fullKey = prefix ? `${prefix}.${k}` : k;
        if (typeof v === "object" && v !== null && !Array.isArray(v)) {
          return collectKeys(v as Record<string, unknown>, fullKey);
        }
        return [fullKey];
      });
    }
    const esAllKeys = collectKeys(esCatalog).sort();
    const enAllKeys = collectKeys(enCatalog).sort();
    expect(esAllKeys).toEqual(enAllKeys);
  });
});
