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

function createValid14FieldRow(overrides: Record<string, unknown> = {}) {
  return {
    recipient_id: "11111111-1111-1111-1111-111111111111",
    trigger: "task_assigned",
    created_at: "2026-08-22T10:05:00.000Z",
    occurred_at: "2026-08-22T10:00:00.000Z",
    read_at: "2026-08-22T10:10:00.000Z",
    subject_kind: "task",
    subject_title: "Social Media Cut",
    project_name: "Acme Sandbox Campaign",
    context_kind: "none",
    context_value: null,
    navigation_kind: "operator_task",
    navigation_project_id: null,
    navigation_task_id: "22222222-2222-2222-2222-222222222222",
    navigation_deliverable_id: null,
    ...overrides,
  };
}

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

  it("4. Correctly narrows raw 14-field database rows to safe DTO", async () => {
    const rawRows = [
      createValid14FieldRow({
        recipient_id: "11111111-1111-1111-1111-111111111111",
        trigger: "task_assigned",
        subject_kind: "task",
        subject_title: "Color Grading",
        project_name: "Acme Sandbox Campaign",
        context_kind: "none",
        context_value: null,
        navigation_kind: "operator_task",
        navigation_task_id: "22222222-2222-2222-2222-222222222222",
      }),
      createValid14FieldRow({
        recipient_id: "22222222-2222-2222-2222-222222222222",
        trigger: "deadline_24h",
        subject_kind: "task",
        subject_title: "Audio Mix",
        project_name: "Acme Sandbox Campaign",
        context_kind: "task_deadline",
        context_value: "2026-08-25T18:00:00.000Z",
        navigation_kind: "pm_project_tasks",
        navigation_project_id: "33333333-3333-3333-3333-333333333333",
        navigation_task_id: null,
      }),
      createValid14FieldRow({
        recipient_id: "33333333-3333-3333-3333-333333333333",
        trigger: "user_invited",
        subject_kind: "invitation",
        subject_title: null,
        project_name: null,
        context_kind: "none",
        context_value: null,
        navigation_kind: "none",
        navigation_project_id: null,
        navigation_task_id: null,
        navigation_deliverable_id: null,
      }),
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
        subjectKind: "task",
        subjectTitle: "Color Grading",
        projectName: "Acme Sandbox Campaign",
        contextKind: "none",
        contextValue: null,
        destination: {
          kind: "operator_task",
          taskId: "22222222-2222-2222-2222-222222222222",
        },
      },
      {
        recipientId: "22222222-2222-2222-2222-222222222222",
        trigger: "deadline_24h",
        createdAt: "2026-08-22T10:05:00.000Z",
        occurredAt: "2026-08-22T10:00:00.000Z",
        readAt: "2026-08-22T10:10:00.000Z",
        subjectKind: "task",
        subjectTitle: "Audio Mix",
        projectName: "Acme Sandbox Campaign",
        contextKind: "task_deadline",
        contextValue: "2026-08-25T18:00:00.000Z",
        destination: {
          kind: "pm_project_tasks",
          projectId: "33333333-3333-3333-3333-333333333333",
        },
      },
      {
        recipientId: "33333333-3333-3333-3333-333333333333",
        trigger: "user_invited",
        createdAt: "2026-08-22T10:05:00.000Z",
        occurredAt: "2026-08-22T10:00:00.000Z",
        readAt: "2026-08-22T10:10:00.000Z",
        subjectKind: "invitation",
        subjectTitle: null,
        projectName: null,
        contextKind: "none",
        contextValue: null,
        destination: { kind: "none" },
      },
    ]);
  });

  it("5. Keyset pagination: 26 rows returned sets hasMore: true and nextCursor from 25th row", async () => {
    const rawRows = Array.from({ length: 26 }, (_, i) =>
      createValid14FieldRow({
        recipient_id: `00000000-0000-0000-0000-${String(i + 1).padStart(12, "0")}`,
        trigger: "task_assigned",
        created_at: `2026-08-22T12:${String(30 - i).padStart(2, "0")}:00.000Z`,
        occurred_at: `2026-08-22T12:${String(30 - i).padStart(2, "0")}:00.000Z`,
        navigation_kind: "operator_task",
        navigation_task_id: "22222222-2222-2222-2222-222222222222",
      }),
    );

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

  it("6. Fails closed before slicing when 26th probe row is malformed", async () => {
    const rawRows = Array.from({ length: 25 }, (_, i) =>
      createValid14FieldRow({
        recipient_id: `00000000-0000-0000-0000-${String(i + 1).padStart(12, "0")}`,
      }),
    );
    // Add invalid 26th row (e.g. missing required taskId for operator_task)
    rawRows.push(
      createValid14FieldRow({
        recipient_id: "00000000-0000-0000-0000-000000000026",
        navigation_kind: "operator_task",
        navigation_task_id: null,
      }),
    );

    const supabase = createMockSupabase(async () => ({
      data: rawRows,
      error: null,
    }));

    await expect(
      listRecipientInboxPage(supabase, defaultQuery),
    ).rejects.toThrow("Failed to fetch notification inbox");

    expect(mockLoggerDebug).toHaveBeenCalledWith(
      "notification-inbox-validation-failed",
      expect.objectContaining({ operation: "list-recipient-inbox" }),
    );
  });

  it("7. Fails closed on destination invariant violation (none kind with non-null ID)", async () => {
    const rawRows = [
      createValid14FieldRow({
        navigation_kind: "none",
        navigation_project_id: "11111111-1111-1111-1111-111111111111",
      }),
    ];

    const supabase = createMockSupabase(async () => ({
      data: rawRows,
      error: null,
    }));

    await expect(
      listRecipientInboxPage(supabase, defaultQuery),
    ).rejects.toThrow("Failed to fetch notification inbox");
  });

  it("8. Fails closed on invalid task_deadline context value", async () => {
    const rawRows = [
      createValid14FieldRow({
        context_kind: "task_deadline",
        context_value: "not-a-date",
      }),
    ];

    const supabase = createMockSupabase(async () => ({
      data: rawRows,
      error: null,
    }));

    await expect(
      listRecipientInboxPage(supabase, defaultQuery),
    ).rejects.toThrow("Failed to fetch notification inbox");
  });

  it("9. Throws safe generic error on RPC failure without leaking raw row data", async () => {
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
