import "server-only";
import { revalidatePath } from "next/cache";
import type {
  OperationalLifecycleEntityType,
  OperationalLifecycleMutationCode,
} from "./types";

export function revalidateLifecycleScope(
  entityType: OperationalLifecycleEntityType,
  outcome: OperationalLifecycleMutationCode,
): void {
  if (
    outcome !== "archived" &&
    outcome !== "restored" &&
    outcome !== "permanently_deleted"
  ) {
    return;
  }

  // Common invalidations across all operational lifecycle mutations
  revalidatePath("/[locale]/(protected)/admin/papelera", "page");
  revalidatePath("/[locale]/(protected)/pm/papelera", "page");
  revalidatePath("/[locale]/(protected)/calendario", "page");

  switch (entityType) {
    case "project":
      revalidatePath("/[locale]/(protected)/admin/proyectos", "page");
      revalidatePath("/[locale]/(protected)/pm/proyectos", "page");
      revalidatePath("/[locale]/(protected)/admin/proyectos/[id]", "page");
      revalidatePath("/[locale]/(protected)/pm/proyectos/[id]", "page");
      // Project archival cascades to deliverables, so finalized archive views must be revalidated
      revalidatePath("/[locale]/(protected)/admin/archivo", "page");
      revalidatePath("/[locale]/(protected)/pm/archivo", "page");
      revalidatePath("/[locale]/(protected)/admin/metricas", "page");
      revalidatePath("/[locale]/(protected)/pm/metricas", "page");
      break;

    case "task":
      revalidatePath("/[locale]/(protected)/admin/proyectos/[id]", "page");
      revalidatePath("/[locale]/(protected)/pm/proyectos/[id]", "page");
      revalidatePath("/[locale]/(protected)/operador/agenda", "page");
      revalidatePath("/[locale]/(protected)/operador/proyectos", "page");
      revalidatePath("/[locale]/(protected)/cliente/proyectos", "page");
      break;

    case "deliverable":
      revalidatePath("/[locale]/(protected)/admin/proyectos/[id]", "page");
      revalidatePath("/[locale]/(protected)/pm/proyectos/[id]", "page");
      revalidatePath("/[locale]/(protected)/admin/archivo", "page");
      revalidatePath("/[locale]/(protected)/pm/archivo", "page");
      break;

    case "milestone":
      revalidatePath("/[locale]/(protected)/admin/proyectos/[id]", "page");
      revalidatePath("/[locale]/(protected)/pm/proyectos/[id]", "page");
      break;
  }
}
