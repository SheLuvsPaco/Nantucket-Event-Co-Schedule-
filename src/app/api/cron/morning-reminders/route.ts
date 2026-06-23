import { and, asc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import {
  events,
  pushNotificationLog,
} from "@/db/schema";
import { getTodayKey } from "@/lib/date";
import { env } from "@/lib/env";
import { createId } from "@/lib/ids";
import { morningReminderNotification } from "@/lib/notification-content";
import { sendPushToUsers } from "@/lib/push-notifications";

export const runtime = "nodejs";

function isAuthorized(request: Request) {
  if (!env.CRON_SECRET) return false;
  return request.headers.get("authorization") === `Bearer ${env.CRON_SECRET}`;
}

export async function GET(request: Request) {
  if (!env.CRON_SECRET) {
    return Response.json(
      { error: "CRON_SECRET is not configured." },
      { status: 503 },
    );
  }
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const today = getTodayKey(env.COMPANY_TIMEZONE);
  const dayEvents = await db.query.events.findMany({
    where: and(eq(events.eventDate, today), isNotNull(events.callTime)),
    orderBy: [asc(events.callTime), asc(events.title)],
    with: {
      staff: {
        with: {
          user: true,
        },
      },
    },
  });

  const firstEventByUser = new Map<
    string,
    {
      eventId: string;
      title: string;
      eventDate: string;
      callTime: string;
    }
  >();

  for (const event of dayEvents) {
    if (!event.callTime) continue;
    for (const assignment of event.staff) {
      if (!assignment.user.active || firstEventByUser.has(assignment.userId)) {
        continue;
      }
      firstEventByUser.set(assignment.userId, {
        eventId: event.id,
        title: event.title,
        eventDate: event.eventDate,
        callTime: assignment.callTime ?? event.callTime,
      });
    }
  }

  let delivered = 0;
  let skipped = 0;

  for (const [userId, event] of firstEventByUser) {
    const dedupeKey = `morning:${today}:${userId}`;
    const existing = await db.query.pushNotificationLog.findFirst({
      where: eq(pushNotificationLog.dedupeKey, dedupeKey),
      columns: { id: true },
    });
    if (existing) {
      skipped += 1;
      continue;
    }

    const result = await sendPushToUsers(
      [userId],
      morningReminderNotification(event),
    );
    if (!result.delivered) continue;

    await db
      .insert(pushNotificationLog)
      .values({
        id: createId("pushlog"),
        userId,
        kind: "MORNING_REMINDER",
        entityId: event.eventId,
        dedupeKey,
      })
      .onConflictDoNothing({ target: pushNotificationLog.dedupeKey });
    delivered += 1;
  }

  return Response.json({
    date: today,
    recipients: firstEventByUser.size,
    delivered,
    skipped,
  });
}
