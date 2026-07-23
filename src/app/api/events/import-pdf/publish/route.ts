import { and, eq } from "drizzle-orm";
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
import { apiError } from "@/lib/http";
import { createId } from "@/lib/ids";
import {
  findPicklistInventoryMatch,
  picklistPublishSchema,
} from "@/lib/pdf-picklist";
import type { InventoryRecord } from "@/types";

export const runtime = "nodejs";

function cleanNullable(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned || null;
}

export async function POST(request: Request) {
  const auth = await requireApiSession(["ADMIN", "OWNER"]);
  if (auth.error) return auth.error;

  try {
    const input = picklistPublishSchema.parse(await request.json());
    const [dbInventory, dbPeople, dbVehicles] = await Promise.all([
      db
        .select({
          id: inventoryItems.id,
          name: inventoryItems.name,
          category: inventoryItems.category,
          quantity: inventoryItems.quantity,
          size: inventoryItems.size,
          imageUrl: inventoryItems.imageUrl,
          notes: inventoryItems.notes,
          business: inventoryItems.business,
          active: inventoryItems.active,
        })
        .from(inventoryItems)
        .where(and(eq(inventoryItems.active, true), eq(inventoryItems.business, "TENTS"))),
      db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.active, true), eq(users.business, "TENTS"))),
      db
        .select({ id: vehicles.id })
        .from(vehicles)
        .where(and(eq(vehicles.active, true), eq(vehicles.business, "TENTS"))),
    ]);

    const validPeople = new Set(dbPeople.map((person) => person.id));
    const validVehicles = new Set(dbVehicles.map((vehicle) => vehicle.id));

    const eventId = createId("evt");
    const createdInventoryIds: string[] = [];

    await db.transaction(async (tx) => {
      const availableInventory: InventoryRecord[] = [...dbInventory];
      const resolvedPackItems: Array<{
        id: string;
        eventId: string;
        inventoryItemId: string;
        quantity: number;
        packed: boolean;
        notes: string | null;
        section: string | null;
        sortOrder: number;
      }> = [];

      for (const [sortOrder, packItem] of input.packItems.entries()) {
        let inventoryItemId =
          packItem.inventoryItemId &&
          availableInventory.some((item) => item.id === packItem.inventoryItemId)
            ? packItem.inventoryItemId
            : null;

        if (!inventoryItemId) {
          const newItem = packItem.newItem;
          if (!newItem) {
            throw new Error(`Missing inventory item for ${packItem.itemName}.`);
          }

          const existingMatch = findPicklistInventoryMatch(newItem.name, availableInventory);
          if (existingMatch) {
            inventoryItemId = existingMatch.id;
          } else {
            inventoryItemId = createId("inv");
            await tx.insert(inventoryItems).values({
              id: inventoryItemId,
              name: newItem.name,
              category: newItem.category,
              quantity: newItem.quantity,
              size: cleanNullable(newItem.size),
              imageUrl: null,
              notes: "Created from PDF picklist import.",
              business: "TENTS",
              active: true,
            });
            createdInventoryIds.push(inventoryItemId);
            availableInventory.push({
              id: inventoryItemId,
              name: newItem.name,
              category: newItem.category,
              quantity: newItem.quantity,
              size: cleanNullable(newItem.size),
              imageUrl: null,
              notes: "Created from PDF picklist import.",
              business: "TENTS",
              active: true,
            });
          }
        }

        resolvedPackItems.push({
          id: createId("evi"),
          eventId,
          inventoryItemId,
          quantity: packItem.quantity,
          packed: false,
          notes: cleanNullable(packItem.notes),
          section: cleanNullable(packItem.section),
          sortOrder,
        });
      }

      await tx.insert(events).values({
        id: eventId,
        title: input.draft.title,
        eventDate: input.draft.eventDate,
        venue: cleanNullable(input.draft.venue),
        address: cleanNullable(input.draft.address),
        clientName: cleanNullable(input.draft.clientName),
        business: "TENTS",
        status: input.draft.status,
        callTime: input.draft.callTime,
        departureTime: input.draft.departureTime,
        returnTime: input.draft.returnTime,
        notes: cleanNullable(input.draft.notes),
        staffBrief: cleanNullable(input.draft.staffBrief),
        packerUserId:
          input.draft.packerUserId && validPeople.has(input.draft.packerUserId)
            ? input.draft.packerUserId
            : null,
        createdBy: auth.session.id,
      });

      if (input.draft.timeline.length) {
        await tx.insert(eventTimeline).values(
          input.draft.timeline.map((entry, index) => ({
            id: createId("tml"),
            eventId,
            time: entry.time,
            endTime: entry.endTime,
            label: entry.label,
            details: cleanNullable(entry.details),
            sortOrder: index,
          })),
        );
      }

      const uniqueStaff = input.draft.staff.filter(
        (staff, index, all) =>
          validPeople.has(staff.userId) &&
          all.findIndex((candidate) => candidate.userId === staff.userId) === index,
      );
      if (uniqueStaff.length) {
        await tx.insert(eventStaff).values(
          uniqueStaff.map((staff) => ({
            eventId,
            userId: staff.userId,
            assignment: cleanNullable(staff.assignment),
            callTime: staff.callTime,
            notes: cleanNullable(staff.notes),
          })),
        );
      }

      const uniqueVehicles = input.draft.vehicles.filter(
        (vehicle, index, all) =>
          validVehicles.has(vehicle.vehicleId) &&
          all.findIndex((candidate) => candidate.vehicleId === vehicle.vehicleId) ===
            index,
      );
      if (uniqueVehicles.length) {
        await tx.insert(eventVehicles).values(
          uniqueVehicles.map((vehicle) => ({
            eventId,
            vehicleId: vehicle.vehicleId,
            driverUserId:
              vehicle.driverUserId && validPeople.has(vehicle.driverUserId)
                ? vehicle.driverUserId
                : null,
            destination: cleanNullable(vehicle.destination),
            departureTime: vehicle.departureTime,
            notes: cleanNullable(vehicle.notes),
          })),
        );
      }

      if (resolvedPackItems.length) {
        await tx.insert(eventInventory).values(resolvedPackItems);
      }
    });

    return Response.json({
      id: eventId,
      eventDate: input.draft.eventDate,
      createdInventoryCount: createdInventoryIds.length,
    });
  } catch (error) {
    return apiError(error);
  }
}
