import { loadEnvConfig } from "@next/env";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";

loadEnvConfig(process.cwd());

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in the environment.`);
  return value;
}

async function main() {
  const [{ db }, schema, { createId }] = await Promise.all([
    import("../src/db"),
    import("../src/db/schema"),
    import("../src/lib/ids"),
  ]);

  const {
    eventInventory,
    eventStaff,
    eventTimeline,
    eventVehicles,
    events,
    inventoryItems,
    users,
    vehicles,
  } = schema;

  const existingUsers = await db.select({ id: users.id }).from(users).limit(1);
  if (existingUsers.length > 0) {
    console.log("Seed skipped: the database already contains users.");
    return;
  }

  const adminId = createId("usr");
  const ownerId = createId("usr");
  const staffId = createId("usr");
  const crewIds = [createId("usr"), createId("usr"), createId("usr")];

  await db.insert(users).values([
    {
      id: adminId,
      name: "Nantucket Event Admin",
      email: required("SEED_ADMIN_EMAIL").toLowerCase(),
      passwordHash: await hash(required("SEED_ADMIN_PASSWORD"), 12),
      role: "ADMIN",
      phone: "508-555-0101",
    },
    {
      id: ownerId,
      name: "Nantucket Owner",
      email: required("SEED_OWNER_EMAIL").toLowerCase(),
      passwordHash: await hash(required("SEED_OWNER_PASSWORD"), 12),
      role: "OWNER",
      phone: "508-555-0102",
    },
    {
      id: staffId,
      name: "Demo Crew",
      email: required("SEED_STAFF_EMAIL").toLowerCase(),
      passwordHash: await hash(required("SEED_STAFF_PASSWORD"), 12),
      role: "STAFF",
      phone: "508-555-0103",
    },
    {
      id: crewIds[0],
      name: "Luis Martinez",
      email: "luis@porter.local",
      passwordHash: await hash("CrewDemo123!", 12),
      role: "STAFF",
      phone: "508-555-0104",
    },
    {
      id: crewIds[1],
      name: "Sam Cooper",
      email: "sam@porter.local",
      passwordHash: await hash("CrewDemo123!", 12),
      role: "STAFF",
      phone: "508-555-0105",
    },
    {
      id: crewIds[2],
      name: "Maya Brooks",
      email: "maya@porter.local",
      passwordHash: await hash("CrewDemo123!", 12),
      role: "STAFF",
      phone: "508-555-0106",
    },
  ]);

  const inventory = [
    {
      id: createId("inv"),
      name: "Sailcloth Tent",
      category: "Tents",
      quantity: 4,
      size: "44 × 63 ft",
      notes: "Includes center poles and side poles.",
    },
    {
      id: createId("inv"),
      name: "Frame Tent",
      category: "Tents",
      quantity: 6,
      size: "20 × 40 ft",
      notes: "Use concrete ballast when staking is not allowed.",
    },
    {
      id: createId("inv"),
      name: "Tent Sidewall",
      category: "Tent Accessories",
      quantity: 68,
      size: "8 × 20 ft",
      notes: "Clear and solid panels stored together.",
    },
    {
      id: createId("inv"),
      name: "Farm Table",
      category: "Tables",
      quantity: 42,
      size: "8 ft",
      notes: "Seats 8–10 guests.",
    },
    {
      id: createId("inv"),
      name: "Folding Chair",
      category: "Chairs",
      quantity: 420,
      size: "Standard",
      notes: "Natural wood finish.",
    },
    {
      id: createId("inv"),
      name: "Bistro String Lights",
      category: "Lighting",
      quantity: 24,
      size: "48 ft strand",
      notes: "Warm white LED.",
    },
    {
      id: createId("inv"),
      name: "Concrete Ballast",
      category: "Tent Accessories",
      quantity: 36,
      size: "700 lb",
      notes: "Forklift required.",
    },
    {
      id: createId("inv"),
      name: "Dance Floor Panel",
      category: "Flooring",
      quantity: 100,
      size: "4 × 4 ft",
      notes: "Oak finish.",
    },
  ];

  await db.insert(inventoryItems).values(inventory);

  const fleet = [
    {
      id: createId("veh"),
      name: "Box Truck 1",
      type: "26 ft Box Truck",
      capacity: "26,000 lb GVWR",
      plate: "NEC-01",
      color: "White",
      notes: "Primary tent truck. Lift gate.",
    },
    {
      id: createId("veh"),
      name: "Box Truck 2",
      type: "18 ft Box Truck",
      capacity: "16,000 lb GVWR",
      plate: "NEC-02",
      color: "White",
      notes: "Tables, chairs, and lighting.",
    },
    {
      id: createId("veh"),
      name: "Crew Van",
      type: "Passenger Van",
      capacity: "12 people",
      plate: "NEC-VAN",
      color: "Navy",
      notes: "Crew transport and small tools.",
    },
  ];

  await db.insert(vehicles).values(fleet);

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = tomorrowDate.toISOString().slice(0, 10);
  const nextWeekDate = new Date(now);
  nextWeekDate.setDate(nextWeekDate.getDate() + 6);
  const nextWeek = nextWeekDate.toISOString().slice(0, 10);

  const eventId = createId("evt");
  const tomorrowEventId = createId("evt");
  const nextWeekEventId = createId("evt");

  await db.insert(events).values([
    {
      id: eventId,
      title: "Harborview Wedding — Strike",
      eventDate: today,
      venue: "Harborview Lawn",
      address: "24 Washington Street Extension, Nantucket",
      clientName: "Bennett / Walsh",
      status: "CONFIRMED",
      callTime: "07:00",
      departureTime: "07:30",
      returnTime: "13:30",
      staffBrief:
        "Meet at the warehouse dressed for outdoor work. Bring gloves and water.",
      notes:
        "Venue access is through the service gate. Keep the fire lane completely clear.",
      createdBy: ownerId,
    },
    {
      id: tomorrowEventId,
      title: "Sconset Dinner — Install",
      eventDate: tomorrow,
      venue: "Private Residence",
      address: "18 Ocean Avenue, Siasconset",
      clientName: "Private dinner",
      status: "CONFIRMED",
      callTime: "06:30",
      departureTime: "07:00",
      returnTime: "16:00",
      staffBrief:
        "Pack rain gear. The client requires all vehicles off the lawn by noon.",
      notes: "Call the property manager ten minutes before arrival.",
      createdBy: ownerId,
    },
    {
      id: nextWeekEventId,
      title: "Cliff Road Reception — Install",
      eventDate: nextWeek,
      venue: "Cliff Road Residence",
      address: "Cliff Road, Nantucket",
      clientName: "Summer reception",
      status: "DRAFT",
      callTime: "08:00",
      departureTime: "08:30",
      returnTime: "17:00",
      staffBrief: "Final crew count and load plan pending.",
      notes: "Tent permit awaiting confirmation.",
      createdBy: adminId,
    },
  ]);

  await db.insert(eventTimeline).values([
    {
      id: createId("tml"),
      eventId,
      time: "07:00",
      label: "Crew call",
      details: "Warehouse — safety brief and truck check.",
      sortOrder: 0,
    },
    {
      id: createId("tml"),
      eventId,
      time: "07:30",
      label: "Depart warehouse",
      details: "Box Truck 1 leads. Crew Van follows.",
      sortOrder: 1,
    },
    {
      id: createId("tml"),
      eventId,
      time: "08:00",
      label: "Begin strike",
      details: "Lighting first, then sidewalls and tent.",
      sortOrder: 2,
    },
    {
      id: createId("tml"),
      eventId,
      time: "12:30",
      label: "Final sweep",
      details: "Count stakes and check lawn for hardware.",
      sortOrder: 3,
    },
    {
      id: createId("tml"),
      eventId: tomorrowEventId,
      time: "06:30",
      label: "Crew call",
      details: "Load final linens and tools.",
      sortOrder: 0,
    },
    {
      id: createId("tml"),
      eventId: tomorrowEventId,
      time: "07:00",
      label: "Depart",
      details: "Use Milestone Road.",
      sortOrder: 1,
    },
    {
      id: createId("tml"),
      eventId: tomorrowEventId,
      time: "08:00",
      label: "Tent install",
      details: "Frame tent; concrete ballast only.",
      sortOrder: 2,
    },
    {
      id: createId("tml"),
      eventId: tomorrowEventId,
      time: "12:00",
      label: "Truck off lawn",
      details: "Move both trucks to Ocean Avenue.",
      sortOrder: 3,
    },
  ]);

  await db.insert(eventInventory).values([
    {
      eventId,
      inventoryItemId: inventory[0].id,
      quantity: 1,
      notes: "Check all pole bags before leaving.",
    },
    {
      eventId,
      inventoryItemId: inventory[2].id,
      quantity: 18,
      notes: "12 clear, 6 solid.",
    },
    {
      eventId,
      inventoryItemId: inventory[5].id,
      quantity: 8,
      notes: "Coil and label each strand.",
    },
    {
      eventId: tomorrowEventId,
      inventoryItemId: inventory[1].id,
      quantity: 1,
      notes: "No stakes permitted.",
    },
    {
      eventId: tomorrowEventId,
      inventoryItemId: inventory[3].id,
      quantity: 6,
      notes: "Wipe tops before load.",
    },
    {
      eventId: tomorrowEventId,
      inventoryItemId: inventory[4].id,
      quantity: 48,
      notes: null,
    },
    {
      eventId: tomorrowEventId,
      inventoryItemId: inventory[6].id,
      quantity: 8,
      notes: "Forklift at warehouse.",
    },
  ]);

  await db.insert(eventStaff).values([
    {
      eventId,
      userId: staffId,
      assignment: "Tent lead",
      callTime: "07:00",
      notes: "Run the hardware count.",
    },
    {
      eventId,
      userId: crewIds[0],
      assignment: "Truck lead",
      callTime: "07:00",
      notes: null,
    },
    {
      eventId,
      userId: crewIds[1],
      assignment: "Lighting",
      callTime: "07:00",
      notes: null,
    },
    {
      eventId: tomorrowEventId,
      userId: staffId,
      assignment: "Site lead",
      callTime: "06:30",
      notes: "Check ballast placement with owner.",
    },
    {
      eventId: tomorrowEventId,
      userId: crewIds[1],
      assignment: "Tent crew",
      callTime: "06:30",
      notes: null,
    },
    {
      eventId: tomorrowEventId,
      userId: crewIds[2],
      assignment: "Tables and chairs",
      callTime: "06:30",
      notes: null,
    },
  ]);

  await db.insert(eventVehicles).values([
    {
      eventId,
      vehicleId: fleet[0].id,
      driverUserId: crewIds[0],
      destination: "Harborview Lawn service gate",
      departureTime: "07:30",
      notes: "Load tent and sidewalls.",
    },
    {
      eventId,
      vehicleId: fleet[2].id,
      driverUserId: staffId,
      destination: "Harborview Lawn service gate",
      departureTime: "07:30",
      notes: "Crew and hand tools.",
    },
    {
      eventId: tomorrowEventId,
      vehicleId: fleet[0].id,
      driverUserId: staffId,
      destination: "18 Ocean Avenue, Siasconset",
      departureTime: "07:00",
      notes: "Tent and ballast.",
    },
    {
      eventId: tomorrowEventId,
      vehicleId: fleet[1].id,
      driverUserId: crewIds[2],
      destination: "18 Ocean Avenue, Siasconset",
      departureTime: "07:00",
      notes: "Tables and chairs.",
    },
  ]);

  const [admin] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, adminId));

  console.log(`Seed complete. Admin account: ${admin.email}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
