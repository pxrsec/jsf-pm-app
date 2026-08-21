import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { logger } from "@/lib/logger";

export type Project = Database["public"]["Tables"]["projects"]["Row"];
export type ProjectInsert = Database["public"]["Tables"]["projects"]["Insert"];
export type ProjectUpdate = Database["public"]["Tables"]["projects"]["Update"];

export type ProjectMember =
  Database["public"]["Tables"]["project_members"]["Row"];
export type ProjectMemberInsert =
  Database["public"]["Tables"]["project_members"]["Insert"];
export type ProjectMemberUpdate =
  Database["public"]["Tables"]["project_members"]["Update"];

export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];
export type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];

export type TaskResource =
  Database["public"]["Tables"]["task_resources"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export type ProjectCompletionCyclesView =
  Database["public"]["Views"]["project_completion_cycles_view"]["Row"];

export type ProjectStatus = Database["public"]["Enums"]["project_status"];
export type ProjectType = Database["public"]["Enums"]["project_type"];
export type ProjectMemberType =
  Database["public"]["Enums"]["project_member_type"];
export type TaskStatus = Database["public"]["Enums"]["task_status"];
export type TaskPriority = Database["public"]["Enums"]["task_priority"];
export type TaskType = Database["public"]["Enums"]["task_type"];

export type ProjectListItem = Pick<
  Project,
  | "id"
  | "name"
  | "project_type"
  | "status"
  | "client_id"
  | "client_scope"
  | "internal_description"
  | "deadline_at"
  | "drive_folder_url"
  | "completed_at"
  | "archived_at"
  | "created_at"
  | "updated_at"
>;

export type ProjectMemberWithProfile = ProjectMember & {
  profile: Pick<
    Profile,
    "id" | "full_name" | "role" | "avatar_url" | "is_active"
  >;
};

export type ProjectDetail = Project & {
  members: ProjectMemberWithProfile[];
};

export type TaskWithAssignee = Task & {
  assignee: Pick<Profile, "id" | "full_name" | "role" | "avatar_url"> | null;
};

export type TaskFilters = {
  status?: TaskStatus;
  priority?: TaskPriority;
  task_type?: TaskType;
  assignee_id?: string;
};

export type EligibleClientMember = {
  id: string;
  full_name: string;
  email: string;
  profile_id: string | null;
  job_title: string | null;
};

type TypedSupabase = SupabaseClient<Database>;

export async function listProjectsForAdmin(
  supabase: TypedSupabase,
): Promise<ProjectListItem[]> {
  try {
    const { data, error } = await supabase
      .from("projects")
      .select(
        "id, name, project_type, status, client_id, client_scope, internal_description, deadline_at, drive_folder_url, completed_at, archived_at, created_at, updated_at",
      )
      .is("archived_at", null)
      .order("created_at", { ascending: false });

    if (error || !data) {
      if (error)
        logger.debug("Error in listProjectsForAdmin", { error: error.message });
      return [];
    }
    return data;
  } catch (err) {
    logger.debug("Failed in listProjectsForAdmin", { err });
    return [];
  }
}

export async function listProjectsForPm(
  supabase: TypedSupabase,
  userId: string,
): Promise<ProjectListItem[]> {
  try {
    const { data, error } = await supabase
      .from("project_members")
      .select(
        "projects!inner(id, name, project_type, status, client_id, client_scope, internal_description, deadline_at, drive_folder_url, completed_at, archived_at, created_at, updated_at)",
      )
      .eq("user_id", userId)
      .is("deleted_at", null)
      .is("projects.archived_at", null);

    if (error || !data) {
      if (error)
        logger.debug("Error in listProjectsForPm", { error: error.message });
      return [];
    }

    type RawRow = { projects: ProjectListItem | ProjectListItem[] };
    const raw = data as unknown as RawRow[];
    return raw.map((row) =>
      Array.isArray(row.projects) ? row.projects[0] : row.projects,
    );
  } catch (err) {
    logger.debug("Failed in listProjectsForPm", { err });
    return [];
  }
}

export async function getProjectDetail(
  supabase: TypedSupabase,
  projectId: string,
): Promise<ProjectDetail | null> {
  try {
    const { data: project, error: projError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .is("archived_at", null)
      .single();

    if (projError || !project) {
      if (projError)
        logger.debug("Error in getProjectDetail", { error: projError.message });
      return null;
    }

    const { data: members, error: memError } = await supabase
      .from("project_members")
      .select("*, profiles!inner(id, full_name, role, avatar_url, is_active)")
      .eq("project_id", projectId)
      .is("deleted_at", null);

    if (memError) {
      logger.debug("Error fetching members in getProjectDetail", {
        error: memError.message,
      });
    }

    type RawMember = ProjectMember & {
      profiles: Pick<
        Profile,
        "id" | "full_name" | "role" | "avatar_url" | "is_active"
      >;
    };

    const formattedMembers: ProjectMemberWithProfile[] = (
      (members ?? []) as unknown as RawMember[]
    ).map((m) => ({
      ...m,
      profile: m.profiles,
    }));

    return {
      ...project,
      members: formattedMembers,
    };
  } catch (err) {
    logger.debug("Failed in getProjectDetail", { err });
    return null;
  }
}

export async function getCompletionCycles(
  supabase: TypedSupabase,
  projectId: string,
): Promise<ProjectCompletionCyclesView[]> {
  try {
    const { data, error } = await supabase
      .from("project_completion_cycles_view")
      .select("*")
      .eq("project_id", projectId)
      .order("cycle_number", { ascending: false });

    if (error || !data) {
      if (error)
        logger.debug("Error in getCompletionCycles", { error: error.message });
      return [];
    }
    return data;
  } catch (err) {
    logger.debug("Failed in getCompletionCycles", { err });
    return [];
  }
}

export async function listEligiblePmUsers(
  supabase: TypedSupabase,
): Promise<Pick<Profile, "id" | "full_name" | "role" | "avatar_url">[]> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, role, avatar_url")
      .eq("role", "pm")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("full_name", { ascending: true });

    if (error || !data) {
      if (error)
        logger.debug("Error in listEligiblePmUsers", { error: error.message });
      return [];
    }
    return data;
  } catch (err) {
    logger.debug("Failed in listEligiblePmUsers", { err });
    return [];
  }
}

