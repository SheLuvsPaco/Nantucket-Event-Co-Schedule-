import { db } from "@/db";
import { inventoryItems } from "@/db/schema";
import { requireApiSession } from "@/lib/auth";
import { getInventory } from "@/lib/data";
import { apiError } from "@/lib/http";
import { createId } from "@/lib/ids";
import { isCrewRole } from "@/lib/roles";
import { inventorySchema } from "@/lib/validation";

export async function GET() {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;
  return Response.json(
    await getInventory(
      auth.session.role === "ADMIN",
      isCrewRole(auth.session.role) ? [auth.session.business] : undefined,
    ),
  );
}

export async function POST(request: Request) {
  const auth = await requireApiSession(["ADMIN", "OWNER"]);
  if (auth.error) return auth.error;

  try {
    const input = inventorySchema.parse(await request.json());
    const [item] = await db
      .insert(inventoryItems)
      .values({ id: createId("inv"), ...input })
      .returning();
    return Response.json(item, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
