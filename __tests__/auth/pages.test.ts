import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const MESSAGES_DIR = path.resolve(__dirname, "../../messages");
const ES_MX_PATH = path.join(MESSAGES_DIR, "es-MX.json");
const EN_US_PATH = path.join(MESSAGES_DIR, "en-US.json");

describe("Auth Pages & Locale Parity", () => {
  const esCatalog = JSON.parse(fs.readFileSync(ES_MX_PATH, "utf-8"));
  const enCatalog = JSON.parse(fs.readFileSync(EN_US_PATH, "utf-8"));

  const requiredAuthKeys = [
    "auth.signIn.title",
    "auth.signIn.emailLabel",
    "auth.signIn.passwordLabel",
    "auth.signIn.submitLabel",
    "auth.signIn.forgotPasswordLink",
    "auth.signIn.errorGeneric",
    "auth.signIn.errorRateLimit",
    "auth.resetPassword.title",
    "auth.resetPassword.emailLabel",
    "auth.resetPassword.submitLabel",
    "auth.resetPassword.successMessage",
    "auth.updatePassword.title",
    "auth.updatePassword.passwordLabel",
    "auth.updatePassword.confirmLabel",
    "auth.updatePassword.submitLabel",
    "auth.updatePassword.successMessage",
    "auth.updatePassword.errorPolicy",
    "auth.invitation.title",
    "auth.invitation.fullNameLabel",
    "auth.invitation.phoneLabel",
    "auth.invitation.passwordLabel",
    "auth.invitation.whatsappOptInLabel",
    "auth.invitation.submitLabel",
    "auth.invitation.errorPolicy",
    "auth.invitation.errorGeneric",
    "auth.sessionExpired.title",
    "auth.sessionExpired.messageExpired",
    "auth.sessionExpired.messageInvalid",
    "auth.sessionExpired.messageAlreadyUsed",
    "auth.sessionExpired.signInLink",
  ];

  function getNestedValue(
    obj: Record<string, unknown>,
    pathStr: string,
  ): unknown {
    return pathStr.split(".").reduce<unknown>((acc, part) => {
      if (acc && typeof acc === "object") {
        return (acc as Record<string, unknown>)[part];
      }
      return undefined;
    }, obj);
  }

  it("both catalogs contain all required auth.* keys with non-empty string values", () => {
    for (const key of requiredAuthKeys) {
      const esVal = getNestedValue(esCatalog, key);
      const enVal = getNestedValue(enCatalog, key);

      expect(typeof esVal, `Missing or non-string key in es-MX: ${key}`).toBe(
        "string",
      );
      expect(
        (esVal as string).trim().length,
        `Empty value in es-MX: ${key}`,
      ).toBeGreaterThan(0);

      expect(typeof enVal, `Missing or non-string key in en-US: ${key}`).toBe(
        "string",
      );
      expect(
        (enVal as string).trim().length,
        `Empty value in en-US: ${key}`,
      ).toBeGreaterThan(0);
    }
  });

  it("auth namespace has exact structural and key parity between es-MX and en-US", () => {
    function collectKeys(obj: Record<string, unknown>, prefix = ""): string[] {
      return Object.entries(obj).flatMap(([k, v]) => {
        const fullKey = prefix ? `${prefix}.${k}` : k;
        if (typeof v === "object" && v !== null && !Array.isArray(v)) {
          return collectKeys(v as Record<string, unknown>, fullKey);
        }
        return [fullKey];
      });
    }

    const esAuthKeys = collectKeys(esCatalog.auth, "auth").sort();
    const enAuthKeys = collectKeys(enCatalog.auth, "auth").sort();

    expect(esAuthKeys).toEqual(enAuthKeys);
  });
});
