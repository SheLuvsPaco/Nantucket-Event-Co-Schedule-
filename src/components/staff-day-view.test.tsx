import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { EventInventoryRecord, ScheduleEvent } from "@/types";
import { StaffDayView } from "./staff-day-view";

afterEach(cleanup);

const inventoryItem: NonNullable<EventInventoryRecord["item"]> = {
  id: "inv_sidewall",
  name: "Clear Sidewall",
  category: "Tent Sides",
  quantity: 500,
  size: "7.5x20",
  imageUrl: null,
  notes: null,
  business: "TENTS",
  active: true,
};

function makeEvent(inventory: EventInventoryRecord[]): ScheduleEvent {
  return {
    id: "evt_pdf",
    title: "Westmoor Club",
    eventDate: "2026-07-21",
    venue: "Westmoor Club",
    address: "10 Westmoor Ln",
    clientName: null,
    business: "TENTS",
    status: "CONFIRMED",
    callTime: "07:00",
    departureTime: "08:00",
    returnTime: "18:00",
    notes: null,
    staffBrief: null,
    packerUserId: null,
    packer: null,
    timeline: [],
    inventory,
    staff: [],
    vehicles: [],
  };
}

describe("StaffDayView pack-list sections", () => {
  it("shows PDF setup areas and keeps repeated inventory rows independent", () => {
    render(
      <StaffDayView
        backHref="/app/schedule"
        date="2026-07-21"
        events={[
          makeEvent([
            {
              id: "evi_main",
              inventoryItemId: inventoryItem.id,
              quantity: 310,
              packed: false,
              notes: null,
              section: "Main Tent",
              sortOrder: 0,
              item: inventoryItem,
            },
            {
              id: "evi_food",
              inventoryItemId: inventoryItem.id,
              quantity: 120,
              packed: false,
              notes: null,
              section: "Food Tent",
              sortOrder: 1,
              item: inventoryItem,
            },
          ]),
        ]}
        sessionUserId="usr_staff"
      />,
    );

    expect(screen.getByRole("heading", { name: "Main Tent" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Food Tent" })).toBeInTheDocument();
    expect(screen.getAllByText("Clear Sidewall")).toHaveLength(2);
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  });

  it("does not add section headings to a manual event", () => {
    render(
      <StaffDayView
        backHref="/app/schedule"
        date="2026-07-21"
        events={[
          makeEvent([
            {
              id: "evi_manual",
              inventoryItemId: inventoryItem.id,
              quantity: 4,
              packed: false,
              notes: null,
              section: null,
              sortOrder: 0,
              item: inventoryItem,
            },
          ]),
        ]}
        sessionUserId="usr_staff"
      />,
    );

    expect(screen.getByText("Clear Sidewall")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Other items" }),
    ).not.toBeInTheDocument();
  });
});
