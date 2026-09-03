"use client";

import { usePathname, useRouter } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import type { AppRole } from "@/lib/auth/routes";
import type {
  CalendarEventDto,
  MilestoneManagementTargetDto,
  CalendarRangeState,
} from "@/lib/calendar/types";
import { CalendarCoordinator } from "@/app/[locale]/(protected)/calendario/_components/calendar-coordinator";

interface ProjectCalendarTabProps {
  initialEvents: CalendarEventDto[];
  milestoneTargets: MilestoneManagementTargetDto[];
  projectId: string;
  canManageMilestones: boolean;
  userRole: AppRole;
  initialRange: CalendarRangeState;
  initialMilestoneId?: string;
}

export function ProjectCalendarTab({
  initialEvents,
  milestoneTargets,
  projectId,
  canManageMilestones,
  userRole,
  initialRange,
  initialMilestoneId,
}: ProjectCalendarTabProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleRangeChange = (newRange: CalendarRangeState) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "calendar");
    params.set("calendarView", newRange.view);
    params.set("calendarFrom", newRange.from);
    params.set("calendarTo", newRange.to);
    // Explicitly purge stale global calendar keys
    params.delete("view");
    params.delete("from");
    params.delete("to");
    params.delete("projectId");
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="pt-2">
      <CalendarCoordinator
        key={initialMilestoneId ?? "project-calendar"}
        initialEvents={initialEvents}
        initialRange={initialRange}
        milestoneTargets={milestoneTargets}
        canManageMilestones={canManageMilestones}
        userRole={userRole}
        fixedProjectId={projectId}
        initialMilestoneId={initialMilestoneId}
        keyPrefix="calendar"
        onRangeChange={handleRangeChange}
      />
    </div>
  );
}
