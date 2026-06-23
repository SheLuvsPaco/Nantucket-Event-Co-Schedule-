import { relations } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const roles = ["ADMIN", "OWNER", "LEAD", "STAFF"] as const;
export type Role = (typeof roles)[number];

export const eventStatuses = ["DRAFT", "CONFIRMED", "COMPLETED"] as const;
export type EventStatus = (typeof eventStatuses)[number];

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: roles }).notNull(),
    phone: text("phone"),
    avatarUrl: text("avatar_url"),
    avatarStorageKey: text("avatar_storage_key"),
    avatarContentType: text("avatar_content_type"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const inventoryItems = sqliteTable(
  "inventory_items",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    category: text("category").notNull().default("Other"),
    quantity: integer("quantity").notNull().default(0),
    size: text("size"),
    imageUrl: text("image_url"),
    notes: text("notes"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("inventory_category_idx").on(table.category),
    index("inventory_active_idx").on(table.active),
  ],
);

export const vehicles = sqliteTable(
  "vehicles",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    type: text("type").notNull().default("Truck"),
    capacity: text("capacity"),
    plate: text("plate"),
    color: text("color"),
    notes: text("notes"),
    imageUrl: text("image_url"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("vehicles_active_idx").on(table.active)],
);

export const managementInvoices = sqliteTable(
  "management_invoices",
  {
    id: text("id").primaryKey(),
    eventName: text("event_name").notNull(),
    eventDate: text("event_date").notNull(),
    eventTime: text("event_time"),
    imageStorageKey: text("image_storage_key").notNull(),
    imageContentType: text("image_content_type").notNull(),
    imageOriginalName: text("image_original_name").notNull(),
    notes: text("notes"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("management_invoices_date_idx").on(table.eventDate),
    index("management_invoices_created_at_idx").on(table.createdAt),
  ],
);

export const pushSubscriptions = sqliteTable(
  "push_subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    expirationTime: integer("expiration_time"),
    userAgent: text("user_agent"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("push_subscriptions_endpoint_unique").on(table.endpoint),
    index("push_subscriptions_user_idx").on(table.userId),
  ],
);

export const pushNotificationLog = sqliteTable(
  "push_notification_log",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    entityId: text("entity_id"),
    dedupeKey: text("dedupe_key").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("push_notification_log_dedupe_unique").on(table.dedupeKey),
    index("push_notification_log_user_idx").on(table.userId),
  ],
);

export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    eventDate: text("event_date").notNull(),
    venue: text("venue"),
    address: text("address"),
    clientName: text("client_name"),
    status: text("status", { enum: eventStatuses }).notNull().default("DRAFT"),
    callTime: text("call_time"),
    departureTime: text("departure_time"),
    returnTime: text("return_time"),
    notes: text("notes"),
    staffBrief: text("staff_brief"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    packerUserId: text("packer_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("events_date_idx").on(table.eventDate),
    index("events_status_idx").on(table.status),
  ],
);

export const eventTimeline = sqliteTable(
  "event_timeline",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    time: text("time").notNull(),
    endTime: text("end_time"),
    label: text("label").notNull(),
    details: text("details"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("timeline_event_idx").on(table.eventId)],
);

export const eventInventory = sqliteTable(
  "event_inventory",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    inventoryItemId: text("inventory_item_id")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull().default(1),
    packed: integer("packed", { mode: "boolean" }).notNull().default(false),
    notes: text("notes"),
  },
  (table) => [
    primaryKey({ columns: [table.eventId, table.inventoryItemId] }),
    index("event_inventory_event_idx").on(table.eventId),
  ],
);

export const eventStaff = sqliteTable(
  "event_staff",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    assignment: text("assignment"),
    callTime: text("call_time"),
    notes: text("notes"),
  },
  (table) => [
    primaryKey({ columns: [table.eventId, table.userId] }),
    index("event_staff_event_idx").on(table.eventId),
  ],
);

export const eventVehicles = sqliteTable(
  "event_vehicles",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    vehicleId: text("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "restrict" }),
    driverUserId: text("driver_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    destination: text("destination"),
    departureTime: text("departure_time"),
    notes: text("notes"),
  },
  (table) => [
    primaryKey({ columns: [table.eventId, table.vehicleId] }),
    index("event_vehicles_event_idx").on(table.eventId),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  createdEvents: many(events),
  createdManagementInvoices: many(managementInvoices),
  eventAssignments: many(eventStaff),
  pushSubscriptions: many(pushSubscriptions),
  pushNotificationLog: many(pushNotificationLog),
}));

export const managementInvoicesRelations = relations(
  managementInvoices,
  ({ one }) => ({
    creator: one(users, {
      fields: [managementInvoices.createdBy],
      references: [users.id],
    }),
  }),
);

export const pushSubscriptionsRelations = relations(
  pushSubscriptions,
  ({ one }) => ({
    user: one(users, {
      fields: [pushSubscriptions.userId],
      references: [users.id],
    }),
  }),
);

export const pushNotificationLogRelations = relations(
  pushNotificationLog,
  ({ one }) => ({
    user: one(users, {
      fields: [pushNotificationLog.userId],
      references: [users.id],
    }),
  }),
);

export const inventoryRelations = relations(inventoryItems, ({ many }) => ({
  eventItems: many(eventInventory),
}));

export const vehicleRelations = relations(vehicles, ({ many }) => ({
  eventVehicles: many(eventVehicles),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  creator: one(users, { fields: [events.createdBy], references: [users.id] }),
  packer: one(users, { fields: [events.packerUserId], references: [users.id] }),
  timeline: many(eventTimeline),
  inventory: many(eventInventory),
  staff: many(eventStaff),
  vehicles: many(eventVehicles),
}));

export const timelineRelations = relations(eventTimeline, ({ one }) => ({
  event: one(events, { fields: [eventTimeline.eventId], references: [events.id] }),
}));

export const eventInventoryRelations = relations(eventInventory, ({ one }) => ({
  event: one(events, { fields: [eventInventory.eventId], references: [events.id] }),
  item: one(inventoryItems, {
    fields: [eventInventory.inventoryItemId],
    references: [inventoryItems.id],
  }),
}));

export const eventStaffRelations = relations(eventStaff, ({ one }) => ({
  event: one(events, { fields: [eventStaff.eventId], references: [events.id] }),
  user: one(users, { fields: [eventStaff.userId], references: [users.id] }),
}));

export const eventVehicleRelations = relations(eventVehicles, ({ one }) => ({
  event: one(events, { fields: [eventVehicles.eventId], references: [events.id] }),
  vehicle: one(vehicles, {
    fields: [eventVehicles.vehicleId],
    references: [vehicles.id],
  }),
  driver: one(users, {
    fields: [eventVehicles.driverUserId],
    references: [users.id],
  }),
}));
