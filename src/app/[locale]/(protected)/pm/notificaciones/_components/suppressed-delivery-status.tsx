import { useTranslations, useFormatter } from "next-intl";
import {
  ShieldAlert,
  Mail,
  MessageCircle,
  Users,
  Folder,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { resolveNotificationCategory } from "@/app/[locale]/(protected)/notificaciones/_components/types";
import type { SuppressedNotificationOperation } from "@/lib/notifications/operations-contracts";

type SuppressedDeliveryStatusProps = {
  operation: SuppressedNotificationOperation;
};

export function SuppressedDeliveryStatus({
  operation,
}: SuppressedDeliveryStatusProps) {
  const t = useTranslations("notificationOperations");
  const tNotif = useTranslations("notifications");
  const format = useFormatter();

  const categoryKey = resolveNotificationCategory(operation.trigger);
  const categoryTitle = tNotif(`categories.${categoryKey}.title`);

  const channelLabel =
    operation.channel === "whatsapp"
      ? t("channels.whatsapp")
      : t("channels.email");

  const channelIcon =
    operation.channel === "whatsapp" ? (
      <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
    ) : (
      <Mail className="w-3.5 h-3.5" aria-hidden="true" />
    );

  const formattedFirstCreatedAt = format.dateTime(
    new Date(operation.firstCreatedAt),
    {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  );

  const formattedLastSuppressedAt = format.dateTime(
    new Date(operation.lastSuppressedAt),
    {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  );

  return (
    <li className="p-5 rounded-lg border border-border bg-card text-card-foreground shadow-xs transition-colors space-y-3">
      {/* Header: Terminal Status, Channel, Category & Reason */}
      <div className="flex flex-wrap items-center gap-2">
        {/* 1. Terminal Status Indicator */}
        <Badge
          variant="destructive"
          className="inline-flex items-center gap-1 font-semibold px-2 py-0.5"
        >
          <ShieldAlert className="w-3 h-3" aria-hidden="true" />
          <span>{t("status.suppressed")}</span>
        </Badge>

        {/* 2. Channel Label */}
        <Badge
          variant="secondary"
          className="inline-flex items-center gap-1 px-2 py-0.5"
        >
          {channelIcon}
          <span>{channelLabel}</span>
        </Badge>

        {/* 3. Safe Event Category */}
        <Badge variant="outline" className="px-2 py-0.5 font-medium">
          {categoryTitle}
        </Badge>

        {/* 4. Controlled Reason */}
        <Badge
          variant="outline"
          className="px-2 py-0.5 text-muted-foreground border-dashed"
        >
          {t("reasons.providerDisabled")}
        </Badge>
      </div>

      {/* 5. Dedicated Localized Explanatory Sentence */}
      <p className="text-sm text-foreground/90 font-normal leading-relaxed">
        {t("terminalExplanation")}
      </p>

      {/* Details Row: Recipient Count & Project Context */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {/* 6. Aggregate Recipient Count */}
        <div className="inline-flex items-center gap-1">
          <Users className="w-3.5 h-3.5" aria-hidden="true" />
          <span>
            {t("recipientCount", { count: operation.recipientCount })}
          </span>
        </div>

        {/* 7. Safe Project Context */}
        <div className="inline-flex items-center gap-1">
          <Folder className="w-3.5 h-3.5" aria-hidden="true" />
          <span>
            {operation.projectName
              ? t("projectContext", { project: operation.projectName })
              : t("noProjectContext")}
          </span>
        </div>
      </div>

      {/* 8. Timestamps Row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 border-t border-border/40 text-xs text-muted-foreground">
        <div className="inline-flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{t("firstCreatedAt")}</span>
          <time dateTime={operation.firstCreatedAt} className="font-medium">
            {formattedFirstCreatedAt}
          </time>
        </div>

        <div className="inline-flex items-center gap-1">
          <span>•</span>
          <span>{t("lastSuppressedAt")}</span>
          <time dateTime={operation.lastSuppressedAt} className="font-medium">
            {formattedLastSuppressedAt}
          </time>
        </div>
      </div>
    </li>
  );
}
