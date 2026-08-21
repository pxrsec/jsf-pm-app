import { z } from "zod";

export const CreateCommentSchema = z.object({
  project_id: z.string().uuid("Invalid project ID"),
  target_type: z.enum(["project", "task", "deliverable"]),
  target_id: z.string().uuid("Invalid target ID"),
  body: z
    .string()
    .trim()
    .min(1, "Comment body cannot be empty")
    .max(5000, "Comment is too long"),
});

export type CreateCommentInput = z.infer<typeof CreateCommentSchema>;
