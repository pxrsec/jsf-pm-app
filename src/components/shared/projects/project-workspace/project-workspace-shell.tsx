"use client";

import { useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProjectHeader } from "./project-header";
import { ProjectOverviewTab } from "./project-overview-tab";
import { ProjectEditDialog } from "./project-edit-dialog";
import {
  ProjectStatusDialog,
  type ProjectStatusActionType,
} from "./project-status-dialog";
import { CompletedProjectBanner } from "./completed-project-banner";
import { ProjectCompleteDialog } from "../project-lifecycle/project-complete-dialog";
import { ProjectReopenDialog } from "../project-lifecycle/project-reopen-dialog";
import { TasksTab } from "../project-tasks/tasks-tab";
import { DeliverablesTab } from "../project-deliverables/deliverables-tab";
import { MemberRosterTab } from "../project-members/member-roster-tab";
import { ProjectActivityTab } from "./project-activity-tab";
import { ProjectCalendarTab } from "./project-calendar-tab";
import { ProjectArchiveTab } from "./project-archive-tab";
import type {
  ProjectDetail,
  ProjectCompletionCyclesView,
  EligibleClientMember,
  Profile,
  TaskWithAssignee,
} from "@/lib/projects/queries";
import type { DeliverableListItem } from "@/lib/deliverables/queries";
import type { ClientListItem } from "@/lib/clients/queries";
import type {
  AvailableResult,
  DirectContactWorkspaceDto,
  ClientOrganizationWorkspaceDto,
} from "@/lib/clients/types";
import { ProjectClientIdentityDialog } from "./project-client-identity-dialog";
import type {
  CalendarEventDto,
  MilestoneManagementTargetDto,
  MilestoneOptionDto,
  MilestoneSummaryDto,
  CalendarRangeState,
} from "@/lib/calendar/types";
import type {
  FinalizedArchivePage,
  FinalizedArchiveQuery,
} from "@/lib/archive/types";

