import type { User } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { createClient, type CookieStore } from "@/lib/supabase/server";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type AppRole = Database["public"]["Enums"]["app_role"];

export type SessionContext = {
  user: User;
  profile: Profile;
  role: AppRole;
};

export type AuthErrorCode = "UNAUTHENTICATED" | "INACTIVE_OR_MISSING_PROFILE";

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

/**
 * Resolves the authenticated user, public.profiles row, and authoritative
 * application role for server components, route handlers, and protected layouts.
 *
 * Fails closed if the session is invalid, the profile is missing, inactive, or soft-deleted.
 */
export async function requireSession(
  cookieStore: CookieStore,
): Promise<SessionContext> {
  const supabase = createClient(cookieStore);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new AuthError(
      "UNAUTHENTICATED",
      "Authentication required to access this resource",
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (
    profileError ||
    !profile ||
    profile.is_active === false ||
    profile.deleted_at !== null
  ) {
    throw new AuthError(
      "INACTIVE_OR_MISSING_PROFILE",
      "User profile is missing, inactive, or has been deactivated",
    );
  }

  return {
    user,
    profile,
    role: profile.role,
  };
}

/**
 * Safe companion to requireSession that returns null instead of throwing on
 * unauthenticated / inactive profile states.
 */
export async function getOptionalSession(
  cookieStore: CookieStore,
): Promise<SessionContext | null> {
  try {
    return await requireSession(cookieStore);
  } catch (error) {
    if (error instanceof AuthError) {
      return null;
    }
    throw error;
  }
}
