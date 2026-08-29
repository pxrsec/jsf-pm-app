"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ProjectDetail } from "@/lib/projects/queries";

interface ProjectTeamSummaryProps {
  members: ProjectDetail["members"];
  onOpenMembers: () => void;
}

export function ProjectTeamSummary({
  members,
  onOpenMembers,
}: ProjectTeamSummaryProps) {
  const t = useTranslations("projects.workspace.overview");
  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex items-center justify-between px-6 py-3">
        <h2 className="text-base font-semibold">{t("teamSummaryTitle")}</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenMembers}
          className="h-7 px-2 text-xs font-medium text-primary"
        >
          {t("viewAllMembers", { count: members.length })}
        </Button>
      </header>
      <div className="space-y-2.5 px-6 pb-6">
        {members.slice(0, 5).map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between text-xs"
          >
            <div className="flex min-w-0 items-center gap-2 pr-2">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {member.profile?.full_name?.charAt(0) ?? "U"}
              </div>
              <span className="truncate font-medium text-foreground">
                {member.profile?.full_name ?? "Usuario"}
              </span>
            </div>
            <Badge variant="outline" className="shrink-0 text-[10px]">
              {member.is_primary ? "Lead ★" : member.member_type}
            </Badge>
          </div>
        ))}
      </div>
    </section>
  );
}
