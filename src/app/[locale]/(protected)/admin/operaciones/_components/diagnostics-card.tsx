import { getTranslations } from "next-intl/server";
import { Cpu } from "lucide-react";
import type { AdminDiagnostics } from "@/lib/admin-operations/types";

interface DiagnosticsCardProps {
  diagnostics: AdminDiagnostics;
}

export async function DiagnosticsCard({ diagnostics }: DiagnosticsCardProps) {
  const t = await getTranslations("adminOperations.diagnostics");

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <Cpu className="h-4 w-4 text-primary" aria-hidden="true" />
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            {t("title")}
          </h2>
          <p className="text-xs text-muted-foreground">{t("description")}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <caption className="sr-only">{t("tableCaption")}</caption>
          <thead>
            <tr className="border-b border-border/80 text-muted-foreground font-medium">
              <th scope="col" className="pb-2 pl-1">
                {t("columns.capability")}
              </th>
              <th scope="col" className="pb-2">
                {t("columns.state")}
              </th>
              <th scope="col" className="pb-2 pr-1">
                {t("columns.meaning")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {diagnostics.map((item) => (
              <tr
                key={item.capability}
                className="hover:bg-muted/30 transition-colors"
              >
                <td className="py-2.5 pl-1 font-semibold text-foreground">
                  {t(`capabilities.${item.capability}`)}
                </td>
                <td className="py-2.5">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                      item.state === "local_demo"
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200 border border-blue-200 dark:border-blue-800"
                        : item.state === "inactive"
                          ? "bg-muted text-muted-foreground border border-border"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200 border border-amber-200 dark:border-amber-800"
                    }`}
                  >
                    {t(`states.${item.state}`)}
                  </span>
                </td>
                <td className="py-2.5 pr-1 text-muted-foreground">
                  {t(`meanings.${item.state}`)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
