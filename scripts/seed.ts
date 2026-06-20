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
      name: "Porter Kavle",
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
    { id: createId("inv"), name: "New white floor", category: "Flooring", quantity: 600, size: "4x8 ft", notes: "Each inventory unit is one floor panel.", imageUrl: null },
    { id: createId("inv"), name: "New brown floor", category: "Flooring", quantity: 600, size: "4x8 ft", notes: "Each inventory unit is one floor panel.", imageUrl: null },
    { id: createId("inv"), name: "Old white floor", category: "Flooring", quantity: 600, size: "4x8 ft", notes: "Each inventory unit is one floor panel.", imageUrl: null },
    { id: createId("inv"), name: "Old brown floor", category: "Flooring", quantity: 600, size: "4x8 ft", notes: "Each inventory unit is one floor panel.", imageUrl: null },
    { id: createId("inv"), name: "Pine floor", category: "Flooring", quantity: 600, size: "4x8 ft", notes: "Each inventory unit is one floor panel.", imageUrl: "/images/inventory/wooden_floor_1781895854703.png" },
    { id: createId("inv"), name: "Center Pole", category: "Poles", quantity: 10, size: "25'", notes: null, imageUrl: null },
    { id: createId("inv"), name: "Center Pole", category: "Poles", quantity: 10, size: "22'", notes: null, imageUrl: null },
    { id: createId("inv"), name: "Center Pole", category: "Poles", quantity: 10, size: "19'", notes: null, imageUrl: null },
    { id: createId("inv"), name: "Center Pole", category: "Poles", quantity: 10, size: "16'", notes: null, imageUrl: null },
    { id: createId("inv"), name: "Center Pole", category: "Poles", quantity: 10, size: "15'", notes: null, imageUrl: null },
    { id: createId("inv"), name: "Center Pole", category: "Poles", quantity: 5, size: "12'", notes: null, imageUrl: null },
    { id: createId("inv"), name: "Perimeter Poles", category: "Poles", quantity: 100, size: null, notes: null, imageUrl: null },
    { id: createId("inv"), name: "Lifting Poles", category: "Poles", quantity: 50, size: null, notes: null, imageUrl: null },
    { id: createId("inv"), name: "Sperry Tent", category: "Tents", quantity: 1, size: "24' Round", notes: null, imageUrl: "/images/inventory/sperry_tent_1781895809131.png" },
    { id: createId("inv"), name: "Sperry Tent", category: "Tents", quantity: 1, size: "32' Round", notes: null, imageUrl: "/images/inventory/sperry_tent_1781895809131.png" },
    { id: createId("inv"), name: "Sperry Tent", category: "Tents", quantity: 1, size: "46' x 85'", notes: null, imageUrl: "/images/inventory/sperry_tent_1781895809131.png" },
    { id: createId("inv"), name: "Sperry Tent", category: "Tents", quantity: 1, size: "46' x 105'", notes: null, imageUrl: "/images/inventory/sperry_tent_1781895809131.png" },
    { id: createId("inv"), name: "Sperry Tent", category: "Tents", quantity: 1, size: "66' x 106'", notes: null, imageUrl: "/images/inventory/sperry_tent_1781895809131.png" },
    { id: createId("inv"), name: "Losberger Frame Tent", category: "Tents", quantity: 1, size: "10m x 10m", notes: null, imageUrl: "/images/inventory/losberger_tent_1781895819423.png" },
    { id: createId("inv"), name: "Losberger Frame Tent", category: "Tents", quantity: 1, size: "15m x 15m", notes: null, imageUrl: "/images/inventory/losberger_tent_1781895819423.png" },
    { id: createId("inv"), name: "Losberger Frame Tent", category: "Tents", quantity: 1, size: "20m x 20m", notes: null, imageUrl: "/images/inventory/losberger_tent_1781895819423.png" },
    { id: createId("inv"), name: "Chef Tent", category: "Tents", quantity: 1, size: "15x15", notes: null, imageUrl: "/images/inventory/chef_tent_1781895830319.png" },
    { id: createId("inv"), name: "Chef Tent", category: "Tents", quantity: 1, size: "20x20", notes: null, imageUrl: "/images/inventory/chef_tent_1781895830319.png" },
    { id: createId("inv"), name: "Chef Tent", category: "Tents", quantity: 1, size: "30x30", notes: null, imageUrl: "/images/inventory/chef_tent_1781895830319.png" },
    { id: createId("inv"), name: "Sperry Marquee", category: "Tents", quantity: 1, size: null, notes: null, imageUrl: "/images/inventory/sperry_tent_1781895809131.png" },
    { id: createId("inv"), name: "Archway", category: "Tents", quantity: 1, size: null, notes: null, imageUrl: null },
    { id: createId("inv"), name: "2 inch Straps", category: "Hardware", quantity: 100, size: null, notes: null, imageUrl: null },
    { id: createId("inv"), name: "1 inch Straps", category: "Hardware", quantity: 100, size: null, notes: null, imageUrl: null },
    { id: createId("inv"), name: "Tension Straps", category: "Hardware", quantity: 100, size: null, notes: null, imageUrl: null },
    { id: createId("inv"), name: "Stakes", category: "Hardware", quantity: 200, size: null, notes: null, imageUrl: null },
    { id: createId("inv"), name: "Hurricane Stakes", category: "Hardware", quantity: 100, size: null, notes: null, imageUrl: null },
    { id: createId("inv"), name: "Fire Extinguishers", category: "Safety", quantity: 10, size: null, notes: null, imageUrl: "/images/inventory/fire_extinguisher_1781895908474.png" },
    { id: createId("inv"), name: "Exit Signs", category: "Safety", quantity: 20, size: null, notes: null, imageUrl: null },
    { id: createId("inv"), name: "No Smoking Signs", category: "Safety", quantity: 20, size: null, notes: null, imageUrl: null },
    { id: createId("inv"), name: "Heaters", category: "Climate", quantity: 5, size: null, notes: null, imageUrl: "/images/inventory/patio_heater_1781895898427.png" },
    { id: createId("inv"), name: "Generators", category: "Power", quantity: 3, size: null, notes: null, imageUrl: "/images/inventory/generator_1781895872186.png" },
    { id: createId("inv"), name: "Cafe lighting", category: "Lighting", quantity: 50, size: null, notes: null, imageUrl: "/images/inventory/cafe_lighting_1781895864461.png" },
    { id: createId("inv"), name: "Tarps", category: "Accessories", quantity: 50, size: null, notes: null, imageUrl: null },
    { id: createId("inv"), name: "Turfs", category: "Flooring", quantity: 20, size: null, notes: null, imageUrl: null },
    { id: createId("inv"), name: "Biljax", category: "Flooring", quantity: 50, size: "4x4", notes: "Stage deck sections", imageUrl: null },
    { id: createId("inv"), name: "Stage legs", category: "Flooring", quantity: 100, size: null, notes: null, imageUrl: null },
    { id: createId("inv"), name: "Sledge Hammers", category: "Tools", quantity: 6, size: null, notes: null, imageUrl: "/images/inventory/sledge_hammer_1781895918459.png" },
    { id: createId("inv"), name: "Whacker", category: "Tools", quantity: 2, size: null, notes: null, imageUrl: null },
    { id: createId("inv"), name: "Bamboo", category: "Accessories", quantity: 50, size: null, notes: null, imageUrl: null },
    { id: createId("inv"), name: "White Flags", category: "Accessories", quantity: 50, size: null, notes: null, imageUrl: null },
    { id: createId("inv"), name: "Clear Sides", category: "Tent Accessories", quantity: 20, size: "7.5x20", notes: null, imageUrl: null },
    { id: createId("inv"), name: "Clear Sides", category: "Tent Accessories", quantity: 20, size: "7.5x10", notes: null, imageUrl: null },
    { id: createId("inv"), name: "Solid Sides", category: "Tent Accessories", quantity: 40, size: null, notes: null, imageUrl: null },
    { id: createId("inv"), name: "Frame Clear Sides", category: "Tent Accessories", quantity: 20, size: null, notes: null, imageUrl: null },
    { id: createId("inv"), name: "Frame Solid sides", category: "Tent Accessories", quantity: 20, size: null, notes: null, imageUrl: null },
    { id: createId("inv"), name: "Frame Solid Tops", category: "Tent Accessories", quantity: 10, size: null, notes: null, imageUrl: null },
    { id: createId("inv"), name: "Frame Clear Tops", category: "Tent Accessories", quantity: 10, size: null, notes: null, imageUrl: null },
  ];

  await db.insert(inventoryItems).values(inventory);

  const fleet = [
    { id: createId("veh"), name: "Ford Winston", type: "Heavy Duty Truck", capacity: "Heavy", plate: "WINSTON", color: "Navy Blue", notes: null, imageUrl: "/images/fleet/ford_winston_1781895206097.png" },
    { id: createId("veh"), name: "Ford Farm Truck", type: "Farm Truck", capacity: "Medium", plate: "FARM-1", color: "Blue/Rust", notes: null, imageUrl: "/images/fleet/ford_farm_truck_1781895215749.png" },
    { id: createId("veh"), name: "Ford 450 White FlatBed", type: "Flatbed", capacity: "F-450", plate: "FB-01", color: "White", notes: null, imageUrl: "/images/fleet/ford_f450_flatbed_1781895224224.png" },
    { id: createId("veh"), name: "Black Stake Body", type: "Stake Body", capacity: "Heavy", plate: "STK-1", color: "Black", notes: null, imageUrl: "/images/fleet/black_stake_body_1781895244361.png" },
    { id: createId("veh"), name: "White Stake Body", type: "Stake Body", capacity: "Heavy", plate: null, color: "White", notes: "Also called White SB", imageUrl: null },
    { id: createId("veh"), name: "Box Truck", type: "Box Truck", capacity: "26 ft", plate: "BOX-1", color: "White", notes: null, imageUrl: "/images/fleet/ford_box_truck_1781895254819.png" },
    { id: createId("veh"), name: "Transit Van 1", type: "Passenger Van", capacity: "12 people", plate: "VAN-1", color: "White", notes: null, imageUrl: "/images/fleet/ford_transit_van_1781895264793.png" },
    { id: createId("veh"), name: "Transit Van 2", type: "Passenger Van", capacity: "12 people", plate: "VAN-2", color: "White", notes: null, imageUrl: "/images/fleet/ford_transit_van_1781895264793.png" },
    { id: createId("veh"), name: "Big Tent Ox", type: "Articulated Loader", capacity: "Heavy", plate: "OX-1", color: "Green", notes: "Turf tires", imageUrl: "/images/fleet/big_tent_ox_1781895284735.png" },
    { id: createId("veh"), name: "Small Tent Ox", type: "Compact Loader", capacity: "Light", plate: "OX-2", color: "Green", notes: null, imageUrl: "/images/fleet/small_tent_ox_1781895294546.png" }
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
