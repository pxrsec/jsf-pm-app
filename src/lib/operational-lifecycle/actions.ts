"use server";

import { cookies } from "next/headers";
import { AuthError, requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  archiveOperationalEntity,
  permanentlyDeleteOperationalEntity,
  restoreArchivedOperationalEntity,
} from "./commands";
import { fetchOperationalDeletionPreview } from "./queries";
import { revalidateLifecycleScope } from "./revalidation";
import {
  ArchiveOperationalEntitySchema,
  DeletionPreviewSchema,
  normalizeArchiveInput,
  PermanentDeletionSchema,
  RestoreOperationalEntitySchema,
} from "./schemas";
import type {
  OperationalDeletionPreviewDto,
  OperationalLifecycleActionResult,
  OperationalLifecycleMutationOutcome,
} from "./types";

export async function archiveOperationalEntityAction(
  rawInput: unknown,
): Promise<
  OperationalLifecycleActionResult<OperationalLifecycleMutationOutcome>
> {
  const cookieStore = await cookies();
  let session;
  try {
    session = await requireSession(cookieStore);
  } catch (err) {
    if (err instanceof AuthError) {
      return { ok: false, error: { code: "UNAUTHORIZED" } };
    }
    throw err;
  }

  if (session.role !== "admin" && session.role !== "pm") {
    return { ok: false, error: { code: "UNAUTHORIZED" } };
  }

  const parseResult = ArchiveOperationalEntitySchema.safeParse(
    normalizeArchiveInput(rawInput),
  );
  if (!parseResult.success) {
    return { ok: false, error: { code: "VALIDATION_FAILED" } };
  }

  const supabase = createClient(cookieStore);
  const result = await archiveOperationalEntity(supabase, parseResult.data);

  if (result.ok && result.data.code === "archived") {
    revalidateLifecycleScope(parseResult.data.entityType, "archived");
  }

  return result;
}

export async function restoreArchivedOperationalEntityAction(
  rawInput: unknown,
): Promise<
  OperationalLifecycleActionResult<OperationalLifecycleMutationOutcome>
> {
  const cookieStore = await cookies();
  let session;
  try {
    session = await requireSession(cookieStore);
  } catch (err) {
    if (err instanceof AuthError) {
      return { ok: false, error: { code: "UNAUTHORIZED" } };
    }
    throw err;
  }

  if (session.role !== "admin" && session.role !== "pm") {
    return { ok: false, error: { code: "UNAUTHORIZED" } };
  }

  const parseResult = RestoreOperationalEntitySchema.safeParse(rawInput);
  if (!parseResult.success) {
    return { ok: false, error: { code: "VALIDATION_FAILED" } };
  }

  const supabase = createClient(cookieStore);
  const result = await restoreArchivedOperationalEntity(
    supabase,
    parseResult.data,
  );

  if (result.ok && result.data.code === "restored") {
    revalidateLifecycleScope(parseResult.data.entityType, "restored");
  }

  return result;
}

export async function getOperationalDeletionPreviewAction(
  rawInput: unknown,
): Promise<OperationalLifecycleActionResult<OperationalDeletionPreviewDto>> {
  const cookieStore = await cookies();
  let session;
  try {
    session = await requireSession(cookieStore);
  } catch (err) {
    if (err instanceof AuthError) {
      return { ok: false, error: { code: "UNAUTHORIZED" } };
    }
    throw err;
  }

  if (session.role !== "admin") {
    return { ok: false, error: { code: "UNAUTHORIZED" } };
  }

  const parseResult = DeletionPreviewSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return { ok: false, error: { code: "VALIDATION_FAILED" } };
  }

  const supabase = createClient(cookieStore);
  const preview = await fetchOperationalDeletionPreview(
    supabase,
    parseResult.data,
  );

  if (preview.status === "unavailable") {
    return { ok: false, error: { code: "UNAVAILABLE" } };
  }

  return { ok: true, data: preview.data };
}

export async function permanentlyDeleteOperationalEntityAction(
  rawInput: unknown,
): Promise<
  OperationalLifecycleActionResult<OperationalLifecycleMutationOutcome>
> {
  const cookieStore = await cookies();
  let session;
  try {
    session = await requireSession(cookieStore);
  } catch (err) {
    if (err instanceof AuthError) {
      return { ok: false, error: { code: "UNAUTHORIZED" } };
    }
    throw err;
  }

  if (session.role !== "admin") {
    return { ok: false, error: { code: "UNAUTHORIZED" } };
  }

  const parseResult = PermanentDeletionSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return { ok: false, error: { code: "VALIDATION_FAILED" } };
  }

  const supabase = createClient(cookieStore);
  const result = await permanentlyDeleteOperationalEntity(
    supabase,
    parseResult.data,
  );

  if (result.ok && result.data.code === "permanently_deleted") {
    revalidateLifecycleScope(
      parseResult.data.entityType,
      "permanently_deleted",
    );
  }

  return result;
}
