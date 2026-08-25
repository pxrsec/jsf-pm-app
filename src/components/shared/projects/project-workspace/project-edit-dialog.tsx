"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { updateProjectAction } from "@/lib/projects/actions";
import type { ProjectDetail } from "@/lib/projects/queries";
import type { ClientListItem } from "@/lib/clients/queries";

interface ProjectEditDialogProps {
  project: ProjectDetail;
  clients: ClientListItem[];
  isOpen: boolean;
  onClose: () => void;
}

export function ProjectEditDialog({
  project,
  clients,
  isOpen,
  onClose,
}: ProjectEditDialogProps) {
  const t = useTranslations("projects.workspace.editDialog");
  const tForm = useTranslations("projects.create.fields");
  const router = useRouter();

  const [name, setName] = useState(project.name);
  const [internalDescription, setInternalDescription] = useState(
    project.internal_description,
  );
  const [deadlineAt, setDeadlineAt] = useState(
    project.deadline_at
      ? new Date(project.deadline_at).toISOString().slice(0, 16)
      : "",
  );
  const [clientId, setClientId] = useState<string | undefined>(
    project.client_id ?? undefined,
  );
  const [clientScope, setClientScope] = useState(project.client_scope ?? "");
  const [driveFolderUrl, setDriveFolderUrl] = useState(
    project.drive_folder_url ?? "",
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const payload: {
      name: string;
      internal_description: string;
      deadline_at?: string;
      client_id?: string | null;
      client_scope?: string | null;
      drive_folder_url?: string | null;
    } = {
      name: name.trim(),
      internal_description: internalDescription.trim(),
      deadline_at: deadlineAt ? new Date(deadlineAt).toISOString() : undefined,
      client_scope: clientScope.trim() ? clientScope.trim() : null,
      drive_folder_url: driveFolderUrl.trim() ? driveFolderUrl.trim() : null,
    };

    if (project.project_type === "client") {
      payload.client_id = clientId ?? null;
    }

    const res = await updateProjectAction(project.id, payload);

    if (!res.ok) {
      setErrorMessage(res.error.message);
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    onClose();
    router.refresh();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {errorMessage && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive">
              {errorMessage}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="edit-project-name">{tForm("nameLabel")}</Label>
            <Input
              id="edit-project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={1}
              maxLength={200}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-project-desc">
              {tForm("descriptionLabel")}
            </Label>
            <Textarea
              id="edit-project-desc"
              value={internalDescription}
              onChange={(e) => setInternalDescription(e.target.value)}
              rows={3}
              required
              minLength={1}
              maxLength={2000}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-project-deadline">
              {tForm("deadlineLabel")}
            </Label>
            <Input
              id="edit-project-deadline"
              type="datetime-local"
              value={deadlineAt}
              onChange={(e) => setDeadlineAt(e.target.value)}
              required
            />
          </div>

          {project.project_type === "client" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="edit-project-client-org">
                  {t("clientOrgLabel")}
                </Label>
                <Select
                  value={clientId ?? "none"}
                  onValueChange={(val) =>
                    setClientId(val === "none" || !val ? undefined : val)
                  }
                  items={[
                    {
                      value: "none",
                      label: <em>Sin cliente asignado</em>,
                    },
                    ...clients.map((c) => ({
                      value: c.id,
                      label: c.display_name,
                    })),
                  ]}
                >
                  <SelectTrigger id="edit-project-client-org">
                    <SelectValue placeholder={t("clientOrgPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <em>Sin cliente asignado</em>
                    </SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-project-client-scope">
                  {tForm("clientScopeLabel")}
                </Label>
                <Textarea
                  id="edit-project-client-scope"
                  value={clientScope}
                  onChange={(e) => setClientScope(e.target.value)}
                  rows={2}
                  maxLength={1000}
                  placeholder={tForm("clientScopePlaceholder")}
                />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="edit-project-drive-url">
              {tForm("driveLabel")}
            </Label>
            <Input
              id="edit-project-drive-url"
              type="url"
              value={driveFolderUrl}
              onChange={(e) => setDriveFolderUrl(e.target.value)}
              placeholder={tForm("drivePlaceholder")}
            />
          </div>

          <DialogFooter className="pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {t("cancelAction")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("saving") : t("saveAction")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
