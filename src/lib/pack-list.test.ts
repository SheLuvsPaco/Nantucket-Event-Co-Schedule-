import { describe, expect, it } from "vitest";
import {
  groupPackItemsBySection,
  isCountFreePackItem,
} from "@/lib/pack-list";

describe("pack-list quantity rules", () => {
  it.each([
    "Stage legs",
    "stage leg",
    " STAGE LEGS ",
    "Turf",
    "Turfs",
    " TURFS ",
  ])(
    "treats %s as count-free",
    (name) => {
      expect(isCountFreePackItem(name)).toBe(true);
    },
  );

  it.each(["Biljax", "Tent legs", "Pine floor", "Turf tires"])(
    "keeps counts for %s",
    (name) => {
      expect(isCountFreePackItem(name)).toBe(false);
    },
  );
});

describe("pack-list sections", () => {
  it("keeps manual event items in one unsectioned list", () => {
    const items = [
      { id: "one", section: null },
      { id: "two", section: null },
    ];

    expect(groupPackItemsBySection(items)).toEqual({
      sectioned: false,
      groups: [{ section: null, items }],
    });
  });

  it("groups PDF items by section without merging repeated appearances", () => {
    const mainCafe = { id: "main-cafe", section: "Main Tent" };
    const lawnSidewall = { id: "lawn-sidewall", section: "South Lawn" };
    const mainSidewall = { id: "main-sidewall", section: "Main Tent" };
    const unsectioned = { id: "extra", section: null };

    expect(
      groupPackItemsBySection([
        mainCafe,
        lawnSidewall,
        mainSidewall,
        unsectioned,
      ]),
    ).toEqual({
      sectioned: true,
      groups: [
        { section: "Main Tent", items: [mainCafe, mainSidewall] },
        { section: "South Lawn", items: [lawnSidewall] },
        { section: null, items: [unsectioned] },
      ],
    });
  });
});
