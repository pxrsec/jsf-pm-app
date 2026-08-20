"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function PmProjectDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("PM Project Detail Error:", error);
  }, [error]);

  return (
    <div className="container max-w-7xl mx-auto px-4 py-12 flex flex-col items-center justify-center text-center space-y-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">
        Error al cargar el espacio de trabajo
      </h2>
      <p className="text-xs sm:text-sm text-muted-foreground max-w-md">
        No se pudo cargar la información del proyecto o no tienes asignación en
        este proyecto.
      </p>
      <div className="flex items-center gap-3 pt-2">
        <Button onClick={reset} size="sm">
          Intentar nuevamente
        </Button>
        <Link
          href="/pm/proyectos"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Volver a Mis Proyectos
        </Link>
      </div>
    </div>
  );
}
