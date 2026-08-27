"use client";

import { ProjectAssigneeSelect } from "./project-assignee-select";
import type { ProjectMemberWithProfile } from "@/lib/projects/queries";
import type { MemberCapacity } from "@/lib/status-maps";
import { useTranslations } from "next-intl";

interface TaskAssigneeSelectProps {
  members: ProjectMemberWithProfile[];
  allowedMemberTypes?: MemberCapacity[];
  value?: string;
  onChange: (assigneeId: string) => void;
  disabled?: boolean;
  error?: string;
  placeholder?: string;
  noCompatibleMembersText?: string;
}

export function TaskAssigneeSelect({
  members,
  allowedMemberTypes = ["pm_lead", "pm_watcher", "operator"],
  value,
  onChange,
  disabled = false,
  error,
  placeholder,
  noCompatibleMembersText,
}: TaskAssigneeSelectProps) {
  const t = useTranslations("projects.tasks.create");

  return (
    <ProjectAssigneeSelect
      members={members}
      allowedMemberTypes={allowedMemberTypes}
      value={value}
      onChange={onChange}
      disabled={disabled}
      error={error}
      placeholder={placeholder ?? t("assigneePlaceholder")}
      noCompatibleMembersText={
        noCompatibleMembersText ?? t("assigneePlaceholder")
      }
    />
  );
}
