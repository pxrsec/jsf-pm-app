"use client";

import { usePathname, Link } from "@/i18n/routing";
import {
  PanelLeftClose,
  PanelLeftOpen,
  House,
  FolderKanban,
  CalendarCheck,
  CalendarDays,
  Archive,
  Users,
  Link2,
  ChartNoAxesCombined,
  SlidersHorizontal,
  Bell,
  BellRing,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { NotificationBadge } from "./notification-badge";
import { SignOutButton } from "./sign-out-button";
import { useDesktopNavigationLayout } from "./desktop-navigation-shell";
import { cn } from "@/lib/utils";
import type {
  AppNavigationItem,
  AppNavigationItemKey,
} from "../navigation-model";
import type { Profile } from "@/lib/auth/session";

const ICON_MAP: Record<AppNavigationItemKey, LucideIcon> = {
  home: House,
  projects: FolderKanban,
  agenda: CalendarCheck,
  operatorProjects: FolderKanban,
  calendar: CalendarDays,
  archive: Archive,
  clients: Users,
  linkIncidents: Link2,
  metrics: ChartNoAxesCombined,
  operations: SlidersHorizontal,
  notifications: Bell,
  notificationOperations: BellRing,
};

export interface DesktopNavDrawerProps {
  items: AppNavigationItem[];
  profile: Profile;
  roleLabel: string;
  navAriaLabel: string;
  collapseNavigationLabel: string;
  expandNavigationLabel: string;
  signOutLabel: string;
  unreadCountAnnouncement: string;
}

export function DesktopNavDrawer({
  items,
  profile,
  roleLabel,
  navAriaLabel,
  collapseNavigationLabel,
  expandNavigationLabel,
  signOutLabel,
  unreadCountAnnouncement,
}: DesktopNavDrawerProps) {
  const { isDesktopNavigationExpanded, toggleDesktopNavigation } =
    useDesktopNavigationLayout();
  const pathname = usePathname();

  return (
    <TooltipProvider delay={200}>
      <nav
        aria-label={navAriaLabel}
        className={cn(
          "hidden md:flex fixed top-16 bottom-0 left-0 z-30 flex-col",
          "border-r border-border bg-background transition-[width] duration-200 ease-out motion-reduce:transition-none",
          "overflow-hidden",
          isDesktopNavigationExpanded ? "w-64" : "w-16",
        )}
      >
        {/* Collapse toggle button: shrink-0 */}
        <div
          className={cn(
            "shrink-0 p-2 flex items-center",
            isDesktopNavigationExpanded ? "justify-end" : "justify-center",
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggleDesktopNavigation}
            aria-expanded={isDesktopNavigationExpanded}
            aria-controls="desktop-nav-links"
            aria-label={
              isDesktopNavigationExpanded
                ? collapseNavigationLabel
                : expandNavigationLabel
            }
            className="h-11 w-11 min-h-[44px] min-w-[44px]"
          >
            {isDesktopNavigationExpanded ? (
              <PanelLeftClose className="h-5 w-5" aria-hidden="true" />
            ) : (
              <PanelLeftOpen className="h-5 w-5" aria-hidden="true" />
            )}
          </Button>
        </div>

        {/* Scrollable route links region */}
        <div
          id="desktop-nav-links"
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-2 flex flex-col gap-1"
        >
          {items.map((item) => {
            const Icon = ICON_MAP[item.key];
            const isActive =
              item.key === "home"
                ? pathname === item.href
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);

            if (isDesktopNavigationExpanded) {
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-label={item.ariaLabel}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex min-h-[44px] items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary font-semibold border-l-2 border-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span className="truncate flex-1">{item.label}</span>
                  {item.unreadCount !== undefined && (
                    <NotificationBadge count={item.unreadCount} />
                  )}
                </Link>
              );
            }

            return (
              <Tooltip key={item.key}>
                <TooltipTrigger
                  render={
                    <Link
                      href={item.href}
                      aria-label={item.ariaLabel}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "relative flex h-11 w-11 min-h-[44px] min-w-[44px] mx-auto items-center justify-center rounded-md transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary font-semibold border-l-2 border-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                      {item.unreadCount !== undefined &&
                        item.unreadCount > 0 && (
                          <NotificationBadge
                            count={item.unreadCount}
                            className="pointer-events-none absolute -right-0.5 -top-0.5 z-10 h-5 min-w-5 px-1 text-[10px] leading-none"
                          />
                        )}
                    </Link>
                  }
                />
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Pinned identity + second sign-out footer */}
        <div className="shrink-0 border-t border-border p-3 flex flex-col gap-3">
          {isDesktopNavigationExpanded && (
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">
                {profile.full_name}
              </p>
              <p className="text-xs text-muted-foreground capitalize">
                {roleLabel}
              </p>
            </div>
          )}
          {isDesktopNavigationExpanded ? (
            <SignOutButton className="w-full justify-center min-h-[44px] text-destructive hover:bg-destructive/10" />
          ) : (
            <Tooltip>
              <TooltipTrigger
                render={
                  <SignOutButton
                    iconOnly
                    className="h-11 w-11 min-h-[44px] min-w-[44px] text-destructive hover:bg-destructive/10 mx-auto"
                  />
                }
              />
              <TooltipContent side="right">{signOutLabel}</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Live unread announcement outside the links */}
        <span className="sr-only" role="status" aria-live="polite">
          {unreadCountAnnouncement}
        </span>
      </nav>
    </TooltipProvider>
  );
}
