"use server";

import "server-only";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireSession, AuthError } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isNotificationDemoAlertEvaluationEnabled } from "./config";
import {
  isLocalNotificationDemoPosture,
  evaluateNotificationAlerts,
  assertPmLeadForProject,
} from "./alert-evaluator";
import {
  EvaluateAlertsAsAdminSchema,
  EvaluateAlertsAsPmLeadSchema,
  type AlertEvaluationSummary,
} from "./alert-evaluator-schemas";

export type AlertEvaluationActionErrorCode =
  "VALIDATION_FAILED" | "UNAUTHORIZED" | "UNAVAILABLE";

export type AlertEvaluationActionResult =
  | { ok: true; data: AlertEvaluationSummary }
  | { ok: false; error: { code: AlertEvaluationActionErrorCode } };

function revalidateNotificationAffectedPaths(): void {
  revalidatePath("/admin/notificaciones");
  revalidatePath("/en/admin/notificaciones");
  revalidatePath("/pm/notificaciones");
  revalidatePath("/en/pm/notificaciones");
  revalidatePath("/notificaciones");
  revalidatePath("/en/notificaciones");
  revalidatePath("/[locale]/(protected)", "layout");
}

/**
 * Server action to execute manual notification alert evaluation in development demo posture.
 * Validates session, demo flag, local posture, role scope, and PM lead capacity before
 * calling the database evaluator public RPC with the server-held admin client.
 */
export async function evaluateNotificationAlertsAction(
  rawInput: unknown,
): Promise<AlertEvaluationActionResult> {
  const cookieStore = await cookies();
  let session;
  try {
    session = await requireSession(cookieStore);
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, error: { code: "UNAUTHORIZED" } };
    }
    throw error;
  }

  if (
    !isNotificationDemoAlertEvaluationEnabled() ||
    !isLocalNotificationDemoPosture()
  ) {
    return { ok: false, error: { code: "UNAVAILABLE" } };
  }

  const supabase = createClient(cookieStore);

  let summary: AlertEvaluationSummary;

  if (session.role === "admin") {
    const parsed = EvaluateAlertsAsAdminSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { ok: false, error: { code: "VALIDATION_FAILED" } };
    }

    try {
      const adminClient = createAdminClient();
      summary = await evaluateNotificationAlerts(adminClient, null);
    } catch {
      return { ok: false, error: { code: "UNAVAILABLE" } };
    }
  } else if (session.role === "pm") {
    const parsed = EvaluateAlertsAsPmLeadSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { ok: false, error: { code: "VALIDATION_FAILED" } };
    }

    const isLead = await assertPmLeadForProject(
      supabase,
      session.user.id,
      parsed.data.projectId,
    );
    if (!isLead) {
      return { ok: false, error: { code: "UNAUTHORIZED" } };
    }

    try {
      const adminClient = createAdminClient();
      summary = await evaluateNotificationAlerts(
        adminClient,
        parsed.data.projectId,
      );
    } catch {
      return { ok: false, error: { code: "UNAVAILABLE" } };
    }
  } else {
    return { ok: false, error: { code: "UNAUTHORIZED" } };
  }

  revalidateNotificationAffectedPaths();
  return { ok: true, data: summary };
}
