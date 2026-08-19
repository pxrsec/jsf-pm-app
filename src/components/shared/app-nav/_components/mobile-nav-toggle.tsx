"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { AppRole, Profile } from "@/lib/auth/session";
import { NotificationBadge } from "./notification-badge";
import { SignOutButton } from "./sign-out-button";
import { LanguageSwitcher } from "@/components/shared/language-switcher/language-switcher";

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

  const roleSecondaryStub =
    role === "admin"
      ? { href: "/admin/proyectos", label: t("links.projects") }
      : role === "pm"
        ? { href: "/pm/proyectos", label: t("links.projects") }
        : role === "operator"
          ? { href: "/operador/agenda", label: t("links.agenda") }
          : { href: "/cliente/proyectos", label: t("links.projects") };

  return (
    <div className="md:hidden">
      <button
        ref={toggleRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls="mobile-nav-drawer"
        aria-label={isOpen ? "Cerrar menú" : "Abrir menú"}
        className="p-2 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
      >
        <span className="sr-only">Toggle navigation</span>
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {isOpen ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          )}
        </svg>
      </button>

      {isOpen && (
        <div
          id="mobile-nav-drawer"
          ref={drawerRef}
          className="fixed inset-x-0 top-16 z-50 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 p-4 shadow-lg flex flex-col gap-4"
        >
          <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
            <div>
              <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                {profile.full_name}
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 capitalize">
                {t(`currentUser.role.${role}` as const)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <LanguageSwitcher />
              <NotificationBadge count={unreadCount} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Link
              href={roleHomePath}
              onClick={() => setIsOpen(false)}
              aria-current="page"
              className="px-3 py-2 rounded-md font-medium text-neutral-900 dark:text-white bg-neutral-100 dark:bg-neutral-800"
            >
              {t("links.home")}
            </Link>

            <a
              href={roleSecondaryStub.href}
              aria-disabled="true"
              tabIndex={-1}
              className="px-3 py-2 rounded-md font-medium text-neutral-400 dark:text-neutral-500 cursor-not-allowed opacity-60"
            >
              {roleSecondaryStub.label}
            </a>
          </div>

          <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <SignOutButton className="w-full justify-center py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md" />
          </div>
        </div>
      )}
    </div>
  );
}
