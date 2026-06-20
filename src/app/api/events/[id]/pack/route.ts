import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { eventInventory } from "@/db/schema";
import { requireApiSession } from "@/lib/auth";
import { apiError } from "@/lib/http";

const packSchema = z.object({
  inventoryItemId: z.string().min(1),
  packed: z.boolean(),
});

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  try {
    const { id } = await context.params;
    const input = packSchema.parse(await request.json());

    const [updated] = await db
      .update(eventInventory)
      .set({ packed: input.packed })
      .where(
        and(
          eq(eventInventory.eventId, id),
          eq(eventInventory.inventoryItemId, input.inventoryItemId)
        )
      )
      .returning({ eventId: eventInventory.eventId });

    if (!updated) {
      return Response.json({ error: "Item not found in this event." }, { status: 404 });
    }

    return Response.json({ ok: true, packed: input.packed });
  } catch (error) {
    return apiError(error);
  }
}
