# S01-E01-03 — Security, Safe Failure, and Observability Foundation

## 1. File Manifest

| Action | Path | Purpose |
|---|---|---|
| Modify | `next.config.ts` | Add global browser-security response headers while preserving `next-intl` plugin wrapper. |
| Modify | `messages/es-MX.json` | Merge the `errors` namespace into the message catalog. |
| Modify | `messages/en-US.json` | Merge the same `errors` namespace into the message catalog. |
| Create | `src/lib/error-copy.ts` | Typed fallback copy lookup for `global-error.tsx`. |
| Create | `src/app/global-error.tsx` | Root client failure boundary (replaces root layout on uncaught failure). |
| Create | `src/app/[locale]/error.tsx` | Localized route-segment client error boundary using `useTranslations`. |
| Create | `src/lib/logger.ts` | Structured JSON logger with recursive sensitive key redaction and request-scoped logger factory. |
| Create | `src/lib/sentry.ts` | Sentry capture wrapper with a safe no-op fallback when unconfigured. |
| Create | `src/lib/__tests__/logger.test.ts` | Unit tests for logger JSON serialization, redaction, and scoping. |
| Create | `src/lib/__tests__/sentry.test.ts` | Unit tests for Sentry safe fallback and configuration precedence. |

---

## 2. Code & Contract Blueprint

### `next.config.ts`
Preserve existing `next-intl` setup. Add security response headers:

