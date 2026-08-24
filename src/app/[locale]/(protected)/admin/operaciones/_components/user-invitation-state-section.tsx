"use client";

import { useState, useTransition, useCallback, useRef } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { Button } from "@/components/ui/button";
import { Users, Loader2, ShieldAlert } from "lucide-react";
import type {
  AdminUserInvitationCursor,
  AdminUserInvitationPage,
  AdminUserInvitationStateItem,
} from "@/lib/admin-operations/types";
import { loadAdminUserInvitationStatePageAction } from "@/lib/admin-operations/actions";

interface UserInvitationStateSectionProps {
  initialPage: AdminUserInvitationPage;
}

export function UserInvitationStateSection({
  initialPage,
}: UserInvitationStateSectionProps) {
  const t = useTranslations("adminOperations.userInvitation");
  const roleT = useTranslations("shell.nav.currentUser.role");
  const format = useFormatter();
  const [isPending, startTransition] = useTransition();

  const [items, setItems] = useState<readonly AdminUserInvitationStateItem[]>(
    initialPage.items,
  );
  const [nextCursor, setNextCursor] =
    useState<AdminUserInvitationCursor | null>(initialPage.nextCursor);
  const [hasMore, setHasMore] = useState<boolean>(initialPage.hasMore);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  const handleLoadMore = useCallback(() => {
    if (!nextCursor || isPending) return;
    setErrorMessage(null);

    startTransition(async () => {
      const result = await loadAdminUserInvitationStatePageAction({
        cursor: nextCursor,
      });

      if (!result.ok) {
        setErrorMessage(t("loadMoreError"));
        return;
      }

      setItems((prev) => [...prev, ...result.data.items]);
      setNextCursor(result.data.nextCursor);
      setHasMore(result.data.hasMore);
    });
  }, [isPending, nextCursor, t]);

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" aria-hidden="true" />
          <div>
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              {t("title")}
            </h2>
            <p className="text-xs text-muted-foreground">{t("description")}</p>
          </div>
        </div>

        {/* Boundary Notice Badge */}
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-muted text-muted-foreground border border-border">
          <ShieldAlert
            className="h-3 w-3 text-muted-foreground"
            aria-hidden="true"
          />
          {t("boundaryNotice")}
        </span>
      </div>

      {/* Live Region for Screen Readers & Error Banner */}
      <div
        ref={statusRef}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        className="focus:outline-none"
      >
        {errorMessage && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-2.5 text-xs text-destructive flex items-center justify-between"
          >
            <span>{errorMessage}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleLoadMore}
              className="text-xs min-h-[32px] ml-3"
            >
              {t("retry")}
            </Button>
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <caption className="sr-only">{t("tableCaption")}</caption>
          <thead>
            <tr className="border-b border-border/80 text-muted-foreground font-medium">
              <th scope="col" className="pb-2 pl-1">
                {t("columns.kind")}
              </th>
              <th scope="col" className="pb-2">
                {t("columns.identity")}
              </th>
              <th scope="col" className="pb-2">
                {t("columns.role")}
              </th>
              <th scope="col" className="pb-2">
                {t("columns.status")}
              </th>
              <th scope="col" className="pb-2">
                {t("columns.preferences")}
              </th>
              <th scope="col" className="pb-2 pr-1">
                {t("columns.activity")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {items.map((item, idx) => {
              if (item.kind === "profile") {
                return (
                  <tr
                    key={`profile-${idx}`}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-2.5 pl-1 font-medium">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200">
                        {t("kinds.profile")}
                      </span>
                    </td>
                    <td className="py-2.5 font-semibold text-foreground">
                      {item.fullName}
                    </td>
                    <td className="py-2.5 text-muted-foreground capitalize">
                      {roleT(item.applicationRole)}
                    </td>
                    <td className="py-2.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${
                          item.isActive
                            ? "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-200"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {item.isActive
                          ? t("activeState.active")
                          : t("activeState.inactive")}
                      </span>
                    </td>
                    <td className="py-2.5 text-muted-foreground flex items-center gap-2 mt-1">
                      <span
                        className={`text-[11px] ${
                          item.emailNotificationsEnabled
                            ? "text-foreground"
                            : "text-muted-foreground/60 line-through"
                        }`}
                        title={t("emailPreference")}
                      >
                        Email
                      </span>
                      <span className="text-border">|</span>
                      <span
                        className={`text-[11px] ${
                          item.whatsappOptIn
                            ? "text-foreground"
                            : "text-muted-foreground/60 line-through"
                        }`}
                        title={t("whatsappPreference")}
                      >
                        WhatsApp
                      </span>
                    </td>
                    <td className="py-2.5 pr-1 text-muted-foreground font-mono text-[11px]">
                      {item.lastSeenAt
                        ? format.dateTime(new Date(item.lastSeenAt), {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "numeric",
                          })
                        : "—"}
                    </td>
                  </tr>
                );
              }

              // Invitation row
              return (
                <tr
                  key={`inv-${idx}`}
                  className="hover:bg-muted/30 transition-colors"
                >
                  <td className="py-2.5 pl-1 font-medium">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                      {t("kinds.invitation")}
                    </span>
                  </td>
                  <td className="py-2.5 text-foreground font-medium">
                    {item.projectName
                      ? `${t("project")}: ${item.projectName}`
                      : t("globalInvitation")}
                  </td>
                  <td className="py-2.5 text-muted-foreground capitalize">
                    {roleT(item.applicationRole)}
                  </td>
                  <td className="py-2.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${
                        item.invitationStatus === "accepted"
                          ? "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-200"
                          : item.invitationStatus === "pending"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {t(`invitationStatus.${item.invitationStatus}`)}
                    </span>
                  </td>
                  <td className="py-2.5 text-muted-foreground text-[11px]">
                    —
                  </td>
                  <td className="py-2.5 pr-1 text-muted-foreground font-mono text-[11px]">
                    {item.invitationExpiresAt
                      ? `${t("expires")}: ${format.dateTime(
                          new Date(item.invitationExpiresAt),
                          { month: "short", day: "numeric" },
                        )}`
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List View */}
      <div className="md:hidden space-y-3">
        {items.map((item, idx) => (
          <div
            key={`user-inv-m-${idx}`}
            className="rounded-lg border border-border bg-card p-3.5 space-y-2 text-xs"
          >
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                    item.kind === "profile"
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200"
                  }`}
                >
                  {t(`kinds.${item.kind}`)}
                </span>
                <span className="font-semibold text-foreground">
                  {item.kind === "profile"
                    ? item.fullName
                    : (item.projectName ?? t("globalInvitation"))}
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground capitalize">
                {roleT(item.applicationRole)}
              </span>
            </div>

            {item.kind === "profile" ? (
              <div className="grid grid-cols-2 gap-1.5 text-muted-foreground text-[11px]">
                <div>
                  <span className="font-medium text-foreground">
                    {t("columns.status")}:
                  </span>{" "}
                  {item.isActive
                    ? t("activeState.active")
                    : t("activeState.inactive")}
                </div>
                <div>
                  <span className="font-medium text-foreground">
                    {t("columns.activity")}:
                  </span>{" "}
                  {item.lastSeenAt
                    ? format.dateTime(new Date(item.lastSeenAt), {
                        month: "short",
                        day: "numeric",
                      })
                    : "—"}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1.5 text-muted-foreground text-[11px]">
                <div>
                  <span className="font-medium text-foreground">
                    {t("columns.status")}:
                  </span>{" "}
                  {t(`invitationStatus.${item.invitationStatus}`)}
                </div>
                <div>
                  <span className="font-medium text-foreground">
                    {t("expires")}:
                  </span>{" "}
                  {item.invitationExpiresAt
                    ? format.dateTime(new Date(item.invitationExpiresAt), {
                        month: "short",
                        day: "numeric",
                      })
                    : "—"}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <p className="text-center text-xs text-muted-foreground py-4 italic">
          {t("noRecords")}
        </p>
      )}

      {/* Load More Button */}
      {hasMore && (
        <div className="pt-2 flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleLoadMore}
            disabled={isPending}
            className="min-h-[44px] px-6 text-xs font-medium"
          >
            {isPending ? (
              <>
                <Loader2
                  className="h-3.5 w-3.5 animate-spin mr-1.5"
                  aria-hidden="true"
                />
                {t("loadingMore")}
              </>
            ) : (
              t("loadMore")
            )}
          </Button>
        </div>
      )}
    </section>
  );
}
