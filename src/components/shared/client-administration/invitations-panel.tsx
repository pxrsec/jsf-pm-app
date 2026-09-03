"use client";

import { useState, useTransition } from "react";
import { useTranslations, useFormatter, useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InvitationCreateDialog } from "./invitation-create-dialog";
import { InvitationCopyDialog } from "./invitation-copy-dialog";
import { InvitationConfirmDialog } from "./invitation-confirm-dialog";
import { InvitationCard } from "./invitation-card";
import {
  loadOrdinaryInvitationPageAction,
  rotateOrdinaryInvitationAction,
  revokeOrdinaryInvitationAction,
} from "@/lib/invitations/actions";
import type {
  OrdinaryInvitationCursor,
  OrdinaryInvitationListItemDto,
  OrdinaryInvitationRole,
  OrdinaryInvitationStatus,
  InvitationLinkLocale,
} from "@/lib/invitations/types";
import type {
  ClientContactAdministrationDto,
  ClientManagementProjectDto,
} from "@/lib/clients/types";
import {
  Plus,
  RotateCw,
  Ban,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Mail,
} from "lucide-react";
import { toast } from "sonner";

interface InvitationsPanelProps {
  initialItems: OrdinaryInvitationListItemDto[];
  initialNextCursor: OrdinaryInvitationCursor | null;
  contacts: ClientContactAdministrationDto[];
  projects: ClientManagementProjectDto[];
  onRefresh: () => void;
}

