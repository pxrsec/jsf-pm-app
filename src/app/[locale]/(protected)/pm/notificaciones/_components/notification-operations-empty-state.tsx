import { useTranslations } from "next-intl";
import { Inbox } from "lucide-react";

export function NotificationOperationsEmptyState() {
  const t = useTranslations("notificationOperations");

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center rounded-lg border border-dashed border-border bg-card/50 text-card-foreground">
      <div className="p-3 rounded-full bg-muted text-muted-foreground mb-4">
        <Inbox className="w-6 h-6" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-foreground">
        {t("empty.title")}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-sm">
        {t("empty.description")}
      </p>
    </div>
  );
}
