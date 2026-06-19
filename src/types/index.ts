import type { EventStatus, Role } from "@/db/schema";

export type InventoryRecord = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  size: string | null;
  imageUrl: string | null;
  notes: string | null;
  active: boolean;
};

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
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
  active: boolean;
};

export type TimelineRecord = {
  id: string;
  time: string;
  label: string;
  details: string | null;
  sortOrder: number;
};

export type EventInventoryRecord = {
  inventoryItemId: string;
  quantity: number;
  notes: string | null;
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
  status: EventStatus;
  callTime: string | null;
  departureTime: string | null;
  returnTime: string | null;
  notes: string | null;
  staffBrief: string | null;
  timeline: TimelineRecord[];
  inventory: EventInventoryRecord[];
  staff: EventStaffRecord[];
  vehicles: EventVehicleRecord[];
};

export type CalendarEvent = Pick<
  ScheduleEvent,
  "id" | "title" | "eventDate" | "venue" | "status" | "callTime"
> & {
  staffCount: number;
};
