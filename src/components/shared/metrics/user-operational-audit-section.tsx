"use client";

import { useState, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ChevronDown,
  FolderKanban,
  Globe,
  HelpCircle,
  Users,
} from "lucide-react";
import type {
  SortDirection,
  UserOperationsMetricsSectionResult,
  UserOperationsSortField,
} from "@/lib/user-operations-metrics/types";
import { sortUserOperationsMetrics } from "./user-metrics-sort-utils";
import { UserMetricsAttentionCues } from "./user-metrics-attention-cues";
import { UserMetricsScopeControl } from "./user-metrics-scope-control";
import { UserMetricsTable } from "./user-metrics-table";
import { UserMetricsCardList } from "./user-metrics-card-list";
import { UserMetricsDetailPanel } from "./user-metrics-detail-panel";

interface UserOperationalAuditSectionProps {
  role: "admin" | "pm";
  result: UserOperationsMetricsSectionResult;
  currentProjectId?: string;
  currentUserId?: string;
  projects?: readonly { id: string; name: string }[];
  projectName?: string;
}

export function UserOperationalAuditSection({
  role,
  result,
  currentProjectId,
  currentUserId,
  projects,
  projectName,
}: UserOperationalAuditSectionProps) {
  const t = useTranslations("metrics.userAudit");
  const tSemantics = useTranslations("metrics.userAudit.semantics");
  const tStates = useTranslations("metrics.userAudit.states");
  const tLive = useTranslations("metrics.userAudit.liveRegion");

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Sorting state (purely client-side presentation over validated rows)
  const [sortField, setSortField] = useState<UserOperationsSortField | null>(
    null,
  );
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>("");
  const [showCaveats, setShowCaveats] = useState<boolean>(false);

  const handleSortChange = useCallback(
    (field: UserOperationsSortField) => {
      let nextDirection: SortDirection = "asc";
      if (sortField === field) {
        nextDirection = sortDirection === "asc" ? "desc" : "asc";
      }
      setSortField(field);
      setSortDirection(nextDirection);
      setLiveAnnouncement(
        tLive("sortUpdated", {
          field,
          direction: nextDirection,
        }),
      );
    },
    [sortField, sortDirection, tLive],
  );

  const handleSelectUser = useCallback(
    (userId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("userId", userId);
      router.push(`${pathname}?${params.toString()}`);
      setLiveAnnouncement(tLive("detailOpened"));
    },
    [searchParams, router, pathname, tLive],
  );

  const handleCloseDetail = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("userId");
    router.push(`${pathname}?${params.toString()}`);
    setLiveAnnouncement(tLive("detailClosed"));
  }, [searchParams, router, pathname, tLive]);

  // Derive rows and user options
  const allRows = useMemo(
    () => (result.status === "available" ? result.data : []),
    [result],
  );

  const userOptions = useMemo(() => {
    return allRows.map((r) => ({
      userId: r.userId,
      fullName: r.fullName,
    }));
  }, [allRows]);

  // Validate optional URL userId against returned rows
  const selectedUser = useMemo(() => {
    if (!currentUserId) return null;
    return allRows.find((r) => r.userId === currentUserId) ?? null;
  }, [allRows, currentUserId]);

  // Display rows: if a valid user is selected, filter table/cards to that user, otherwise show sorted allRows
  const displayRows = useMemo(() => {
    const sourceRows = selectedUser ? [selectedUser] : allRows;
    return sortUserOperationsMetrics(sourceRows, sortField, sortDirection);
  }, [allRows, selectedUser, sortField, sortDirection]);

  // Determine current scope label
  const scopeLabel = useMemo(() => {
    if (role === "pm") {
      return projectName
        ? t("scope.selectedProject", { name: projectName })
        : t("scope.allProjects");
    }
    if (currentProjectId && projects) {
      const matched = projects.find((p) => p.id === currentProjectId);
      if (matched) {
        return t("scope.selectedProject", { name: matched.name });
      }
    }
    return t("scope.allProjects");
  }, [role, projectName, currentProjectId, projects, t]);

  return (
    <section
      aria-labelledby="user-operational-audit-title"
      className="space-y-6 pt-6 border-t border-border"
    >
      {/* Polite Live Region */}
      <div role="status" aria-live="polite" className="sr-only">
        {liveAnnouncement}
      </div>

      {/* Section Header */}
      <header className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2
              id="user-operational-audit-title"
              className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2"
            >
              <Users className="h-5 w-5 text-primary" aria-hidden="true" />
              <span>{t("title")}</span>
            </h2>
            <p className="text-sm text-muted-foreground">{t("description")}</p>
          </div>

          {/* Scope Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
            {role === "admin" && !currentProjectId ? (
              <Globe className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <FolderKanban className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>{scopeLabel}</span>
          </div>
        </div>
      </header>

      {/* Scope Control Bar (Project and User selection) */}
      <UserMetricsScopeControl
        role={role}
        currentProjectId={currentProjectId}
        currentUserId={selectedUser ? currentUserId : undefined}
        projects={projects}
        users={userOptions}
        onFilterChangeAnnouncement={(msg) => setLiveAnnouncement(msg)}
      />

      {/* 1. Unavailable / Error State */}
      {result.status === "unavailable" && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/20 bg-destructive/10 p-5 flex items-center gap-3 text-sm text-destructive"
        >
          <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
          <p>{tStates("unavailable")}</p>
        </div>
      )}

      {/* 2. Available with zero rows State */}
      {result.status === "available" && allRows.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-8 text-center space-y-2">
          <Users
            className="h-10 w-10 text-muted-foreground/40 mx-auto"
            aria-hidden="true"
          />
          <h3 className="text-base font-semibold text-foreground">
            {tStates("noOperationalRecords")}
          </h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            {t("noRecordsDescription")}
          </p>
        </div>
      )}

      {/* 3. Available with rows */}
      {result.status === "available" && allRows.length > 0 && (
        <div className="space-y-6">
          {/* Operational Attention Cues */}
          <UserMetricsAttentionCues />

          {/* Selected User Detail Panel (when selectedUser is present) */}
          {selectedUser && (
            <UserMetricsDetailPanel
              user={selectedUser}
              onClose={handleCloseDetail}
            />
          )}

          {/* Desktop & Tablet Sortable Table */}
          <div className="hidden md:block">
            <UserMetricsTable
              users={displayRows}
              selectedUserId={selectedUser?.userId}
              sortField={sortField}
              sortDirection={sortDirection}
              onSortChange={handleSortChange}
              onSelectUser={handleSelectUser}
            />
          </div>

          {/* Mobile Stacked Card List */}
          <div className="block md:hidden">
            <UserMetricsCardList
              users={displayRows}
              selectedUserId={selectedUser?.userId}
              onSelectUser={handleSelectUser}
            />
          </div>

          {/* Truthful Data Semantics Disclosure */}
          <div className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-2 text-xs text-muted-foreground">
            <button
              type="button"
              onClick={() => setShowCaveats(!showCaveats)}
              className="flex items-center justify-between w-full font-semibold text-foreground hover:text-primary transition-colors min-h-[44px]"
            >
              <span className="flex items-center gap-1.5">
                <HelpCircle
                  className="h-4 w-4 text-primary"
                  aria-hidden="true"
                />
                <span>{tSemantics("disclosureTitle")}</span>
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${
                  showCaveats ? "rotate-180" : ""
                }`}
                aria-hidden="true"
              />
            </button>

            {showCaveats && (
              <ul className="list-disc list-inside space-y-1 pt-2 border-t border-border/50 text-[11px] leading-relaxed">
                <li>{tSemantics("markedReadExplanation")}</li>
                <li>{tSemantics("directAssigneeStart")}</li>
                <li>{tSemantics("noRecordedDirectStartByRangeEnd")}</li>
                <li>{tSemantics("notAttendanceSignal")}</li>
                <li>{tSemantics("currentSnapshot")}</li>
                <li>{tSemantics("assignmentCohort")}</li>
                <li>{tSemantics("inAppOnly")}</li>
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
