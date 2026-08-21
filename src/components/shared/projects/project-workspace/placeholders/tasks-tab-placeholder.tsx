"use client";

import { useTranslations } from "next-intl";
import { LayoutGrid } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

export function TasksTabPlaceholder() {
  const t = useTranslations("projects.workspace.placeholders");

  return (
    <div className="space-y-6">
      <Card className="border-dashed border-border bg-card/60">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-2">
            <LayoutGrid className="h-6 w-6" />
          </div>
          <CardTitle className="text-lg font-semibold">
            {t("tasksTitle")}
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm max-w-md mx-auto">
            {t("tasksDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 pb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto opacity-70">
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-center space-y-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Pendientes
              </span>
              <div className="h-16 rounded bg-card/80 border border-border/60 flex items-center justify-center text-xs text-muted-foreground">
                Vista previa Kanban
              </div>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-center space-y-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                En progreso
              </span>
              <div className="h-16 rounded bg-card/80 border border-border/60 flex items-center justify-center text-xs text-muted-foreground">
                Vista previa Kanban
              </div>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-center space-y-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Completadas
              </span>
              <div className="h-16 rounded bg-card/80 border border-border/60 flex items-center justify-center text-xs text-muted-foreground">
                Vista previa Kanban
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
