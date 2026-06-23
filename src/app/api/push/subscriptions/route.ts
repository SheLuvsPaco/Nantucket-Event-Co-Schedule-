import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { requireApiSession } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { createId } from "@/lib/ids";
import { isPushConfigured } from "@/lib/push-notifications";
import {
  pushSubscriptionSchema,
  pushUnsubscribeSchema,
} from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;
  if (!isPushConfigured()) {
    return Response.json(
      { error: "Push notifications are not configured yet." },
      { status: 503 },
    );
  }

  try {
    const input = pushSubscriptionSchema.parse(await request.json());
    await db
      .insert(pushSubscriptions)
      .values({
        id: createId("push"),
        userId: auth.session.id,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        expirationTime: input.expirationTime ?? null,
        userAgent: input.userAgent ?? null,
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          userId: auth.session.id,
          p256dh: input.keys.p256dh,
          auth: input.keys.auth,
          expirationTime: input.expirationTime ?? null,
          userAgent: input.userAgent ?? null,
          updatedAt: new Date(),
        },
      });

    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  try {
    const input = pushUnsubscribeSchema.parse(await request.json());
    await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, auth.session.id),
          eq(pushSubscriptions.endpoint, input.endpoint),
        ),
      );

    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
