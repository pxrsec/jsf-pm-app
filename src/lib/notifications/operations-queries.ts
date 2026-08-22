import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { logger } from "@/lib/logger";
import { NOTIFICATION_TRIGGER_TO_CATEGORY_MAP } from "@/app/[locale]/(protected)/notificaciones/_components/types";
import { LoadSuppressedNotificationOperationsPageSchema } from "./operations-schemas";
import {
  NOTIFICATION_OPERATIONS_PAGE_SIZE,
  type SuppressedNotificationOperation,
  type SuppressedNotificationOperationsCursor,
  type SuppressedNotificationOperationsPage,
  type NotificationOperationsChannel,
} from "./operations-contracts";

export { NOTIFICATION_OPERATIONS_PAGE_SIZE } from "./operations-contracts";
export type {
  SuppressedNotificationOperation,
  SuppressedNotificationOperationsCursor,
  SuppressedNotificationOperationsPage,
} from "./operations-contracts";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidIsoDateTime(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed);
}

function isValidRawRow(
  row: Database["public"]["Functions"]["list_suppressed_notification_operations"]["Returns"][number],
): boolean {
  if (!row || typeof row !== "object") return false;

  if (typeof row.event_id !== "string" || !UUID_REGEX.test(row.event_id)) {
    return false;
  }

  if (
    typeof row.trigger !== "string" ||
    !(row.trigger in NOTIFICATION_TRIGGER_TO_CATEGORY_MAP)
  ) {
    return false;
  }

  if (row.channel !== "email" && row.channel !== "whatsapp") {
    return false;
  }

  if (row.delivery_status !== "suppressed") {
    return false;
  }

  if (row.suppression_reason !== "provider_disabled") {
    return false;
  }

  const recipientCount = Number(row.recipient_count);
  if (!Number.isSafeInteger(recipientCount) || recipientCount < 0) {
    return false;
  }

  if (row.project_name !== null && typeof row.project_name !== "string") {
    return false;
  }

  if (!isValidIsoDateTime(row.first_created_at)) {
    return false;
  }

  if (!isValidIsoDateTime(row.last_suppressed_at)) {
    return false;
  }

  return true;
}

/**
 * Server-only typed query for the authorized internal suppressed-delivery operations queue.
 * Calls list_suppressed_notification_operations with composite keyset pagination.
 * Discards sensitive database/project IDs/recipient data and returns a safe browser DTO.
 */
export async function listSuppressedNotificationOperationsPage(
  supabase: SupabaseClient<Database>,
  cursor?: SuppressedNotificationOperationsCursor | null,
): Promise<SuppressedNotificationOperationsPage> {
  let validatedCursor: SuppressedNotificationOperationsCursor | null = null;

  if (cursor !== undefined && cursor !== null) {
    const parseResult =
      LoadSuppressedNotificationOperationsPageSchema.safeParse(cursor);
    if (!parseResult.success) {
      throw new Error("Failed to fetch notification operations");
    }
    validatedCursor = parseResult.data;
  }

  const { data, error } = await supabase.rpc(
    "list_suppressed_notification_operations",
    {
      p_limit: NOTIFICATION_OPERATIONS_PAGE_SIZE + 1,
      p_before_suppressed_at: validatedCursor?.beforeSuppressedAt ?? undefined,
      p_before_event_id: validatedCursor?.beforeEventId ?? undefined,
      p_before_channel: validatedCursor?.beforeChannel ?? undefined,
    },
  );

  if (error) {
    logger.debug("notification-operations-rpc-failed", {
      operation: "list-suppressed-notification-operations",
    });
    throw new Error("Failed to fetch notification operations");
  }

  const rawRows = data ?? [];

  // Validate every raw row before projection; fail closed if any row violates invariants
  for (const rawRow of rawRows) {
    if (!isValidRawRow(rawRow)) {
      logger.debug("notification-operations-rpc-failed", {
        operation: "list-suppressed-notification-operations",
      });
      throw new Error("Failed to fetch notification operations");
    }
  }

  const hasMore = rawRows.length > NOTIFICATION_OPERATIONS_PAGE_SIZE;
  const retainedRows = rawRows.slice(0, NOTIFICATION_OPERATIONS_PAGE_SIZE);

  const operations: SuppressedNotificationOperation[] = retainedRows.map(
    (row) => ({
      eventId: row.event_id,
      channel: row.channel as NotificationOperationsChannel,
      status: "suppressed",
      reason: "provider_disabled",
      trigger: row.trigger,
      projectName: row.project_name ?? null,
      recipientCount: Number(row.recipient_count),
      firstCreatedAt: row.first_created_at,
      lastSuppressedAt: row.last_suppressed_at,
    }),
  );

  const nextCursor: SuppressedNotificationOperationsCursor | null =
    hasMore && retainedRows.length === NOTIFICATION_OPERATIONS_PAGE_SIZE
      ? {
          beforeSuppressedAt:
            retainedRows[NOTIFICATION_OPERATIONS_PAGE_SIZE - 1]
              .last_suppressed_at,
          beforeEventId:
            retainedRows[NOTIFICATION_OPERATIONS_PAGE_SIZE - 1].event_id,
          beforeChannel: retainedRows[NOTIFICATION_OPERATIONS_PAGE_SIZE - 1]
            .channel as NotificationOperationsChannel,
        }
      : null;

  return {
    operations,
    nextCursor,
    hasMore,
  };
}
