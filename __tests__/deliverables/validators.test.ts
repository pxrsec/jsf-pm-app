import { describe, it, expect } from "vitest";
import {
  isValidGoogleDriveUrl,
  GOOGLE_DRIVE_URL_REGEX,
} from "@/lib/deliverables/validators";

describe("Google Drive URL Validator", () => {
  it("accepts valid Google Drive and Google Docs URLs", () => {
    expect(
      isValidGoogleDriveUrl(
        "https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view?usp=sharing",
      ),
    ).toBe(true);

    expect(
      isValidGoogleDriveUrl(
        "https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit",
      ),
    ).toBe(true);

    expect(
      isValidGoogleDriveUrl(
        "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0",
      ),
    ).toBe(true);

    expect(
      isValidGoogleDriveUrl(
        "https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit",
      ),
    ).toBe(true);

    expect(
      isValidGoogleDriveUrl(
        "https://drive.google.com/drive/folders/1aBcDeFgHiJkLmNoPqRsTuVwXyZ",
      ),
    ).toBe(true);
  });

  it("rejects non-HTTPS URLs", () => {
    expect(
      isValidGoogleDriveUrl("http://drive.google.com/file/d/123/view"),
    ).toBe(false);

    expect(
      isValidGoogleDriveUrl("http://docs.google.com/document/d/123/edit"),
    ).toBe(false);
  });

  it("rejects non-Google Drive domains", () => {
    expect(isValidGoogleDriveUrl("https://dropbox.com/s/12345/file.pdf")).toBe(
      false,
    );
    expect(isValidGoogleDriveUrl("https://onedrive.live.com/?id=12345")).toBe(
      false,
    );
    expect(
      isValidGoogleDriveUrl("https://wetransfer.com/downloads/12345"),
    ).toBe(false);
    expect(isValidGoogleDriveUrl("https://frame.io/player/12345")).toBe(false);
  });

  it("rejects domain spoofing or subpath trickery", () => {
    expect(
      isValidGoogleDriveUrl("https://evil.com/drive.google.com/file"),
    ).toBe(false);
    expect(isValidGoogleDriveUrl("https://notdrive.google.com/file")).toBe(
      false,
    );
    expect(
      isValidGoogleDriveUrl("https://drive.google.com.evil.com/file"),
    ).toBe(false);
  });

  it("rejects invalid, malformed, or empty inputs", () => {
    expect(isValidGoogleDriveUrl("")).toBe(false);
    expect(isValidGoogleDriveUrl("   ")).toBe(false);
    expect(isValidGoogleDriveUrl("not a url")).toBe(false);
    expect(isValidGoogleDriveUrl("ftp://drive.google.com/file")).toBe(false);
    expect(isValidGoogleDriveUrl(null as unknown as string)).toBe(false);
    expect(isValidGoogleDriveUrl(undefined as unknown as string)).toBe(false);
  });

  it("regex matches case-insensitively", () => {
    expect(
      GOOGLE_DRIVE_URL_REGEX.test("HTTPS://DRIVE.GOOGLE.COM/file/d/123"),
    ).toBe(true);
    expect(
      GOOGLE_DRIVE_URL_REGEX.test("HTTPS://DOCS.GOOGLE.COM/document/d/123"),
    ).toBe(true);
  });
});
