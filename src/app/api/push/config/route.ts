import { requireApiSession } from "@/lib/auth";
import { env } from "@/lib/env";
import { isPushConfigured } from "@/lib/push-notifications";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  return Response.json({
    configured: isPushConfigured(),
    publicKey: env.VAPID_PUBLIC_KEY ?? null,
  });
}
