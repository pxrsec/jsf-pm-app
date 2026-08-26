import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession, AuthError } from "@/lib/auth/session";
import {
  ROLE_DEFAULT_PATHS,
  SHARED_AUTHENTICATED_PATH_PREFIXES,
} from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";
import { getUnreadNotificationCount } from "@/lib/shell-data/shell-queries";
import { hasActivePmLeadMembership } from "@/lib/notifications/operations-authorization";
import { AppNav } from "@/components/shared/app-nav/app-nav";
import { DesktopNavigationShell } from "@/components/shared/app-nav/_components/desktop-navigation-shell";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();

  let session;
  try {
    session = await requireSession(cookieStore);
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.code === "UNAUTHENTICATED") {
        redirect("/iniciar-sesion");
      }
      if (error.code === "INACTIVE_OR_MISSING_PROFILE") {
        redirect("/sesion-expirada?reason=inactive");
      }
    }
    throw error;
  }

  const rolePath = ROLE_DEFAULT_PATHS[session.role];
  if (!rolePath) {
    redirect("/iniciar-sesion");
  }

  const headersList = await headers().catch(() => null);
  const rawPathname = headersList?.get
    ? headersList.get("x-pathname") ||
      headersList.get("x-invoke-path") ||
      headersList.get("x-url") ||
      ""
    : "";
  const isEnglish = rawPathname.startsWith("/en/") || rawPathname === "/en";
  const prefix = isEnglish ? "/en" : "";
  const pathname = rawPathname.replace(/^\/en/, "");

  const isSharedAuthenticated = SHARED_AUTHENTICATED_PATH_PREFIXES.some(
    (sharedPrefix) =>
      pathname === sharedPrefix || pathname.startsWith(`${sharedPrefix}/`),
  );

  if (pathname && !isSharedAuthenticated && !pathname.startsWith(rolePath)) {
    redirect(`${prefix}${rolePath}`);
  }

  const supabase = createClient(cookieStore);
  const unreadCount = await getUnreadNotificationCount(
    supabase,
    session.user.id,
  );

  let canAccessNotificationOperations = false;
  if (session.role === "admin") {
    canAccessNotificationOperations = true;
  } else if (session.role === "pm") {
    try {
      canAccessNotificationOperations = await hasActivePmLeadMembership(
        supabase,
        session.user.id,
      );
    } catch {
      canAccessNotificationOperations = false;
    }
  }

  return (
    <DesktopNavigationShell>
      <AppNav
        session={session}
        unreadCount={unreadCount}
        canAccessNotificationOperations={canAccessNotificationOperations}
      />
      <main
        id="main-content"
        tabIndex={-1}
        className="box-border w-full min-w-0 flex-1 pb-[calc(4rem+env(safe-area-inset-bottom,0px))] transition-[padding-left] duration-200 ease-out motion-reduce:transition-none md:pb-0 md:pl-[var(--desktop-navigation-width)]"
      >
        {children}
      </main>
    </DesktopNavigationShell>
  );
}
