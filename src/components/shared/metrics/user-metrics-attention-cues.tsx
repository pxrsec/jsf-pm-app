import { useTranslations } from "next-intl";
import { Info, Clock, Bell } from "lucide-react";

export function UserMetricsAttentionCues() {
  const t = useTranslations("metrics.userAudit.cues");

  return (
    <div className="rounded-xl border border-border/80 bg-muted/30 p-4 space-y-3">
      <div className="flex items-start gap-2.5">
        <Info
          className="h-4 w-4 text-primary shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <div className="space-y-1">
          <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            {t("title")}
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t("description")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-card/60 p-3">
          <Clock
            className="h-4 w-4 text-amber-500 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="space-y-0.5">
            <span className="text-xs font-medium text-foreground">
              {t("unstartedTitle")}
            </span>
            <p className="text-xs text-muted-foreground">
              {t("unstartedDescription")}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-card/60 p-3">
          <Bell
            className="h-4 w-4 text-amber-500 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="space-y-0.5">
            <span className="text-xs font-medium text-foreground">
              {t("unreadTitle")}
            </span>
            <p className="text-xs text-muted-foreground">
              {t("unreadDescription")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
