import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StaffDayView } from "@/components/staff-day-view";
import { requireSession } from "@/lib/auth";
import { isDateKey, monthKeyFromDate } from "@/lib/date";
import { getEventsForDate } from "@/lib/data";

export const metadata: Metadata = {
  title: "My jobs",
};

export default async function OnlyMeDayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const [{ date }, session] = await Promise.all([
    params,
    requireSession(["STAFF"]),
  ]);
  if (!isDateKey(date)) notFound();

  const dayEvents = await getEventsForDate(date, session.id);

  return (
    <StaffDayView
      backHref={`/app/only-me?month=${monthKeyFromDate(date)}`}
      date={date}
      emptyDescription="You are not assigned to any jobs on this date. Check Schedule to see the full crew plan."
      emptyTitle="No jobs assigned to you"
      events={dayEvents}
      sessionUserId={session.id}
    />
  );
}
