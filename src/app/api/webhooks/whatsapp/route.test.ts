import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

vi.mock("server-only", () => ({}));

describe("TC-NOTIF-RTE-WA: Inactive WhatsApp Webhook Route Handler", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doUnmock("@/lib/notifications/provider-endpoint-guards");
  });

  it("1. GET and POST delegate to rejectInactiveProviderEndpoint without inspecting request", async () => {
    vi.resetModules();
    const mockGuardResponse = new NextResponse(
      JSON.stringify({ mock: "guard_called" }),
      { status: 404, headers: { "content-type": "application/json" } },
    );
    const guardSpy = vi.fn().mockReturnValue(mockGuardResponse);

    vi.doMock("@/lib/notifications/provider-endpoint-guards", () => ({
      rejectInactiveProviderEndpoint: guardSpy,
    }));

    const { GET, POST } = await import("./route");

    // Opaque GET invocation with query parameters
    const getRequest = new NextRequest(
      "http://localhost:3000/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=opaque_token&hub.challenge=opaque_challenge",
    );
    const getResult = GET(getRequest);
    expect(guardSpy).toHaveBeenCalledTimes(1);
    expect(getResult).toBe(mockGuardResponse);

    // Opaque POST invocation with signature header and arbitrary payload
    guardSpy.mockClear();
    const postRequest = new NextRequest(
      "http://localhost:3000/api/webhooks/whatsapp",
      {
        method: "POST",
        headers: { "X-Hub-Signature-256": "opaque-signature-value" },
        body: JSON.stringify({ opaque: "payload", entry: [{ id: "123" }] }),
      },
    );
    const postResult = POST(postRequest);
    expect(guardSpy).toHaveBeenCalledTimes(1);
    expect(postResult).toBe(mockGuardResponse);
  });

  it("2. Real unmocked route invocation returns standard 404 ApiError envelope", async () => {
    vi.doUnmock("@/lib/notifications/provider-endpoint-guards");
    vi.resetModules();

    const { GET, POST } = await import("./route");

    const getReq = new NextRequest(
      "http://localhost:3000/api/webhooks/whatsapp?hub.mode=subscribe&hub.challenge=opaque_challenge",
    );
    const getRes = GET(getReq);
    expect(getRes.status).toBe(404);
    const getBody = await getRes.json();
    expect(getBody).toEqual({
      error: {
        code: "not_found",
        message: "Not found",
      },
      request_id: expect.any(String),
    });

    const postReq = new NextRequest(
      "http://localhost:3000/api/webhooks/whatsapp",
      {
        method: "POST",
        headers: { "X-Hub-Signature-256": "sha256=opaque_sig" },
        body: "arbitrary opaque text body",
      },
    );
    const postRes = POST(postReq);
    expect(postRes.status).toBe(404);
    const postBody = await postRes.json();
    expect(postBody).toEqual({
      error: {
        code: "not_found",
        message: "Not found",
      },
      request_id: expect.any(String),
    });
  });

  it("3. Exports strictly GET and POST handlers only", async () => {
    vi.resetModules();
    const routeModule = await import("./route");
    const exportedKeys = Object.keys(routeModule).sort();

    expect(exportedKeys).toEqual(["GET", "POST"]);
    expect(typeof routeModule.GET).toBe("function");
    expect(typeof routeModule.POST).toBe("function");
  });

  it("4. Static analysis: route source contains no request dereferencing or side-effect APIs", () => {
    const routeFilePath = path.resolve(__dirname, "./route.ts");
    const source = fs.readFileSync(routeFilePath, "utf8");

    // No request property access or indexing
    expect(source).not.toContain("request.");
    expect(source).not.toContain("_request.");
    expect(source).not.toContain("request[");
    expect(source).not.toContain("_request[");

    // No body or header parsing APIs
    expect(source).not.toContain(".json(");
    expect(source).not.toContain(".text(");
    expect(source).not.toContain(".formData(");
    expect(source).not.toContain(".arrayBuffer(");
    expect(source).not.toContain(".clone(");
    expect(source).not.toContain(".headers.get(");

    // No environment, fetch, crypto, or database APIs
    expect(source).not.toContain("process.env");
    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("createHmac");
    expect(source).not.toContain("createClient");
    expect(source).not.toContain("createAdminClient");
    expect(source).not.toContain("cookies(");
    expect(source).not.toContain("supabase");
  });
});
