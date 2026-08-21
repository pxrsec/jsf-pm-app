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
      error: { code: "INVARIANT_VIOLATION", message: eligibility.message },
    };
  }

  const result = await createDeliverable(
    supabase,
    parsed.data,
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

  const { data: deliverable } = await supabase
    .from("deliverables")
    .select("id, status")
    .eq("id", params.deliverableId)
    .eq("project_id", params.projectId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!deliverable) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "Deliverable not found" },
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
        message:
          "Planning edits are only allowed in pending or changes_requested",
      },
    };
  }

  if (parsed.data.assignee_id) {
    const { data: assigneeMember } = await supabase
      .from("project_members")
      .select("member_type, profiles!inner(is_active)")
      .eq("project_id", params.projectId)
      .eq("user_id", parsed.data.assignee_id)
      .is("deleted_at", null)
      .eq("profiles.is_active", true)
      .maybeSingle();

    if (
      !assigneeMember ||
      !["pm_lead", "pm_watcher", "operator"].includes(
        assigneeMember.member_type,
      )
    ) {
      return {
        ok: false,
        error: {
          code: "INVARIANT_VIOLATION",
          message: "Assignee must be an active compatible project member",
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
    .select("id, project_id, assignee_id, status")
    .eq("id", parsed.data.deliverable_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!deliverable) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "Deliverable not found" },
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
