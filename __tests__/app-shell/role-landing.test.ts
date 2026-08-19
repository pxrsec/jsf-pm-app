import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import esCatalog from "../../messages/es-MX.json";

vi.mock("server-only", () => ({}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async (namespace?: string) => {
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
  }),
}));

import { AdminShell } from "@/app/[locale]/(protected)/admin/_components/admin-shell";
import { PmShell } from "@/app/[locale]/(protected)/pm/_components/pm-shell";
import { OperatorShell } from "@/app/[locale]/(protected)/operador/_components/operator-shell";
import { ClientShell } from "@/app/[locale]/(protected)/cliente/_components/client-shell";
import type { Profile } from "@/lib/auth/session";

function createMockProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "u-1",
    role: "admin",
    full_name: "Test User",
    avatar_url: null,
    is_active: true,
    deleted_at: null,
    phone_e164: null,
    preferred_locale: "es-MX",
    timezone: "America/Mexico_City",
    email_notifications_enabled: true,
    whatsapp_opt_in: false,
    whatsapp_consent_at: null,
    whatsapp_consent_ip: null,
    whatsapp_consent_source: null,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    last_seen_at: null,
    ...overrides,
  };
}

describe("Role Landing Shell Components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Admin Landing (AdminShell)", () => {
    const adminProfile: Profile = createMockProfile({
      id: "admin-1",
      full_name: "Valeria Admin",
      role: "admin",
      phone_e164: "+525500000001",
    });

    it("renders welcoming heading and project list with localized status badges", async () => {
      const mockData = {
        projects: [
          {
            id: "proj-1",
            name: "Docuserie Joya",
            status: "in_progress" as const,
            deadline_at: "2026-11-30T00:00:00Z",
          },
          {
            id: "proj-2",
            name: "Comercial Verano",
            status: "planning" as const,
            deadline_at: "2026-12-15T00:00:00Z",
          },
        ],
      };

      const html = renderToStaticMarkup(
        await AdminShell({ profile: adminProfile, data: mockData }),
      );

      expect(html).toContain("Bienvenido, Valeria Admin");
      expect(html).toContain("Proyectos recientes");
      expect(html).toContain("Docuserie Joya");
      expect(html).toContain("Comercial Verano");
      expect(html).toContain("En progreso");
      expect(html).toContain("Planificación");
    });

    it("renders admin empty-state message when zero projects exist", async () => {
      const html = renderToStaticMarkup(
        await AdminShell({
          profile: adminProfile,
          data: { projects: [] },
        }),
      );

      expect(html).toContain("Bienvenido, Valeria Admin");
      expect(html).toContain("No hay proyectos registrados.");
    });
  });

  describe("PM Landing (PmShell)", () => {
    const pmProfile: Profile = createMockProfile({
      id: "pm-1",
      full_name: "Carlos PM",
      role: "pm",
      phone_e164: "+525500000002",
    });

    it("renders welcoming heading and assigned projects list", async () => {
      const mockData = {
        projects: [
          {
            id: "proj-1",
            name: "Campaña Primavera",
            status: "in_progress" as const,
            deadline_at: "2026-10-01T00:00:00Z",
            member_type: "pm_lead" as const,
            is_primary: true,
          },
        ],
      };

      const html = renderToStaticMarkup(
        await PmShell({ profile: pmProfile, data: mockData }),
      );

      expect(html).toContain("Bienvenido, Carlos PM");
      expect(html).toContain("Mis proyectos asignados");
      expect(html).toContain("Campaña Primavera");
      expect(html).toContain("Lead");
      expect(html).toContain("En progreso");
    });

    it("renders PM empty-state message when no memberships exist", async () => {
      const html = renderToStaticMarkup(
        await PmShell({
          profile: pmProfile,
          data: { projects: [] },
        }),
      );

      expect(html).toContain("Bienvenido, Carlos PM");
      expect(html).toContain("No tienes proyectos asignados actualmente.");
    });
  });

  describe("Operator Landing (OperatorShell)", () => {
    const opProfile: Profile = createMockProfile({
      id: "op-1",
      full_name: "Lucía Operadora",
      role: "operator",
      phone_e164: "+525500000003",
    });

    it("renders welcoming heading and active task agenda", async () => {
      const mockData = {
        agendaItems: [
          {
            task_id: "task-1",
            task_title: "Edición Teaser",
            task_status: "in_progress" as const,
            task_priority: "high" as const,
            project_name: "Docuserie Joya",
            task_deadline_at: "2026-08-30T18:00:00Z",
          },
        ],
      };

      const html = renderToStaticMarkup(
        await OperatorShell({ profile: opProfile, data: mockData }),
      );

      expect(html).toContain("Bienvenido, Lucía Operadora");
      expect(html).toContain("Mi agenda de tareas");
      expect(html).toContain("Edición Teaser");
      expect(html).toContain("Docuserie Joya");
      expect(html).toContain("Alta");
    });

    it("renders operator empty-state message when agenda is empty", async () => {
      const html = renderToStaticMarkup(
        await OperatorShell({
          profile: opProfile,
          data: { agendaItems: [] },
        }),
      );

      expect(html).toContain("Bienvenido, Lucía Operadora");
      expect(html).toContain("No tienes tareas pendientes en tu agenda.");
    });
  });

  describe("Client Landing (ClientShell)", () => {
    const clientProfile: Profile = createMockProfile({
      id: "client-1",
      full_name: "Roberto Cliente",
      role: "client",
      phone_e164: "+525500000004",
    });

    it("renders welcoming heading and client projects list", async () => {
      const mockData = {
        projects: [
          {
            id: "proj-1",
            name: "Spot Publicitario",
            status: "in_progress" as const,
            deadline_at: "2026-09-20T00:00:00Z",
            client_name: "Acme Corp",
          },
        ],
      };

      const html = renderToStaticMarkup(
        await ClientShell({
          profile: clientProfile,
          data: mockData,
        }),
      );

      expect(html).toContain("Bienvenido, Roberto Cliente");
      expect(html).toContain("Mis proyectos");
      expect(html).toContain("Spot Publicitario");
      expect(html).toContain("En progreso");
    });

    it("renders client empty-state message when zero projects exist", async () => {
      const html = renderToStaticMarkup(
        await ClientShell({
          profile: clientProfile,
          data: { projects: [] },
        }),
      );

      expect(html).toContain("Bienvenido, Roberto Cliente");
      expect(html).toContain("No tienes proyectos activos asociados.");
    });
  });
});
