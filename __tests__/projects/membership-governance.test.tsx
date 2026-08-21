import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import esCatalog from "../../messages/es-MX.json";

vi.mock("server-only", () => ({}));

vi.mock("@/config/app.config", () => ({
  publicConfig: {
    appUrl: "http://localhost:3000",
    supabaseUrl: "https://example.supabase.co",
    supabasePublishableKey: "sb_publishable_test_key",
  },
  serverConfig: {
    supabaseServiceRoleKey: "sb_secret_test_key",
  },
}));

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

import { MemberCapacityBadge } from "@/components/shared/projects/project-members/member-capacity-badge";
import { MemberRosterTab } from "@/components/shared/projects/project-members/member-roster-tab";
import type { ProjectDetail } from "@/lib/projects/queries";

describe("Project Membership Governance Components", () => {
  describe("MemberCapacityBadge", () => {
    it("renders primary PM lead with star and distinct highlight", () => {
      const html = renderToStaticMarkup(
        <MemberCapacityBadge capacity="pm_lead" isPrimary={true} />,
      );
      expect(html).toContain("PM Lead (Principal)");
    });

    it("renders secondary PM lead, operator, and client capacities", () => {
      const pmLeadHtml = renderToStaticMarkup(
        <MemberCapacityBadge capacity="pm_lead" isPrimary={false} />,
      );
      expect(pmLeadHtml).toContain("PM Lead");

      const operatorHtml = renderToStaticMarkup(
        <MemberCapacityBadge capacity="operator" />,
      );
      expect(operatorHtml).toContain("Operador");

      const clientHtml = renderToStaticMarkup(
        <MemberCapacityBadge capacity="client" />,
      );
      expect(clientHtml).toContain("Cliente");
    });
  });

  describe("MemberRosterTab", () => {
    const mockProject: ProjectDetail = {
      id: "p1",
      name: "Alpha Project",
      project_type: "client",
      status: "in_progress",
      internal_description: "Alpha test",
      deadline_at: "2026-10-15T00:00:00.000Z",
      client_id: "c1",
      client_scope: "Scope",
      drive_folder_url: null,
      archived_at: null,
      deleted_at: null,
      completed_at: null,
      created_at: "2026-08-01T00:00:00.000Z",
      updated_at: "2026-08-01T00:00:00.000Z",
      created_by: "u1",
      updated_by: "u1",
      members: [
        {
          id: "m1",
          project_id: "p1",
          user_id: "u1",
          member_type: "pm_lead",
          is_primary: true,
          receives_notifications: true,
          joined_at: "2026-08-01T00:00:00.000Z",
          deleted_at: null,
          created_at: "2026-08-01T00:00:00.000Z",
          updated_at: "2026-08-01T00:00:00.000Z",
          created_by: "u1",
          profile: {
            id: "u1",
            full_name: "Alice Lead",
            role: "pm",
            avatar_url: null,
            is_active: true,
          },
        },
        {
          id: "m2",
          project_id: "p1",
          user_id: "u2",
          member_type: "operator",
          is_primary: false,
          receives_notifications: true,
          joined_at: "2026-08-01T00:00:00.000Z",
          deleted_at: null,
          created_at: "2026-08-01T00:00:00.000Z",
          updated_at: "2026-08-01T00:00:00.000Z",
          created_by: "u1",
          profile: {
            id: "u2",
            full_name: "Bob Operator",
            role: "operator",
            avatar_url: null,
            is_active: true,
          },
        },
      ],
    };

    it("renders member rows, counts and add button for admin/pm_lead", () => {
      const html = renderToStaticMarkup(
        <MemberRosterTab
          project={mockProject}
          effectiveCapacity="pm_lead"
          eligiblePms={[]}
          eligibleOperators={[]}
          eligibleClients={[]}
        />,
      );

      expect(html).toContain("Alice Lead");
      expect(html).toContain("Bob Operator");
      expect(html).toContain("Agregar Miembro");
      expect(html).toContain("Total de miembros: 2");
    });

    it("hides add button and management actions for pm_watcher", () => {
      const html = renderToStaticMarkup(
        <MemberRosterTab
          project={mockProject}
          effectiveCapacity="pm_watcher"
          eligiblePms={[]}
          eligibleOperators={[]}
          eligibleClients={[]}
        />,
      );

      expect(html).toContain("Alice Lead");
      expect(html).not.toContain("Agregar Miembro");
    });
  });
});
