import { Link } from "@/i18n/routing";
import { CheckCircle2, FolderKanban } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OperatorAgendaEmptyStateProps {
  translations: {
    title: string;
    description: string;
    browseProjectsAction: string;
  };
}

export function OperatorAgendaEmptyState({
  translations,
}: OperatorAgendaEmptyStateProps) {
  return (
    <div
      data-testid="operator-agenda-empty"
      className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 p-8 text-center sm:p-12"
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <CheckCircle2 className="size-6" aria-hidden="true" />
      </div>

      <h3 className="mt-4 text-base font-semibold text-foreground">
        {translations.title}
      </h3>

      <p className="mt-1 max-w-sm text-xs text-muted-foreground">
        {translations.description}
      </p>

      <div className="mt-6">
        <Link
          href="/operador/proyectos"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "inline-flex items-center gap-2",
          )}
        >
          <FolderKanban className="size-4" aria-hidden="true" />
          <span>{translations.browseProjectsAction}</span>
        </Link>
      </div>
    </div>
  );
}
