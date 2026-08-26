"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from "react";

export type DesktopNavigationLayoutContextValue = {
  isDesktopNavigationExpanded: boolean;
  toggleDesktopNavigation: () => void;
};

const DesktopNavigationLayoutContext =
  createContext<DesktopNavigationLayoutContextValue | null>(null);

export function useDesktopNavigationLayout(): DesktopNavigationLayoutContextValue {
  const context = useContext(DesktopNavigationLayoutContext);
  if (!context) {
    throw new Error(
      "useDesktopNavigationLayout must be used within DesktopNavigationShell",
    );
  }
  return context;
}

type DesktopNavigationShellStyle = React.CSSProperties & {
  "--desktop-navigation-width": string;
};

export function DesktopNavigationShell({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [isDesktopNavigationExpanded, setIsDesktopNavigationExpanded] =
    useState(true);

  const toggleDesktopNavigation = useCallback(() => {
    setIsDesktopNavigationExpanded((current) => !current);
  }, []);

  const contextValue = useMemo(
    () => ({
      isDesktopNavigationExpanded,
      toggleDesktopNavigation,
    }),
    [isDesktopNavigationExpanded, toggleDesktopNavigation],
  );

  const shellStyle: DesktopNavigationShellStyle = {
    "--desktop-navigation-width": isDesktopNavigationExpanded
      ? "16rem"
      : "4rem",
  };

  return (
    <DesktopNavigationLayoutContext.Provider value={contextValue}>
      <div
        data-slot="desktop-navigation-shell"
        className="min-h-screen flex flex-col bg-background text-foreground"
        style={shellStyle}
      >
        {children}
      </div>
    </DesktopNavigationLayoutContext.Provider>
  );
}
