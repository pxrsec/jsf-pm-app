"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ProjectFilters } from "./project-filters";
import { ProjectTable } from "./project-table";
import { ProjectCardList } from "./project-card-list";
import { ProjectEmptyState } from "./project-empty-state";
import type { ProjectListItem } from "@/lib/projects/queries";

interface ProjectDirectoryViewProps {
  initialProjects: ProjectListItem[];
  actorRole: "admin" | "pm";
}

export function ProjectDirectoryView({
  initialProjects,
  actorRole,
}: ProjectDirectoryViewProps) {
  const t = useTranslations("projects.directory");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const baseHref = actorRole === "admin" ? "/admin/proyectos" : "/pm/proyectos";
  const newProjectHref = `${baseHref}/nuevo`;

  const filteredProjects = useMemo(() => {
    return initialProjects.filter((project) => {
      // Search query matches name or client_scope
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = project.name.toLowerCase().includes(query);
        const matchesScope =
          project.client_scope?.toLowerCase().includes(query) ?? false;
        if (!matchesName && !matchesScope) return false;
      }

      // Status filter
      if (statusFilter !== "all" && project.status !== statusFilter) {
        return false;
      }

      // Type filter
      if (typeFilter !== "all" && project.project_type !== typeFilter) {
        return false;
      }

      return true;
    });
  }, [initialProjects, searchQuery, statusFilter, typeFilter]);

  const isFiltered =
    searchQuery.trim() !== "" || statusFilter !== "all" || typeFilter !== "all";

  const handleClearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setTypeFilter("all");
  };

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("title")}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {actorRole === "admin" ? t("adminSubtitle") : t("pmSubtitle")}
          </p>
        </div>

        <Link
          href={newProjectHref}
          className={buttonVariants({
            size: "sm",
            className: "h-9 gap-1.5 self-start sm:self-auto",
          })}
        >
          <Plus className="h-4 w-4" />
          <span>{t("newProjectAction")}</span>
        </Link>
      </div>

      <ProjectFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        typeFilter={typeFilter}
        onTypeChange={setTypeFilter}
      />

      {filteredProjects.length === 0 ? (
        <ProjectEmptyState
          isFiltered={isFiltered}
          onClearFilters={handleClearFilters}
          newProjectHref={newProjectHref}
        />
      ) : (
        <>
          {/* Desktop Table View (>= 768px) */}
          <div className="hidden md:block">
            <ProjectTable projects={filteredProjects} baseHref={baseHref} />
          </div>

          {/* Mobile Cards View (< 768px) */}
          <div className="block md:hidden">
            <ProjectCardList projects={filteredProjects} baseHref={baseHref} />
          </div>
        </>
      )}
    </div>
  );
}
