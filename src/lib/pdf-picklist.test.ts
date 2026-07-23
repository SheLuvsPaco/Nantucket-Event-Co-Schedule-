import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildPicklistPreview,
  buildPicklistPreviewFromParsedPdf,
  type PositionedPdfPage,
} from "./pdf-picklist";

const sampleInventory = [
  {
    id: "inv_biljax",
    name: "Biljax",
    category: "Flooring",
    quantity: 0,
    size: "4x4",
    imageUrl: null,
    notes: null,
    business: "TENTS" as const,
    active: true,
  },
  {
    id: "inv_cafe",
    name: "Cafe lighting",
    category: "Lighting",
    quantity: 0,
    size: null,
    imageUrl: null,
    notes: null,
    business: "TENTS" as const,
    active: true,
  },
  {
    id: "inv_frame_clear",
    name: "Frame Clear Sides",
    category: "Tent Accessories",
    quantity: 0,
    size: null,
    imageUrl: null,
    notes: null,
    business: "TENTS" as const,
    active: true,
  },
  {
    id: "inv_frame_solid",
    name: "Frame Solid Tops",
    category: "Tent Accessories",
    quantity: 0,
    size: null,
    imageUrl: null,
    notes: null,
    business: "TENTS" as const,
    active: true,
  },
  {
    id: "inv_straps",
    name: "2 inch Straps",
    category: "Hardware",
    quantity: 0,
    size: null,
    imageUrl: null,
    notes: null,
    business: "TENTS" as const,
    active: true,
  },
  {
    id: "inv_center_19",
    name: "Center Pole",
    category: "Poles",
    quantity: 0,
    size: "19'",
    imageUrl: null,
    notes: null,
    business: "TENTS" as const,
    active: true,
  },
  {
    id: "inv_whacker",
    name: "Whacker",
    category: "Tools",
    quantity: 0,
    size: null,
    imageUrl: null,
    notes: null,
    business: "TENTS" as const,
    active: true,
  },
];

function item(
  text: string,
  x: number,
  y: number,
): PositionedPdfPage["items"][number] {
  return { text, x, y };
}

