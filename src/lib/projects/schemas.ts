import { z } from "zod";

// ── Project Schemas ──────────────────────────────────────────────────────────

export const CreateProjectSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Name is required")
      .max(200, "Name is too long"),
    project_type: z.enum(["client", "internal"]),
    internal_description: z
      .string()
      .trim()
      .min(1, "Internal description is required")
      .max(2000, "Description is too long"),
    deadline_at: z
      .string()
      .datetime({ offset: true, message: "Valid ISO datetime required" }),
    client_id: z.string().uuid("Invalid client ID").nullable().optional(),
    client_scope: z
      .string()
      .trim()
      .max(1000, "Client scope is too long")
      .nullable()
      .optional(),
    drive_folder_url: z.string().url("Invalid Drive URL").nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.project_type === "internal" && data.client_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Internal project cannot have a client organization",
        path: ["client_id"],
      });
    }
  });

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

export interface CreateProjectWithTeamInput extends CreateProjectInput {
  initial_pm_lead_user_id?: string;
  initial_client_contact_user_id?: string;
}

export const UpdateProjectSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  internal_description: z.string().trim().min(1).max(2000).optional(),
  deadline_at: z.string().datetime({ offset: true }).optional(),
  client_id: z.string().uuid("Invalid client ID").nullable().optional(),
  client_scope: z.string().trim().max(1000).nullable().optional(),
  drive_folder_url: z.string().url().nullable().optional(),
});

export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

export const TransitionProjectStatusSchema = z.object({
  project_id: z.string().uuid(),
  next_status: z.enum([
    "planning",
    "in_progress",
    "paused",
    "completed",
    "cancelled",
  ]),
  confirm_unfinished: z.boolean().optional().default(false),
  reopen_reason: z.string().trim().min(1).max(500).nullable().optional(),
});

export type TransitionProjectStatusInput = z.infer<
  typeof TransitionProjectStatusSchema
>;

export const RecoverProjectStatusSchema = z.object({
  project_id: z.string().uuid(),
  target_status: z.enum(["planning", "in_progress", "paused"]),
  reason: z.string().trim().min(1, "Reason is mandatory").max(500),
});

export type RecoverProjectStatusInput = z.infer<
  typeof RecoverProjectStatusSchema
>;

export const ReopenProjectSchema = z.object({
  project_id: z.string().uuid("Invalid project ID"),
  reopen_reason: z
    .string()
    .trim()
    .min(1, "Reopen reason is required")
    .max(500, "Reopen reason cannot exceed 500 characters"),
});

export type ReopenProjectInput = z.infer<typeof ReopenProjectSchema>;

// ── Membership Schemas ───────────────────────────────────────────────────────

export const AddProjectMemberSchema = z.object({
  project_id: z.string().uuid(),
  user_id: z.string().uuid(),
  member_type: z.enum(["pm_lead", "pm_watcher", "operator", "client"]),
  is_primary: z.boolean().optional().default(false),
  receives_notifications: z.boolean().optional().default(true),
});

export type AddProjectMemberInput = z.infer<typeof AddProjectMemberSchema>;

export const UpdateProjectMemberSchema = z.object({
  member_id: z.string().uuid(),
  member_type: z
    .enum(["pm_lead", "pm_watcher", "operator", "client"])
    .optional(),
  is_primary: z.boolean().optional(),
  receives_notifications: z.boolean().optional(),
});

export type UpdateProjectMemberInput = z.infer<
  typeof UpdateProjectMemberSchema
>;

// ── Task Schemas ─────────────────────────────────────────────────────────────

