"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireSession, AuthError } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import {
  saveClientContactSchema,
  setProjectClientContactSchema,
  loadProjectClientContactAssociationsSchema,
} from "./schemas";
import { listProjectClientContactAssociations } from "./queries";
import type { ClientAdministrationActionResult } from "./types";

type SaveClientContactRpcArgs = Omit<
  Database["public"]["Functions"]["save_client_contact"]["Args"],
  "p_contact_id"
> & {
  p_contact_id: string | null;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function saveClientContactAction(
  rawInput: unknown,
): Promise<ClientAdministrationActionResult<{ contactId: string }>> {
  try {
    const cookieStore = await cookies();
    let session;
    try {
      session = await requireSession(cookieStore);
    } catch (err) {
      if (err instanceof AuthError) {
        return { ok: false, code: "UNAUTHORIZED" };
      }
      return { ok: false, code: "UNAVAILABLE" };
    }

    if (session.role !== "admin" && session.role !== "pm") {
      return { ok: false, code: "UNAUTHORIZED" };
    }

    const parseResult = saveClientContactSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return { ok: false, code: "VALIDATION_FAILED" };
    }

    const input = parseResult.data;
    const supabase = createClient(cookieStore);

    const rpcPayload: SaveClientContactRpcArgs = {
      p_contact_id: input.contactId ?? null,
      p_full_name: input.fullName,
      p_email: input.email,
      p_phone_e164: input.phoneE164 ?? undefined,
      p_job_title: input.jobTitle ?? undefined,
      p_client_id: input.clientId ?? undefined,
      p_is_primary: input.isPrimary,
    };

    // Narrow cast at invocation boundary for generated type compatibility
    const { data, error } = await supabase.rpc(
      "save_client_contact",
      rpcPayload as unknown as Database["public"]["Functions"]["save_client_contact"]["Args"],
    );

    if (error || !data || typeof data !== "string" || !UUID_REGEX.test(data)) {
      return { ok: false, code: "UNAVAILABLE" };
    }

    revalidatePath("/admin/clientes");
    revalidatePath("/en/admin/clientes");
    revalidatePath("/pm/clientes");
    revalidatePath("/en/pm/clientes");

    return { ok: true, data: { contactId: data } };
  } catch {
    return { ok: false, code: "UNAVAILABLE" };
  }
}

export async function setProjectClientContactAction(
  rawInput: unknown,
): Promise<ClientAdministrationActionResult<boolean>> {
  try {
    const cookieStore = await cookies();
    let session;
    try {
      session = await requireSession(cookieStore);
    } catch (err) {
      if (err instanceof AuthError) {
        return { ok: false, code: "UNAUTHORIZED" };
      }
      return { ok: false, code: "UNAVAILABLE" };
    }

    if (session.role !== "admin" && session.role !== "pm") {
      return { ok: false, code: "UNAUTHORIZED" };
    }

    const parseResult = setProjectClientContactSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return { ok: false, code: "VALIDATION_FAILED" };
    }

    const { projectId, contactId, associated } = parseResult.data;
    const supabase = createClient(cookieStore);

    const { data, error } = await supabase.rpc("set_project_client_contact", {
      p_project_id: projectId,
      p_contact_id: contactId,
      p_associated: associated,
    });

    if (error || typeof data !== "boolean") {
      return { ok: false, code: "UNAVAILABLE" };
    }

    revalidatePath("/admin/clientes");
    revalidatePath("/en/admin/clientes");
    revalidatePath("/pm/clientes");
    revalidatePath("/en/pm/clientes");
    revalidatePath(`/admin/proyectos/${projectId}`);
    revalidatePath(`/en/admin/proyectos/${projectId}`);
    revalidatePath(`/pm/proyectos/${projectId}`);
    revalidatePath(`/en/pm/proyectos/${projectId}`);

    return { ok: true, data };
  } catch {
    return { ok: false, code: "UNAVAILABLE" };
  }
}

export async function loadProjectClientContactAssociationsAction(
  rawInput: unknown,
): Promise<ClientAdministrationActionResult<string[]>> {
  try {
    const cookieStore = await cookies();
    let session;
    try {
      session = await requireSession(cookieStore);
    } catch (err) {
      if (err instanceof AuthError) {
        return { ok: false, code: "UNAUTHORIZED" };
      }
      return { ok: false, code: "UNAVAILABLE" };
    }

    if (session.role !== "admin" && session.role !== "pm") {
      return { ok: false, code: "UNAUTHORIZED" };
    }

    const parseResult =
      loadProjectClientContactAssociationsSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return { ok: false, code: "VALIDATION_FAILED" };
    }

    const { projectId } = parseResult.data;
    const supabase = createClient(cookieStore);

    const result = await listProjectClientContactAssociations(
      supabase,
      projectId,
    );
    if (result.status === "available") {
      return { ok: true, data: result.data };
    }

    return { ok: false, code: "UNAVAILABLE" };
  } catch {
    return { ok: false, code: "UNAVAILABLE" };
  }
}
