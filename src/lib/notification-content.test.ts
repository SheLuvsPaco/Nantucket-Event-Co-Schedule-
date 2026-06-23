import { describe, expect, it } from "vitest";
import {
  eventAssignmentNotification,
  eventUpdatedNotification,
  managementInvoiceNotification,
  morningReminderNotification,
  vehicleAssignmentNotification,
} from "@/lib/notification-content";

describe("push notification content", () => {
  const event = {
    eventId: "evt_1",
    title: "Galley Beach",
    eventDate: "2026-06-19",
    callTime: "07:00",
  };

  it("makes assignments immediately understandable", () => {
    expect(eventAssignmentNotification(event)).toMatchObject({
      title: "You were assigned: Galley Beach",
      body: "Friday, June 19 · Warehouse call 7:00 AM",
      url: "/app/only-me/2026-06-19",
    });
  });

  it("uses the requested event update wording", () => {
    expect(eventUpdatedNotification(event)).toMatchObject({
      title: "Galley Beach, Friday, June 19 updated.",
      body: "Check it out.",
    });
  });

  it("calls out a same-day schedule change", () => {
    expect(eventUpdatedNotification({ ...event, isToday: true }).body).toBe(
      "Today’s schedule changed. Check it out.",
    );
  });

  it("calls out vehicle changes separately", () => {
    expect(vehicleAssignmentNotification(event).body).toContain(
      "Check what to drive.",
    );
  });

  it("formats management invoice time when provided", () => {
    expect(
      managementInvoiceNotification({
        invoiceId: "invoice_1",
        eventName: "Wauwinet",
        eventDate: "2026-06-20",
        eventTime: "14:00",
      }).body,
    ).toBe("Saturday, June 20 · 2:00 PM. Tap to review.");
  });

  it("makes morning reminders point to the first job", () => {
    expect(morningReminderNotification(event)).toMatchObject({
      title: "Warehouse call at 7:00 AM",
      body: "Galley Beach is first today. Open Only Me before heading out.",
    });
  });
});
