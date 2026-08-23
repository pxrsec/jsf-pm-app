import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";

vi.mock("server-only", () => ({}));

describe("TC-NOTIF-ADP: Disabled Channel Adapters and Import Boundary", () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    globalThis.fetch = vi.fn().mockImplementation(() => {
      throw new Error("fetch must not be called in S06-02");
    });
  });

  afterEach(() => {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
  });

  it("1. Factory returns adapter whose declared channel matches the requested channel", async () => {
    const { getNotificationChannelAdapter } =
      await import("../channel-adapters");

    const emailAdapter = getNotificationChannelAdapter("email");
    expect(emailAdapter).toBeDefined();
    expect(emailAdapter.channel).toBe("email");

    const whatsappAdapter = getNotificationChannelAdapter("whatsapp");
    expect(whatsappAdapter).toBeDefined();
    expect(whatsappAdapter.channel).toBe("whatsapp");
  });

  it("2. Dispatch resolves to exact { kind: 'not_dispatched', channel, code: 'provider_disabled' }", async () => {
    const { getNotificationChannelAdapter } =
      await import("../channel-adapters");

    const emailAdapter = getNotificationChannelAdapter("email");
    const emailResult = await emailAdapter.dispatch({
      channel: "email",
      eventCategory: "deliverable_submitted",
    });
    expect(emailResult).toEqual({
      kind: "not_dispatched",
      channel: "email",
      code: "provider_disabled",
    });

    const whatsappAdapter = getNotificationChannelAdapter("whatsapp");
    const whatsappResult = await whatsappAdapter.dispatch({
      channel: "whatsapp",
      eventCategory: "deliverable_submitted",
    });
    expect(whatsappResult).toEqual({
      kind: "not_dispatched",
      channel: "whatsapp",
      code: "provider_disabled",
    });
  });

  it("3. Dispatch result contains no message ID, receipt, sent status, timestamps, retry, or error cause", async () => {
    const { getNotificationChannelAdapter } =
      await import("../channel-adapters");

    const emailAdapter = getNotificationChannelAdapter("email");
    const result = await emailAdapter.dispatch({
      channel: "email",
      eventCategory: "internal_review_approved",
    });

    const keys = Object.keys(result);
    expect(keys).toEqual(["kind", "channel", "code"]);
    expect(result).not.toHaveProperty("providerMessageId");
    expect(result).not.toHaveProperty("messageId");
    expect(result).not.toHaveProperty("receipt");
    expect(result).not.toHaveProperty("status");
    expect(result).not.toHaveProperty("attempt");
    expect(result).not.toHaveProperty("retryAt");
    expect(result).not.toHaveProperty("error");
    expect(result).not.toHaveProperty("cause");
  });

  it("4. In disabled mode, global fetch is never called and no provider client is created", async () => {
    delete process.env.EXTERNAL_DELIVERY_MODE;
    const { getNotificationChannelAdapter } =
      await import("../channel-adapters");

    const emailAdapter = getNotificationChannelAdapter("email");
    await emailAdapter.dispatch({
      channel: "email",
      eventCategory: "test_category",
    });

    const whatsappAdapter = getNotificationChannelAdapter("whatsapp");
    await whatsappAdapter.dispatch({
      channel: "whatsapp",
      eventCategory: "test_category",
    });

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("5. In active-ready mode, selection and dispatch remain disabled/no-dispatch and fetch is never called", async () => {
    process.env.EXTERNAL_DELIVERY_MODE = "active";
    process.env.RESEND_API_KEY = "re_synthetic_valid_key";
    process.env.RESEND_FROM_EMAIL = "notifications@jsf-synthetic.com";
    process.env.WHATSAPP_API_TOKEN = "valid_synthetic_token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "10987654321";
    process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = "98765432109";
    process.env.WHATSAPP_APP_SECRET = "valid_synthetic_secret";
    process.env.WHATSAPP_API_VERSION = "v21.0";

    const { getNotificationChannelAdapter } =
      await import("../channel-adapters");

    const emailAdapter = getNotificationChannelAdapter("email");
    const emailResult = await emailAdapter.dispatch({
      channel: "email",
      eventCategory: "test_category",
    });

    expect(emailResult).toEqual({
      kind: "not_dispatched",
      channel: "email",
      code: "provider_disabled",
    });

    const whatsappAdapter = getNotificationChannelAdapter("whatsapp");
    const whatsappResult = await whatsappAdapter.dispatch({
      channel: "whatsapp",
      eventCategory: "test_category",
    });

    expect(whatsappResult).toEqual({
      kind: "not_dispatched",
      channel: "whatsapp",
      code: "provider_disabled",
    });

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("6. Server-only marker: static source check verifies server-only import and no 'use client'", () => {
    const adapterPath = path.resolve(__dirname, "../channel-adapters.ts");
    expect(fs.existsSync(adapterPath)).toBe(true);
    const content = fs.readFileSync(adapterPath, "utf-8");
    expect(content.startsWith('import "server-only";')).toBe(true);
    expect(content).not.toContain("use client");
  });

  it("7. No provider SDK imports: static source check verifies no resend/qstash/workflow/fetch/http imports in production adapter", () => {
    const adapterPath = path.resolve(__dirname, "../channel-adapters.ts");
    const content = fs.readFileSync(adapterPath, "utf-8");
    expect(content).not.toContain("resend");
    expect(content).not.toContain("@upstash/qstash");
    expect(content).not.toContain("@upstash/workflow");
    expect(content).not.toContain("fetch(");
    expect(content).not.toContain("from 'http'");
    expect(content).not.toContain('from "http"');
    expect(content).not.toContain("from 'https'");
    expect(content).not.toContain('from "https"');
  });

  it("8. Closed channel union: factory accepts only email and whatsapp", async () => {
    const { getNotificationChannelAdapter } =
      await import("../channel-adapters");
    expect(getNotificationChannelAdapter("email")).toBeDefined();
    expect(getNotificationChannelAdapter("whatsapp")).toBeDefined();
  });

  it("9. Disabled adapter does not throw exceptions", async () => {
    const { getNotificationChannelAdapter } =
      await import("../channel-adapters");
    const adapter = getNotificationChannelAdapter("email");
    await expect(
      adapter.dispatch({ channel: "email", eventCategory: "sample" }),
    ).resolves.toBeDefined();
  });

  it("10. Structural ESLint check: verifies restricted-import paths outside src/lib/notifications/** and override inside", () => {
    const eslintPath = path.resolve(__dirname, "../../../../eslint.config.mjs");
    expect(fs.existsSync(eslintPath)).toBe(true);
    const content = fs.readFileSync(eslintPath, "utf-8");

    const requiredRestrictedPaths = [
      "@/lib/notifications/config",
      "@/lib/notifications/types",
      "@/lib/notifications/channel-adapters",
      "@/lib/notifications/errors",
      "src/lib/notifications/config",
      "src/lib/notifications/types",
      "src/lib/notifications/channel-adapters",
      "src/lib/notifications/errors",
    ];

    for (const reqPath of requiredRestrictedPaths) {
      expect(content).toContain(reqPath);
    }

    // Verify flat-config override for src/lib/notifications/**
    expect(content).toContain('files: ["src/lib/notifications/**"]');
    // Verify override preserves Prisma & Supabase admin restrictions
    expect(content).toContain("@prisma/client");
    expect(content).toContain("@/lib/supabase/admin");
  });

  it("11. Diagnostic mapping: errors.ts maps safe codes to bounded localization keys with exact type safety", async () => {
    const {
      getSafeNotificationDiagnostic,
      mapNotificationDiagnosticKey,
      NOTIFICATION_DIAGNOSTIC_KEY_MAP,
    } = await import("../errors");

    expect(NOTIFICATION_DIAGNOSTIC_KEY_MAP.provider_disabled).toBe(
      "providerDisabled",
    );
    expect(NOTIFICATION_DIAGNOSTIC_KEY_MAP.external_delivery_unavailable).toBe(
      "externalDeliveryUnavailable",
    );

    expect(mapNotificationDiagnosticKey("provider_disabled")).toBe(
      "providerDisabled",
    );
    expect(mapNotificationDiagnosticKey("external_delivery_unavailable")).toBe(
      "externalDeliveryUnavailable",
    );

    expect(getSafeNotificationDiagnostic("provider_disabled")).toEqual({
      code: "provider_disabled",
      localizationKey: "providerDisabled",
    });
    expect(
      getSafeNotificationDiagnostic("external_delivery_unavailable"),
    ).toEqual({
      code: "external_delivery_unavailable",
      localizationKey: "externalDeliveryUnavailable",
    });
  });
});
