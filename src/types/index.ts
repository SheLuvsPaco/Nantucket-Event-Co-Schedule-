import type { EventStatus, Role } from "@/db/schema";
import type { Business } from "@/lib/businesses";

export type InventoryRecord = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  size: string | null;
  imageUrl: string | null;
  notes: string | null;
  business: Business;
  active: boolean;
};

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  role: Role;
  business: Business;
  active: boolean;
};

export type VehicleRecord = {
  id: string;
  name: string;
  type: string;
  capacity: string | null;
  plate: string | null;
  color: string | null;
  notes: string | null;
  imageUrl: string | null;
  business: Business;
  active: boolean;
};

export type ManagementInvoiceRecord = {
  id: string;
  eventName: string;
  eventDate: string;
  eventTime: string | null;
  imageOriginalName: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  creator: Pick<UserRecord, "id" | "name">;
};

export type TimelineRecord = {
  id: string;
  time: string;
  endTime: string | null;
  label: string;
  details: string | null;
  sortOrder: number;
};

export type EventInventoryRecord = {
  id: string;
  inventoryItemId: string;
  quantity: number;
  packed: boolean;
  notes: string | null;
  section: string | null;
  sortOrder: number;
  item?: InventoryRecord;
};

export type EventStaffRecord = {
  userId: string;
  assignment: string | null;
  callTime: string | null;
  notes: string | null;
  user?: UserRecord;
};

export type EventVehicleRecord = {
  vehicleId: string;
  driverUserId: string | null;
  destination: string | null;
  departureTime: string | null;
  notes: string | null;
  vehicle?: VehicleRecord;
  driver?: UserRecord | null;
};

export type ScheduleEvent = {
  id: string;
  title: string;
  eventDate: string;
  venue: string | null;
  address: string | null;
  clientName: string | null;
  business: Business;
  status: EventStatus;
  callTime: string | null;
  departureTime: string | null;
  returnTime: string | null;
  notes: string | null;
  staffBrief: string | null;
  packerUserId: string | null;
  packer?: UserRecord | null;
  timeline: TimelineRecord[];
  inventory: EventInventoryRecord[];
  staff: EventStaffRecord[];
  vehicles: EventVehicleRecord[];
};

export type CalendarEvent = Pick<
  ScheduleEvent,
  "id" | "title" | "eventDate" | "venue" | "business" | "status" | "callTime"
> & {
  staffCount: number;
};
