import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const mockCookies = vi.fn();
vi.mock("next/headers", () => ({
  cookies: () => mockCookies(),
}));

const mockRequireSession = vi.fn();
vi.mock("@/lib/auth/session", () => {
  class AuthError extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = "AuthError";
      this.code = code;
    }
  }

  return {
    AuthError,
    requireSession: (cookieStore: unknown) => mockRequireSession(cookieStore),
  };
});

const mockListSuppressedNotificationOperationsPage = vi.fn();
vi.mock("../operations-queries", () => ({
  listSuppressedNotificationOperationsPage: (
    supabase: unknown,
    cursor: unknown,
  ) => mockListSuppressedNotificationOperationsPage(supabase, cursor),
}));

const mockFrom = vi.fn();
const mockCreateClient = vi.fn(() => ({
  from: mockFrom,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { loadSuppressedNotificationOperationsPageAction } from "../operations-actions";
import { AuthError } from "@/lib/auth/session";

function setupMembershipQuery(data: unknown[] | null, error: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data, error }),
  };
  mockFrom.mockReturnValue(chain);
  return chain;
}

describe("TC-NOTIF-OPS-ACT: Suppressed Notification Operations Server Actions", () => {
  const validCursor = {
    beforeSuppressedAt: "2026-08-22T12:00:00.000Z",
    beforeEventId: "00000000-0000-0000-0000-000000000001",
    beforeChannel: "email" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.mockResolvedValue({} as never);
  });

  it("1. Rejects invalid cursor input with VALIDATION_FAILED before session/client creation", async () => {
    const result = await loadSuppressedNotificationOperationsPageAction({
      beforeSuppressedAt: "invalid-date",
      beforeEventId: "not-a-uuid",
      beforeChannel: "email",
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "VALIDATION_FAILED" },
    });
    expect(mockRequireSession).not.toHaveBeenCalled();
    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(mockListSuppressedNotificationOperationsPage).not.toHaveBeenCalled();
  });

  it("2. Maps AuthError to UNAUTHORIZED", async () => {
    mockRequireSession.mockRejectedValueOnce(
      new AuthError("UNAUTHENTICATED", "No active session"),
    );

    const result =
      await loadSuppressedNotificationOperationsPageAction(validCursor);

    expect(result).toEqual({
      ok: false,
      error: { code: "UNAUTHORIZED" },
    });
    expect(mockListSuppressedNotificationOperationsPage).not.toHaveBeenCalled();
  });

  it("3. Re-throws unexpected non-AuthError exceptions from requireSession", async () => {
    mockRequireSession.mockRejectedValueOnce(new Error("Unexpected crash"));

    await expect(
      loadSuppressedNotificationOperationsPageAction(validCursor),
    ).rejects.toThrow("Unexpected crash");
  });

  it("4. PM Watcher (no active PM lead membership) returns UNAUTHORIZED without calling queue query", async () => {
    mockRequireSession.mockResolvedValueOnce({
      user: { id: "pm-watcher-1" },
      profile: {
        id: "pm-watcher-1",
        role: "pm",
        is_active: true,
        deleted_at: null,
      },
      role: "pm",
    });

    // PM Lead query returns empty array (no lead membership)
    setupMembershipQuery([]);

    const result =
      await loadSuppressedNotificationOperationsPageAction(validCursor);

    expect(result).toEqual({
      ok: false,
      error: { code: "UNAUTHORIZED" },
    });
    expect(mockFrom).toHaveBeenCalledWith("project_members");
    expect(mockListSuppressedNotificationOperationsPage).not.toHaveBeenCalled();
  });

  it("5. PM Lead (active PM lead membership) succeeds and calls queue query exactly once", async () => {
    mockRequireSession.mockResolvedValueOnce({
      user: { id: "pm-lead-1" },
      profile: {
        id: "pm-lead-1",
        role: "pm",
        is_active: true,
        deleted_at: null,
      },
      role: "pm",
    });

    // PM Lead query finds active lead membership
    const membershipChain = setupMembershipQuery([
      {
        id: "pm-member-1",
        profiles: { is_active: true, deleted_at: null, role: "pm" },
      },
    ]);

    const mockPage = {
      operations: [],
      nextCursor: null,
      hasMore: false,
    };
    mockListSuppressedNotificationOperationsPage.mockResolvedValueOnce(
      mockPage,
    );

    const result =
      await loadSuppressedNotificationOperationsPageAction(validCursor);

    expect(mockFrom).toHaveBeenCalledWith("project_members");
    expect(membershipChain.limit).toHaveBeenCalledWith(1);
    expect(mockListSuppressedNotificationOperationsPage).toHaveBeenCalledTimes(
      1,
    );
    expect(result).toEqual({
      ok: true,
      data: mockPage,
    });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("6. Membership query error fails closed as UNAUTHORIZED", async () => {
    mockRequireSession.mockResolvedValueOnce({
      user: { id: "pm-1" },
      profile: {
        id: "pm-1",
        role: "pm",
        is_active: true,
        deleted_at: null,
      },
      role: "pm",
    });

    // Database error during membership check
    setupMembershipQuery(null, { message: "DB timeout" });

    const result =
      await loadSuppressedNotificationOperationsPageAction(validCursor);

    expect(result).toEqual({
      ok: false,
      error: { code: "UNAUTHORIZED" },
    });
    expect(mockListSuppressedNotificationOperationsPage).not.toHaveBeenCalled();
  });

  it("7. Admin succeeds globally without performing a membership query", async () => {
    mockRequireSession.mockResolvedValueOnce({
      user: { id: "admin-1" },
      profile: {
        id: "admin-1",
        role: "admin",
        is_active: true,
        deleted_at: null,
      },
      role: "admin",
    });

    const mockPage = {
      operations: [
        {
          eventId: "00000000-0000-0000-0000-000000000001",
          channel: "email" as const,
          status: "suppressed" as const,
          reason: "provider_disabled" as const,
          trigger: "deliverable_submitted" as const,
          projectName: null,
          recipientCount: 2,
          firstCreatedAt: "2026-08-22T10:00:00.000Z",
          lastSuppressedAt: "2026-08-22T10:05:00.000Z",
        },
      ],
      nextCursor: null,
      hasMore: false,
    };
    mockListSuppressedNotificationOperationsPage.mockResolvedValueOnce(
      mockPage,
    );

    const result =
      await loadSuppressedNotificationOperationsPageAction(validCursor);

    // No project_members query for Admin
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockListSuppressedNotificationOperationsPage).toHaveBeenCalledTimes(
      1,
    );
    expect(result).toEqual({
      ok: true,
      data: mockPage,
    });
  });

  it("8. Operator and Client roles return UNAUTHORIZED", async () => {
    mockRequireSession.mockResolvedValueOnce({
      user: { id: "operator-1" },
      profile: {
        id: "operator-1",
        role: "operator",
        is_active: true,
        deleted_at: null,
      },
      role: "operator",
    });

    const result =
      await loadSuppressedNotificationOperationsPageAction(validCursor);

    expect(result).toEqual({
      ok: false,
      error: { code: "UNAUTHORIZED" },
    });
    expect(mockListSuppressedNotificationOperationsPage).not.toHaveBeenCalled();
  });

  it("9. Maps query failure to UNAVAILABLE", async () => {
    mockRequireSession.mockResolvedValueOnce({
      user: { id: "admin-1" },
      profile: {
        id: "admin-1",
        role: "admin",
        is_active: true,
        deleted_at: null,
      },
      role: "admin",
    });

    mockListSuppressedNotificationOperationsPage.mockRejectedValueOnce(
      new Error("Failed to fetch notification operations"),
    );

    const result =
      await loadSuppressedNotificationOperationsPageAction(validCursor);

    expect(result).toEqual({
      ok: false,
      error: { code: "UNAVAILABLE" },
    });
  });
});
