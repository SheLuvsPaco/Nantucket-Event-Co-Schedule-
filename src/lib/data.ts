import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  eventStaff,
  events,
  inventoryItems,
  users,
  vehicles,
} from "@/db/schema";
import type {
  CalendarEvent,
  InventoryRecord,
  ScheduleEvent,
  UserRecord,
  VehicleRecord,
} from "@/types";

export async function getInventory(includeInactive = false): Promise<InventoryRecord[]> {
  return db
    .select({
      id: inventoryItems.id,
      name: inventoryItems.name,
      category: inventoryItems.category,
      quantity: inventoryItems.quantity,
      size: inventoryItems.size,
      imageUrl: inventoryItems.imageUrl,
      notes: inventoryItems.notes,
      active: inventoryItems.active,
    })
    .from(inventoryItems)
    .where(includeInactive ? undefined : eq(inventoryItems.active, true))
    .orderBy(asc(inventoryItems.category), asc(inventoryItems.name));
}

export async function getPeople(includeInactive = false): Promise<UserRecord[]> {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: users.role,
      active: users.active,
    })
    .from(users)
    .where(includeInactive ? undefined : eq(users.active, true))
    .orderBy(asc(users.name));
}

export async function getVehicles(includeInactive = false): Promise<VehicleRecord[]> {
  return db
    .select({
      id: vehicles.id,
      name: vehicles.name,
      type: vehicles.type,
      capacity: vehicles.capacity,
      plate: vehicles.plate,
      color: vehicles.color,
      notes: vehicles.notes,
      imageUrl: vehicles.imageUrl,
      active: vehicles.active,
    })
    .from(vehicles)
    .where(includeInactive ? undefined : eq(vehicles.active, true))
    .orderBy(asc(vehicles.name));
}

export async function getCalendarEvents(
  startDate: string,
  endDate: string,
  assignedUserId?: string,
): Promise<CalendarEvent[]> {
  const assignedEventIds = assignedUserId
    ? db
        .select({ eventId: eventStaff.eventId })
        .from(eventStaff)
        .where(eq(eventStaff.userId, assignedUserId))
    : null;
  const rows = await db.query.events.findMany({
    where: and(
      gte(events.eventDate, startDate),
      lte(events.eventDate, endDate),
      assignedEventIds ? inArray(events.id, assignedEventIds) : undefined,
    ),
    orderBy: [asc(events.eventDate), asc(events.callTime)],
    with: {
      staff: true,
    },
  });

  return rows.map((event) => ({
    id: event.id,
    title: event.title,
    eventDate: event.eventDate,
    venue: event.venue,
    status: event.status,
    callTime: event.callTime,
    staffCount: event.staff.length,
  }));
}

export async function getEventById(id: string): Promise<ScheduleEvent | null> {
  const event = await db.query.events.findFirst({
    where: eq(events.id, id),
    with: {
      packer: true,
      timeline: {
        orderBy: (timeline, { asc: orderAsc }) => [orderAsc(timeline.sortOrder)],
      },
      inventory: {
        with: { item: true },
      },
      staff: {
        with: { user: true },
      },
      vehicles: {
        with: { vehicle: true, driver: true },
      },
    },
  });

  if (!event) return null;

  return {
    id: event.id,
    title: event.title,
    eventDate: event.eventDate,
    venue: event.venue,
    address: event.address,
    clientName: event.clientName,
    status: event.status,
    callTime: event.callTime,
    departureTime: event.departureTime,
    returnTime: event.returnTime,
    notes: event.notes,
    staffBrief: event.staffBrief,
    packerUserId: event.packerUserId,
    packer: event.packer
      ? {
          id: event.packer.id,
          name: event.packer.name,
          email: event.packer.email,
          phone: event.packer.phone,
          role: event.packer.role,
          active: event.packer.active,
        }
      : null,
    timeline: event.timeline.map((entry) => ({
      id: entry.id,
      time: entry.time,
      endTime: entry.endTime,
      label: entry.label,
      details: entry.details,
      sortOrder: entry.sortOrder,
    })),
    inventory: event.inventory.map((entry) => ({
      inventoryItemId: entry.inventoryItemId,
      quantity: entry.quantity,
      packed: entry.packed,
      notes: entry.notes,
      item: {
        id: entry.item.id,
        name: entry.item.name,
        category: entry.item.category,
        quantity: entry.item.quantity,
        size: entry.item.size,
        imageUrl: entry.item.imageUrl,
        notes: entry.item.notes,
        active: entry.item.active,
      },
    })),
    staff: event.staff.map((entry) => ({
      userId: entry.userId,
      assignment: entry.assignment,
      callTime: entry.callTime,
      notes: entry.notes,
      user: {
        id: entry.user.id,
        name: entry.user.name,
        email: entry.user.email,
        phone: entry.user.phone,
        role: entry.user.role,
        active: entry.user.active,
      },
    })),
    vehicles: event.vehicles.map((entry) => ({
      vehicleId: entry.vehicleId,
      driverUserId: entry.driverUserId,
      destination: entry.destination,
      departureTime: entry.departureTime,
      notes: entry.notes,
      vehicle: {
        id: entry.vehicle.id,
        name: entry.vehicle.name,
        type: entry.vehicle.type,
        capacity: entry.vehicle.capacity,
        plate: entry.vehicle.plate,
        color: entry.vehicle.color,
        imageUrl: entry.vehicle.imageUrl,
        notes: entry.vehicle.notes,
        active: entry.vehicle.active,
      },
      driver: entry.driver
        ? {
            id: entry.driver.id,
            name: entry.driver.name,
            email: entry.driver.email,
            phone: entry.driver.phone,
            role: entry.driver.role,
            active: entry.driver.active,
          }
        : null,
    })),
  };
}

