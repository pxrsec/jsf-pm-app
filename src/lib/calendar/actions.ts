"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  CreateCalendarMilestoneSchema,
  UpdateCalendarMilestoneSchema,
  DeleteCalendarMilestoneSchema,
  GetMilestoneEditDetailSchema,
} from "./schemas";
import { mapCalendarSupabaseError, type CalendarCommandResult } from "./errors";
import {
  normalizeCalendarEventDto,
  type CalendarEventDto,
  type CalendarMilestoneEditDetailDto,
} from "./types";
import { fetchCalendarMilestoneForEdit } from "./queries";

export async function createCalendarMilestoneAction(
  rawInput: unknown,
): Promise<CalendarCommandResult<CalendarEventDto>> {
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);

  if (session.role !== "admin" && session.role !== "pm") {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized role" },
    };
  }

  const parseResult = CreateCalendarMilestoneSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: parseResult.error.issues[0]?.message ?? "Invalid input",
      },
    };
  }

  const input = parseResult.data;
  const supabase = createClient(cookieStore);

  const { data, error } = await supabase.rpc("create_calendar_milestone", {
    p_project_id: input.projectId,
    p_task_id: input.taskId ?? undefined,
    p_title: input.title,
    p_description: input.description ?? undefined,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt ?? undefined,
    p_is_all_day: input.isAllDay,
    p_color_override: input.colorOverride ?? undefined,
  });

  if (error || !data || data.length === 0) {
    return {
      ok: false,
      error: mapCalendarSupabaseError(error),
    };
  }

  const created = normalizeCalendarEventDto(data[0]);

  // Revalidate calendar route and concrete project paths if project_id is present
  revalidatePath("/[locale]/(protected)/calendario", "page");
  if (created.project_id) {
    revalidatePath(
      `/[locale]/(protected)/admin/proyectos/${created.project_id}`,
      "page",
    );
    revalidatePath(
      `/[locale]/(protected)/pm/proyectos/${created.project_id}`,
      "page",
    );
  }

  return { ok: true, data: created };
}

export async function updateCalendarMilestoneAction(
  rawInput: unknown,
): Promise<CalendarCommandResult<CalendarEventDto>> {
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);

  if (session.role !== "admin" && session.role !== "pm") {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized role" },
    };
  }

  const parseResult = UpdateCalendarMilestoneSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: parseResult.error.issues[0]?.message ?? "Invalid input",
      },
    };
  }

  const input = parseResult.data;
  const supabase = createClient(cookieStore);

  const { data, error } = await supabase.rpc("update_calendar_milestone", {
    p_event_id: input.eventId,
    p_project_id: input.projectId,
    p_task_id: input.taskId ?? undefined,
    p_title: input.title,
    p_description: input.description ?? undefined,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt ?? undefined,
    p_is_all_day: input.isAllDay,
    p_color_override: input.colorOverride ?? undefined,
  });

  if (error || !data || data.length === 0) {
    return {
      ok: false,
      error: mapCalendarSupabaseError(error),
    };
  }

  const updated = normalizeCalendarEventDto(data[0]);

  // Revalidate calendar route and concrete project paths if project_id is present
  revalidatePath("/[locale]/(protected)/calendario", "page");
  if (updated.project_id) {
    revalidatePath(
      `/[locale]/(protected)/admin/proyectos/${updated.project_id}`,
      "page",
    );
    revalidatePath(
      `/[locale]/(protected)/pm/proyectos/${updated.project_id}`,
      "page",
    );
  }

  return { ok: true, data: updated };
}

export async function softDeleteCalendarMilestoneAction(
  rawInput: unknown,
): Promise<CalendarCommandResult<boolean>> {
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);

  if (session.role !== "admin" && session.role !== "pm") {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized role" },
    };
  }

  const parseResult = DeleteCalendarMilestoneSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: parseResult.error.issues[0]?.message ?? "Invalid input",
      },
    };
  }

  const input = parseResult.data;
  const supabase = createClient(cookieStore);

  const { data, error } = await supabase.rpc("soft_delete_calendar_milestone", {
    p_event_id: input.eventId,
  });

  if (error) {
    return {
      ok: false,
      error: mapCalendarSupabaseError(error),
    };
  }

  if (data !== true) {
    return {
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "Milestone could not be deleted or was not found.",
      },
    };
  }

  revalidatePath("/[locale]/(protected)/calendario", "page");

  return { ok: true, data: true };
}

export async function getCalendarMilestoneForEditAction(
  rawInput: unknown,
): Promise<CalendarCommandResult<CalendarMilestoneEditDetailDto>> {
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);

  if (session.role !== "admin" && session.role !== "pm") {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized role" },
    };
  }

  const parseResult = GetMilestoneEditDetailSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: parseResult.error.issues[0]?.message ?? "Invalid input",
      },
    };
  }

  const input = parseResult.data;
  const supabase = createClient(cookieStore);
  const detail = await fetchCalendarMilestoneForEdit(supabase, input.eventId);

  if (!detail) {
    return {
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "Milestone edit detail could not be found.",
      },
    };
  }

  return { ok: true, data: detail };
}
