import { z } from "zod";

export const MarkNotificationReadSchema = z
  .object({
    notificationRecipientId: z.string().uuid(),
  })
  .strict();

export type MarkNotificationReadInput = z.infer<
  typeof MarkNotificationReadSchema
>;

export const MarkAllNotificationsReadSchema = z.object({}).strict();

export type MarkAllNotificationsReadInput = z.infer<
  typeof MarkAllNotificationsReadSchema
>;

export const NotificationReadFilterSchema = z.enum(["all", "unread", "read"]);

export const RecipientInboxQuerySchema = z
  .object({
    from: z.string().datetime({ offset: true }),
    to: z.string().datetime({ offset: true }),
    readFilter: NotificationReadFilterSchema,
  })
  .strict()
  .refine(
    (data) => {
      const fromTime = new Date(data.from).getTime();
      const toTime = new Date(data.to).getTime();
      return fromTime < toTime && toTime - fromTime <= 93 * 24 * 60 * 60 * 1000;
    },
    {
      message:
        "Invalid notification date range (from must be < to and <= 93 days)",
    },
  );

export const RecipientInboxCursorSchema = z
  .object({
    beforeCreatedAt: z.string().datetime({ offset: true }),
    beforeRecipientId: z.string().uuid(),
  })
  .strict();

export const LoadRecipientInboxPageSchema = z
  .object({
    query: RecipientInboxQuerySchema,
    cursor: RecipientInboxCursorSchema.nullable().optional(),
  })
  .strict();

export type LoadRecipientInboxPageInput = z.infer<
  typeof LoadRecipientInboxPageSchema
>;