```ts
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "frame-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  ...(process.env.NODE_ENV === "production"
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
Message Catalogs (messages/es-MX.json and messages/en-US.json)
Merge the "errors" key without deleting existing translations:

messages/es-MX.json:

JSON
"errors": {
  "title": "Algo salió mal",
  "message": "No pudimos completar esta solicitud. Inténtalo de nuevo.",
  "retry": "Intentar de nuevo"
}
messages/en-US.json:

JSON
"errors": {
  "title": "Something went wrong",
  "message": "We could not complete this request. Please try again.",
  "retry": "Try again"
}
src/lib/error-copy.ts
TypeScript
export type ErrorLocale = "es-MX" | "en-US";

export interface ErrorCopy {
  title: string;
  message: string;
  retry: string;
}

const copyMap: Record<ErrorLocale, ErrorCopy> = {
  "es-MX": {
    title: "Algo salió mal",
    message: "No pudimos completar esta solicitud. Inténtalo de nuevo.",
    retry: "Intentar de nuevo",
  },
  "en-US": {
    title: "Something went wrong",
    message: "We could not complete this request. Please try again.",
    retry: "Try again",
  },
};

export function errorLocaleFromPathname(pathname: string): ErrorLocale {
  return pathname === "/en" || pathname.startsWith("/en/") ? "en-US" : "es-MX";
}

export function getErrorCopy(locale: ErrorLocale): ErrorCopy {
  return copyMap[locale] || copyMap["es-MX"];
}
Error Boundaries
src/app/[locale]/error.tsx
TypeScript
"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { captureException } from "@/lib/sentry";

interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RouteError({ error, reset }: RouteErrorProps) {
  const t = useTranslations("errors");

  useEffect(() => {
    captureException(error, { boundary: "localized-route" });
  }, [error]);

  return (
    <main className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400">{t("message")}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        {t("retry")}
      </button>
    </main>
  );
}
src/app/global-error.tsx
TypeScript
"use client";

import { useEffect, useState } from "react";
import { errorLocaleFromPathname, getErrorCopy, type ErrorLocale } from "@/lib/error-copy";
import { captureException } from "@/lib/sentry";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  const [locale, setLocale] = useState<ErrorLocale>("es-MX");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setLocale(errorLocaleFromPathname(window.location.pathname));
    }
    captureException(error, { boundary: "global" });
  }, [error]);

  const copy = getErrorCopy(locale);

  return (
    <html lang={locale}>
      <body className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <main>
          <h1 className="text-2xl font-bold">{copy.title}</h1>
          <p className="mt-2 text-gray-600">{copy.message}</p>
          <button
            type="button"
            onClick={reset}
            className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            {copy.retry}
          </button>
        </main>
      </body>
    </html>
  );
}
src/lib/logger.ts
TypeScript
export const REDACTED_VALUE = "[REDACTED]";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  requestId?: string;
  [key: string]: unknown;
}

export interface LogRecord {
  timestamp: string;
  level: LogLevel;
  event: string;
  requestId?: string;
  context: Record<string, unknown>;
}

export interface RequestLogger {
  debug(event: string, context?: LogContext): void;
  info(event: string, context?: LogContext): void;
  warn(event: string, context?: LogContext): void;
  error(event: string, context?: LogContext): void;
}

export const SENSITIVE_KEY_PATTERN =
  /authorization|proxy-authorization|api[-_]?key|access[-_]?token|refresh[-_]?token|token|password|passphrase|secret|cookie|session/i;

export function redactSensitiveData(value: unknown, seen = new WeakSet()): unknown {
  if (value === null || typeof value !== "object") {
    if (typeof value === "bigint") return value.toString();
    return value;
  }

  if (seen.has(value)) {
    return "[Circular]";
  }
  seen.add(value);

  if (value instanceof Error) {
    return { name: value.name, message: REDACTED_VALUE };
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveData(item, seen));
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      result[key] = REDACTED_VALUE;
    } else {
      result[key] = redactSensitiveData(val, seen);
    }
  }
  return result;
}

function emit(level: LogLevel, event: string, context: LogContext = {}): void {
  const { requestId, ...metadata } = redactSensitiveData(context) as LogContext;
  const record: LogRecord = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...(requestId ? { requestId: String(requestId) } : {}),
    context: metadata as Record<string, unknown>,
  };

  console[level](JSON.stringify(record));
}

export const logger: RequestLogger = {
  debug: (event, ctx) => emit("debug", event, ctx),
  info: (event, ctx) => emit("info", event, ctx),
  warn: (event, ctx) => emit("warn", event, ctx),
  error: (event, ctx) => emit("error", event, ctx),
};

export function createRequestLogger(requestId: string): RequestLogger {
  return {
    debug: (event, ctx) => emit("debug", event, { ...ctx, requestId }),
    info: (event, ctx) => emit("info", event, { ...ctx, requestId }),
    warn: (event, ctx) => emit("warn", event, { ...ctx, requestId }),
    error: (event, ctx) => emit("error", event, { ...ctx, requestId }),
  };
}
src/lib/sentry.ts
TypeScript
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
  if (config) {
    const s = config.serverDsn?.trim();
    if (s) return s;
    const p = config.publicDsn?.trim();
    if (p) return p;
    return "";
  }
  const server = process.env.SENTRY_DSN?.trim();
  if (server) return server;
  const pub = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  if (pub) return pub;
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

export function captureException(error: unknown, context?: SentryCaptureContext): void {
  if (!isSentryEnabled()) return;

  Sentry.withScope((scope) => {
    if (context?.requestId) {
      scope.setTag("request_id", context.requestId);
    }
    if (context) {
      const redacted = redactSensitiveData(context) as Record<string, unknown>;
      scope.setExtras(redacted);
    }
    Sentry.captureException(toSafeException(error));
  });
}
3. Vitest Test Requirements
src/lib/__tests__/logger.test.ts
TypeScript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger, createRequestLogger, redactSensitiveData } from "../logger";

describe("Structured Logger", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-17T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("emits expected JSON record", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    logger.info("request.completed", { requestId: "req-123", status: 200 });

    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(spy.mock.calls[0][0]);
    expect(parsed).toEqual({
      timestamp: "2026-08-17T12:00:00.000Z",
      level: "info",
      event: "request.completed",
      requestId: "req-123",
      context: { status: 200 },
    });
  });

  it("redacts sensitive keys recursively", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    logger.warn("request.rejected", {
      authorization: "Bearer secret-token",
      nested: { password: "pass", safe: "kept" },
      items: [{ refreshToken: "refresh" }],
    });

    const parsed = JSON.parse(spy.mock.calls[0][0]);
    expect(parsed.context.authorization).toBe("[REDACTED]");
    expect((parsed.context.nested as any).password).toBe("[REDACTED]");
    expect((parsed.context.nested as any).safe).toBe("kept");
    expect((parsed.context.items as any)[0].refreshToken).toBe("[REDACTED]");
  });

  it("enforces factory-scoped requestId override", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const reqLogger = createRequestLogger("req-fixed");
    reqLogger.error("op.failed", { requestId: "req-override", reason: "timeout" });

    const parsed = JSON.parse(spy.mock.calls[0][0]);
    expect(parsed.requestId).toBe("req-fixed");
    expect(parsed.context).toEqual({ reason: "timeout" });
  });

  it("handles circular objects, bigints, and errors safely", () => {
    const circular: any = { a: 1 };
    circular.self = circular;

    const res = redactSensitiveData({
      circular,
      big: 42n,
      err: new Error("secret-message"),
    }) as any;

    expect(res.circular.self).toBe("[Circular]");
    expect(res.big).toBe("42");
    expect(res.err).toEqual({ name: "Error", message: "[REDACTED]" });
  });
});
src/lib/__tests__/sentry.test.ts
TypeScript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockWithScope = vi.fn();
const mockCaptureException = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  withScope: (cb: any) => mockWithScope(cb),
  captureException: (err: any) => mockCaptureException(err),
}));

import { getSentryDsn, isSentryEnabled, captureException } from "../sentry";

describe("Sentry Seam", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SENTRY_DSN;
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  });

  it("is disabled when DSN is absent", () => {
    expect(getSentryDsn()).toBe("");
    expect(isSentryEnabled()).toBe(false);
    expect(() => captureException(new Error("fail"))).not.toThrow();
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it("is disabled when DSN contains only whitespace", () => {
    process.env.SENTRY_DSN = "   ";
    expect(isSentryEnabled()).toBe(false);
    captureException(new Error("fail"));
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it("respects config override precedence", () => {
    expect(getSentryDsn({ serverDsn: " [https://server@sentry.io/1](https://server@sentry.io/1) ", publicDsn: " [https://pub@sentry.io/2](https://pub@sentry.io/2) " })).toBe("[https://server@sentry.io/1](https://server@sentry.io/1)");
    expect(getSentryDsn({ publicDsn: " [https://pub@sentry.io/2](https://pub@sentry.io/2) " })).toBe("[https://pub@sentry.io/2](https://pub@sentry.io/2)");
    expect(isSentryEnabled({})).toBe(false);
  });
});
4. Antigravity Verification Gate
Bash
npx tsc --noEmit && npm run test && npm run build