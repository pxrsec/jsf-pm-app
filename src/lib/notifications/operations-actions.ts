"use server";

import { cookies } from "next/headers";
import { requireSession, AuthError } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { LoadSuppressedNotificationOperationsPageSchema } from "./operations-schemas";
import {
  assertNotificationOperationsAccess,
  NotificationOperationsAuthorizationError,
} from "./operations-authorization";
import { listSuppressedNotificationOperationsPage } from "./operations-queries";
import type { SuppressedNotificationOperationsPage } from "./operations-contracts";

export type NotificationOperationsActionErrorCode =
  "VALIDATION_FAILED" | "UNAUTHORIZED" | "UNAVAILABLE";

export type LoadSuppressedNotificationOperationsPageActionResult =
  | { ok: true; data: SuppressedNotificationOperationsPage }
  | { ok: false; error: { code: NotificationOperationsActionErrorCode } };

/**
 * Server action to load a continuation page of suppressed notification operations.
 * Enforces strict composite cursor schema, active session, and Admin / PM Lead capacity.
 * Read-only continuation does not call revalidatePath.
 */
export async function loadSuppressedNotificationOperationsPageAction(
  rawInput: unknown,
): Promise<LoadSuppressedNotificationOperationsPageActionResult> {
  const parsed =
    LoadSuppressedNotificationOperationsPageSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION_FAILED" } };
  }

  const cookieStore = await cookies();
  let session;
  try {
    session = await requireSession(cookieStore);
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, error: { code: "UNAUTHORIZED" } };
    }
    throw error;
  }

  const supabase = createClient(cookieStore);
  try {
    await assertNotificationOperationsAccess(supabase, session);
  } catch (error) {
    if (error instanceof NotificationOperationsAuthorizationError) {
      return { ok: false, error: { code: "UNAUTHORIZED" } };
    }
    throw error;
  }

  try {
    const page = await listSuppressedNotificationOperationsPage(
      supabase,
      parsed.data,
    );
    return { ok: true, data: page };
  } catch {
    return { ok: false, error: { code: "UNAVAILABLE" } };
  }
}
