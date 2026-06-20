import { describe, expect, it } from "vitest";
import { isCountFreePackItem } from "@/lib/pack-list";

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
