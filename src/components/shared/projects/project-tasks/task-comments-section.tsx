"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { formatDistanceToNow } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { toast } from "sonner";
import { Loader2, MessageSquare, Send, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MEMBER_CAPACITY_MAP, type MemberCapacity } from "@/lib/status-maps";
import {
  createTaskCommentAction,
  listTaskCommentsAction,
} from "@/lib/projects/task-actions";
import type { CollaborationCommentWithAuthor } from "@/lib/comments/queries";

interface TaskCommentsSectionProps {
  projectId: string;
  taskId: string;
  effectiveCapacity?: "admin" | "pm_lead" | "pm_watcher";
}

const CAPACITY_TRANSLATION_KEYS: Record<
  string,
  "admin" | "pmLead" | "pmWatcher" | "operator" | "client"
> = {
  admin: "admin",
  pm_lead: "pmLead",
  pm_watcher: "pmWatcher",
  operator: "operator",
  client: "client",
};

export function TaskCommentsSection({
  projectId,
  taskId,
}: TaskCommentsSectionProps) {
  const t = useTranslations("projects.tasks.comments");
  const locale = useLocale();
  const dateLocale = locale === "es" ? es : enUS;

  const [comments, setComments] = useState<CollaborationCommentWithAuthor[]>([]);
  const [body, setBody] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const refreshComments = useCallback(async () => {
    try {
      const data = await listTaskCommentsAction(taskId);
      setComments(data);
    } catch {
      // Graceful fallback
    }
  }, [taskId]);

  useEffect(() => {
    let isMounted = true;
    listTaskCommentsAction(taskId)
      .then((data) => {
        if (isMounted) {
          setComments(data);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setComments([]);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [taskId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;

    setIsSubmitting(true);
    try {
      const result = await createTaskCommentAction(
        projectId,
        taskId,
        body.trim(),
      );

      if (!result.ok) {
        toast.error(result.error.message || t("errorToast"));
      } else {
        toast.success(t("successToast"));
        setBody("");
        refreshComments();
      }
    } catch {
      toast.error(t("errorToast"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
          <MessageSquare className="size-4" />
          <span>
            {t("sectionTitle")} ({comments.length})
          </span>
        </h3>
      </div>

      {/* Advisory Note */}
      <p className="text-xs text-muted-foreground bg-muted/50 p-2.5 rounded-md border border-border/50">
        {t("advisoryNote")}
      </p>

      {/* Comment Feed */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin mr-2" />
            <span>{t("loading")}</span>
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-6 px-4 bg-muted/20 rounded-md border border-dashed border-border/60">
            <p className="text-xs text-muted-foreground">{t("emptyState")}</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
            {comments.map((comment) => {
              const capacity = comment.author_capacity_snapshot as MemberCapacity;
              const capacityConfig = MEMBER_CAPACITY_MAP[capacity];
              const CapacityIcon = capacityConfig?.icon ?? User;
              const capTransKey =
                CAPACITY_TRANSLATION_KEYS[comment.author_capacity_snapshot] ??
                "pmLead";

              let timeAgo = "";
              try {
                timeAgo = formatDistanceToNow(new Date(comment.created_at), {
                  addSuffix: true,
                  locale: dateLocale,
                });
              } catch {
                timeAgo = comment.created_at;
              }

              return (
                <div
                  key={comment.id}
                  className="p-3 bg-muted/40 rounded-lg border border-border/60 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-semibold text-primary">
                        {comment.author?.full_name?.charAt(0) ?? (
                          <User className="size-3" />
                        )}
                      </div>
                      <span className="font-semibold text-foreground truncate">
                        {comment.author?.full_name ?? "Usuario"}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                        <CapacityIcon className="size-2.5" />
                        {t(`authorCapacity.${capTransKey}`)}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {timeAgo}
                    </span>
                  </div>
                  <p className="text-xs text-foreground whitespace-pre-wrap pl-8">
                    {comment.body}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Compose Form */}
      <form onSubmit={handleSubmit} className="space-y-2 pt-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("composePlaceholder")}
          rows={2}
          maxLength={5000}
          disabled={isSubmitting}
          className="text-xs resize-none"
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            disabled={!body.trim() || isSubmitting}
            className="text-xs h-8 gap-1.5"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-3 animate-spin" />
                {t("submitting")}
              </>
            ) : (
              <>
                <Send className="size-3" />
                {t("submitAction")}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
