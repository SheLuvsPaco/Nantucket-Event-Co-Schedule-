import { db } from "@/db";
import { vehicles } from "@/db/schema";
import { requireApiSession } from "@/lib/auth";
import { getVehicles } from "@/lib/data";
import { apiError } from "@/lib/http";
import { createId } from "@/lib/ids";
import { isCrewRole } from "@/lib/roles";
import { vehicleSchema } from "@/lib/validation";

export async function GET() {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;
  return Response.json(
    await getVehicles(
      auth.session.role === "ADMIN",
      isCrewRole(auth.session.role) ? [auth.session.business] : undefined,
    ),
  );
}

export async function POST(request: Request) {
  const auth = await requireApiSession(["ADMIN", "OWNER"]);
  if (auth.error) return auth.error;

  try {
    const input = vehicleSchema.parse(await request.json());
    const [vehicle] = await db
      .insert(vehicles)
      .values({ id: createId("veh"), ...input })
      .returning();
    return Response.json(vehicle, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
