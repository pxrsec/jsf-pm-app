import { type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { updateSession } from "./lib/auth/middleware-session";

const handleI18nRouting = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
  return await updateSession(request, (req) => handleI18nRouting(req));
}

export const config = {
  // Match only internationalized pathnames and exclude assets
  matcher: ["/", "/(es-MX|en-US)/:path*", "/((?!_next|_vercel|.*\\..*).*)"],
};