export async function getEventsForDate(
  date: string,
  assignedUserId?: string,
): Promise<ScheduleEvent[]> {
  const assignedEventIds = assignedUserId
    ? db
        .select({ eventId: eventStaff.eventId })
        .from(eventStaff)
        .where(eq(eventStaff.userId, assignedUserId))
    : null;
  const rows = await db.query.events.findMany({
    where: and(
      eq(events.eventDate, date),
      assignedEventIds ? inArray(events.id, assignedEventIds) : undefined,
    ),
    orderBy: [asc(events.callTime), asc(events.title)],
    with: {
      packer: true,
      timeline: {
        orderBy: (timeline, { asc: orderAsc }) => [orderAsc(timeline.sortOrder)],
      },
      inventory: {
        with: { item: true },
      },
      staff: {
        with: { user: true },
      },
      vehicles: {
        with: { vehicle: true, driver: true },
      },
    },
  });

  return rows.map((event) => ({
    id: event.id,
    title: event.title,
    eventDate: event.eventDate,
    venue: event.venue,
    address: event.address,
    clientName: event.clientName,
    status: event.status,
    callTime: event.callTime,
    departureTime: event.departureTime,
    returnTime: event.returnTime,
    notes: event.notes,
    staffBrief: event.staffBrief,
    packerUserId: event.packerUserId,
    packer: event.packer
      ? {
          id: event.packer.id,
          name: event.packer.name,
          email: event.packer.email,
          phone: event.packer.phone,
          role: event.packer.role,
          active: event.packer.active,
        }
      : null,
    timeline: event.timeline.map((entry) => ({
      id: entry.id,
      time: entry.time,
      endTime: entry.endTime,
      label: entry.label,
      details: entry.details,
      sortOrder: entry.sortOrder,
    })),
    inventory: event.inventory.map((entry) => ({
      inventoryItemId: entry.inventoryItemId,
      quantity: entry.quantity,
      packed: entry.packed,
      notes: entry.notes,
      item: {
        id: entry.item.id,
        name: entry.item.name,
        category: entry.item.category,
        quantity: entry.item.quantity,
        size: entry.item.size,
        imageUrl: entry.item.imageUrl,
        notes: entry.item.notes,
        active: entry.item.active,
      },
    })),
    staff: event.staff.map((entry) => ({
      userId: entry.userId,
      assignment: entry.assignment,
      callTime: entry.callTime,
      notes: entry.notes,
      user: {
        id: entry.user.id,
        name: entry.user.name,
        email: entry.user.email,
        phone: entry.user.phone,
        role: entry.user.role,
        active: entry.user.active,
      },
    })),
    vehicles: event.vehicles.map((entry) => ({
      vehicleId: entry.vehicleId,
      driverUserId: entry.driverUserId,
      destination: entry.destination,
      departureTime: entry.departureTime,
      notes: entry.notes,
      vehicle: {
        id: entry.vehicle.id,
        name: entry.vehicle.name,
        type: entry.vehicle.type,
        capacity: entry.vehicle.capacity,
        plate: entry.vehicle.plate,
        color: entry.vehicle.color,
        notes: entry.vehicle.notes,
        imageUrl: entry.vehicle.imageUrl,
        active: entry.vehicle.active,
      },
      driver: entry.driver
        ? {
            id: entry.driver.id,
            name: entry.driver.name,
            email: entry.driver.email,
            phone: entry.driver.phone,
            role: entry.driver.role,
            active: entry.driver.active,
          }
        : null,
    })),
  }));
}
