"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes";

// Suppress React 19 false-positive dev warning for next-themes SSR inline anti-FOUC script tag
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const origConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes(
        "Encountered a script tag while rendering React component",
      )
    ) {
      return;
    }
    origConsoleError.apply(console, args);
  };
}

/**
 * ThemeProvider — wraps next-themes for class-based light/dark mode.
 *
 * Contract:
 * - attribute="class": shadcn/ui uses .dark class on <html> to switch CSS vars.
 * - defaultTheme="light": first-time visitors see light mode.
 * - enableSystem={false}: OS preference does NOT override the light default.
 * - storageKey="jsf-pm-theme": stable project-specific localStorage key.
 * - disableTransitionOnChange: suppresses page-wide flash during theme switch.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      storageKey="jsf-pm-theme"
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
