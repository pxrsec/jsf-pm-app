import "server-only";

import { getExternalDeliveryCapability } from "@/lib/notifications/config";
import type { AdminDiagnostics, AdminDiagnosticItem } from "./types";

export function getAdminCapabilityDiagnostics(): AdminDiagnostics {
  const capability = getExternalDeliveryCapability();

  let externalDeliveryState: AdminDiagnosticItem["state"] = "inactive";

  if (capability.kind === "disabled") {
    externalDeliveryState = "inactive";
  } else if (capability.kind === "invalid") {
    externalDeliveryState = "activation_prerequisites_incomplete";
  } else if (capability.kind === "active-ready") {
    externalDeliveryState = "configuration_requires_review";
  }

  return [
    {
      capability: "localDemoPosture",
      state: "local_demo",
    },
    {
      capability: "externalDelivery",
      state: externalDeliveryState,
    },
  ];
}
