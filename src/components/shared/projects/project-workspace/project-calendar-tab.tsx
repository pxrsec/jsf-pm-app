"use client";

import { usePathname, useRouter } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import type { AppRole } from "@/lib/auth/routes";
import type {
  CalendarEventDto,
  CalendarMilestoneTargetDto,
  CalendarRangeState,
} from "@/lib/calendar/types";
import { CalendarCoordinator } from "@/app/[locale]/(protected)/calendario/_components/calendar-coordinator";

interface ProjectCalendarTabProps {
  initialEvents: CalendarEventDto[];
  milestoneTargets: CalendarMilestoneTargetDto[];
  projectId: string;
  canManageMilestones: boolean;
  userRole: AppRole;
  initialRange: CalendarRangeState;
}

export function ProjectCalendarTab({
  initialEvents,
  milestoneTargets,
  projectId,
  canManageMilestones,
  userRole,
  initialRange,
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
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="pt-2">
      <CalendarCoordinator
        initialEvents={initialEvents}
        initialRange={initialRange}
        milestoneTargets={milestoneTargets}
        canManageMilestones={canManageMilestones}
        userRole={userRole}
        fixedProjectId={projectId}
        keyPrefix="calendar"
        onRangeChange={handleRangeChange}
      />
    </div>
  );
}
