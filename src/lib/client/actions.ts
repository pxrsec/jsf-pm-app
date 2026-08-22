"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  transitionTaskStatus,
  type TransitionResult,
} from "@/lib/projects/commands";
import {
  reviewDeliverable,
  type ReviewDeliverableResult,
  submitClientDeliverable,
  type SubmitClientDeliverableResult,
} from "@/lib/deliverables/commands";
import type { CommandResult } from "@/lib/deliverables/errors";
import {
  getClientRequestForTransition,
  getClientProductionReviewForDecision,
  getClientSubmissionForSubmission,
} from "./queries";
import {
  StartClientRequestSchema,
  CompleteClientRequestSchema,
  ApproveClientDeliverableSchema,
  RequestClientDeliverableChangesSchema,
  SubmitClientDeliverableSchema,
} from "./schemas";
import { validateClientSubmissionUrl } from "./submission-url";

export async function startClientRequestAction(
  rawInput: unknown,
): Promise<CommandResult<TransitionResult>> {
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);

  if (session.role !== "client") {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized" },
    };
  }

  const parsed = StartClientRequestSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "VALIDATION_FAILED", message: "Validation failed" },
    };
  }

  const supabase = createClient(cookieStore);
  const target = await getClientRequestForTransition(
    supabase,
    parsed.data.task_id,
  );

  if (!target) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "Request not found" },
    };
  }

  if (target.status !== "pending") {
    return {
      ok: false,
      error: {
        code: "INVALID_TRANSITION",
        message: "Request is no longer pending",
      },
    };
  }

  const result = await transitionTaskStatus(supabase, {
    task_id: target.id,
    next_status: "in_progress",
  });

  if (result.ok) {
    revalidatePath("/cliente/tareas");
    revalidatePath("/en/cliente/tareas");
    revalidatePath(`/cliente/tareas/${target.id}`);
    revalidatePath(`/en/cliente/tareas/${target.id}`);
    revalidatePath("/cliente/proyectos");
    revalidatePath("/en/cliente/proyectos");
    revalidatePath(`/cliente/proyectos/${target.projectId}`);
    revalidatePath(`/en/cliente/proyectos/${target.projectId}`);
  }

  return result;
}

export async function completeClientRequestAction(
  rawInput: unknown,
): Promise<CommandResult<TransitionResult>> {
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);

  if (session.role !== "client") {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized" },
    };
  }

  const parsed = CompleteClientRequestSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "VALIDATION_FAILED", message: "Validation failed" },
    };
  }

  const supabase = createClient(cookieStore);
  const target = await getClientRequestForTransition(
    supabase,
    parsed.data.task_id,
  );

  if (!target) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "Request not found" },
    };
  }

  if (target.status !== "pending" && target.status !== "in_progress") {
    return {
      ok: false,
      error: {
        code: "INVALID_TRANSITION",
        message: "Request cannot be completed from its current state",
      },
    };
  }

  const result = await transitionTaskStatus(supabase, {
    task_id: target.id,
    next_status: "completed",
  });

  if (result.ok) {
    revalidatePath("/cliente/tareas");
    revalidatePath("/en/cliente/tareas");
    revalidatePath(`/cliente/tareas/${target.id}`);
    revalidatePath(`/en/cliente/tareas/${target.id}`);
    revalidatePath("/cliente/proyectos");
    revalidatePath("/en/cliente/proyectos");
    revalidatePath(`/cliente/proyectos/${target.projectId}`);
    revalidatePath(`/en/cliente/proyectos/${target.projectId}`);
  }

  return result;
}

