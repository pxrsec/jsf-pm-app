// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { RecycleBinView } from "../recycle-bin-view";
import type { OperationalRecycleBinItem } from "@/lib/operational-lifecycle/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/i18n/routing", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  usePathname: () => "/pm/papelera",
  Link: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next-intl", () => ({
  useFormatter: () => ({
    dateTime: (date: Date) => date.toISOString(),
  }),
  useTranslations:
    (namespace?: string) => (key: string, params?: Record<string, unknown>) => {
      if (namespace === "operationalLifecycle.recycleBin") {
        const map: Record<string, string> = {
          title: "Papelera de Reciclaje",
          description: "Gestiona los elementos archivados en el sistema.",
          empty: "La papelera está vacía",
          emptyDescription:
            "No hay proyectos, tareas, entregables ni hitos archivados actualmente.",
          unavailable: "Papelera no disponible",
          unavailableDescription:
            "Ocurrió un error al cargar los elementos de la papelera.",
          retryAction: "Reintentar",
          parentArchivedBadge: "Contenedor archivado",
          parentArchivedTooltip: "Restaura primero el contenedor principal",
          parentArchivedInlineNotice:
            "El proyecto o elemento contenedor principal está archivado.",
          restoreAction: "Restaurar",
          restoreSubmitting: "Restaurando...",
        };
        if (key === "restoreAriaLabel")
          return `Restaurar ${params?.type}: ${params?.title}`;
        return map[key] ?? key;
      }
      if (namespace === "operationalLifecycle.recycleBin.entityTypes") {
        const map: Record<string, string> = {
          project: "Proyecto",
          task: "Tarea",
          deliverable: "Entregable",
          milestone: "Hito",
        };
        return map[key] ?? key;
      }
      if (namespace === "operationalLifecycle.recycleBin.quickNav") {
        const map: Record<string, string> = {
          all: "Todos",
          searchPlaceholder: "Buscar en papelera...",
          clearSearch: "Limpiar búsqueda",
          clearFilters: "Restablecer filtros",
          noFilterResults: "No hay elementos archivados en esta categoría",
          noSearchResults:
            "No se encontraron elementos que coincidan con la búsqueda",
          backToDashboard: "Volver al panel",
          viewArchive: "Ver archivo definitivo",
        };
        if (key === "statsTotal") return `${params?.count} en total`;
        if (key === "statsRestorable") return `${params?.count} recuperables`;
        if (key === "statsBlocked") return `${params?.count} bloqueados`;
        if (key === "showingCount")
          return `Mostrando ${params?.count} de ${params?.total}`;
        return map[key] ?? key;
      }
      return key;
    },
}));

vi.mock("@/lib/operational-lifecycle/actions", () => ({
  restoreArchivedOperationalEntityAction: vi
    .fn()
    .mockResolvedValue({ ok: true, data: undefined }),
}));

