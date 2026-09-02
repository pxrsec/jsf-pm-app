"use client";
import { useState } from "react";
import { usePathname, useRouter } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import { TZDate } from "@date-fns/tz";
import {
  CALENDAR_TIME_ZONE,
  getDefaultMonthRange,
  getWeekRange,
} from "@/lib/calendar/date-utils";
import type { CalendarRangeState, CalendarView } from "@/lib/calendar/types";
import type { CalendarCoordinatorProps } from "./types";
import { CalendarHeader } from "./calendar-header";
import { CalendarMonthView } from "./views/calendar-month-view";
import { CalendarWeekView } from "./views/calendar-week-view";
import { CalendarAgendaView } from "./views/calendar-agenda-view";
import { CalendarListView } from "./views/calendar-list-view";
import { MilestoneDialog } from "./milestone-dialog";
import { DeleteMilestoneDialog } from "./delete-milestone-dialog";
import { MilestoneDetailDialog } from "./milestone-detail-dialog";

export function CalendarCoordinator({
  initialEvents,
  initialRange,
  milestoneTargets,
  canManageMilestones,
  userRole,
  fixedProjectId,
  initialMilestoneId,
  keyPrefix = "",
  onRangeChange,
}: CalendarCoordinatorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [form, setForm] = useState<{
    mode: "create" | "edit";
    milestoneId?: string;
    focusTasks?: boolean;
  } | null>(null);
  const [detailId, setDetailId] = useState<string | undefined>(
    initialMilestoneId,
  );
  const [deleting, setDeleting] = useState<{
    milestoneId: string;
    title: string;
  } | null>(null);

  const canArchiveMilestones = userRole === "admin" || userRole === "pm";

  const updateRange = (range: CalendarRangeState) => {
    if (onRangeChange) return onRangeChange(range);
    const next = new URLSearchParams(params.toString());
    const prefix = keyPrefix ? keyPrefix : "";
    next.set(prefix ? `${prefix}View` : "view", range.view);
    next.set(prefix ? `${prefix}From` : "from", range.from);
    next.set(prefix ? `${prefix}To` : "to", range.to);
    if (!prefix) {
      if (range.projectId) next.set("projectId", range.projectId);
      else next.delete("projectId");
    }
    router.push(`${pathname}?${next}`);
  };
  const changeView = (view: CalendarView) => {
    const range =
      view === "week"
        ? getWeekRange(new Date())
        : getDefaultMonthRange(new Date());
    updateRange({ view, ...range, projectId: initialRange.projectId });
  };
  const shift = (direction: -1 | 1) => {
    const from = new TZDate(new Date(initialRange.from), CALENDAR_TIME_ZONE);
    if (initialRange.view === "week") {
      const range = getWeekRange(
        new TZDate(
          from.getTime() + direction * 7 * 86400000,
          CALENDAR_TIME_ZONE,
        ),
      );
      updateRange({ ...initialRange, ...range });
    } else {
      const range = getDefaultMonthRange(
        new TZDate(
          from.getFullYear(),
          from.getMonth() + direction,
          1,
          0,
          0,
          0,
          0,
          CALENDAR_TIME_ZONE,
        ),
      );
      updateRange({ ...initialRange, ...range });
    }
  };
  const viewProps = {
    events: initialEvents,
    currentRange: initialRange,
    canManageMilestones,
    userRole,
    onOpenMilestoneDetail: setDetailId,
    onEditMilestone: canManageMilestones
      ? (id: string) => setForm({ mode: "edit", milestoneId: id })
      : undefined,
    onDeleteMilestone: canManageMilestones
      ? (milestoneId: string, title: string) =>
          setDeleting({ milestoneId, title })
      : undefined,
  };
  return (
    <div className="space-y-4">
      <CalendarHeader
        currentRange={initialRange}
        canManageMilestones={canManageMilestones}
        targets={milestoneTargets}
        fixedProjectId={fixedProjectId}
        onViewChange={changeView}
        onPrev={() => shift(-1)}
        onNext={() => shift(1)}
        onToday={() => {
          const range =
            initialRange.view === "week"
              ? getWeekRange(new Date())
              : getDefaultMonthRange(new Date());
          updateRange({ ...initialRange, ...range });
        }}
        onProjectFilterChange={
          canManageMilestones
            ? (projectId) => updateRange({ ...initialRange, projectId })
            : undefined
        }
        onCreateMilestone={
          canManageMilestones ? () => setForm({ mode: "create" }) : undefined
        }
      />
      {initialRange.view === "month" && <CalendarMonthView {...viewProps} />}{" "}
      {initialRange.view === "week" && <CalendarWeekView {...viewProps} />}{" "}
      {initialRange.view === "agenda" && <CalendarAgendaView {...viewProps} />}{" "}
      {initialRange.view === "list" && <CalendarListView {...viewProps} />}
      <MilestoneDetailDialog
        milestoneId={detailId}
        isOpen={Boolean(detailId)}
        canManage={canManageMilestones}
        canArchive={canArchiveMilestones}
        userRole={userRole}
        onClose={() => setDetailId(undefined)}
        onEdit={(id, focusTasks) =>
          setForm({ mode: "edit", milestoneId: id, focusTasks })
        }
        onDelete={(id, title) => setDeleting({ milestoneId: id, title })}
      />
      {canManageMilestones && form && (
        <MilestoneDialog
          isOpen
          mode={form.mode}
          milestoneId={form.milestoneId}
          focusTasks={form.focusTasks}
          targets={milestoneTargets}
          fixedProjectId={fixedProjectId}
          onClose={() => setForm(null)}
          onSuccess={() => router.refresh()}
        />
      )}{" "}
      {canArchiveMilestones && deleting && (
        <DeleteMilestoneDialog
          isOpen
          milestoneId={deleting.milestoneId}
          milestoneTitle={deleting.title}
          onClose={() => setDeleting(null)}
          onSuccess={() => {
            setDeleting(null);
            setDetailId(undefined);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
