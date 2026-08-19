"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ProjectHeader } from "./project-header";
import { ProjectOverviewTab } from "./project-overview-tab";
import { ProjectEditDialog } from "./project-edit-dialog";
import {
  ProjectStatusDialog,
  type ProjectStatusActionType,
} from "./project-status-dialog";
import { TasksTab } from "../project-tasks/tasks-tab";
import { DeliverablesTabPlaceholder } from "./placeholders/deliverables-tab-placeholder";
import { MemberRosterTab } from "../project-members/member-roster-tab";
import type {
  ProjectDetail,
  ProjectCompletionCyclesView,
  EligibleClientMember,
  Profile,
  TaskWithAssignee,
} from "@/lib/projects/queries";
import type { ClientListItem } from "@/lib/clients/queries";

interface ProjectWorkspaceShellProps {
  project: ProjectDetail;
  clients: ClientListItem[];
  cycles: ProjectCompletionCyclesView[];
  eligiblePms: Pick<Profile, "id" | "full_name" | "role" | "avatar_url">[];
  eligibleOperators: Pick<
    Profile,
    "id" | "full_name" | "role" | "avatar_url"
  >[];
  eligibleClients: EligibleClientMember[];
  effectiveCapacity: "admin" | "pm_lead" | "pm_watcher";
  actorRole: "admin" | "pm";
  initialTasks?: TaskWithAssignee[];
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
  initialTasks = [],
  locale = "es",
  initialTab = "overview",
}: ProjectWorkspaceShellProps) {
  const t = useTranslations("projects.workspace.tabs");
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [statusAction, setStatusAction] =
    useState<ProjectStatusActionType | null>(null);

  const baseHref = actorRole === "admin" ? "/admin/proyectos" : "/pm/proyectos";
  const isInternal = project.project_type === "internal";
  const hasClientMember = project.members.some(
    (m) => m.member_type === "client",
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Top Header */}
      <ProjectHeader
        project={project}
        clients={clients}
        effectiveCapacity={effectiveCapacity}
        baseHref={baseHref}
        onOpenEditDialog={() => setIsEditOpen(true)}
        onOpenStatusDialog={(action) => setStatusAction(action)}
      />

      {/* Main Tabs Workspace */}
      <main className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="border-b border-border overflow-x-auto">
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
                {t("deliverables")}
              </TabsTrigger>
              <TabsTrigger
                value="members"
                className="h-10 rounded-none border-b-2 border-transparent px-2 pb-3 pt-2 text-xs sm:text-sm font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent shadow-none"
              >
                {t("members")} ({project.members.length})
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="outline-hidden">
            <ProjectOverviewTab
              project={project}
              clients={clients}
              cycles={cycles}
              onOpenEditDialog={() => setIsEditOpen(true)}
              onSelectTab={(tab) => setActiveTab(tab)}
            />
          </TabsContent>

          <TabsContent value="tasks" className="outline-hidden">
            <TasksTab
              project={project}
              initialTasks={initialTasks}
              effectiveCapacity={effectiveCapacity}
              locale={locale}
            />
          </TabsContent>

          <TabsContent value="deliverables" className="outline-hidden">
            <DeliverablesTabPlaceholder
              isInternal={isInternal}
              hasClientMember={hasClientMember}
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
        </Tabs>
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
    </div>
  );
}
