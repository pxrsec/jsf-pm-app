import { z } from "zod";

export const FinalizedArchiveStatusSchema = z.enum(["approved", "delivered"]);

export const LinkIncidentStatusSchema = z.enum([
  "open",
  "resolved",
  "dismissed",
]);

export const FinalizedArchiveQuerySchema = z
  .object({
    from: z.string().datetime({ offset: true }),
    to: z.string().datetime({ offset: true }),
    status: FinalizedArchiveStatusSchema.optional(),
    projectId: z.string().uuid().optional(),
  })
  .strict()
  .refine(
    (data) => {
      const fromTime = new Date(data.from).getTime();
      const toTime = new Date(data.to).getTime();
      return fromTime < toTime && toTime - fromTime <= 93 * 24 * 60 * 60 * 1000;
    },
    {
      message: "Invalid archive date range (from must be < to and <= 93 days)",
    },
  );

export const FinalizedArchiveCursorSchema = z
  .object({
    beforeFinalizedAt: z.string().datetime({ offset: true }),
    beforeDeliverableId: z.string().uuid(),
  })
  .strict();

export const LoadFinalizedArchivePageSchema = z
  .object({
    query: FinalizedArchiveQuerySchema,
    cursor: FinalizedArchiveCursorSchema.nullable().optional(),
  })
  .strict();

export type LoadFinalizedArchivePageInput = z.infer<
  typeof LoadFinalizedArchivePageSchema
>;

export const LinkIncidentQuerySchema = z
  .object({
    from: z.string().datetime({ offset: true }),
    to: z.string().datetime({ offset: true }),
    status: LinkIncidentStatusSchema.optional(),
    projectId: z.string().uuid().optional(),
  })
  .strict()
  .refine(
    (data) => {
      const fromTime = new Date(data.from).getTime();
      const toTime = new Date(data.to).getTime();
      return fromTime < toTime && toTime - fromTime <= 93 * 24 * 60 * 60 * 1000;
    },
    {
      message: "Invalid incident date range (from must be < to and <= 93 days)",
    },
  );

export const LinkIncidentCursorSchema = z
  .object({
    beforeReportedAt: z.string().datetime({ offset: true }),
    beforeIncidentId: z.string().uuid(),
  })
  .strict();

export const LoadLinkIncidentPageSchema = z
  .object({
    query: LinkIncidentQuerySchema,
    cursor: LinkIncidentCursorSchema.nullable().optional(),
  })
  .strict();

export type LoadLinkIncidentPageInput = z.infer<
  typeof LoadLinkIncidentPageSchema
>;
