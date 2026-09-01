"use client";

import { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import {
  UserPlus,
  MoreHorizontal,
  Star,
  Settings,
  UserX,
  Bell,
  BellOff,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MemberCapacityBadge } from "./member-capacity-badge";
import { AddMemberDialog } from "./add-member-dialog";
import { ChangeCapacityDialog } from "./change-capacity-dialog";
import { RemoveMemberDialog } from "./remove-member-dialog";
import { SetPrimaryLeadDialog } from "./set-primary-lead-dialog";
import type { AvailableResult } from "@/lib/clients/types";
import type {
  ProjectDetail,
  ProjectMemberWithProfile,
  EligibleClientMember,
  Profile,
} from "@/lib/projects/queries";

interface MemberRosterTabProps {
  project: ProjectDetail;
  effectiveCapacity: "admin" | "pm_lead" | "pm_watcher";
  eligiblePms: Pick<Profile, "id" | "full_name" | "role" | "avatar_url">[];
  eligibleOperators: Pick<
    Profile,
    "id" | "full_name" | "role" | "avatar_url"
  >[];
  eligibleClients:
    AvailableResult<EligibleClientMember[]> | EligibleClientMember[];
}

export function MemberRosterTab({
  project,
  effectiveCapacity,
  eligiblePms,
  eligibleOperators,
  eligibleClients,
}: MemberRosterTabProps) {
  const t = useTranslations("projects.members");
  const tSystemRole = useTranslations("shell.nav.currentUser.role");
  const format = useFormatter();

  const isWatcher = effectiveCapacity === "pm_watcher";

  // Dialog state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedMemberForCapacity, setSelectedMemberForCapacity] =
    useState<ProjectMemberWithProfile | null>(null);
  const [selectedMemberForRemoval, setSelectedMemberForRemoval] =
    useState<ProjectMemberWithProfile | null>(null);
  const [selectedMemberForPrimary, setSelectedMemberForPrimary] =
    useState<ProjectMemberWithProfile | null>(null);

  // Summary counts
  const totalCount = project.members.length;
  const pmLeadsCount = project.members.filter(
    (m) => m.member_type === "pm_lead",
  ).length;
  const operatorsCount = project.members.filter(
    (m) => m.member_type === "operator",
  ).length;
  const clientsCount = project.members.filter(
    (m) => m.member_type === "client",
  ).length;

  return (
    <div className="space-y-6">
      {/* Header & Stats */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-bold tracking-tight text-foreground">
            {t("title")}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("subtitle")}
          </p>
        </div>

        {!isWatcher && (
          <Button
            size="sm"
            onClick={() => setIsAddOpen(true)}
            className="h-9 gap-1.5 self-start sm:self-auto"
          >
            <UserPlus className="h-4 w-4" />
            <span>{t("addMemberAction")}</span>
          </Button>
        )}
      </div>

      {/* Stats Badges */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="px-2.5 py-1 rounded-md border border-border bg-card font-medium text-foreground">
          {t("stats.total", { count: totalCount })}
        </span>
        <span className="px-2.5 py-1 rounded-md border border-indigo-500/20 bg-indigo-500/10 font-medium text-indigo-800 dark:text-indigo-200">
          {t("stats.pmLeads", { count: pmLeadsCount })}
        </span>
        <span className="px-2.5 py-1 rounded-md border border-blue-500/20 bg-blue-500/10 font-medium text-blue-800 dark:text-blue-200">
          {t("stats.operators", { count: operatorsCount })}
        </span>
        {project.project_type === "client" && (
          <span className="px-2.5 py-1 rounded-md border border-purple-500/20 bg-purple-500/10 font-medium text-purple-800 dark:text-purple-200">
            {t("stats.clients", { count: clientsCount })}
          </span>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="rounded-md border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30%]">
                {t("table.columns.member")}
              </TableHead>
              <TableHead className="w-[15%]">
                {t("table.columns.systemRole")}
              </TableHead>
              <TableHead className="w-[20%]">
                {t("table.columns.capacity")}
              </TableHead>
              <TableHead className="w-[10%] text-center">
                {t("table.columns.notifications")}
              </TableHead>
              <TableHead className="w-[15%]">
                {t("table.columns.joinedAt")}
              </TableHead>
              {!isWatcher && (
                <TableHead className="w-[10%] text-right">
                  {t("table.columns.actions")}
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {project.members.map((member) => {
              const joinedDate = new Date(member.joined_at);

              return (
                <TableRow
                  key={member.id}
                  className="hover:bg-muted/40 transition-colors"
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                        {member.profile?.full_name?.charAt(0) ?? "U"}
                      </div>
                      <div className="flex flex-col truncate">
                        <span className="font-semibold text-foreground text-xs sm:text-sm truncate">
                          {member.profile?.full_name ?? "Usuario"}
                        </span>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge variant="outline" className="text-xs font-normal">
                      {member.profile?.role
                        ? tSystemRole(member.profile.role)
                        : "—"}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <MemberCapacityBadge
                      capacity={member.member_type}
                      isPrimary={member.is_primary}
                    />
                  </TableCell>

                  <TableCell className="text-center">
                    {member.receives_notifications ? (
                      <span
                        title="Recibe notificaciones"
                        className="inline-flex text-muted-foreground"
                      >
                        <Bell className="h-3.5 w-3.5" />
                      </span>
                    ) : (
                      <span
                        title="Notificaciones desactivadas"
                        className="inline-flex text-muted-foreground/40"
                      >
                        <BellOff className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="text-xs text-muted-foreground">
                    {format.dateTime(joinedDate, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </TableCell>

                  {!isWatcher && (
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className="inline-flex shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground h-8 w-8 cursor-pointer hover:bg-muted"
                          aria-label={t("table.columns.actions")}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-48 text-xs"
                        >
                          {member.member_type === "pm_lead" &&
                            !member.is_primary && (
                              <DropdownMenuItem
                                onClick={() =>
                                  setSelectedMemberForPrimary(member)
                                }
                                className="cursor-pointer gap-2"
                              >
                                <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                                <span>{t("table.actions.setPrimaryLead")}</span>
                              </DropdownMenuItem>
                            )}

                          <DropdownMenuItem
                            onClick={() => setSelectedMemberForCapacity(member)}
                            className="cursor-pointer gap-2"
                          >
                            <Settings className="h-3.5 w-3.5" />
                            <span>{t("table.actions.changeCapacity")}</span>
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />

                          <DropdownMenuItem
                            onClick={() => setSelectedMemberForRemoval(member)}
                            className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                          >
                            <UserX className="h-3.5 w-3.5" />
                            <span>{t("table.actions.remove")}</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Dialogs */}
      <AddMemberDialog
        project={project}
        eligiblePms={eligiblePms}
        eligibleOperators={eligibleOperators}
        eligibleClients={eligibleClients}
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
      />

      <ChangeCapacityDialog
        projectId={project.id}
        member={selectedMemberForCapacity}
        isOpen={Boolean(selectedMemberForCapacity)}
        onClose={() => setSelectedMemberForCapacity(null)}
      />

      <SetPrimaryLeadDialog
        projectId={project.id}
        member={selectedMemberForPrimary}
        isOpen={Boolean(selectedMemberForPrimary)}
        onClose={() => setSelectedMemberForPrimary(null)}
      />

      <RemoveMemberDialog
        projectId={project.id}
        member={selectedMemberForRemoval}
        isOpen={Boolean(selectedMemberForRemoval)}
        onClose={() => setSelectedMemberForRemoval(null)}
      />
    </div>
  );
}
