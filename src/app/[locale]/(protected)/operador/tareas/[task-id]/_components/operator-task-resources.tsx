import type { OperatorTaskResource } from "@/lib/operator/types";
import { ExternalLink, Paperclip } from "lucide-react";

interface OperatorTaskResourcesProps {
  resources: OperatorTaskResource[];
  translations: {
    resourcesTitle: string;
    noResources: string;
    externalResourceAria: (name: string) => string;
  };
}

export function OperatorTaskResources({
  resources,
  translations,
}: OperatorTaskResourcesProps) {
  return (
    <section
      data-testid="operator-task-resources"
      aria-labelledby="operator-task-resources-heading"
      className="rounded-lg border border-border bg-card p-4 sm:p-5 shadow-sm"
    >
      <div className="flex items-center gap-2 mb-3">
        <Paperclip
          className="size-4 text-muted-foreground"
          aria-hidden="true"
        />
        <h2
          id="operator-task-resources-heading"
          className="text-sm font-semibold text-foreground tracking-tight"
        >
          {translations.resourcesTitle}
        </h2>
        <span className="text-xs text-muted-foreground">
          ({resources.length})
        </span>
      </div>

      {resources.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          {translations.noResources}
        </p>
      ) : (
        <ul className="divide-y divide-border/60" role="list">
          {resources.map((resource) => (
            <li key={resource.id} className="py-2.5 first:pt-0 last:pb-0">
              <a
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={translations.externalResourceAria(resource.name)}
                className="group inline-flex items-center gap-2 text-xs font-medium text-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
              >
                <span className="underline-offset-4 group-hover:underline break-all">
                  {resource.name}
                </span>
                <ExternalLink
                  className="size-3 shrink-0 text-muted-foreground group-hover:text-primary transition-colors"
                  aria-hidden="true"
                />
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
