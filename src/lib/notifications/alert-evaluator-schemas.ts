import { z } from "zod";

export const EvaluateAlertsAsAdminSchema = z.object({}).strict();

export const EvaluateAlertsAsPmLeadSchema = z
  .object({
    projectId: z.string().uuid(),
  })
  .strict();

export const AlertEvaluationRawSummarySchema = z
  .object({
    tasks_evaluated: z.number().finite().int().nonnegative().safe(),
    reviews_evaluated: z.number().finite().int().nonnegative().safe(),
    events_created: z.number().finite().int().nonnegative().safe(),
    in_app_recipients_created: z.number().finite().int().nonnegative().safe(),
    external_suppressions_created: z
      .number()
      .finite()
      .int()
      .nonnegative()
      .safe(),
  })
  .strict();

export type AlertEvaluationSummary = Readonly<{
  tasksEvaluated: number;
  reviewsEvaluated: number;
  eventsCreated: number;
  inAppRecipientsCreated: number;
  externalSuppressionsCreated: number;
}>;

export type AlertEvaluationProject = Readonly<{
  id: string;
  name: string;
}>;

export type ManualAlertEvaluationControl =
  | Readonly<{ kind: "admin-global" }>
  | Readonly<{
      kind: "pm-project";
      projects: readonly AlertEvaluationProject[];
    }>;
