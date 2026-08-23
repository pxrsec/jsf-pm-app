"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireSession, AuthError } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  MarkNotificationReadSchema,
  MarkAllNotificationsReadSchema,
  LoadRecipientInboxPageSchema,
} from "./schemas";
import { listRecipientInboxPage } from "./queries";
import type { RecipientInboxPage } from "./inbox-contracts";

export type NotificationActionErrorCode =
  "VALIDATION_FAILED" | "UNAUTHENTICATED" | "UNAVAILABLE";

export type NotificationActionResult =
  | { ok: true; changed: boolean; changedCount?: number }
  | { ok: false; error: { code: NotificationActionErrorCode } };

function revalidateNotificationPaths(): void {
  revalidatePath("/notificaciones");
  revalidatePath("/en/notificaciones");
  revalidatePath("/[locale]/(protected)", "layout");
}

/**
 * Server action to mark a single caller-owned in-app notification recipient as read.
 */
export async function markNotificationReadAction(
  rawInput: unknown,
): Promise<NotificationActionResult> {
  const parsed = MarkNotificationReadSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION_FAILED" } };
  }

  const cookieStore = await cookies();
  try {
    await requireSession(cookieStore);
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, error: { code: "UNAUTHENTICATED" } };
    }
    throw error;
  }

  const supabase = createClient(cookieStore);
  const { data, error } = await supabase.rpc("mark_notification_read", {
    p_notification_recipient_id: parsed.data.notificationRecipientId,
  });

  if (error) {
    logger.debug("notification-action-failed", { action: "mark-one" });
    return { ok: false, error: { code: "UNAVAILABLE" } };
  }

  revalidateNotificationPaths();
  return { ok: true, changed: data === true };
}

/**
 * Server action to mark all caller-owned unread in-app notifications as read.
 */
export async function markAllNotificationsReadAction(
  rawInput?: unknown,
): Promise<NotificationActionResult> {
  const inputToValidate = rawInput === undefined ? {} : rawInput;
  const parsed = MarkAllNotificationsReadSchema.safeParse(inputToValidate);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION_FAILED" } };
  }

  const cookieStore = await cookies();
  try {
    await requireSession(cookieStore);
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, error: { code: "UNAUTHENTICATED" } };
    }
    throw error;
  }

  const supabase = createClient(cookieStore);
  const { data, error } = await supabase.rpc("mark_all_notifications_read");

  if (error || typeof data !== "number" || data < 0) {
    logger.debug("notification-action-failed", { action: "mark-all" });
    return { ok: false, error: { code: "UNAVAILABLE" } };
  }

  revalidateNotificationPaths();
  return { ok: true, changed: data > 0, changedCount: data };
}

/**
 * Server action to load a continuation page of recipient in-app notifications.
 */
export async function loadRecipientInboxPageAction(
  rawInput: unknown,
): Promise<
  | { ok: true; data: RecipientInboxPage }
  | { ok: false; error: { code: NotificationActionErrorCode } }
> {
  const parsed = LoadRecipientInboxPageSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION_FAILED" } };
  }

  const cookieStore = await cookies();
  try {
    await requireSession(cookieStore);
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, error: { code: "UNAUTHENTICATED" } };
    }
    throw error;
  }

  const supabase = createClient(cookieStore);
  try {
    const page = await listRecipientInboxPage(supabase, parsed.data);
    return { ok: true, data: page };
  } catch {
    return { ok: false, error: { code: "UNAVAILABLE" } };
  }
}
