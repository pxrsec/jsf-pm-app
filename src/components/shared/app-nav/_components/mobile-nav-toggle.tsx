"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import {
  Menu,
  X,
  House,
  FolderKanban,
  CalendarCheck,
  CalendarDays,
  SlidersHorizontal,
  Bell,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AppRole, Profile } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { NotificationBadge } from "./notification-badge";
import { SignOutButton } from "./sign-out-button";
import { LanguageSwitcher } from "@/components/shared/language-switcher/language-switcher";
import { ThemeToggle } from "@/components/shared/theme/theme-toggle";
import type {
  AppNavigationItem,
  AppNavigationItemKey,
} from "../navigation-model";
import { cn } from "@/lib/utils";

export interface MobileNavToggleProps {
  items: AppNavigationItem[];
  quickAccessItems: AppNavigationItem[];
  role: AppRole;
  profile: Profile;
}

function requireNavigationItem(
  items: AppNavigationItem[],
  key: AppNavigationItemKey,
): AppNavigationItem {
  const item = items.find((candidate) => candidate.key === key);
  if (!item) {
    throw new Error(
      `Mobile navigation invariant failed: missing authorized "${key}" item.`,
    );
  }
  return item;
}

function isNavigationItemActive(item: AppNavigationItem, pathname: string) {
  return item.key === "home"
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

const QUICK_ACCESS_ICON_MAP: Record<
  "home" | "projects" | "agenda" | "calendar" | "operations",
  LucideIcon
> = {
  home: House,
  projects: FolderKanban,
  agenda: CalendarCheck,
  calendar: CalendarDays,
  operations: SlidersHorizontal,
};

export function MobileNavToggle({
  items,
  quickAccessItems,
  role,
  profile,
}: MobileNavToggleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const t = useTranslations("shell.nav");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        toggleRef.current?.focus();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const notificationsItem = requireNavigationItem(items, "notifications");
  const unreadCount = notificationsItem.unreadCount ?? 0;
  const isNotificationsActive = isNavigationItemActive(
    notificationsItem,
    pathname,
  );

  return (
    <div
      className="md:hidden"
      style={
        {
          "--mobile-bottom-navigation-row-height": "4rem",
        } as React.CSSProperties
      }
    >
      {/* Structurally scroll-safe full menu panel */}
      {isOpen && (
        <nav
          id="mobile-nav-drawer"
          aria-label={t("fullMenuAriaLabel")}
          className="fixed inset-x-0 top-16 bottom-[calc(var(--mobile-bottom-navigation-row-height)+env(safe-area-inset-bottom,0px))] z-40 flex flex-col overflow-hidden border-b border-border bg-background shadow-lg md:hidden"
        >
          {/* 1. Header identity & utilities: shrink-0 */}
          <div className="shrink-0 border-b border-border p-4 flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <p className="font-semibold text-foreground truncate">
                {profile.full_name}
              </p>
              <p className="text-xs text-muted-foreground capitalize">
                {t(`currentUser.role.${role}` as const)}
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-3">
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </div>

          {/* 2. Scrollable authorized links: min-h-0 flex-1 overflow-x-hidden overflow-y-auto (Text-first structure) */}
          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4 flex flex-col gap-2">
            {items.map((item) => {
              const isActive = isNavigationItemActive(item, pathname);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  aria-label={item.ariaLabel}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex min-h-[44px] items-center justify-between rounded-md px-3 py-2 font-medium transition-colors",
                    isActive
                      ? "border-l-2 border-primary bg-primary/10 font-semibold text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <span className="min-w-0 truncate">{item.label}</span>
                  {item.unreadCount !== undefined && (
                    <NotificationBadge count={item.unreadCount} />
                  )}
                </Link>
              );
            })}
            {/* Exactly one polite unread live announcement */}
            <span className="sr-only" role="status" aria-live="polite">
              {`${t("notifications.badgeLabel")}: ${unreadCount}`}
            </span>
          </div>

          {/* 3. Footer sign-out: shrink-0 */}
          <div className="shrink-0 border-t border-border p-4">
            <SignOutButton className="w-full justify-center py-2 min-h-[44px] text-sm font-medium text-destructive hover:bg-destructive/10 rounded-md" />
          </div>
        </nav>
      )}

      {/* Persistent Bottom Quick-Access Bar */}
      <nav
        aria-label={t("mobileQuickAccessAriaLabel")}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom,0px)] md:hidden"
      >
        <div className="grid h-16 grid-cols-5">
          {/* Quick Links (1 to 3) */}
          {quickAccessItems.map((item) => {
            const Icon =
              QUICK_ACCESS_ICON_MAP[
                item.key as keyof typeof QUICK_ACCESS_ICON_MAP
              ];
            const isActive = isNavigationItemActive(item, pathname);
            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => setIsOpen(false)}
                aria-label={item.ariaLabel}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex h-full w-full min-h-[44px] min-w-[44px] min-w-0 flex-col items-center justify-center gap-1 px-1 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isActive
                    ? "border-t-2 border-primary bg-primary/5 font-semibold text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {Icon && (
                  <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                )}
                <span className="block max-w-full truncate whitespace-nowrap text-[10px] leading-tight font-medium">
                  {item.label}
                </span>
              </Link>
            );
          })}

          {/* Notifications Link (4) */}
          <Link
            href={notificationsItem.href}
            onClick={() => setIsOpen(false)}
            aria-label={notificationsItem.ariaLabel}
            aria-current={isNotificationsActive ? "page" : undefined}
            className={cn(
              "relative flex h-full w-full min-h-[44px] min-w-[44px] min-w-0 flex-col items-center justify-center gap-1 px-1 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isNotificationsActive
                ? "border-t-2 border-primary bg-primary/5 font-semibold text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <div className="relative">
              <Bell className="h-5 w-5 shrink-0" aria-hidden="true" />
              <NotificationBadge
                count={unreadCount}
                className="pointer-events-none absolute -right-1 -top-1 z-10"
              />
            </div>
            <span className="block max-w-full truncate whitespace-nowrap text-[10px] leading-tight font-medium">
              {notificationsItem.label}
            </span>
          </Link>

          {/* Menu Button (5) */}
          <Button
            ref={toggleRef}
            type="button"
            variant="ghost"
            onClick={() => setIsOpen(!isOpen)}
            aria-expanded={isOpen}
            aria-controls="mobile-nav-drawer"
            aria-label={isOpen ? t("closeMenu") : t("openMenu")}
            className="h-full w-full min-h-[44px] min-w-[44px] min-w-0 flex-col gap-1 rounded-none px-1"
          >
            {isOpen ? (
              <X className="h-5 w-5 shrink-0" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5 shrink-0" aria-hidden="true" />
            )}
            <span className="block max-w-full truncate whitespace-nowrap text-[10px] leading-tight font-medium">
              {t("menu")}
            </span>
          </Button>
        </div>
      </nav>
    </div>
  );
}
