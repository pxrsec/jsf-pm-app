import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type TypedSupabase = SupabaseClient<Database>;

export async function verifyPmLeadCapacity(
  supabase: TypedSupabase,
  userId: string,
  userRole: string,
  projectId: string,
): Promise<boolean> {
  if (userRole === "admin") return true;

  const { data: member } = await supabase
    .from("project_members")
    .select("member_type, profiles!inner(is_active, deleted_at)")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .eq("profiles.is_active", true)
    .is("profiles.deleted_at", null)
    .maybeSingle();

  return member?.member_type === "pm_lead";
}

export async function verifyProjectMemberAccess(
  supabase: TypedSupabase,
  userId: string,
  userRole: string,
  projectId: string,
): Promise<boolean> {
  if (userRole === "admin") return true;

  const { data: member } = await supabase
    .from("project_members")
    .select("id, profiles!inner(is_active, deleted_at)")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .eq("profiles.is_active", true)
    .is("profiles.deleted_at", null)
    .maybeSingle();

  return Boolean(member);
}

export type EligibilityCheckResult =
  { ok: true } | { ok: false; message: string };

export async function verifyDeliverableEligibility(
  supabase: TypedSupabase,
  projectId: string,
  taskId: string,
  assigneeId: string,
): Promise<EligibilityCheckResult> {
  // 1. Project exists, client type, not cancelled, has client_id
  const { data: project } = await supabase
    .from("projects")
    .select("id, project_type, status, client_id")
    .eq("id", projectId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!project || project.status === "cancelled") {
    return { ok: false, message: "Project is invalid or cancelled" };
  }

  if (project.project_type !== "client" || !project.client_id) {
    return {
      ok: false,
      message:
        "Production deliverables require a client project with linked client organization",
    };
  }

  // 2. Project has at least one active, non-deleted Client member
  const { data: clientMembers } = await supabase
    .from("project_members")
    .select("id, profiles!inner(is_active)")
    .eq("project_id", projectId)
    .eq("member_type", "client")
    .is("deleted_at", null)
    .eq("profiles.is_active", true);

  if (!clientMembers || clientMembers.length === 0) {
    return {
      ok: false,
      message:
        "Project must have at least one active client member before planning deliverables",
    };
  }

  // 3. Task belongs to project, not deleted, has_deliverables === true
  const { data: task } = await supabase
    .from("tasks")
    .select("id, project_id, has_deliverables")
    .eq("id", taskId)
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!task || !task.has_deliverables) {
    return {
      ok: false,
      message:
        "Selected task does not belong to this project or does not admit deliverables",
    };
  }

  // 4. Assignee is active, non-deleted project member (pm_lead, pm_watcher, or operator)
  const { data: assigneeMember } = await supabase
    .from("project_members")
    .select("member_type, profiles!inner(is_active)")
    .eq("project_id", projectId)
    .eq("user_id", assigneeId)
    .is("deleted_at", null)
    .eq("profiles.is_active", true)
    .maybeSingle();

  if (
    !assigneeMember ||
    !["pm_lead", "pm_watcher", "operator"].includes(assigneeMember.member_type)
  ) {
    return {
      ok: false,
      message:
        "Assignee must be an active project PM Lead, PM Watcher, or Operator",
    };
  }

  return { ok: true };
}
