import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { buttonVariants } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default async function PmProjectDetailNotFound() {
  const t = await getTranslations("projects.workspace.recovery");

  return (
    <div className="container max-w-7xl mx-auto px-4 py-12 flex flex-col items-center justify-center text-center space-y-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertCircle className="h-6 w-6" aria-hidden="true" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">
        {t("workspace.title")}
      </h2>
      <p className="text-xs sm:text-sm text-muted-foreground max-w-md">
        {t("pmWorkspace.description")}
      </p>
      <div className="pt-2">
        <Link
          href="/pm/proyectos"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          {t("returnToAssignedProjectsAction")}
        </Link>
      </div>
    </div>
  );
}
