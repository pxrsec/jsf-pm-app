import { describe, it, expect, vi } from "vitest";
import {
  validateClientSubmissionUrl,
  classifyClientSubmissionProvider,
} from "@/lib/client/submission-url";

describe("Client Submission URL Validator (Section 4.7 Acceptance Corpus)", () => {
  it("never executes network or fetch requests during validation", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    validateClientSubmissionUrl("https://drive.google.com/file/d/abc/view");
    validateClientSubmissionUrl("http://assets.example-cdn.com/file");

    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  describe("Accepted standard provider URLs (7 cases)", () => {
    it("accepts Google Drive URL and classifies as google_drive", () => {
      const result = validateClientSubmissionUrl(
        "https://drive.google.com/file/d/abc/view",
      );
      expect(result).toEqual({ ok: true, provider: "google_drive" });
    });

    it("accepts Dropbox URL and classifies as dropbox", () => {
      const result = validateClientSubmissionUrl(
        "https://www.dropbox.com/s/example/asset.mov",
      );
      expect(result).toEqual({ ok: true, provider: "dropbox" });
    });

    it("accepts OneDrive URL and classifies as onedrive", () => {
      const result = validateClientSubmissionUrl("https://1drv.ms/u/s!example");
      expect(result).toEqual({ ok: true, provider: "onedrive" });
    });

    it("accepts WeTransfer URL and classifies as wetransfer", () => {
      const result = validateClientSubmissionUrl("https://we.tl/t-example");
      expect(result).toEqual({ ok: true, provider: "wetransfer" });
    });

    it("accepts Frame.io URL and classifies as frame_io", () => {
      const result = validateClientSubmissionUrl("https://f.io/example");
      expect(result).toEqual({ ok: true, provider: "frame_io" });
    });

    it("accepts generic HTTPS URL with path, query, fragment as other_https", () => {
      const result = validateClientSubmissionUrl(
        "https://assets.example-cdn.com/client/file.mp4?download=1#preview",
      );
      expect(result).toEqual({ ok: true, provider: "other_https" });
    });

    it("accepts pathless HTTPS URL as other_https", () => {
      const result = validateClientSubmissionUrl(
        "https://assets.example-cdn.com",
      );
      expect(result).toEqual({ ok: true, provider: "other_https" });
    });
  });

  describe("Accepted suffix/look-alike hosts mapped to other_https (4 cases)", () => {
    it("classifies drive.google.com.evil.example as other_https", () => {
      const result = validateClientSubmissionUrl(
        "https://drive.google.com.evil.example/file",
      );
      expect(result).toEqual({ ok: true, provider: "other_https" });
    });

    it("classifies notdropbox.com as other_https", () => {
      const result = validateClientSubmissionUrl("https://notdropbox.com/file");
      expect(result).toEqual({ ok: true, provider: "other_https" });
    });

    it("classifies frame.io.evil.example as other_https", () => {
      const result = validateClientSubmissionUrl(
        "https://frame.io.evil.example/file",
      );
      expect(result).toEqual({ ok: true, provider: "other_https" });
    });

    it("classifies example-we.tl as other_https", () => {
      const result = validateClientSubmissionUrl("https://example-we.tl/file");
      expect(result).toEqual({ ok: true, provider: "other_https" });
    });
  });

  describe("Rejected invalid URLs (13 cases)", () => {
    it("rejects non-HTTPS scheme (http://)", () => {
      const result = validateClientSubmissionUrl(
        "http://assets.example-cdn.com/file",
      );
      expect(result.ok).toBe(false);
    });

    it("rejects scheme-relative URL (//)", () => {
      const result = validateClientSubmissionUrl(
        "//assets.example-cdn.com/file",
      );
      expect(result.ok).toBe(false);
    });

    it("rejects credentials with password (https://user:pass@...)", () => {
      const result = validateClientSubmissionUrl(
        "https://user:pass@assets.example-cdn.com/file",
      );
      expect(result.ok).toBe(false);
    });

    it("rejects credentials without password (https://user@...)", () => {
      const result = validateClientSubmissionUrl(
        "https://user@assets.example-cdn.com/file",
      );
      expect(result.ok).toBe(false);
    });

    it("rejects explicit port :443", () => {
      const result = validateClientSubmissionUrl(
        "https://assets.example-cdn.com:443/file",
      );
      expect(result.ok).toBe(false);
    });

    it("rejects localhost", () => {
      const result = validateClientSubmissionUrl("https://localhost/file");
      expect(result.ok).toBe(false);
    });

    it("rejects IPv4 loopback literal (127.0.0.1)", () => {
      const result = validateClientSubmissionUrl("https://127.0.0.1/file");
      expect(result.ok).toBe(false);
    });

    it("rejects IPv6 loopback literal ([::1])", () => {
      const result = validateClientSubmissionUrl("https://[::1]/file");
      expect(result.ok).toBe(false);
    });

    it("rejects IPv4 private literal (10.0.0.1)", () => {
      const result = validateClientSubmissionUrl("https://10.0.0.1/file");
      expect(result.ok).toBe(false);
    });

    it("rejects IPv4 documentation literal (192.0.2.10)", () => {
      const result = validateClientSubmissionUrl("https://192.0.2.10/file");
      expect(result.ok).toBe(false);
    });

    it("rejects raw whitespace and control characters without trimming", () => {
      const resultWithSpace = validateClientSubmissionUrl(
        "https://assets.example-cdn.com/file with space",
      );
      expect(resultWithSpace.ok).toBe(false);

      const resultWithLeadingSpace = validateClientSubmissionUrl(
        " https://assets.example-cdn.com/file",
      );
      expect(resultWithLeadingSpace.ok).toBe(false);

      const resultWithControl = validateClientSubmissionUrl(
        "https://assets.example-cdn.com/file\n",
      );
      expect(resultWithControl.ok).toBe(false);
    });

    it("rejects URL containing backslash", () => {
      const result = validateClientSubmissionUrl(
        "https://assets.example-cdn.com\\file",
      );
      expect(result.ok).toBe(false);
    });

    it("rejects valid-looking URL exceeding 2,048 bytes", () => {
      const longPath = "a".repeat(2040);
      const longUrl = `https://assets.example-cdn.com/${longPath}`;
      expect(new TextEncoder().encode(longUrl).length).toBeGreaterThan(2048);

      const result = validateClientSubmissionUrl(longUrl);
      expect(result).toEqual({ ok: false, reason: "TOO_LONG" });
    });
  });

  describe("classifyClientSubmissionProvider direct classifier", () => {
    it("classifies standard and custom domains directly", () => {
      expect(
        classifyClientSubmissionProvider("https://drive.google.com/file/d/xyz"),
      ).toBe("google_drive");
      expect(
        classifyClientSubmissionProvider("https://dropbox.com/s/xyz"),
      ).toBe("dropbox");
      expect(
        classifyClientSubmissionProvider("https://onedrive.live.com/view"),
      ).toBe("onedrive");
      expect(
        classifyClientSubmissionProvider(
          "https://wetransfer.com/downloads/123",
        ),
      ).toBe("wetransfer");
      expect(
        classifyClientSubmissionProvider("https://frame.io/player/123"),
      ).toBe("frame_io");
      expect(
        classifyClientSubmissionProvider(
          "https://other-domain.example.com/asset",
        ),
      ).toBe("other_https");
    });
  });
});
