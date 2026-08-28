"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { getCalendarMilestoneForEditAction } from "@/lib/calendar/actions";
import type { CalendarMilestoneEditDetailDto } from "@/lib/calendar/types";
import { formatCalendarDate } from "@/lib/calendar/date-utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function MilestoneDetailDialog({
  eventId,
  isOpen,
  onClose,
}: {
  eventId?: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("calendar");
  const locale = useLocale();
  const [detail, setDetail] = useState<CalendarMilestoneEditDetailDto | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!isOpen || !eventId) return;
    let active = true;
    void Promise.resolve()
      .then(async () => {
        if (!active) return;
        setDetail(null);
        setUnavailable(false);
        setLoading(true);
        return getCalendarMilestoneForEditAction({ eventId });
      })
      .then((result) => {
        if (!active || !result) return;
        if (result.ok) setDetail(result.data);
        else setUnavailable(true);
        setLoading(false);
      })
      .catch(() => {
        if (active) {
          setUnavailable(true);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [eventId, isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("detail.title")}</DialogTitle>
          <DialogDescription>{t("detail.description")}</DialogDescription>
        </DialogHeader>
        {loading && (
          <div className="flex min-h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
        {unavailable && (
          <p className="text-sm text-muted-foreground">
            {t("detail.unavailable")}
          </p>
        )}
        {detail && (
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">{t("detail.name")}</dt>
              <dd className="font-medium">{detail.title}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("detail.project")}</dt>
              <dd>{detail.project_name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("detail.starts")}</dt>
              <dd>
                {detail.is_all_day
                  ? t("table.allDay")
                  : formatCalendarDate(detail.starts_at, locale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
              </dd>
            </div>
            {detail.ends_at && (
              <div>
                <dt className="text-muted-foreground">{t("detail.ends")}</dt>
                <dd>
                  {formatCalendarDate(detail.ends_at, locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </dd>
              </div>
            )}
            {detail.description && (
              <div>
                <dt className="text-muted-foreground">
                  {t("detail.descriptionLabel")}
                </dt>
                <dd className="whitespace-pre-wrap">{detail.description}</dd>
              </div>
            )}
          </dl>
        )}
        <DialogFooter>
          <Button type="button" onClick={onClose}>
            {t("detail.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
