"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { MilestoneOptionDto } from "@/lib/calendar/types";

interface TaskMilestoneSelectorProps {
  milestones: readonly MilestoneOptionDto[];
  selectedIds: readonly string[];
  disabled: boolean;
  onChange: (milestoneIds: string[]) => void;
}

export function TaskMilestoneSelector({
  milestones,
  selectedIds,
  disabled,
  onChange,
}: TaskMilestoneSelectorProps) {
  const t = useTranslations("projects.tasks.create");

  const toggle = (milestoneId: string) => {
    onChange(
      selectedIds.includes(milestoneId)
        ? selectedIds.filter((id) => id !== milestoneId)
        : [...selectedIds, milestoneId],
    );
  };

  return (
    <section
      className="space-y-2 border-t border-border/60 pt-4"
      aria-labelledby="task-goals-heading"
    >
      <div className="space-y-1">
        <h4
          id="task-goals-heading"
          className="text-xs font-semibold text-foreground"
        >
          {t("goalsLabel")}
        </h4>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t("goalsHint")}
        </p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2" aria-label={t("goalsLabel")}>
        {milestones.map((milestone) => {
          const selected = selectedIds.includes(milestone.milestoneId);
          return (
            <li key={milestone.milestoneId}>
              <label
                className={cn(
                  "flex min-h-11 cursor-pointer items-start gap-3 rounded-md border p-3 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                  selected
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:bg-muted/50",
                  disabled && "cursor-not-allowed opacity-50",
                )}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  disabled={disabled}
                  onChange={() => toggle(milestone.milestoneId)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border",
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background",
                  )}
                >
                  {selected && <Check className="size-3" />}
                </span>
                <span className="min-w-0">
                  <span className="block break-words font-medium text-foreground">
                    {milestone.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {milestone.scope === "company"
                      ? t("goalsCompanyScope")
                      : t("goalsProjectScope")}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
