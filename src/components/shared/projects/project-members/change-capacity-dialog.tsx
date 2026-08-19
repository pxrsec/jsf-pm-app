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
import { updateProjectMemberAction } from "@/lib/projects/actions";
import type {
  ProjectMemberWithProfile,
  ProjectMemberType,
} from "@/lib/projects/queries";

interface ChangeCapacityDialogProps {
  projectId: string;
  member: ProjectMemberWithProfile | null;
  isOpen: boolean;
  onClose: () => void;
}

interface ChangeCapacityFormProps {
  projectId: string;
  member: ProjectMemberWithProfile;
  onClose: () => void;
}

function ChangeCapacityForm({
  projectId,
  member,
  onClose,
}: ChangeCapacityFormProps) {
  const t = useTranslations("projects.members.changeDialog");
  const tCapacities = useTranslations("projects.members.capacities");
  const router = useRouter();

  const [capacity, setCapacity] = useState<ProjectMemberType>(
    member.member_type,
  );
  const [notifications, setNotifications] = useState(
    member.receives_notifications ?? true,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const role = member.profile?.role;

  // Determine allowed capacities for the user's system role
  const allowedCapacities: ProjectMemberType[] = [];
  if (role === "admin" || role === "pm") {
    allowedCapacities.push("pm_lead", "pm_watcher");
  } else if (role === "operator") {
    allowedCapacities.push("operator");
  } else if (role === "client") {
    allowedCapacities.push("client");
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const res = await updateProjectMemberAction(member.id, projectId, {
      member_id: member.id,
      member_type: capacity,
      receives_notifications: notifications,
    });

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
    <form onSubmit={handleSubmit} className="space-y-4 py-2">
      {errorMessage && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive">
          {errorMessage}
        </div>
      )}

      {allowedCapacities.length > 1 ? (
        <div className="space-y-1.5">
          <Label htmlFor="change-capacity-select">
            {t("capacityLabel")}
          </Label>
          <Select
            value={capacity}
            onValueChange={(val) => setCapacity(val as ProjectMemberType)}
          >
            <SelectTrigger id="change-capacity-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allowedCapacities.map((c) => (
                <SelectItem key={c} value={c}>
                  {tCapacities(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">
            {t("capacityLabel")}
          </span>
          <p className="text-sm font-medium text-foreground">
            {tCapacities(capacity)}
          </p>
        </div>
      )}

      <div className="flex items-center space-x-2 pt-1">
        <Checkbox
          id="change-member-notifications"
          checked={notifications}
          onCheckedChange={(checked) => setNotifications(Boolean(checked))}
        />
        <Label
          htmlFor="change-member-notifications"
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
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Guardando..." : t("submitAction")}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ChangeCapacityDialog({
  projectId,
  member,
  isOpen,
  onClose,
}: ChangeCapacityDialogProps) {
  const t = useTranslations("projects.members.changeDialog");

  if (!member) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description", {
              name: member.profile?.full_name ?? "este miembro",
            })}
          </DialogDescription>
        </DialogHeader>

        <ChangeCapacityForm
          key={member.id}
          projectId={projectId}
          member={member}
          onClose={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}
