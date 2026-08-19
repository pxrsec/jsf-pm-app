import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { mapSupabaseError, type CommandResult } from "@/lib/projects/errors";
import type { CreateCommentInput } from "./schemas";

type TypedSupabase = SupabaseClient<Database>;

export type CreateCommentResult = {
  comment_id: string;
  project_id: string;
  author_capacity: string;
};

export async function createComment(
  supabase: TypedSupabase,
  input: CreateCommentInput,
): Promise<CommandResult<CreateCommentResult>> {
  try {
    const { data, error } = await supabase.rpc("create_collaboration_comment", {
      p_project_id: input.project_id,
      p_target_type: input.target_type,
      p_target_id: input.target_id,
      p_body: input.body,
    });

    if (error) return { ok: false, error: mapSupabaseError(error) };
    return { ok: true, data: data as unknown as CreateCommentResult };
  } catch (err) {
    return { ok: false, error: mapSupabaseError(err as { message?: string }) };
  }
}