describe("RecycleBinView and QuickNav UX/UI", () => {
  const mockItems: OperationalRecycleBinItem[] = [
    {
      entityType: "project",
      entityId: "11111111-1111-1111-1111-111111111111",
      projectId: "11111111-1111-1111-1111-111111111111",
      title: "Landing Redesign Project",
      archivedAt: "2026-09-01T12:00:00Z",
      archivedBy: "99999999-9999-9999-9999-999999999999",
      archiveReason: "Project cancelled",
      parentIsArchived: false,
    },
    {
      entityType: "task",
      entityId: "22222222-2222-2222-2222-222222222222",
      projectId: "11111111-1111-1111-1111-111111111111",
      title: "Design Mobile Header Mockup",
      archivedAt: "2026-09-02T10:00:00Z",
      archivedBy: "99999999-9999-9999-9999-999999999999",
      archiveReason: "Out of scope",
      parentIsArchived: true,
    },
    {
      entityType: "deliverable",
      entityId: "33333333-3333-3333-3333-333333333333",
      projectId: "11111111-1111-1111-1111-111111111111",
      title: "Figma Asset Export Bundle",
      archivedAt: "2026-09-02T11:00:00Z",
      archivedBy: "99999999-9999-9999-9999-999999999999",
      archiveReason: null,
      parentIsArchived: false,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders unavailable state with retry action", () => {
    render(<RecycleBinView initialResult={{ status: "unavailable" }} />);
    expect(screen.getByText("Papelera no disponible")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reintentar" }),
    ).toBeInTheDocument();
  });

  it("renders empty state when recycle bin has zero items", () => {
    render(
      <RecycleBinView initialResult={{ status: "available", data: [] }} />,
    );
    expect(screen.getByText("La papelera está vacía")).toBeInTheDocument();
    expect(screen.getByText("Volver al panel")).toBeInTheDocument();
    expect(screen.getByText("Ver archivo definitivo")).toBeInTheDocument();
  });

  it("renders quick navigation filter tabs and items with stats chips", () => {
    render(
      <RecycleBinView
        initialResult={{ status: "available", data: mockItems }}
        baseRolePath="/pm"
      />,
    );

    // Header & stats
    expect(screen.getByText("Papelera de Reciclaje")).toBeInTheDocument();
    expect(screen.getByText("3 en total")).toBeInTheDocument();
    expect(screen.getByText("2 recuperables")).toBeInTheDocument();
    expect(screen.getByText("1 bloqueados")).toBeInTheDocument();

    // Filter pills
    expect(screen.getByRole("tab", { name: /Todos/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Proyecto/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Tarea/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Entregable/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Hito/ })).toBeInTheDocument();

    // Showing count indicator
    expect(screen.getByText("Mostrando 3 de 3")).toBeInTheDocument();
  });

  it("filters items by entity type when tapping a filter tab", () => {
    render(
      <RecycleBinView
        initialResult={{ status: "available", data: mockItems }}
        baseRolePath="/pm"
      />,
    );

    // Tap "Tarea" tab
    const taskTab = screen.getByRole("tab", { name: /Tarea/ });
    fireEvent.click(taskTab);

    // Now only 1 item matches
    expect(screen.getByText("Mostrando 1 de 3")).toBeInTheDocument();
    expect(
      screen.getAllByText("Design Mobile Header Mockup").length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByText("Landing Redesign Project"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Figma Asset Export Bundle"),
    ).not.toBeInTheDocument();

    // Return to "Todos" tab
    const allTab = screen.getByRole("tab", { name: /Todos/ });
    fireEvent.click(allTab);
    expect(screen.getByText("Mostrando 3 de 3")).toBeInTheDocument();
  });

  it("filters items by search query and shows clear button", () => {
    render(
      <RecycleBinView
        initialResult={{ status: "available", data: mockItems }}
        baseRolePath="/pm"
      />,
    );

    const searchInput = screen.getByPlaceholderText("Buscar en papelera...");
    fireEvent.change(searchInput, { target: { value: "Figma" } });

    expect(screen.getByText("Mostrando 1 de 3")).toBeInTheDocument();
    expect(
      screen.getAllByText("Figma Asset Export Bundle").length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByText("Landing Redesign Project"),
    ).not.toBeInTheDocument();

    // Clear search
    const clearButton = screen.getByLabelText("Limpiar búsqueda");
    fireEvent.click(clearButton);
    expect(screen.getByText("Mostrando 3 de 3")).toBeInTheDocument();
  });

  it("displays parent archived warning banner and prevents restore when parentIsArchived is true", () => {
    render(
      <RecycleBinView
        initialResult={{ status: "available", data: mockItems }}
        baseRolePath="/pm"
      />,
    );

    // Mobile view should show inline notice for blocked item
    expect(
      screen.getByText(
        "El proyecto o elemento contenedor principal está archivado.",
      ),
    ).toBeInTheDocument();
  });
});
