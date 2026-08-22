import { z } from "zod";

export const StartClientRequestSchema = z.object({
  task_id: z.string().uuid("Invalid task ID"),
});

export type StartClientRequestInput = z.infer<typeof StartClientRequestSchema>;

export const CompleteClientRequestSchema = z.object({
  task_id: z.string().uuid("Invalid task ID"),
});

export type CompleteClientRequestInput = z.infer<
  typeof CompleteClientRequestSchema
>;

export const ApproveClientDeliverableSchema = z.object({
  deliverable_id: z.string().uuid("Invalid deliverable ID"),
});

export type ApproveClientDeliverableInput = z.infer<
  typeof ApproveClientDeliverableSchema
>;

export const RequestClientDeliverableChangesSchema = z.object({
  deliverable_id: z.string().uuid("Invalid deliverable ID"),
  comments: z
    .string({ required_error: "A comment is required when requesting changes" })
    .trim()
    .min(1, "A comment is required when requesting changes")
    .max(5000, "Comment cannot exceed 5000 characters"),
});

export type RequestClientDeliverableChangesInput = z.infer<
  typeof RequestClientDeliverableChangesSchema
>;
