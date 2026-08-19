import { useTranslations } from "next-intl";

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
    return (
      <span
        className="sr-only"
        aria-live="polite"
        aria-label={`${t("badgeLabel")}: 0`}
      >
        0
      </span>
    );
  }

  const displayCount = count > 99 ? t("badgeOverflow") : count.toString();
  const accessibleLabel = `${t("badgeLabel")}: ${count}`;

  return (
    <span
      role="status"
      aria-label={accessibleLabel}
      className={
        className ??
        "inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-amber-600 rounded-full shadow-sm"
      }
    >
      {displayCount}
    </span>
  );
}
