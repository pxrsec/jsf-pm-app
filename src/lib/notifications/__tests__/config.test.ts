import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";

vi.mock("server-only", () => ({}));

describe("TC-NOTIF-CFG: Server-Only Configuration Boundary and Parser", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("1. Default is disabled: absent EXTERNAL_DELIVERY_MODE returns disabled snapshot with mode_missing", async () => {
    delete process.env.EXTERNAL_DELIVERY_MODE;
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
    delete process.env.WHATSAPP_API_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
    delete process.env.WHATSAPP_APP_SECRET;
    delete process.env.WHATSAPP_API_VERSION;

    const { getExternalDeliveryCapability } = await import("../config");
    const capability = getExternalDeliveryCapability();

    expect(capability).toEqual({
      kind: "disabled",
      mode: "disabled",
      code: "mode_missing",
      email: { kind: "disabled", code: "provider_disabled" },
      whatsapp: { kind: "disabled", code: "provider_disabled" },
    });
  });

  it("2. Explicit disabled wins even when all synthetic provider fields are shape-valid", async () => {
    process.env.EXTERNAL_DELIVERY_MODE = "disabled";
    process.env.RESEND_API_KEY = "re_synthetic_valid_key_12345";
    process.env.RESEND_FROM_EMAIL = "notifications@jsf-synthetic.com";
    process.env.WHATSAPP_API_TOKEN = "synthetic_valid_wa_token_12345";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "10987654321";
    process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = "98765432109";
    process.env.WHATSAPP_APP_SECRET = "synthetic_valid_wa_secret_12345";
    process.env.WHATSAPP_API_VERSION = "v21.0";

    const { getExternalDeliveryCapability } = await import("../config");
    const capability = getExternalDeliveryCapability();

    expect(capability).toEqual({
      kind: "disabled",
      mode: "disabled",
      code: "mode_disabled",
      email: { kind: "disabled", code: "provider_disabled" },
      whatsapp: { kind: "disabled", code: "provider_disabled" },
    });
  });

  it("3. Whitespace and unknown mode fail closed to disabled/invalid without throwing", async () => {
    process.env.EXTERNAL_DELIVERY_MODE = "   ";
    const { getExternalDeliveryCapability } = await import("../config");
    let capability = getExternalDeliveryCapability();
    expect(capability).toEqual({
      kind: "disabled",
      mode: "disabled",
      code: "mode_blank",
      email: { kind: "disabled", code: "provider_disabled" },
      whatsapp: { kind: "disabled", code: "provider_disabled" },
    });

    vi.resetModules();
    process.env.EXTERNAL_DELIVERY_MODE = "enabled";
    const { getExternalDeliveryCapability: getCapUnknown } =
      await import("../config");
    capability = getCapUnknown();
    expect(capability).toMatchObject({
      kind: "invalid",
      mode: "disabled",
      code: "mode_invalid",
    });
  });

  it("4. Mode placeholder fails closed to disabled with mode_placeholder", async () => {
    process.env.EXTERNAL_DELIVERY_MODE = "replace_me";
    const { getExternalDeliveryCapability } = await import("../config");
    const capability = getExternalDeliveryCapability();
    expect(capability).toEqual({
      kind: "disabled",
      mode: "disabled",
      code: "mode_placeholder",
      email: { kind: "disabled", code: "provider_disabled" },
      whatsapp: { kind: "disabled", code: "provider_disabled" },
    });
  });

  it("5. Active mode requires both providers: partial provider set yields invalid/provider_configuration_incomplete", async () => {
    process.env.EXTERNAL_DELIVERY_MODE = "active";
    process.env.RESEND_API_KEY = "re_synthetic_valid_key";
    process.env.RESEND_FROM_EMAIL = "notifications@jsf-synthetic.com";
    delete process.env.WHATSAPP_API_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
    delete process.env.WHATSAPP_APP_SECRET;
    delete process.env.WHATSAPP_API_VERSION;

    const { getExternalDeliveryCapability } = await import("../config");
    const capability = getExternalDeliveryCapability();
    expect(capability).toEqual({
      kind: "invalid",
      mode: "disabled",
      code: "provider_configuration_incomplete",
      email: { kind: "ready" },
      whatsapp: {
        kind: "disabled",
        code: "provider_missing",
      },
    });
  });

  it("6. Partial and blank provider inputs yield disabled provider states and incomplete aggregate code", async () => {
    process.env.EXTERNAL_DELIVERY_MODE = "active";
    process.env.RESEND_API_KEY = "re_synthetic_key";
    process.env.RESEND_FROM_EMAIL = "   "; // blank
    process.env.WHATSAPP_API_TOKEN = "token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123";
    // missing businessId, secret, version

    const { getExternalDeliveryCapability } = await import("../config");
    const capability = getExternalDeliveryCapability();
    expect(capability).toEqual({
      kind: "invalid",
      mode: "disabled",
      code: "provider_configuration_incomplete",
      email: {
        kind: "disabled",
        code: "provider_partial",
      },
      whatsapp: {
        kind: "disabled",
        code: "provider_partial",
      },
    });
  });

  it("7. Placeholder values in required fields are recognized and yield provider_placeholder", async () => {
    const placeholderValues = [
      "replace_me",
      "replace-me",
      "replace me",
      "example",
      "placeholder",
      "changeme",
      "change-me",
      "your_token",
      "your-id",
      "<token>",
      "re_replace_me",
      "replace-me@example.com",
    ];

    for (const placeholder of placeholderValues) {
      vi.resetModules();
      process.env.EXTERNAL_DELIVERY_MODE = "active";
      process.env.RESEND_API_KEY = placeholder;
      process.env.RESEND_FROM_EMAIL = "notifications@jsf-synthetic.com";
      process.env.WHATSAPP_API_TOKEN = "valid_token";
      process.env.WHATSAPP_PHONE_NUMBER_ID = "123456";
      process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = "123456";
      process.env.WHATSAPP_APP_SECRET = "valid_secret";
      process.env.WHATSAPP_API_VERSION = "v21.0";

      const { getExternalDeliveryCapability } = await import("../config");
      const capability = getExternalDeliveryCapability();
      expect(capability).toMatchObject({
        kind: "invalid",
        code: "provider_configuration_placeholder",
        email: {
          kind: "disabled",
          code: "provider_placeholder",
        },
      });
    }
  });

  it("8. Malformed email configuration never yields email ready", async () => {
    const malformedEmails = [
      { key: "no_prefix_key", email: "valid@domain.com" },
      { key: "re_valid_key", email: "not-an-email" },
      { key: "re_valid_key", email: "user@domain-without-dot" },
      { key: "re_valid_key", email: "user with spaces@domain.com" },
      { key: "re_valid_key", email: "user@.domain.com" },
      { key: "re_valid_key", email: "user@domain." },
    ];

    for (const { key, email } of malformedEmails) {
      vi.resetModules();
      process.env.EXTERNAL_DELIVERY_MODE = "active";
      process.env.RESEND_API_KEY = key;
      process.env.RESEND_FROM_EMAIL = email;
      process.env.WHATSAPP_API_TOKEN = "valid_token";
      process.env.WHATSAPP_PHONE_NUMBER_ID = "123456";
      process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = "123456";
      process.env.WHATSAPP_APP_SECRET = "valid_secret";
      process.env.WHATSAPP_API_VERSION = "v21.0";

      const { getExternalDeliveryCapability } = await import("../config");
      const capability = getExternalDeliveryCapability();
      expect(capability).toMatchObject({
        kind: "invalid",
        email: {
          kind: "disabled",
          code: "provider_malformed",
        },
      });
    }
  });

  it("9. Malformed WhatsApp configuration never yields WhatsApp ready", async () => {
    const malformedWhatsApp = [
      { phoneId: "abc", businessId: "12345", version: "v21.0" },
      { phoneId: "12345", businessId: "non-digits", version: "v21.0" },
      { phoneId: "12345", businessId: "12345", version: "21.0" }, // missing 'v'
      { phoneId: "12345", businessId: "12345", version: "v21" }, // missing dot/minor
    ];

    for (const { phoneId, businessId, version } of malformedWhatsApp) {
      vi.resetModules();
      process.env.EXTERNAL_DELIVERY_MODE = "active";
      process.env.RESEND_API_KEY = "re_valid_synthetic_key";
      process.env.RESEND_FROM_EMAIL = "valid@domain.com";
      process.env.WHATSAPP_API_TOKEN = "valid_token";
      process.env.WHATSAPP_PHONE_NUMBER_ID = phoneId;
      process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = businessId;
      process.env.WHATSAPP_APP_SECRET = "valid_secret";
      process.env.WHATSAPP_API_VERSION = version;

      const { getExternalDeliveryCapability } = await import("../config");
      const capability = getExternalDeliveryCapability();
      expect(capability).toMatchObject({
        kind: "invalid",
        whatsapp: {
          kind: "disabled",
          code: "provider_malformed",
        },
      });
    }
  });

  it("10. Fully shaped active-ready configuration returns active-ready snapshot (configuration-readiness only)", async () => {
    process.env.EXTERNAL_DELIVERY_MODE = "active";
    process.env.RESEND_API_KEY = "re_valid_synthetic_key_12345";
    process.env.RESEND_FROM_EMAIL = "notifications@jsf-domain.com";
    process.env.WHATSAPP_API_TOKEN = "valid_synthetic_token_12345";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "10987654321";
    process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = "98765432109";
    process.env.WHATSAPP_APP_SECRET = "valid_synthetic_app_secret_12345";
    process.env.WHATSAPP_API_VERSION = "v21.0";

    const { getExternalDeliveryCapability } = await import("../config");
    const capability = getExternalDeliveryCapability();

    expect(capability).toEqual({
      kind: "active-ready",
      mode: "active",
      email: { kind: "ready" },
      whatsapp: { kind: "ready" },
    });
  });

  it("11. No raw export: returned object contains no raw secrets, keys, or env variable names", async () => {
    const rawSecretKey = "re_ultra_secret_key_12345";
    const rawToken = "super_secret_wa_token_67890";
    const rawEmail = "secret-sender@jsf-domain.com";

    process.env.EXTERNAL_DELIVERY_MODE = "active";
    process.env.RESEND_API_KEY = rawSecretKey;
    process.env.RESEND_FROM_EMAIL = rawEmail;
    process.env.WHATSAPP_API_TOKEN = rawToken;
    process.env.WHATSAPP_PHONE_NUMBER_ID = "1234567890";
    process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = "9876543210";
    process.env.WHATSAPP_APP_SECRET = "secret_secret";
    process.env.WHATSAPP_API_VERSION = "v21.0";

    const { getExternalDeliveryCapability } = await import("../config");
    const capability = getExternalDeliveryCapability();
    const serialized = JSON.stringify(capability);

    expect(serialized).not.toContain(rawSecretKey);
    expect(serialized).not.toContain(rawToken);
    expect(serialized).not.toContain(rawEmail);
    expect(serialized).not.toContain("RESEND_");
    expect(serialized).not.toContain("WHATSAPP_");
  });

  it("12. Server-only marker: static source check verifies config.ts begins with server-only", () => {
    const configPath = path.resolve(__dirname, "../config.ts");
    expect(fs.existsSync(configPath)).toBe(true);
    const content = fs.readFileSync(configPath, "utf-8");
    expect(content.startsWith('import "server-only";')).toBe(true);
  });

  it("13. Demo flag parsing: only exact case-insensitive 'true' returns true", async () => {
    const falseCases = [
      undefined,
      "",
      "   ",
      "false",
      "FALSE",
      "1",
      "yes",
      "on",
      "replace_me",
      "true1",
    ];

    for (const testVal of falseCases) {
      vi.resetModules();
      if (testVal === undefined) {
        delete process.env.NOTIFICATION_DEMO_ALERT_EVALUATION_ENABLED;
      } else {
        process.env.NOTIFICATION_DEMO_ALERT_EVALUATION_ENABLED = testVal;
      }
      const { isNotificationDemoAlertEvaluationEnabled } =
        await import("../config");
      expect(isNotificationDemoAlertEvaluationEnabled()).toBe(false);
    }

    const trueCases = ["true", "TRUE", "True", "  true  "];
    for (const testVal of trueCases) {
      vi.resetModules();
      process.env.NOTIFICATION_DEMO_ALERT_EVALUATION_ENABLED = testVal;
      const { isNotificationDemoAlertEvaluationEnabled } =
        await import("../config");
      expect(isNotificationDemoAlertEvaluationEnabled()).toBe(true);
    }
  });

  it("14. No unrelated environment reads: static source check confirms no QStash/Workflow/webhook variables read in config.ts", () => {
    const configPath = path.resolve(__dirname, "../config.ts");
    const content = fs.readFileSync(configPath, "utf-8");
    expect(content).not.toContain("QSTASH");
    expect(content).not.toContain("UPSTASH");
    expect(content).not.toContain("WEBHOOK");
    expect(content).not.toContain("NEXT_PUBLIC_");
    expect(content).not.toContain("SUPABASE_SECRET_KEY");
  });
});
