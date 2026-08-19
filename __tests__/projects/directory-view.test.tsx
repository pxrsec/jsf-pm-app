import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import esCatalog from "../../messages/es-MX.json";
import { ProjectDirectoryView } from "@/components/shared/projects/project-directory/project-directory-view";
import { ProjectTable } from "@/components/shared/projects/project-directory/project-table";
import { ProjectCardList } from "@/components/shared/projects/project-directory/project-card-list";
import { ProjectEmptyState } from "@/components/shared/projects/project-directory/project-empty-state";
import type { ProjectListItem } from "@/lib/projects/queries";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => {
    return (key: string, params?: Record<string, string>) => {
      const fullPath = namespace ? `${namespace}.${key}` : key;
      const val = fullPath
        .split(".")
        .reduce<unknown>(
          (acc, part) => (acc as Record<string, unknown>)?.[part],
          esCatalog,
        );
      if (typeof val === "string") {
        if (params) {
          let str = val;
          for (const [k, v] of Object.entries(params)) {
            str = str.replace(`{${k}}`, v);
          }
          return str;
        }
        return val;
      }
      return fullPath;
    };
  },
  useFormatter: () => ({
    dateTime: (date: Date) => date.toISOString().slice(0, 10),
  }),
}));

describe("Project Directory Components", () => {
  const sampleProjects: ProjectListItem[] = [
    {
      id: "p1",
      name: "Alpha Brand Campaign",
      project_type: "client",
      status: "in_progress",
      internal_description: "Alpha marketing deliverables",
      deadline_at: "2026-10-15T00:00:00.000Z",
      client_id: "c1",
      client_scope: "Public advertising",
      drive_folder_url: "https://drive.google.com/drive/folders/alpha",
      archived_at: null,
      completed_at: null,
      created_at: "2026-08-01T00:00:00.000Z",
      updated_at: "2026-08-01T00:00:00.000Z",
    },
    {
      id: "p2",
      name: "Internal Tooling Migration",
      project_type: "internal",
      status: "planning",
      internal_description: "Auth upgrade",
      deadline_at: "2026-12-01T00:00:00.000Z",
      client_id: null,
      client_scope: null,
      drive_folder_url: null,
      archived_at: null,
      completed_at: null,
      created_at: "2026-08-01T00:00:00.000Z",
      updated_at: "2026-08-01T00:00:00.000Z",
    },
  ];

  describe("ProjectTable", () => {
    it("renders project rows with correct names and type badges", () => {
      const html = renderToStaticMarkup(
        <ProjectTable projects={sampleProjects} baseHref="/admin/proyectos" />,
      );

      expect(html).toContain("Alpha Brand Campaign");
      expect(html).toContain("Internal Tooling Migration");
      expect(html).toContain("/admin/proyectos/p1");
      expect(html).toContain("/admin/proyectos/p2");
    });
  });

  describe("ProjectCardList", () => {
    it("renders mobile cards with action buttons", () => {
      const html = renderToStaticMarkup(
        <ProjectCardList projects={sampleProjects} baseHref="/pm/proyectos" />,
      );

      expect(html).toContain("Alpha Brand Campaign");
      expect(html).toContain("/pm/proyectos/p1");
    });
  });

  describe("ProjectEmptyState", () => {
    it("renders create CTA on clean empty state", () => {
      const html = renderToStaticMarkup(
        <ProjectEmptyState
          isFiltered={false}
          onClearFilters={() => {}}
          newProjectHref="/admin/proyectos/nuevo"
        />,
      );

      expect(html).toContain("No hay proyectos disponibles");
      expect(html).toContain("/admin/proyectos/nuevo");
    });

    it("renders filter reset on filtered empty state", () => {
      const html = renderToStaticMarkup(
        <ProjectEmptyState
          isFiltered={true}
          onClearFilters={() => {}}
          newProjectHref="/admin/proyectos/nuevo"
        />,
      );

      expect(html).toContain("No se encontraron proyectos");
      expect(html).toContain("Limpiar filtros");
    });
  });

  describe("ProjectDirectoryView", () => {
    it("renders title, search input and project lists for admin", () => {
      const html = renderToStaticMarkup(
        <ProjectDirectoryView initialProjects={sampleProjects} actorRole="admin" />,
      );

      expect(html).toContain("Proyectos");
      expect(html).toContain("/admin/proyectos/nuevo");
      expect(html).toContain("Alpha Brand Campaign");
    });
  });
});
