import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { logger } from "@/lib/logger";

export type CollaborationComment =
  Database["public"]["Tables"]["collaboration_comments"]["Row"];
export type CollaborationTargetType =
  Database["public"]["Enums"]["collaboration_target_type"];
export type CollaborationAuthorCapacity =
  Database["public"]["Enums"]["collaboration_author_capacity"];

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export type CollaborationCommentWithAuthor = CollaborationComment & {
  author: Pick<Profile, "id" | "full_name" | "avatar_url" | "role"> | null;
};

type TypedSupabase = SupabaseClient<Database>;

export async function listComments(
  supabase: TypedSupabase,
  targetId: string,
  targetType: CollaborationTargetType,
): Promise<CollaborationCommentWithAuthor[]> {
  try {
    const { data, error } = await supabase
      .from("collaboration_comments")
      .select("*, profiles(id, full_name, avatar_url, role)")
      .eq("target_id", targetId)
      .eq("target_type", targetType)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error || !data) {
      if (error)
        logger.debug("Error in listComments", { error: error.message });
      return [];
    }

    type RawComment = CollaborationComment & {
      profiles: Pick<
        Profile,
        "id" | "full_name" | "avatar_url" | "role"
      > | null;
    };

    return ((data ?? []) as unknown as RawComment[]).map((c) => ({
      ...c,
      author: c.profiles,
    }));
  } catch (err) {
    logger.debug("Failed in listComments", { err });
    return [];
  }
}
