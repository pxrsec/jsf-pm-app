"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { MessageSquare, Send, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MEMBER_CAPACITY_MAP, type MemberCapacity } from "@/lib/status-maps";
import {
  listDeliverableCommentsAction,
  createDeliverableCommentAction,
} from "@/lib/deliverables/comment-actions";
import type { CollaborationCommentWithAuthor } from "@/lib/comments/queries";

interface DeliverableCommentsSectionProps {
  projectId: string;
  deliverableId: string;
}

export function DeliverableCommentsSection({
  projectId,
  deliverableId,
}: DeliverableCommentsSectionProps) {
  const t = useTranslations("projects.workspace.deliverables.comments");
  const tMembers = useTranslations("projects.members.capacities");
  const format = useFormatter();

  const [comments, setComments] = useState<CollaborationCommentWithAuthor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchComments = useCallback(async () => {
    try {
      const data = await listDeliverableCommentsAction(deliverableId);
      setComments(data);
    } catch {
      // safe fallback
    } finally {
      setIsLoading(false);
    }
  }, [deliverableId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    const result = await createDeliverableCommentAction({
      projectId,
      deliverableId,
      body: body.trim(),
    });

    setIsSubmitting(false);

    if (result.ok) {
      setBody("");
      fetchComments();
    } else {
      setError(result.error.message);
    }
  };

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <MessageSquare className="size-4 text-primary" />
          <span>{t("title")}</span>
          <span className="text-muted-foreground font-normal">
            ({comments.length})
          </span>
        </div>
      </div>

      {/* Advisory Notice */}
      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-2.5 text-[11px] text-muted-foreground">
        <Info className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
        <p>{t("advisoryNotice")}</p>
      </div>

      {/* Comments List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-3 text-center">
          {t("emptyState")}
        </p>
      ) : (
        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
          {comments.map((c) => {
            const authorName = c.author?.full_name || "Miembro";
            const authorInitials = authorName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();

            const capacityConfig =
              MEMBER_CAPACITY_MAP[
                c.author_capacity_snapshot as MemberCapacity
              ];
            const CapacityIcon = capacityConfig?.icon;
            const capacityKey =
              c.author_capacity_snapshot === "pm_lead"
                ? "pmLead"
                : c.author_capacity_snapshot === "pm_watcher"
                  ? "pmWatcher"
                  : c.author_capacity_snapshot === "operator"
                    ? "operator"
                    : "client";

            const formattedDate = format.dateTime(new Date(c.created_at), {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div
                key={c.id}
                className="rounded-lg border border-border/70 bg-card p-3 space-y-1.5 text-xs shadow-2xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[9px] shrink-0">
                      {authorInitials}
                    </div>
                    <span className="font-medium text-foreground">
                      {authorName}
                    </span>
                    {capacityConfig && (
                      <Badge
                        variant="secondary"
                        className="text-[9px] px-1.5 py-0 h-4 font-normal gap-1 text-muted-foreground"
                      >
                        {CapacityIcon && (
                          <CapacityIcon className="size-2.5" />
                        )}
                        <span>{tMembers(capacityKey as "pmLead")}</span>
                      </Badge>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {formattedDate}
                  </span>
                </div>
                <p className="text-foreground/90 whitespace-pre-wrap pl-7">
                  {c.body}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Composer */}
      <form onSubmit={handleSubmit} className="space-y-2 pt-1">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("composePlaceholder")}
          rows={2}
          maxLength={2000}
          className="text-xs resize-none"
        />

        {error && <p className="text-[11px] text-destructive">{error}</p>}

        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            disabled={!body.trim() || isSubmitting}
            className="h-7 text-xs gap-1.5 px-3"
          >
            {isSubmitting ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Send className="size-3" />
            )}
            <span>{t("submitAction")}</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
