"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { CommandResult } from "@/lib/projects/errors";
import {
  SubmitDeliverableVersionSchema,
  type SubmitDeliverableVersionInput,
} from "@/lib/deliverables/schemas";
import {
  submitDeliverableVersion,
  type SubmitVersionResult,
} from "@/lib/deliverables/commands";
import { getOperatorDeliverableForSubmission } from "./queries";

export async function submitOperatorDeliverableVersionAction(
  input: SubmitDeliverableVersionInput,
): Promise<CommandResult<SubmitVersionResult>> {
  const parsed = SubmitDeliverableVersionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: "Invalid submission input",
      },
    };
  }

  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);

  if (session.role !== "operator") {
    return {
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Only operators can submit deliverables through this action",
      },
    };
  }

  const supabase = await createClient(cookieStore);
  const target = await getOperatorDeliverableForSubmission(
    supabase,
    parsed.data.deliverable_id,
  );

  if (!target) {
    return {
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "Deliverable not found or not accessible",
      },
    };
  }

  if (
    target.deliverableWorkflowType !== "production" ||
    (target.deliverableStatus !== "pending" &&
      target.deliverableStatus !== "changes_requested")
  ) {
    return {
      ok: false,
      error: {
        code: "INVALID_TRANSITION",
        message: "Deliverable is not in an eligible state for submission",
      },
    };
  }

  const result = await submitDeliverableVersion(supabase, parsed.data);

  if (result.ok) {
    revalidatePath("/operador/agenda");
    revalidatePath("/en/operador/agenda");
    revalidatePath("/operador/proyectos");
    revalidatePath("/en/operador/proyectos");
    revalidatePath(`/operador/proyectos/${target.projectId}`);
    revalidatePath(`/en/operador/proyectos/${target.projectId}`);
    revalidatePath(`/operador/tareas/${target.taskId}`);
    revalidatePath(`/en/operador/tareas/${target.taskId}`);
  }

  return result;
}
