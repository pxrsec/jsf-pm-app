import enUsMessages from "../../messages/en-US.json";
import esMxMessages from "../../messages/es-MX.json";

export type ErrorLocale = "es-MX" | "en-US";

export interface ErrorCopy {
  title: string;
  message: string;
  retry: string;
}

export function errorLocaleFromPathname(pathname: string): ErrorLocale {
  return pathname === "/en" || pathname.startsWith("/en/") ? "en-US" : "es-MX";
}

export function getErrorCopy(locale: ErrorLocale): ErrorCopy {
  return locale === "en-US" ? enUsMessages.errors : esMxMessages.errors;
}