export async function listEligibleOperators(
  supabase: TypedSupabase,
): Promise<Pick<Profile, "id" | "full_name" | "role" | "avatar_url">[]> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, role, avatar_url")
      .eq("role", "operator")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("full_name", { ascending: true });

    if (error || !data) {
      if (error)
        logger.debug("Error in listEligibleOperators", {
          error: error.message,
        });
      return [];
    }
    return data;
  } catch (err) {
    logger.debug("Failed in listEligibleOperators", { err });
    return [];
  }
}

export async function listEligibleClientMembers(
  supabase: TypedSupabase,
  clientId?: string | null,
): Promise<EligibleClientMember[]> {
  if (!clientId) return [];
  try {
    const { data, error } = await supabase
      .from("client_contacts")
      .select("id, full_name, email, profile_id, job_title")
      .eq("client_id", clientId)
      .is("deleted_at", null);

    if (error || !data) {
      if (error)
        logger.debug("Error in listEligibleClientMembers", {
          error: error.message,
        });
      return [];
    }
    return data;
  } catch (err) {
    logger.debug("Failed in listEligibleClientMembers", { err });
    return [];
  }
}

export async function getProjectMembers(
  supabase: TypedSupabase,
  projectId: string,
): Promise<ProjectMemberWithProfile[]> {
  try {
    const { data, error } = await supabase
      .from("project_members")
      .select("*, profiles!inner(id, full_name, role, avatar_url, is_active)")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("joined_at", { ascending: true });

    if (error || !data) {
      if (error)
        logger.debug("Error in getProjectMembers", { error: error.message });
      return [];
    }

    type RawMember = ProjectMember & {
      profiles: Pick<
        Profile,
        "id" | "full_name" | "role" | "avatar_url" | "is_active"
      >;
    };

    return ((data ?? []) as unknown as RawMember[]).map((m) => ({
      ...m,
      profile: m.profiles,
    }));
  } catch (err) {
    logger.debug("Failed in getProjectMembers", { err });
    return [];
  }
}

export async function listProjectTasks(
  supabase: TypedSupabase,
  projectId: string,
  filters?: TaskFilters,
): Promise<TaskWithAssignee[]> {
  try {
    let query = supabase
      .from("tasks")
      .select("*, profiles(id, full_name, role, avatar_url)")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("deadline_at", { ascending: true });

    if (filters?.status) {
      query = query.eq("status", filters.status);
    }
    if (filters?.priority) {
      query = query.eq("priority", filters.priority);
    }
    if (filters?.task_type) {
      query = query.eq("task_type", filters.task_type);
    }
    if (filters?.assignee_id) {
      query = query.eq("assignee_id", filters.assignee_id);
    }

    const { data, error } = await query;

    if (error || !data) {
      if (error)
        logger.debug("Error in listProjectTasks", { error: error.message });
      return [];
    }

    type RawTask = Task & {
      profiles: Pick<
        Profile,
        "id" | "full_name" | "role" | "avatar_url"
      > | null;
    };

    return ((data ?? []) as unknown as RawTask[]).map((t) => ({
      ...t,
      assignee: t.profiles,
    }));
  } catch (err) {
    logger.debug("Failed in listProjectTasks", { err });
    return [];
  }
}

export async function getTaskDetail(
  supabase: TypedSupabase,
  taskId: string,
): Promise<TaskWithAssignee | null> {
  try {
    const { data, error } = await supabase
      .from("tasks")
      .select("*, profiles(id, full_name, role, avatar_url)")
      .eq("id", taskId)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      if (error)
        logger.debug("Error in getTaskDetail", { error: error.message });
      return null;
    }

    type RawTask = Task & {
      profiles: Pick<
        Profile,
        "id" | "full_name" | "role" | "avatar_url"
      > | null;
    };
    const t = data as unknown as RawTask;

    return {
      ...t,
      assignee: t.profiles,
    };
  } catch (err) {
    logger.debug("Failed in getTaskDetail", { err });
    return null;
  }
}

export async function listTaskResources(
  supabase: TypedSupabase,
  taskId: string,
): Promise<TaskResource[]> {
  try {
    const { data, error } = await supabase
      .from("task_resources")
      .select("*")
      .eq("task_id", taskId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error || !data) {
      if (error)
        logger.debug("Error in listTaskResources", { error: error.message });
      return [];
    }
    return data;
  } catch (err) {
    logger.debug("Failed in listTaskResources", { err });
    return [];
  }
}
