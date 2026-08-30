import { z } from "zod";

export const CalendarViewSchema = z.enum(["month", "week", "agenda", "list"]);
export const MilestoneIdValueSchema = z.string().uuid();
const offsetIso = z.string().datetime({ offset: true });
export const CalendarFeedParamsSchema = z
  .object({
    from: offsetIso,
    to: offsetIso,
    projectId: MilestoneIdValueSchema.optional(),
    view: CalendarViewSchema.optional(),
  })
  .refine(({ from, to }) => new Date(from) < new Date(to), {
    path: ["to"],
    message: "p_from must precede p_to",
  })
  .refine(
    ({ from, to }) =>
      new Date(to).getTime() - new Date(from).getTime() <= 93 * 86400000,
    { path: ["to"], message: "Calendar range must not exceed 93 days" },
  );
export const CalendarColorOverrideSchema = z
  .enum(["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"])
  .nullable()
  .optional();
const milestoneFields = z
  .object({
    scope: z.enum(["project", "company"]),
    projectId: MilestoneIdValueSchema.nullable().optional(),
    title: z.string().trim().min(1).max(160),
    description: z
      .string()
      .trim()
      .max(2000)
      .nullable()
      .optional()
      .transform((value) => value || null),
    targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    colorOverride: CalendarColorOverrideSchema.transform(
      (value) => value || null,
    ),
    taskIds: z
      .array(MilestoneIdValueSchema)
      .max(100)
      .refine(
        (value) => new Set(value).size === value.length,
        "Task IDs must be unique",
      ),
  })
  .superRefine((value, context) => {
    if (value.scope === "project" && !value.projectId)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["projectId"],
        message: "Project is required",
      });
    if (value.scope === "company" && value.projectId)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["projectId"],
        message: "Company milestones cannot have a project",
      });
  });
export const CreateMilestoneSchema = milestoneFields;
export const UpdateMilestoneSchema = z
  .object({ milestoneId: MilestoneIdValueSchema })
  .and(milestoneFields);
export const DeleteMilestoneSchema = z.object({
  milestoneId: MilestoneIdValueSchema,
});
export const MilestoneIdSchema = z.object({
  milestoneId: MilestoneIdValueSchema,
});
export type CreateMilestoneInput = z.infer<typeof CreateMilestoneSchema>;
export type UpdateMilestoneInput = z.infer<typeof UpdateMilestoneSchema>;
