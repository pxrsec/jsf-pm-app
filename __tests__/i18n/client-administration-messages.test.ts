import { describe, it, expect } from "vitest";
import enCatalog from "../../messages/en-US.json";
import esCatalog from "../../messages/es-MX.json";

function getNestedKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  let keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      keys = keys.concat(
        getNestedKeys(value as Record<string, unknown>, fullKey),
      );
    } else {
      keys.push(fullKey);
    }
  }
  return keys.sort();
}

type CatalogShape = {
  shell?: { nav?: { links?: { clients?: string } } };
  projects?: {
    types?: { direct?: string };
    members?: {
      addDialog?: {
        directPrerequisiteHint?: string;
        clientsUnavailable?: string;
      };
    };
  };
  clientAdministration?: Record<string, unknown>;
};

describe("Client Administration & S10 Localization Key Parity", () => {
  it("has exact bidirectional key parity for clientAdministration namespace", () => {
    const enClientAdmin = (enCatalog as CatalogShape).clientAdministration;
    const esClientAdmin = (esCatalog as CatalogShape).clientAdministration;

    expect(enClientAdmin).toBeDefined();
    expect(esClientAdmin).toBeDefined();

    const enKeys = getNestedKeys(enClientAdmin ?? {});
    const esKeys = getNestedKeys(esClientAdmin ?? {});

    expect(enKeys).toEqual(esKeys);
  });

  it("has shell.nav.links.clients in both catalogs", () => {
    expect((enCatalog as CatalogShape).shell?.nav?.links?.clients).toBe(
      "Clients",
    );
    expect((esCatalog as CatalogShape).shell?.nav?.links?.clients).toBe(
      "Clientes",
    );
  });

  it("has projects.types.direct in both catalogs", () => {
    expect((enCatalog as CatalogShape).projects?.types?.direct).toBe("Direct");
    expect((esCatalog as CatalogShape).projects?.types?.direct).toBe("Directo");
  });

  it("has directPrerequisiteHint and clientsUnavailable in projects.members.addDialog in both catalogs", () => {
    const enAddDialog = (enCatalog as CatalogShape).projects?.members
      ?.addDialog;
    const esAddDialog = (esCatalog as CatalogShape).projects?.members
      ?.addDialog;

    expect(enAddDialog?.directPrerequisiteHint).toBeDefined();
    expect(esAddDialog?.directPrerequisiteHint).toBeDefined();

    expect(enAddDialog?.clientsUnavailable).toBeDefined();
    expect(esAddDialog?.clientsUnavailable).toBeDefined();
  });
});
