import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { mapSupabaseError, type CommandResult } from "./errors";
import type {
  CreateDeliverableInput,
  UpdateDeliverableInput,
  SubmitDeliverableVersionInput,
  ReviewDeliverableInput,
  ReportBrokenLinkInput,
} from "./schemas";
import type { Deliverable } from "./queries";

type TypedSupabase = SupabaseClient<Database>;

export type SubmitVersionResult = {
  deliverable_id: string;
  version_id: string;
  version_number: number;
};

export type ReviewDeliverableResult = {
  deliverable_id: string;
  feedback_id: string;
  decision: string;
};

export type DeliverResult = {
  deliverable_id: string;
  status: string;
};

export type BrokenLinkResult = {
  link_report_id: string;
  status: string;
};

export async function createDeliverable(
  supabase: TypedSupabase,
  input: CreateDeliverableInput,
  actorId: string,
): Promise<CommandResult<Deliverable>> {
  try {
    const { data, error } = await supabase
      .from("deliverables")
      .insert({
        project_id: input.project_id,
        task_id: input.task_id,
        assignee_id: input.assignee_id,
        title: input.title,
        specifications: input.specifications,
        workflow_type: "production",
        submission_deadline_at: input.submission_deadline_at ?? null,
        internal_review_deadline_at: input.internal_review_deadline_at ?? null,
        client_delivery_deadline_at: input.client_delivery_deadline_at ?? null,
        created_by: actorId,
      })
      .select("*")
      .single();

    if (error || !data) return { ok: false, error: mapSupabaseError(error) };
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: mapSupabaseError(err as { message?: string }) };
  }
}

export async function updateDeliverable(
  supabase: TypedSupabase,
  deliverableId: string,
  input: UpdateDeliverableInput,
  actorId: string,
): Promise<CommandResult<Deliverable>> {
  try {
    const payload: Partial<
      Database["public"]["Tables"]["deliverables"]["Update"]
    > = {
      updated_by: actorId,
    };
    if (input.title !== undefined) payload.title = input.title;
    if (input.specifications !== undefined)
      payload.specifications = input.specifications;
    if (input.assignee_id !== undefined)
      payload.assignee_id = input.assignee_id;
    if (input.submission_deadline_at !== undefined)
      payload.submission_deadline_at = input.submission_deadline_at;
    if (input.internal_review_deadline_at !== undefined)
      payload.internal_review_deadline_at = input.internal_review_deadline_at;
    if (input.client_delivery_deadline_at !== undefined)
      payload.client_delivery_deadline_at = input.client_delivery_deadline_at;

    const { data, error } = await supabase
      .from("deliverables")
      .update(payload)
      .eq("id", deliverableId)
      .is("deleted_at", null)
      .select("*")
      .single();

    if (error || !data) return { ok: false, error: mapSupabaseError(error) };
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: mapSupabaseError(err as { message?: string }) };
  }
}

export async function submitDeliverableVersion(
  supabase: TypedSupabase,
  input: SubmitDeliverableVersionInput,
): Promise<CommandResult<SubmitVersionResult>> {
  try {
    const { data, error } = await supabase.rpc("submit_deliverable_version", {
      p_deliverable_id: input.deliverable_id,
      p_submission_url: input.submission_url,
      p_submission_note: input.submission_note ?? undefined,
    });

    if (error) return { ok: false, error: mapSupabaseError(error) };
    return { ok: true, data: data as unknown as SubmitVersionResult };
  } catch (err) {
    return { ok: false, error: mapSupabaseError(err as { message?: string }) };
  }
}

export async function reviewDeliverable(
  supabase: TypedSupabase,
  input: ReviewDeliverableInput,
): Promise<CommandResult<ReviewDeliverableResult>> {
  try {
    const { data, error } = await supabase.rpc("review_deliverable", {
      p_deliverable_id: input.deliverable_id,
      p_stage: input.stage,
      p_decision: input.decision,
      p_comments: input.comments ?? undefined,
    });

    if (error) return { ok: false, error: mapSupabaseError(error) };
    return { ok: true, data: data as unknown as ReviewDeliverableResult };
  } catch (err) {
    return { ok: false, error: mapSupabaseError(err as { message?: string }) };
  }
}

export async function markDeliverableDelivered(
  supabase: TypedSupabase,
  deliverableId: string,
): Promise<CommandResult<DeliverResult>> {
  try {
    const { data, error } = await supabase.rpc("mark_deliverable_delivered", {
      p_deliverable_id: deliverableId,
    });

    if (error) return { ok: false, error: mapSupabaseError(error) };
    return { ok: true, data: data as unknown as DeliverResult };
  } catch (err) {
    return { ok: false, error: mapSupabaseError(err as { message?: string }) };
  }
}

export async function archiveDeliverable(
  supabase: TypedSupabase,
  deliverableId: string,
  reason?: string,
): Promise<CommandResult<{ success: boolean }>> {
  try {
    const { data, error } = await supabase.rpc("soft_delete_entity", {
      p_entity_id: deliverableId,
      p_entity_type: "deliverable",
      p_reason: reason,
    });

    if (error) return { ok: false, error: mapSupabaseError(error) };
    return { ok: true, data: { success: Boolean(data) } };
  } catch (err) {
    return { ok: false, error: mapSupabaseError(err as { message?: string }) };
  }
}

export async function reportBrokenLink(
  supabase: TypedSupabase,
  input: ReportBrokenLinkInput,
): Promise<CommandResult<BrokenLinkResult>> {
  try {
    const { data, error } = await supabase.rpc("report_broken_link", {
      p_deliverable_id: input.deliverable_id,
      p_version_id: input.version_id,
      p_reason: input.reason,
    });

    if (error) return { ok: false, error: mapSupabaseError(error) };
    return { ok: true, data: data as unknown as BrokenLinkResult };
  } catch (err) {
    return { ok: false, error: mapSupabaseError(err as { message?: string }) };
  }
}
