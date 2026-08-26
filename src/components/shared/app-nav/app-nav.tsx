import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import type { SessionContext } from "@/lib/auth/session";
import { SignOutButton } from "./_components/sign-out-button";
import { MobileNavToggle } from "./_components/mobile-nav-toggle";
import { DesktopNavDrawer } from "./_components/desktop-nav-drawer";
import { LanguageSwitcher } from "@/components/shared/language-switcher/language-switcher";
import { ThemeToggle } from "@/components/shared/theme/theme-toggle";
import {
  buildNavigationModel,
  buildMobileQuickAccessItems,
} from "./navigation-model";

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

  const items = buildNavigationModel({
    role,
    unreadCount,
    canAccessNotificationOperations,
    t,
  });

  const quickAccessItems = buildMobileQuickAccessItems({
    items,
    role,
  });

  const roleHomePath =
    items.find((item) => item.key === "home")?.href ??
    (role === "admin"
      ? "/admin"
      : role === "pm"
        ? "/pm"
        : role === "operator"
          ? "/operador"
          : "/cliente");

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center min-w-0">
            <Link
              href={roleHomePath}
              className="flex items-center gap-2 font-bold tracking-tight text-foreground shrink-0"
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
          </div>

          <div className="hidden md:flex md:items-center md:gap-4 min-w-0">
            <LanguageSwitcher />
            <ThemeToggle />

            <div className="min-w-0 text-right">
              <p className="text-sm font-semibold text-foreground truncate">
                {profile.full_name}
              </p>
              <p className="text-xs text-muted-foreground capitalize">
                {t(`currentUser.role.${role}` as const)}
              </p>
            </div>

            <SignOutButton />
          </div>
        </div>
      </header>

      <MobileNavToggle
        items={items}
        quickAccessItems={quickAccessItems}
        role={role}
        profile={profile}
      />

      <DesktopNavDrawer
        items={items}
        profile={profile}
        roleLabel={t(`currentUser.role.${role}` as const)}
        navAriaLabel={t("ariaLabel")}
        collapseNavigationLabel={t("collapse")}
        expandNavigationLabel={t("expand")}
        signOutLabel={t("signOut")}
        unreadCountAnnouncement={`${t("notifications.badgeLabel")}: ${unreadCount}`}
      />
    </>
  );
}
