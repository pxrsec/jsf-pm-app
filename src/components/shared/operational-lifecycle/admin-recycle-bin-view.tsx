"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecycleBinView } from "./recycle-bin-view";
import { AdminPermanentDeleteDialog } from "./admin-permanent-delete-dialog";
import type {
  AvailableResult,
  OperationalRecycleBinItem,
} from "@/lib/operational-lifecycle/types";

interface AdminRecycleBinViewProps {
  initialResult: AvailableResult<OperationalRecycleBinItem[]>;
}

export function AdminRecycleBinView({
  initialResult,
}: AdminRecycleBinViewProps) {
  const t = useTranslations("operationalLifecycle.recycleBin");
  const tEntities = useTranslations(
    "operationalLifecycle.recycleBin.entityTypes",
  );
  const [selectedTarget, setSelectedTarget] =
    useState<OperationalRecycleBinItem | null>(null);

  return (
    <>
      <RecycleBinView
        initialResult={initialResult}
        renderRowAction={(item) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedTarget(item)}
            className="h-8 md:h-8 min-h-[44px] md:min-h-0 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 px-2.5 cursor-pointer"
            aria-label={t("permanentDeleteAriaLabel", {
              type: tEntities(item.entityType),
              title: item.title,
            })}
          >
            <Trash2 className="size-3.5" />
            <span className="hidden sm:inline">
              {t("permanentDeleteAction")}
            </span>
          </Button>
        )}
      />

      <AdminPermanentDeleteDialog
        target={selectedTarget}
        isOpen={Boolean(selectedTarget)}
        onClose={() => setSelectedTarget(null)}
        onSuccess={() => setSelectedTarget(null)}
      />
    </>
  );
}
