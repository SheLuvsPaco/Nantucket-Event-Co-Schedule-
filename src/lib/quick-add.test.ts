import { describe, expect, it } from "vitest";
import {
  createStaffAliasMap,
  createVehicleAliasMap,
  normalizeClockTime,
  normalizeQuickAddDate,
  prepareQuickAddEvents,
  quickAddOutputSchema,
} from "@/lib/quick-add";

describe("Quick Add parsing", () => {
  it("uses a strict Structured Outputs schema with nullable values", () => {
    const parsed = quickAddOutputSchema.parse({
      events: [
        {
          title: null,
          locations: [],
          eventDate: "2026-06-21",
          venue: null,
          address: null,
          callTime: null,
          notes: null,
          sourceText: null,
          staffIds: [],
          vehicleIds: [],
          vehicleMentions: [],
          inventory: [{ itemId: null, quantity: null }],
          timeline: [
            { time: null, endTime: null, label: null, details: null },
          ],
        },
      ],
    });

    expect(parsed.events).toHaveLength(1);
  });

  it.each([
    ["7 AM", "07:00"],
    ["715AM", "07:15"],
    ["11:00 PM", "23:00"],
    ["23:10", "23:10"],
    ["0815", "08:15"],
    ["not a time", null],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeClockTime(input)).toBe(expected);
  });

  it("accepts ISO and US dates while rejecting impossible dates", () => {
    expect(normalizeQuickAddDate("2026-06-21")).toBe("2026-06-21");
    expect(normalizeQuickAddDate("6/21/2026")).toBe("2026-06-21");
    expect(normalizeQuickAddDate("2026-02-31")).toBeNull();
  });

  it("filters hallucinated IDs and merges duplicate inventory rows", () => {
    const result = prepareQuickAddEvents(
      {
        events: [
          {
            title: "Breakdown",
            locations: [],
            eventDate: "2026-06-21",
            venue: null,
            address: null,
            callTime: "11 PM",
            notes: null,
            sourceText: null,
            staffIds: ["usr_valid", "usr_fake", "usr_valid"],
            vehicleIds: ["veh_valid", "veh_fake"],
            vehicleMentions: [],
            inventory: [
              { itemId: "inv_valid", quantity: 2 },
              { itemId: "inv_valid", quantity: 3 },
              { itemId: "inv_fake", quantity: 1 },
            ],
            timeline: [
              {
                time: "11PM",
                endTime: null,
                label: "Begin breakdown",
                details: null,
              },
              {
                time: "later",
                endTime: null,
                label: "Invalid time",
                details: null,
              },
            ],
          },
        ],
      },
      {
        staff: new Set(["usr_valid"]),
        vehicles: new Set(["veh_valid"]),
        inventory: new Set(["inv_valid"]),
      },
    );

    expect(result.events[0]).toMatchObject({
      callTime: "23:00",
      staffIds: ["usr_valid"],
      vehicleIds: ["veh_valid"],
      inventory: [{ itemId: "inv_valid", quantity: 5 }],
      timeline: [
        {
          time: "23:00",
          endTime: null,
          label: "Begin breakdown",
          details: null,
        },
      ],
    });
    expect(result.warnings.ignoredReferences).toBe(3);
  });

  it("maps SB aliases and multiple vehicles from one source phrase", () => {
    const aliases = createVehicleAliasMap([
      {
        id: "veh_black",
        name: "Black Stake Body",
        type: "Stake Body",
        color: "Black",
      },
      {
        id: "veh_white",
        name: "White Stake Body",
        type: "Stake Body",
        color: "White",
      },
      { id: "veh_ox", name: "Big Tent Ox", type: "Loader", color: "Green" },
    ]);
    const result = prepareQuickAddEvents(
      {
        events: [
          {
            title: "Install",
            locations: ["Galley Beach"],
            eventDate: "2026-06-19",
            venue: null,
            address: null,
            callTime: "7AM",
            notes: null,
            sourceText: "Black stake body, White SB with big tent ox",
            staffIds: [],
            vehicleIds: [],
            vehicleMentions: [
              "Black stake body, White SB with big tent ox",
            ],
            inventory: [],
            timeline: [],
          },
        ],
      },
      {
        staff: new Set(),
        vehicles: new Set(["veh_black", "veh_white", "veh_ox"]),
        inventory: new Set(),
        vehicleAliases: aliases,
      },
    );

    expect(result.events[0].vehicleIds).toEqual([
      "veh_black",
      "veh_white",
      "veh_ox",
    ]);
  });

  it("maps boss slang olds to Old School only on the relevant job", () => {
    const aliases = createStaffAliasMap([
      { id: "usr_old_school", name: "Old School" },
      { id: "usr_fuerte", name: "Fuerte" },
    ]);
    const result = prepareQuickAddEvents(
      {
        events: [
          {
            title: "Galley Beach",
            locations: ["Galley Beach"],
            eventDate: "2026-06-19",
            venue: "Galley Beach",
            address: null,
            callTime: "7AM",
            notes: null,
            sourceText: "Zach, Fuerte, olds",
            staffIds: ["usr_fuerte"],
            vehicleIds: [],
            vehicleMentions: [],
            inventory: [],
            timeline: [],
          },
          {
            title: "Wauwinet",
            locations: ["Wauwinet"],
            eventDate: "2026-06-19",
            venue: "Wauwinet",
            address: null,
            callTime: "7AM",
            notes: null,
            sourceText: "Kenroy, Fuerte, Younes",
            staffIds: ["usr_fuerte"],
            vehicleIds: [],
            vehicleMentions: [],
            inventory: [],
            timeline: [],
          },
        ],
      },
      {
        staff: new Set(["usr_old_school", "usr_fuerte"]),
        staffAliases: aliases,
        vehicles: new Set(),
        inventory: new Set(),
      },
    );

    expect(result.events[0].staffIds).toEqual([
      "usr_fuerte",
      "usr_old_school",
    ]);
    expect(result.events[1].staffIds).toEqual(["usr_fuerte"]);
  });

  it("calculates 18 four-by-four Biljax for a 12-by-24 stage", () => {
    const result = prepareQuickAddEvents(
      {
        events: [
          {
            title: "Install 12x24 stage",
            locations: ["Wauwinet"],
            eventDate: "2026-06-19",
            venue: "Wauwinet",
            address: null,
            callTime: "7AM",
            notes: "Use Biljax, turf, and legs.",
            sourceText: "2PM install 12x24 stage at wauwinet biljax/turf/legs",
            staffIds: [],
            vehicleIds: [],
            vehicleMentions: [],
            inventory: [
              { itemId: "inv_biljax", quantity: 1 },
              { itemId: "inv_stage_legs", quantity: 27 },
            ],
            timeline: [
              {
                time: "2PM",
                endTime: null,
                label: "Install 12x24 stage at Wauwinet",
                details: "Use Biljax, turf, and legs.",
              },
            ],
          },
        ],
      },
      {
        staff: new Set(),
        vehicles: new Set(),
        inventory: new Set(["inv_biljax", "inv_stage_legs"]),
        inventoryCatalog: new Map([
          ["inv_biljax", { name: "Biljax", size: "4x4" }],
          ["inv_stage_legs", { name: "Stage legs", size: null }],
        ]),
      },
    );

    expect(result.events[0].inventory).toEqual([
      { itemId: "inv_biljax", quantity: 18 },
      { itemId: "inv_stage_legs", quantity: 1 },
    ]);
  });

  it("uses the chronological location route as the event title", () => {
    const result = prepareQuickAddEvents(
      {
        events: [
          {
            title: null,
            locations: ["Nancy Ann", "45 Tomahawk", "Wauwinet"],
            eventDate: "2026-06-19",
            venue: null,
            address: null,
            callTime: "7AM",
            notes: null,
            sourceText: null,
            staffIds: [],
            vehicleIds: [],
            vehicleMentions: [],
            inventory: [],
            timeline: [],
          },
        ],
      },
      {
        staff: new Set(),
        vehicles: new Set(),
        inventory: new Set(),
      },
    );

    expect(result.events[0].title).toBe(
      "Nancy Ann → 45 Tomahawk → Wauwinet",
    );
  });

  it("falls back to the venue instead of creating an untitled event", () => {
    const result = prepareQuickAddEvents(
      {
        events: [
          {
            title: null,
            locations: [],
            eventDate: "2026-06-19",
            venue: "Galley Beach",
            address: null,
            callTime: "7AM",
            notes: null,
            sourceText: null,
            staffIds: [],
            vehicleIds: [],
            vehicleMentions: [],
            inventory: [],
            timeline: [],
          },
        ],
      },
      {
        staff: new Set(),
        vehicles: new Set(),
        inventory: new Set(),
      },
    );

    expect(result.events[0].title).toBe("Galley Beach");
  });

  it("calculates 50 four-by-eight floor panels for a 40-by-40 floor", () => {
    const result = prepareQuickAddEvents(
      {
        events: [
          {
            title: "Galley Beach",
            locations: ["Galley Beach"],
            eventDate: "2026-06-19",
            venue: "Galley Beach",
            address: null,
            callTime: "7AM",
            notes: "Install a full walnut floor in a 40x40 seasonal tent.",
            sourceText:
              "730AM-1030AM Install at Galley Beach, full walnut floor in 40x40 seasonal tent",
            staffIds: [],
            vehicleIds: [],
            vehicleMentions: [],
            inventory: [{ itemId: "inv_pine_floor", quantity: 1 }],
            timeline: [
              {
                time: "7:30AM",
                endTime: "10:30AM",
                label:
                  "Install full walnut floor in 40x40 seasonal tent at Galley Beach",
                details: null,
              },
            ],
          },
        ],
      },
      {
        staff: new Set(),
        vehicles: new Set(),
        inventory: new Set(["inv_pine_floor"]),
        inventoryCatalog: new Map([
          ["inv_pine_floor", { name: "Pine floor", size: "4x8 ft" }],
        ]),
      },
    );

    expect(result.events[0].title).toBe("Galley Beach");
    expect(result.events[0].inventory).toEqual([
      { itemId: "inv_pine_floor", quantity: 50 },
    ]);
  });
});
