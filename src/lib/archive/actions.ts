"use server";

import { cookies } from "next/headers";
import { requireSession, AuthError } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  LoadFinalizedArchivePageSchema,
  LoadLinkIncidentPageSchema,
} from "./schemas";
import { fetchFinalizedArchivePage, fetchLinkIncidentsPage } from "./queries";
import type { FinalizedArchivePage, LinkIncidentPage } from "./types";
import type { ArchiveErrorCode } from "./errors";

export type ArchiveActionResult<T> =
  { ok: true; data: T } | { ok: false; error: { code: ArchiveErrorCode } };

/**
 * Server action to load a continuation page of finalized production deliverables.
 */
export async function loadFinalizedArchivePageAction(
  rawInput: unknown,
): Promise<ArchiveActionResult<FinalizedArchivePage>> {
  const parsed = LoadFinalizedArchivePageSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION_FAILED" } };
  }

  const cookieStore = await cookies();
  try {
    const session = await requireSession(cookieStore);
    const supabase = createClient(cookieStore);
    const page = await fetchFinalizedArchivePage(
      supabase,
      parsed.data.query,
      parsed.data.cursor,
      session.role,
    );
    return { ok: true, data: page };
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, error: { code: "UNAUTHENTICATED" } };
    }
    return { ok: false, error: { code: "UNAVAILABLE" } };
  }
}

/**
 * Server action to load a continuation page of broken-link incidents.
 */
export async function loadLinkIncidentPageAction(
  rawInput: unknown,
): Promise<ArchiveActionResult<LinkIncidentPage>> {
  const parsed = LoadLinkIncidentPageSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION_FAILED" } };
  }

  const cookieStore = await cookies();
  try {
    const session = await requireSession(cookieStore);
    const supabase = createClient(cookieStore);
    const page = await fetchLinkIncidentsPage(
      supabase,
      parsed.data.query,
      parsed.data.cursor,
      session.role,
    );
    return { ok: true, data: page };
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, error: { code: "UNAUTHENTICATED" } };
    }
    return { ok: false, error: { code: "UNAVAILABLE" } };
  }
}
