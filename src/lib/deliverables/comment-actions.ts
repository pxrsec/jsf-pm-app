"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { CommandResult } from "@/lib/projects/errors";
import {
  createComment,
  type CreateCommentResult,
} from "@/lib/comments/commands";
import {
  listComments,
  type CollaborationCommentWithAuthor,
} from "@/lib/comments/queries";
import { verifyProjectMemberAccess } from "./auth-checks";

function revalidateProjectWorkspaces(projectId: string) {
  revalidatePath(`/admin/proyectos/${projectId}`);
  revalidatePath(`/pm/proyectos/${projectId}`);
  revalidatePath(`/en/admin/proyectos/${projectId}`);
  revalidatePath(`/en/pm/proyectos/${projectId}`);
}

export async function createDeliverableCommentAction(params: {
  projectId: string;
  deliverableId: string;
  body: string;
}): Promise<CommandResult<CreateCommentResult>> {
  if (!params.body || params.body.trim().length === 0) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: "Comment body is required",
      },
    };
  }

  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);
  const supabase = createClient(cookieStore);

  const hasAccess = await verifyProjectMemberAccess(
    supabase,
    session.user.id,
    session.role,
    params.projectId,
  );
  if (!hasAccess) {
    return {
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Not authorized to comment on this project",
      },
    };
  }

  const result = await createComment(supabase, {
    project_id: params.projectId,
    target_type: "deliverable",
    target_id: params.deliverableId,
    body: params.body.trim(),
  });

  if (result.ok) {
    revalidateProjectWorkspaces(params.projectId);
  }

  return result;
}

export async function listDeliverableCommentsAction(
  deliverableId: string,
): Promise<CollaborationCommentWithAuthor[]> {
  const cookieStore = await cookies();
  await requireSession(cookieStore);
  const supabase = createClient(cookieStore);

  return listComments(supabase, deliverableId, "deliverable");
}
