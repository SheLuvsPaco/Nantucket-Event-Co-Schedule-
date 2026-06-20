import { eq } from "drizzle-orm";
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

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const auth = await requireApiSession(["ADMIN", "OWNER"]);
  if (auth.error) return auth.error;

  try {
    const { id } = await context.params;
    const input = eventSchema.parse(await request.json());

    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(events)
        .set({
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
          packerUserId: input.packerUserId,
          updatedAt: new Date(),
        })
        .where(eq(events.id, id))
        .returning({ id: events.id });

      if (!updated) throw new Error("Event not found.");

      await tx.delete(eventTimeline).where(eq(eventTimeline.eventId, id));
      await tx.delete(eventInventory).where(eq(eventInventory.eventId, id));
      await tx.delete(eventStaff).where(eq(eventStaff.eventId, id));
      await tx.delete(eventVehicles).where(eq(eventVehicles.eventId, id));

      if (input.timeline.length) {
        await tx.insert(eventTimeline).values(
          input.timeline.map((entry, index) => ({
            id: createId("tml"),
            eventId: id,
            time: entry.time,
            endTime: entry.endTime,
            label: entry.label,
            details: entry.details,
            sortOrder: index,
          })),
        );
      }
      if (input.inventory.length) {
        await tx
          .insert(eventInventory)
          .values(input.inventory.map((entry) => ({ eventId: id, ...entry })));
      }
      if (input.staff.length) {
        await tx
          .insert(eventStaff)
          .values(input.staff.map((entry) => ({ eventId: id, ...entry })));
      }
      if (input.vehicles.length) {
        await tx
          .insert(eventVehicles)
          .values(input.vehicles.map((entry) => ({ eventId: id, ...entry })));
      }
    });

    const event = (await getEventsForDate(input.eventDate)).find(
      (candidate) => candidate.id === id,
    );
    return Response.json(event);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  const auth = await requireApiSession(["ADMIN", "OWNER"]);
  if (auth.error) return auth.error;

  try {
    const { id } = await context.params;
    const [deleted] = await db
      .delete(events)
      .where(eq(events.id, id))
      .returning({ id: events.id });

    if (!deleted) {
      return Response.json({ error: "Event not found." }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