export function InvitationsPanel({
  initialItems,
  initialNextCursor,
  contacts,
  projects,
  onRefresh,
}: InvitationsPanelProps) {
  const t = useTranslations("clientAdministration.invitationsPanel");
  const format = useFormatter();
  const locale = useLocale() as InvitationLinkLocale;
  const [, startTransition] = useTransition();

  const [items, setItems] =
    useState<OrdinaryInvitationListItemDto[]>(initialItems);
  const [nextCursor, setNextCursor] = useState<OrdinaryInvitationCursor | null>(
    initialNextCursor,
  );
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Dialog state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [oneTimeUrl, setOneTimeUrl] = useState<string | null>(null);
  const [isCopyOpen, setIsCopyOpen] = useState(false);

  // Confirmation dialog state
  const [confirmTarget, setConfirmTarget] =
    useState<OrdinaryInvitationListItemDto | null>(null);
  const [confirmType, setConfirmType] = useState<"rotate" | "revoke">("rotate");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);

  const handleLoadMore = async () => {
    if (!nextCursor || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const result = await loadOrdinaryInvitationPageAction({
        cursor: nextCursor,
        limit: 20,
      });

      if (result.ok) {
        setItems((prev) => [...prev, ...result.data.items]);
        setNextCursor(result.data.nextCursor);
      } else {
        toast.error(t("loadMoreFailed"));
      }
    } catch {
      toast.error(t("loadMoreFailed"));
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleCreateSuccess = (invitationUrl: string) => {
    setOneTimeUrl(invitationUrl);
    setIsCopyOpen(true);
  };

  const handleOpenRotate = (item: OrdinaryInvitationListItemDto) => {
    setConfirmTarget(item);
    setConfirmType("rotate");
    setIsConfirmOpen(true);
  };

  const handleOpenRevoke = (item: OrdinaryInvitationListItemDto) => {
    setConfirmTarget(item);
    setConfirmType("revoke");
    setIsConfirmOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!confirmTarget) return;

    setIsActionSubmitting(true);
    try {
      if (confirmType === "rotate") {
        const result = await rotateOrdinaryInvitationAction(
          { invitationId: confirmTarget.invitationId, expiresInHours: 168 },
          locale === "en-US" ? "en-US" : "es-MX",
        );

        if (result.ok) {
          setIsConfirmOpen(false);
          setConfirmTarget(null);
          setOneTimeUrl(result.data.invitationUrl);
          setIsCopyOpen(true);
        } else {
          toast.error(t("rotateFailed"));
        }
      } else {
        const result = await revokeOrdinaryInvitationAction({
          invitationId: confirmTarget.invitationId,
        });

        if (result.ok) {
          setIsConfirmOpen(false);
          setConfirmTarget(null);
          toast.success(t("revokeSuccess"));
          startTransition(() => {
            onRefresh();
          });
        } else {
          toast.error(t("revokeFailed"));
        }
      }
    } catch {
      toast.error(t("actionFailed"));
    } finally {
      setIsActionSubmitting(false);
    }
  };

  const handleDismissCopy = () => {
    setOneTimeUrl(null);
    setIsCopyOpen(false);
    startTransition(() => {
      onRefresh();
    });
  };

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
    <div className="w-full space-y-6">
      {/* Header with Create Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h3 className="text-base font-semibold text-foreground">
            {t("title")}
          </h3>
          <p className="text-xs text-muted-foreground">{t("description")}</p>
        </div>
        <Button
          onClick={() => setIsCreateOpen(true)}
          size="sm"
          className="gap-1.5 w-full sm:w-auto h-9 font-medium shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>{t("createInvitation")}</span>
        </Button>
      </div>

      {/* Mobile Card List (< sm) */}
      <div className="block sm:hidden space-y-3">
        {items.length === 0 ? (
          <div className="p-8 rounded-xl border border-dashed border-border bg-card/50 text-center space-y-2">
            <Mail className="h-8 w-8 mx-auto text-muted-foreground/60" />
            <p className="text-xs text-muted-foreground">{t("emptyState")}</p>
          </div>
        ) : (
          items.map((item) => {
            const createdDate = new Date(item.createdAt);
            const expiresDate = new Date(item.expiresAt);
            const resolvedDate = item.acceptedAt
              ? new Date(item.acceptedAt)
              : item.revokedAt
                ? new Date(item.revokedAt)
                : null;

            return (
              <InvitationCard
                key={item.invitationId}
                item={item}
                onOpenRotate={handleOpenRotate}
                onOpenRevoke={handleOpenRevoke}
                formattedCreatedAt={format.dateTime(createdDate, {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
                formattedExpiresAt={format.dateTime(expiresDate, {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
                formattedResolvedAt={
                  resolvedDate
                    ? format.dateTime(resolvedDate, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })
                    : null
                }
                t={t}
              />
            );
          })
        )}
      </div>

      {/* Desktop Data Table (>= sm) */}
      <div className="hidden sm:block rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="font-semibold text-xs">
                {t("columns.role")}
              </TableHead>
              <TableHead className="font-semibold text-xs">
                {t("columns.recipient")}
              </TableHead>
              <TableHead className="font-semibold text-xs">
                {t("columns.project")}
              </TableHead>
              <TableHead className="font-semibold text-xs">
                {t("columns.status")}
              </TableHead>
              <TableHead className="font-semibold text-xs">
                {t("columns.createdAt")}
              </TableHead>
              <TableHead className="font-semibold text-xs">
                {t("columns.expiresAt")}
              </TableHead>
              <TableHead className="font-semibold text-xs">
                {t("columns.resolvedAt")}
              </TableHead>
              <TableHead className="w-[120px] text-right font-semibold text-xs">
                {t("columns.actions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-32 text-center text-xs text-muted-foreground"
                >
                  {t("emptyState")}
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const isPending = item.status === "pending";
                const createdDate = new Date(item.createdAt);
                const expiresDate = new Date(item.expiresAt);
                const resolvedDate = item.acceptedAt
                  ? new Date(item.acceptedAt)
                  : item.revokedAt
                    ? new Date(item.revokedAt)
                    : null;

                return (
                  <TableRow
                    key={item.invitationId}
                    className="hover:bg-muted/30"
                  >
                    <TableCell>{renderRoleBadge(item.role)}</TableCell>
                    <TableCell className="font-medium text-xs">
                      {item.recipientLabel}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {item.projectName ?? "—"}
                    </TableCell>
                    <TableCell>{renderStatusBadge(item.status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format.dateTime(createdDate, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format.dateTime(expiresDate, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {resolvedDate
                        ? format.dateTime(resolvedDate, {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {isPending ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => handleOpenRotate(item)}
                            title={t("actions.rotate")}
                            aria-label={`${t("actions.rotate")} ${item.recipientLabel}`}
                          >
                            <RotateCw className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => handleOpenRevoke(item)}
                            title={t("actions.revoke")}
                            aria-label={`${t("actions.revoke")} ${item.recipientLabel}`}
                          >
                            <Ban className="h-3.5 w-3.5 text-destructive/70 hover:text-destructive" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          {t("terminalState")}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {nextCursor && (
        <div className="p-3 border rounded-xl border-border bg-card/60 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="text-xs h-9 w-full sm:w-auto px-6 font-medium"
          >
            {isLoadingMore && (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            )}
            {isLoadingMore ? t("loadingMore") : t("loadMore")}
          </Button>
        </div>
      )}

      <InvitationCreateDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={handleCreateSuccess}
        contacts={contacts}
        projects={projects}
      />

      <InvitationConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => {
          setIsConfirmOpen(false);
          setConfirmTarget(null);
        }}
        onConfirm={handleConfirmAction}
        type={confirmType}
        isSubmitting={isActionSubmitting}
      />

      <InvitationCopyDialog
        isOpen={isCopyOpen}
        onDismiss={handleDismissCopy}
        invitationUrl={oneTimeUrl}
      />
    </div>
  );
}
