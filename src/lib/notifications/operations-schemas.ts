import { z } from "zod";

export const LoadSuppressedNotificationOperationsPageSchema = z
  .object({
    beforeSuppressedAt: z.string().datetime({ offset: true }),
    beforeEventId: z.string().uuid(),
    beforeChannel: z.enum(["email", "whatsapp"]),
  })
  .strict();

export type LoadSuppressedNotificationOperationsPageInput = z.infer<
  typeof LoadSuppressedNotificationOperationsPageSchema
>;
