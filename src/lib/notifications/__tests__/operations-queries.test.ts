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
  listSuppressedNotificationOperationsPage,
  NOTIFICATION_OPERATIONS_PAGE_SIZE,
} from "../operations-queries";

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
  } as unknown as Parameters<
    typeof listSuppressedNotificationOperationsPage
  >[0];
}

describe("TC-NOTIF-OPS-QRY: Suppressed Notification Operations Queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. Default call passes p_limit: 26 and undefined cursor values", async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const supabase = createMockSupabase(mockRpc);

    const result = await listSuppressedNotificationOperationsPage(supabase);

    expect(mockRpc).toHaveBeenCalledWith(
      "list_suppressed_notification_operations",
      {
        p_limit: NOTIFICATION_OPERATIONS_PAGE_SIZE + 1,
        p_before_suppressed_at: undefined,
        p_before_event_id: undefined,
        p_before_channel: undefined,
      },
    );
    expect(result).toEqual({
      operations: [],
      nextCursor: null,
      hasMore: false,
    });
  });

  it("2. Valid composite cursor passes exact timestamp, event UUID, and channel", async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const supabase = createMockSupabase(mockRpc);

    const cursor = {
      beforeSuppressedAt: "2026-08-22T12:00:00.000Z",
      beforeEventId: "00000000-0000-0000-0000-000000000001",
      beforeChannel: "email" as const,
    };

    await listSuppressedNotificationOperationsPage(supabase, cursor);

    expect(mockRpc).toHaveBeenCalledWith(
      "list_suppressed_notification_operations",
      {
        p_limit: 26,
        p_before_suppressed_at: "2026-08-22T12:00:00.000Z",
        p_before_event_id: "00000000-0000-0000-0000-000000000001",
        p_before_channel: "email",
      },
    );
  });

  it("3. Malformed or partial cursor rejects before calling RPC", async () => {
    const mockRpc = vi.fn();
    const supabase = createMockSupabase(mockRpc);

    // Invalid timestamp
    await expect(
      listSuppressedNotificationOperationsPage(supabase, {
        beforeSuppressedAt: "invalid-date",
        beforeEventId: "00000000-0000-0000-0000-000000000001",
        beforeChannel: "email",
      }),
    ).rejects.toThrow("Failed to fetch notification operations");

    // Invalid event UUID
    await expect(
      listSuppressedNotificationOperationsPage(supabase, {
        beforeSuppressedAt: "2026-08-22T12:00:00.000Z",
        beforeEventId: "not-a-uuid",
        beforeChannel: "email",
      }),
    ).rejects.toThrow("Failed to fetch notification operations");

    // Invalid channel (e.g. in_app is forbidden in operations cursor)
    await expect(
      listSuppressedNotificationOperationsPage(supabase, {
        beforeSuppressedAt: "2026-08-22T12:00:00.000Z",
        beforeEventId: "00000000-0000-0000-0000-000000000001",
        beforeChannel: "in_app" as never,
      }),
    ).rejects.toThrow("Failed to fetch notification operations");

    // Partial cursor (missing channel)
    await expect(
      listSuppressedNotificationOperationsPage(supabase, {
        beforeSuppressedAt: "2026-08-22T12:00:00.000Z",
        beforeEventId: "00000000-0000-0000-0000-000000000001",
      } as never),
    ).rejects.toThrow("Failed to fetch notification operations");

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("4. Correctly narrows raw database rows and strictly excludes sensitive fields", async () => {
    const rawRows = [
      {
        event_id: "11111111-1111-1111-1111-111111111111",
        trigger: "deliverable_submitted" as const,
        project_id: "proj-secret-id",
        project_name: "Campana Verano",
        channel: "email" as const,
        delivery_status: "suppressed" as const,
        suppression_reason: "provider_disabled",
        recipient_count: 3,
        first_created_at: "2026-08-22T10:00:00.000Z",
        last_suppressed_at: "2026-08-22T10:05:00.000Z",
      },
    ];

    const supabase = createMockSupabase(async () => ({
      data: rawRows,
      error: null,
    }));

    const result = await listSuppressedNotificationOperationsPage(supabase);

    expect(result.operations).toEqual([
      {
        eventId: "11111111-1111-1111-1111-111111111111",
        channel: "email",
        status: "suppressed",
        reason: "provider_disabled",
        trigger: "deliverable_submitted",
        projectName: "Campana Verano",
        recipientCount: 3,
        firstCreatedAt: "2026-08-22T10:00:00.000Z",
        lastSuppressedAt: "2026-08-22T10:05:00.000Z",
      },
    ]);

    // Assert sensitive fields like projectId, raw payload, contact data are completely excluded
    const item = result.operations[0] as unknown as Record<string, unknown>;
    expect(item.projectId).toBeUndefined();
    expect(item.project_id).toBeUndefined();
    expect(item.deliveryStatus).toBeUndefined();
    expect(item.delivery_status).toBeUndefined();
    expect(item.suppressionReason).toBeUndefined();
    expect(item.suppression_reason).toBeUndefined();
    expect(item.provider).toBeUndefined();
    expect(item.recipients).toBeUndefined();
  });

  it("5. Fails closed on invalid/unexpected raw RPC rows", async () => {
    // Case A: invalid delivery_status
    const badStatusRow = [
      {
        event_id: "11111111-1111-1111-1111-111111111111",
        trigger: "deliverable_submitted" as const,
        project_id: "proj-1",
        project_name: "Project",
        channel: "email" as const,
        delivery_status: "sent" as never, // NOT suppressed
        suppression_reason: "provider_disabled",
        recipient_count: 1,
        first_created_at: "2026-08-22T10:00:00.000Z",
        last_suppressed_at: "2026-08-22T10:05:00.000Z",
      },
    ];

    let supabase = createMockSupabase(async () => ({
      data: badStatusRow,
      error: null,
    }));
    await expect(
      listSuppressedNotificationOperationsPage(supabase),
    ).rejects.toThrow("Failed to fetch notification operations");

    // Case B: invalid channel
    const badChannelRow = [
      {
        event_id: "11111111-1111-1111-1111-111111111111",
        trigger: "deliverable_submitted" as const,
        project_id: "proj-1",
        project_name: "Project",
        channel: "in_app" as never, // in_app is not an operations queue channel
        delivery_status: "suppressed" as const,
        suppression_reason: "provider_disabled",
        recipient_count: 1,
        first_created_at: "2026-08-22T10:00:00.000Z",
        last_suppressed_at: "2026-08-22T10:05:00.000Z",
      },
    ];

    supabase = createMockSupabase(async () => ({
      data: badChannelRow,
      error: null,
    }));
    await expect(
      listSuppressedNotificationOperationsPage(supabase),
    ).rejects.toThrow("Failed to fetch notification operations");

    // Case C: invalid recipient_count (negative)
    const badCountRow = [
      {
        event_id: "11111111-1111-1111-1111-111111111111",
        trigger: "deliverable_submitted" as const,
        project_id: "proj-1",
        project_name: "Project",
        channel: "email" as const,
        delivery_status: "suppressed" as const,
        suppression_reason: "provider_disabled",
        recipient_count: -1,
        first_created_at: "2026-08-22T10:00:00.000Z",
        last_suppressed_at: "2026-08-22T10:05:00.000Z",
      },
    ];

    supabase = createMockSupabase(async () => ({
      data: badCountRow,
      error: null,
    }));
    await expect(
      listSuppressedNotificationOperationsPage(supabase),
    ).rejects.toThrow("Failed to fetch notification operations");
  });

  it("6. Keyset pagination: 26 rows returned sets hasMore: true and nextCursor from 25th row", async () => {
    const rawRows = Array.from({ length: 26 }, (_, i) => ({
      event_id: `00000000-0000-0000-0000-${String(i + 1).padStart(12, "0")}`,
      trigger: "deliverable_submitted" as const,
      project_id: "proj-1",
      project_name: "Project 1",
      channel: (i % 2 === 0 ? "email" : "whatsapp") as "email" | "whatsapp",
      delivery_status: "suppressed" as const,
      suppression_reason: "provider_disabled",
      recipient_count: 2,
      first_created_at: `2026-08-22T12:${String(30 - i).padStart(2, "0")}:00.000Z`,
      last_suppressed_at: `2026-08-22T12:${String(30 - i).padStart(2, "0")}:00.000Z`,
    }));

    const supabase = createMockSupabase(async () => ({
      data: rawRows,
      error: null,
    }));

    const result = await listSuppressedNotificationOperationsPage(supabase);

    expect(result.operations).toHaveLength(25);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toEqual({
      beforeSuppressedAt: rawRows[24].last_suppressed_at,
      beforeEventId: rawRows[24].event_id,
      beforeChannel: rawRows[24].channel,
    });
    // Ensure sentinel row 26 was discarded and not used for nextCursor
    expect(result.nextCursor?.beforeEventId).not.toBe(rawRows[25].event_id);
  });

  it("7. When <= 25 rows returned, hasMore is false and nextCursor is null", async () => {
    const rawRows = Array.from({ length: 5 }, (_, i) => ({
      event_id: `00000000-0000-0000-0000-${String(i + 1).padStart(12, "0")}`,
      trigger: "deliverable_submitted" as const,
      project_id: null,
      project_name: null,
      channel: "email" as const,
      delivery_status: "suppressed" as const,
      suppression_reason: "provider_disabled",
      recipient_count: 1,
      first_created_at: "2026-08-22T12:00:00.000Z",
      last_suppressed_at: "2026-08-22T12:00:00.000Z",
    }));

    const supabase = createMockSupabase(async () => ({
      data: rawRows,
      error: null,
    }));

    const result = await listSuppressedNotificationOperationsPage(supabase);

    expect(result.operations).toHaveLength(5);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("8. Throws safe generic error on RPC failure without leaking database details", async () => {
    const supabase = createMockSupabase(async () => ({
      data: null,
      error: {
        message: "Internal postgres error in RPC execution",
        code: "42883",
      },
    }));

    await expect(
      listSuppressedNotificationOperationsPage(supabase),
    ).rejects.toThrow("Failed to fetch notification operations");

    expect(mockLoggerDebug).toHaveBeenCalledWith(
      "notification-operations-rpc-failed",
      {
        operation: "list-suppressed-notification-operations",
      },
    );
  });
});
