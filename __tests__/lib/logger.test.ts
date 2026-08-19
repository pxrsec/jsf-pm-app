import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  logger,
  createRequestLogger,
  redactSensitiveData,
  REDACTED_VALUE,
} from "@/lib/logger";

describe("logger", () => {
  const fixedDate = new Date("2026-08-17T12:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("JSON record contract", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});

    logger.info("request.completed", { requestId: "req-123", status: 200 });

    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(spy.mock.calls[0][0]);
    expect(parsed).toEqual({
      timestamp: fixedDate.toISOString(),
      level: "info",
      event: "request.completed",
      requestId: "req-123",
      context: { status: 200 },
    });
  });

  it("Recursive sensitive-key redaction", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

    logger.warn("request.rejected", {
      authorization: "Bearer live-value",
      nested: { password: "p", safe: "kept" },
      items: [{ refreshToken: "r" }],
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const rawOutput = spy.mock.calls[0][0];
    const parsed = JSON.parse(rawOutput);

    expect(parsed.context.authorization).toBe(REDACTED_VALUE);
    expect(parsed.context.nested.password).toBe(REDACTED_VALUE);
    expect(parsed.context.nested.safe).toBe("kept");
    expect(parsed.context.items[0].refreshToken).toBe(REDACTED_VALUE);

    expect(rawOutput).not.toContain("live-value");
    expect(rawOutput).not.toContain('"p"');
    expect(rawOutput).not.toContain('"r"');
  });

  it("Request-scoped correlation", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const requestLogger = createRequestLogger("req-fixed");
    requestLogger.error("operation.failed", {
      requestId: "attempted-override",
      reason: "timeout",
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(spy.mock.calls[0][0]);
    expect(parsed.requestId).toBe("req-fixed");
    expect(parsed.context).toEqual({ reason: "timeout" });
  });

  it("Safe unusual values", () => {
    const circular: Record<string, unknown> = { key: "val" };
    circular.self = circular;

    expect(() => redactSensitiveData(circular)).not.toThrow();
    const redactedCircular = redactSensitiveData(circular) as Record<
      string,
      unknown
    >;
    expect(redactedCircular.self).toBe("[Circular]");

    const redactedBigInt = redactSensitiveData(BigInt(42));
    expect(typeof redactedBigInt).toBe("string");
    expect(redactedBigInt).toBe("42");

    const err = new Error("secret-bearing message");
    const redactedError = redactSensitiveData(err) as Record<string, unknown>;
    expect(redactedError).toEqual({
      name: "Error",
      message: "[REDACTED]",
    });
    expect(redactedError).not.toHaveProperty("stack");
  });
});
