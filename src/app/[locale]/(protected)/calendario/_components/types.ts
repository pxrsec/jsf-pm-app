import type { AppRole } from "@/lib/auth/routes";
import type {
  CalendarEventDto,
  MilestoneManagementTargetDto,
  CalendarRangeState,
} from "@/lib/calendar/types";

export interface CalendarCoordinatorProps {
  initialEvents: CalendarEventDto[];
  initialRange: CalendarRangeState;
  milestoneTargets: MilestoneManagementTargetDto[];
  canManageMilestones: boolean;
  userRole: AppRole;
  fixedProjectId?: string;
  initialMilestoneId?: string;
  keyPrefix?: string;
  onRangeChange?: (range: CalendarRangeState) => void;
}

export interface CalendarViewProps {
  events: CalendarEventDto[];
  currentRange: CalendarRangeState;
  canManageMilestones: boolean;
  userRole: AppRole;
  onEditMilestone?: (eventId: string) => void;
  onDeleteMilestone?: (eventId: string, title: string) => void;
  onOpenMilestoneDetail?: (eventId: string) => void;
}
