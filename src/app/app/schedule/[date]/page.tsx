import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { EventWorkspace } from "@/components/event-workspace";
import { StaffDayView } from "@/components/staff-day-view";
import { requireSession } from "@/lib/auth";
import {
  businesses,
  businessFilterParam,
  parseBusinessFilter,
} from "@/lib/businesses";
import { formatLongDate, isDateKey, monthKeyFromDate } from "@/lib/date";
import {
  getEventsForDate,
  getInventory,
  getPeople,
  getVehicles,
} from "@/lib/data";
import { isCrewRole } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Daily schedule",
};

export default async function DailySchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ event?: string; create?: string; businesses?: string }>;
}) {
  const [{ date }, query, session] = await Promise.all([
    params,
    searchParams,
    requireSession(),
  ]);
  if (!isDateKey(date)) notFound();

  const crewView = isCrewRole(session.role);
  const selectedBusinesses = crewView
    ? [session.business]
    : parseBusinessFilter(query.businesses, [...businesses]);
  const businessParam = crewView ? null : businessFilterParam(selectedBusinesses);
  const businessQuery = businessParam ? `&businesses=${businessParam}` : "";
  const eventQuery = businessParam ? `?businesses=${businessParam}` : "";
  const dayEvents = await getEventsForDate(date, {
    businesses: selectedBusinesses,
  });
  const backHref = `/app/schedule?month=${monthKeyFromDate(date)}${businessQuery}`;

  if (crewView) {
    return (
      <StaffDayView
        backHref={backHref}
        date={date}
        events={dayEvents}
        sessionUserId={session.id}
      />
    );
  }

  const [inventory, people, vehicles] = await Promise.all([
    getInventory(true),
    getPeople(true),
    getVehicles(true),
  ]);
  const selectedId =
    query.create === "1" ? null : query.event ?? dayEvents.at(0)?.id ?? null;

  return (
    <div className="page-shell">
      <div className="day-page-heading">
        <div>
          <Link className="back-link" href={backHref}>
            <ArrowLeft aria-hidden="true" />
            Back to calendar
          </Link>
          <p className="eyebrow">Daily operations</p>
          <h1>{formatLongDate(date)}</h1>
        </div>
        <Link
          className="button button-primary"
          href={`/app/schedule/${date}?create=1${businessQuery}`}
        >
          <Plus aria-hidden="true" />
          Add event
        </Link>
      </div>

      <EventWorkspace
        date={date}
        defaultBusiness={selectedBusinesses.length === 1 ? selectedBusinesses[0] : undefined}
        events={dayEvents}
        filterQuery={eventQuery}
        inventory={inventory}
        people={people}
        selectedId={selectedId}
        vehicles={vehicles}
      />
    </div>
  );
}