export const CreateTaskSchema = z.object({
  project_id: z.string().uuid(),
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().min(1, "Description is required").max(5000),
  task_type: z.enum(["internal_work", "client_request"]),
  priority: z.enum(["low", "medium", "high", "blocking"]),
  deadline_at: z
    .string()
    .datetime({ offset: true, message: "Valid ISO datetime required" }),
  assignee_id: z.string().uuid("Invalid assignee ID"),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

export const CreateTaskDeliverableDraftSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(180, "Title is too long"),
  specifications: z
    .string()
    .trim()
    .min(1, "Specifications are required")
    .max(30000, "Specifications are too long"),
  assignee_id: z.string().uuid("Invalid assignee ID"),
  submission_deadline_at: z
    .string()
    .datetime({ offset: true })
    .nullable()
    .optional(),
  internal_review_deadline_at: z
    .string()
    .datetime({ offset: true })
    .nullable()
    .optional(),
  client_delivery_deadline_at: z
    .string()
    .datetime({ offset: true })
    .nullable()
    .optional(),
});

export type CreateTaskDeliverableDraftInput = z.infer<
  typeof CreateTaskDeliverableDraftSchema
>;

export const CreateTaskWithDeliverablesSchema = z
  .object({
    project_id: z.string().uuid("Invalid project ID"),
    title: z
      .string()
      .trim()
      .min(1, "Title is required")
      .max(200, "Title is too long"),
    description: z
      .string()
      .trim()
      .min(1, "Description is required")
      .max(5000, "Description is too long"),
    task_type: z.enum(["internal_work", "client_request"]),
    priority: z.enum(["low", "medium", "high", "blocking"]),
    deadline_at: z
      .string()
      .datetime({ offset: true, message: "Valid ISO datetime required" }),
    assignee_id: z.string().uuid("Invalid assignee ID"),
    deliverables: z
      .array(CreateTaskDeliverableDraftSchema)
      .max(20, "A task may be created with at most 20 deliverables")
      .default([]),
    milestone_ids: z
      .array(z.string().uuid("Invalid milestone ID"))
      .max(100, "A task may contribute to at most 100 milestones")
      .refine(
        (ids) => new Set(ids).size === ids.length,
        "Milestone IDs must be unique",
      )
      .default([]),
  })
  .superRefine((data, ctx) => {
    for (let i = 0; i < data.deliverables.length; i++) {
      const d = data.deliverables[i];
      if (data.task_type === "internal_work") {
        if (!d.internal_review_deadline_at) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "Internal review deadline is required for production deliverables",
            path: ["deliverables", i, "internal_review_deadline_at"],
          });
        }
        if (d.submission_deadline_at) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Production deliverables forbid submission deadline",
            path: ["deliverables", i, "submission_deadline_at"],
          });
        }
        if (d.client_delivery_deadline_at && d.internal_review_deadline_at) {
          if (
            new Date(d.client_delivery_deadline_at) <
            new Date(d.internal_review_deadline_at)
          ) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message:
                "Client delivery deadline must be on or after internal review deadline",
              path: ["deliverables", i, "client_delivery_deadline_at"],
            });
          }
        }
      } else if (data.task_type === "client_request") {
        if (!d.submission_deadline_at) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "Submission deadline is required for client submission deliverables",
            path: ["deliverables", i, "submission_deadline_at"],
          });
        }
        if (d.internal_review_deadline_at) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "Client submission deliverables forbid internal review deadline",
            path: ["deliverables", i, "internal_review_deadline_at"],
          });
        }
        if (d.client_delivery_deadline_at) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "Client submission deliverables forbid client delivery deadline",
            path: ["deliverables", i, "client_delivery_deadline_at"],
          });
        }
      }
    }
  });

export type CreateTaskWithDeliverablesInput = z.infer<
  typeof CreateTaskWithDeliverablesSchema
>;

export const UpdateTaskSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().min(1).max(5000).optional(),
  priority: z.enum(["low", "medium", "high", "blocking"]).optional(),
  deadline_at: z.string().datetime({ offset: true }).optional(),
  assignee_id: z.string().uuid().optional(),
});

export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;

export const TransitionTaskStatusSchema = z.object({
  task_id: z.string().uuid(),
  next_status: z.enum([
    "pending",
    "in_progress",
    "in_review",
    "completed",
    "blocked",
  ]),
  reopen_reason: z.string().trim().min(1).max(500).nullable().optional(),
});

export type TransitionTaskStatusInput = z.infer<
  typeof TransitionTaskStatusSchema
>;
