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

export type ProfileSummary = {
  id: string;
  full_name: string;
  role: Database["public"]["Enums"]["app_role"];
  avatar_url: string | null;
};

export type DeliverableVersionView = {
  id: string;
  deliverable_id: string;
  version_number: number;
  submission_url: string;
  submission_provider: SubmissionProvider;
  submission_note: string | null;
  submitted_at: string;
  submitted_by: string;
  created_at: string;
  submitter: ProfileSummary | null;
};

export type DeliverableFeedbackView = {
  id: string;
  deliverable_id: string;
  version_id: string;
  stage: ReviewStage;
  decision: ReviewDecision;
  comments: string | null;
  reviewed_at: string;
  reviewed_by: string;
  created_at: string;
  reviewer: ProfileSummary | null;
};

export type DeliverableListItem = {
  id: string;
  project_id: string;
  task_id: string;
  assignee_id: string;
  title: string;
  specifications: string;
  workflow_type: DeliverableWorkflowType;
  status: DeliverableStatus;
  current_version_number: number;
  is_stalled: boolean;
  submission_deadline_at: string | null;
  internal_review_deadline_at: string | null;
  client_delivery_deadline_at: string | null;
  approved_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
  assignee: ProfileSummary | null;
};

export type DeliverableDetailView = {
  id: string;
  project_id: string;
  task_id: string;
  assignee_id: string;
  title: string;
  specifications: string;
  workflow_type: DeliverableWorkflowType;
  status: DeliverableStatus;
  current_version_number: number;
  is_stalled: boolean;
  submission_deadline_at: string | null;
  internal_review_deadline_at: string | null;
  client_delivery_deadline_at: string | null;
  approved_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
  assignee: ProfileSummary | null;
  versions: DeliverableVersionView[];
  feedback: DeliverableFeedbackView[];
};

// Aliases for backwards-compatibility
export type DeliverableVersionWithSubmitter = DeliverableVersionView;
export type DeliverableFeedbackWithReviewer = DeliverableFeedbackView;
export type DeliverableDetail = DeliverableDetailView;

export type DeliverableFilters = {
  status?: DeliverableStatus;
  assignee_id?: string;
  workflow_type?: DeliverableWorkflowType;
  is_stalled?: boolean;
};

type TypedSupabase = SupabaseClient<Database>;

const DELIVERABLE_COLUMNS =
  "id, project_id, task_id, assignee_id, title, specifications, workflow_type, status, current_version_number, is_stalled, submission_deadline_at, internal_review_deadline_at, client_delivery_deadline_at, approved_at, delivered_at, created_at, updated_at";

const VERSION_COLUMNS =
  "id, deliverable_id, version_number, submission_url, submission_provider, submission_note, submitted_at, submitted_by, created_at";

const FEEDBACK_COLUMNS =
  "id, deliverable_id, version_id, stage, decision, comments, reviewed_at, reviewed_by, created_at";

export async function listProjectDeliverables(
  supabase: TypedSupabase,
  projectId: string,
  filters?: DeliverableFilters,
): Promise<DeliverableListItem[]> {
  try {
    let query = supabase
      .from("deliverables")
      .select(
        `${DELIVERABLE_COLUMNS}, tasks!inner(deleted_at, archived_at, projects!inner(deleted_at, archived_at)), profiles(id, full_name, role, avatar_url)`,
      )
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .is("archived_at", null)
      .is("tasks.deleted_at", null)
      .is("tasks.archived_at", null)
      .is("tasks.projects.deleted_at", null)
      .is("tasks.projects.archived_at", null)
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

    type RawRow = Omit<DeliverableListItem, "assignee"> & {
      profiles: ProfileSummary | null;
    };

    return ((data ?? []) as unknown as RawRow[]).map((d) => ({
      id: d.id,
      project_id: d.project_id,
      task_id: d.task_id,
      assignee_id: d.assignee_id,
      title: d.title,
      specifications: d.specifications,
      workflow_type: d.workflow_type,
      status: d.status,
      current_version_number: d.current_version_number,
      is_stalled: d.is_stalled,
      submission_deadline_at: d.submission_deadline_at,
      internal_review_deadline_at: d.internal_review_deadline_at,
      client_delivery_deadline_at: d.client_delivery_deadline_at,
      approved_at: d.approved_at,
      delivered_at: d.delivered_at,
      created_at: d.created_at,
      updated_at: d.updated_at,
      assignee: d.profiles,
    }));
  } catch (err) {
    logger.debug("Failed in listProjectDeliverables", { err });
    return [];
  }
}

