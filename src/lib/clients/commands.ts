import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { mapSupabaseError, type CommandResult } from "@/lib/projects/errors";
import type { CreateClientInput } from "./schemas";
import type { Client } from "./queries";

type TypedSupabase = SupabaseClient<Database>;

export async function createClient(
  supabase: TypedSupabase,
  input: CreateClientInput,
  actorId?: string,
): Promise<CommandResult<Client>> {
  try {
    const { data, error } = await supabase
      .from("clients")
      .insert({
        display_name: input.display_name,
        legal_name: input.legal_name,
        slug: input.slug,
        default_drive_folder_url: input.default_drive_folder_url ?? null,
        notes: input.notes ?? null,
        is_active: true,
        created_by: actorId ?? null,
      })
      .select("*")
      .single();

    if (error || !data) return { ok: false, error: mapSupabaseError(error) };
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: mapSupabaseError(err as { message?: string }) };
  }
}
