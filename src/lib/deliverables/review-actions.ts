"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { CommandResult } from "@/lib/projects/errors";
import {
  ReviewDeliverableActionSchema,
  MarkDeliverableDeliveredActionSchema,
  type ReviewDeliverableActionInput,
  type MarkDeliverableDeliveredActionInput,
} from "./schemas";
import {
  reviewDeliverable,
  markDeliverableDelivered,
  type ReviewDeliverableResult,
  type DeliverResult,
} from "./commands";
import { verifyPmLeadCapacity } from "./auth-checks";

function revalidateProjectWorkspaces(projectId: string) {
  revalidatePath(`/admin/proyectos/${projectId}`);
  revalidatePath(`/pm/proyectos/${projectId}`);
  revalidatePath(`/en/admin/proyectos/${projectId}`);
  revalidatePath(`/en/pm/proyectos/${projectId}`);
}

export async function reviewDeliverableAction(
  input: ReviewDeliverableActionInput,
): Promise<CommandResult<ReviewDeliverableResult>> {
  const parsed = ReviewDeliverableActionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: parsed.error.issues[0]?.message ?? "Invalid review parameters",
      },
    };
  }

  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);
  const supabase = createClient(cookieStore);

  const { data: deliverable } = await supabase
    .from("deliverables")
    .select("id, project_id, status, workflow_type")
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
        message: "Only production deliverables can be reviewed",
      },
    };
  }

  const isLead = await verifyPmLeadCapacity(
    supabase,
    session.user.id,
    session.role,
    deliverable.project_id,
  );
  if (!isLead) {
    return {
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Only Admins and active PM Leads can review deliverables",
      },
    };
  }

  const result = await reviewDeliverable(supabase, {
    deliverable_id: parsed.data.deliverable_id,
    stage: "internal",
    decision: parsed.data.decision,
    comments: parsed.data.comments,
  });

  if (result.ok) {
    revalidateProjectWorkspaces(deliverable.project_id);
  }
  return result;
}

export async function markDeliverableDeliveredAction(
  input: MarkDeliverableDeliveredActionInput,
): Promise<CommandResult<DeliverResult>> {
  const parsed = MarkDeliverableDeliveredActionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: "Invalid deliverable or project ID",
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
        message: "Only active PM Lead or Admin can mark deliverable delivered",
      },
    };
  }

  const { data: deliverable } = await supabase
    .from("deliverables")
    .select("id, status, project_id, workflow_type")
    .eq("id", parsed.data.deliverable_id)
    .eq("project_id", parsed.data.project_id)
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
        message: "Only production deliverables can be marked delivered",
      },
    };
  }

  if (deliverable.status !== "approved") {
    return {
      ok: false,
      error: {
        code: "INVALID_TRANSITION",
        message: "Deliverable must be approved before marking delivered",
      },
    };
  }

  const result = await markDeliverableDelivered(
    supabase,
    parsed.data.deliverable_id,
  );

  if (result.ok) {
    revalidateProjectWorkspaces(parsed.data.project_id);
  }
  return result;
}
