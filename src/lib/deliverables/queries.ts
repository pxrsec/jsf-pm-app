import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { logger } from "@/lib/logger";

export type Deliverable = Database["public"]["Tables"]["deliverables"]["Row"];
export type DeliverableInsert =
  Database["public"]["Tables"]["deliverables"]["Insert"];
export type DeliverableUpdate =
  Database["public"]["Tables"]["deliverables"]["Update"];

export type DeliverableVersion =
  Database["public"]["Tables"]["deliverable_versions"]["Row"];
export type DeliverableFeedback =
  Database["public"]["Tables"]["deliverable_feedback"]["Row"];
export type DeliverableLinkReport =
  Database["public"]["Tables"]["deliverable_link_reports"]["Row"];

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export type DeliverableStatus =
  Database["public"]["Enums"]["deliverable_status"];
export type DeliverableWorkflowType =
  Database["public"]["Enums"]["deliverable_workflow_type"];
export type ReviewDecision = Database["public"]["Enums"]["review_decision"];
export type ReviewStage = Database["public"]["Enums"]["review_stage"];
export type SubmissionProvider =
  Database["public"]["Enums"]["submission_provider"];

export type DeliverableVersionWithSubmitter = DeliverableVersion & {
  submitter: Pick<Profile, "id" | "full_name" | "role" | "avatar_url"> | null;
};

export type DeliverableFeedbackWithReviewer = DeliverableFeedback & {
  reviewer: Pick<Profile, "id" | "full_name" | "role" | "avatar_url"> | null;
};

export type DeliverableDetail = Deliverable & {
  assignee: Pick<Profile, "id" | "full_name" | "role" | "avatar_url"> | null;
  versions: DeliverableVersionWithSubmitter[];
  feedback: DeliverableFeedbackWithReviewer[];
};

export type DeliverableListItem = Deliverable & {
  assignee: Pick<Profile, "id" | "full_name" | "role" | "avatar_url"> | null;
};

export type DeliverableFilters = {
  status?: DeliverableStatus;
  assignee_id?: string;
  workflow_type?: DeliverableWorkflowType;
  is_stalled?: boolean;
};

type TypedSupabase = SupabaseClient<Database>;

export async function listProjectDeliverables(
  supabase: TypedSupabase,
  projectId: string,
  filters?: DeliverableFilters,
): Promise<DeliverableListItem[]> {
  try {
    let query = supabase
      .from("deliverables")
      .select("*, profiles(id, full_name, role, avatar_url)")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (filters?.status) {
      query = query.eq("status", filters.status);
    }
    if (filters?.assignee_id) {
      query = query.eq("assignee_id", filters.assignee_id);
    }
    if (filters?.workflow_type) {
      query = query.eq("workflow_type", filters.workflow_type);
    }
    if (filters?.is_stalled !== undefined) {
      query = query.eq("is_stalled", filters.is_stalled);
    }

    const { data, error } = await query;

    if (error || !data) {
      if (error)
        logger.debug("Error in listProjectDeliverables", {
          error: error.message,
        });
      return [];
    }

    type RawRow = Deliverable & {
      profiles: Pick<
        Profile,
        "id" | "full_name" | "role" | "avatar_url"
      > | null;
    };

    return ((data ?? []) as unknown as RawRow[]).map((d) => ({
      ...d,
      assignee: d.profiles,
    }));
  } catch (err) {
    logger.debug("Failed in listProjectDeliverables", { err });
    return [];
  }
}

