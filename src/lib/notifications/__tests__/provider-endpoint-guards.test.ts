import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { rejectInactiveProviderEndpoint } from "../provider-endpoint-guards";

vi.mock("server-only", () => ({}));

describe("TC-NOTIF-GRD: Provider Endpoint Guards and Safety Boundary", () => {
  it("1. rejectInactiveProviderEndpoint returns exact 404 and structured ApiError envelope", async () => {
    const response = rejectInactiveProviderEndpoint();
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");

    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: "not_found",
        message: "Not found",
      },
      request_id: expect.any(String),
    });

    // Exact fields only — no leakage or additional properties
    expect(Object.keys(body).sort()).toEqual(["error", "request_id"]);
    expect(Object.keys(body.error).sort()).toEqual(["code", "message"]);

    // No custom or provider-specific headers
    expect(response.headers.get("retry-after")).toBeNull();
    expect(response.headers.get("x-provider-status")).toBeNull();
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("2. request_id is an opaque UUID v4 and distinct across invocations", async () => {
    const res1 = rejectInactiveProviderEndpoint();
    const res2 = rejectInactiveProviderEndpoint();

    const body1 = await res1.json();
    const body2 = await res2.json();

    const uuidV4Regex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    expect(body1.request_id).toMatch(uuidV4Regex);
    expect(body2.request_id).toMatch(uuidV4Regex);
    expect(body1.request_id).not.toBe(body2.request_id);
  });

  it("3. Static analysis: guard module contains server-only marker and no prohibited dependencies", () => {
    const guardFilePath = path.resolve(
      __dirname,
      "../provider-endpoint-guards.ts",
    );
    const source = fs.readFileSync(guardFilePath, "utf8");

    // Server-only boundary
    expect(source.startsWith('import "server-only";')).toBe(true);
    expect(source).not.toContain('"use client"');
    expect(source).not.toContain("'use client'");

    // Seam is module-private: VerifiedProviderRequest is not exported
    expect(source).not.toContain("export type VerifiedProviderRequest");
    expect(source).not.toContain("export interface VerifiedProviderRequest");
    expect(source).toContain("type VerifiedProviderRequest<TPayload>");

    // Permitted cryptographic API is strictly globalThis.crypto.randomUUID()
    expect(source).toContain("globalThis.crypto.randomUUID()");
    expect(source).not.toContain("createHmac");
    expect(source).not.toContain("createHash");

    // Prohibited dependencies
    expect(source).not.toContain("resend");
    expect(source).not.toContain("@upstash/qstash");
    expect(source).not.toContain("@upstash/workflow");
    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("node:http");
    expect(source).not.toContain("node:https");
    expect(source).not.toContain("createClient");
    expect(source).not.toContain("createAdminClient");
    expect(source).not.toContain("cookies(");
    expect(source).not.toContain("config");
    expect(source).not.toContain("channel-adapters");
    expect(source).not.toContain("alert-evaluator");
    expect(source).not.toContain("supabase");

    // Only rejectInactiveProviderEndpoint is exported
    const exportMatches =
      source.match(
        /export\s+(function|const|type|interface|class)\s+([a-zA-Z0-9_]+)/g,
      ) || [];
    expect(exportMatches).toHaveLength(1);
    expect(exportMatches[0]).toContain("rejectInactiveProviderEndpoint");
  });

  it("4. Static analysis: eslint.config.mjs enforces server-only restriction for provider-endpoint-guards", () => {
    const eslintConfigPath = path.resolve(
      __dirname,
      "../../../../eslint.config.mjs",
    );
    const eslintConfig = fs.readFileSync(eslintConfigPath, "utf8");

    expect(eslintConfig).toContain(
      "@/lib/notifications/provider-endpoint-guards",
    );
    expect(eslintConfig).toContain(
      "src/lib/notifications/provider-endpoint-guards",
    );
  });

  it("5. Static analysis: OpenAPI contract defines inactive status and 404 ApiError response for all 4 reserved operations", () => {
    const openApiPath = path.resolve(
      __dirname,
      "../../../../contracts/openapi/jsf-pm-api.openapi.yaml",
    );
    const openApiContent = fs.readFileSync(openApiPath, "utf8");

    // Assert reserved paths exist
    expect(openApiContent).toContain("  /api/webhooks/whatsapp:");
    expect(openApiContent).toContain(
      "  /api/workflows/notification-processor:",
    );
    expect(openApiContent).toContain("  /api/workflows/alert-scheduler:");

    // Helper to extract an operation block by indentation
    function extractOperationBlock(pathKey: string, method: string): string {
      const pathIndex = openApiContent.indexOf(pathKey);
      expect(pathIndex).toBeGreaterThan(-1);

      const pathSlice = openApiContent.slice(pathIndex);
      const methodIndex = pathSlice.indexOf(`\n    ${method}:`);
      expect(methodIndex).toBeGreaterThan(-1);

      const opSlice = pathSlice.slice(methodIndex + 1);
      // Next operation or path starts with 2 or 4 leading spaces followed by non-space
      const nextBlockMatch = opSlice
        .slice(4)
        .search(/\n\s{2,4}[a-zA-Z0-9_/-]+:/);
      const opBlock =
        nextBlockMatch > -1 ? opSlice.slice(0, nextBlockMatch + 4) : opSlice;
      return opBlock;
    }

    const operations = [
      {
        path: "  /api/webhooks/whatsapp:",
        method: "get",
        expectedOpId: "verifyWhatsappWebhook",
      },
      {
        path: "  /api/webhooks/whatsapp:",
        method: "post",
        expectedOpId: "receiveWhatsappWebhook",
      },
      {
        path: "  /api/workflows/notification-processor:",
        method: "post",
        expectedOpId: "runNotificationProcessor",
      },
      {
        path: "  /api/workflows/alert-scheduler:",
        method: "post",
        expectedOpId: "runAlertScheduler",
      },
    ];

    for (const op of operations) {
      const block = extractOperationBlock(op.path, op.method);

      // Preserved operation ID
      expect(block).toContain(`operationId: ${op.expectedOpId}`);

      // Inactive provider status
      expect(block).toContain("x-provider-status: inactive");

      // Exactly 404 ApiError response
      expect(block).toContain("'404':");
      expect(block).toContain("$ref: '#/components/schemas/ApiError'");

      // No success or active/deferred responses in this operation block
      expect(block).not.toContain("'200':");
      expect(block).not.toContain("'401':");
      expect(block).not.toContain("'403':");
      expect(block).not.toContain("'503':");
      expect(block).not.toContain("x-provider-status: deferred");

      // Truthful S06 description — no stale "Sprint 02" claims
      expect(block).not.toContain("Sprint 02");
    }
  });

  describe("Static Analysis: OpenAPI Contract Reconciliation (§6.3)", () => {
    it("NotificationDeliveryStatus enum contains all previous values plus exactly one suppressed value", () => {
      const openApiPath = path.resolve(
        __dirname,
        "../../../../contracts/openapi/jsf-pm-api.openapi.yaml",
      );
      const openApiContent = fs.readFileSync(openApiPath, "utf8");

      const enumLineMatch = openApiContent.match(
        /NotificationDeliveryStatus:\s*\{\s*type:\s*string,\s*enum:\s*\[([^\]]+)\]\s*\}/,
      );
      expect(enumLineMatch).not.toBeNull();

      const enumValues = enumLineMatch![1].split(",").map((s) => s.trim());

      expect(enumValues).toEqual([
        "pending",
        "processing",
        "sent",
        "delivered",
        "read",
        "failed",
        "cancelled",
        "suppressed",
      ]);

      const suppressedOccurrences = enumValues.filter(
        (v) => v === "suppressed",
      );
      expect(suppressedOccurrences).toHaveLength(1);
    });

    it("all 4 reserved provider operations descriptions state S06 inactive 404 contract without operational claims", () => {
      const openApiPath = path.resolve(
        __dirname,
        "../../../../contracts/openapi/jsf-pm-api.openapi.yaml",
      );
      const openApiContent = fs.readFileSync(openApiPath, "utf8");

      const reservedOpIds = [
        "verifyWhatsappWebhook",
        "receiveWhatsappWebhook",
        "runNotificationProcessor",
        "runAlertScheduler",
      ];

      for (const opId of reservedOpIds) {
        expect(openApiContent).toContain(`operationId: ${opId}`);
      }

      // Assert stale Sprint 02 text is absent across all 4 operations
      expect(openApiContent).not.toContain(
        "WhatsApp/Meta is not activated in Sprint 02",
      );
      expect(openApiContent).not.toContain(
        "Documented interface only; not activated in Sprint 02",
      );
    });
  });
});
