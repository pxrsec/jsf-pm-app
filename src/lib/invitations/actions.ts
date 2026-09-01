"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireSession, AuthError } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { appConfig } from "@/config/app.config";
import type { Database } from "@/lib/database.types";
import {
  loadOrdinaryInvitationPageSchema,
  createOrdinaryInvitationSchema,
  rotateOrdinaryInvitationSchema,
  revokeOrdinaryInvitationSchema,
  invitationLinkLocaleSchema,
} from "./schemas";
import { fetchOrdinaryInvitationPage } from "./queries";
import type {
  CreateInvitationResultDto,
  InvitationActionResult,
  InvitationLinkLocale,
  OrdinaryInvitationPageDto,
  OrdinaryInvitationRole,
  OrdinaryInvitationStatus,
  RevokeInvitationResultDto,
} from "./types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_ROLES = new Set<OrdinaryInvitationRole>(["client", "operator"]);
const VALID_STATUSES = new Set<OrdinaryInvitationStatus>([
  "pending",
  "accepted",
  "expired",
  "revoked",
]);

function buildInvitationUrl(
  token: string,
  locale: InvitationLinkLocale,
): string {
  const prefix = locale === "en-US" ? "/en" : "";
  return `${appConfig.appUrl}${prefix}/invitacion?token=${encodeURIComponent(token)}`;
}

export async function loadOrdinaryInvitationPageAction(
  rawInput: unknown,
): Promise<InvitationActionResult<OrdinaryInvitationPageDto>> {
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

    const parseResult = loadOrdinaryInvitationPageSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return { ok: false, code: "VALIDATION_FAILED" };
    }

    const { cursor, limit } = parseResult.data;
    const supabase = createClient(cookieStore);

    const result = await fetchOrdinaryInvitationPage(supabase, cursor, limit);
    if (result.status === "available") {
      return { ok: true, data: result.data };
    }

    return { ok: false, code: "UNAVAILABLE" };
  } catch {
    return { ok: false, code: "UNAVAILABLE" };
  }
}

export async function createOrdinaryInvitationAction(
  rawInput: unknown,
  locale: InvitationLinkLocale,
): Promise<InvitationActionResult<CreateInvitationResultDto>> {
  try {
    const localeParse = invitationLinkLocaleSchema.safeParse(locale);
    if (!localeParse.success) {
      return { ok: false, code: "VALIDATION_FAILED" };
    }

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

    const parseResult = createOrdinaryInvitationSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return { ok: false, code: "VALIDATION_FAILED" };
    }

    const input = parseResult.data;
    const supabase = createClient(cookieStore);

    const { data, error } = await supabase.rpc("create_ordinary_invitation", {
      p_role: input.role as Database["public"]["Enums"]["app_role"],
      p_contact_id:
        input.role === "client"
          ? input.contactId
          : (undefined as unknown as string),
      p_recipient_email:
        input.role === "operator"
          ? input.recipientEmail
          : (undefined as unknown as string),
      p_project_id: input.projectId ?? undefined,
      p_expires_in_hours: input.expiresInHours,
    });

    if (error || !data || data.length !== 1) {
      return { ok: false, code: "UNAVAILABLE" };
    }

    const row = data[0];
    if (
      !row ||
      typeof row.invitation_id !== "string" ||
      !UUID_REGEX.test(row.invitation_id) ||
      !VALID_ROLES.has(row.invitation_role as OrdinaryInvitationRole) ||
      typeof row.expires_at !== "string" ||
      typeof row.invitation_token !== "string" ||
      row.invitation_token.trim().length === 0
    ) {
      return { ok: false, code: "UNAVAILABLE" };
    }

    const invitationUrl = buildInvitationUrl(
      row.invitation_token,
      localeParse.data,
    );

    revalidatePath("/admin/clientes");
    revalidatePath("/en/admin/clientes");
    revalidatePath("/pm/clientes");
    revalidatePath("/en/pm/clientes");

    return {
      ok: true,
      data: {
        invitationId: row.invitation_id,
        role: row.invitation_role as OrdinaryInvitationRole,
        expiresAt: row.expires_at,
        invitationUrl,
      },
    };
  } catch {
    return { ok: false, code: "UNAVAILABLE" };
  }
}

export async function rotateOrdinaryInvitationAction(
  rawInput: unknown,
  locale: InvitationLinkLocale,
): Promise<InvitationActionResult<CreateInvitationResultDto>> {
  try {
    const localeParse = invitationLinkLocaleSchema.safeParse(locale);
    if (!localeParse.success) {
      return { ok: false, code: "VALIDATION_FAILED" };
    }

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

    const parseResult = rotateOrdinaryInvitationSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return { ok: false, code: "VALIDATION_FAILED" };
    }

    const { invitationId, expiresInHours } = parseResult.data;
    const supabase = createClient(cookieStore);

    const { data, error } = await supabase.rpc("rotate_ordinary_invitation", {
      p_invitation_id: invitationId,
      p_expires_in_hours: expiresInHours,
    });

    if (error || !data || data.length !== 1) {
      return { ok: false, code: "UNAVAILABLE" };
    }

    const row = data[0];
    if (
      !row ||
      typeof row.invitation_id !== "string" ||
      !UUID_REGEX.test(row.invitation_id) ||
      !VALID_ROLES.has(row.invitation_role as OrdinaryInvitationRole) ||
      typeof row.expires_at !== "string" ||
      typeof row.invitation_token !== "string" ||
      row.invitation_token.trim().length === 0
    ) {
      return { ok: false, code: "UNAVAILABLE" };
    }

    const invitationUrl = buildInvitationUrl(
      row.invitation_token,
      localeParse.data,
    );

    revalidatePath("/admin/clientes");
    revalidatePath("/en/admin/clientes");
    revalidatePath("/pm/clientes");
    revalidatePath("/en/pm/clientes");

    return {
      ok: true,
      data: {
        invitationId: row.invitation_id,
        role: row.invitation_role as OrdinaryInvitationRole,
        expiresAt: row.expires_at,
        invitationUrl,
      },
    };
  } catch {
    return { ok: false, code: "UNAVAILABLE" };
  }
}

export async function revokeOrdinaryInvitationAction(
  rawInput: unknown,
): Promise<InvitationActionResult<RevokeInvitationResultDto>> {
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

    const parseResult = revokeOrdinaryInvitationSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return { ok: false, code: "VALIDATION_FAILED" };
    }

    const { invitationId } = parseResult.data;
    const supabase = createClient(cookieStore);

    const { data, error } = await supabase.rpc("revoke_ordinary_invitation", {
      p_invitation_id: invitationId,
    });

    if (error || !data || data.length !== 1) {
      return { ok: false, code: "UNAVAILABLE" };
    }

    const row = data[0];
    if (
      !row ||
      typeof row.invitation_id !== "string" ||
      !UUID_REGEX.test(row.invitation_id) ||
      typeof row.changed !== "boolean" ||
      !VALID_STATUSES.has(row.invitation_status as OrdinaryInvitationStatus)
    ) {
      return { ok: false, code: "UNAVAILABLE" };
    }

    revalidatePath("/admin/clientes");
    revalidatePath("/en/admin/clientes");
    revalidatePath("/pm/clientes");
    revalidatePath("/en/pm/clientes");

    return {
      ok: true,
      data: {
        changed: row.changed,
        invitationId: row.invitation_id,
        invitationStatus: row.invitation_status as OrdinaryInvitationStatus,
      },
    };
  } catch {
    return { ok: false, code: "UNAVAILABLE" };
  }
}
