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

export function redactSensitiveData(
  value: unknown,
  seen: WeakSet<object> = new WeakSet<object>(),
): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (value instanceof Error) {
    return {
      name: value.name || "Error",
      message: REDACTED_VALUE,
    };
  }
  if (seen.has(value)) {
    return "[Circular]";
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveData(item, seen));
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
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
    ...(requestId ? { requestId } : {}),
    context: metadata as Record<string, unknown>,
  };

  console[level](JSON.stringify(record));
}

export function createRequestLogger(requestId: string): RequestLogger {
  return {
    debug(event: string, context?: LogContext) {
      emit("debug", event, { ...context, requestId });
    },
    info(event: string, context?: LogContext) {
      emit("info", event, { ...context, requestId });
    },
    warn(event: string, context?: LogContext) {
      emit("warn", event, { ...context, requestId });
    },
    error(event: string, context?: LogContext) {
      emit("error", event, { ...context, requestId });
    },
  };
}

export const logger: RequestLogger = {
  debug(event: string, context?: LogContext) {
    emit("debug", event, context);
  },
  info(event: string, context?: LogContext) {
    emit("info", event, context);
  },
  warn(event: string, context?: LogContext) {
    emit("warn", event, context);
  },
  error(event: string, context?: LogContext) {
    emit("error", event, context);
  },
};
