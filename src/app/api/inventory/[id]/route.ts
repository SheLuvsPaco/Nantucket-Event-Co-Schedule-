import { eq } from "drizzle-orm";
import { db } from "@/db";
import { inventoryItems } from "@/db/schema";
import { requireApiSession } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { inventorySchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const auth = await requireApiSession(["ADMIN", "OWNER"]);
  if (auth.error) return auth.error;

  try {
    const { id } = await context.params;
    const input = inventorySchema.parse(await request.json());
    const [item] = await db
      .update(inventoryItems)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(inventoryItems.id, id))
      .returning();

    if (!item) {
      return Response.json({ error: "Inventory item not found." }, { status: 404 });
    }
    return Response.json(item);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  const auth = await requireApiSession(["ADMIN", "OWNER"]);
  if (auth.error) return auth.error;

  try {
    const { id } = await context.params;
    const [item] = await db
      .update(inventoryItems)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(inventoryItems.id, id))
      .returning();

    if (!item) {
      return Response.json({ error: "Inventory item not found." }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
