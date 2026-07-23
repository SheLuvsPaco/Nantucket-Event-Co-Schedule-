import { describe, expect, it } from "vitest";
import {
  normalizeDraftForWrite,
  reconcileQuickAddDrafts,
  type QuickAddEventDraft,
  type ReconciliationEvent,
} from "@/lib/quick-add-reconciliation";

function draft(overrides: Partial<QuickAddEventDraft> = {}): QuickAddEventDraft {
  return {
    title: "Galley Beach",
    eventDate: "2026-06-19",
    venue: "Galley Beach",
    address: null,
    clientName: null,
    business: "TENTS",
    status: "CONFIRMED",
    callTime: "07:00",
    departureTime: null,
    returnTime: null,
    notes: "Install full walnut floor in the 40x40 seasonal tent.",
    staffBrief: null,
    packerUserId: null,
    timeline: [
      {
        time: "07:30",
        endTime: "10:30",
        label: "Install full walnut floor in 40x40 seasonal tent",
        details: null,
        sortOrder: 0,
      },
    ],
    inventory: [
      {
        inventoryItemId: "inv_floor",
        quantity: 50,
        packed: false,
        notes: null,
      },
    ],
    staff: [
      { userId: "usr_zach", assignment: null, callTime: "07:00", notes: null },
      {
        userId: "usr_fuerte",
        assignment: null,
        callTime: "07:00",
        notes: null,
      },
    ],
    vehicles: [
      {
        vehicleId: "veh_black",
        driverUserId: null,
        destination: "Galley Beach",
        departureTime: null,
        notes: null,
      },
    ],
    ...overrides,
  };
}

function event(overrides: Partial<ReconciliationEvent> = {}): ReconciliationEvent {
  const baseDraft = draft(overrides as Partial<QuickAddEventDraft>);
  return {
    id: "evt_existing",
    ...baseDraft,
    inventory: baseDraft.inventory.map((entry) => ({
      ...entry,
      packed: true,
    })),
    ...overrides,
  };
}

describe("Quick Add reconciliation", () => {
  it("auto-skips an identical WhatsApp re-paste", () => {
    const rows = reconcileQuickAddDrafts({
      drafts: [draft()],
      existingEvents: [event()],
    });

    expect(rows[0]).toMatchObject({
      status: "skip",
      recommendedAction: "skip",
      matchedEvent: { id: "evt_existing" },
    });
  });

  it("requires review when the same date and location changed", () => {
    const rows = reconcileQuickAddDrafts({
      drafts: [
        draft({
          staff: [
            {
              userId: "usr_new",
              assignment: null,
              callTime: "07:00",
              notes: null,
            },
          ],
        }),
      ],
      existingEvents: [event()],
    });

    expect(rows[0].status).toBe("needs_review");
    expect(rows[0].recommendedAction).toBe("update");
    expect(rows[0].differences).toContain("Crew changed.");
  });

  it("auto-creates a clear new job with no plausible match", () => {
    const rows = reconcileQuickAddDrafts({
      drafts: [draft({ title: "Sconset Casino", venue: "Sconset Casino" })],
      existingEvents: [event()],
    });

    expect(rows[0]).toMatchObject({
      status: "create",
      recommendedAction: "create",
      matchedEvent: null,
    });
  });

  it("requires review when multiple existing jobs are plausible matches", () => {
    const rows = reconcileQuickAddDrafts({
      drafts: [draft()],
      existingEvents: [
        event({ id: "evt_one" }),
        event({ id: "evt_two", notes: "Install walnut floor." }),
      ],
    });

    expect(rows[0]).toMatchObject({
      status: "needs_review",
      recommendedAction: "skip",
    });
    expect(rows[0].candidates.map((candidate) => candidate.id)).toEqual([
      "evt_one",
      "evt_two",
    ]);
  });

  it("requires review when a job appears to have moved dates", () => {
    const rows = reconcileQuickAddDrafts({
      drafts: [draft({ eventDate: "2026-06-20" })],
      existingEvents: [event({ eventDate: "2026-06-19" })],
    });

    expect(rows[0]).toMatchObject({
      status: "needs_review",
      recommendedAction: "update",
      matchedEvent: { id: "evt_existing" },
    });
    expect(rows[0].reason).toContain("moved");
  });

  it("does not produce delete/archive work for existing jobs missing from the paste", () => {
    const rows = reconcileQuickAddDrafts({
      drafts: [draft({ title: "New Job", venue: "New Job" })],
      existingEvents: [event({ id: "evt_unmentioned", title: "Unmentioned Job" })],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("create");
  });

  it("preserves packed state for unchanged inventory during confirmed updates", () => {
    const normalized = normalizeDraftForWrite(draft(), {
      previousInventory: [
        {
          inventoryItemId: "inv_floor",
          quantity: 50,
          packed: true,
          notes: null,
        },
      ],
    });

    expect(normalized.inventory[0]).toMatchObject({
      inventoryItemId: "inv_floor",
      quantity: 50,
      packed: true,
    });

    const changed = normalizeDraftForWrite(
      draft({
        inventory: [
          {
            inventoryItemId: "inv_floor",
            quantity: 51,
            packed: false,
            notes: null,
          },
        ],
      }),
      {
        previousInventory: [
          {
            inventoryItemId: "inv_floor",
            quantity: 50,
            packed: true,
            notes: null,
          },
        ],
      },
    );

    expect(changed.inventory[0].packed).toBe(false);
  });
});
