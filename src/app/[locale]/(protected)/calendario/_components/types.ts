import type { AppRole } from "@/lib/auth/routes";
import type {
  CalendarEventDto,
  CalendarMilestoneTargetDto,
  CalendarRangeState,
} from "@/lib/calendar/types";

export interface CalendarCoordinatorProps {
  initialEvents: CalendarEventDto[];
  initialRange: CalendarRangeState;
  milestoneTargets: CalendarMilestoneTargetDto[];
  canManageMilestones: boolean;
  userRole: AppRole;
  fixedProjectId?: string;
  keyPrefix?: string;
  onRangeChange?: (range: CalendarRangeState) => void;
}

export interface MilestoneDialogState {
  isOpen: boolean;
  mode: "create" | "edit";
  editEventId?: string;
}

export interface DeleteDialogState {
  isOpen: boolean;
  eventId?: string;
  eventTitle?: string;
}

export interface CalendarViewProps {
  events: CalendarEventDto[];
  currentRange: CalendarRangeState;
  canManageMilestones: boolean;
  userRole: AppRole;
  onEditMilestone?: (eventId: string) => void;
  onDeleteMilestone?: (eventId: string, title: string) => void;
}
