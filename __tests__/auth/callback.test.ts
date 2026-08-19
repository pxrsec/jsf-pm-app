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

import { GET } from "@/app/api/auth/callback/route";

describe("GET /api/auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to /sesion-expirada?reason=invalid when code exchange fails", async () => {
    const mockSupabase = {
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          data: null,
          error: new Error("Invalid PKCE code"),
        }),
      },
    };
    vi.mocked(serverSupabase.createClient).mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof serverSupabase.createClient>,
    );

    const req = new NextRequest(
      "http://localhost:3000/api/auth/callback?code=invalid-code",
    );
    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("/sesion-expirada?reason=invalid");
  });

  it("redirects to /actualizar-contrasena on password recovery flow", async () => {
    const mockSupabase = {
      auth: {
        verifyOtp: vi.fn().mockResolvedValue({
          data: { session: {} },
          error: null,
        }),
      },
    };
    vi.mocked(serverSupabase.createClient).mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof serverSupabase.createClient>,
    );

    const req = new NextRequest(
      "http://localhost:3000/api/auth/callback?token_hash=validhash&type=recovery",
    );
    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("/actualizar-contrasena");
  });

  it("redirects to allowlisted next parameter on successful login", async () => {
    const mockSupabase = {
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          data: { session: {} },
          error: null,
        }),
      },
    };
    vi.mocked(serverSupabase.createClient).mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof serverSupabase.createClient>,
    );

    const req = new NextRequest(
      "http://localhost:3000/api/auth/callback?code=valid-code&next=/pm",
    );
    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toBe("http://localhost:3000/pm");
  });

  it("resolves user role and redirects to default role path when next is not provided", async () => {
    const mockSupabase = {
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          data: { session: {} },
          error: null,
        }),
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-999" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: "client" },
              error: null,
            }),
          }),
        }),
      }),
    };
    vi.mocked(serverSupabase.createClient).mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof serverSupabase.createClient>,
    );

    const req = new NextRequest(
      "http://localhost:3000/api/auth/callback?code=valid-code",
    );
    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toBe("http://localhost:3000/cliente");
  });
});