export async function getDeliverableDetail(
  supabase: TypedSupabase,
  deliverableId: string,
): Promise<DeliverableDetail | null> {
  try {
    const { data: deliverable, error: delivError } = await supabase
      .from("deliverables")
      .select("*, profiles(id, full_name, role, avatar_url)")
      .eq("id", deliverableId)
      .is("deleted_at", null)
      .single();

    if (delivError || !deliverable) {
      if (delivError)
        logger.debug("Error in getDeliverableDetail", {
          error: delivError.message,
        });
      return null;
    }

    const { data: versions, error: verError } = await supabase
      .from("deliverable_versions")
      .select("*, profiles(id, full_name, role, avatar_url)")
      .eq("deliverable_id", deliverableId)
      .order("version_number", { ascending: false });

    if (verError) {
      logger.debug("Error in getDeliverableDetail versions", {
        error: verError.message,
      });
    }

    const { data: feedback, error: fbError } = await supabase
      .from("deliverable_feedback")
      .select("*, profiles(id, full_name, role, avatar_url)")
      .eq("deliverable_id", deliverableId)
      .order("reviewed_at", { ascending: true });

    if (fbError) {
      logger.debug("Error in getDeliverableDetail feedback", {
        error: fbError.message,
      });
    }

    type RawVersion = DeliverableVersion & {
      profiles: Pick<
        Profile,
        "id" | "full_name" | "role" | "avatar_url"
      > | null;
    };
    type RawFeedback = DeliverableFeedback & {
      profiles: Pick<
        Profile,
        "id" | "full_name" | "role" | "avatar_url"
      > | null;
    };
    type RawDeliv = Deliverable & {
      profiles: Pick<
        Profile,
        "id" | "full_name" | "role" | "avatar_url"
      > | null;
    };

    const d = deliverable as unknown as RawDeliv;

    const formattedVersions: DeliverableVersionWithSubmitter[] = (
      (versions ?? []) as unknown as RawVersion[]
    ).map((v) => ({
      ...v,
      submitter: v.profiles,
    }));

    const formattedFeedback: DeliverableFeedbackWithReviewer[] = (
      (feedback ?? []) as unknown as RawFeedback[]
    ).map((f) => ({
      ...f,
      reviewer: f.profiles,
    }));

    return {
      ...d,
      assignee: d.profiles,
      versions: formattedVersions,
      feedback: formattedFeedback,
    };
  } catch (err) {
    logger.debug("Failed in getDeliverableDetail", { err });
    return null;
  }
}

export async function listDeliverableVersions(
  supabase: TypedSupabase,
  deliverableId: string,
): Promise<DeliverableVersionWithSubmitter[]> {
  try {
    const { data, error } = await supabase
      .from("deliverable_versions")
      .select("*, profiles(id, full_name, role, avatar_url)")
      .eq("deliverable_id", deliverableId)
      .order("version_number", { ascending: false });

    if (error || !data) {
      if (error)
        logger.debug("Error in listDeliverableVersions", {
          error: error.message,
        });
      return [];
    }

    type RawVersion = DeliverableVersion & {
      profiles: Pick<
        Profile,
        "id" | "full_name" | "role" | "avatar_url"
      > | null;
    };

    return ((data ?? []) as unknown as RawVersion[]).map((v) => ({
      ...v,
      submitter: v.profiles,
    }));
  } catch (err) {
    logger.debug("Failed in listDeliverableVersions", { err });
    return [];
  }
}

export async function listVersionFeedback(
  supabase: TypedSupabase,
  versionId: string,
): Promise<DeliverableFeedbackWithReviewer[]> {
  try {
    const { data, error } = await supabase
      .from("deliverable_feedback")
      .select("*, profiles(id, full_name, role, avatar_url)")
      .eq("version_id", versionId)
      .order("reviewed_at", { ascending: true });

    if (error || !data) {
      if (error)
        logger.debug("Error in listVersionFeedback", { error: error.message });
      return [];
    }

    type RawFeedback = DeliverableFeedback & {
      profiles: Pick<
        Profile,
        "id" | "full_name" | "role" | "avatar_url"
      > | null;
    };

    return ((data ?? []) as unknown as RawFeedback[]).map((f) => ({
      ...f,
      reviewer: f.profiles,
    }));
  } catch (err) {
    logger.debug("Failed in listVersionFeedback", { err });
    return [];
  }
}
