import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { logger } from "@/lib/logger";
import type {
  RecipientInboxNotification,
  RecipientInboxCursor,
  RecipientInboxPage,
  RecipientInboxQuery,
} from "./inbox-contracts";
import { parseAndValidateNotificationRow } from "./schemas";

export const NOTIFICATION_INBOX_PAGE_SIZE = 25;

export type {
  RecipientInboxNotification,
  RecipientInboxCursor,
  RecipientInboxPage,
  RecipientInboxQuery,
  NotificationReadFilter,
  NotificationDestination,
} from "./inbox-contracts";

/**
 * Server-only typed inbox query calling the self-only keyset pagination RPC.
 * Validates all returned rows against destination/context invariants before
 * pagination slicing and returns a safe projection.
 */
export async function listRecipientInboxPage(
  supabase: SupabaseClient<Database>,
  query: RecipientInboxQuery,
  cursor?: RecipientInboxCursor | null,
): Promise<RecipientInboxPage> {
  const pReadState =
    query.readFilter === "all"
      ? undefined
      : query.readFilter === "read"
        ? true
        : false;

  const { data, error } = await supabase.rpc("list_my_in_app_notifications", {
    p_limit: NOTIFICATION_INBOX_PAGE_SIZE + 1,
    p_from: query.from,
    p_to: query.to,
    p_read_state: pReadState,
    p_before_created_at: cursor?.beforeCreatedAt ?? undefined,
    p_before_recipient_id: cursor?.beforeRecipientId ?? undefined,
  });

  if (error) {
    logger.debug("notification-inbox-rpc-failed", {
      operation: "list-recipient-inbox",
      error: error.message,
    });
    throw new Error("Failed to fetch notification inbox");
  }

  const rawRows = (data ?? []) as unknown[];
  const validatedNotifications: RecipientInboxNotification[] = [];

  // Validate ALL returned rows (including 26th pagination probe row) before slicing
  for (const rawRow of rawRows) {
    try {
      const validated = parseAndValidateNotificationRow(rawRow);
      validatedNotifications.push(validated);
    } catch (err) {
      logger.debug("notification-inbox-validation-failed", {
        operation: "list-recipient-inbox",
        reason: err instanceof Error ? err.message : "unknown",
      });
      throw new Error("Failed to fetch notification inbox");
    }
  }

  const hasMore = validatedNotifications.length > NOTIFICATION_INBOX_PAGE_SIZE;
  const retainedNotifications = validatedNotifications.slice(
    0,
    NOTIFICATION_INBOX_PAGE_SIZE,
  );

  const nextCursor: RecipientInboxCursor | null =
    hasMore && retainedNotifications.length === NOTIFICATION_INBOX_PAGE_SIZE
      ? {
          beforeCreatedAt:
            retainedNotifications[NOTIFICATION_INBOX_PAGE_SIZE - 1].createdAt,
          beforeRecipientId:
            retainedNotifications[NOTIFICATION_INBOX_PAGE_SIZE - 1].recipientId,
        }
      : null;

  return {
    notifications: retainedNotifications,
    nextCursor,
    hasMore,
  };
}
