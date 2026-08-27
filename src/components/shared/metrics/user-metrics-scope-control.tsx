"use client";

import { useTransition, useCallback } from "react";
import { useRouter, usePathname } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FolderKanban, User, X, Loader2 } from "lucide-react";

interface UserMetricsScopeControlProps {
  currentProjectId?: string;
  currentUserId?: string;
  projects?: readonly { id: string; name: string }[];
  users: readonly { userId: string; fullName: string }[];
  onFilterChangeAnnouncement?: (message: string) => void;
  role?: "admin" | "pm" | string;
}

export function UserMetricsScopeControl({
  currentProjectId,
  currentUserId,
  projects,
  users,
  onFilterChangeAnnouncement,
}: UserMetricsScopeControlProps) {
  const t = useTranslations("metrics.userAudit.filters");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateScope = useCallback(
    (updates: { projectId?: string | null; userId?: string | null }) => {
      const params = new URLSearchParams(searchParams.toString());

      if (updates.projectId !== undefined) {
        if (updates.projectId === null || updates.projectId === "all") {
          params.delete("projectId");
        } else {
          params.set("projectId", updates.projectId);
        }
        // Changing project always clears user selection
        params.delete("userId");
      }

      if (updates.userId !== undefined) {
        if (updates.userId === null || updates.userId === "all") {
          params.delete("userId");
        } else {
          params.set("userId", updates.userId);
        }
      }

      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [searchParams, router, pathname],
  );

  const handleProjectChange = (val: string | null) => {
    if (!val) return;
    updateScope({ projectId: val });
    if (onFilterChangeAnnouncement) {
      onFilterChangeAnnouncement(t("projectUpdatedAnnouncement"));
    }
  };

  const handleUserChange = (val: string | null) => {
    if (!val) return;
    updateScope({ userId: val });
    if (onFilterChangeAnnouncement) {
      onFilterChangeAnnouncement(t("userUpdatedAnnouncement"));
    }
  };

  const handleClearUser = () => {
    updateScope({ userId: null });
    if (onFilterChangeAnnouncement) {
      onFilterChangeAnnouncement(t("userClearedAnnouncement"));
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        {/* Project Filter (both Admin and PM) */}
        {projects && projects.length > 0 && (
          <div className="flex items-center gap-2">
            <label
              htmlFor="user-audit-project-select"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
            >
              <FolderKanban className="h-4 w-4" aria-hidden="true" />
              <span>{t("project")}:</span>
            </label>
            <Select
              value={currentProjectId ?? "all"}
              onValueChange={handleProjectChange}
              disabled={isPending}
              items={[
                { value: "all", label: t("allProjects") },
                ...projects.map((p) => ({ value: p.id, label: p.name })),
              ]}
            >
              <SelectTrigger
                id="user-audit-project-select"
                aria-label={t("selectedProjectAria")}
                className="w-[200px] sm:w-[240px] min-h-[44px] text-xs"
              >
                <SelectValue placeholder={t("allProjects")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  {t("allProjects")}
                </SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* User Filter (both Admin and PM) */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="user-audit-user-select"
            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
          >
            <User className="h-4 w-4" aria-hidden="true" />
            <span>{t("user")}:</span>
          </label>
          <Select
            value={currentUserId ?? "all"}
            onValueChange={handleUserChange}
            disabled={isPending || users.length === 0}
            items={[
              { value: "all", label: t("allUsers") },
              ...users.map((u) => ({ value: u.userId, label: u.fullName })),
            ]}
          >
            <SelectTrigger
              id="user-audit-user-select"
              aria-label={t("selectedUserAria")}
              className="w-[200px] sm:w-[240px] min-h-[44px] text-xs"
            >
              <SelectValue placeholder={t("allUsers")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                {t("allUsers")}
              </SelectItem>
              {users.map((u) => (
                <SelectItem key={u.userId} value={u.userId} className="text-xs">
                  {u.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {currentUserId && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearUser}
              disabled={isPending}
              aria-label={t("clearUserSelection")}
              className="min-h-[44px] min-w-[44px] px-2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">{t("clearUserSelection")}</span>
            </Button>
          )}
        </div>
      </div>

      {isPending && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>{t("updating")}</span>
        </div>
      )}
    </div>
  );
}
