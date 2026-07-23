import { and, eq, inArray } from "drizzle-orm";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import {
  eventInventory,
  eventStaff,
  eventTimeline,
  eventVehicles,
  events,
  inventoryItems,
  users,
  vehicles,
} from "@/db/schema";
import { requireApiSession } from "@/lib/auth";
import { getTodayKey } from "@/lib/date";
import { env } from "@/lib/env";
import { apiError } from "@/lib/http";
import { createId } from "@/lib/ids";
import {
  eventAssignmentNotification,
  eventUpdatedNotification,
  vehicleAssignmentNotification,
  type PushNotificationPayload,
} from "@/lib/notification-content";
import { sendPushToUsers } from "@/lib/push-notifications";
import {
  hasJobCardChanged,
  normalizeDraftForWrite,
  quickAddPublishSchema,
  type QuickAddEventDraft,
  type ReconciliationEvent,
} from "@/lib/quick-add-reconciliation";

export const runtime = "nodejs";

type NotificationJob = {
  userIds: string[];
  payload: PushNotificationPayload;
};

function sortedJson<T>(values: T[]) {
  return JSON.stringify(
    [...values].sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
    ),
  );
}

function vehicleSignature(draft: QuickAddEventDraft | ReconciliationEvent) {
  return sortedJson(
    draft.vehicles.map((entry) => ({
      vehicleId: entry.vehicleId,
      driverUserId: entry.driverUserId,
      destination: entry.destination,
      departureTime: entry.departureTime,
      notes: entry.notes,
    })),
  );
}

