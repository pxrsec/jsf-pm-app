import * as Sentry from "@sentry/nextjs";
import { redactSensitiveData, type LogContext } from "@/lib/logger";

export interface SentryCaptureContext extends LogContext {
  boundary?: "global" | "localized-route";
}

export interface SentryRuntimeConfig {
  serverDsn?: string;
  publicDsn?: string;
}

export function getSentryDsn(config?: SentryRuntimeConfig): string {
  if (config !== undefined) {
    const serverDsn = config.serverDsn?.trim();
    if (serverDsn) return serverDsn;
    const publicDsn = config.publicDsn?.trim();
    if (publicDsn) return publicDsn;
    return "";
  }

  const serverDsn = process.env.SENTRY_DSN?.trim();
  if (serverDsn) return serverDsn;
  const publicDsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  if (publicDsn) return publicDsn;
  return "";
}

export function isSentryEnabled(config?: SentryRuntimeConfig): boolean {
  return getSentryDsn(config).length > 0;
}

function toSafeException(error: unknown): Error {
  const safeError = new Error("Unhandled application error");
  safeError.name = error instanceof Error && error.name ? error.name : "Error";
  return safeError;
}

export function captureException(
  error: unknown,
  context?: SentryCaptureContext,
): void {
  if (!isSentryEnabled()) {
    return;
  }

  Sentry.withScope((scope) => {
    if (context?.requestId) {
      scope.setTag("request_id", context.requestId);
    }
    if (context) {
      const redactedExtras = redactSensitiveData(context) as Record<
        string,
        unknown
      >;
      scope.setExtras(redactedExtras);
    }
    Sentry.captureException(toSafeException(error));
  });
}
