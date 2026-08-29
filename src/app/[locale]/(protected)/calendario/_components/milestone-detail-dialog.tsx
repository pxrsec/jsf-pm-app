"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Link } from "@/i18n/routing";
import { getMilestoneDetailAction } from "@/lib/calendar/actions";
import type { MilestoneDetailDto, MilestoneTaskDto } from "@/lib/calendar/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MilestoneDetailDialogProps {
  milestoneId?: string;
  isOpen: boolean;
  canManage: boolean;
  userRole: "admin" | "pm" | "operator" | "client";
  onClose: () => void;
  onEdit: (id: string, focusTasks?: boolean) => void;
  onDelete: (id: string, title: string) => void;
}

interface DetailContentProps extends Omit<MilestoneDetailDialogProps, "isOpen"> {
  milestoneId: string;
}

const statusKeys: Record<string, string> = {
  pending: "pending",
  in_progress: "in_progress",
  in_review: "in_review",
  blocked: "blocked",
  completed: "completed",
};

export function MilestoneDetailDialog({ isOpen, milestoneId, ...props }: MilestoneDetailDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && props.onClose()}>
      {isOpen && milestoneId && <MilestoneDetailContent key={milestoneId} milestoneId={milestoneId} {...props} />}
    </Dialog>
  );
}

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-1 rounded-md border border-border bg-muted/20 p-3"><dt className="text-xs font-medium text-muted-foreground">{label}</dt><dd className="text-sm text-foreground">{children}</dd></div>;
}

function TaskList({ tasks, userRole }: { tasks: readonly MilestoneTaskDto[]; userRole: MilestoneDetailDialogProps["userRole"] }) {
  const t = useTranslations("calendar.detail");
  const tStatus = useTranslations("projects.workspace.overview");
  const basePath = userRole === "admin" ? "/admin/proyectos" : "/pm/proyectos";
  return (
    <section className="space-y-3" aria-labelledby="milestone-related-tasks">
      <h3 id="milestone-related-tasks" className="text-sm font-semibold text-foreground">{t("relatedTasks")}</h3>
      {tasks.length === 0 ? <p className="text-sm text-muted-foreground">{t("untracked")}</p> : <ul className="space-y-2">{tasks.map((task) => <li key={task.taskId}><Link href={`${basePath}/${task.projectId}?tab=tasks`} className="block rounded-md border border-border bg-card p-3 text-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="block font-medium text-foreground">{task.title}</span><span className="mt-1 block text-xs text-muted-foreground">{task.projectName} · {tStatus(`taskStatus.${statusKeys[task.status] ?? "pending"}`)}</span></Link></li>)}</ul>}
    </section>
  );
}

function MilestoneDetailContent({ milestoneId, canManage, userRole, onClose, onEdit, onDelete }: DetailContentProps) {
  const t = useTranslations("calendar");
  const locale = useLocale();
  const [result, setResult] = useState<{ status: "loading" } | { status: "unavailable" } | { status: "ready"; detail: MilestoneDetailDto }>({ status: "loading" });

  useEffect(() => {
    let active = true;
    void getMilestoneDetailAction({ milestoneId }).then((response) => {
      if (active) setResult(response.ok ? { status: "ready", detail: response.data } : { status: "unavailable" });
    }).catch(() => active && setResult({ status: "unavailable" }));
    return () => { active = false; };
  }, [milestoneId]);

  const detail = result.status === "ready" ? result.detail : null;
  const progress = detail && detail.activeTaskCount > 0 ? Math.round((detail.completedTaskCount / detail.activeTaskCount) * 100) : null;
  const targetDate = detail ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${detail.targetDate}T00:00:00Z`)) : "";

  return <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{t("detail.title")}</DialogTitle><DialogDescription>{t("detail.description")}</DialogDescription></DialogHeader>{result.status === "loading" && <Loader2 className="mx-auto my-10 size-6 animate-spin" />}{result.status === "unavailable" && <p role="alert" className="text-sm text-muted-foreground">{t("detail.unavailable")}</p>}{detail && <div className="space-y-5"><dl className="grid gap-3 sm:grid-cols-2"><DetailField label={t("detail.milestoneTitle")}>{detail.title}</DetailField><DetailField label={t("detail.milestoneType")}>{detail.scope === "company" ? t("scope.companyMilestone") : t("scope.projectMilestone")}</DetailField><DetailField label={t("detail.targetDate")}>{targetDate}</DetailField>{detail.projectName && <DetailField label={t("detail.project")}>{detail.projectName}</DetailField>}{detail.description && <div className="sm:col-span-2"><DetailField label={t("detail.descriptionLabel")}>{detail.description}</DetailField></div>}</dl>{progress === null ? <p className="rounded-md border border-border bg-muted/20 p-3 text-sm text-muted-foreground">{t("detail.untracked")}</p> : <section className="space-y-2" aria-labelledby="milestone-progress"><h3 id="milestone-progress" className="text-sm font-semibold text-foreground">{t("detail.progressLabel")}</h3><p className="text-sm text-muted-foreground">{progress}% · {detail.completedTaskCount} / {detail.activeTaskCount}</p><div role="progressbar" aria-label={t("detail.progressLabel")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="h-2 rounded bg-muted"><div className="h-full rounded bg-primary" style={{ width: `${progress}%` }} /></div></section>}<TaskList tasks={detail.tasks} userRole={userRole} /></div>}<DialogFooter>{canManage && detail && <><Button variant="outline" onClick={() => onEdit(detail.milestoneId)}>{t("actions.editMilestone")}</Button><Button variant="outline" onClick={() => onEdit(detail.milestoneId, true)}>{t("actions.addTasks")}</Button><Button variant="destructive" onClick={() => onDelete(detail.milestoneId, detail.title)}>{t("actions.deleteMilestone")}</Button></>}<Button onClick={onClose}>{t("actions.close")}</Button></DialogFooter></DialogContent>;
}
