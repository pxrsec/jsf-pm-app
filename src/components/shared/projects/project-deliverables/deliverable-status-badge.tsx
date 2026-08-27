"use client";

import { useTranslations } from "next-intl";
import {
  DELIVERABLE_STATUS_MAP,
  type DeliverableStatus,
} from "@/lib/status-maps";
import { cn } from "@/lib/utils";

interface DeliverableStatusBadgeProps {
  status: DeliverableStatus;
  className?: string;
  showIcon?: boolean;
}

export const DELIVERABLE_STATUS_TRANSLATION_KEYS: Record<
  DeliverableStatus,
  | "pending"
  | "awaitingInternalReview"
  | "awaitingClientReview"
  | "approved"
  | "changesRequested"
  | "delivered"
  | "submitted"
> = {
  pending: "pending",
  awaiting_internal_review: "awaitingInternalReview",
  awaiting_client_review: "awaitingClientReview",
  approved: "approved",
  changes_requested: "changesRequested",
  delivered: "delivered",
  submitted: "submitted",
};

export function DeliverableStatusBadge({
  status,
  className,
  showIcon = true,
}: DeliverableStatusBadgeProps) {
  const t = useTranslations("projects.workspace.deliverables.status");
  const config = DELIVERABLE_STATUS_MAP[status];

  if (!config) return null;

  const Icon = config.icon;
  const translationKey =
    DELIVERABLE_STATUS_TRANSLATION_KEYS[status] ?? "pending";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0",
        config.badgeBg,
        config.badgeFg,
        className,
      )}
      role="status"
    >
      {showIcon && <Icon className="size-3.5 shrink-0" aria-hidden="true" />}
      <span>{t(translationKey)}</span>
    </span>
  );
}
