import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockWithScope, mockCaptureException } = vi.hoisted(() => ({
  mockWithScope: vi.fn(),
  mockCaptureException: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  withScope: mockWithScope,
  captureException: mockCaptureException,
}));

import { getSentryDsn, isSentryEnabled, captureException } from "../sentry";

describe("sentry", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.SENTRY_DSN;
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    mockWithScope.mockReset();
    mockCaptureException.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it("Both DSNs absent", () => {
    delete process.env.SENTRY_DSN;
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;

    expect(getSentryDsn()).toBe("");
    expect(isSentryEnabled()).toBe(false);
    expect(() => captureException(new Error("failure"))).not.toThrow();

    expect(mockWithScope).not.toHaveBeenCalled();
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it("Both DSNs blank", () => {
    process.env.SENTRY_DSN = "   ";
    process.env.NEXT_PUBLIC_SENTRY_DSN = "  \t\n ";

    expect(getSentryDsn()).toBe("");
    expect(isSentryEnabled()).toBe(false);
    expect(() => captureException(new Error("failure"))).not.toThrow();

    expect(mockWithScope).not.toHaveBeenCalled();
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it("Pure configuration precedence", () => {
    expect(getSentryDsn({ serverDsn: " server ", publicDsn: " public " })).toBe(
      "server",
    );

    expect(getSentryDsn({ serverDsn: "", publicDsn: " public " })).toBe(
      "public",
    );

    expect(isSentryEnabled({})).toBe(false);

    expect(mockWithScope).not.toHaveBeenCalled();
    expect(mockCaptureException).not.toHaveBeenCalled();
  });
});
