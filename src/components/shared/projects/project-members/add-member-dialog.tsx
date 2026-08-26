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
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addProjectMemberAction } from "@/lib/projects/actions";
import type {
  ProjectDetail,
  ProjectMemberType,
  EligibleClientMember,
} from "@/lib/projects/queries";
import type { Profile } from "@/lib/projects/queries";

interface AddMemberDialogProps {
  project: ProjectDetail;
  eligiblePms: Pick<Profile, "id" | "full_name" | "role" | "avatar_url">[];
  eligibleOperators: Pick<
    Profile,
    "id" | "full_name" | "role" | "avatar_url"
  >[];
  eligibleClients: EligibleClientMember[];
  isOpen: boolean;
  onClose: () => void;
}

export function AddMemberDialog({
  project,
  eligiblePms,
  eligibleOperators,
  eligibleClients,
  isOpen,
  onClose,
}: AddMemberDialogProps) {
  const t = useTranslations("projects.members.addDialog");
  const tCapacities = useTranslations("projects.members.capacities");
  const router = useRouter();

  const [capacity, setCapacity] = useState<ProjectMemberType>("pm_lead");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [notifications, setNotifications] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const existingMemberUserIds = new Set(project.members.map((m) => m.user_id));

  // Filter candidates by excluding existing members
  const availablePms = eligiblePms.filter(
    (u) => !existingMemberUserIds.has(u.id),
  );
  const availableOperators = eligibleOperators.filter(
    (u) => !existingMemberUserIds.has(u.id),
  );
  const availableClients = eligibleClients.filter(
    (c) => c.profile_id && !existingMemberUserIds.has(c.profile_id),
  );

  const isInternal = project.project_type === "internal";
  const hasClientId = Boolean(project.client_id);

  const getUserOptions = () => {
    switch (capacity) {
      case "pm_lead":
      case "pm_watcher":
        return availablePms.map((u) => ({
          id: u.id,
          label: `${u.full_name} (${u.role.toUpperCase()})`,
        }));
      case "operator":
        return availableOperators.map((u) => ({
          id: u.id,
          label: `${u.full_name} (${u.role.toUpperCase()})`,
        }));
      case "client":
        return availableClients.map((c) => ({
          id: c.profile_id!,
          label: `${c.full_name} (${c.email})`,
        }));
    }
  };

  const userOptions = getUserOptions();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      setErrorMessage("Por favor selecciona un usuario.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const res = await addProjectMemberAction({
      project_id: project.id,
      user_id: selectedUserId,
      member_type: capacity,
      is_primary: capacity === "pm_lead" ? isPrimary : false,
      receives_notifications: notifications,
    });

    if (!res.ok) {
      setErrorMessage(res.error.message);
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    setSelectedUserId("");
    onClose();
    router.refresh();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
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
            <Label htmlFor="add-member-capacity">{t("capacityLabel")}</Label>
            <Select
              value={capacity}
              onValueChange={(val) => {
                setCapacity(val as ProjectMemberType);
                setSelectedUserId("");
              }}
              items={[
                { value: "pm_lead", label: tCapacities("pm_lead") },
                { value: "pm_watcher", label: tCapacities("pm_watcher") },
                { value: "operator", label: tCapacities("operator") },
                {
                  value: "client",
                  label: `${tCapacities("client")}${
                    isInternal
                      ? " (No disponible en proyectos internos)"
                      : !hasClientId
                        ? " (Requiere vincular cliente primero)"
                        : ""
                  }`,
                },
              ]}
            >
              <SelectTrigger id="add-member-capacity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pm_lead">
                  {tCapacities("pm_lead")}
                </SelectItem>
                <SelectItem value="pm_watcher">
                  {tCapacities("pm_watcher")}
                </SelectItem>
                <SelectItem value="operator">
                  {tCapacities("operator")}
                </SelectItem>
                <SelectItem
                  value="client"
                  disabled={isInternal || !hasClientId}
                >
                  {tCapacities("client")}
                  {isInternal && " (No disponible en proyectos internos)"}
                  {!isInternal &&
                    !hasClientId &&
                    " (Requiere vincular cliente primero)"}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="add-member-user">{t("userLabel")}</Label>
            <Select
              value={selectedUserId}
              onValueChange={(val) => {
                if (val) setSelectedUserId(val);
              }}
              items={userOptions.map((opt) => ({
                value: opt.id,
                label: opt.label,
              }))}
            >
              <SelectTrigger id="add-member-user">
                <SelectValue placeholder={t("userPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {userOptions.length === 0 ? (
                  <div className="p-2 text-xs text-muted-foreground text-center">
                    No hay usuarios disponibles en esta capacidad.
                  </div>
                ) : (
                  userOptions.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.label}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {capacity === "pm_lead" && (
            <div className="flex items-center space-x-2 pt-1">
              <Checkbox
                id="add-member-is-primary"
                checked={isPrimary}
                onCheckedChange={(checked) => setIsPrimary(Boolean(checked))}
              />
              <Label
                htmlFor="add-member-is-primary"
                className="text-xs font-normal cursor-pointer"
              >
                {t("isPrimaryLeadLabel")}
              </Label>
            </div>
          )}

          <div className="flex items-center space-x-2 pt-1">
            <Checkbox
              id="add-member-notifications"
              checked={notifications}
              onCheckedChange={(checked) => setNotifications(Boolean(checked))}
            />
            <Label
              htmlFor="add-member-notifications"
              className="text-xs font-normal cursor-pointer"
            >
              {t("notificationsLabel")}
            </Label>
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
            <Button type="submit" disabled={isSubmitting || !selectedUserId}>
              {isSubmitting ? "Agregando..." : t("submitAction")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
