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
import { requireSession } from "@/lib/auth";
import { formatDateKey, getTodayKey } from "@/lib/date";
import { getCalendarEvents } from "@/lib/data";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Only Me",
};

function resolveMonth(value: string | undefined, todayKey: string) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return todayKey.slice(0, 7);
  const date = parse(value, "yyyy-MM", new Date());
  return isValid(date) ? value : todayKey.slice(0, 7);
}

export default async function OnlyMePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const [session, params] = await Promise.all([
    requireSession(["LEAD", "STAFF"]),
    searchParams,
  ]);
  const todayKey = getTodayKey(env.COMPANY_TIMEZONE);
  const monthKey = resolveMonth(params.month, todayKey);
  const monthDate = parse(monthKey, "yyyy-MM", new Date());
  const rangeStart = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 0 });
  const rangeEnd = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 0 });
  const calendarEvents = await getCalendarEvents(
    formatDateKey(rangeStart),
    formatDateKey(rangeEnd),
    session.id,
  );

  return (
    <div className="page-shell">
      <div className="page-heading schedule-heading">
        <div>
          <p className="eyebrow">My assignments</p>
          <h1>{format(monthDate, "MMMM yyyy")}</h1>
        </div>
        <p className="schedule-intro">
          Only the jobs where you are assigned. Use Schedule to see the full crew plan.
        </p>
      </div>

      <ScheduleCalendar
        basePath="/app/only-me"
        events={calendarEvents}
        monthKey={monthKey}
        todayKey={todayKey}
      />
    </div>
  );
}
