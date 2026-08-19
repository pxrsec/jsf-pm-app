import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { logger } from "@/lib/logger";

type TypedSupabase = SupabaseClient<Database>;

export async function getUnreadNotificationCount(
  supabase: TypedSupabase,
  userId: string,
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from("notification_unread_counts_view")
      .select("unread_count")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) {
      if (error) {
        logger.debug("Error fetching notification unread count", {
          error: error.message,
        });
      }
      return 0;
    }

    return Number(data.unread_count ?? 0);
  } catch (err) {
    logger.debug("Failed to get unread notification count", { err });
    return 0;
  }
}

export type AdminShellData = {
  projects: Pick<
    Database["public"]["Tables"]["projects"]["Row"],
    "id" | "name" | "status" | "deadline_at"
  >[];
};

export async function getAdminShellData(
  supabase: TypedSupabase,
): Promise<AdminShellData> {
  try {
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, status, deadline_at")
      .order("created_at", { ascending: false })
      .limit(5);

    if (error || !data) {
      if (error) {
        logger.debug("Error fetching admin shell data", {
          error: error.message,
        });
      }
      return { projects: [] };
    }

    return { projects: data };
  } catch (err) {
    logger.debug("Failed to get admin shell data", { err });
    return { projects: [] };
  }
}

export type PmShellData = {
  projects: {
    id: string;
    name: string;
    status: Database["public"]["Enums"]["project_status"];
    deadline_at: string;
    member_type: Database["public"]["Enums"]["project_member_type"];
    is_primary: boolean;
  }[];
};

export async function getPmShellData(
  supabase: TypedSupabase,
  userId: string,
): Promise<PmShellData> {
  try {
    const { data, error } = await supabase
      .from("project_members")
      .select(
        "member_type, is_primary, projects!inner(id, name, status, deadline_at)",
      )
      .eq("user_id", userId)
      .limit(5);

    if (error || !data) {
      if (error) {
        logger.debug("Error fetching PM shell data", { error: error.message });
      }
      return { projects: [] };
    }

    type RawMembershipItem = {
      member_type: Database["public"]["Enums"]["project_member_type"];
      is_primary: boolean;
      projects:
        | {
            id: string;
            name: string;
            status: Database["public"]["Enums"]["project_status"];
            deadline_at: string;
          }
        | {
            id: string;
            name: string;
            status: Database["public"]["Enums"]["project_status"];
            deadline_at: string;
          }[];
    };

    const rawData = data as unknown as RawMembershipItem[];

    const projects = rawData.map((item) => {
      const proj = Array.isArray(item.projects)
        ? item.projects[0]
        : item.projects;
      return {
        id: proj.id,
        name: proj.name,
        status: proj.status,
        deadline_at: proj.deadline_at,
        member_type: item.member_type,
        is_primary: item.is_primary,
      };
    });

    return { projects };
  } catch (err) {
    logger.debug("Failed to get PM shell data", { err });
    return { projects: [] };
  }
}

export type OperatorShellData = {
  agendaItems: Pick<
    Database["public"]["Views"]["operator_agenda_view"]["Row"],
    | "task_id"
    | "task_title"
    | "task_status"
    | "task_priority"
    | "project_name"
    | "task_deadline_at"
  >[];
};

export async function getOperatorShellData(
  supabase: TypedSupabase,
): Promise<OperatorShellData> {
  try {
    const { data, error } = await supabase
      .from("operator_agenda_view")
      .select(
        "task_id, task_title, task_status, task_priority, project_name, task_deadline_at",
      )
      .order("task_deadline_at", { ascending: true, nullsFirst: false })
      .limit(5);

    if (error || !data) {
      if (error) {
        logger.debug("Error fetching operator shell data", {
          error: error.message,
        });
      }
      return { agendaItems: [] };
    }

    return { agendaItems: data };
  } catch (err) {
    logger.debug("Failed to get operator shell data", { err });
    return { agendaItems: [] };
  }
}

export type ClientShellData = {
  projects: Pick<
    Database["public"]["Views"]["client_project_view"]["Row"],
    "id" | "name" | "status" | "deadline_at" | "client_name"
  >[];
};

export async function getClientShellData(
  supabase: TypedSupabase,
): Promise<ClientShellData> {
  try {
    const { data, error } = await supabase
      .from("client_project_view")
      .select("id, name, status, deadline_at, client_name")
      .order("deadline_at", { ascending: true, nullsFirst: false })
      .limit(5);

    if (error || !data) {
      if (error) {
        logger.debug("Error fetching client shell data", {
          error: error.message,
        });
      }
      return { projects: [] };
    }

    return { projects: data };
  } catch (err) {
    logger.debug("Failed to get client shell data", { err });
    return { projects: [] };
  }
}
