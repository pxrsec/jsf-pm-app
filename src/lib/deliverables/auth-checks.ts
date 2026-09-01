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
  if (userRole !== "pm") return false;

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

export type DeliverableEligibilityResult =
  | {
      ok: true;
      taskType: "internal_work" | "client_request";
      workflowType: "production" | "client_submission";
      projectType: "internal" | "client";
      taskAssigneeId: string;
    }
  | {
      ok: false;
      code: "NOT_FOUND" | "INVARIANT_VIOLATION";
      message: string;
    };

export async function verifyDeliverableEligibility(
  supabase: TypedSupabase,
  projectId: string,
  taskId: string,
  assigneeId: string,
): Promise<DeliverableEligibilityResult> {
  const { data: project } = await supabase
    .from("projects")
    .select("id, project_type, status, client_id")
    .eq("id", projectId)
    .is("archived_at", null)
    .maybeSingle();

  if (!project || project.status === "cancelled") {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Project is invalid or cancelled",
    };
  }

  const { data: task } = await supabase
    .from("tasks")
    .select("id, project_id, task_type, assignee_id")
    .eq("id", taskId)
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!task) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message:
        "Selected task does not belong to this project or has been deleted",
    };
  }

  const { data: assigneeMember } = await supabase
    .from("project_members")
    .select("member_type, profiles!inner(is_active, deleted_at)")
    .eq("project_id", projectId)
    .eq("user_id", assigneeId)
    .is("deleted_at", null)
    .eq("profiles.is_active", true)
    .is("profiles.deleted_at", null)
    .maybeSingle();

  if (!assigneeMember) {
    return {
      ok: false,
      code: "INVARIANT_VIOLATION",
      message: "Assignee is not an active member of this project",
    };
  }

  if (task.task_type === "client_request") {
    if (project.project_type !== "client") {
      return {
        ok: false,
        code: "INVARIANT_VIOLATION",
        message: "Client request deliverables require a client project",
      };
    }
    if (assigneeMember.member_type !== "client") {
      return {
        ok: false,
        code: "INVARIANT_VIOLATION",
        message:
          "Assignee for a client request deliverable must be an active Client contact",
      };
    }

    return {
      ok: true,
      taskType: "client_request",
      workflowType: "client_submission",
      projectType: project.project_type,
      taskAssigneeId: task.assignee_id,
    };
  }

  if (task.task_type === "internal_work") {
    if (
      !["pm_lead", "pm_watcher", "operator"].includes(
        assigneeMember.member_type,
      )
    ) {
      return {
        ok: false,
        code: "INVARIANT_VIOLATION",
        message:
          "Assignee must be an active project PM Lead, PM Watcher, or Operator",
      };
    }

    return {
      ok: true,
      taskType: "internal_work",
      workflowType: "production",
      projectType: project.project_type,
      taskAssigneeId: task.assignee_id,
    };
  }

  return {
    ok: false,
    code: "INVARIANT_VIOLATION",
    message: "Unknown task type",
  };
}
