import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { logger } from "@/lib/logger";

export type Client = Database["public"]["Tables"]["clients"]["Row"];
export type ClientInsert = Database["public"]["Tables"]["clients"]["Insert"];
export type ClientUpdate = Database["public"]["Tables"]["clients"]["Update"];

export type ClientContact =
  Database["public"]["Tables"]["client_contacts"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export type ClientListItem = Pick<
  Client,
  | "id"
  | "display_name"
  | "legal_name"
  | "slug"
  | "is_active"
  | "default_drive_folder_url"
  | "notes"
  | "created_at"
>;

export type ClientContactWithProfile = ClientContact & {
  profile: Pick<Profile, "id" | "full_name" | "avatar_url" | "role"> | null;
};

type TypedSupabase = SupabaseClient<Database>;

export async function listActiveClients(
  supabase: TypedSupabase,
): Promise<ClientListItem[]> {
  try {
    const { data, error } = await supabase
      .from("clients")
      .select(
        "id, display_name, legal_name, slug, is_active, default_drive_folder_url, notes, created_at",
      )
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("display_name", { ascending: true });

    if (error || !data) {
      if (error)
        logger.debug("Error in listActiveClients", { error: error.message });
      return [];
    }
    return data;
  } catch (err) {
    logger.debug("Failed in listActiveClients", { err });
    return [];
  }
}

export async function getClientById(
  supabase: TypedSupabase,
  clientId: string,
): Promise<Client | null> {
  try {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      if (error)
        logger.debug("Error in getClientById", { error: error.message });
      return null;
    }
    return data;
  } catch (err) {
    logger.debug("Failed in getClientById", { err });
    return null;
  }
}

export async function listClientContacts(
  supabase: TypedSupabase,
  clientId: string,
): Promise<ClientContactWithProfile[]> {
  try {
    const { data, error } = await supabase
      .from("client_contacts")
      .select("*, profiles(id, full_name, avatar_url, role)")
      .eq("client_id", clientId)
      .is("deleted_at", null);

    if (error || !data) {
      if (error)
        logger.debug("Error in listClientContacts", { error: error.message });
      return [];
    }

    type RawContact = ClientContact & {
      profiles: Pick<
        Profile,
        "id" | "full_name" | "avatar_url" | "role"
      > | null;
    };

    return ((data ?? []) as unknown as RawContact[]).map((c) => ({
      ...c,
      profile: c.profiles,
    }));
  } catch (err) {
    logger.debug("Failed in listClientContacts", { err });
    return [];
  }
}
