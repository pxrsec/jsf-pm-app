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

export const NOTIFICATION_INBOX_PAGE_SIZE = 25;

export type {
  RecipientInboxNotification,
  RecipientInboxCursor,
  RecipientInboxPage,
  RecipientInboxQuery,
  NotificationReadFilter,
} from "./inbox-contracts";

/**
 * Server-only typed inbox query calling the self-only keyset pagination RPC.
 * Discards sensitive database/event/provider details and returns a safe projection.
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

  const rows = data ?? [];
  const hasMore = rows.length > NOTIFICATION_INBOX_PAGE_SIZE;
  const retainedRows = rows.slice(0, NOTIFICATION_INBOX_PAGE_SIZE);

  const notifications: RecipientInboxNotification[] = [];

  for (const row of retainedRows) {
    if (
      !row.recipient_id ||
      !row.trigger ||
      !row.created_at ||
      !row.occurred_at
    ) {
      logger.debug("notification-row-malformed", { row });
      throw new Error("Failed to fetch notification inbox");
    }

    notifications.push({
      recipientId: row.recipient_id,
      trigger: row.trigger,
      createdAt: row.created_at,
      occurredAt: row.occurred_at,
      readAt: row.read_at ?? null,
    });
  }

  const nextCursor: RecipientInboxCursor | null =
    hasMore && retainedRows.length === NOTIFICATION_INBOX_PAGE_SIZE
      ? {
          beforeCreatedAt:
            retainedRows[NOTIFICATION_INBOX_PAGE_SIZE - 1].created_at,
          beforeRecipientId:
            retainedRows[NOTIFICATION_INBOX_PAGE_SIZE - 1].recipient_id,
        }
      : null;

  return {
    notifications,
    nextCursor,
    hasMore,
  };
}
