import { and, asc, eq, gte, lte } from "drizzle-orm";
import { after } from "next/server";
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
import { eventAssignmentNotification } from "@/lib/notification-content";
import { sendPushToUsers } from "@/lib/push-notifications";
import { isCrewRole } from "@/lib/roles";
import { eventSchema } from "@/lib/validation";

export async function GET(request: Request) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  const crewView = isCrewRole(auth.session.role);
  if (date) {
    return Response.json(
      await getEventsForDate(date, {
        businesses: crewView ? [auth.session.business] : undefined,
      }),
    );
  }

  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  const rows = await db
    .select()
    .from(events)
    .where(
      and(
        start && end
          ? and(gte(events.eventDate, start), lte(events.eventDate, end))
          : undefined,
        crewView ? eq(events.business, auth.session.business) : undefined,
      ),
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
        business: input.business,
        status: input.status,
        callTime: input.callTime,
        departureTime: input.departureTime,
        returnTime: input.returnTime,
        notes: input.notes,
        staffBrief: input.staffBrief,
        packerUserId: input.packerUserId,
        createdBy: auth.session.id,
      });

      if (input.timeline.length) {
        await tx.insert(eventTimeline).values(
          input.timeline.map((entry, index) => ({
            id: createId("tml"),
            eventId,
            time: entry.time,
            endTime: entry.endTime,
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

    const dayEvents = await getEventsForDate(input.eventDate, {
      businesses: [input.business],
    });
    const event = dayEvents.find(
      (candidate) => candidate.id === eventId,
    );
    const assignedUserIds = input.staff.map((entry) => entry.userId);
    if (assignedUserIds.length) {
      after(async () => {
        await sendPushToUsers(
          assignedUserIds,
          eventAssignmentNotification({
            eventId,
            title: input.title,
            eventDate: input.eventDate,
            callTime: input.callTime,
          }),
        );
      });
    }
    return Response.json(event, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