function uniqueIds(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function assertSubset({
  ids,
  validIds,
  label,
}: {
  ids: string[];
  validIds: Set<string>;
  label: string;
}) {
  const invalid = ids.filter((id) => !validIds.has(id));
  if (invalid.length) {
    throw new Error(
      `${label} no longer belongs to this branch or is no longer active: ${invalid.join(
        ", ",
      )}`,
    );
  }
}

async function insertRelations(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  eventId: string,
  draft: QuickAddEventDraft,
) {
  if (draft.timeline.length) {
    await tx.insert(eventTimeline).values(
      draft.timeline.map((entry, index) => ({
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

  if (draft.inventory.length) {
    await tx.insert(eventInventory).values(
      draft.inventory.map((entry, index) => ({
        id: createId("evi"),
        eventId,
        ...entry,
        section: null,
        sortOrder: index,
      })),
    );
  }

  if (draft.staff.length) {
    await tx
      .insert(eventStaff)
      .values(draft.staff.map((entry) => ({ eventId, ...entry })));
  }

  if (draft.vehicles.length) {
    await tx
      .insert(eventVehicles)
      .values(draft.vehicles.map((entry) => ({ eventId, ...entry })));
  }
}

export async function POST(request: Request) {
  const auth = await requireApiSession(["ADMIN", "OWNER"]);
  if (auth.error) return auth.error;

  try {
    const input = quickAddPublishSchema.parse(await request.json());
    const writeRows = input.rows.filter((row) => row.action !== "skip");
    const skippedCount = input.rows.length - writeRows.length;
    const businessSet = new Set(writeRows.map((row) => row.draft.business));

    if (businessSet.size > 1) {
      return Response.json(
        { error: "Publish one branch at a time." },
        { status: 400 },
      );
    }

    const business = [...businessSet][0] ?? input.rows[0]?.draft.business ?? null;
    if (!business) {
      return Response.json({
        createdCount: 0,
        updatedCount: 0,
        skippedCount,
        reviewedCount: 0,
        createdIds: [],
        updatedIds: [],
      });
    }

    const targetUpdateIds = uniqueIds(
      writeRows
        .filter((row) => row.action === "update")
        .map((row) => row.matchedEventId ?? ""),
    );

    const [validStaff, validVehicles, validInventory, existingUpdates] =
      await Promise.all([
        db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.active, true), eq(users.business, business))),
        db
          .select({ id: vehicles.id })
          .from(vehicles)
          .where(and(eq(vehicles.active, true), eq(vehicles.business, business))),
        db
          .select({ id: inventoryItems.id })
          .from(inventoryItems)
          .where(
            and(eq(inventoryItems.active, true), eq(inventoryItems.business, business)),
          ),
        targetUpdateIds.length
          ? db.query.events.findMany({
              where: inArray(events.id, targetUpdateIds),
              with: {
                timeline: true,
                inventory: true,
                staff: true,
                vehicles: true,
              },
            })
          : Promise.resolve([]),
      ]);

    const validStaffIds = new Set(validStaff.map((row) => row.id));
    const validVehicleIds = new Set(validVehicles.map((row) => row.id));
    const validInventoryIds = new Set(validInventory.map((row) => row.id));
    const updateMap = new Map(
      (existingUpdates as ReconciliationEvent[]).map((event) => [event.id, event]),
    );

    for (const row of writeRows) {
      if (row.action === "update" && !row.matchedEventId) {
        return Response.json(
          { error: "Choose an existing event before publishing an update." },
          { status: 400 },
        );
      }

      if (row.draft.business !== business) {
        return Response.json(
          { error: "Every selected job must belong to the same branch." },
          { status: 400 },
        );
      }

      if (row.action === "update") {
        const previous = updateMap.get(row.matchedEventId!);
        if (!previous) {
          return Response.json(
            { error: "One of the selected events no longer exists." },
            { status: 404 },
          );
        }
        if (previous.business !== business) {
          return Response.json(
            { error: "Cannot update an event from another branch." },
            { status: 403 },
          );
        }
      }

      const staffIds = row.draft.staff.map((entry) => entry.userId);
      const driverIds = row.draft.vehicles.flatMap((entry) =>
        entry.driverUserId ? [entry.driverUserId] : [],
      );
      const packerIds = row.draft.packerUserId ? [row.draft.packerUserId] : [];
      assertSubset({
        ids: [...staffIds, ...driverIds, ...packerIds],
        validIds: validStaffIds,
        label: "A staff member",
      });
      assertSubset({
        ids: row.draft.vehicles.map((entry) => entry.vehicleId),
        validIds: validVehicleIds,
        label: "A vehicle",
      });
      assertSubset({
        ids: row.draft.inventory.map((entry) => entry.inventoryItemId),
        validIds: validInventoryIds,
        label: "An inventory item",
      });
    }

    const createdIds: string[] = [];
    const updatedIds: string[] = [];
    const notifications: NotificationJob[] = [];

    await db.transaction(async (tx) => {
      for (const row of writeRows) {
        if (row.action === "create") {
          const draft = normalizeDraftForWrite(row.draft);
          const eventId = createId("evt");

          await tx.insert(events).values({
            id: eventId,
            title: draft.title,
            eventDate: draft.eventDate,
            venue: draft.venue,
            address: draft.address,
            clientName: draft.clientName,
            business: draft.business,
            status: draft.status,
            callTime: draft.callTime,
            departureTime: draft.departureTime,
            returnTime: draft.returnTime,
            notes: draft.notes,
            staffBrief: draft.staffBrief,
            packerUserId: draft.packerUserId,
            createdBy: auth.session.id,
          });

          await insertRelations(tx, eventId, draft);
          createdIds.push(eventId);

          const assignedUserIds = draft.staff.map((entry) => entry.userId);
          if (assignedUserIds.length) {
            notifications.push({
              userIds: assignedUserIds,
              payload: eventAssignmentNotification({
                eventId,
                title: draft.title,
                eventDate: draft.eventDate,
                callTime: draft.callTime,
              }),
            });
          }
          continue;
        }

        const previous = updateMap.get(row.matchedEventId!);
        if (!previous) throw new Error("Event not found.");

        const draft = normalizeDraftForWrite(row.draft, {
          previousInventory: previous.inventory,
        });
        const previousStaffIds = previous.staff.map((entry) => entry.userId);
        const currentStaffIds = draft.staff.map((entry) => entry.userId);
        const previousStaffSet = new Set(previousStaffIds);
        const newlyAssignedUserIds = currentStaffIds.filter(
          (userId) => !previousStaffSet.has(userId),
        );
        const retainedUserIds = currentStaffIds.filter((userId) =>
          previousStaffSet.has(userId),
        );
        const vehiclesChanged = vehicleSignature(previous) !== vehicleSignature(draft);
        const eventChanged = hasJobCardChanged(previous, draft);

        const [updated] = await tx
          .update(events)
          .set({
            title: draft.title,
            eventDate: draft.eventDate,
            venue: draft.venue,
            address: draft.address,
            clientName: draft.clientName,
            business: draft.business,
            status: draft.status,
            callTime: draft.callTime,
            departureTime: draft.departureTime,
            returnTime: draft.returnTime,
            notes: draft.notes,
            staffBrief: draft.staffBrief,
            packerUserId: draft.packerUserId,
            updatedAt: new Date(),
          })
          .where(eq(events.id, previous.id))
          .returning({ id: events.id });

        if (!updated) throw new Error("Event not found.");

        await tx.delete(eventTimeline).where(eq(eventTimeline.eventId, previous.id));
        await tx.delete(eventInventory).where(eq(eventInventory.eventId, previous.id));
        await tx.delete(eventStaff).where(eq(eventStaff.eventId, previous.id));
        await tx.delete(eventVehicles).where(eq(eventVehicles.eventId, previous.id));

        await insertRelations(tx, previous.id, draft);
        updatedIds.push(previous.id);

        if (newlyAssignedUserIds.length) {
          notifications.push({
            userIds: newlyAssignedUserIds,
            payload: eventAssignmentNotification({
              eventId: previous.id,
              title: draft.title,
              eventDate: draft.eventDate,
              callTime: draft.callTime,
            }),
          });
        }

        if (eventChanged && retainedUserIds.length) {
          notifications.push({
            userIds: retainedUserIds,
            payload: eventUpdatedNotification({
              eventId: previous.id,
              title: draft.title,
              eventDate: draft.eventDate,
              isToday: draft.eventDate === getTodayKey(env.COMPANY_TIMEZONE),
            }),
          });
        }

        if (eventChanged && vehiclesChanged && currentStaffIds.length) {
          notifications.push({
            userIds: currentStaffIds,
            payload: vehicleAssignmentNotification({
              eventId: previous.id,
              title: draft.title,
              eventDate: draft.eventDate,
            }),
          });
        }
      }
    });

    if (notifications.length) {
      after(async () => {
        await Promise.all(
          notifications.map((job) => sendPushToUsers(job.userIds, job.payload)),
        );
      });
    }

    return Response.json({
      createdCount: createdIds.length,
      updatedCount: updatedIds.length,
      skippedCount,
      reviewedCount: input.rows.filter(
        (row) => row.originalStatus === "needs_review" && row.action !== "skip",
      ).length,
      createdIds,
      updatedIds,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "The reviewed Quick Add data was not valid." },
        { status: 400 },
      );
    }
    if (
      error instanceof Error &&
      (error.message.includes("no longer belongs") ||
        error.message.includes("no longer active"))
    ) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    return apiError(error);
  }
}