type RawVersion = Omit<DeliverableVersionView, "submitter"> & {
  profiles: ProfileSummary | null;
};
type RawFeedback = Omit<DeliverableFeedbackView, "reviewer"> & {
  profiles: ProfileSummary | null;
};
type RawDeliv = Omit<DeliverableListItem, "assignee"> & {
  profiles: ProfileSummary | null;
};

function formatDeliverableDetailView(
  deliverable: RawDeliv,
  versions: RawVersion[],
  feedback: RawFeedback[],
): DeliverableDetailView {
  const formattedVersions: DeliverableVersionView[] = versions.map((v) => ({
    id: v.id,
    deliverable_id: v.deliverable_id,
    version_number: v.version_number,
    submission_url: v.submission_url,
    submission_provider: v.submission_provider,
    submission_note: v.submission_note,
    submitted_at: v.submitted_at,
    submitted_by: v.submitted_by,
    created_at: v.created_at,
    submitter: v.profiles,
  }));

  const formattedFeedback: DeliverableFeedbackView[] = feedback.map((f) => ({
    id: f.id,
    deliverable_id: f.deliverable_id,
    version_id: f.version_id,
    stage: f.stage,
    decision: f.decision,
    comments: f.comments,
    reviewed_at: f.reviewed_at,
    reviewed_by: f.reviewed_by,
    created_at: f.created_at,
    reviewer: f.profiles,
  }));

  return {
    id: deliverable.id,
    project_id: deliverable.project_id,
    task_id: deliverable.task_id,
    assignee_id: deliverable.assignee_id,
    title: deliverable.title,
    specifications: deliverable.specifications,
    workflow_type: deliverable.workflow_type,
    status: deliverable.status,
    current_version_number: deliverable.current_version_number,
    is_stalled: deliverable.is_stalled,
    submission_deadline_at: deliverable.submission_deadline_at,
    internal_review_deadline_at: deliverable.internal_review_deadline_at,
    client_delivery_deadline_at: deliverable.client_delivery_deadline_at,
    approved_at: deliverable.approved_at,
    delivered_at: deliverable.delivered_at,
    created_at: deliverable.created_at,
    updated_at: deliverable.updated_at,
    assignee: deliverable.profiles,
    versions: formattedVersions,
    feedback: formattedFeedback,
  };
}

export async function getDeliverableDetail(
  supabase: TypedSupabase,
  deliverableId: string,
): Promise<DeliverableDetailView | null> {
  try {
    const { data: deliverable, error: delivError } = await supabase
      .from("deliverables")
      .select(
        `${DELIVERABLE_COLUMNS}, tasks!inner(deleted_at, archived_at, projects!inner(deleted_at, archived_at)), profiles(id, full_name, role, avatar_url)`,
      )
      .eq("id", deliverableId)
      .is("deleted_at", null)
      .is("archived_at", null)
      .is("tasks.deleted_at", null)
      .is("tasks.archived_at", null)
      .is("tasks.projects.deleted_at", null)
      .is("tasks.projects.archived_at", null)
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
      .select(`${VERSION_COLUMNS}, profiles(id, full_name, role, avatar_url)`)
      .eq("deliverable_id", deliverableId)
      .order("version_number", { ascending: false });

    if (verError) {
      logger.debug("Error in getDeliverableDetail versions", {
        error: verError.message,
      });
    }

    const { data: feedback, error: fbError } = await supabase
      .from("deliverable_feedback")
      .select(`${FEEDBACK_COLUMNS}, profiles(id, full_name, role, avatar_url)`)
      .eq("deliverable_id", deliverableId)
      .order("reviewed_at", { ascending: true });

    if (fbError) {
      logger.debug("Error in getDeliverableDetail feedback", {
        error: fbError.message,
      });
    }

    return formatDeliverableDetailView(
      deliverable as unknown as RawDeliv,
      (versions ?? []) as unknown as RawVersion[],
      (feedback ?? []) as unknown as RawFeedback[],
    );
  } catch (err) {
    logger.debug("Failed in getDeliverableDetail", { err });
    return null;
  }
}

export type ManagerTaskDeliverableScope = {
  taskId: string;
  projectId: string;
};