function subscribeDesktopMedia(callback: () => void) {
  const mediaQuery = window.matchMedia("(min-width: 768px)");
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

function getDesktopSnapshot() {
  return window.matchMedia("(min-width: 768px)").matches;
}

function getDesktopServerSnapshot() {
  return false;
}

interface ProjectWorkspaceShellProps {
  project: ProjectDetail;
  clients: ClientListItem[];
  cycles: ProjectCompletionCyclesView[];
  eligiblePms: Pick<Profile, "id" | "full_name" | "role" | "avatar_url">[];
  eligibleOperators: Pick<
    Profile,
    "id" | "full_name" | "role" | "avatar_url"
  >[];
  eligibleClients:
    AvailableResult<EligibleClientMember[]> | EligibleClientMember[];
  effectiveCapacity: "admin" | "pm_lead" | "pm_watcher";
  actorRole: "admin" | "pm";
  directContacts?: AvailableResult<DirectContactWorkspaceDto[]>;
  organizations?: AvailableResult<ClientOrganizationWorkspaceDto[]>;
  associatedContactIds?: AvailableResult<string[]>;
  currentUserId?: string;
  initialTasks?: TaskWithAssignee[];
  initialDeliverables?: DeliverableListItem[];
  initialCalendarEvents?: CalendarEventDto[];
  milestoneTargets?: MilestoneManagementTargetDto[];
  milestoneSummaries?: MilestoneSummaryDto[];
  milestoneOptions?: MilestoneOptionDto[];
  calendarRange?: CalendarRangeState;
  initialArchivePage?: FinalizedArchivePage;
  archiveQuery?: FinalizedArchiveQuery;
  locale?: string;
  initialTab?: string;
}

export function ProjectWorkspaceShell({
  project,
  clients,
  cycles,
  eligiblePms,
  eligibleOperators,
  eligibleClients,
  effectiveCapacity,
  actorRole,
  directContacts,
  organizations,
  associatedContactIds,
  currentUserId,
  initialTasks = [],
  initialDeliverables = [],
  initialCalendarEvents,
  milestoneTargets = [],
  milestoneSummaries = [],
  milestoneOptions = [],
  calendarRange,
  initialArchivePage,
  archiveQuery,
  locale = "es",
  initialTab = "overview",
}: ProjectWorkspaceShellProps) {
  const t = useTranslations("projects.workspace.tabs");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState(initialTab);
  const isDesktop = useSyncExternalStore(
    subscribeDesktopMedia,
    getDesktopSnapshot,
    getDesktopServerSnapshot,
  );
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isClientIdentityOpen, setIsClientIdentityOpen] = useState(false);
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const [isReopenOpen, setIsReopenOpen] = useState(false);
  const [statusAction, setStatusAction] =
    useState<ProjectStatusActionType | null>(null);
  const [openMilestoneId, setOpenMilestoneId] = useState<string>();

  const canManageOperationalLifecycle =
    actorRole === "admin" || actorRole === "pm";

  const canManageClientIdentity =
    project.project_type === "client" &&
    project.deleted_at === null &&
    project.archived_at === null &&
    project.status !== "completed" &&
    project.status !== "cancelled" &&
    (actorRole === "admin" || actorRole === "pm");

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);

    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);

    if (tab === "calendar") {
      if (calendarRange) {
        if (!params.has("calendarView"))
          params.set("calendarView", calendarRange.view);
        if (!params.has("calendarFrom"))
          params.set("calendarFrom", calendarRange.from);
        if (!params.has("calendarTo"))
          params.set("calendarTo", calendarRange.to);
      }
    } else if (tab === "archive") {
      if (archiveQuery) {
        if (!params.has("archiveFrom"))
          params.set("archiveFrom", archiveQuery.from);
        if (!params.has("archiveTo")) params.set("archiveTo", archiveQuery.to);
        if (archiveQuery.status && !params.has("archiveStatus"))
          params.set("archiveStatus", archiveQuery.status);
      }
    }

    router.push(`${pathname}?${params.toString()}`);
  };

  const handleStatusDialog = (action: ProjectStatusActionType) => {
    if (action === "complete") {
      setIsCompleteOpen(true);
    } else if (action === "reopen") {
      setIsReopenOpen(true);
    } else {
      setStatusAction(action);
    }
  };

  const handleOpenMilestone = (milestoneId: string) => {
    setOpenMilestoneId(milestoneId);
    handleTabChange("calendar");
  };

  const baseHref = actorRole === "admin" ? "/admin/proyectos" : "/pm/proyectos";
  const canViewCalendarTab = actorRole === "admin" || actorRole === "pm";
  const canManageMilestones =
    effectiveCapacity === "admin" || effectiveCapacity === "pm_lead";

  const navigationContent = (
    <TabsList className="h-10 bg-transparent p-0 flex space-x-6 justify-start">
      <TabsTrigger
        value="overview"
        className="h-10 rounded-none border-b-2 border-transparent px-2 pb-3 pt-2 text-xs sm:text-sm font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent shadow-none"
      >
        {t("overview")}
      </TabsTrigger>
      <TabsTrigger
        value="tasks"
        className="h-10 rounded-none border-b-2 border-transparent px-2 pb-3 pt-2 text-xs sm:text-sm font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent shadow-none"
      >
        {t("tasks")}
      </TabsTrigger>
      <TabsTrigger
        value="deliverables"
        className="h-10 rounded-none border-b-2 border-transparent px-2 pb-3 pt-2 text-xs sm:text-sm font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent shadow-none"
      >
        {t("deliverables")} ({initialDeliverables.length})
      </TabsTrigger>
      <TabsTrigger
        value="members"
        className="h-10 rounded-none border-b-2 border-transparent px-2 pb-3 pt-2 text-xs sm:text-sm font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent shadow-none"
      >
        {t("members")} ({project.members.length})
      </TabsTrigger>
      <TabsTrigger
        value="activity"
        className="h-10 rounded-none border-b-2 border-transparent px-2 pb-3 pt-2 text-xs sm:text-sm font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent shadow-none"
      >
        {t("activity")}
      </TabsTrigger>
      {canViewCalendarTab && (
        <TabsTrigger
          value="calendar"
          className="h-10 rounded-none border-b-2 border-transparent px-2 pb-3 pt-2 text-xs sm:text-sm font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent shadow-none"
        >
          {t("calendar")}
        </TabsTrigger>
      )}
      {canViewCalendarTab && (
        <TabsTrigger
          value="archive"
          className="h-10 rounded-none border-b-2 border-transparent px-2 pb-3 pt-2 text-xs sm:text-sm font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent shadow-none"
        >
          {t("archive")}
        </TabsTrigger>
      )}
    </TabsList>
  );

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      orientation="horizontal"
      className="min-h-screen bg-background gap-0 flex-col"
    >
      {/* Top Header */}
      <ProjectHeader
        project={project}
        clients={clients}
        effectiveCapacity={effectiveCapacity}
        actorRole={actorRole}
        canManageOperationalLifecycle={canManageOperationalLifecycle}
        baseHref={baseHref}
        onOpenEditDialog={() => setIsEditOpen(true)}
        onOpenStatusDialog={handleStatusDialog}
        onOpenClientIdentity={
          canManageClientIdentity
            ? () => setIsClientIdentityOpen(true)
            : undefined
        }
        navigation={isDesktop ? navigationContent : undefined}
      />

      {/* Main Tabs Workspace */}
      <main className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Mobile Navigation Placement (below md) */}
        {!isDesktop && (
          <div className="border-b border-border overflow-x-auto">
            {navigationContent}
          </div>
        )}

        {/* Completed Project Banner */}
        {project.status === "completed" && (
          <CompletedProjectBanner
            completedAt={project.completed_at}
            effectiveCapacity={effectiveCapacity}
            onReopenClick={() => setIsReopenOpen(true)}
          />
        )}

        <TabsContent value="overview" className="outline-hidden">
          <ProjectOverviewTab
            project={project}
            clients={clients}
            cycles={cycles}
            tasks={initialTasks}
            deliverables={initialDeliverables}
            milestoneSummaries={milestoneSummaries}
            canManageMilestones={canManageMilestones}
            onOpenEditDialog={() => setIsEditOpen(true)}
            onOpenClientIdentity={
              canManageClientIdentity
                ? () => setIsClientIdentityOpen(true)
                : undefined
            }
            onSelectTab={(tab) => handleTabChange(tab)}
            onOpenMilestone={handleOpenMilestone}
          />
        </TabsContent>

        <TabsContent value="tasks" className="outline-hidden">
          <TasksTab
            project={project}
            initialTasks={initialTasks}
            effectiveCapacity={effectiveCapacity}
            canManageOperationalLifecycle={canManageOperationalLifecycle}
            locale={locale}
            milestoneOptions={milestoneOptions}
          />
        </TabsContent>

        <TabsContent value="deliverables" className="outline-hidden">
          <DeliverablesTab
            project={project}
            initialDeliverables={initialDeliverables}
            tasks={initialTasks}
            effectiveCapacity={effectiveCapacity}
            canManageOperationalLifecycle={canManageOperationalLifecycle}
            currentUserId={currentUserId}
          />
        </TabsContent>

        <TabsContent value="members" className="outline-hidden">
          <MemberRosterTab
            project={project}
            effectiveCapacity={effectiveCapacity}
            eligiblePms={eligiblePms}
            eligibleOperators={eligibleOperators}
            eligibleClients={eligibleClients}
          />
        </TabsContent>

        <TabsContent value="activity" className="outline-hidden">
          <ProjectActivityTab cycles={cycles} />
        </TabsContent>

        {canViewCalendarTab && (
          <TabsContent value="calendar" className="outline-hidden">
            {initialCalendarEvents && calendarRange ? (
              <ProjectCalendarTab
                initialEvents={initialCalendarEvents}
                milestoneTargets={milestoneTargets}
                projectId={project.id}
                canManageMilestones={canManageMilestones}
                userRole={actorRole}
                initialRange={calendarRange}
                initialMilestoneId={openMilestoneId}
              />
            ) : (
              <div className="flex h-48 items-center justify-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">
                  {t("calendar")}...
                </span>
              </div>
            )}
          </TabsContent>
        )}

        {canViewCalendarTab && (
          <TabsContent value="archive" className="outline-hidden">
            {initialArchivePage && archiveQuery ? (
              <ProjectArchiveTab
                projectId={project.id}
                initialArchivePage={initialArchivePage}
                currentQuery={archiveQuery}
              />
            ) : (
              <div className="flex h-48 items-center justify-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">
                  {t("archive")}...
                </span>
              </div>
            )}
          </TabsContent>
        )}
      </main>

      {/* Edit Dialog */}
      <ProjectEditDialog
        project={project}
        clients={clients}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
      />

      {/* Status Transition Dialog */}
      <ProjectStatusDialog
        projectId={project.id}
        actionType={statusAction}
        isOpen={Boolean(statusAction)}
        onClose={() => setStatusAction(null)}
      />

      {/* Completion Preflight & Confirmation Dialog */}
      <ProjectCompleteDialog
        projectId={project.id}
        isOpen={isCompleteOpen}
        onClose={() => setIsCompleteOpen(false)}
      />

      {/* Reopen Dialog */}
      <ProjectReopenDialog
        projectId={project.id}
        isOpen={isReopenOpen}
        onClose={() => setIsReopenOpen(false)}
      />

      {/* Client Identity Dialog */}
      {canManageClientIdentity && (
        <ProjectClientIdentityDialog
          isOpen={isClientIdentityOpen}
          onClose={() => setIsClientIdentityOpen(false)}
          project={project}
          organizations={organizations}
          directContacts={directContacts}
          associatedContactIds={associatedContactIds}
          actorRole={actorRole}
        />
      )}
    </Tabs>
  );
}
