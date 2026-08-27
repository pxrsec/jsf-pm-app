"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { CommandResult } from "@/lib/projects/errors";
import {
  CreateDeliverableSchema,
  UpdateDeliverableSchema,
  SubmitDeliverableVersionSchema,
  ReportBrokenLinkSchema,
  type CreateDeliverableInput,
  type UpdateDeliverableInput,
  type SubmitDeliverableVersionInput,
  type ReportBrokenLinkInput,
} from "./schemas";
import {
  createDeliverable,
  updateDeliverable,
  archiveDeliverable,
  submitDeliverableVersion,
  reportBrokenLink,
  type SubmitVersionResult,
  type BrokenLinkResult,
} from "./commands";
import {
  getDeliverableDetail,
  type Deliverable,
  type DeliverableDetailView,
} from "./queries";
import {
  verifyPmLeadCapacity,
  verifyProjectMemberAccess,
  verifyDeliverableEligibility,
} from "./auth-checks";

function revalidateProjectWorkspaces(projectId: string) {
  revalidatePath(`/admin/proyectos/${projectId}`);
  revalidatePath(`/pm/proyectos/${projectId}`);
  revalidatePath(`/en/admin/proyectos/${projectId}`);
  revalidatePath(`/en/pm/proyectos/${projectId}`);
}

export async function createDeliverableAction(
  input: CreateDeliverableInput,
): Promise<CommandResult<Deliverable>> {
  const parsed = CreateDeliverableSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: "Invalid deliverable input",
      },
    };
  }

  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);
  const supabase = createClient(cookieStore);

  const isLead = await verifyPmLeadCapacity(
    supabase,
    session.user.id,
    session.role,
    parsed.data.project_id,
  );
  if (!isLead) {
    return {
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Only Admins and active PM Leads can create deliverables",
      },
    };
  }

  const eligibility = await verifyDeliverableEligibility(
    supabase,
    parsed.data.project_id,
    parsed.data.task_id,
    parsed.data.assignee_id,
  );
  if (!eligibility.ok) {
    return {
      ok: false,
      error: { code: eligibility.code, message: eligibility.message },
    };
  }

  const result = await createDeliverable(
    supabase,
    { ...parsed.data, workflow_type: eligibility.workflowType },
    session.user.id,
  );
  if (result.ok) revalidateProjectWorkspaces(parsed.data.project_id);
  return result;
}

