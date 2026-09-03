"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { ClientContactAdministrationDto } from "@/lib/clients/types";
import {
  User,
  Building2,
  Edit2,
  CheckCircle2,
  HelpCircle,
  Briefcase,
  Mail,
  Loader2,
} from "lucide-react";

interface ContactCardProps {
  contact: ClientContactAdministrationDto;
  orgName: string | null;
  selectedProjectId: string;
  isAssociated: boolean;
  isMutating: boolean;
  isLoadingAssociations: boolean;
  onToggleAssociation: (contactId: string, nextAssociated: boolean) => void;
  onOpenEdit: (contact: ClientContactAdministrationDto) => void;
  t: (key: string) => string;
}

const NO_PROJECT_SELECTED = "__none__";

export function ContactCard({
  contact,
  orgName,
  selectedProjectId,
  isAssociated,
  isMutating,
  isLoadingAssociations,
  onToggleAssociation,
  onOpenEdit,
  t,
}: ContactCardProps) {
  const isDirect = contact.clientId === null;
  const isLinked = contact.profileId !== null;
  const hasProjectSelected = selectedProjectId !== NO_PROJECT_SELECTED;

  return (
    <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-3 transition-colors">
      {/* Top row: Name, Icon, and Edit button */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
            {isDirect ? (
              <User className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Building2 className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <h4 className="font-semibold text-sm text-foreground truncate">
              {contact.fullName}
            </h4>
            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
              {isDirect ? (
                <Badge
                  variant="secondary"
                  className="font-normal text-[11px] bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20"
                >
                  {t("directContactBadge")}
                </Badge>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground truncate">
                    {orgName ?? t("unknownOrg")}
                  </span>
                  {contact.isPrimary && (
                    <Badge
                      variant="outline"
                      className="text-[10px] h-4 px-1 font-normal text-muted-foreground"
                    >
                      {t("primaryBadge")}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0 shrink-0"
          onClick={() => onOpenEdit(contact)}
          aria-label={`${t("editContactAria")} ${contact.fullName}`}
        >
          <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>

      {/* Details: Job Title, Email, Account Status */}
      <div className="grid grid-cols-1 gap-2 pt-1 border-t border-border/50 text-xs">
        {contact.jobTitle && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Briefcase className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{contact.jobTitle}</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-muted-foreground font-mono">
          <Mail className="h-3.5 w-3.5 shrink-0 font-sans" />
          <span className="truncate">{contact.email}</span>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-muted-foreground">
            {t("columns.accountStatus")}:
          </span>
          {isLinked ? (
            <Badge
              variant="outline"
              className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-normal text-[11px]"
            >
              <CheckCircle2 className="h-3 w-3" />
              <span>{t("accountLinked")}</span>
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="gap-1 border-border text-muted-foreground font-normal text-[11px]"
            >
              <HelpCircle className="h-3 w-3" />
              <span>{t("noAccount")}</span>
            </Badge>
          )}
        </div>
      </div>

      {/* Project Association Toggle Section (if project selected in toolbar) */}
      {hasProjectSelected && (
        <div className="pt-2 border-t border-border/50">
          {isDirect ? (
            <label className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/40 cursor-pointer hover:bg-muted/60 transition-colors">
              <span className="text-xs font-medium text-foreground">
                {t("columns.projectAssociated")}
              </span>
              <div className="flex items-center">
                {isLoadingAssociations ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <Checkbox
                    checked={isAssociated}
                    onCheckedChange={(checked) =>
                      onToggleAssociation(contact.id, Boolean(checked))
                    }
                    disabled={isMutating}
                    aria-label={`${t("toggleAssociationAria")} ${contact.fullName}`}
                  />
                )}
              </div>
            </label>
          ) : (
            <p className="text-[11px] text-muted-foreground italic px-1">
              {t("orgContactNotToggled")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
