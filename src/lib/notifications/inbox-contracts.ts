import type { Database } from "@/lib/database.types";

export type NotificationTrigger =
  Database["public"]["Enums"]["notification_trigger"];

export type NotificationReadFilter = "all" | "unread" | "read";

export type RecipientInboxNotification = Readonly<{
  recipientId: string;
  trigger: NotificationTrigger;
  createdAt: string;
  occurredAt: string;
  readAt: string | null;
}>;

export type RecipientInboxCursor = Readonly<{
  beforeCreatedAt: string;
  beforeRecipientId: string;
}>;

export type RecipientInboxPage = Readonly<{
  notifications: readonly RecipientInboxNotification[];
  nextCursor: RecipientInboxCursor | null;
  hasMore: boolean;
}>;

export type RecipientInboxQuery = Readonly<{
  from: string;
  to: string;
  readFilter: NotificationReadFilter;
}>;
