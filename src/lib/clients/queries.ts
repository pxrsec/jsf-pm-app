import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { logger } from "@/lib/logger";
import type {
  AvailableResult,
  ClientContactAdministrationDto,
  ClientOrganizationAdministrationDto,
} from "./types";

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

// ── S10 Administration Queries ───────────────────────────────────────────────

export async function listClientContactsForAdministration(
  supabase: TypedSupabase,
): Promise<AvailableResult<ClientContactAdministrationDto[]>> {
  try {
    const { data, error } = await supabase.rpc(
      "list_client_contacts_for_administration",
    );

    if (error || !data) {
      if (error) {
        logger.debug("Error in listClientContactsForAdministration RPC", {
          error: error.message,
        });
      }
      return { status: "unavailable" };
    }

    const contacts: ClientContactAdministrationDto[] = [];
    for (const row of data) {
      if (
        typeof row.id !== "string" ||
        typeof row.full_name !== "string" ||
        typeof row.email !== "string" ||
        typeof row.is_primary !== "boolean" ||
        typeof row.created_at !== "string" ||
        typeof row.updated_at !== "string"
      ) {
        return { status: "unavailable" };
      }

      contacts.push({
        id: row.id,
        clientId: row.client_id ?? null,
        profileId: row.profile_id ?? null,
        fullName: row.full_name,
        email: row.email,
        phoneE164: row.phone_e164 ?? null,
        jobTitle: row.job_title ?? null,
        isPrimary: row.is_primary,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    }

    return { status: "available", data: contacts };
  } catch (err) {
    logger.debug("Failed in listClientContactsForAdministration", { err });
    return { status: "unavailable" };
  }
}

export async function listClientOrganizationsForAdministration(
  supabase: TypedSupabase,
): Promise<AvailableResult<ClientOrganizationAdministrationDto[]>> {
  try {
    const { data, error } = await supabase.rpc(
      "list_client_organizations_for_administration",
    );

    if (error || !data) {
      if (error) {
        logger.debug("Error in listClientOrganizationsForAdministration RPC", {
          error: error.message,
        });
      }
      return { status: "unavailable" };
    }

    const orgs: ClientOrganizationAdministrationDto[] = [];
    for (const row of data) {
      if (
        typeof row.id !== "string" ||
        typeof row.display_name !== "string" ||
        typeof row.slug !== "string"
      ) {
        return { status: "unavailable" };
      }

      orgs.push({
        id: row.id,
        displayName: row.display_name,
        slug: row.slug,
      });
    }

    return { status: "available", data: orgs };
  } catch (err) {
    logger.debug("Failed in listClientOrganizationsForAdministration", { err });
    return { status: "unavailable" };
  }
}

export async function listProjectClientContactAssociations(
  supabase: TypedSupabase,
  projectId: string,
): Promise<AvailableResult<string[]>> {
  try {
    const { data, error } = await supabase.rpc(
      "list_project_client_contact_associations",
      { p_project_id: projectId },
    );

    if (error || !data) {
      if (error) {
        logger.debug("Error in listProjectClientContactAssociations RPC", {
          error: error.message,
        });
      }
      return { status: "unavailable" };
    }

    const contactIds: string[] = [];
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    for (const row of data) {
      if (
        typeof row.contact_id !== "string" ||
        !uuidRegex.test(row.contact_id)
      ) {
        return { status: "unavailable" };
      }
      contactIds.push(row.contact_id);
    }

    return { status: "available", data: contactIds };
  } catch (err) {
    logger.debug("Failed in listProjectClientContactAssociations", { err });
    return { status: "unavailable" };
  }
}
