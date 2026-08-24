import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mockLoggerDebug = vi.fn();
vi.mock("@/lib/logger", () => ({
  logger: {
    debug: (...args: unknown[]) => mockLoggerDebug(...args),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  listRecipientInboxPage,
  NOTIFICATION_INBOX_PAGE_SIZE,
} from "../queries";

function createMockSupabase(
  rpcImpl: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown }>,
) {
  return {
    rpc: vi.fn((fn: string, args: Record<string, unknown>) =>
      rpcImpl(fn, args),
    ),
  } as unknown as Parameters<typeof listRecipientInboxPage>[0];
}

const defaultQuery = {
  from: "2026-05-26T00:00:00-06:00",
  to: "2026-08-24T00:00:00-06:00",
  readFilter: "all" as const,
};

describe("TC-NOTIF-QRY: Recipient Inbox Queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. Default call passes p_limit: 26, dates, p_read_state: undefined and undefined cursor values", async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const supabase = createMockSupabase(mockRpc);

    const result = await listRecipientInboxPage(supabase, defaultQuery);

    expect(mockRpc).toHaveBeenCalledWith("list_my_in_app_notifications", {
      p_limit: NOTIFICATION_INBOX_PAGE_SIZE + 1,
      p_from: defaultQuery.from,
      p_to: defaultQuery.to,
      p_read_state: undefined,
      p_before_created_at: undefined,
      p_before_recipient_id: undefined,
    });
    expect(result).toEqual({
      notifications: [],
      nextCursor: null,
      hasMore: false,
    });
  });

  it("2. M4 read-state mapping: unread -> false, read -> true", async () => {
    const mockRpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const supabase = createMockSupabase(mockRpc);

    await listRecipientInboxPage(supabase, {
      ...defaultQuery,
      readFilter: "unread",
    });
    expect(mockRpc).toHaveBeenCalledWith(
      "list_my_in_app_notifications",
      expect.objectContaining({ p_read_state: false }),
    );

    await listRecipientInboxPage(supabase, {
      ...defaultQuery,
      readFilter: "read",
    });
    expect(mockRpc).toHaveBeenCalledWith(
      "list_my_in_app_notifications",
      expect.objectContaining({ p_read_state: true }),
    );
  });

  it("3. Valid cursor passes exact timestamp and recipient UUID", async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const supabase = createMockSupabase(mockRpc);

    const cursor = {
      beforeCreatedAt: "2026-08-22T12:00:00.000Z",
      beforeRecipientId: "00000000-0000-0000-0000-000000000001",
    };

    await listRecipientInboxPage(supabase, defaultQuery, cursor);

    expect(mockRpc).toHaveBeenCalledWith("list_my_in_app_notifications", {
      p_limit: 26,
      p_from: defaultQuery.from,
      p_to: defaultQuery.to,
      p_read_state: undefined,
      p_before_created_at: "2026-08-22T12:00:00.000Z",
      p_before_recipient_id: "00000000-0000-0000-0000-000000000001",
    });
  });

  it("4. Correctly narrows raw database rows and excludes sensitive fields", async () => {
    const rawRows = [
      {
        recipient_id: "11111111-1111-1111-1111-111111111111",
        trigger: "task_assigned" as const,
        occurred_at: "2026-08-22T10:00:00.000Z",
        created_at: "2026-08-22T10:05:00.000Z",
        read_at: "2026-08-22T10:10:00.000Z",
      },
    ];

    const supabase = createMockSupabase(async () => ({
      data: rawRows,
      error: null,
    }));

    const result = await listRecipientInboxPage(supabase, defaultQuery);

    expect(result.notifications).toEqual([
      {
        recipientId: "11111111-1111-1111-1111-111111111111",
        trigger: "task_assigned",
        createdAt: "2026-08-22T10:05:00.000Z",
        occurredAt: "2026-08-22T10:00:00.000Z",
        readAt: "2026-08-22T10:10:00.000Z",
      },
    ]);
  });

  it("5. Keyset pagination: 26 rows returned sets hasMore: true and nextCursor from 25th row", async () => {
    const rawRows = Array.from({ length: 26 }, (_, i) => ({
      recipient_id: `00000000-0000-0000-0000-${String(i + 1).padStart(12, "0")}`,
      trigger: "task_assigned" as const,
      occurred_at: `2026-08-22T12:${String(30 - i).padStart(2, "0")}:00.000Z`,
      created_at: `2026-08-22T12:${String(30 - i).padStart(2, "0")}:00.000Z`,
      read_at: null,
    }));

    const supabase = createMockSupabase(async () => ({
      data: rawRows,
      error: null,
    }));

    const result = await listRecipientInboxPage(supabase, defaultQuery);

    expect(result.notifications).toHaveLength(25);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toEqual({
      beforeCreatedAt: rawRows[24].created_at,
      beforeRecipientId: rawRows[24].recipient_id,
    });
  });

  it("6. Throws safe generic error on RPC failure without leaking error details", async () => {
    const supabase = createMockSupabase(async () => ({
      data: null,
      error: { message: "Internal Postgres connection failure", code: "P0001" },
    }));

    await expect(
      listRecipientInboxPage(supabase, defaultQuery),
    ).rejects.toThrow("Failed to fetch notification inbox");

    expect(mockLoggerDebug).toHaveBeenCalledWith(
      "notification-inbox-rpc-failed",
      {
        operation: "list-recipient-inbox",
        error: "Internal Postgres connection failure",
      },
    );
  });
});
