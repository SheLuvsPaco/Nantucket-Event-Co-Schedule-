import { formatLongDate, formatTime } from "@/lib/date";

export type PushNotificationPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

type EventNotificationInput = {
  eventId: string;
  title: string;
  eventDate: string;
  callTime?: string | null;
};

export function eventAssignmentNotification({
  eventId,
  title,
  eventDate,
  callTime,
}: EventNotificationInput): PushNotificationPayload {
  return {
    title: `You were assigned: ${title}`,
    body: `${formatLongDate(eventDate)} · Warehouse call ${formatTime(callTime)}`,
    url: `/app/only-me/${eventDate}`,
    tag: `event-assignment-${eventId}`,
  };
}

export function eventUpdatedNotification({
  eventId,
  title,
  eventDate,
  isToday = false,
}: EventNotificationInput & { isToday?: boolean }): PushNotificationPayload {
  return {
    title: `${title}, ${formatLongDate(eventDate)} updated.`,
    body: isToday ? "Today’s schedule changed. Check it out." : "Check it out.",
    url: `/app/only-me/${eventDate}`,
    tag: `event-update-${eventId}`,
  };
}

export function vehicleAssignmentNotification({
  eventId,
  title,
  eventDate,
}: EventNotificationInput): PushNotificationPayload {
  return {
    title: "Vehicle assignment changed",
    body: `${title}, ${formatLongDate(eventDate)}. Check what to drive.`,
    url: `/app/only-me/${eventDate}`,
    tag: `vehicle-update-${eventId}`,
  };
}

export function leadPromotionNotification(): PushNotificationPayload {
  return {
    title: "You’re now a Lead",
    body: "Management invoices are now available. Tap to review them.",
    url: "/app/management",
    tag: "lead-promotion",
  };
}

export function managementInvoiceNotification({
  invoiceId,
  eventName,
  eventDate,
  eventTime,
}: {
  invoiceId: string;
  eventName: string;
  eventDate: string;
  eventTime?: string | null;
}): PushNotificationPayload {
  const time = eventTime ? ` · ${formatTime(eventTime)}` : "";
  return {
    title: `New management invoice: ${eventName}`,
    body: `${formatLongDate(eventDate)}${time}. Tap to review.`,
    url: `/app/management/${eventDate}`,
    tag: `management-invoice-${invoiceId}`,
  };
}

export function morningReminderNotification({
  eventId,
  title,
  eventDate,
  callTime,
}: EventNotificationInput & { callTime: string }): PushNotificationPayload {
  return {
    title: `Warehouse call at ${formatTime(callTime)}`,
    body: `${title} is first today. Open Only Me before heading out.`,
    url: `/app/only-me/${eventDate}`,
    tag: `morning-reminder-${eventId}`,
  };
}

export function testPushNotification(): PushNotificationPayload {
  return {
    title: "Notifications are ready",
    body: "This phone will receive Nantucket Event Co. schedule alerts.",
    url: "/app/schedule",
    tag: "push-test",
  };
}
