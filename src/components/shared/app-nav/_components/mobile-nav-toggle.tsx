"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Menu, X } from "lucide-react";
import type { AppRole, Profile } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { NotificationBadge } from "./notification-badge";
import { SignOutButton } from "./sign-out-button";
import { LanguageSwitcher } from "@/components/shared/language-switcher/language-switcher";
import { ThemeToggle } from "@/components/shared/theme/theme-toggle";

interface MobileNavToggleProps {
  role: AppRole;
  profile: Profile;
  unreadCount: number;
}

export function MobileNavToggle({
  role,
  profile,
  unreadCount,
}: MobileNavToggleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
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

  return (
    <div className="md:hidden">
      <Button
        ref={toggleRef}
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls="mobile-nav-drawer"
        aria-label={isOpen ? t("closeMenu") : t("openMenu")}
        className="h-9 w-9"
      >
        {isOpen ? (
          <X className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Menu className="h-5 w-5" aria-hidden="true" />
        )}
      </Button>

      {isOpen && (
        <div
          id="mobile-nav-drawer"
          ref={drawerRef}
          className="fixed inset-x-0 top-16 z-50 bg-background border-b border-border p-4 shadow-lg flex flex-col gap-4"
        >
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <p className="font-semibold text-foreground">
                {profile.full_name}
              </p>
              <p className="text-xs text-muted-foreground capitalize">
                {t(`currentUser.role.${role}` as const)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <LanguageSwitcher />
              <ThemeToggle />
              <NotificationBadge count={unreadCount} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Link
              href={roleHomePath}
              onClick={() => setIsOpen(false)}
              className="px-3 py-2 rounded-md font-medium text-foreground hover:bg-muted transition-colors"
            >
              {t("links.home")}
            </Link>

            {role === "admin" || role === "pm" || role === "operator" ? (
              <Link
                href={secondaryNavigationItem.href}
                onClick={() => setIsOpen(false)}
                className="px-3 py-2 rounded-md font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                {secondaryNavigationItem.label}
              </Link>
            ) : (
              <a
                href={secondaryNavigationItem.href}
                aria-disabled="true"
                tabIndex={-1}
                className="px-3 py-2 rounded-md font-medium text-muted-foreground cursor-not-allowed opacity-60"
              >
                {secondaryNavigationItem.label}
              </a>
            )}
          </div>

          <div className="pt-2 border-t border-border">
            <SignOutButton className="w-full justify-center py-2 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-md" />
          </div>
        </div>
      )}
    </div>
  );
}
