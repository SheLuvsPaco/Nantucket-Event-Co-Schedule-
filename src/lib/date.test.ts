import { describe, expect, it } from "vitest";
import {
  formatDateKey,
  formatLongDate,
  formatTime,
  getTodayKey,
  isDateKey,
  parseDateKey,
} from "@/lib/date";

describe("date helpers", () => {
  it("keeps operational date keys stable", () => {
    const parsed = parseDateKey("2026-07-04");
    expect(formatDateKey(parsed)).toBe("2026-07-04");
    expect(formatLongDate("2026-07-04")).toBe("Saturday, July 4");
  });

  it("rejects impossible schedule dates", () => {
    expect(isDateKey("2026-02-28")).toBe(true);
    expect(isDateKey("2026-02-31")).toBe(false);
    expect(isDateKey("07/04/2026")).toBe(false);
  });

  it("formats crew times for fast reading", () => {
    expect(formatTime("06:30")).toBe("6:30 AM");
    expect(formatTime("13:05")).toBe("1:05 PM");
    expect(formatTime(null)).toBe("Time TBD");
  });

  it("respects the configured company timezone", () => {
    const instant = new Date("2026-01-01T02:00:00.000Z");
    expect(getTodayKey("America/New_York", instant)).toBe("2025-12-31");
    expect(getTodayKey("UTC", instant)).toBe("2026-01-01");
  });
});
