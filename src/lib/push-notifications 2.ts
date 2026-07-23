import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import webpush from "web-push";
import { db } from "@/db";
import { pushSubscriptions, users } from "@/db/schema";
import { env } from "@/lib/env";
import type { PushNotificationPayload } from "@/lib/notification-content";

let vapidConfigured = false;

export function isPushConfigured() {
  return Boolean(
    env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT,
  );
}

function configureVapid() {
  if (vapidConfigured || !isPushConfigured()) return;
  webpush.setVapidDetails(
    env.VAPID_SUBJECT!,
    env.VAPID_PUBLIC_KEY!,
    env.VAPID_PRIVATE_KEY!,
  );
  vapidConfigured = true;
}

export type PushDeliveryResult = {
  attempted: number;
  delivered: number;
  expired: number;
};

export async function sendPushToUsers(
  userIds: string[],
  payload: PushNotificationPayload,
): Promise<PushDeliveryResult> {
  const uniqueUserIds = [...new Set(userIds)];
  if (!uniqueUserIds.length || !isPushConfigured()) {
    return { attempted: 0, delivered: 0, expired: 0 };
  }

  configureVapid();

  const subscriptions = await db
    .select({
      id: pushSubscriptions.id,
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth,
    })
    .from(pushSubscriptions)
    .innerJoin(users, eq(pushSubscriptions.userId, users.id))
    .where(
      and(
        inArray(pushSubscriptions.userId, uniqueUserIds),
        eq(users.active, true),
      ),
    );

  const results = await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          JSON.stringify(payload),
          {
            TTL: 60 * 60 * 12,
            urgency: "high",
          },
        );
        return "delivered" as const;
      } catch (error) {
        if (
          error instanceof webpush.WebPushError &&
          (error.statusCode === 404 || error.statusCode === 410)
        ) {
          await db
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.id, subscription.id));
          return "expired" as const;
        }

        console.error("Push notification delivery failed:", error);
        return "failed" as const;
      }
    }),
  );

  return {
    attempted: subscriptions.length,
    delivered: results.filter((result) => result === "delivered").length,
    expired: results.filter((result) => result === "expired").length,
  };
}