export async function getManagerTaskDeliverableDetail(
  supabase: TypedSupabase,
  deliverableId: string,
  scope: ManagerTaskDeliverableScope,
): Promise<DeliverableDetailView | null> {
  try {
    const { data: deliverable, error: delivError } = await supabase
      .from("deliverables")
      .select(
        `${DELIVERABLE_COLUMNS}, tasks!inner(deleted_at, archived_at, projects!inner(deleted_at, archived_at)), profiles(id, full_name, role, avatar_url)`,
      )
      .eq("id", deliverableId)
      .eq("task_id", scope.taskId)
      .eq("project_id", scope.projectId)
      .is("deleted_at", null)
      .is("archived_at", null)
      .is("tasks.deleted_at", null)
      .is("tasks.archived_at", null)
      .is("tasks.projects.deleted_at", null)
      .is("tasks.projects.archived_at", null)
      .maybeSingle();

    if (delivError || !deliverable) {
      if (delivError) {
        logger.error("Error in getManagerTaskDeliverableDetail root query", {
          error: delivError.message,
          deliverableId,
          scope,
        });
      }
      return null;
    }

    // Fail closed: version history query failure must return null, never fake []
    const { data: versions, error: verError } = await supabase
      .from("deliverable_versions")
      .select(`${VERSION_COLUMNS}, profiles(id, full_name, role, avatar_url)`)
      .eq("deliverable_id", deliverableId)
      .order("version_number", { ascending: false });

    if (verError || !versions) {
      logger.error("Error in getManagerTaskDeliverableDetail versions query", {
        error: verError?.message,
        deliverableId,
      });
      return null;
    }

    // Fail closed: feedback history query failure must return null, never fake []
    const { data: feedback, error: fbError } = await supabase
      .from("deliverable_feedback")
      .select(`${FEEDBACK_COLUMNS}, profiles(id, full_name, role, avatar_url)`)
      .eq("deliverable_id", deliverableId)
      .order("reviewed_at", { ascending: true });

    if (fbError || !feedback) {
      logger.error("Error in getManagerTaskDeliverableDetail feedback query", {
        error: fbError?.message,
        deliverableId,
      });
      return null;
    }

    return formatDeliverableDetailView(
      deliverable as unknown as RawDeliv,
      versions as unknown as RawVersion[],
      feedback as unknown as RawFeedback[],
    );
  } catch (err) {
    logger.error("Unexpected failure in getManagerTaskDeliverableDetail", {
      err,
      deliverableId,
      scope,
    });
    return null;
  }
}

export async function listDeliverableVersions(
  supabase: TypedSupabase,
  deliverableId: string,
): Promise<DeliverableVersionView[]> {
  try {
    const { data, error } = await supabase
      .from("deliverable_versions")
      .select(`${VERSION_COLUMNS}, profiles(id, full_name, role, avatar_url)`)
      .eq("deliverable_id", deliverableId)
      .order("version_number", { ascending: false });

    if (error || !data) {
      if (error)
        logger.debug("Error in listDeliverableVersions", {
          error: error.message,
        });
      return [];
    }

    type RawVersion = Omit<DeliverableVersionView, "submitter"> & {
      profiles: ProfileSummary | null;
    };

    return ((data ?? []) as unknown as RawVersion[]).map((v) => ({
      id: v.id,
      deliverable_id: v.deliverable_id,
      version_number: v.version_number,
      submission_url: v.submission_url,
      submission_provider: v.submission_provider,
      submission_note: v.submission_note,
      submitted_at: v.submitted_at,
      submitted_by: v.submitted_by,
      created_at: v.created_at,
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
): Promise<DeliverableFeedbackView[]> {
  try {
    const { data, error } = await supabase
      .from("deliverable_feedback")
      .select(`${FEEDBACK_COLUMNS}, profiles(id, full_name, role, avatar_url)`)
      .eq("version_id", versionId)
      .order("reviewed_at", { ascending: true });

    if (error || !data) {
      if (error)
        logger.debug("Error in listVersionFeedback", { error: error.message });
      return [];
    }

    type RawFeedback = Omit<DeliverableFeedbackView, "reviewer"> & {
      profiles: ProfileSummary | null;
    };

    return ((data ?? []) as unknown as RawFeedback[]).map((f) => ({
      id: f.id,
      deliverable_id: f.deliverable_id,
      version_id: f.version_id,
      stage: f.stage,
      decision: f.decision,
      comments: f.comments,
      reviewed_at: f.reviewed_at,
      reviewed_by: f.reviewed_by,
      created_at: f.created_at,
      reviewer: f.profiles,
    }));
  } catch (err) {
    logger.debug("Failed in listVersionFeedback", { err });
    return [];
  }
}
