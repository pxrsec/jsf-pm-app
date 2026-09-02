"use client";

import { useState, useTransition, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import {
  AlertCircle,
  RefreshCw,
  UserX,
  UserCheck,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserDeactivationDialog } from "./user-deactivation-dialog";
import { UserReactivationDialog } from "./user-reactivation-dialog";
import { loadMoreUserAccessDirectoryAction } from "@/lib/account-access/actions";
import type {
  AvailableResult,
  UserAccessDirectoryPageDto,
  UserAccessDirectoryItemDto,
  UserAccessDirectoryCursor,
  DateTimePresentationContext,
} from "@/lib/account-access/types";

export interface UserAccessDirectoryPanelProps {
  initialResult: AvailableResult<UserAccessDirectoryPageDto>;
  presentation: DateTimePresentationContext;
}

function formatDate(
  isoString: string | null,
  presentation: DateTimePresentationContext,
  fallback: string,
): string {
  if (!isoString) return fallback;
  try {
    return new Intl.DateTimeFormat(presentation.locale, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: presentation.timeZone || "UTC",
    }).format(new Date(isoString));
  } catch {
    return fallback;
  }
}

export function UserAccessDirectoryPanel({
  initialResult,
  presentation,
}: UserAccessDirectoryPanelProps) {
  const t = useTranslations("accountAccess");
  const router = useRouter();

  const [items, setItems] = useState<readonly UserAccessDirectoryItemDto[]>(
    initialResult.status === "available" ? initialResult.data.items : [],
  );
  const [nextCursor, setNextCursor] =
    useState<UserAccessDirectoryCursor | null>(
      initialResult.status === "available"
        ? initialResult.data.nextCursor
        : null,
    );
  const [hasMore, setHasMore] = useState<boolean>(
    initialResult.status === "available" ? initialResult.data.hasMore : false,
  );

  const [isLoadingMore, startLoadMoreTransition] = useTransition();
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  // Dialog state
  const [deactivatingUser, setDeactivatingUser] = useState<{
    userId: string;
    fullName: string;
  } | null>(null);
  const [reactivatingUser, setReactivatingUser] = useState<{
    userId: string;
    fullName: string;
  } | null>(null);

  const activeTriggerRef = useRef<HTMLButtonElement | null>(null);

  if (initialResult.status === "unavailable") {
    return (
      <div
        className="rounded-lg border border-destructive/20 bg-destructive/5 p-6 max-w-xl space-y-4"
        role="alert"
        data-testid="directory-unavailable"
      >
        <div className="flex items-center gap-2 text-destructive font-medium">
          <AlertCircle className="size-5" />
          <span>{t("directory.unavailableTitle")}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("directory.unavailableDescription")}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.refresh()}
          className="min-h-[44px] gap-2"
        >
          <RefreshCw className="size-4" />
          <span>{t("directory.retryButton")}</span>
        </Button>
      </div>
    );
  }

  const handleLoadMore = () => {
    if (!nextCursor || isLoadingMore) return;
    setLoadMoreError(null);

    startLoadMoreTransition(async () => {
      const result = await loadMoreUserAccessDirectoryAction(nextCursor);
      if (result.ok) {
        setItems((curr) => [...curr, ...result.data.items]);
        setNextCursor(result.data.nextCursor);
        setHasMore(result.data.hasMore);
      } else {
        setLoadMoreError(t("directory.loadMoreError"));
      }
    });
  };

  if (items.length === 0) {
    return (
      <div
        className="rounded-lg border border-dashed p-8 text-center space-y-2"
        data-testid="directory-empty"
      >
        <p className="font-medium text-foreground">
          {t("directory.emptyTitle")}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("directory.emptyDescription")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="user-access-directory-panel">
      {/* Mobile Card Layout (< md) */}
      <div className="grid gap-4 md:hidden">
        {items.map((item) => {
          const formattedAuth = formatDate(
            item.lastSuccessfulAuthAt,
            presentation,
            t("directory.lastAuthNever"),
          );
          const formattedActionAt = formatDate(
            item.lastAccessActionAt,
            presentation,
            t("directory.lastActionNever"),
          );

          return (
            <div
              key={item.userId}
              className="rounded-lg border p-4 space-y-3 bg-card text-card-foreground shadow-xs"
              data-testid={`directory-item-${item.userId}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium text-base leading-tight">
                    {item.fullName}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {t(`roles.${item.applicationRole}`)}
                    </Badge>
                    <Badge
                      variant={item.isActive ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {item.isActive
                        ? t("directory.statusActive")
                        : t("directory.statusInactive")}
                    </Badge>
                  </div>
                </div>

                {/* Mobile Action Button */}
                {item.isActive ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-[44px] text-destructive hover:text-destructive"
                    onClick={(e) => {
                      activeTriggerRef.current = e.currentTarget;
                      setDeactivatingUser({
                        userId: item.userId,
                        fullName: item.fullName,
                      });
                    }}
                    aria-label={t("directory.actions.deactivateAria", {
                      name: item.fullName,
                    })}
                  >
                    <UserX className="size-4 mr-1" />
                    <span>{t("directory.actions.deactivate")}</span>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-[44px]"
                    onClick={(e) => {
                      activeTriggerRef.current = e.currentTarget;
                      setReactivatingUser({
                        userId: item.userId,
                        fullName: item.fullName,
                      });
                    }}
                    aria-label={t("directory.actions.reactivateAria", {
                      name: item.fullName,
                    })}
                  >
                    <UserCheck className="size-4 mr-1" />
                    <span>{t("directory.actions.reactivate")}</span>
                  </Button>
                )}
              </div>

              {/* Counts */}
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1 border-t border-border/50">
                <div>
                  <span className="font-medium text-foreground">
                    {item.activeProjectMembershipCount}
                  </span>{" "}
                  {t("directory.columns.memberships")}
                </div>
                <div>
                  <span className="font-medium text-foreground">
                    {item.activeTaskAssignmentCount}
                  </span>{" "}
                  {t("directory.columns.tasks")}
                </div>
                <div>
                  <span className="font-medium text-foreground">
                    {item.activeDeliverableAssignmentCount}
                  </span>{" "}
                  {t("directory.columns.deliverables")}
                </div>
                <div>
                  <span className="font-medium text-foreground">
                    {item.pendingInvitationCount}
                  </span>{" "}
                  {t("directory.columns.invitations")}
                </div>
              </div>

              {/* Timestamps */}
              <div className="text-xs text-muted-foreground space-y-0.5 pt-1 border-t border-border/50">
                <p>
                  <span className="font-medium text-foreground">
                    {t("directory.lastSuccessfulAuthAtLabel")}:
                  </span>{" "}
                  {formattedAuth}
                </p>
                {item.lastAccessAction && (
                  <p>
                    <span className="font-medium text-foreground">
                      {t("directory.lastAccessActionAtLabel")}:
                    </span>{" "}
                    {t(`actionTypes.${item.lastAccessAction}`)} (
                    {formattedActionAt})
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Table Layout (>= md) */}
      <div className="hidden md:block rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase border-b">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t("directory.columns.fullName")}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t("directory.columns.role")}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t("directory.columns.status")}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t("directory.columns.lastAuth")}
                </th>
                <th scope="col" className="px-3 py-3 font-medium text-center">
                  {t("directory.columns.memberships")}
                </th>
                <th scope="col" className="px-3 py-3 font-medium text-center">
                  {t("directory.columns.tasks")}
                </th>
                <th scope="col" className="px-3 py-3 font-medium text-center">
                  {t("directory.columns.deliverables")}
                </th>
                <th scope="col" className="px-3 py-3 font-medium text-center">
                  {t("directory.columns.invitations")}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t("directory.columns.lastAction")}
                </th>
                <th scope="col" className="px-4 py-3 font-medium text-right">
                  {t("directory.columns.actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item) => {
                const formattedAuth = formatDate(
                  item.lastSuccessfulAuthAt,
                  presentation,
                  t("directory.lastAuthNever"),
                );
                const formattedActionAt = formatDate(
                  item.lastAccessActionAt,
                  presentation,
                  t("directory.lastActionNever"),
                );

                return (
                  <tr
                    key={item.userId}
                    className="hover:bg-muted/30 transition-colors"
                    data-testid={`directory-row-${item.userId}`}
                  >
                    <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                      {item.fullName}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge variant="outline" className="text-xs">
                        {t(`roles.${item.applicationRole}`)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge
                        variant={item.isActive ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {item.isActive
                          ? t("directory.statusActive")
                          : t("directory.statusInactive")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                      {formattedAuth}
                    </td>
                    <td className="px-3 py-3 text-center text-xs">
                      {item.activeProjectMembershipCount}
                    </td>
                    <td className="px-3 py-3 text-center text-xs">
                      {item.activeTaskAssignmentCount}
                    </td>
                    <td className="px-3 py-3 text-center text-xs">
                      {item.activeDeliverableAssignmentCount}
                    </td>
                    <td className="px-3 py-3 text-center text-xs">
                      {item.pendingInvitationCount}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                      {item.lastAccessAction
                        ? `${t(`actionTypes.${item.lastAccessAction}`)} (${formattedActionAt})`
                        : t("directory.lastActionNever")}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {item.isActive ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="min-h-[44px] text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            activeTriggerRef.current = e.currentTarget;
                            setDeactivatingUser({
                              userId: item.userId,
                              fullName: item.fullName,
                            });
                          }}
                          aria-label={t("directory.actions.deactivateAria", {
                            name: item.fullName,
                          })}
                        >
                          <UserX className="size-4 mr-1" />
                          <span>{t("directory.actions.deactivate")}</span>
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="min-h-[44px]"
                          onClick={(e) => {
                            activeTriggerRef.current = e.currentTarget;
                            setReactivatingUser({
                              userId: item.userId,
                              fullName: item.fullName,
                            });
                          }}
                          aria-label={t("directory.actions.reactivateAria", {
                            name: item.fullName,
                          })}
                        >
                          <UserCheck className="size-4 mr-1" />
                          <span>{t("directory.actions.reactivate")}</span>
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Continuation Error Feedback */}
      {loadMoreError && (
        <div
          role="alert"
          className="rounded-md bg-destructive/15 p-3 text-sm text-destructive"
        >
          {loadMoreError}
        </div>
      )}

      {/* Keyset Pagination: Load More Button */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="min-h-[44px] min-w-32"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                <span>{t("directory.loadingMore")}</span>
              </>
            ) : (
              <span>{t("directory.loadMoreButton")}</span>
            )}
          </Button>
        </div>
      )}

      {/* Deactivation Dialog */}
      <UserDeactivationDialog
        open={deactivatingUser !== null}
        onOpenChange={(open) => {
          if (!open) setDeactivatingUser(null);
        }}
        targetUser={deactivatingUser}
        triggerRef={activeTriggerRef}
      />

      {/* Reactivation Dialog */}
      <UserReactivationDialog
        open={reactivatingUser !== null}
        onOpenChange={(open) => {
          if (!open) setReactivatingUser(null);
        }}
        targetUser={reactivatingUser}
        triggerRef={activeTriggerRef}
      />
    </div>
  );
}
