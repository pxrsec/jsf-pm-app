"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import {
  ReopenProjectSchema,
  type ReopenProjectInput,
} from "@/lib/projects/schemas";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import * as projectCommands from "@/lib/projects/commands";
import type { CommandResult } from "@/lib/projects/errors";
import type { ProjectCompletionReadiness } from "@/lib/projects/commands";

// ── Completion Readiness Preflight ──────────────────────────────────────────

export async function getCompletionReadinessAction(
  projectId: string,
): Promise<CommandResult<ProjectCompletionReadiness>> {
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);

  if (session.role !== "admin" && session.role !== "pm") {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized role" },
    };
  }

  const supabase = createClient(cookieStore);
  return projectCommands.getCompletionReadiness(supabase, projectId);
}

// ── Reopen Project Action ───────────────────────────────────────────────────

export async function reopenProjectAction(
  rawInput: ReopenProjectInput,
): Promise<CommandResult<projectCommands.TransitionResult>> {
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);

  if (session.role !== "admin" && session.role !== "pm") {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized role" },
    };
  }

  const parseResult = ReopenProjectSchema.safeParse(rawInput);
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
  const result = await projectCommands.transitionProjectStatus(supabase, {
    project_id: parseResult.data.project_id,
    next_status: "in_progress",
    reopen_reason: parseResult.data.reopen_reason,
    confirm_unfinished: false,
  });

  if (result.ok) {
    revalidatePath(
      `/[locale]/(protected)/admin/proyectos/${rawInput.project_id}`,
      "page",
    );
    revalidatePath(
      `/[locale]/(protected)/pm/proyectos/${rawInput.project_id}`,
      "page",
    );
    revalidatePath("/[locale]/(protected)/admin/proyectos", "page");
    revalidatePath("/[locale]/(protected)/pm/proyectos", "page");
  }

  return result;
}