describe("PDF picklist parser", () => {
  it("builds a Tents event draft from positioned picklist text", () => {
    const pages: PositionedPdfPage[] = [
      {
        pageNumber: 1,
        items: [
          item("MAIN TENT", 29, 422),
          item("Qty", 40, 400),
          item("Item", 136, 400),
          item("1", 42, 363),
          item("50x105 NaviTrac Tent", 136, 363),
          item("310", 38, 314),
          item("Navitrac Clear Sidewall", 136, 314),
          item("800", 38, 265),
          item("Tent Café Lighting", 136, 272),
          item("Notes:", 136, 258),
          item("Strung throughout the tent and around the perimeter.", 159, 258),
          item("6", 42, 216),
          item("4' x 4' Biljax Decks for 12x8 Stage", 136, 223),
          item("Notes:", 136, 209),
          item("12x8 Stage", 159, 209),
        ],
      },
      {
        pageNumber: 2,
        items: [
          item("SOUTH LAWN", 29, 745),
          item("Qty", 40, 723),
          item("Item", 136, 723),
          item("1", 42, 686),
          item("Navitrac 30' X 60' Solid Top", 136, 686),
          item("180", 38, 637),
          item("Navitrac Solid Sidewall", 136, 637),
          item("ADDITIONAL FOOD TENT OFF BAR TENT", 29, 294),
          item("Qty", 40, 272),
          item("Item", 136, 272),
          item("1", 101, 137),
          item("Sperry Center Pole 19'", 200, 144),
          item("South Florida", 200, 130),
        ],
      },
      {
        pageNumber: 3,
        items: [
          item("14", 98, 678),
          item('Ratchet 2"', 200, 685),
          item("1", 101, 481),
          item("Gas Powered Whacker", 200, 488),
          item("Services", 29, 44),
        ],
      },
    ];

    const preview = buildPicklistPreviewFromParsedPdf(
      {
        text: `PICKLIST
Order Info #E68F5C8D
The Westmoor Club - 6/26/2026,
July 4th Event
Order Start Sat, Jul 04, 2026 08:00 AM EDT
Order End Sat, Jul 04, 2026 11:00 PM EDT
Delivery Address The Westmoor Club 10 Westmoor Ln Nantucket, MA 02554, USA
Drop off Wed, Jul 01, 2026 08:00 AM EDT
Through
Wed, Jul 01, 2026 06:00 PM EDT
Pick Up Mon, Jul 06, 2026 08:00 AM EDT
Through
Mon, Jul 06, 2026 06:00 PM EDT
Contact Info Company Primary The Westmoor Club (508) 228-9494
Notes Haley Winkler MAIN TENT`,
        pages,
      },
      sampleInventory,
    );

    expect(preview.source.orderId).toBe("#E68F5C8D");
    expect(preview.draft.title).toBe("The Westmoor Club");
    expect(preview.draft.eventDate).toBe("2026-07-01");
    expect(preview.draft.callTime).toBe("07:00");
    expect(preview.draft.timeline[0]).toMatchObject({
      time: "08:00",
      endTime: "18:00",
      label: "Arrive at The Westmoor Club for setup",
    });
    expect(preview.draft.notes).toBe(
      "Event: Jul 4, 8:00 AM-11:00 PM\n" +
        "Pickup: Jul 6, 8:00 AM-6:00 PM\n" +
        "Contact: (508) 228-9494",
    );

    const cafe = preview.packItems.find((entry) => entry.inventoryItemId === "inv_cafe");
    expect(cafe).toMatchObject({
      section: "Main Tent",
      quantity: 800,
      matchStatus: "matched",
    });
    expect(cafe?.notes).toBe("Strung throughout the tent and around the perimeter.");

    const clearSides = preview.packItems.find(
      (entry) => entry.inventoryItemId === "inv_frame_clear",
    );
    expect(clearSides?.quantity).toBe(310);

    expect(
      preview.packItems.find((entry) => entry.inventoryItemId === "inv_center_19"),
    ).toBeTruthy();
    expect(
      preview.packItems.find((entry) => entry.inventoryItemId === "inv_straps"),
    ).toBeTruthy();
    expect(
      preview.packItems.find((entry) => entry.inventoryItemId === "inv_whacker"),
    ).toBeTruthy();

    const newTent = preview.packItems.find(
      (entry) => entry.itemName === "50x105 NaviTrac Tent",
    );
    expect(newTent).toMatchObject({
      matchStatus: "new",
      newItem: {
        category: "Tents",
        size: "50x105",
        quantity: 1,
      },
    });
  });

  it("parses the provided Westmoor PDF when it exists locally", async () => {
    const pdfPath =
      "/Users/sheluvspaco/Downloads/Picklist Printout The Westmoor Club - 6262026, July 4th Event #E68F5C8D.pdf";
    if (!existsSync(pdfPath)) return;

    const preview = await buildPicklistPreview(readFileSync(pdfPath), sampleInventory);

    expect(preview.source.orderId).toBe("#E68F5C8D");
    expect(preview.draft.title).toBe("The Westmoor Club");
    expect(preview.draft.address).toBe("10 Westmoor Ln, Nantucket, MA 02554, USA");
    expect(preview.source.orderStart).toBe("Sat, Jul 04, 2026 08:00 AM EDT");
    expect(preview.source.orderEnd).toBe("Sat, Jul 04, 2026 11:00 PM EDT");
    expect(preview.source.dropOffStart).toBe("Wed, Jul 01, 2026 08:00 AM EDT");
    expect(preview.source.dropOffEnd).toBe("Wed, Jul 01, 2026 06:00 PM EDT");
    expect(preview.source.pickupStart).toBe("Mon, Jul 06, 2026 08:00 AM EDT");
    expect(preview.source.pickupEnd).toBe("Mon, Jul 06, 2026 06:00 PM EDT");
    expect(preview.draft.eventDate).toBe("2026-07-01");
    expect(preview.draft.callTime).toBe("07:00");
    expect(preview.draft.timeline[0]).toMatchObject({
      time: "08:00",
      endTime: "18:00",
      label: "Arrive at The Westmoor Club for setup",
    });
    expect(preview.sections).toContain("MAIN TENT");
    expect(preview.sections).toContain("SOUTH LAWN");
    expect(preview.sections).toContain("ADDITIONAL FOOD TENT OFF BAR TENT");
    expect(preview.packItems).toHaveLength(30);
    expect(
      preview.packItems
        .filter((entry) => entry.inventoryItemId === "inv_cafe")
        .map((entry) => ({ section: entry.section, quantity: entry.quantity })),
    ).toEqual([
      { section: "Main Tent", quantity: 800 },
      { section: "South Lawn", quantity: 180 },
      { section: "Bar Into Food Tent", quantity: 120 },
      { section: "Additional Food Tent Off Bar Tent", quantity: 100 },
    ]);
    expect(
      preview.packItems
        .filter((entry) => entry.inventoryItemId === "inv_frame_clear")
        .map((entry) => ({ section: entry.section, quantity: entry.quantity })),
    ).toEqual([
      { section: "Main Tent", quantity: 310 },
      { section: "Bar Into Food Tent", quantity: 120 },
      { section: "Additional Food Tent Off Bar Tent", quantity: 100 },
    ]);
    expect(preview.packItems.every((entry) => !entry.notes?.includes("PDF sections"))).toBe(
      true,
    );
    expect(preview.packItems.every((entry) => !entry.notes?.includes("PDF names"))).toBe(
      true,
    );
    expect(preview.draft.notes).toBe(
      "Event: Jul 4, 8:00 AM-11:00 PM\n" +
        "Pickup: Jul 6, 8:00 AM-6:00 PM\n" +
        "Contact: (508) 228-9494\n" +
        "On-site attendant: 1 attendant, 4 hours, time TBD\n" +
        "Permit: Main tent permit on June invoice",
    );
    expect(preview.packItems.some((entry) => entry.matchStatus === "new")).toBe(true);
  });
});
