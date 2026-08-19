import { describe, it, expect, vi, beforeEach } from "vitest";
import * as serverSupabase from "@/lib/supabase/server";

vi.mock("@/config/app.config", () => ({
  appConfig: {
    appUrl: "http://localhost:3000",
    supabaseUrl: "https://example.supabase.co",
    supabasePublishableKey: "sb_publishable_test_key",
  },
}));

vi.mock("@/lib/supabase/server");

import {
  requireSession,
  getOptionalSession,
  AuthError,
} from "@/lib/auth/session";

describe("Session Utility (requireSession / getOptionalSession)", () => {
  const mockCookieStore: serverSupabase.CookieStore = {
    getAll: vi.fn().mockResolvedValue([]),
    setAll: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws UNAUTHENTICATED when no user session exists", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: new Error("No session"),
        }),
      },
    };
    vi.mocked(serverSupabase.createClient).mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof serverSupabase.createClient>,
    );

    await expect(requireSession(mockCookieStore)).rejects.toThrow(AuthError);
    await expect(requireSession(mockCookieStore)).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });

  it("throws INACTIVE_OR_MISSING_PROFILE when profile row does not exist", async () => {
    const mockUser = { id: "user-123", email: "test@example.com" };
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: new Error("Row not found"),
            }),
          }),
        }),
      }),
    };
    vi.mocked(serverSupabase.createClient).mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof serverSupabase.createClient>,
    );

    await expect(requireSession(mockCookieStore)).rejects.toThrow(AuthError);
    await expect(requireSession(mockCookieStore)).rejects.toMatchObject({
      code: "INACTIVE_OR_MISSING_PROFILE",
    });
  });

  it("throws INACTIVE_OR_MISSING_PROFILE when profile is_active is false", async () => {
    const mockUser = { id: "user-123", email: "test@example.com" };
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: "user-123",
                role: "pm",
                full_name: "Deactivated PM",
                is_active: false,
                deleted_at: null,
              },
              error: null,
            }),
          }),
        }),
      }),
    };
    vi.mocked(serverSupabase.createClient).mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof serverSupabase.createClient>,
    );

    await expect(requireSession(mockCookieStore)).rejects.toMatchObject({
      code: "INACTIVE_OR_MISSING_PROFILE",
    });
  });

  it("throws INACTIVE_OR_MISSING_PROFILE when profile is soft-deleted", async () => {
    const mockUser = { id: "user-123", email: "test@example.com" };
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: "user-123",
                role: "operator",
                full_name: "Deleted Operator",
                is_active: true,
                deleted_at: "2026-08-10T12:00:00Z",
              },
              error: null,
            }),
          }),
        }),
      }),
    };
    vi.mocked(serverSupabase.createClient).mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof serverSupabase.createClient>,
    );

    await expect(requireSession(mockCookieStore)).rejects.toMatchObject({
      code: "INACTIVE_OR_MISSING_PROFILE",
    });
  });

  it("returns SessionContext with correct role for an active user profile", async () => {
    const mockUser = { id: "user-456", email: "admin@jsf.internal" };
    const mockProfile = {
      id: "user-456",
      role: "admin" as const,
      full_name: "Admin User",
      is_active: true,
      deleted_at: null,
      phone_e164: "+525500000001",
      preferred_locale: "es-MX",
    };

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockProfile,
              error: null,
            }),
          }),
        }),
      }),
    };
    vi.mocked(serverSupabase.createClient).mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof serverSupabase.createClient>,
    );

    const session = await requireSession(mockCookieStore);
    expect(session.user).toEqual(mockUser);
    expect(session.profile).toEqual(mockProfile);
    expect(session.role).toBe("admin");
  });

  it("getOptionalSession returns null on unauthenticated state without throwing", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: new Error("No session"),
        }),
      },
    };
    vi.mocked(serverSupabase.createClient).mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof serverSupabase.createClient>,
    );

    const session = await getOptionalSession(mockCookieStore);
    expect(session).toBeNull();
  });
});
