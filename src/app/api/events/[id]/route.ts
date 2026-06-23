import { eq } from "drizzle-orm";
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
import { getTodayKey } from "@/lib/date";
import { getEventsForDate } from "@/lib/data";
import { env } from "@/lib/env";
import { apiError } from "@/lib/http";
import { createId } from "@/lib/ids";
import {
  eventAssignmentNotification,
  eventUpdatedNotification,
  vehicleAssignmentNotification,
} from "@/lib/notification-content";
import { sendPushToUsers } from "@/lib/push-notifications";
import { eventSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

function sortedJson<T>(values: T[]) {
  return JSON.stringify(
    [...values].sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
    ),
  );
}

export async function PATCH(request: Request, context: Context) {
  const auth = await requireApiSession(["ADMIN", "OWNER"]);
  if (auth.error) return auth.error;

  try {
    const { id } = await context.params;
    const input = eventSchema.parse(await request.json());
    const previous = await db.query.events.findFirst({
      where: eq(events.id, id),
      with: {
        timeline: true,
        inventory: true,
        staff: true,
        vehicles: true,
      },
    });

    if (!previous) {
      return Response.json({ error: "Event not found." }, { status: 404 });
    }

    const previousStaffIds = previous.staff.map((entry) => entry.userId);
    const currentStaffIds = input.staff.map((entry) => entry.userId);
    const previousStaffSet = new Set(previousStaffIds);
    const newlyAssignedUserIds = currentStaffIds.filter(
      (userId) => !previousStaffSet.has(userId),
    );
    const retainedUserIds = currentStaffIds.filter((userId) =>
      previousStaffSet.has(userId),
    );

    const previousVehicleSignature = sortedJson(
      previous.vehicles.map((entry) => ({
        vehicleId: entry.vehicleId,
        driverUserId: entry.driverUserId,
        destination: entry.destination,
        departureTime: entry.departureTime,
        notes: entry.notes,
      })),
    );
    const currentVehicleSignature = sortedJson(input.vehicles);
    const vehiclesChanged =
      previousVehicleSignature !== currentVehicleSignature;

    const previousEventSignature = JSON.stringify({
      title: previous.title,
      eventDate: previous.eventDate,
      venue: previous.venue,
      address: previous.address,
      clientName: previous.clientName,
      status: previous.status,
      callTime: previous.callTime,
      departureTime: previous.departureTime,
      returnTime: previous.returnTime,
      notes: previous.notes,
      staffBrief: previous.staffBrief,
      packerUserId: previous.packerUserId,
      timeline: sortedJson(
        previous.timeline.map((entry) => ({
          time: entry.time,
          endTime: entry.endTime,
          label: entry.label,
          details: entry.details,
          sortOrder: entry.sortOrder,
        })),
      ),
      inventory: sortedJson(
        previous.inventory.map((entry) => ({
          inventoryItemId: entry.inventoryItemId,
          quantity: entry.quantity,
          packed: entry.packed,
          notes: entry.notes,
        })),
      ),
      staff: sortedJson(
        previous.staff.map((entry) => ({
          userId: entry.userId,
          assignment: entry.assignment,
          callTime: entry.callTime,
          notes: entry.notes,
        })),
      ),
      vehicles: previousVehicleSignature,
    });
    const currentEventSignature = JSON.stringify({
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
      timeline: sortedJson(
        input.timeline.map((entry, index) => ({
          time: entry.time,
          endTime: entry.endTime,
          label: entry.label,
          details: entry.details,
          sortOrder: index,
        })),
      ),
      inventory: sortedJson(input.inventory),
      staff: sortedJson(input.staff),
      vehicles: currentVehicleSignature,
    });
    const eventChanged = previousEventSignature !== currentEventSignature;

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

    if (newlyAssignedUserIds.length || (eventChanged && retainedUserIds.length)) {
      after(async () => {
        const deliveries: Promise<unknown>[] = [];
        if (newlyAssignedUserIds.length) {
          deliveries.push(
            sendPushToUsers(
              newlyAssignedUserIds,
              eventAssignmentNotification({
                eventId: id,
                title: input.title,
                eventDate: input.eventDate,
                callTime: input.callTime,
              }),
            ),
          );
        }
        if (eventChanged && retainedUserIds.length) {
          deliveries.push(
            sendPushToUsers(
              retainedUserIds,
              eventUpdatedNotification({
                eventId: id,
                title: input.title,
                eventDate: input.eventDate,
                isToday:
                  input.eventDate === getTodayKey(env.COMPANY_TIMEZONE),
              }),
            ),
          );
        }
        if (vehiclesChanged && currentStaffIds.length) {
          deliveries.push(
            sendPushToUsers(
              currentStaffIds,
              vehicleAssignmentNotification({
                eventId: id,
                title: input.title,
                eventDate: input.eventDate,
              }),
            ),
          );
        }
        await Promise.all(deliveries);
      });
    }
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
