"use server";

import { cookies } from "next/headers";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  fetchAdminAuditPage,
  fetchAdminUserInvitationStatePage,
} from "./queries";
import type {
  AdminAuditCursor,
  AdminAuditPage,
  AdminAuditQuery,
  AdminUserInvitationCursor,
  AdminUserInvitationPage,
} from "./types";
import {
  adminAuditCursorSchema,
  adminAuditQuerySchema,
  adminUserInvitationCursorSchema,
} from "./schemas";

export type AdminActionResult<T> =
  { ok: true; data: T } | { ok: false; code: "UNAVAILABLE" };

export async function loadAdminAuditPageAction(payload: {
  query: AdminAuditQuery;
  cursor?: AdminAuditCursor | null;
}): Promise<AdminActionResult<AdminAuditPage>> {
  try {
    const cookieStore = await cookies();
    const session = await requireSession(cookieStore);

    if (session.role !== "admin") {
      return { ok: false, code: "UNAVAILABLE" };
    }

    const queryParsed = adminAuditQuerySchema.safeParse(payload.query);
    if (!queryParsed.success) {
      return { ok: false, code: "UNAVAILABLE" };
    }

    if (payload.cursor !== undefined && payload.cursor !== null) {
      const cursorParsed = adminAuditCursorSchema.safeParse(payload.cursor);
      if (!cursorParsed.success) {
        return { ok: false, code: "UNAVAILABLE" };
      }
    }

    const supabase = createClient(cookieStore);
    const result = await fetchAdminAuditPage(
      supabase,
      payload.query,
      payload.cursor,
    );

    if (result.status === "available") {
      return { ok: true, data: result.data };
    }

    return { ok: false, code: "UNAVAILABLE" };
  } catch {
    return { ok: false, code: "UNAVAILABLE" };
  }
}

export async function loadAdminUserInvitationStatePageAction(payload: {
  cursor?: AdminUserInvitationCursor | null;
}): Promise<AdminActionResult<AdminUserInvitationPage>> {
  try {
    const cookieStore = await cookies();
    const session = await requireSession(cookieStore);

    if (session.role !== "admin") {
      return { ok: false, code: "UNAVAILABLE" };
    }

    if (payload.cursor !== undefined && payload.cursor !== null) {
      const cursorParsed = adminUserInvitationCursorSchema.safeParse(
        payload.cursor,
      );
      if (!cursorParsed.success) {
        return { ok: false, code: "UNAVAILABLE" };
      }
    }

    const supabase = createClient(cookieStore);
    const result = await fetchAdminUserInvitationStatePage(
      supabase,
      payload.cursor,
    );

    if (result.status === "available") {
      return { ok: true, data: result.data };
    }

    return { ok: false, code: "UNAVAILABLE" };
  } catch {
    return { ok: false, code: "UNAVAILABLE" };
  }
}
