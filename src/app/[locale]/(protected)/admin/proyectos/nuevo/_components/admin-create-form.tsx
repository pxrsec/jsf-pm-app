"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Briefcase, Building2, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createProjectAction } from "@/lib/projects/actions";
import type { ClientListItem } from "@/lib/clients/queries";
import type { Profile } from "@/lib/projects/queries";

interface AdminCreateFormProps {
  clients: ClientListItem[];
  eligiblePms: Pick<Profile, "id" | "full_name" | "role" | "avatar_url">[];
}

export function AdminCreateForm({ clients, eligiblePms }: AdminCreateFormProps) {
  const t = useTranslations("projects.create");
  const tForm = useTranslations("projects.create.fields");
  const tTypes = useTranslations("projects.types");
  const router = useRouter();

  const [projectType, setProjectType] = useState<"client" | "internal">("client");
  const [name, setName] = useState("");
  const [internalDescription, setInternalDescription] = useState("");
  const [deadlineAt, setDeadlineAt] = useState("");
  const [driveFolderUrl, setDriveFolderUrl] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [clientScope, setClientScope] = useState("");
  const [initialPmLeadId, setInitialPmLeadId] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!initialPmLeadId) {
      setErrorMessage("Por favor selecciona un PM Lead principal.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const payload = {
      name: name.trim(),
      project_type: projectType,
      internal_description: internalDescription.trim(),
      deadline_at: new Date(deadlineAt).toISOString(),
      client_id: projectType === "client" && clientId ? clientId : null,
      client_scope:
        projectType === "client" && clientScope.trim() ? clientScope.trim() : null,
      drive_folder_url: driveFolderUrl.trim() ? driveFolderUrl.trim() : null,
      initial_pm_lead_user_id: initialPmLeadId,
    };

    const res = await createProjectAction(payload);

    if (!res.ok) {
      setErrorMessage(res.error.message);
      setIsSubmitting(false);
      return;
    }

    router.push(`/admin/proyectos/${res.data.id}`);
  };

  return (
    <div className="container max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/admin/proyectos" className="hover:text-foreground transition-colors">
          Proyectos
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">{t("title")}</span>
      </nav>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("title")}</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{t("subtitle")}</p>
      </div>

      <Card className="border-border bg-card">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {errorMessage && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
                {errorMessage}
              </div>
            )}

            {/* Project Type Selector */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">{tForm("typeLabel")}</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  onClick={() => setProjectType("client")}
                  className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition-all ${
                    projectType === "client"
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:bg-muted/30"
                  }`}
                >
                  <Building2 className={`h-5 w-5 mt-0.5 shrink-0 ${projectType === "client" ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-foreground">{tTypes("client")}</p>
                    <p className="text-xs text-muted-foreground">{tTypes("clientDescription")}</p>
                  </div>
                </div>

                <div
                  onClick={() => {
                    setProjectType("internal");
                    setClientId("");
                    setClientScope("");
                  }}
                  className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition-all ${
                    projectType === "internal"
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:bg-muted/30"
                  }`}
                >
                  <Briefcase className={`h-5 w-5 mt-0.5 shrink-0 ${projectType === "internal" ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-foreground">{tTypes("internal")}</p>
                    <p className="text-xs text-muted-foreground">{tTypes("internalDescription")}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Project Name */}
            <div className="space-y-1.5">
              <Label htmlFor="create-project-name">{tForm("nameLabel")}</Label>
              <Input
                id="create-project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={tForm("namePlaceholder")}
                required
                minLength={1}
                maxLength={200}
              />
            </div>

            {/* Internal Description */}
            <div className="space-y-1.5">
              <Label htmlFor="create-project-description">{tForm("descriptionLabel")}</Label>
              <Textarea
                id="create-project-description"
                value={internalDescription}
                onChange={(e) => setInternalDescription(e.target.value)}
                placeholder={tForm("descriptionPlaceholder")}
                rows={3}
                required
                minLength={1}
                maxLength={2000}
              />
            </div>

            {/* Deadline */}
            <div className="space-y-1.5">
              <Label htmlFor="create-project-deadline">{tForm("deadlineLabel")}</Label>
              <Input
                id="create-project-deadline"
                type="datetime-local"
                value={deadlineAt}
                onChange={(e) => setDeadlineAt(e.target.value)}
                required
              />
            </div>

            {/* Drive Folder URL */}
            <div className="space-y-1.5">
              <Label htmlFor="create-project-drive-url">{tForm("driveLabel")}</Label>
              <Input
                id="create-project-drive-url"
                type="url"
                value={driveFolderUrl}
                onChange={(e) => setDriveFolderUrl(e.target.value)}
                placeholder={tForm("drivePlaceholder")}
              />
            </div>

            {/* Client Conditional Fields */}
            {projectType === "client" && (
              <div className="p-4 rounded-lg border border-border bg-muted/20 space-y-4">
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Configuración de Cliente (Opcional en Planificación)
                </h4>

                <div className="space-y-1.5">
                  <Label htmlFor="create-project-client-org">{tForm("clientOrgLabel")}</Label>
                  <Select
                    value={clientId}
                    onValueChange={(val) => {
                      setClientId(val ?? "");
                    }}
                  >
                    <SelectTrigger id="create-project-client-org">
                      <SelectValue placeholder={tForm("clientOrgPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.display_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="create-project-client-scope">{tForm("clientScopeLabel")}</Label>
                  <Textarea
                    id="create-project-client-scope"
                    value={clientScope}
                    onChange={(e) => setClientScope(e.target.value)}
                    placeholder={tForm("clientScopePlaceholder")}
                    rows={2}
                    maxLength={1000}
                  />
                </div>
              </div>
            )}

            {/* Primary PM Lead Assignment (Admin picks) */}
            <div className="space-y-1.5">
              <Label htmlFor="create-project-pm-lead">{tForm("primaryPmLeadLabel")}</Label>
              <Select
                value={initialPmLeadId}
                onValueChange={(val) => {
                  if (val) setInitialPmLeadId(val);
                }}
                required
              >
                <SelectTrigger id="create-project-pm-lead">
                  <SelectValue placeholder={tForm("primaryPmLeadPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {eligiblePms.map((pm) => (
                    <SelectItem key={pm.id} value={pm.id}>
                      {pm.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Submit Bar */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <Link href="/admin/proyectos" className={buttonVariants({ variant: "outline" })}>
                {tForm("cancelAction")}
              </Link>
              <Button type="submit" disabled={isSubmitting || !name || !internalDescription || !deadlineAt || !initialPmLeadId}>
                {isSubmitting ? tForm("creating") : tForm("submitAction")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
