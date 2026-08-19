import { describe, it, expect } from "vitest";
import { CreateClientSchema } from "@/lib/clients/schemas";

describe("Clients Domain Schemas", () => {
  it("accepts valid client organization", () => {
    const result = CreateClientSchema.safeParse({
      display_name: "Acme Corp",
      legal_name: "Acme Corporation S.A. de C.V.",
      slug: "acme-corp",
      default_drive_folder_url: "https://drive.google.com/drive/folders/acme",
      notes: "Primary tier 1 enterprise client",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid slugs containing uppercase, spaces, or special characters", () => {
    expect(
      CreateClientSchema.safeParse({
        display_name: "Acme",
        legal_name: "Acme Inc",
        slug: "Acme Corp",
      }).success,
    ).toBe(false);

    expect(
      CreateClientSchema.safeParse({
        display_name: "Acme",
        legal_name: "Acme Inc",
        slug: "acme_corp",
      }).success,
    ).toBe(false);

    expect(
      CreateClientSchema.safeParse({
        display_name: "Acme",
        legal_name: "Acme Inc",
        slug: "acme@corp",
      }).success,
    ).toBe(false);
  });

  it("rejects empty display name or legal name", () => {
    const result = CreateClientSchema.safeParse({
      display_name: "   ",
      legal_name: "",
      slug: "acme",
    });
    expect(result.success).toBe(false);
  });
});
