"use client";

import { Clock } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import {
  hoursAreConfigured,
  parseWorkDays,
  WEEKDAY_UI,
  weekdayMessagePath,
  type ShopHoursFields,
} from "@/lib/shop-hours";
import { cn } from "@/lib/utils";

export function ShopHoursNotice({
  hours,
  className,
}: {
  hours?: ShopHoursFields | null;
  className?: string;
}) {
  const { t } = useI18n();
  if (!hoursAreConfigured(hours)) return null;

  if (hours?.alwaysOpen) {
    return (
      <p
        className={cn(
          "flex items-start gap-1.5 text-xs text-muted-foreground",
          className,
        )}
      >
        <Clock className="mt-0.5 size-3.5 shrink-0 text-trust" />
        <span>
          <span className="font-semibold text-foreground">
            {t("hours.always")}
          </span>
        </span>
      </p>
    );
  }

  const days = parseWorkDays(hours?.workDays);
  const dayLabels = WEEKDAY_UI.filter((d) => days.includes(d))
    .map((d) => t(weekdayMessagePath(d)))
    .join(", ");

  return (
    <p
      className={cn(
        "flex items-start gap-1.5 text-xs text-muted-foreground",
        className,
      )}
    >
      <Clock className="mt-0.5 size-3.5 shrink-0 text-primary" />
      <span>
        <span className="font-semibold text-foreground">
          {t("hours.openDays")}:
        </span>{" "}
        {dayLabels}
        {hours?.hoursEnd ? (
          <>
            {" · "}
            <span className="font-semibold text-foreground">
              {t("hours.closeAt")}
            </span>{" "}
            {hours.hoursEnd}
            {hours.hoursStart ? ` (${hours.hoursStart}–${hours.hoursEnd})` : ""}
          </>
        ) : null}
      </span>
    </p>
  );
}
