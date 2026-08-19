"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Sun, Moon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const subscribe = () => () => {};

/**
 * ThemeToggle — accessible theme selector for authenticated navigation.
 *
 * Accessibility contract:
 * - aria-label describes the NEXT ACTION (what happens on click).
 * - aria-pressed reflects boolean dark state.
 * - Icons are aria-hidden (accessible text in aria-label / sr-only).
 * - Dropdown items have aria-current marking the active selection.
 * - Fully keyboard-operable via Base UI Menu.
 * - Icon + visible text per item (not color or icon shape alone).
 * - Mounted guard prevents hydration mismatch between SSR light default and stored client theme.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const t = useTranslations("theme");
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  const isDark = mounted && theme === "dark";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={isDark ? t("switchToLight") : t("switchToDark")}
        aria-pressed={isDark}
        className="inline-flex shrink-0 items-center justify-center rounded-md border border-transparent text-xs font-medium transition-colors outline-none hover:bg-muted hover:text-foreground h-9 w-9 cursor-pointer"
        id="theme-toggle"
      >
        {isDark ? (
          <Moon className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Sun className="h-4 w-4" aria-hidden="true" />
        )}
        <span className="sr-only">
          {isDark ? t("currentDark") : t("currentLight")}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          aria-current={mounted && theme === "light" ? "true" : undefined}
        >
          <Sun className="mr-2 h-4 w-4" aria-hidden="true" />
          {t("light")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          aria-current={mounted && theme === "dark" ? "true" : undefined}
        >
          <Moon className="mr-2 h-4 w-4" aria-hidden="true" />
          {t("dark")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