export async function approveClientDeliverableAction(
  rawInput: unknown,
): Promise<CommandResult<ReviewDeliverableResult>> {
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);

  if (session.role !== "client") {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized" },
    };
  }

  const parsed = ApproveClientDeliverableSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "VALIDATION_FAILED", message: "Validation failed" },
    };
  }

  const supabase = createClient(cookieStore);
  const target = await getClientProductionReviewForDecision(
    supabase,
    parsed.data.deliverable_id,
  );

  if (!target) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "Deliverable not found" },
    };
  }

  if (target.status !== "awaiting_client_review") {
    return {
      ok: false,
      error: {
        code: "INVALID_TRANSITION",
        message: "Deliverable is not awaiting client review",
      },
    };
  }

  const result = await reviewDeliverable(supabase, {
    deliverable_id: target.id,
    stage: "client",
    decision: "approved",
  });

  if (result.ok) {
    revalidatePath("/cliente/entregables");
    revalidatePath("/en/cliente/entregables");
    revalidatePath(`/cliente/entregables/${target.id}`);
    revalidatePath(`/en/cliente/entregables/${target.id}`);
    revalidatePath("/cliente/proyectos");
    revalidatePath("/en/cliente/proyectos");
    revalidatePath(`/cliente/proyectos/${target.projectId}`);
    revalidatePath(`/en/cliente/proyectos/${target.projectId}`);
  }

  return result;
}

export async function requestClientDeliverableChangesAction(
  rawInput: unknown,
): Promise<CommandResult<ReviewDeliverableResult>> {
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);

  if (session.role !== "client") {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized" },
    };
  }

  const parsed = RequestClientDeliverableChangesSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "VALIDATION_FAILED", message: "Validation failed" },
    };
  }

  const supabase = createClient(cookieStore);
  const target = await getClientProductionReviewForDecision(
    supabase,
    parsed.data.deliverable_id,
  );

  if (!target) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "Deliverable not found" },
    };
  }

  if (target.status !== "awaiting_client_review") {
    return {
      ok: false,
      error: {
        code: "INVALID_TRANSITION",
        message: "Deliverable is not awaiting client review",
      },
    };
  }

  const result = await reviewDeliverable(supabase, {
    deliverable_id: target.id,
    stage: "client",
    decision: "changes_requested",
    comments: parsed.data.comments,
  });

  if (result.ok) {
    revalidatePath("/cliente/entregables");
    revalidatePath("/en/cliente/entregables");
    revalidatePath(`/cliente/entregables/${target.id}`);
    revalidatePath(`/en/cliente/entregables/${target.id}`);
    revalidatePath("/cliente/proyectos");
    revalidatePath("/en/cliente/proyectos");
    revalidatePath(`/cliente/proyectos/${target.projectId}`);
    revalidatePath(`/en/cliente/proyectos/${target.projectId}`);
  }

  return result;
}

export async function submitClientSubmissionAction(
  rawInput: unknown,
): Promise<CommandResult<SubmitClientDeliverableResult>> {
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);

  if (session.role !== "client") {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized" },
    };
  }

  const parsed = SubmitClientDeliverableSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "VALIDATION_FAILED", message: "Validation failed" },
    };
  }

  const urlValidation = validateClientSubmissionUrl(parsed.data.submission_url);
  if (!urlValidation.ok) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: "Submission URL must be a valid public HTTPS URL",
      },
    };
  }

  const supabase = createClient(cookieStore);
  const target = await getClientSubmissionForSubmission(
    supabase,
    parsed.data.deliverable_id,
  );

  if (!target) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "Deliverable not found" },
    };
  }

  if (target.status !== "pending") {
    return {
      ok: false,
      error: {
        code: "INVALID_TRANSITION",
        message: "Deliverable is not pending",
      },
    };
  }

  const result = await submitClientDeliverable(supabase, {
    deliverable_id: target.id,
    submission_url: parsed.data.submission_url,
    submission_note: parsed.data.submission_note,
  });

  if (result.ok) {
    revalidatePath("/cliente/tareas");
    revalidatePath("/en/cliente/tareas");
    revalidatePath(`/cliente/tareas/${target.taskId}`);
    revalidatePath(`/en/cliente/tareas/${target.taskId}`);
    revalidatePath("/cliente/proyectos");
    revalidatePath("/en/cliente/proyectos");
    revalidatePath(`/cliente/proyectos/${target.projectId}`);
    revalidatePath(`/en/cliente/proyectos/${target.projectId}`);
  }

  return result;
}
