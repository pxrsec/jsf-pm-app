import { z } from "zod";

export const OperationalLifecycleEntityTypeSchema = z.enum([
  "project",
  "task",
  "deliverable",
  "milestone",
]);

export const OperationalLifecycleIdSchema = z.string().uuid();

export const ArchiveOperationalEntitySchema = z
  .object({
    entityType: OperationalLifecycleEntityTypeSchema,
    entityId: OperationalLifecycleIdSchema,
    reason: z.string().trim().min(1).max(1000).nullable().optional(),
  })
  .strict();

export const RestoreOperationalEntitySchema = z
  .object({
    entityType: OperationalLifecycleEntityTypeSchema,
    entityId: OperationalLifecycleIdSchema,
  })
  .strict();

export const RestoreArchivedOperationalEntitySchema =
  RestoreOperationalEntitySchema;
export const DeletionPreviewSchema = RestoreOperationalEntitySchema;
export const GetOperationalDeletionPreviewSchema =
  RestoreOperationalEntitySchema;
export const PermanentDeletionSchema = RestoreOperationalEntitySchema;
export const PermanentlyDeleteOperationalEntitySchema =
  RestoreOperationalEntitySchema;

export type ArchiveOperationalEntityInput = z.infer<
  typeof ArchiveOperationalEntitySchema
>;
export type RestoreOperationalEntityInput = z.infer<
  typeof RestoreOperationalEntitySchema
>;
export type DeletionPreviewInput = z.infer<typeof DeletionPreviewSchema>;
export type PermanentDeletionInput = z.infer<typeof PermanentDeletionSchema>;

export function normalizeArchiveInput(
  rawInput: unknown,
): Record<string, unknown> {
  if (rawInput && typeof rawInput === "object" && !Array.isArray(rawInput)) {
    const input = rawInput as Record<string, unknown>;
    return {
      ...input,
      reason:
        typeof input.reason === "string" && input.reason.trim() === ""
          ? null
          : typeof input.reason === "string"
            ? input.reason.trim()
            : (input.reason ?? null),
    };
  }
  return {};
}
