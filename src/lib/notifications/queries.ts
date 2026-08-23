import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { logger } from "@/lib/logger";
import { LoadRecipientInboxPageSchema } from "./schemas";
import type {
  RecipientInboxNotification,
  RecipientInboxCursor,
  RecipientInboxPage,
} from "./inbox-contracts";

export const NOTIFICATION_INBOX_PAGE_SIZE = 25;

export type {
  RecipientInboxNotification,
  RecipientInboxCursor,
  RecipientInboxPage,
} from "./inbox-contracts";

/**
 * Server-only typed inbox query calling the self-only keyset pagination RPC.
 * Discards sensitive database/event/provider details and returns a safe projection.
 */
export async function listRecipientInboxPage(
  supabase: SupabaseClient<Database>,
  cursor?: RecipientInboxCursor | null,
): Promise<RecipientInboxPage> {
  let validatedCursor: RecipientInboxCursor | null = null;

  if (cursor !== undefined && cursor !== null) {
    const parseResult = LoadRecipientInboxPageSchema.safeParse(cursor);
    if (!parseResult.success) {
      throw new Error("Failed to fetch notification inbox");
    }
    validatedCursor = parseResult.data;
  }

  const { data, error } = await supabase.rpc("list_my_in_app_notifications", {
    p_limit: NOTIFICATION_INBOX_PAGE_SIZE + 1,
    p_before_created_at: validatedCursor?.beforeCreatedAt ?? undefined,
    p_before_recipient_id: validatedCursor?.beforeRecipientId ?? undefined,
  });

  if (error) {
    logger.debug("notification-inbox-rpc-failed", {
      operation: "list-recipient-inbox",
    });
    throw new Error("Failed to fetch notification inbox");
  }

  const rows = data ?? [];
  const hasMore = rows.length > NOTIFICATION_INBOX_PAGE_SIZE;
  const retainedRows = rows.slice(0, NOTIFICATION_INBOX_PAGE_SIZE);

  const notifications: RecipientInboxNotification[] = retainedRows.map(
    (row) => ({
      recipientId: row.recipient_id,
      trigger: row.trigger,
      createdAt: row.created_at,
      occurredAt: row.occurred_at,
      readAt: row.read_at ?? null,
    }),
  );

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
