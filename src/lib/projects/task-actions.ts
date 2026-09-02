"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import * as projectCommands from "@/lib/projects/commands";
import * as commentCommands from "@/lib/comments/commands";
import { listComments } from "@/lib/comments/queries";
import { CreateCommentSchema } from "@/lib/comments/schemas";
import type { CreateCommentResult } from "@/lib/comments/commands";
import type { TransitionResult } from "@/lib/projects/commands";
import type { CommandResult } from "@/lib/projects/errors";
import {
  CreateTaskSchema,
  CreateTaskWithDeliverablesSchema,
  UpdateTaskSchema,
  TransitionTaskStatusSchema,
  type UpdateTaskInput,
  type TransitionTaskStatusInput,
} from "@/lib/projects/schemas";
import type { Task } from "@/lib/projects/queries";
import type { CollaborationCommentWithAuthor } from "@/lib/comments/queries";
import { verifyPmLeadCapacity } from "@/lib/deliverables/auth-checks";

function revalidateProjectWorkspaces(projectId: string) {
  revalidatePath(`/admin/proyectos/${projectId}`);
  revalidatePath(`/pm/proyectos/${projectId}`);
  revalidatePath(`/en/admin/proyectos/${projectId}`);
  revalidatePath(`/en/pm/proyectos/${projectId}`);
}

// ── Task Creation ────────────────────────────────────────────────────────────

export async function createTaskAction(
  rawInput: unknown,
): Promise<CommandResult<Task>> {
  const parseResult = CreateTaskSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: parseResult.error.issues[0]?.message ?? "Invalid input",
      },
    };
  }
  const input = parseResult.data;

  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);
  const supabase = createClient(cookieStore);

  const isLead = await verifyPmLeadCapacity(
    supabase,
    session.user.id,
    session.role,
    input.project_id,
  );
  if (!isLead) {
    return {
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Only Admins and active PM Leads can create tasks",
      },
    };
  }

  const result = await projectCommands.createTask(
    supabase,
    input,
    session.user.id,
  );

  if (result.ok) {
    revalidateProjectWorkspaces(input.project_id);
  }
  return result;
}

export async function createTaskWithDeliverablesAction(
  rawInput: unknown,
): Promise<CommandResult<projectCommands.CreateTaskWithDeliverablesResult>> {
  const parseResult = CreateTaskWithDeliverablesSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: parseResult.error.issues[0]?.message ?? "Invalid input",
      },
    };
  }
  const input = parseResult.data;

  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);
  const supabase = createClient(cookieStore);

  const isLead = await verifyPmLeadCapacity(
    supabase,
    session.user.id,
    session.role,
    input.project_id,
  );
  if (!isLead) {
    return {
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message:
          "Only Admins and active PM Leads can create tasks and deliverables",
      },
    };
  }

  const derivedWorkflow =
    input.task_type === "internal_work" ? "production" : "client_submission";

  const deliverablesPayload: projectCommands.DeliverableDraftPayload[] =
    input.deliverables.map((d) => ({
      title: d.title,
      specifications: d.specifications,
      assignee_id: d.assignee_id,
      workflow_type: derivedWorkflow,
      submission_deadline_at: d.submission_deadline_at,
      internal_review_deadline_at: d.internal_review_deadline_at,
      client_delivery_deadline_at: d.client_delivery_deadline_at,
    }));

  const result = await projectCommands.createTaskWithDeliverables(
    supabase,
    input,
    deliverablesPayload,
  );

  if (result.ok) {
    revalidateProjectWorkspaces(input.project_id);
  }
  return result;
}

// ── Task Update ──────────────────────────────────────────────────────────────

export async function updateTaskAction(
  taskId: string,
  projectId: string,
  rawInput: UpdateTaskInput,
): Promise<CommandResult<Task>> {
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);

  if (session.role !== "admin" && session.role !== "pm") {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized role" },
    };
  }

  const parseResult = UpdateTaskSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: parseResult.error.issues[0]?.message ?? "Invalid input",
      },
    };
  }

  const supabase = createClient(cookieStore);
  const result = await projectCommands.updateTask(
    supabase,
    taskId,
    parseResult.data,
    session.user.id,
  );

  if (result.ok) {
    revalidatePath(
      `/[locale]/(protected)/admin/proyectos/${projectId}`,
      "page",
    );
    revalidatePath(`/[locale]/(protected)/pm/proyectos/${projectId}`, "page");
  }
  return result;
}

// ── Task Status Transition ───────────────────────────────────────────────────

export async function transitionTaskStatusAction(
  taskId: string,
  projectId: string,
  rawInput: TransitionTaskStatusInput,
): Promise<CommandResult<TransitionResult>> {
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);

  if (session.role !== "admin" && session.role !== "pm") {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized role" },
    };
  }

  const parseResult = TransitionTaskStatusSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: parseResult.error.issues[0]?.message ?? "Invalid input",
      },
    };
  }

  const supabase = createClient(cookieStore);
  const result = await projectCommands.transitionTaskStatus(
    supabase,
    parseResult.data,
  );

  if (result.ok) {
    revalidatePath(
      `/[locale]/(protected)/admin/proyectos/${projectId}`,
      "page",
    );
    revalidatePath(`/[locale]/(protected)/pm/proyectos/${projectId}`, "page");
  }
  return result;
}

// ── Task Collaboration Comments ──────────────────────────────────────────────

export async function createTaskCommentAction(
  projectId: string,
  taskId: string,
  body: string,
): Promise<CommandResult<CreateCommentResult>> {
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);

  // pm_watcher is permitted to comment in advisory capacity
  if (session.role !== "admin" && session.role !== "pm") {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized role" },
    };
  }

  const parseResult = CreateCommentSchema.safeParse({
    project_id: projectId,
    target_type: "task",
    target_id: taskId,
    body,
  });

  if (!parseResult.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: parseResult.error.issues[0]?.message ?? "Invalid input",
      },
    };
  }

  const supabase = createClient(cookieStore);
  const result = await commentCommands.createComment(
    supabase,
    parseResult.data,
  );

  if (result.ok) {
    revalidatePath(
      `/[locale]/(protected)/admin/proyectos/${projectId}`,
      "page",
    );
    revalidatePath(`/[locale]/(protected)/pm/proyectos/${projectId}`, "page");
  }
  return result;
}

export async function listTaskCommentsAction(
  taskId: string,
): Promise<CollaborationCommentWithAuthor[]> {
  const cookieStore = await cookies();
  await requireSession(cookieStore);
  const supabase = createClient(cookieStore);
  return listComments(supabase, taskId, "task");
}
