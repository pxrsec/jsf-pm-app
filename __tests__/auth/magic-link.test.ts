import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import * as serverSupabase from "@/lib/supabase/server";

vi.mock("@/config/app.config", () => ({
  appConfig: {
    appUrl: "http://localhost:3000",
    supabaseUrl: "https://example.supabase.co",
    supabasePublishableKey: "sb_publishable_test_key",
  },
}));

vi.mock("@/lib/supabase/server");
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: vi.fn().mockReturnValue([]),
    setAll: vi.fn(),
  }),
}));

import { POST } from "@/app/api/v1/auth/magic-link/route";

describe("POST /api/v1/auth/magic-link", () => {
  const validPayload = {
    email: "client@brand.example",
    redirect_path: "/cliente",
  };

  const validHeaders = {
    "Content-Type": "application/json",
    "Idempotency-Key": "12345678-1234-1234-1234-123456789abc",
    Origin: "http://localhost:3000",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when Idempotency-Key header is missing", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/v1/auth/magic-link",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
        },
        body: JSON.stringify(validPayload),
      },
    );

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("validation_error");
  });

  it("returns 400 when redirect_path is an absolute URL", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/v1/auth/magic-link",
      {
        method: "POST",
        headers: validHeaders,
        body: JSON.stringify({
          email: "client@brand.example",
          redirect_path: "https://evil.example/phish",
        }),
      },
    );

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("validation_error");
  });

  it("returns 202 without revealing account existence on success", async () => {
    const mockSupabase = {
      auth: {
        signInWithOtp: vi.fn().mockResolvedValue({
          data: {},
          error: null,
        }),
      },
    };
    vi.mocked(serverSupabase.createClient).mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof serverSupabase.createClient>,
    );

    const req = new NextRequest(
      "http://localhost:3000/api/v1/auth/magic-link",
      {
        method: "POST",
        headers: validHeaders,
        body: JSON.stringify(validPayload),
      },
    );

    const res = await POST(req);
    expect(res.status).toBe(202);
    const json = await res.json();
    expect(json.data.message).toBeDefined();
  });

  it("returns 202 even if user does not exist (account enumeration safety)", async () => {
    const mockSupabase = {
      auth: {
        signInWithOtp: vi.fn().mockResolvedValue({
          data: null,
          error: new Error("User not found"),
        }),
      },
    };
    vi.mocked(serverSupabase.createClient).mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof serverSupabase.createClient>,
    );

    const req = new NextRequest(
      "http://localhost:3000/api/v1/auth/magic-link",
      {
        method: "POST",
        headers: validHeaders,
        body: JSON.stringify(validPayload),
      },
    );

    const res = await POST(req);
    expect(res.status).toBe(202);
  });

  it("returns 429 when Supabase reports a rate limit error", async () => {
    const mockSupabase = {
      auth: {
        signInWithOtp: vi.fn().mockResolvedValue({
          data: null,
          error: {
            status: 429,
            message: "rate limit exceeded: email rate limit exceeded",
          },
        }),
      },
    };
    vi.mocked(serverSupabase.createClient).mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof serverSupabase.createClient>,
    );

    const req = new NextRequest(
      "http://localhost:3000/api/v1/auth/magic-link",
      {
        method: "POST",
        headers: validHeaders,
        body: JSON.stringify(validPayload),
      },
    );

    const res = await POST(req);
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error.code).toBe("rate_limited");
  });
});
