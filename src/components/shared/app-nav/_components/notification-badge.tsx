import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface NotificationBadgeProps {
  count: number;
  className?: string;
}

export function NotificationBadge({
  count,
  className,
}: NotificationBadgeProps) {
  const t = useTranslations("shell.nav.notifications");

  if (count <= 0) {
    return null;
  }

  const displayCount = count > 99 ? t("badgeOverflow") : count.toString();
  const baseClassName =
    "inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-destructive-foreground bg-destructive rounded-full shadow-sm";

  return (
    <span aria-hidden="true" className={cn(baseClassName, className)}>
      {displayCount}
    </span>
  );
}
