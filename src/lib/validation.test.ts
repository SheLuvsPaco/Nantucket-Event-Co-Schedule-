import { describe, expect, it } from "vitest";
import { eventSchema, inventorySchema, loginSchema } from "@/lib/validation";

describe("validation schemas", () => {
  it("normalizes login names", () => {
    const result = loginSchema.parse({
      name: "  Porter ",
      password: "ChangeMeOwner123!",
    });
    expect(result.name).toBe("Porter");
  });

  it("prevents negative inventory counts", () => {
    const result = inventorySchema.safeParse({
      name: "Frame Tent",
      category: "Tents",
      quantity: -1,
      active: true,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a complete structured event plan", () => {
    const result = eventSchema.safeParse({
      title: "Beach wedding install",
      eventDate: "2026-07-18",
      status: "CONFIRMED",
      callTime: "06:30",
      departureTime: "07:00",
      returnTime: "16:00",
      timeline: [
        {
          time: "06:30",
          label: "Crew call",
          details: "Warehouse",
          sortOrder: 0,
        },
      ],
      inventory: [
        { inventoryItemId: "inv_1", quantity: 1, notes: "Check poles" },
      ],
      staff: [
        {
          userId: "usr_1",
          assignment: "Site lead",
          callTime: "06:30",
        },
      ],
      vehicles: [
        {
          vehicleId: "veh_1",
          driverUserId: "usr_1",
          departureTime: "07:00",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("allows an event to be created without filling any fields", () => {
    const result = eventSchema.parse({});

    expect(result.title).toBe("Untitled event");
    expect(result.status).toBe("DRAFT");
    expect(result.eventDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.timeline).toEqual([]);
    expect(result.inventory).toEqual([]);
    expect(result.staff).toEqual([]);
    expect(result.vehicles).toEqual([]);
  });

  it("drops unfinished assignment rows instead of blocking event creation", () => {
    const result = eventSchema.parse({
      inventory: [{ inventoryItemId: "", quantity: "" }],
      staff: [{ userId: "", assignment: "" }],
      vehicles: [{ vehicleId: "", destination: "" }],
    });

    expect(result.inventory).toEqual([]);
    expect(result.staff).toEqual([]);
    expect(result.vehicles).toEqual([]);
  });

  it("rejects malformed timeline times", () => {
    const result = eventSchema.safeParse({
      title: "Bad schedule",
      eventDate: "2026-07-18",
      status: "DRAFT",
      timeline: [
        { time: "7:00", label: "Depart", details: "", sortOrder: 0 },
      ],
      inventory: [],
      staff: [],
      vehicles: [],
    });
    expect(result.success).toBe(false);
  });
});
