import { eq } from "drizzle-orm";
import { db } from "@/db";
import { vehicles } from "@/db/schema";
import { requireApiSession } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { removeReplacedManagedImage } from "@/lib/image-storage";
import { vehicleSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const auth = await requireApiSession(["ADMIN", "OWNER"]);
  if (auth.error) return auth.error;

  try {
    const { id } = await context.params;
    const input = vehicleSchema.parse(await request.json());
    const [existingVehicle] = await db
      .select({ imageUrl: vehicles.imageUrl })
      .from(vehicles)
      .where(eq(vehicles.id, id))
      .limit(1);

    if (!existingVehicle) {
      return Response.json({ error: "Vehicle not found." }, { status: 404 });
    }

    const [vehicle] = await db
      .update(vehicles)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(vehicles.id, id))
      .returning();

    if (!vehicle) {
      return Response.json({ error: "Vehicle not found." }, { status: 404 });
    }

    await removeReplacedManagedImage(existingVehicle.imageUrl, vehicle.imageUrl);

    return Response.json(vehicle);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  const auth = await requireApiSession(["ADMIN", "OWNER"]);
  if (auth.error) return auth.error;

  try {
    const { id } = await context.params;
    const [vehicle] = await db
      .update(vehicles)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(vehicles.id, id))
      .returning();

    if (!vehicle) {
      return Response.json({ error: "Vehicle not found." }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
