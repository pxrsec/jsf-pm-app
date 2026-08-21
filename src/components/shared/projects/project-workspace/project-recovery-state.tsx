"use client";

import { useEffect } from "react";
import { Link } from "@/i18n/routing";
import { Button, buttonVariants } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { captureException } from "@/lib/sentry";

interface ProjectRecoveryStateProps {
  error: Error & { digest?: string };
  reset: () => void;
  title: string;
  description: string;
  retryLabel: string;
  returnLink?: {
    href: string;
    label: string;
  };
}

export function ProjectRecoveryState({
  error,
  reset,
  title,
  description,
  retryLabel,
  returnLink,
}: ProjectRecoveryStateProps) {
  useEffect(() => {
    captureException(error, { boundary: "localized-route" });
  }, [error]);

  return (
    <div className="container max-w-7xl mx-auto px-4 py-12 flex flex-col items-center justify-center text-center space-y-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertCircle className="h-6 w-6" aria-hidden="true" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="text-xs sm:text-sm text-muted-foreground max-w-md">
        {description}
      </p>
      <div className="flex items-center gap-3 pt-2">
        <Button onClick={reset} size="sm">
          {retryLabel}
        </Button>
        {returnLink && (
          <Link
            href={returnLink.href}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {returnLink.label}
          </Link>
        )}
      </div>
    </div>
  );
}
