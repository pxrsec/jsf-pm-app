import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { logger } from "@/lib/logger";
import type {
  AvailableResult,
  ClientManagementProjectDto,
} from "@/lib/clients/types";

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

export async function listClientManagementProjects(
  supabase: TypedSupabase,
): Promise<AvailableResult<ClientManagementProjectDto[]>> {
  try {
    const { data, error } = await supabase
      .from("projects")
      .select("id, name")
      .eq("project_type", "client")
      .is("deleted_at", null)
      .is("archived_at", null)
      .order("name", { ascending: true })
      .order("id", { ascending: true });

    if (error || !data) {
      if (error) {
        logger.debug("Error in listClientManagementProjects", {
          error: error.message,
        });
      }
      return { status: "unavailable" };
    }

    return { status: "available", data };
  } catch (err) {
    logger.debug("Failed in listClientManagementProjects", { err });
    return { status: "unavailable" };
  }
}

export async function listEligibleClientMembersForProject(
  supabase: TypedSupabase,
  project: { id: string; client_id: string | null },
): Promise<AvailableResult<EligibleClientMember[]>> {
  try {
    if (project.client_id !== null) {
      const { data, error } = await supabase
        .from("client_contacts")
        .select(
          "id, full_name, email, profile_id, job_title, profiles!inner(role, is_active, deleted_at)",
        )
        .eq("client_id", project.client_id)
        .is("deleted_at", null)
        .not("profile_id", "is", null)
        .eq("profiles.role", "client")
        .eq("profiles.is_active", true)
        .is("profiles.deleted_at", null);

      if (error || !data) {
        if (error)
          logger.debug("Error in listEligibleClientMembersForProject (org)", {
            error: error.message,
          });
        return { status: "unavailable" };
      }

      return {
        status: "available",
        data: data.map((c) => ({
          id: c.id,
          full_name: c.full_name,
          email: c.email,
          profile_id: c.profile_id,
          job_title: c.job_title,
        })),
      };
    }

    // Direct path: Step 1 - Call trusted association RPC (never query project_client_contacts table)
    const { data: assocData, error: assocError } = await supabase.rpc(
      "list_project_client_contact_associations",
      { p_project_id: project.id },
    );

    if (assocError || !assocData) {
      if (assocError) {
        logger.debug(
          "Error in list_project_client_contact_associations for project eligibility",
          { error: assocError.message },
        );
      }
      return { status: "unavailable" };
    }

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    const contactIds: string[] = [];
    for (const row of assocData) {
      if (
        typeof row.contact_id !== "string" ||
        !uuidRegex.test(row.contact_id)
      ) {
        return { status: "unavailable" };
      }
      contactIds.push(row.contact_id);
    }

    if (contactIds.length === 0) {
      return { status: "available", data: [] };
    }

    // Step 2: Query client_contacts for the trusted associated contact IDs
    const { data, error } = await supabase
      .from("client_contacts")
      .select(
        "id, full_name, email, profile_id, job_title, profiles!inner(role, is_active, deleted_at)",
      )
      .in("id", contactIds)
      .is("client_id", null)
      .is("deleted_at", null)
      .not("profile_id", "is", null)
      .eq("profiles.role", "client")
      .eq("profiles.is_active", true)
      .is("profiles.deleted_at", null);

    if (error || !data) {
      if (error) {
        logger.debug(
          "Error in listEligibleClientMembersForProject (direct contacts query)",
          { error: error.message },
        );
      }
      return { status: "unavailable" };
    }

    return {
      status: "available",
      data: data.map((c) => ({
        id: c.id,
        full_name: c.full_name,
        email: c.email,
        profile_id: c.profile_id,
        job_title: c.job_title,
      })),
    };
  } catch (err) {
    logger.debug("Failed in listEligibleClientMembersForProject", { err });
    return { status: "unavailable" };
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
