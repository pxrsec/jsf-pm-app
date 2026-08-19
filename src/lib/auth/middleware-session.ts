import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { appConfig } from "@/config/app.config";

/**
 * Updates the Supabase session cookie across the Next.js request/response boundary
 * while chaining with next-intl or another response handler.
 */
export async function updateSession(
  request: NextRequest,
  responseHandler?: (req: NextRequest) => NextResponse | Promise<NextResponse>,
): Promise<NextResponse> {
  let supabaseResponse = responseHandler
    ? await responseHandler(request)
    : NextResponse.next({ request });

  const supabase = createServerClient(
    appConfig.supabaseUrl,
    appConfig.supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = responseHandler
            ? (responseHandler(request) as NextResponse)
            : NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh auth token if expired via getUser()
  await supabase.auth.getUser();

  return supabaseResponse;
}
