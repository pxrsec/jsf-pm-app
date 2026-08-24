import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import type { SessionContext } from "@/lib/auth/session";
import { SignOutButton } from "./_components/sign-out-button";
import { NotificationBadge } from "./_components/notification-badge";
import { MobileNavToggle } from "./_components/mobile-nav-toggle";
import { LanguageSwitcher } from "@/components/shared/language-switcher/language-switcher";
import { ThemeToggle } from "@/components/shared/theme/theme-toggle";

interface AppNavProps {
  session: SessionContext;
  unreadCount: number;
  canAccessNotificationOperations: boolean;
}

export async function AppNav({
  session,
  unreadCount,
  canAccessNotificationOperations,
}: AppNavProps) {
  const t = await getTranslations("shell.nav");
  const brandT = await getTranslations("shell.brand");
  const { role, profile } = session;

  const roleHomePath =
    role === "admin"
      ? "/admin"
      : role === "pm"
        ? "/pm"
        : role === "operator"
          ? "/operador"
          : "/cliente";

  const secondaryNavigationItem =
    role === "admin"
      ? { href: "/admin/proyectos", label: t("links.projects") }
      : role === "pm"
        ? { href: "/pm/proyectos", label: t("links.projects") }
        : role === "operator"
          ? { href: "/operador/agenda", label: t("links.agenda") }
          : { href: "/cliente/proyectos", label: t("links.projects") };

  const inboxAriaLabel =
    unreadCount > 0
      ? t("notifications.inboxLinkAriaWithCount", { count: unreadCount })
      : t("notifications.inboxLinkAria");

  const operationsHref =
    canAccessNotificationOperations && (role === "admin" || role === "pm")
      ? role === "admin"
        ? "/admin/notificaciones"
        : "/pm/notificaciones"
      : null;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link
            href={roleHomePath}
            className="flex items-center gap-2 font-bold tracking-tight text-foreground"
          >
            <Image
              src="/joya-icon.svg"
              alt="Joya"
              width={32}
              height={32}
              className="h-8 w-8 rounded-lg"
            />
            <span className="text-lg">{brandT("name")}</span>
          </Link>

          <nav
            aria-label={t("ariaLabel")}
            className="hidden md:flex md:items-center md:gap-4"
          >
            <Link
              href={roleHomePath}
              className="text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              {t("links.home")}
            </Link>

            <Link
              href={secondaryNavigationItem.href}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {secondaryNavigationItem.label}
            </Link>

            <Link
              href="/calendario"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("links.calendar")}
            </Link>

            <Link
              href="/notificaciones"
              aria-label={inboxAriaLabel}
              className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>{t("links.notifications")}</span>
              <NotificationBadge count={unreadCount} />
            </Link>

            <span className="sr-only" role="status" aria-live="polite">
              {`${t("notifications.badgeLabel")}: ${unreadCount}`}
            </span>

            {operationsHref && (
              <Link
                href={operationsHref}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("links.notificationOperations")}
              </Link>
            )}
          </nav>
        </div>

        <div className="hidden md:flex md:items-center md:gap-4">
          <LanguageSwitcher />
          <ThemeToggle />

          <div className="text-right">
            <p className="text-sm font-semibold text-foreground">
              {profile.full_name}
            </p>
            <p className="text-xs text-muted-foreground capitalize">
              {t(`currentUser.role.${role}` as const)}
            </p>
          </div>

          <SignOutButton />
        </div>

        <MobileNavToggle
          role={role}
          profile={profile}
          unreadCount={unreadCount}
          canAccessNotificationOperations={canAccessNotificationOperations}
        />
      </div>
    </header>
  );
}
