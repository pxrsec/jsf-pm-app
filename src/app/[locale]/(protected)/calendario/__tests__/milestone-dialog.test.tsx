// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type {
  CalendarEventDto,
  CalendarMilestoneTargetDto,
} from "@/lib/calendar/types";
import { MilestoneDialog } from "../_components/milestone-dialog";
import { DeleteMilestoneDialog } from "../_components/delete-milestone-dialog";

const mockTranslationMap: Record<string, string> = {
  "form.createTitle": "Crear Hito de Calendario",
  "form.editTitle": "Editar Hito de Calendario",
  "form.dialogDescription": "Configura los detalles del hito",
  "form.projectLabel": "Proyecto",
  "form.projectPlaceholder": "Selecciona un proyecto...",
  "form.taskLabel": "Tarea Vinculada (Opcional)",
  "form.taskPlaceholder": "A nivel de proyecto",
  "form.titleLabel": "Título del Hito",
  "form.titlePlaceholder": "Ej. Grabación",
  "form.descriptionLabel": "Descripción",
  "form.descriptionPlaceholder": "Detalles adicionales...",
  "form.startDateLabel": "Fecha de Inicio",
  "form.endDateLabel": "Fecha de Fin (Opcional)",
  "form.isAllDayLabel": "Evento de todo el día",
  "form.startsAtLabel": "Inicio",
  "form.endsAtLabel": "Fin",
  "form.colorLabel": "Color del Hito",
  "form.defaultColor": "Predeterminado",
  "actions.cancel": "Cancelar",
  "actions.save": "Guardar Hito",
  "actions.saveChanges": "Guardar Cambios",
  "actions.confirmDelete": "¿Estás seguro de eliminar este hito?",
  "actions.deleteMilestone": "Eliminar Hito",
  "states.loadingDetail": "Cargando detalles...",
  "states.successCreate": "Hito creado exitosamente.",
  "states.successUpdate": "Hito actualizado exitosamente.",
  "states.successDelete": "Hito eliminado exitosamente.",
};

const stableT = (key: string) => mockTranslationMap[key] ?? key;

vi.mock("next-intl", () => ({
  useLocale: () => "es-MX",
  useTranslations: () => stableT,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/calendar/actions", () => ({
  createCalendarMilestoneAction: vi.fn(),
  updateCalendarMilestoneAction: vi.fn(),
  softDeleteCalendarMilestoneAction: vi.fn(),
  getCalendarMilestoneForEditAction: vi.fn(),
}));

import {
  createCalendarMilestoneAction,
  updateCalendarMilestoneAction,
  softDeleteCalendarMilestoneAction,
  getCalendarMilestoneForEditAction,
} from "@/lib/calendar/actions";

