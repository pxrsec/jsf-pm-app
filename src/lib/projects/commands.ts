import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { mapSupabaseError, type CommandResult } from "./errors";
import type {
  CreateProjectInput,
  UpdateProjectInput,
  TransitionProjectStatusInput,
  RecoverProjectStatusInput,
  AddProjectMemberInput,
  UpdateProjectMemberInput,
  CreateTaskInput,
  UpdateTaskInput,
  TransitionTaskStatusInput,
} from "./schemas";
import type { Project, ProjectMember, Task } from "./queries";

type TypedSupabase = SupabaseClient<Database>;

export type ProjectCompletionReadiness = {
  project_id: string;
  is_ready: boolean;
  unfinished_task_count: number;
  unfinished_tasks: Array<{
    id: string;
    title: string;
    status: string;
    assignee_id: string;
  }>;
  unfinished_deliverable_count: number;
  unfinished_deliverables: Array<{
    id: string;
    title: string;
    status: string;
    workflow_type: string;
    assignee_id: string;
  }>;
};

export type TransitionResult = {
  project_id?: string;
  task_id?: string;
  old_status: string;
  new_status: string;
};

// ── Project Commands ─────────────────────────────────────────────────────────

export async function createProject(
  supabase: TypedSupabase,
  input: CreateProjectInput,
  actorId: string,
): Promise<CommandResult<Project>> {
  try {
    const { data, error } = await supabase
      .from("projects")
      .insert({
        name: input.name,
        project_type: input.project_type,
        internal_description: input.internal_description,
        deadline_at: input.deadline_at,
        client_id: input.client_id ?? null,
        client_scope: input.client_scope ?? null,
        drive_folder_url: input.drive_folder_url ?? null,
        created_by: actorId,
      })
      .select("*")
      .single();

    if (error || !data) return { ok: false, error: mapSupabaseError(error) };
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: mapSupabaseError(err as { message?: string }) };
  }
}

export async function updateProject(
  supabase: TypedSupabase,
  projectId: string,
  input: UpdateProjectInput,
  actorId: string,
): Promise<CommandResult<Project>> {
  try {
    const updatePayload: Partial<
      Database["public"]["Tables"]["projects"]["Update"]
    > = {
      updated_by: actorId,
    };
    if (input.name !== undefined) updatePayload.name = input.name;
    if (input.internal_description !== undefined)
      updatePayload.internal_description = input.internal_description;
    if (input.deadline_at !== undefined)
      updatePayload.deadline_at = input.deadline_at;
    if (input.client_id !== undefined)
      updatePayload.client_id = input.client_id;
    if (input.client_scope !== undefined)
      updatePayload.client_scope = input.client_scope;
    if (input.drive_folder_url !== undefined)
      updatePayload.drive_folder_url = input.drive_folder_url;

    const { data, error } = await supabase
      .from("projects")
      .update(updatePayload)
      .eq("id", projectId)
      .is("archived_at", null)
      .select("*")
      .single();

    if (error || !data) return { ok: false, error: mapSupabaseError(error) };
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: mapSupabaseError(err as { message?: string }) };
  }
}

export async function archiveProject(
  supabase: TypedSupabase,
  projectId: string,
  reason?: string,
): Promise<CommandResult<{ success: boolean }>> {
  try {
    const { data, error } = await supabase.rpc("soft_delete_entity", {
      p_entity_id: projectId,
      p_entity_type: "project",
      p_reason: reason,
    });

    if (error) return { ok: false, error: mapSupabaseError(error) };
    return { ok: true, data: { success: Boolean(data) } };
  } catch (err) {
    return { ok: false, error: mapSupabaseError(err as { message?: string }) };
  }
}

export async function restoreProject(
  supabase: TypedSupabase,
  projectId: string,
  reason?: string,
): Promise<CommandResult<{ success: boolean }>> {
  try {
    const { data, error } = await supabase.rpc("restore_entity", {
      p_entity_id: projectId,
      p_entity_type: "project",
      p_reason: reason,
    });

    if (error) return { ok: false, error: mapSupabaseError(error) };
    return { ok: true, data: { success: Boolean(data) } };
  } catch (err) {
    return { ok: false, error: mapSupabaseError(err as { message?: string }) };
  }
}

export async function transitionProjectStatus(
  supabase: TypedSupabase,
  input: TransitionProjectStatusInput,
): Promise<CommandResult<TransitionResult>> {
  try {
    const { data, error } = await supabase.rpc("transition_project_status", {
      p_project_id: input.project_id,
      p_next_status: input.next_status,
      p_confirm_unfinished: input.confirm_unfinished ?? false,
      p_reopen_reason: input.reopen_reason ?? undefined,
    });

    if (error) return { ok: false, error: mapSupabaseError(error) };
    return { ok: true, data: data as unknown as TransitionResult };
  } catch (err) {
    return { ok: false, error: mapSupabaseError(err as { message?: string }) };
  }
}

export async function recoverProjectStatus(
  supabase: TypedSupabase,
  input: RecoverProjectStatusInput,
): Promise<CommandResult<TransitionResult>> {
  try {
    const { data, error } = await supabase.rpc("recover_project_status", {
      p_project_id: input.project_id,
      p_target_status: input.target_status,
      p_reason: input.reason,
    });

    if (error) return { ok: false, error: mapSupabaseError(error) };
    return { ok: true, data: data as unknown as TransitionResult };
  } catch (err) {
    return { ok: false, error: mapSupabaseError(err as { message?: string }) };
  }
}

