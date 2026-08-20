"use client";

import { useTranslations } from "next-intl";
import { Star } from "lucide-react";
import { MEMBER_CAPACITY_MAP, type MemberCapacity } from "@/lib/status-maps";

interface MemberCapacityBadgeProps {
  capacity: MemberCapacity;
  isPrimary?: boolean;
}

export function MemberCapacityBadge({
  capacity,
  isPrimary,
}: MemberCapacityBadgeProps) {
  const t = useTranslations("projects.members.capacities");
  const config = MEMBER_CAPACITY_MAP[capacity] ?? MEMBER_CAPACITY_MAP.operator;
  const Icon = config.icon;

  const capacityKeyMap: Record<
    MemberCapacity,
    "pmLead" | "pmWatcher" | "operator" | "client"
  > = {
    pm_lead: "pmLead",
    pm_watcher: "pmWatcher",
    operator: "operator",
    client: "client",
  };

  if (capacity === "pm_lead" && isPrimary) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-700/60 shadow-xs">
        <Star className="h-3 w-3 fill-amber-500 text-amber-600 dark:fill-amber-400 dark:text-amber-400" />
        <span>{t("pmLeadPrimary")}</span>
      </span>
    );
  }

  const badgeStyles: Record<MemberCapacity, string> = {
    pm_lead:
      "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200",
    pm_watcher: "bg-muted text-muted-foreground",
    operator:
      "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200",
    client:
      "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-200",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${badgeStyles[capacity]}`}
    >
      <Icon className="h-3 w-3" />
      <span>{t(capacityKeyMap[capacity])}</span>
    </span>
  );
}
