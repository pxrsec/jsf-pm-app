import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession, AuthError } from "@/lib/auth/session";
import { ROLE_DEFAULT_PATHS } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";
import { getUnreadNotificationCount } from "@/lib/shell-data/shell-queries";
import { AppNav } from "@/components/shared/app-nav/app-nav";

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

  if (pathname && !pathname.startsWith(rolePath)) {
    redirect(`${prefix}${rolePath}`);
  }

  const supabase = createClient(cookieStore);
  const unreadCount = await getUnreadNotificationCount(
    supabase,
    session.user.id,
  );

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
      <AppNav session={session} unreadCount={unreadCount} />
      <main id="main-content" tabIndex={-1} className="flex-1">
        {children}
      </main>
    </div>
  );
}
