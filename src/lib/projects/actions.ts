"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import * as projectCommands from "@/lib/projects/commands";
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  TransitionProjectStatusSchema,
  AddProjectMemberSchema,
  UpdateProjectMemberSchema,
  type CreateProjectInput,
  type UpdateProjectInput,
  type AddProjectMemberInput,
  type UpdateProjectMemberInput,
  type TransitionProjectStatusInput,
} from "@/lib/projects/schemas";
import { mapSupabaseError, type CommandResult } from "@/lib/projects/errors";
import type { Project, ProjectMember } from "@/lib/projects/queries";

// ── Project Creation with Atomic Initial Team ────────────────────────────────

export interface CreateProjectWithTeamInput extends CreateProjectInput {
  initial_pm_lead_user_id?: string;
  initial_client_contact_user_id?: string;
}

export async function createProjectAction(
  rawInput: CreateProjectWithTeamInput,
): Promise<CommandResult<Project>> {
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);

  if (session.role !== "admin" && session.role !== "pm") {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized role" },
    };
  }

  const parseResult = CreateProjectSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: parseResult.error.issues[0]?.message ?? "Invalid input",
      },
    };
  }

  const supabase = createClient(cookieStore);
  const input = parseResult.data;

  // 1. Create project record
  const projectResult = await projectCommands.createProject(
    supabase,
    input,
    session.user.id,
  );
  if (!projectResult.ok) return projectResult;
  const project = projectResult.data;

  // 2. Prepare initial team batch to satisfy deferred triggers
  const membersToAdd: Array<{
    project_id: string;
    user_id: string;
    member_type: "pm_lead" | "pm_watcher" | "operator" | "client";
    is_primary: boolean;
    created_by: string;
  }> = [];

  // Determine PM Lead: If PM, assign self as primary; if Admin, assign selected PM lead
  const pmLeadId =
    session.role === "pm" ? session.user.id : rawInput.initial_pm_lead_user_id;

  if (pmLeadId) {
    membersToAdd.push({
      project_id: project.id,
      user_id: pmLeadId,
      member_type: "pm_lead",
      is_primary: true,
      created_by: session.user.id,
    });
  }

  // If Client Project and initial client contact provided, add client member
  if (
    project.project_type === "client" &&
    rawInput.initial_client_contact_user_id
  ) {
    membersToAdd.push({
      project_id: project.id,
      user_id: rawInput.initial_client_contact_user_id,
      member_type: "client",
      is_primary: false,
      created_by: session.user.id,
    });
  }

  if (membersToAdd.length > 0) {
    const { error: memberError } = await supabase
      .from("project_members")
      .insert(membersToAdd);

    if (memberError) {
      // Clean up project if member initialization fails
      await supabase.from("projects").delete().eq("id", project.id);
      return { ok: false, error: mapSupabaseError(memberError) };
    }
  }

  revalidatePath("/[locale]/(protected)/admin/proyectos", "page");
  revalidatePath("/[locale]/(protected)/pm/proyectos", "page");
  return { ok: true, data: project };
}

// ── Project Update ───────────────────────────────────────────────────────────

export async function updateProjectAction(
  projectId: string,
  rawInput: UpdateProjectInput,
): Promise<CommandResult<Project>> {
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);
  const supabase = createClient(cookieStore);

  const parseResult = UpdateProjectSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: parseResult.error.issues[0]?.message ?? "Invalid input",
      },
    };
  }

  const result = await projectCommands.updateProject(
    supabase,
    projectId,
    parseResult.data,
    session.user.id,
  );

  if (result.ok) {
    revalidatePath(
      `/[locale]/(protected)/admin/proyectos/${projectId}`,
      "page",
    );
    revalidatePath(`/[locale]/(protected)/pm/proyectos/${projectId}`, "page");
  }
  return result;
}

// ── Status Transitions ───────────────────────────────────────────────────────

export async function transitionProjectStatusAction(
  rawInput: TransitionProjectStatusInput,
): Promise<CommandResult<projectCommands.TransitionResult>> {
  const cookieStore = await cookies();
  await requireSession(cookieStore);
  const supabase = createClient(cookieStore);

  const parseResult = TransitionProjectStatusSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: parseResult.error.issues[0]?.message ?? "Invalid input",
      },
    };
  }

  const result = await projectCommands.transitionProjectStatus(
    supabase,
    parseResult.data,
  );

  if (result.ok) {
    revalidatePath(
      `/[locale]/(protected)/admin/proyectos/${rawInput.project_id}`,
      "page",
    );
    revalidatePath(
      `/[locale]/(protected)/pm/proyectos/${rawInput.project_id}`,
      "page",
    );
    revalidatePath("/[locale]/(protected)/admin/proyectos", "page");
    revalidatePath("/[locale]/(protected)/pm/proyectos", "page");
  }
  return result;
}

