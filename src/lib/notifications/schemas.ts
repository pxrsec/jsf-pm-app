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

export const LoadRecipientInboxPageSchema = z
  .object({
    beforeCreatedAt: z.string().datetime({ offset: true }),
    beforeRecipientId: z.string().uuid(),
  })
  .strict();

export type LoadRecipientInboxPageInput = z.infer<
  typeof LoadRecipientInboxPageSchema
>;
