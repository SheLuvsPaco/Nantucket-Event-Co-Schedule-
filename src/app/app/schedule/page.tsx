import type { Metadata } from "next";
import {
  endOfMonth,
  endOfWeek,
  format,
  isValid,
  parse,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ScheduleCalendar } from "@/components/schedule-calendar";
import { BusinessFilterMenu } from "@/components/business-filter-menu";
import { PdfImportTrigger } from "@/components/pdf-import-trigger";
import { QuickAddTrigger } from "@/components/quick-add-trigger";
import { requireSession } from "@/lib/auth";
import {
  businesses,
  businessFilterParam,
  parseBusinessFilter,
} from "@/lib/businesses";
import { formatDateKey, getTodayKey } from "@/lib/date";
import { getCalendarEvents } from "@/lib/data";
import { env } from "@/lib/env";
import { isCrewRole } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Schedule",
};

function resolveMonth(value: string | undefined, todayKey: string) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return todayKey.slice(0, 7);
  const date = parse(value, "yyyy-MM", new Date());
  return isValid(date) ? value : todayKey.slice(0, 7);
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; businesses?: string }>;
}) {
  const [session, params] = await Promise.all([
    requireSession(),
    searchParams,
  ]);
  const todayKey = getTodayKey(env.COMPANY_TIMEZONE);
  const monthKey = resolveMonth(params.month, todayKey);
  const monthDate = parse(monthKey, "yyyy-MM", new Date());
  const rangeStart = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 0 });
  const rangeEnd = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 0 });
  const crewView = isCrewRole(session.role);
  const selectedBusinesses = crewView
    ? [session.business]
    : parseBusinessFilter(params.businesses, [...businesses]);
  const calendarEvents = await getCalendarEvents(
    formatDateKey(rangeStart),
    formatDateKey(rangeEnd),
    { businesses: selectedBusinesses },
  );
  const businessParam = crewView ? null : businessFilterParam(selectedBusinesses);
  const querySuffix = businessParam ? `?businesses=${businessParam}` : "";

  return (
    <div className="page-shell">
      <div className="page-heading schedule-heading">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", width: "100%" }}>
          <div>
            <p className="eyebrow">
              {crewView ? "Crew schedule" : "Season operations"}
            </p>
            <h1>{format(monthDate, "MMMM yyyy")}</h1>
          </div>
          {!crewView ? (
            <div style={{ display: "grid", gap: "10px", justifyItems: "end" }}>
              <BusinessFilterMenu
                basePath="/app/schedule"
                monthKey={monthKey}
                selected={selectedBusinesses}
              />
              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                <PdfImportTrigger />
                <QuickAddTrigger defaultBusiness={selectedBusinesses.length === 1 ? selectedBusinesses[0] : undefined} />
              </div>
            </div>
          ) : null}
        </div>
        <p className="schedule-intro">
          {crewView
            ? "Tap a date. Read the plan. Show up ready."
            : "Every event, crew call, truck, and pack list in one place."}
        </p>
      </div>

      <ScheduleCalendar
        events={calendarEvents}
        monthKey={monthKey}
        querySuffix={querySuffix}
        todayKey={todayKey}
      />
    </div>
  );
}
