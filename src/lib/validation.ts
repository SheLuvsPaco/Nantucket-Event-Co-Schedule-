import { z } from "zod";
import { eventStatuses, roles } from "@/db/schema";
import { businesses, defaultBusiness } from "@/lib/businesses";
import { crewRoles } from "@/lib/roles";

const optionalText = z
  .string()
  .trim()
  .max(5000)
  .optional()
  .nullable()
  .transform((value) => value || null);

const optionalTime = z
  .union([z.string().regex(/^\d{2}:\d{2}$/), z.literal(""), z.null()])
  .optional()
  .transform((value) => value || null);

const eventTitle = z
  .preprocess(
    (value) => (typeof value === "string" ? value.trim() : ""),
    z.string().max(160),
  )
  .transform((value) => value || "Untitled event");

const eventDate = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim()
      ? value
      : new Date().toISOString().slice(0, 10),
  z.string().date(),
);

export const loginSchema = z.object({
  name: z.string().trim().min(1),
  password: z.string().min(4).max(200),
});

export const inventorySchema = z.object({
  name: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(80),
  quantity: z.coerce.number().int().min(0).max(100000),
  size: optionalText,
  imageUrl: z
    .union([z.string().trim().url(), z.literal(""), z.null()])
    .optional()
    .transform((value) => value || null),
  notes: optionalText,
  business: z.enum(businesses).default(defaultBusiness),
  active: z.boolean().default(true),
});

export const vehicleSchema = z.object({
  name: z.string().trim().min(2).max(120),
  type: z.string().trim().min(2).max(80),
  capacity: optionalText,
  plate: optionalText,
  color: optionalText,
  imageUrl: z
    .union([z.string().trim().url(), z.literal(""), z.null()])
    .optional()
    .transform((value) => value || null),
  notes: optionalText,
  business: z.enum(businesses).default(defaultBusiness),
  active: z.boolean().default(true),
});

export const userSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  phone: optionalText,
  role: z.enum(roles),
  business: z.enum(businesses).default(defaultBusiness),
  password: z.union([z.string().min(8).max(200), z.literal("")]).optional(),
  active: z.boolean().default(true),
});

export const crewProfileUpdateSchema = z
  .object({
    role: z.enum(crewRoles).optional(),
    business: z.enum(businesses).optional(),
  })
  .refine((value) => value.role || value.business, {
    message: "Choose a role or business to update.",
  });

export const managementInvoiceSchema = z.object({
  eventName: z.string().trim().min(2).max(160),
  eventDate: z.string().date(),
  eventTime: optionalTime,
  notes: optionalText,
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(4).max(200),
    newPassword: z.string().min(8).max(200),
    confirmPassword: z.string().min(8).max(200),
  })
  .superRefine((value, context) => {
    if (value.newPassword !== value.confirmPassword) {
      context.addIssue({
        code: "custom",
        message: "New passwords do not match.",
        path: ["confirmPassword"],
      });
    }
    if (value.currentPassword === value.newPassword) {
      context.addIssue({
        code: "custom",
        message: "Choose a new password that is different from the current one.",
        path: ["newPassword"],
      });
    }
  });

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(4096),
  expirationTime: z.number().int().nonnegative().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(1).max(2048),
    auth: z.string().min(1).max(2048),
  }),
  userAgent: z.string().trim().max(1000).optional().nullable(),
});

export const pushUnsubscribeSchema = z.object({
  endpoint: z.string().url().max(4096),
});

const timelineSchema = z.object({
  id: z.string().optional(),
  time: z.preprocess(
    (value) => (typeof value === "string" && value ? value : "00:00"),
    z.string().regex(/^\d{2}:\d{2}$/),
  ),
  endTime: optionalTime,
  label: z
    .preprocess(
      (value) => (typeof value === "string" ? value.trim() : ""),
      z.string().max(120),
    )
    .transform((value) => value || "Timeline step"),
  details: optionalText,
  sortOrder: z.preprocess(
    (value) => (value === "" || value === undefined ? 0 : value),
    z.coerce.number().int().min(0),
  ),
});

const eventInventorySchema = z.object({
  inventoryItemId: z.string().default(""),
  quantity: z.preprocess(
    (value) => (value === "" || value === undefined ? 1 : value),
    z.coerce.number().int().min(1).max(100000),
  ),
  packed: z.boolean().default(false),
  notes: optionalText,
});

const eventStaffSchema = z.object({
  userId: z.string().default(""),
  assignment: optionalText,
  callTime: optionalTime,
  notes: optionalText,
});

const eventVehicleSchema = z.object({
  vehicleId: z.string().default(""),
  driverUserId: z
    .union([z.string().min(1), z.literal(""), z.null()])
    .optional()
    .transform((value) => value || null),
  destination: optionalText,
  departureTime: optionalTime,
  notes: optionalText,
});

export const eventSchema = z.object({
  title: eventTitle,
  eventDate,
  venue: optionalText,
  address: optionalText,
  clientName: optionalText,
  business: z.enum(businesses).default(defaultBusiness),
  status: z.preprocess(
    (value) => (eventStatuses.includes(value as never) ? value : "DRAFT"),
    z.enum(eventStatuses),
  ),
  callTime: optionalTime,
  departureTime: optionalTime,
  returnTime: optionalTime,
  notes: optionalText,
  staffBrief: optionalText,
  packerUserId: z
    .union([z.string().min(1), z.literal(""), z.null()])
    .optional()
    .transform((value) => value || null),
  timeline: z.array(timelineSchema).max(100).default([]),
  inventory: z
    .array(eventInventorySchema)
    .max(500)
    .default([])
    .transform((items) => items.filter((item) => item.inventoryItemId)),
  staff: z
    .array(eventStaffSchema)
    .max(200)
    .default([])
    .transform((items) => items.filter((item) => item.userId)),
  vehicles: z
    .array(eventVehicleSchema)
    .max(100)
    .default([])
    .transform((items) => items.filter((item) => item.vehicleId)),
});

export function formatZodError(error: z.ZodError) {
  const firstIssue = error.issues[0];
  if (!firstIssue) return "Please check the form and try again.";
  const field = firstIssue.path.at(-1);
  return `${field ? `${String(field)}: ` : ""}${firstIssue.message}`;
}