export async function archiveProjectAction(
  projectId: string,
  reason?: string,
): Promise<CommandResult<{ success: boolean }>> {
  const cookieStore = await cookies();
  await requireSession(cookieStore);
  const supabase = createClient(cookieStore);

  const result = await projectCommands.archiveProject(
    supabase,
    projectId,
    reason,
  );

  if (result.ok) {
    revalidatePath("/[locale]/(protected)/admin/proyectos", "page");
    revalidatePath("/[locale]/(protected)/pm/proyectos", "page");
  }
  return result;
}

export async function restoreProjectAction(
  projectId: string,
  reason?: string,
): Promise<CommandResult<{ success: boolean }>> {
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);

  if (session.role !== "admin") {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Only admin can restore projects" },
    };
  }

  const supabase = createClient(cookieStore);
  const result = await projectCommands.restoreProject(
    supabase,
    projectId,
    reason,
  );

  if (result.ok) {
    revalidatePath("/[locale]/(protected)/admin/proyectos", "page");
    revalidatePath("/[locale]/(protected)/pm/proyectos", "page");
  }
  return result;
}

// ── Membership Actions ───────────────────────────────────────────────────────

export async function addProjectMemberAction(
  rawInput: AddProjectMemberInput,
): Promise<CommandResult<ProjectMember>> {
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);
  const supabase = createClient(cookieStore);

  const parseResult = AddProjectMemberSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: parseResult.error.issues[0]?.message ?? "Invalid input",
      },
    };
  }

  const result = await projectCommands.addProjectMember(
    supabase,
    parseResult.data,
    session.user.id,
  );

  if (result.ok) {
    revalidatePath(
      `/[locale]/(protected)/admin/proyectos/${rawInput.project_id}`,
      "page",
    );
    revalidatePath(
      `/[locale]/(protected)/pm/proyectos/${rawInput.project_id}`,
      "page",
    );
  }
  return result;
}

export async function updateProjectMemberAction(
  memberId: string,
  projectId: string,
  rawInput: UpdateProjectMemberInput,
): Promise<CommandResult<ProjectMember>> {
  const cookieStore = await cookies();
  await requireSession(cookieStore);
  const supabase = createClient(cookieStore);

  const parseResult = UpdateProjectMemberSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: parseResult.error.issues[0]?.message ?? "Invalid input",
      },
    };
  }

  const result = await projectCommands.updateProjectMember(
    supabase,
    memberId,
    parseResult.data,
  );

  if (result.ok) {
    revalidatePath(
      `/[locale]/(protected)/admin/proyectos/${projectId}`,
      "page",
    );
    revalidatePath(`/[locale]/(protected)/pm/proyectos/${projectId}`, "page");
  }
  return result;
}

export async function removeProjectMemberAction(
  projectId: string,
  memberId: string,
  reason?: string,
): Promise<CommandResult<{ success: boolean }>> {
  const cookieStore = await cookies();
  await requireSession(cookieStore);
  const supabase = createClient(cookieStore);

  const result = await projectCommands.removeProjectMember(
    supabase,
    memberId,
    reason,
  );

  if (result.ok) {
    revalidatePath(
      `/[locale]/(protected)/admin/proyectos/${projectId}`,
      "page",
    );
    revalidatePath(`/[locale]/(protected)/pm/proyectos/${projectId}`, "page");
  }
  return result;
}

export async function setPrimaryPmLeadAction(
  projectId: string,
  targetMemberId: string,
): Promise<CommandResult<ProjectMember>> {
  const cookieStore = await cookies();
  await requireSession(cookieStore);
  const supabase = createClient(cookieStore);

  // 1. Demote current primary lead(s) on this project
  await supabase
    .from("project_members")
    .update({ is_primary: false })
    .eq("project_id", projectId)
    .eq("member_type", "pm_lead")
    .eq("is_primary", true);

  // 2. Promote target member to primary lead
  const result = await projectCommands.updateProjectMember(
    supabase,
    targetMemberId,
    {
      member_id: targetMemberId,
      is_primary: true,
    },
  );

  if (result.ok) {
    revalidatePath(
      `/[locale]/(protected)/admin/proyectos/${projectId}`,
      "page",
    );
    revalidatePath(`/[locale]/(protected)/pm/proyectos/${projectId}`, "page");
  }
  return result;
}

