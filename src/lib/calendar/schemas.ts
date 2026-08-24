import { z } from "zod";

const isoDatetimeRegex =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/;

const offsetIsoString = z
  .string()
  .min(1, "Datetime is required")
  .refine(
    (val) => isoDatetimeRegex.test(val) && !isNaN(Date.parse(val)),
    "Must be a valid offset-bearing ISO timestamp",
  );

export const CalendarViewSchema = z.enum(["month", "week", "agenda", "list"]);

export const CalendarColorOverrideSchema = z
  .enum(["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"])
  .nullable()
  .optional();

export const CalendarFeedParamsSchema = z
  .object({
    from: offsetIsoString,
    to: offsetIsoString,
    projectId: z.string().uuid("Invalid project UUID").optional(),
    view: CalendarViewSchema.optional(),
  })
  .refine(
    (data) => {
      const fromTime = new Date(data.from).getTime();
      const toTime = new Date(data.to).getTime();
      return fromTime < toTime;
    },
    {
      message: "p_from must precede p_to",
      path: ["to"],
    },
  )
  .refine(
    (data) => {
      const fromTime = new Date(data.from).getTime();
      const toTime = new Date(data.to).getTime();
      const maxRangeMs = 93 * 24 * 60 * 60 * 1000;
      return toTime - fromTime <= maxRangeMs;
    },
    {
      message: "Calendar range must not exceed 93 days",
      path: ["to"],
    },
  );

const BaseMilestoneObjectSchema = z.object({
  projectId: z.string().uuid("Invalid project UUID"),
  taskId: z
    .string()
    .uuid("Invalid task UUID")
    .nullable()
    .optional()
    .transform((val) => (val ? val : null)),
  title: z
    .string({ required_error: "Milestone title is required" })
    .trim()
    .min(1, "Milestone title must contain at least 1 character")
    .max(160, "Milestone title must not exceed 160 characters"),
  description: z
    .string()
    .trim()
    .max(2000, "Description must not exceed 2000 characters")
    .nullable()
    .optional()
    .transform((val) => (val && val.length > 0 ? val : null)),
  startsAt: offsetIsoString,
  endsAt: offsetIsoString
    .nullable()
    .optional()
    .transform((val) => (val ? val : null)),
  isAllDay: z.boolean({ required_error: "isAllDay is required" }),
  colorOverride: CalendarColorOverrideSchema.transform((val) =>
    val ? val : null,
  ),
});

const refineDateOrdering = (data: {
  startsAt: string;
  endsAt?: string | null;
}) => {
  if (!data.endsAt) return true;
  const start = new Date(data.startsAt).getTime();
  const end = new Date(data.endsAt).getTime();
  return end >= start;
};

export const CreateCalendarMilestoneSchema = BaseMilestoneObjectSchema.refine(
  refineDateOrdering,
  {
    message: "ends_at must not precede starts_at",
    path: ["endsAt"],
  },
);

export const UpdateCalendarMilestoneSchema = BaseMilestoneObjectSchema.extend({
  eventId: z.string().uuid("Invalid milestone UUID"),
}).refine(refineDateOrdering, {
  message: "ends_at must not precede starts_at",
  path: ["endsAt"],
});

export const DeleteCalendarMilestoneSchema = z.object({
  eventId: z.string().uuid("Invalid milestone UUID"),
});

export const GetMilestoneEditDetailSchema = z.object({
  eventId: z.string().uuid("Invalid milestone UUID"),
});

export type CreateCalendarMilestoneInput = z.input<
  typeof CreateCalendarMilestoneSchema
>;
export type UpdateCalendarMilestoneInput = z.input<
  typeof UpdateCalendarMilestoneSchema
>;
export type DeleteCalendarMilestoneInput = z.input<
  typeof DeleteCalendarMilestoneSchema
>;
export type GetMilestoneEditDetailInput = z.input<
  typeof GetMilestoneEditDetailSchema
>;
