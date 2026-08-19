import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { SessionContext } from "@/lib/auth/session";
import { SignOutButton } from "./_components/sign-out-button";
import { NotificationBadge } from "./_components/notification-badge";
import { MobileNavToggle } from "./_components/mobile-nav-toggle";
import { LanguageSwitcher } from "@/components/shared/language-switcher/language-switcher";

interface AppNavProps {
  session: SessionContext;
  unreadCount: number;
}

export async function AppNav({ session, unreadCount }: AppNavProps) {
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

  const roleSecondaryStub =
    role === "admin"
      ? { href: "/admin/proyectos", label: t("links.projects") }
      : role === "pm"
        ? { href: "/pm/proyectos", label: t("links.projects") }
        : role === "operator"
          ? { href: "/operador/agenda", label: t("links.agenda") }
          : { href: "/cliente/proyectos", label: t("links.projects") };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-200 bg-white/95 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link
            href={roleHomePath}
            className="flex items-center gap-2 font-bold tracking-tight text-neutral-900 dark:text-white"
          >
            <span className="h-8 w-8 rounded-lg bg-amber-500 flex items-center justify-center text-white font-black text-lg">
              J
            </span>
            <span className="text-lg">{brandT("name")}</span>
          </Link>

          <nav
            aria-label={t("ariaLabel")}
            className="hidden md:flex md:items-center md:gap-4"
          >
            <Link
              href={roleHomePath}
              aria-current="page"
              className="text-sm font-medium text-neutral-900 hover:text-amber-600 dark:text-neutral-100 dark:hover:text-amber-400 transition-colors"
            >
              {t("links.home")}
            </Link>

            <a
              href={roleSecondaryStub.href}
              aria-disabled="true"
              tabIndex={-1}
              className="text-sm font-medium text-neutral-400 dark:text-neutral-500 cursor-not-allowed opacity-60"
            >
              {roleSecondaryStub.label}
            </a>
          </nav>
        </div>

        <div className="hidden md:flex md:items-center md:gap-4">
          <LanguageSwitcher />

          <div className="flex items-center gap-2">
            <NotificationBadge count={unreadCount} />
          </div>

          <div className="text-right">
            <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
              {profile.full_name}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 capitalize">
              {t(`currentUser.role.${role}` as const)}
            </p>
          </div>

          <SignOutButton />
        </div>

        <MobileNavToggle
          role={role}
          profile={profile}
          unreadCount={unreadCount}
        />
      </div>
    </header>
  );
}
