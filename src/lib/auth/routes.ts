import type { Database } from "@/lib/database.types";

export type AppRole = Database["public"]["Enums"]["app_role"];

// Server-safe constants; no browser import; no dynamic values.
export const ROLE_DEFAULT_PATHS: Record<AppRole, string> = {
  admin: "/admin",
  pm: "/pm",
  operator: "/operador",
  client: "/cliente",
};

// Path prefixes that require an active session (used by middleware and shell guard).
export const PROTECTED_PATH_PREFIXES: readonly string[] = [
  "/admin",
  "/pm",
  "/operador",
  "/cliente",
];

// Allowlisted relative path prefixes for safe redirects (magic link / auth callback).
export const ALLOWLISTED_REDIRECT_PREFIXES: readonly string[] = [
  "/admin",
  "/pm",
  "/operador",
  "/cliente",
  "/actualizar-contrasena",
  "/en/update-password",
  "/privacidad",
  "/en/privacy",
];

export function isAllowlistedRedirectPath(
  path: string | null | undefined,
): boolean {
  if (!path) return false;
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("\\") ||
    /[\x00-\x1F\x7F]/.test(path)
  ) {
    return false;
  }
  return ALLOWLISTED_REDIRECT_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}
