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

describe("TC-NOTIF-QRY: Recipient Inbox Queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. Default call passes p_limit: 26 and undefined cursor values", async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const supabase = createMockSupabase(mockRpc);

    const result = await listRecipientInboxPage(supabase);

    expect(mockRpc).toHaveBeenCalledWith("list_my_in_app_notifications", {
      p_limit: NOTIFICATION_INBOX_PAGE_SIZE + 1,
      p_before_created_at: undefined,
      p_before_recipient_id: undefined,
    });
    expect(result).toEqual({
      notifications: [],
      nextCursor: null,
      hasMore: false,
    });
  });

  it("2. Valid cursor passes exact timestamp and recipient UUID", async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const supabase = createMockSupabase(mockRpc);

    const cursor = {
      beforeCreatedAt: "2026-08-22T12:00:00.000Z",
      beforeRecipientId: "00000000-0000-0000-0000-000000000001",
    };

    await listRecipientInboxPage(supabase, cursor);

    expect(mockRpc).toHaveBeenCalledWith("list_my_in_app_notifications", {
      p_limit: 26,
      p_before_created_at: "2026-08-22T12:00:00.000Z",
      p_before_recipient_id: "00000000-0000-0000-0000-000000000001",
    });
  });

  it("3. Malformed or partial cursor rejects before calling RPC", async () => {
    const mockRpc = vi.fn();
    const supabase = createMockSupabase(mockRpc);

    // Invalid timestamp
    await expect(
      listRecipientInboxPage(supabase, {
        beforeCreatedAt: "invalid-date",
        beforeRecipientId: "00000000-0000-0000-0000-000000000001",
      }),
    ).rejects.toThrow("Failed to fetch notification inbox");

    // Invalid UUID
    await expect(
      listRecipientInboxPage(supabase, {
        beforeCreatedAt: "2026-08-22T12:00:00.000Z",
        beforeRecipientId: "not-a-uuid",
      }),
    ).rejects.toThrow("Failed to fetch notification inbox");

    // Partial cursor (missing property)
    await expect(
      listRecipientInboxPage(supabase, {
        beforeCreatedAt: "2026-08-22T12:00:00.000Z",
      } as unknown as { beforeCreatedAt: string; beforeRecipientId: string }),
    ).rejects.toThrow("Failed to fetch notification inbox");

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("4. Correctly narrows raw database rows and excludes sensitive fields", async () => {
    const rawRows = [
      {
        recipient_id: "11111111-1111-1111-1111-111111111111",
        event_id: "evt-secret-1",
        trigger: "task_assigned" as const,
        entity_type: "task" as const,
        entity_id: "task-123",
        project_id: "proj-456",
        occurred_at: "2026-08-22T10:00:00.000Z",
        created_at: "2026-08-22T10:05:00.000Z",
        read_at: "2026-08-22T10:10:00.000Z",
        delivery_status: "read" as const,
      },
    ];

    const supabase = createMockSupabase(async () => ({
      data: rawRows,
      error: null,
    }));

    const result = await listRecipientInboxPage(supabase);

    expect(result.notifications).toEqual([
      {
        recipientId: "11111111-1111-1111-1111-111111111111",
        trigger: "task_assigned",
        createdAt: "2026-08-22T10:05:00.000Z",
        occurredAt: "2026-08-22T10:00:00.000Z",
        readAt: "2026-08-22T10:10:00.000Z",
      },
    ]);

    // Assert sensitive/operational properties are completely absent
    const item = result.notifications[0] as unknown as Record<string, unknown>;
    expect(item.eventId).toBeUndefined();
    expect(item.event_id).toBeUndefined();
    expect(item.entityType).toBeUndefined();
    expect(item.entity_type).toBeUndefined();
    expect(item.entityId).toBeUndefined();
    expect(item.entity_id).toBeUndefined();
    expect(item.projectId).toBeUndefined();
    expect(item.project_id).toBeUndefined();
    expect(item.deliveryStatus).toBeUndefined();
    expect(item.delivery_status).toBeUndefined();
  });

  it("5. Correctly normalizes read_at: null to readAt: null", async () => {
    const rawRows = [
      {
        recipient_id: "22222222-2222-2222-2222-222222222222",
        event_id: "evt-2",
        trigger: "project_assigned" as const,
        entity_type: "project" as const,
        entity_id: "proj-1",
        project_id: "proj-1",
        occurred_at: "2026-08-22T11:00:00.000Z",
        created_at: "2026-08-22T11:00:00.000Z",
        read_at: null as unknown as string,
        delivery_status: "pending" as const,
      },
    ];

    const supabase = createMockSupabase(async () => ({
      data: rawRows,
      error: null,
    }));

    const result = await listRecipientInboxPage(supabase);

    expect(result.notifications[0].readAt).toBeNull();
  });

  it("6. Keyset pagination: 26 rows returned sets hasMore: true and nextCursor from 25th row", async () => {
    const rawRows = Array.from({ length: 26 }, (_, i) => ({
      recipient_id: `00000000-0000-0000-0000-${String(i + 1).padStart(12, "0")}`,
      event_id: `evt-${i + 1}`,
      trigger: "task_assigned" as const,
      entity_type: "task" as const,
      entity_id: `task-${i + 1}`,
      project_id: "proj-1",
      occurred_at: `2026-08-22T12:${String(30 - i).padStart(2, "0")}:00.000Z`,
      created_at: `2026-08-22T12:${String(30 - i).padStart(2, "0")}:00.000Z`,
      read_at: null as unknown as string,
      delivery_status: "pending" as const,
    }));

    const supabase = createMockSupabase(async () => ({
      data: rawRows,
      error: null,
    }));

    const result = await listRecipientInboxPage(supabase);

    expect(result.notifications).toHaveLength(25);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toEqual({
      beforeCreatedAt: rawRows[24].created_at,
      beforeRecipientId: rawRows[24].recipient_id,
    });
    // Ensure sentinel row 26 was discarded and not used for nextCursor
    expect(result.nextCursor?.beforeRecipientId).not.toBe(
      rawRows[25].recipient_id,
    );
  });

  it("7. When <= 25 rows returned, hasMore is false and nextCursor is null", async () => {
    const rawRows = Array.from({ length: 10 }, (_, i) => ({
      recipient_id: `00000000-0000-0000-0000-${String(i + 1).padStart(12, "0")}`,
      event_id: `evt-${i + 1}`,
      trigger: "task_assigned" as const,
      entity_type: "task" as const,
      entity_id: `task-${i + 1}`,
      project_id: "proj-1",
      occurred_at: `2026-08-22T12:00:00.000Z`,
      created_at: `2026-08-22T12:00:00.000Z`,
      read_at: null as unknown as string,
      delivery_status: "pending" as const,
    }));

    const supabase = createMockSupabase(async () => ({
      data: rawRows,
      error: null,
    }));

    const result = await listRecipientInboxPage(supabase);

    expect(result.notifications).toHaveLength(10);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("8. Throws safe generic error on RPC failure without leaking error details", async () => {
    const supabase = createMockSupabase(async () => ({
      data: null,
      error: { message: "Internal Postgres connection failure", code: "P0001" },
    }));

    await expect(listRecipientInboxPage(supabase)).rejects.toThrow(
      "Failed to fetch notification inbox",
    );

    expect(mockLoggerDebug).toHaveBeenCalledWith(
      "notification-inbox-rpc-failed",
      {
        operation: "list-recipient-inbox",
      },
    );
  });
});
