import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getOptionalSession } from "@/lib/auth/session";
import { ROLE_DEFAULT_PATHS } from "@/lib/auth/routes";

export default async function HomePage() {
  const cookieStore = await cookies();
  const session = await getOptionalSession(cookieStore);
  const headersList = await headers().catch(() => null);
  const rawPathname = headersList?.get
    ? headersList.get("x-pathname") ||
      headersList.get("x-invoke-path") ||
      headersList.get("x-url") ||
      ""
    : "";
  const isEnglish = rawPathname.startsWith("/en/") || rawPathname === "/en";
  const prefix = isEnglish ? "/en" : "";

  if (!session) {
    redirect(`${prefix}/iniciar-sesion`);
  }

  const rolePath = ROLE_DEFAULT_PATHS[session.role] ?? "/iniciar-sesion";
  redirect(`${prefix}${rolePath}`);
}
