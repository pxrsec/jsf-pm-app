import type { NotificationTrigger } from "./inbox-contracts";

export type NotificationOperationsChannel = "email" | "whatsapp";
export type NotificationOperationsStatus = "suppressed";
export type NotificationSuppressionReason = "provider_disabled";

export type SuppressedNotificationOperation = Readonly<{
  eventId: string; // opaque cursor-only value; never rendered, routed, logged, or labelled
  channel: NotificationOperationsChannel;
  status: NotificationOperationsStatus;
  reason: NotificationSuppressionReason;
  trigger: NotificationTrigger;
  projectName: string | null;
  recipientCount: number;
  firstCreatedAt: string;
  lastSuppressedAt: string;
}>;

export type SuppressedNotificationOperationsCursor = Readonly<{
  beforeSuppressedAt: string;
  beforeEventId: string;
  beforeChannel: NotificationOperationsChannel;
}>;

export type SuppressedNotificationOperationsPage = Readonly<{
  operations: readonly SuppressedNotificationOperation[];
  nextCursor: SuppressedNotificationOperationsCursor | null;
  hasMore: boolean;
}>;

export const NOTIFICATION_OPERATIONS_PAGE_SIZE = 25;
