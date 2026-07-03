import { describe, expect, it } from "vitest";
import { getStaffCardStart, sortStaffDayEvents } from "@/lib/schedule-order";
import type { ScheduleEvent } from "@/types";

function event(
  id: string,
  title: string,
  callTime: string | null,
  timelineTime: string,
): ScheduleEvent {
  return {
    id,
    title,
    eventDate: "2026-06-19",
    venue: null,
    address: null,
    clientName: null,
    business: "TENTS",
    status: "CONFIRMED",
    callTime,
    departureTime: null,
    returnTime: null,
    notes: null,
    staffBrief: null,
    packerUserId: null,
    timeline: [
      {
        id: `${id}-timeline`,
        time: timelineTime,
        endTime: null,
        label: title,
        details: null,
        sortOrder: 0,
      },
    ],
    inventory: [],
    staff: [],
    vehicles: [],
  };
}

describe("staff schedule ordering", () => {
  it("puts warehouse-call jobs first, TBD jobs next, and visits last", () => {
    const ordered = sortStaffDayEvents([
      event("visit", "Porter Visits", null, "08:30"),
      event("tbd", "Sort Frame Tops", null, "08:00"),
      event("warehouse", "Install at Galley Beach", "07:00", "07:15"),
    ]);

    expect(ordered.map((item) => item.id)).toEqual([
      "warehouse",
      "tbd",
      "visit",
    ]);
  });

  it("uses the first visit time instead of showing a fake warehouse call", () => {
    expect(getStaffCardStart(event("visit", "Porter Visits", null, "08:30"))).toEqual({
      label: "First visit",
      time: "08:30",
    });
  });
});
