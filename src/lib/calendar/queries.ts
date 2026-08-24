import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { logger } from "@/lib/logger";
import {
  normalizeCalendarEventDto,
  normalizeMilestoneTargetDto,
  normalizeMilestoneEditDetailDto,
  type CalendarEventDto,
  type CalendarMilestoneTargetDto,
  type CalendarMilestoneEditDetailDto,
} from "./types";
import { CalendarFeedParamsSchema } from "./schemas";

/**
 * Server-only query fetching the role-safe calendar feed from Supabase RPC.
 * Discards sensitive database/event internals and returns normalized CalendarEventDto[].
 */
export async function fetchCalendarFeed(
  supabase: SupabaseClient<Database>,
  params: {
    from: string;
    to: string;
    projectId?: string | null;
  },
): Promise<CalendarEventDto[]> {
  const parseResult = CalendarFeedParamsSchema.safeParse({
    from: params.from,
    to: params.to,
    projectId: params.projectId ?? undefined,
  });

  if (!parseResult.success) {
    logger.debug("calendar-feed-params-invalid", {
      errors: parseResult.error.format(),
    });
    throw new Error("Invalid calendar range parameters");
  }

  const { from, to, projectId } = parseResult.data;

  const { data, error } = await supabase.rpc("list_role_safe_calendar_events", {
    p_from: from,
    p_to: to,
    p_project_id: projectId ?? undefined,
  });

  if (error) {
    logger.debug("calendar-feed-rpc-failed", {
      operation: "fetchCalendarFeed",
    });
    throw new Error("Failed to fetch calendar feed");
  }

  return (data ?? []).map(normalizeCalendarEventDto);
}

/**
 * Server-only query fetching the manager-only milestone project and task targets.
 */
export async function fetchCalendarMilestoneTargets(
  supabase: SupabaseClient<Database>,
): Promise<CalendarMilestoneTargetDto[]> {
  const { data, error } = await supabase.rpc("list_calendar_milestone_targets");

  if (error) {
    logger.debug("calendar-targets-rpc-failed", {
      operation: "fetchCalendarMilestoneTargets",
    });
    return [];
  }

  return (data ?? []).map(normalizeMilestoneTargetDto);
}

/**
 * Server-only query fetching manager-only edit detail for a specific milestone.
 * Preserves description for edit forms without exposing it in general feeds.
 */
export async function fetchCalendarMilestoneForEdit(
  supabase: SupabaseClient<Database>,
  eventId: string,
): Promise<CalendarMilestoneEditDetailDto | null> {
  const { data, error } = await supabase.rpc(
    "get_calendar_milestone_for_edit",
    {
      p_event_id: eventId,
    },
  );

  if (error || !data || data.length === 0) {
    logger.debug("calendar-edit-detail-rpc-failed", {
      operation: "fetchCalendarMilestoneForEdit",
    });
    return null;
  }

  return normalizeMilestoneEditDetailDto(data[0]);
}
