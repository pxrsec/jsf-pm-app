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

const mockRpc = vi.fn();
const mockCreateClient = vi.fn(() => ({
  rpc: (...args: unknown[]) => mockRpc(...args),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}));

const mockListRecipientInboxPage = vi.fn();
vi.mock("../queries", () => ({
  listRecipientInboxPage: (
    supabase: unknown,
    query: unknown,
    cursor: unknown,
  ) => mockListRecipientInboxPage(supabase, query, cursor),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
  loadRecipientInboxPageAction,
} from "../actions";
import { AuthError } from "@/lib/auth/session";

describe("TC-NOTIF-ACT: Notification Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.mockResolvedValue({} as never);
    mockRequireSession.mockResolvedValue({
      user: { id: "user-1" },
      profile: {
        id: "user-1",
        role: "operator",
        is_active: true,
        deleted_at: null,
      },
      role: "operator",
    });
  });

  describe("markNotificationReadAction", () => {
    it("1. Rejects non-UUID input with VALIDATION_FAILED before session/client creation", async () => {
      const result = await markNotificationReadAction({
        notificationRecipientId: "not-a-uuid",
      });

      expect(result).toEqual({
        ok: false,
        error: { code: "VALIDATION_FAILED" },
      });
      expect(mockRequireSession).not.toHaveBeenCalled();
      expect(mockCreateClient).not.toHaveBeenCalled();
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it("2. Maps AuthError to UNAUTHENTICATED", async () => {
      mockRequireSession.mockRejectedValueOnce(
        new AuthError("UNAUTHENTICATED", "No active session"),
      );

      const result = await markNotificationReadAction({
        notificationRecipientId: "00000000-0000-0000-0000-000000000001",
      });

      expect(result).toEqual({
        ok: false,
        error: { code: "UNAUTHENTICATED" },
      });
    });

    it("3. Successfully marks one notification as read and revalidates paths", async () => {
      mockRpc.mockResolvedValueOnce({ data: true, error: null });

      const result = await markNotificationReadAction({
        notificationRecipientId: "00000000-0000-0000-0000-000000000001",
      });

      expect(result).toEqual({ ok: true, changed: true });
      expect(mockRpc).toHaveBeenCalledWith("mark_notification_read", {
        p_notification_recipient_id: "00000000-0000-0000-0000-000000000001",
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/notificaciones");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/en/notificaciones");
    });
  });

  describe("markAllNotificationsReadAction", () => {
    it("1. Successfully marks all notifications as read and reports count", async () => {
      mockRpc.mockResolvedValueOnce({ data: 3, error: null });

      const result = await markAllNotificationsReadAction();

      expect(result).toEqual({ ok: true, changed: true, changedCount: 3 });
      expect(mockRpc).toHaveBeenCalledWith("mark_all_notifications_read");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/notificaciones");
    });
  });

  describe("loadRecipientInboxPageAction", () => {
    const validPayload = {
      query: {
        from: "2026-05-26T00:00:00-06:00",
        to: "2026-08-24T00:00:00-06:00",
        readFilter: "all" as const,
      },
      cursor: {
        beforeCreatedAt: "2026-08-22T12:00:00.000Z",
        beforeRecipientId: "00000000-0000-0000-0000-000000000001",
      },
    };

    it("1. Rejects invalid input with VALIDATION_FAILED", async () => {
      const result = await loadRecipientInboxPageAction({
        query: { from: "invalid", to: "invalid", readFilter: "all" },
      });

      expect(result).toEqual({
        ok: false,
        error: { code: "VALIDATION_FAILED" },
      });
    });

    it("2. Maps AuthError to UNAUTHENTICATED", async () => {
      mockRequireSession.mockRejectedValueOnce(
        new AuthError("UNAUTHENTICATED", "No active session"),
      );

      const result = await loadRecipientInboxPageAction(validPayload);

      expect(result).toEqual({
        ok: false,
        error: { code: "UNAUTHENTICATED" },
      });
    });

    it("3. Returns safe page data", async () => {
      const mockPage = {
        notifications: [],
        nextCursor: null,
        hasMore: false,
      };
      mockListRecipientInboxPage.mockResolvedValueOnce(mockPage);

      const result = await loadRecipientInboxPageAction(validPayload);

      expect(result).toEqual({
        ok: true,
        data: mockPage,
      });
    });
  });
});
