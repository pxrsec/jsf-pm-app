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
import type {
  CalendarCoordinatorProps,
  DeleteDialogState,
  MilestoneDialogState,
} from "./types";
import { CalendarHeader } from "./calendar-header";
import { CalendarMonthView } from "./views/calendar-month-view";
import { CalendarWeekView } from "./views/calendar-week-view";
import { CalendarAgendaView } from "./views/calendar-agenda-view";
import { CalendarListView } from "./views/calendar-list-view";
import { MilestoneDialog } from "./milestone-dialog";
import { DeleteMilestoneDialog } from "./delete-milestone-dialog";

export function CalendarCoordinator({
  initialEvents,
  initialRange,
  milestoneTargets,
  canManageMilestones,
  userRole,
  fixedProjectId,
  keyPrefix = "",
  onRangeChange,
}: CalendarCoordinatorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [milestoneDialog, setMilestoneDialog] = useState<MilestoneDialogState>({
    isOpen: false,
    mode: "create",
  });

  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>({
    isOpen: false,
  });

  const updateRange = (newRange: CalendarRangeState) => {
    if (onRangeChange) {
      onRangeChange(newRange);
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    const fromKey = keyPrefix ? `${keyPrefix}From` : "from";
    const toKey = keyPrefix ? `${keyPrefix}To` : "to";
    const viewKey = keyPrefix ? `${keyPrefix}View` : "view";

    params.set(viewKey, newRange.view);
    params.set(fromKey, newRange.from);
    params.set(toKey, newRange.to);

    if (!keyPrefix) {
      if (newRange.projectId) {
        params.set("projectId", newRange.projectId);
      } else {
        params.delete("projectId");
      }
    }

    router.push(`${pathname}?${params.toString()}`);
  };

  const handleViewChange = (newView: CalendarView) => {
    let from = initialRange.from;
    let to = initialRange.to;

    const fromDate = new Date(initialRange.from);

    if (newView === "month" || newView === "agenda" || newView === "list") {
      const monthRange = getDefaultMonthRange(fromDate);
      from = monthRange.from;
      to = monthRange.to;
    } else if (newView === "week") {
      const weekRange = getWeekRange(fromDate);
      from = weekRange.from;
      to = weekRange.to;
    }

    updateRange({
      view: newView,
      from,
      to,
      projectId: initialRange.projectId,
    });
  };

  const handlePrev = () => {
    const fromDate = new Date(initialRange.from);
    const tzRef = new TZDate(fromDate, CALENDAR_TIME_ZONE);

    if (initialRange.view === "week") {
      const prevWeekDate = new TZDate(
        tzRef.getTime() - 7 * 86400000,
        CALENDAR_TIME_ZONE,
      );
      const weekRange = getWeekRange(prevWeekDate);
      updateRange({
        ...initialRange,
        from: weekRange.from,
        to: weekRange.to,
      });
    } else {
      // Month / Agenda / List: shift by 1 month
      const prevMonth = new TZDate(
        tzRef.getFullYear(),
        tzRef.getMonth() - 1,
        1,
        0,
        0,
        0,
        0,
        CALENDAR_TIME_ZONE,
      );
      const monthRange = getDefaultMonthRange(prevMonth);
      updateRange({
        ...initialRange,
        from: monthRange.from,
        to: monthRange.to,
      });
    }
  };

  const handleNext = () => {
    const fromDate = new Date(initialRange.from);
    const tzRef = new TZDate(fromDate, CALENDAR_TIME_ZONE);

    if (initialRange.view === "week") {
      const nextWeekDate = new TZDate(
        tzRef.getTime() + 7 * 86400000,
        CALENDAR_TIME_ZONE,
      );
      const weekRange = getWeekRange(nextWeekDate);
      updateRange({
        ...initialRange,
        from: weekRange.from,
        to: weekRange.to,
      });
    } else {
      // Month / Agenda / List: shift by 1 month
      const nextMonth = new TZDate(
        tzRef.getFullYear(),
        tzRef.getMonth() + 1,
        1,
        0,
        0,
        0,
        0,
        CALENDAR_TIME_ZONE,
      );
      const monthRange = getDefaultMonthRange(nextMonth);
      updateRange({
        ...initialRange,
        from: monthRange.from,
        to: monthRange.to,
      });
    }
  };

  const handleToday = () => {
    const today = new Date();
    if (initialRange.view === "week") {
      const weekRange = getWeekRange(today);
      updateRange({
        ...initialRange,
        from: weekRange.from,
        to: weekRange.to,
      });
    } else {
      const monthRange = getDefaultMonthRange(today);
      updateRange({
        ...initialRange,
        from: monthRange.from,
        to: monthRange.to,
      });
    }
  };

  const handleProjectFilterChange = (newProjectId?: string) => {
    updateRange({
      ...initialRange,
      projectId: newProjectId,
    });
  };

  const handleCreateMilestone = () => {
    setMilestoneDialog({
      isOpen: true,
      mode: "create",
    });
  };

  const handleEditMilestone = (eventId: string) => {
    setMilestoneDialog({
      isOpen: true,
      mode: "edit",
      editEventId: eventId,
    });
  };

  const handleDeleteMilestone = (eventId: string, title: string) => {
    setDeleteDialog({
      isOpen: true,
      eventId,
      eventTitle: title,
    });
  };

  const handleMutationSuccess = () => {
    router.refresh();
  };

  const viewProps = {
    events: initialEvents,
    currentRange: initialRange,
    canManageMilestones,
    userRole,
    onEditMilestone: canManageMilestones ? handleEditMilestone : undefined,
    onDeleteMilestone: canManageMilestones ? handleDeleteMilestone : undefined,
  };

  return (
    <div className="space-y-4">
      <CalendarHeader
        currentRange={initialRange}
        canManageMilestones={canManageMilestones}
        targets={milestoneTargets}
        fixedProjectId={fixedProjectId}
        onViewChange={handleViewChange}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        onProjectFilterChange={
          canManageMilestones ? handleProjectFilterChange : undefined
        }
        onCreateMilestone={
          canManageMilestones ? handleCreateMilestone : undefined
        }
      />

      {/* Active Calendar View */}
      {initialRange.view === "month" && <CalendarMonthView {...viewProps} />}
      {initialRange.view === "week" && <CalendarWeekView {...viewProps} />}
      {initialRange.view === "agenda" && <CalendarAgendaView {...viewProps} />}
      {initialRange.view === "list" && <CalendarListView {...viewProps} />}

      {/* Manager-only Milestone Dialog */}
      {canManageMilestones && (
        <>
          <MilestoneDialog
            isOpen={milestoneDialog.isOpen}
            mode={milestoneDialog.mode}
            editEventId={milestoneDialog.editEventId}
            targets={milestoneTargets}
            fixedProjectId={fixedProjectId}
            onClose={() =>
              setMilestoneDialog((prev) => ({ ...prev, isOpen: false }))
            }
            onSuccess={handleMutationSuccess}
          />

          <DeleteMilestoneDialog
            isOpen={deleteDialog.isOpen}
            eventId={deleteDialog.eventId}
            eventTitle={deleteDialog.eventTitle}
            onClose={() =>
              setDeleteDialog((prev) => ({ ...prev, isOpen: false }))
            }
            onSuccess={handleMutationSuccess}
          />
        </>
      )}
    </div>
  );
}
