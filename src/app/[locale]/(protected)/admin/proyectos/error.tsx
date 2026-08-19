"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function AdminProjectsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin Projects Error:", error);
  }, [error]);

  return (
    <div className="container max-w-7xl mx-auto px-4 py-12 flex flex-col items-center justify-center text-center space-y-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">
        Error al cargar proyectos
      </h2>
      <p className="text-xs sm:text-sm text-muted-foreground max-w-md">
        Ocurrió un error inesperado al cargar el directorio de proyectos.
      </p>
      <Button onClick={reset} size="sm">
        Intentar nuevamente
      </Button>
    </div>
  );
}