export async function getCompletionReadiness(
  supabase: TypedSupabase,
  projectId: string,
): Promise<CommandResult<ProjectCompletionReadiness>> {
  try {
    const { data, error } = await supabase.rpc(
      "get_project_completion_readiness",
      {
        p_project_id: projectId,
      },
    );

    if (error) return { ok: false, error: mapSupabaseError(error) };
    return { ok: true, data: data as unknown as ProjectCompletionReadiness };
  } catch (err) {
    return { ok: false, error: mapSupabaseError(err as { message?: string }) };
  }
}

// ── Membership Commands ──────────────────────────────────────────────────────

export async function addProjectMember(
  supabase: TypedSupabase,
  input: AddProjectMemberInput,
  actorId: string,
): Promise<CommandResult<ProjectMember>> {
  try {
    const { data, error } = await supabase
      .from("project_members")
      .insert({
        project_id: input.project_id,
        user_id: input.user_id,
        member_type: input.member_type,
        is_primary: input.is_primary ?? false,
        receives_notifications: input.receives_notifications ?? true,
        created_by: actorId,
      })
      .select("*")
      .single();

    if (error || !data) return { ok: false, error: mapSupabaseError(error) };
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: mapSupabaseError(err as { message?: string }) };
  }
}

export async function updateProjectMember(
  supabase: TypedSupabase,
  memberId: string,
  input: UpdateProjectMemberInput,
): Promise<CommandResult<ProjectMember>> {
  try {
    const payload: Partial<
      Database["public"]["Tables"]["project_members"]["Update"]
    > = {};
    if (input.member_type !== undefined)
      payload.member_type = input.member_type;
    if (input.is_primary !== undefined) payload.is_primary = input.is_primary;
    if (input.receives_notifications !== undefined)
      payload.receives_notifications = input.receives_notifications;

    const { data, error } = await supabase
      .from("project_members")
      .update(payload)
      .eq("id", memberId)
      .is("deleted_at", null)
      .select("*")
      .single();

    if (error || !data) return { ok: false, error: mapSupabaseError(error) };
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: mapSupabaseError(err as { message?: string }) };
  }
}

export async function removeProjectMember(
  supabase: TypedSupabase,
  memberId: string,
  reason?: string,
): Promise<CommandResult<{ success: boolean }>> {
  try {
    const { data, error } = await supabase.rpc("soft_delete_entity", {
      p_entity_id: memberId,
      p_entity_type: "project_member",
      p_reason: reason,
    });

    if (error) return { ok: false, error: mapSupabaseError(error) };
    return { ok: true, data: { success: Boolean(data) } };
  } catch (err) {
    return { ok: false, error: mapSupabaseError(err as { message?: string }) };
  }
}

export async function setPrimaryPmLead(
  supabase: TypedSupabase,
  projectId: string,
  targetMemberId: string,
): Promise<CommandResult<ProjectMember>> {
  return updateProjectMember(supabase, targetMemberId, {
    member_id: targetMemberId,
    is_primary: true,
  });
}

// ── Task Commands ────────────────────────────────────────────────────────────

export async function createTask(
  supabase: TypedSupabase,
  input: CreateTaskInput,
  actorId: string,
): Promise<CommandResult<Task>> {
  try {
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        project_id: input.project_id,
        title: input.title,
        description: input.description,
        task_type: input.task_type,
        priority: input.priority,
        deadline_at: input.deadline_at,
        assignee_id: input.assignee_id,
        created_by: actorId,
      })
      .select("*")
      .single();

    if (error || !data) return { ok: false, error: mapSupabaseError(error) };
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: mapSupabaseError(err as { message?: string }) };
  }
}

export async function updateTask(
  supabase: TypedSupabase,
  taskId: string,
  input: UpdateTaskInput,
  actorId: string,
): Promise<CommandResult<Task>> {
  try {
    const payload: Partial<Database["public"]["Tables"]["tasks"]["Update"]> = {
      updated_by: actorId,
    };
    if (input.title !== undefined) payload.title = input.title;
    if (input.description !== undefined)
      payload.description = input.description;
    if (input.priority !== undefined) payload.priority = input.priority;
    if (input.deadline_at !== undefined)
      payload.deadline_at = input.deadline_at;
    if (input.assignee_id !== undefined)
      payload.assignee_id = input.assignee_id;

    const { data, error } = await supabase
      .from("tasks")
      .update(payload)
      .eq("id", taskId)
      .is("deleted_at", null)
      .select("*")
      .single();

    if (error || !data) return { ok: false, error: mapSupabaseError(error) };
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: mapSupabaseError(err as { message?: string }) };
  }
}

export async function transitionTaskStatus(
  supabase: TypedSupabase,
  input: TransitionTaskStatusInput,
): Promise<CommandResult<TransitionResult>> {
  try {
    const { data, error } = await supabase.rpc("transition_task_status", {
      p_task_id: input.task_id,
      p_next_status: input.next_status,
      p_reopen_reason: input.reopen_reason ?? undefined,
    });

    if (error) return { ok: false, error: mapSupabaseError(error) };
    return { ok: true, data: data as unknown as TransitionResult };
  } catch (err) {
    return { ok: false, error: mapSupabaseError(err as { message?: string }) };
  }
}

export async function archiveTask(
  supabase: TypedSupabase,
  taskId: string,
  reason?: string,
): Promise<CommandResult<{ success: boolean }>> {
  try {
    const { data, error } = await supabase.rpc("soft_delete_entity", {
      p_entity_id: taskId,
      p_entity_type: "task",
      p_reason: reason,
    });

    if (error) return { ok: false, error: mapSupabaseError(error) };
    return { ok: true, data: { success: Boolean(data) } };
  } catch (err) {
    return { ok: false, error: mapSupabaseError(err as { message?: string }) };
  }
}
