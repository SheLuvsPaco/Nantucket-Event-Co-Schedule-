import { requireApiSession } from "@/lib/auth";
import { testPushNotification } from "@/lib/notification-content";
import {
  isPushConfigured,
  sendPushToUsers,
} from "@/lib/push-notifications";

export const runtime = "nodejs";

export async function POST() {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  if (!isPushConfigured()) {
    return Response.json(
      { error: "Push notifications are not configured yet." },
      { status: 503 },
    );
  }

  const result = await sendPushToUsers(
    [auth.session.id],
    testPushNotification(),
  );
  if (!result.delivered) {
    return Response.json(
      { error: "This phone does not have an active notification subscription." },
      { status: 409 },
    );
  }

  return Response.json({ ok: true });
}
