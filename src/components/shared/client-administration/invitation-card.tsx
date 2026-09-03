"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type {
  OrdinaryInvitationListItemDto,
  OrdinaryInvitationRole,
  OrdinaryInvitationStatus,
} from "@/lib/invitations/types";
import {
  RotateCw,
  Ban,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FolderKanban,
  Calendar,
} from "lucide-react";

interface InvitationCardProps {
  item: OrdinaryInvitationListItemDto;
  onOpenRotate: (item: OrdinaryInvitationListItemDto) => void;
  onOpenRevoke: (item: OrdinaryInvitationListItemDto) => void;
  formattedCreatedAt: string;
  formattedExpiresAt: string;
  formattedResolvedAt: string | null;
  t: (key: string) => string;
}

export function InvitationCard({
  item,
  onOpenRotate,
  onOpenRevoke,
  formattedCreatedAt,
  formattedExpiresAt,
  formattedResolvedAt,
  t,
}: InvitationCardProps) {
  const isPending = item.status === "pending";

  const renderRoleBadge = (role: OrdinaryInvitationRole) => {
    return (
      <Badge
        variant="secondary"
        className={
          role === "client"
            ? "font-normal text-[11px] bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20"
            : "font-normal text-[11px] bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20"
        }
      >
        {t(`roles.${role}`)}
      </Badge>
    );
  };

  const renderStatusBadge = (status: OrdinaryInvitationStatus) => {
    switch (status) {
      case "pending":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-normal text-[11px]"
          >
            <Clock className="h-3 w-3" />
            <span>{t("statuses.pending")}</span>
          </Badge>
        );
      case "accepted":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-normal text-[11px]"
          >
            <CheckCircle2 className="h-3 w-3" />
            <span>{t("statuses.accepted")}</span>
          </Badge>
        );
      case "expired":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-border text-muted-foreground font-normal text-[11px]"
          >
            <AlertTriangle className="h-3 w-3" />
            <span>{t("statuses.expired")}</span>
          </Badge>
        );
      case "revoked":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-destructive/30 bg-destructive/10 text-destructive font-normal text-[11px]"
          >
            <XCircle className="h-3 w-3" />
            <span>{t("statuses.revoked")}</span>
          </Badge>
        );
    }
  };

  return (
    <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-3 transition-colors">
      {/* Top row: Badges and Actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {renderRoleBadge(item.role)}
          {renderStatusBadge(item.status)}
        </div>

        {isPending ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs gap-1.5 font-normal"
              onClick={() => onOpenRotate(item)}
              aria-label={`${t("actions.rotate")} ${item.recipientLabel}`}
            >
              <RotateCw className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{t("actions.rotate")}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 text-destructive/80 hover:text-destructive hover:bg-destructive/10 border-destructive/20"
              onClick={() => onOpenRevoke(item)}
              aria-label={`${t("actions.revoke")} ${item.recipientLabel}`}
            >
              <Ban className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground italic">
            {t("terminalState")}
          </span>
        )}
      </div>

      {/* Recipient & Project */}
      <div className="space-y-1">
        <h4 className="font-semibold text-sm text-foreground break-all">
          {item.recipientLabel}
        </h4>
        {item.projectName && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FolderKanban className="h-3.5 w-3.5 shrink-0 text-primary/70" />
            <span className="truncate">{item.projectName}</span>
          </div>
        )}
      </div>

      {/* Timestamps */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3 w-3 shrink-0" />
          <span>
            {t("columns.createdAt")}: {formattedCreatedAt}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3 shrink-0" />
          <span>
            {t("columns.expiresAt")}: {formattedExpiresAt}
          </span>
        </div>
        {formattedResolvedAt && (
          <div className="flex items-center gap-1.5 col-span-full">
            <CheckCircle2 className="h-3 w-3 shrink-0" />
            <span>
              {t("columns.resolvedAt")}: {formattedResolvedAt}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