export async function updateDeliverableAction(params: {
  deliverableId: string;
  projectId: string;
  input: UpdateDeliverableInput;
}): Promise<CommandResult<Deliverable>> {
  const parsed = UpdateDeliverableSchema.safeParse(params.input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: "Invalid deliverable update input",
      },
    };
  }

  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);
  const supabase = createClient(cookieStore);

  const isLead = await verifyPmLeadCapacity(
    supabase,
    session.user.id,
    session.role,
    params.projectId,
  );
  if (!isLead) {
    return {
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Only Admins and active PM Leads can edit deliverables",
      },
    };
  }

  const { data: existing } = await supabase
    .from("deliverables")
    .select(
      "id, project_id, task_id, workflow_type, status, assignee_id, title, specifications, submission_deadline_at, internal_review_deadline_at, client_delivery_deadline_at",
    )
    .eq("id", params.deliverableId)
    .eq("project_id", params.projectId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!existing) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "Deliverable not found" },
    };
  }

  if (
    existing.status !== "pending" &&
    existing.status !== "changes_requested"
  ) {
    return {
      ok: false,
      error: {
        code: "INVALID_TRANSITION",
        message:
          "Planning edits are only allowed in pending or changes_requested",
      },
    };
  }

  const resolved = {
    title: parsed.data.title ?? existing.title,
    specifications: parsed.data.specifications ?? existing.specifications,
    assignee_id: parsed.data.assignee_id ?? existing.assignee_id,
    submission_deadline_at:
      parsed.data.submission_deadline_at !== undefined
        ? parsed.data.submission_deadline_at
        : existing.submission_deadline_at,
    internal_review_deadline_at:
      parsed.data.internal_review_deadline_at !== undefined
        ? parsed.data.internal_review_deadline_at
        : existing.internal_review_deadline_at,
    client_delivery_deadline_at:
      parsed.data.client_delivery_deadline_at !== undefined
        ? parsed.data.client_delivery_deadline_at
        : existing.client_delivery_deadline_at,
  };

  const { data: project } = await supabase
    .from("projects")
    .select("id, project_type, client_id")
    .eq("id", params.projectId)
    .maybeSingle();
  if (!project)
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "Project not found" },
    };

  if (existing.workflow_type === "client_submission") {
    if (!resolved.submission_deadline_at) {
      return {
        ok: false,
        error: {
          code: "INVARIANT_VIOLATION",
          message: "Submission deadline is required for client submission",
        },
      };
    }
    if (
      resolved.internal_review_deadline_at ||
      resolved.client_delivery_deadline_at
    ) {
      return {
        ok: false,
        error: {
          code: "INVARIANT_VIOLATION",
          message:
            "Client submission deliverables forbid review and delivery deadlines",
        },
      };
    }
  } else if (existing.workflow_type === "production") {
    if (!resolved.internal_review_deadline_at) {
      return {
        ok: false,
        error: {
          code: "INVARIANT_VIOLATION",
          message:
            "Internal review deadline is required for production deliverables",
        },
      };
    }
    if (resolved.submission_deadline_at) {
      return {
        ok: false,
        error: {
          code: "INVARIANT_VIOLATION",
          message: "Production deliverables forbid submission deadline",
        },
      };
    }
    if (project.project_type === "client") {
      if (!resolved.client_delivery_deadline_at) {
        return {
          ok: false,
          error: {
            code: "INVARIANT_VIOLATION",
            message:
              "Client delivery deadline is required for client project production deliverables",
          },
        };
      }
      if (
        new Date(resolved.client_delivery_deadline_at) <
        new Date(resolved.internal_review_deadline_at)
      ) {
        return {
          ok: false,
          error: {
            code: "INVARIANT_VIOLATION",
            message:
              "Client delivery deadline must be on or after internal review deadline",
          },
        };
      }
    } else if (resolved.client_delivery_deadline_at) {
      return {
        ok: false,
        error: {
          code: "INVARIANT_VIOLATION",
          message: "Internal projects forbid client delivery deadline",
        },
      };
    }
  }

  if (
    parsed.data.assignee_id &&
    parsed.data.assignee_id !== existing.assignee_id
  ) {
    const { data: assigneeMember } = await supabase
      .from("project_members")
      .select("member_type, profiles!inner(is_active, deleted_at)")
      .eq("project_id", params.projectId)
      .eq("user_id", parsed.data.assignee_id)
      .is("deleted_at", null)
      .eq("profiles.is_active", true)
      .is("profiles.deleted_at", null)
      .maybeSingle();

    if (!assigneeMember) {
      return {
        ok: false,
        error: {
          code: "INVARIANT_VIOLATION",
          message: "Assignee is not an active member of this project",
        },
      };
    }
    if (
      existing.workflow_type === "client_submission" &&
      assigneeMember.member_type !== "client"
    ) {
      return {
        ok: false,
        error: {
          code: "INVARIANT_VIOLATION",
          message: "Assignee for a client submission must be a Client contact",
        },
      };
    }
    if (
      existing.workflow_type === "production" &&
      !["pm_lead", "pm_watcher", "operator"].includes(
        assigneeMember.member_type,
      )
    ) {
      return {
        ok: false,
        error: {
          code: "INVARIANT_VIOLATION",
          message:
            "Assignee for production deliverable must be a PM Lead, PM Watcher, or Operator",
        },
      };
    }
  }

  const result = await updateDeliverable(
    supabase,
    params.deliverableId,
    parsed.data,
    session.user.id,
  );
  if (result.ok) revalidateProjectWorkspaces(params.projectId);
  return result;
}