describe("Milestone Modals & Dialogs", () => {
  afterEach(() => {
    cleanup();
  });

  const mockTargets: CalendarMilestoneTargetDto[] = [
    {
      project_id: "00000000-0000-0000-0000-000000000001",
      project_name: "Documentary Film",
      task_id: "00000000-0000-0000-0000-000000000002",
      task_title: "Rough Cut Editing",
    },
  ];

  const mockCreatedEvent: CalendarEventDto = {
    entity_id: "new-e1",
    project_id: "00000000-0000-0000-0000-000000000001",
    project_name: "Documentary Film",
    task_id: null,
    title: "Sound Design Mix",
    event_type: "milestone",
    starts_at: "2026-08-25T00:00:00-06:00",
    ends_at: "2026-08-27T00:00:00-06:00",
    is_all_day: true,
    color_override: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createCalendarMilestoneAction).mockResolvedValue({
      ok: true,
      data: mockCreatedEvent,
    });
    vi.mocked(updateCalendarMilestoneAction).mockResolvedValue({
      ok: true,
      data: {
        ...mockCreatedEvent,
        entity_id: "e1",
        title: "Audio Finalization",
      },
    });
    vi.mocked(softDeleteCalendarMilestoneAction).mockResolvedValue({
      ok: true,
      data: true,
    });
    vi.mocked(getCalendarMilestoneForEditAction).mockResolvedValue({
      ok: true,
      data: {
        entity_id: "e1",
        project_id: "00000000-0000-0000-0000-000000000001",
        project_name: "Documentary Film",
        task_id: null,
        title: "Audio Finalization",
        description: "Keep strictly confidential",
        starts_at: "2026-08-25T00:00:00-06:00",
        ends_at: null,
        is_all_day: true,
        color_override: null,
      },
    });
  });

  describe("MilestoneDialog Create Flow", () => {
    it("renders create modal with target projects and submits cleanly", async () => {
      const handleSuccess = vi.fn();
      const handleClose = vi.fn();

      render(
        <MilestoneDialog
          isOpen={true}
          mode="create"
          targets={mockTargets}
          onClose={handleClose}
          onSuccess={handleSuccess}
        />,
      );

      expect(screen.getByText("Crear Hito de Calendario")).toBeInTheDocument();

      const projectSelect = screen.getByLabelText("Proyecto");
      fireEvent.change(projectSelect, {
        target: { value: "00000000-0000-0000-0000-000000000001" },
      });

      const titleInput = screen.getByLabelText("Título del Hito");
      fireEvent.change(titleInput, { target: { value: "Sound Design Mix" } });

      const startDateInput = screen.getByLabelText("Fecha de Inicio");
      fireEvent.change(startDateInput, { target: { value: "2026-08-25" } });

      const endDateInput = screen.getByLabelText("Fecha de Fin (Opcional)");
      fireEvent.change(endDateInput, { target: { value: "2026-08-26" } });

      const form = screen.getByRole("dialog").querySelector("form");
      expect(form).not.toBeNull();
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(createCalendarMilestoneAction).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Sound Design Mix",
            projectId: "00000000-0000-0000-0000-000000000001",
            isAllDay: true,
          }),
        );
      });

      expect(handleSuccess).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });
  });

  describe("MilestoneDialog Edit Flow", () => {
    it("fetches edit detail on-demand and preserves description", async () => {
      const handleSuccess = vi.fn();
      const handleClose = vi.fn();

      render(
        <MilestoneDialog
          isOpen={true}
          mode="edit"
          editEventId="e1"
          targets={mockTargets}
          onClose={handleClose}
          onSuccess={handleSuccess}
        />,
      );

      await waitFor(() => {
        expect(getCalendarMilestoneForEditAction).toHaveBeenCalledWith({
          eventId: "e1",
        });
      });

      await waitFor(() => {
        expect(
          screen.getByDisplayValue("Audio Finalization"),
        ).toBeInTheDocument();
      });

      expect(
        screen.getByDisplayValue("Keep strictly confidential"),
      ).toBeInTheDocument();

      const form = screen.getByRole("dialog").querySelector("form");
      expect(form).not.toBeNull();
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(updateCalendarMilestoneAction).toHaveBeenCalledWith(
          expect.objectContaining({
            eventId: "e1",
            title: "Audio Finalization",
            description: "Keep strictly confidential",
          }),
        );
      });

      expect(handleSuccess).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });
  });

  describe("DeleteMilestoneDialog", () => {
    it("renders confirmation and calls softDeleteCalendarMilestoneAction", async () => {
      const handleSuccess = vi.fn();
      const handleClose = vi.fn();

      render(
        <DeleteMilestoneDialog
          isOpen={true}
          eventId="del-e1"
          eventTitle="Old Milestone"
          onClose={handleClose}
          onSuccess={handleSuccess}
        />,
      );

      expect(
        screen.getByText("¿Estás seguro de eliminar este hito?"),
      ).toBeInTheDocument();
      expect(screen.getByText(/Old Milestone/)).toBeInTheDocument();

      const confirmButton = screen.getByRole("button", {
        name: "Eliminar Hito",
      });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(softDeleteCalendarMilestoneAction).toHaveBeenCalledWith({
          eventId: "del-e1",
        });
      });

      expect(handleSuccess).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });
  });
});
