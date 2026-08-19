import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  isAllowlistedRedirectPath,
  ROLE_DEFAULT_PATHS,
} from "@/lib/auth/routes";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const next = requestUrl.searchParams.get("next");

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  let isSuccess = false;

  // 1. Handle PKCE code exchange
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      isSuccess = true;
    }
  } else if (tokenHash && type) {
    // 2. Handle OTP token_hash verification
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (!error) {
      isSuccess = true;
    }
  }

  if (!isSuccess) {
    return NextResponse.redirect(
      new URL("/sesion-expirada?reason=invalid", request.url),
    );
  }

  // 3. If this was a password recovery flow, route to password update page
  if (type === "recovery") {
    const recoveryRedirect =
      (isAllowlistedRedirectPath(next) ? next : null) ??
      "/actualizar-contrasena";
    return NextResponse.redirect(new URL(recoveryRedirect, request.url));
  }

  // 4. If an allowlisted redirect path was provided, use it
  if (next && isAllowlistedRedirectPath(next)) {
    return NextResponse.redirect(new URL(next, request.url));
  }

  // 5. Otherwise resolve user role and redirect to default role path
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile && profile.role) {
        const role = profile.role as keyof typeof ROLE_DEFAULT_PATHS;
        if (ROLE_DEFAULT_PATHS[role]) {
          return NextResponse.redirect(
            new URL(ROLE_DEFAULT_PATHS[role], request.url),
          );
        }
      }
    }
  } catch {
    // Fall back to sign in
  }

  return NextResponse.redirect(new URL("/iniciar-sesion", request.url));
}
