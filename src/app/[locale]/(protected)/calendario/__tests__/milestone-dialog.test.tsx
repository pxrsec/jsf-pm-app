// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string | number>) =>
    values?.title ? `${key}:${values.title}` : key,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
vi.mock("@/lib/calendar/actions", () => ({
  createMilestoneAction: vi.fn(),
  updateMilestoneAction: vi.fn(),
  getMilestoneDetailAction: vi.fn(),
}));

import { MilestoneDialog } from "../_components/milestone-dialog";

afterEach(cleanup);

const targets = [
  {
    projectId: "00000000-0000-0000-0000-000000000001",
    projectName: "Project One",
    taskId: "00000000-0000-0000-0000-000000000011",
    taskTitle: "First task",
    taskStatus: "in_progress",
  },
  {
    projectId: "00000000-0000-0000-0000-000000000001",
    projectName: "Project One",
    taskId: "00000000-0000-0000-0000-000000000012",
    taskTitle: "Second task",
    taskStatus: "blocked",
  },
  {
    projectId: "00000000-0000-0000-0000-000000000002",
    projectName: "Project Two",
    taskId: "00000000-0000-0000-0000-000000000021",
    taskTitle: "Other project task",
    taskStatus: "pending",
  },
];

function renderDialog() {
  return render(
    <MilestoneDialog
      isOpen
      mode="create"
      targets={targets}
      onClose={vi.fn()}
      onSuccess={vi.fn()}
    />,
  );
}

describe("MilestoneDialog", () => {
  it("filters company task exploration by project and supports multiple checkbox selections", () => {
    renderDialog();

    fireEvent.change(screen.getByRole("combobox", { name: "browseProjectLabel" }), {
      target: { value: targets[0].projectId },
    });

    expect(screen.getByText("First task")).toBeInTheDocument();
    expect(screen.getByText("Second task")).toBeInTheDocument();
    expect(screen.queryByText("Other project task")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "selectTaskAria:First task" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "selectTaskAria:Second task" }));

    expect(screen.getByText("First task")).toBeInTheDocument();
    expect(screen.getByText("Second task")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "removeTaskAria:First task" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "removeTaskAria:Second task" })).toHaveLength(1);
  });

  it("limits project milestones to the chosen project and removes relations explicitly", () => {
    renderDialog();

    fireEvent.click(screen.getAllByRole("radio")[0]);
    fireEvent.change(screen.getByRole("combobox", { name: "form.projectLabel" }), {
      target: { value: targets[0].projectId },
    });

    expect(screen.getByText("First task")).toBeInTheDocument();
    expect(screen.queryByText("Other project task")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "selectTaskAria:First task" }));
    fireEvent.click(screen.getByRole("button", { name: "removeTaskAria:First task" }));

    expect(screen.getByText("noRelatedTasks")).toBeInTheDocument();
  });
});
