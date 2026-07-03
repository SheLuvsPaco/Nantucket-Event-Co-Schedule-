import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  eventStaff,
  events,
  inventoryItems,
  managementInvoices,
  users,
  vehicles,
} from "@/db/schema";
import { defaultBusiness, type Business } from "@/lib/businesses";
import type {
  CalendarEvent,
  InventoryRecord,
  ManagementInvoiceRecord,
  ScheduleEvent,
  UserRecord,
  VehicleRecord,
} from "@/types";

type BusinessQueryOptions = {
  assignedUserId?: string;
  businesses?: Business[];
};

function businessFilter<TColumn>(column: TColumn, selected?: Business[]) {
  return selected?.length ? inArray(column as never, selected) : undefined;
}

export async function getInventory(
  includeInactive = false,
  selectedBusinesses?: Business[],
): Promise<InventoryRecord[]> {
  return db
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
    .where(
      and(
        includeInactive ? undefined : eq(inventoryItems.active, true),
        businessFilter(inventoryItems.business, selectedBusinesses),
      ),
    )
    .orderBy(
      asc(inventoryItems.business),
      asc(inventoryItems.category),
      asc(inventoryItems.name),
    );
}

export async function getPeople(
  includeInactive = false,
  selectedBusinesses?: Business[],
): Promise<UserRecord[]> {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      avatarUrl: users.avatarUrl,
      role: users.role,
      business: users.business,
      active: users.active,
    })
    .from(users)
    .where(
      and(
        includeInactive ? undefined : eq(users.active, true),
        businessFilter(users.business, selectedBusinesses),
      ),
    )
    .orderBy(asc(users.business), asc(users.name));
}

export async function getVehicles(
  includeInactive = false,
  selectedBusinesses?: Business[],
): Promise<VehicleRecord[]> {
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
      business: vehicles.business,
      active: vehicles.active,
    })
    .from(vehicles)
    .where(
      and(
        includeInactive ? undefined : eq(vehicles.active, true),
        businessFilter(vehicles.business, selectedBusinesses),
      ),
    )
    .orderBy(asc(vehicles.business), asc(vehicles.name));
}

function mapManagementInvoice(
  invoice: typeof managementInvoices.$inferSelect & {
    creator: typeof users.$inferSelect;
  },
): ManagementInvoiceRecord {
  return {
    id: invoice.id,
    eventName: invoice.eventName,
    eventDate: invoice.eventDate,
    eventTime: invoice.eventTime,
    imageOriginalName: invoice.imageOriginalName,
    notes: invoice.notes,
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
    creator: {
      id: invoice.creator.id,
      name: invoice.creator.name,
    },
  };
}

export async function getManagementInvoices(
  limit = 250,
): Promise<ManagementInvoiceRecord[]> {
  const rows = await db.query.managementInvoices.findMany({
    orderBy: (invoice, { desc }) => [
      desc(invoice.eventDate),
      desc(invoice.eventTime),
      desc(invoice.createdAt),
    ],
    limit,
    with: { creator: true },
  });

  return rows.map(mapManagementInvoice);
}

export async function getManagementInvoicesForDate(
  date: string,
): Promise<ManagementInvoiceRecord[]> {
  const rows = await db.query.managementInvoices.findMany({
    where: eq(managementInvoices.eventDate, date),
    orderBy: (invoice, { asc: orderAsc }) => [
      orderAsc(invoice.eventTime),
      orderAsc(invoice.eventName),
    ],
    with: { creator: true },
  });

  return rows.map(mapManagementInvoice);
}

export async function getManagementInvoiceCalendar(
  startDate: string,
  endDate: string,
): Promise<CalendarEvent[]> {
  const rows = await db
    .select({
      id: managementInvoices.id,
      title: managementInvoices.eventName,
      eventDate: managementInvoices.eventDate,
      callTime: managementInvoices.eventTime,
    })
    .from(managementInvoices)
    .where(
      and(
        gte(managementInvoices.eventDate, startDate),
        lte(managementInvoices.eventDate, endDate),
      ),
    )
    .orderBy(
      asc(managementInvoices.eventDate),
      asc(managementInvoices.eventTime),
      asc(managementInvoices.eventName),
    );

  return rows.map((invoice) => ({
    ...invoice,
    venue: null,
    business: defaultBusiness,
    status: "CONFIRMED",
    staffCount: 0,
  }));
}

export async function getCalendarEvents(
  startDate: string,
  endDate: string,
  options: BusinessQueryOptions = {},
): Promise<CalendarEvent[]> {
  const assignedEventIds = options.assignedUserId
    ? db
        .select({ eventId: eventStaff.eventId })
        .from(eventStaff)
        .where(eq(eventStaff.userId, options.assignedUserId))
    : null;
  const rows = await db.query.events.findMany({
    where: and(
      gte(events.eventDate, startDate),
      lte(events.eventDate, endDate),
      assignedEventIds ? inArray(events.id, assignedEventIds) : undefined,
      businessFilter(events.business, options.businesses),
    ),
    orderBy: [asc(events.eventDate), asc(events.business), asc(events.callTime)],
    with: {
      staff: true,
    },
  });

  return rows.map((event) => ({
    id: event.id,
    title: event.title,
    eventDate: event.eventDate,
    venue: event.venue,
    business: event.business,
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
    business: event.business,
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
          avatarUrl: event.packer.avatarUrl,
          role: event.packer.role,
          business: event.packer.business,
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
        business: entry.item.business,
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
        avatarUrl: entry.user.avatarUrl,
        role: entry.user.role,
        business: entry.user.business,
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
        business: entry.vehicle.business,
        active: entry.vehicle.active,
      },
      driver: entry.driver
        ? {
            id: entry.driver.id,
            name: entry.driver.name,
            email: entry.driver.email,
            phone: entry.driver.phone,
            avatarUrl: entry.driver.avatarUrl,
            role: entry.driver.role,
            business: entry.driver.business,
            active: entry.driver.active,
          }
        : null,
    })),
  };
}

export async function getEventsForDate(
  date: string,
  options: BusinessQueryOptions = {},
): Promise<ScheduleEvent[]> {
  const assignedEventIds = options.assignedUserId
    ? db
        .select({ eventId: eventStaff.eventId })
        .from(eventStaff)
        .where(eq(eventStaff.userId, options.assignedUserId))
    : null;
  const rows = await db.query.events.findMany({
    where: and(
      eq(events.eventDate, date),
      assignedEventIds ? inArray(events.id, assignedEventIds) : undefined,
      businessFilter(events.business, options.businesses),
    ),
    orderBy: [asc(events.business), asc(events.callTime), asc(events.title)],
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
    business: event.business,
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
          avatarUrl: event.packer.avatarUrl,
          role: event.packer.role,
          business: event.packer.business,
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
        business: entry.item.business,
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
        avatarUrl: entry.user.avatarUrl,
        role: entry.user.role,
        business: entry.user.business,
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
        business: entry.vehicle.business,
        active: entry.vehicle.active,
      },
      driver: entry.driver
        ? {
            id: entry.driver.id,
            name: entry.driver.name,
            email: entry.driver.email,
            phone: entry.driver.phone,
            avatarUrl: entry.driver.avatarUrl,
            role: entry.driver.role,
            business: entry.driver.business,
            active: entry.driver.active,
          }
        : null,
    })),
  }));
}