export async function archiveDeliverableAction(params: {
  deliverableId: string;
  projectId: string;
  reason?: string;
}): Promise<CommandResult<{ success: boolean }>> {
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);
  const supabase = createClient(cookieStore);

  const isLead = await verifyPmLeadCapacity(
    supabase,
    session.user.id,
    session.role,
    params.projectId,
  );
  if (!isLead) {
    return {
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Only Admins and active PM Leads can archive deliverables",
      },
    };
  }

  const result = await archiveDeliverable(
    supabase,
    params.deliverableId,
    params.reason,
  );
  if (result.ok) revalidateProjectWorkspaces(params.projectId);
  return result;
}

export async function submitDeliverableVersionAction(
  input: SubmitDeliverableVersionInput,
): Promise<CommandResult<SubmitVersionResult>> {
  const parsed = SubmitDeliverableVersionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: "Invalid submission URL or parameters",
      },
    };
  }

  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);
  const supabase = createClient(cookieStore);

  const { data: deliverable } = await supabase
    .from("deliverables")
    .select("id, project_id, assignee_id, status, workflow_type")
    .eq("id", parsed.data.deliverable_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!deliverable) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "Deliverable not found" },
    };
  }

  if (deliverable.workflow_type !== "production") {
    return {
      ok: false,
      error: {
        code: "INVARIANT_VIOLATION",
        message:
          "Only production deliverables can submit versions through this action",
      },
    };
  }

  const isAssignee = deliverable.assignee_id === session.user.id;
  const isLead =
    session.role === "admin" ||
    (!isAssignee &&
      (await verifyPmLeadCapacity(
        supabase,
        session.user.id,
        session.role,
        deliverable.project_id,
      )));

  if (!isAssignee && !isLead) {
    return {
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Only the assigned contributor or PM Lead/Admin can submit",
      },
    };
  }

  if (
    deliverable.status !== "pending" &&
    deliverable.status !== "changes_requested"
  ) {
    return {
      ok: false,
      error: {
        code: "INVALID_TRANSITION",
        message: "Deliverable is not in a state awaiting submission",
      },
    };
  }

  const result = await submitDeliverableVersion(supabase, parsed.data);
  if (result.ok) revalidateProjectWorkspaces(deliverable.project_id);
  return result;
}

export async function reportDeliverableLinkAction(
  input: ReportBrokenLinkInput,
): Promise<CommandResult<BrokenLinkResult>> {
  const parsed = ReportBrokenLinkSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: "Invalid link report reason",
      },
    };
  }

  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);
  const supabase = createClient(cookieStore);

  const { data: deliverable } = await supabase
    .from("deliverables")
    .select("id, project_id")
    .eq("id", parsed.data.deliverable_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!deliverable) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "Deliverable not found" },
    };
  }

  const { data: version } = await supabase
    .from("deliverable_versions")
    .select("id")
    .eq("id", parsed.data.version_id)
    .eq("deliverable_id", parsed.data.deliverable_id)
    .maybeSingle();

  if (!version) {
    return {
      ok: false,
      error: {
        code: "INVARIANT_VIOLATION",
        message: "Version does not belong to this deliverable",
      },
    };
  }

  const hasAccess = await verifyProjectMemberAccess(
    supabase,
    session.user.id,
    session.role,
    deliverable.project_id,
  );
  if (!hasAccess) {
    return {
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Not authorized to report link on this project",
      },
    };
  }

  const result = await reportBrokenLink(supabase, parsed.data);
  if (result.ok) revalidateProjectWorkspaces(deliverable.project_id);
  return result;
}

export async function getDeliverableDetailAction(
  deliverableId: string,
): Promise<DeliverableDetailView | null> {
  const cookieStore = await cookies();
  await requireSession(cookieStore);
  const supabase = createClient(cookieStore);

  return getDeliverableDetail(supabase, deliverableId);
}
