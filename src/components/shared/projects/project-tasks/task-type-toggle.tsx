"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TaskTypeToggleProps {
  selectedType: "internal_work" | "client_request";
  isInternalProject: boolean;
  onSelectType: (type: "internal_work" | "client_request") => void;
  disabled?: boolean;
}

export function TaskTypeToggle({
  selectedType,
  isInternalProject,
  onSelectType,
  disabled = false,
}: TaskTypeToggleProps) {
  const t = useTranslations("projects.tasks.create");
  const tType = useTranslations("projects.tasks.taskType");

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium">{t("typeLabel")}</Label>
      <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg">
        <Button
          type="button"
          variant={selectedType === "internal_work" ? "default" : "ghost"}
          size="sm"
          className="text-xs h-8"
          disabled={disabled}
          onClick={() => onSelectType("internal_work")}
        >
          {tType("internalWork")}
        </Button>

        {isInternalProject ? (
          <Tooltip>
            <TooltipTrigger
              type="button"
              disabled
              className="text-xs h-8 w-full opacity-50 cursor-not-allowed inline-flex items-center justify-center rounded-md font-medium"
            >
              {tType("clientRequest")}
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">
                {tType("clientRequestOnlyForClientProjects")}
              </p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <Button
            type="button"
            variant={selectedType === "client_request" ? "default" : "ghost"}
            size="sm"
            className="text-xs h-8"
            disabled={disabled}
            onClick={() => onSelectType("client_request")}
          >
            {tType("clientRequest")}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {selectedType === "internal_work"
          ? tType("internalDescription")
          : tType("clientRequestDescription")}
      </p>
    </div>
  );
}
