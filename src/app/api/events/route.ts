import { and, asc, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  eventInventory,
  eventStaff,
  eventTimeline,
  eventVehicles,
  events,
} from "@/db/schema";
import { requireApiSession } from "@/lib/auth";
import { getEventsForDate } from "@/lib/data";
import { apiError } from "@/lib/http";
import { createId } from "@/lib/ids";
import { eventSchema } from "@/lib/validation";

export async function GET(request: Request) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  if (date) return Response.json(await getEventsForDate(date));

  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  const rows = await db
    .select()
    .from(events)
    .where(
      start && end
        ? and(gte(events.eventDate, start), lte(events.eventDate, end))
        : undefined,
    )
    .orderBy(asc(events.eventDate), asc(events.callTime));
  return Response.json(rows);
}

export async function POST(request: Request) {
  const auth = await requireApiSession(["ADMIN", "OWNER"]);
  if (auth.error) return auth.error;

  try {
    const input = eventSchema.parse(await request.json());
    const eventId = createId("evt");

    await db.transaction(async (tx) => {
      await tx.insert(events).values({
        id: eventId,
        title: input.title,
        eventDate: input.eventDate,
        venue: input.venue,
        address: input.address,
        clientName: input.clientName,
        status: input.status,
        callTime: input.callTime,
        departureTime: input.departureTime,
        returnTime: input.returnTime,
        notes: input.notes,
        staffBrief: input.staffBrief,
        createdBy: auth.session.id,
      });

      if (input.timeline.length) {
        await tx.insert(eventTimeline).values(
          input.timeline.map((entry, index) => ({
            id: createId("tml"),
            eventId,
            time: entry.time,
            label: entry.label,
            details: entry.details,
            sortOrder: index,
          })),
        );
      }
      if (input.inventory.length) {
        await tx.insert(eventInventory).values(
          input.inventory.map((entry) => ({ eventId, ...entry })),
        );
      }
      if (input.staff.length) {
        await tx
          .insert(eventStaff)
          .values(input.staff.map((entry) => ({ eventId, ...entry })));
      }
      if (input.vehicles.length) {
        await tx.insert(eventVehicles).values(
          input.vehicles.map((entry) => ({ eventId, ...entry })),
        );
      }
    });

    const dayEvents = await getEventsForDate(input.eventDate);
    const event = dayEvents.find(
      (candidate) => candidate.id === eventId,
    );
    return Response.json(event, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
