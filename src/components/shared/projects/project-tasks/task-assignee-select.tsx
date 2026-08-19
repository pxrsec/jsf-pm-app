"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronsUpDown, User } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { MEMBER_CAPACITY_MAP, type MemberCapacity } from "@/lib/status-maps";
import type { ProjectMemberWithProfile } from "@/lib/projects/queries";
import { cn } from "@/lib/utils";

interface TaskAssigneeSelectProps {
  members: ProjectMemberWithProfile[];
  value?: string;
  onChange: (assigneeId: string) => void;
  disabled?: boolean;
  error?: string;
}

export function TaskAssigneeSelect({
  members,
  value,
  onChange,
  disabled = false,
  error,
}: TaskAssigneeSelectProps) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("projects.tasks.create");
  const tProjects = useTranslations("projects.roster.capacities");

  // Filter only active members with profile
  const activeMembers = members.filter(
    (m) => !m.deleted_at && m.profile && m.profile.is_active,
  );

  const selectedMember = activeMembers.find((m) => m.user_id === value);

  return (
    <div className="space-y-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal text-left h-10 inline-flex items-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            !value && "text-muted-foreground",
            error && "border-destructive",
          )}
        >
          {selectedMember ? (
            <div className="flex items-center gap-2 truncate">
              <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-semibold text-primary">
                {selectedMember.profile?.full_name?.charAt(0) ?? (
                  <User className="size-3" />
                )}
              </div>
              <span className="truncate font-medium text-foreground">
                {selectedMember.profile?.full_name}
              </span>
              <span className="text-xs text-muted-foreground">
                (
                {tProjects(
                  selectedMember.member_type as
                    | "pmLead"
                    | "pmWatcher"
                    | "operator"
                    | "client",
                )}
                )
              </span>
            </div>
          ) : (
            <span>{t("assigneePlaceholder")}</span>
          )}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <Command>
            <CommandInput placeholder={t("assigneePlaceholder")} />
            <CommandList>
              <CommandEmpty>{t("assigneePlaceholder")}</CommandEmpty>
              <CommandGroup>
                {activeMembers.map((member) => {
                  const isSelected = member.user_id === value;
                  const capacity = member.member_type as MemberCapacity;
                  const capacityConfig = MEMBER_CAPACITY_MAP[capacity];
                  const CapacityIcon = capacityConfig?.icon ?? User;

                  return (
                    <CommandItem
                      key={member.id}
                      value={`${member.profile?.full_name} ${member.user_id}`}
                      onSelect={() => {
                        onChange(member.user_id);
                        setOpen(false);
                      }}
                      className="flex items-center justify-between cursor-pointer py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-semibold text-primary">
                          {member.profile?.full_name?.charAt(0) ?? (
                            <User className="size-3" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate text-foreground">
                            {member.profile?.full_name}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <CapacityIcon className="size-3 shrink-0" />
                            <span>
                              {tProjects(
                                member.is_primary && member.member_type === "pm_lead"
                                  ? "pmLeadPrimary"
                                  : (member.member_type as
                                      | "pmLead"
                                      | "pmWatcher"
                                      | "operator"
                                      | "client"),
                              )}
                            </span>
                          </p>
                        </div>
                      </div>
                      <Check
                        className={cn(
                          "ml-2 size-4 shrink-0",
                          isSelected ? "opacity-100" : "opacity-0",
                        )}
                      />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
