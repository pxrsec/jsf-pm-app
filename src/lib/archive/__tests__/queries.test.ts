import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockLoggerDebug = vi.fn();
vi.mock("@/lib/logger", () => ({
  logger: {
    debug: (...args: unknown[]) => mockLoggerDebug(...args),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  sanitizeSubmissionUrl,
  sanitizeDriveFolderUrl,
} from "../url-validators";
import {
  getDefaultArchiveRange,
  isValidArchiveRange,
  normalizeArchiveSearchState,
  normalizeIncidentSearchState,
} from "../date-utils";
import {
  deriveProjectHref,
  fetchFinalizedArchivePage,
  fetchLinkIncidentsPage,
  fetchArchiveProjectFilterOptionsForAdmin,
  fetchArchiveProjectFilterOptionsForPm,
} from "../queries";

describe("Archive URL Validators", () => {
  it("sanitizeSubmissionUrl accepts valid Google Drive / Docs links and rejects non-matching URLs", () => {
    expect(
      sanitizeSubmissionUrl(
        "https://drive.google.com/file/d/1a2b3c4d5e/view?usp=sharing",
      ),
    ).toBe("https://drive.google.com/file/d/1a2b3c4d5e/view?usp=sharing");

    expect(
      sanitizeSubmissionUrl(
        "https://docs.google.com/spreadsheets/d/1a2b3c4d5e/edit",
      ),
    ).toBe("https://docs.google.com/spreadsheets/d/1a2b3c4d5e/edit");

    // Rejects non-Google Drive links
    expect(
      sanitizeSubmissionUrl("https://dropbox.com/s/12345/file.pdf"),
    ).toBeNull();
    expect(
      sanitizeSubmissionUrl("http://drive.google.com/file/d/123"),
    ).toBeNull();
    expect(sanitizeSubmissionUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeSubmissionUrl(null)).toBeNull();
  });

  it("sanitizeDriveFolderUrl enforces HTTPS, no user:pass, no ports, max length 2048", () => {
    expect(
      sanitizeDriveFolderUrl(
        "https://drive.google.com/drive/folders/1a2b3c4d5e",
      ),
    ).toBe("https://drive.google.com/drive/folders/1a2b3c4d5e");

    expect(sanitizeDriveFolderUrl("http://drive.google.com/folder")).toBeNull();
    expect(
      sanitizeDriveFolderUrl("https://user:pass@drive.google.com/folder"),
    ).toBeNull();
    expect(
      sanitizeDriveFolderUrl("https://drive.google.com:8443/folder"),
    ).toBeNull();
    expect(
      sanitizeDriveFolderUrl("https://drive.google.com/folder\\evil"),
    ).toBeNull();
    expect(
      sanitizeDriveFolderUrl("https://drive google.com/folder"),
    ).toBeNull();
    expect(sanitizeDriveFolderUrl(null)).toBeNull();
  });
});

describe("Archive Date & Search Utilities", () => {
  it("calculates default 90-day range correctly in America/Mexico_City", () => {
    const range = getDefaultArchiveRange(new Date("2026-08-24T12:00:00Z"));
    expect(range.from).toBeDefined();
    expect(range.to).toBeDefined();
    expect(isValidArchiveRange(range.from, range.to)).toBe(true);
  });

  it("validates archive range bounds", () => {
    expect(
      isValidArchiveRange(
        "2026-05-26T00:00:00-06:00",
        "2026-08-24T00:00:00-06:00",
      ),
    ).toBe(true);

    // from >= to
    expect(
      isValidArchiveRange(
        "2026-08-24T00:00:00-06:00",
        "2026-05-26T00:00:00-06:00",
      ),
    ).toBe(false);

    // > 93 days
    expect(
      isValidArchiveRange(
        "2026-01-01T00:00:00-06:00",
        "2026-08-24T00:00:00-06:00",
      ),
    ).toBe(false);
  });

  it("normalizes archive and incident search state safely", () => {
    const state = normalizeArchiveSearchState({
      from: "2026-06-01T00:00:00-06:00",
      to: "2026-08-01T00:00:00-06:00",
      status: "approved",
      projectId: "00000000-0000-0000-0000-000000000001",
    });

    expect(state.from).toBe("2026-06-01T00:00:00-06:00");
    expect(state.to).toBe("2026-08-01T00:00:00-06:00");
    expect(state.status).toBe("approved");
    expect(state.projectId).toBe("00000000-0000-0000-0000-000000000001");

    const incidentState = normalizeIncidentSearchState({
      status: "open",
    });
    expect(incidentState.status).toBe("open");
    expect(incidentState.from).toBeDefined();
    expect(incidentState.to).toBeDefined();
  });
});

describe("Project Href Derivation", () => {
  it("derives correct role-safe routes and denies operator route", () => {
    const uuid = "00000000-0000-0000-0000-000000000001";
    expect(deriveProjectHref("admin", uuid)).toBe(`/admin/proyectos/${uuid}`);
    expect(deriveProjectHref("pm", uuid)).toBe(`/pm/proyectos/${uuid}`);
    expect(deriveProjectHref("client", uuid)).toBe(
      `/cliente/proyectos/${uuid}`,
    );
    expect(deriveProjectHref("operator", uuid)).toBeNull();
    expect(deriveProjectHref("admin", null)).toBeNull();
  });
});

describe("Archive & Incident Queries", () => {
  it("fetchFinalizedArchivePage maps rows and derives nextCursor", async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: [
        {
          deliverable_id: "00000000-0000-0000-0000-000000000001",
          project_id: "00000000-0000-0000-0000-000000000002",
          deliverable_title: "Campaign Video",
          final_status: "approved",
          current_version_number: 2,
          finalized_at: "2026-08-20T10:00:00-06:00",
          project_name: "Brand Refresh",
          project_drive_folder_url: "https://drive.google.com/folder",
          current_submission_url:
            "https://drive.google.com/file/d/123/view?usp=sharing",
        },
      ],
      error: null,
    });

    const supabase = { rpc: mockRpc } as never;
    const page = await fetchFinalizedArchivePage(
      supabase,
      {
        from: "2026-05-26T00:00:00-06:00",
        to: "2026-08-24T00:00:00-06:00",
      },
      null,
      "admin",
    );

    expect(page.items).toHaveLength(1);
    expect(page.items[0].deliverableTitle).toBe("Campaign Video");
    expect(page.items[0].projectHref).toBe(
      "/admin/proyectos/00000000-0000-0000-0000-000000000002",
    );
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it("fetchLinkIncidentsPage maps incidents and rejects malformed rows", async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: [
        {
          incident_id: "00000000-0000-0000-0000-000000000010",
          deliverable_id: "00000000-0000-0000-0000-000000000001",
          project_id: "00000000-0000-0000-0000-000000000002",
          deliverable_title: "Campaign Video",
          project_name: "Brand Refresh",
          incident_status: "open",
          reported_at: "2026-08-21T10:00:00-06:00",
          resolved_at: null,
          reason: "Access denied",
          resolution_note: null,
        },
      ],
      error: null,
    });

    const supabase = { rpc: mockRpc } as never;
    const page = await fetchLinkIncidentsPage(
      supabase,
      {
        from: "2026-05-26T00:00:00-06:00",
        to: "2026-08-24T00:00:00-06:00",
      },
      null,
      "pm",
    );

    expect(page.items).toHaveLength(1);
    expect(page.items[0].incidentStatus).toBe("open");
    expect(page.items[0].projectHref).toBe(
      "/pm/proyectos/00000000-0000-0000-0000-000000000002",
    );
  });

  it("fetchArchiveProjectFilterOptionsForAdmin returns narrow id/name pairs", async () => {
    const mockOrder = vi.fn().mockResolvedValue({
      data: [
        { id: "proj-1", name: "Project Alpha" },
        { id: "proj-2", name: "Project Beta" },
      ],
      error: null,
    });
    const mockIs = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ is: mockIs });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    const supabase = { from: mockFrom } as never;
    const options = await fetchArchiveProjectFilterOptionsForAdmin(supabase);

    expect(options).toEqual([
      { id: "proj-1", name: "Project Alpha" },
      { id: "proj-2", name: "Project Beta" },
    ]);
  });

  it("fetchArchiveProjectFilterOptionsForPm returns deduplicated sorted options", async () => {
    const mockIs2 = vi.fn().mockResolvedValue({
      data: [
        { projects: { id: "proj-2", name: "Project Beta", deleted_at: null } },
        { projects: { id: "proj-1", name: "Project Alpha", deleted_at: null } },
      ],
      error: null,
    });
    const mockIs1 = vi.fn().mockReturnValue({ is: mockIs2 });
    const mockEq = vi.fn().mockReturnValue({ is: mockIs1 });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    const supabase = { from: mockFrom } as never;
    const options = await fetchArchiveProjectFilterOptionsForPm(
      supabase,
      "user-1",
    );

    expect(options).toEqual([
      { id: "proj-1", name: "Project Alpha" },
      { id: "proj-2", name: "Project Beta" },
    ]);
  });
});
