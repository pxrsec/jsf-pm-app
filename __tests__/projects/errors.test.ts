import { describe, it, expect } from "vitest";
import { mapSupabaseError } from "@/lib/projects/errors";

describe("mapSupabaseError", () => {
  it("handles null or empty error safely", () => {
    const result = mapSupabaseError(null);
    expect(result.code).toBe("UNKNOWN");
    expect(result.message).toBe("An unexpected error occurred.");
  });

  it("maps unauthorized error messages and 42501 code", () => {
    expect(
      mapSupabaseError({ message: "Not authorized to perform this operation" })
        .code,
    ).toBe("UNAUTHORIZED");
    expect(
      mapSupabaseError({
        message: "Only an active PM Lead can transition project",
      }).code,
    ).toBe("UNAUTHORIZED");
    expect(
      mapSupabaseError({ message: "Only Admin can recover project" }).code,
    ).toBe("UNAUTHORIZED");
    expect(
      mapSupabaseError({
        message: "Client users cannot post internal collaboration comments",
      }).code,
    ).toBe("UNAUTHORIZED");
    expect(
      mapSupabaseError({
        code: "42501",
        message: "permission denied for table projects",
      }).code,
    ).toBe("UNAUTHORIZED");
  });

  it("maps not found errors and PGRST116 code", () => {
    expect(
      mapSupabaseError({ message: "Project not found or deleted" }).code,
    ).toBe("NOT_FOUND");
    expect(
      mapSupabaseError({
        code: "PGRST116",
        message: "JSON object requested, multiple (or no) rows returned",
      }).code,
    ).toBe("NOT_FOUND");
  });

  it("maps invalid transition error messages", () => {
    expect(
      mapSupabaseError({
        message: "Illegal transition from completed to paused",
      }).code,
    ).toBe("INVALID_TRANSITION");
    expect(
      mapSupabaseError({
        message: "Task cannot be transitioned to in_review",
      }).code,
    ).toBe("INVALID_TRANSITION");
    expect(
      mapSupabaseError({
        message: "Deliverable cannot submit version in approved state",
      }).code,
    ).toBe("INVALID_TRANSITION");
    expect(
      mapSupabaseError({
        message: "Deliverable is not in awaiting_internal_review",
      }).code,
    ).toBe("INVALID_TRANSITION");
    expect(
      mapSupabaseError({
        message: "Deliverable must be approved before marking delivered",
      }).code,
    ).toBe("INVALID_TRANSITION");
  });

  it("maps invariant violation messages", () => {
    expect(
      mapSupabaseError({
        message:
          "Project has unfinished tasks and requires confirm_unfinished = true",
      }).code,
    ).toBe("INVARIANT_VIOLATION");
    expect(
      mapSupabaseError({ message: "Reopening requires a non-empty reason" })
        .code,
    ).toBe("INVARIANT_VIOLATION");
    expect(
      mapSupabaseError({
        message: "Comments are mandatory when requesting changes",
      }).code,
    ).toBe("INVARIANT_VIOLATION");
    expect(
      mapSupabaseError({
        message: "Only client projects can have production deliverables",
      }).code,
    ).toBe("INVARIANT_VIOLATION");
    expect(
      mapSupabaseError({
        message: "Project must have at least one active PM Lead",
      }).code,
    ).toBe("INVARIANT_VIOLATION");
    expect(
      mapSupabaseError({
        message: "Project must have exactly one primary PM Lead",
      }).code,
    ).toBe("INVARIANT_VIOLATION");
  });

  it("maps unique conflict errors and 23505 code", () => {
    expect(
      mapSupabaseError({
        code: "23505",
        message: "duplicate key value violates unique constraint",
      }).code,
    ).toBe("CONFLICT");
    expect(
      mapSupabaseError({
        message: "An entity with this unique slug already exists",
      }).code,
    ).toBe("CONFLICT");
  });

  it("returns generic safe message on unmapped errors without leaking details", () => {
    const result = mapSupabaseError({
      code: "50000",
      message:
        "Internal PL/pgSQL syntax error in private.internal_fn() line 42 at /var/lib/postgresql",
    });
    expect(result.code).toBe("UNKNOWN");
    expect(result.message).toBe(
      "An unexpected error occurred. Please try again.",
    );
    expect(result.message).not.toContain("PL/pgSQL");
    expect(result.message).not.toContain("private.internal_fn");
  });
});
