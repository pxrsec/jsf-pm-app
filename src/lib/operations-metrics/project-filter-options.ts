import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { logger } from "@/lib/logger";
import type {
  MetricsProjectFilterOption,
  MetricsProjectFilterOptionsResult,
} from "./types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function fetchScopedMetricsProjectFilterOptions(
  supabase: SupabaseClient<Database>,
): Promise<MetricsProjectFilterOptionsResult> {
  try {
    const { data, error } = await supabase.rpc(
      "list_scoped_metrics_project_filter_options",
    );

    if (error || !data || !Array.isArray(data)) {
      logger.debug(
        "fetchScopedMetricsProjectFilterOptions: RPC error or invalid shape",
        {
          error: error?.message,
        },
      );
      return { status: "unavailable", code: "UNAVAILABLE" };
    }

    const seenProjectIds = new Set<string>();
    const options: MetricsProjectFilterOption[] = [];

    for (const row of data) {
      if (
        !row ||
        typeof row.project_id !== "string" ||
        !UUID_REGEX.test(row.project_id) ||
        typeof row.project_name !== "string" ||
        row.project_name.trim().length === 0
      ) {
        logger.debug(
          "fetchScopedMetricsProjectFilterOptions: malformed row encountered",
        );
        return { status: "unavailable", code: "UNAVAILABLE" };
      }

      if (seenProjectIds.has(row.project_id)) {
        logger.debug(
          "fetchScopedMetricsProjectFilterOptions: duplicate project ID encountered",
        );
        return { status: "unavailable", code: "UNAVAILABLE" };
      }
      seenProjectIds.add(row.project_id);

      options.push({
        id: row.project_id,
        name: row.project_name.trim(),
      });
    }

    options.sort(
      (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
    );

    return { status: "available", data: options };
  } catch (err) {
    logger.debug("fetchScopedMetricsProjectFilterOptions: unexpected error", {
      err,
    });
    return { status: "unavailable", code: "UNAVAILABLE" };
  }
}
