import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { logger } from "@/lib/logger";
import { isNotificationDemoAlertEvaluationEnabled } from "./config";
import {
  AlertEvaluationRawSummarySchema,
  type AlertEvaluationSummary,
  type AlertEvaluationProject,
} from "./alert-evaluator-schemas";

export { isNotificationDemoAlertEvaluationEnabled };

const ALLOWED_LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Checks whether the server environment satisfies the strict local development demonstration posture.
 * Returns true only if process.env.NODE_ENV === "development" and NEXT_PUBLIC_APP_URL
 * parses to a loopback hostname (localhost, 127.0.0.1, or [::1]).
 * Fails closed without throwing, logging, or exporting raw environment values.
 */
export function isLocalNotificationDemoPosture(): boolean {
  if (process.env.NODE_ENV !== "development") {
    return false;
  }

  const rawUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!rawUrl || typeof rawUrl !== "string") {
    return false;
  }

  try {
    const parsed = new URL(rawUrl.trim());
    return ALLOWED_LOOPBACK_HOSTNAMES.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Calls the public evaluate_notification_alerts RPC and projects the untrusted JSON
 * return into a safe, strict AlertEvaluationSummary DTO.
 * Pass projectId: null for Admin global evaluation, or string for PM selected-project evaluation.
 */
export async function evaluateNotificationAlerts(
  supabase: SupabaseClient<Database>,
  projectId: string | null,
): Promise<AlertEvaluationSummary> {
  const { data, error } = await supabase.rpc("evaluate_notification_alerts", {
    p_project_id: projectId as unknown as string,
  });

  if (error || data === null || data === undefined) {
    logger.debug("notification-alert-evaluation-failed");
    throw new Error("Alert evaluation failed");
  }

  const parsed = AlertEvaluationRawSummarySchema.safeParse(data);
  if (!parsed.success) {
    logger.debug("notification-alert-evaluation-failed");
    throw new Error("Alert evaluation failed");
  }

  return {
    tasksEvaluated: parsed.data.tasks_evaluated,
    reviewsEvaluated: parsed.data.reviews_evaluated,
    eventsCreated: parsed.data.events_created,
    inAppRecipientsCreated: parsed.data.in_app_recipients_created,
    externalSuppressionsCreated: parsed.data.external_suppressions_created,
  };
}

/**
 * Queries active, non-deleted pm_lead project memberships for the given user,
 * joined to non-deleted, non-archived, non-terminal projects.
 * Returns a minimal, deduplicated, sorted list of browser-safe project options.
 */
export async function listActivePmLeadEvaluationProjects(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<readonly AlertEvaluationProject[]> {
  try {
    const { data, error } = await supabase
      .from("project_members")
      .select("projects!inner(id, name, status, archived_at, deleted_at)")
      .eq("user_id", userId)
      .eq("member_type", "pm_lead")
      .is("deleted_at", null)
      .is("projects.deleted_at", null)
      .is("projects.archived_at", null);

    if (error || !data) {
      return [];
    }

    type RawProject = {
      id: string;
      name: string;
      status: string;
      archived_at: string | null;
      deleted_at: string | null;
    };

    type RawRow = { projects: RawProject | RawProject[] };
    const rawRows = data as unknown as RawRow[];

    const projectsMap = new Map<string, string>();
    for (const row of rawRows) {
      const proj = Array.isArray(row.projects) ? row.projects[0] : row.projects;
      if (!proj) continue;
      if (
        proj.status !== "completed" &&
        proj.status !== "cancelled" &&
        proj.deleted_at === null &&
        proj.archived_at === null
      ) {
        projectsMap.set(proj.id, proj.name);
      }
    }

    const result: AlertEvaluationProject[] = Array.from(
      projectsMap.entries(),
    ).map(([id, name]) => ({ id, name }));

    result.sort((a, b) => a.name.localeCompare(b.name, "en"));
    return result;
  } catch {
    return [];
  }
}

/**
 * Validates that the active session user holds an active pm_lead membership
 * for the exact supplied project, with an active non-deleted PM profile.
 */
export async function assertPmLeadForProject(
  supabase: SupabaseClient<Database>,
  userId: string,
  projectId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("project_members")
    .select("id, profiles!inner(is_active, deleted_at, role)")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .eq("member_type", "pm_lead")
    .is("deleted_at", null)
    .eq("profiles.is_active", true)
    .is("profiles.deleted_at", null)
    .eq("profiles.role", "pm")
    .limit(1);

  return !error && Boolean(data?.length);
}
