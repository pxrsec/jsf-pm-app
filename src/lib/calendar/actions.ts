"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  CreateMilestoneSchema,
  DeleteMilestoneSchema,
  MilestoneIdSchema,
  UpdateMilestoneSchema,
} from "./schemas";
import { fetchMilestoneDetail } from "./queries";
import type { MilestoneDetailDto } from "./types";

type MilestoneActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: "UNAUTHORIZED" | "VALIDATION_FAILED" | "UNAVAILABLE";
        message: string;
      };
    };
const unavailable = <T>(
  code: "UNAUTHORIZED" | "VALIDATION_FAILED" | "UNAVAILABLE" = "UNAVAILABLE",
): MilestoneActionResult<T> => ({
  ok: false,
  error: { code, message: "This milestone is unavailable." },
});

async function getManagerClient() {
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);
  return session.role === "admin" || session.role === "pm"
    ? createClient(cookieStore)
    : null;
}
function revalidateMilestones() {
  revalidatePath("/[locale]/(protected)/calendario", "page");
  revalidatePath("/[locale]/(protected)/admin/proyectos/[id]", "page");
  revalidatePath("/[locale]/(protected)/pm/proyectos/[id]", "page");
}
export async function createMilestoneAction(
  raw: unknown,
): Promise<MilestoneActionResult<{ milestoneId: string }>> {
  const supabase = await getManagerClient();
  if (!supabase) return unavailable("UNAUTHORIZED");
  const parsed = CreateMilestoneSchema.safeParse(raw);
  if (!parsed.success) return unavailable("VALIDATION_FAILED");
  const input = parsed.data;
  const { data, error } = await supabase.rpc("create_milestone", {
    p_scope: input.scope,
    p_project_id: input.projectId ?? null,
    p_title: input.title,
    p_description: input.description ?? null,
    p_target_date: input.targetDate,
    p_color_override: input.colorOverride ?? null,
    p_task_ids: input.taskIds,
  });
  if (error || !data?.[0]?.milestone_id) return unavailable();
  revalidateMilestones();
  return { ok: true, data: { milestoneId: data[0].milestone_id } };
}
export async function updateMilestoneAction(
  raw: unknown,
): Promise<MilestoneActionResult<{ milestoneId: string }>> {
  const supabase = await getManagerClient();
  if (!supabase) return unavailable("UNAUTHORIZED");
  const parsed = UpdateMilestoneSchema.safeParse(raw);
  if (!parsed.success) return unavailable("VALIDATION_FAILED");
  const input = parsed.data;
  const { data, error } = await supabase.rpc("update_milestone", {
    p_milestone_id: input.milestoneId,
    p_scope: input.scope,
    p_project_id: input.projectId ?? null,
    p_title: input.title,
    p_description: input.description ?? null,
    p_target_date: input.targetDate,
    p_color_override: input.colorOverride ?? null,
    p_task_ids: input.taskIds,
  });
  if (error || !data?.[0]?.milestone_id) return unavailable();
  revalidateMilestones();
  return { ok: true, data: { milestoneId: data[0].milestone_id } };
}
export async function softDeleteMilestoneAction(
  raw: unknown,
): Promise<MilestoneActionResult<true>> {
  const supabase = await getManagerClient();
  if (!supabase) return unavailable("UNAUTHORIZED");
  const parsed = DeleteMilestoneSchema.safeParse(raw);
  if (!parsed.success) return unavailable("VALIDATION_FAILED");
  const { data, error } = await supabase.rpc("soft_delete_milestone", {
    p_milestone_id: parsed.data.milestoneId,
  });
  if (error || data !== true) return unavailable();
  revalidateMilestones();
  return { ok: true, data: true };
}
export async function getMilestoneDetailAction(
  raw: unknown,
): Promise<MilestoneActionResult<MilestoneDetailDto>> {
  const supabase = await getManagerClient();
  const parsed = MilestoneIdSchema.safeParse(raw);
  if (!supabase || !parsed.success)
    return unavailable(!supabase ? "UNAUTHORIZED" : "VALIDATION_FAILED");
  const detail = await fetchMilestoneDetail(supabase, parsed.data.milestoneId);
  return detail ? { ok: true, data: detail } : unavailable();
}
