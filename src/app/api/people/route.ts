import { hash } from "bcryptjs";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireApiSession } from "@/lib/auth";
import { getPeople } from "@/lib/data";
import { apiError } from "@/lib/http";
import { createId } from "@/lib/ids";
import { userSchema } from "@/lib/validation";

export async function GET() {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;
  return Response.json(await getPeople(auth.session.role === "ADMIN"));
}

export async function POST(request: Request) {
  const auth = await requireApiSession(["ADMIN"]);
  if (auth.error) return auth.error;

  try {
    const input = userSchema.parse(await request.json());
    if (!input.password) {
      return Response.json(
        { error: "password: Please enter at least 8 characters." },
        { status: 400 },
      );
    }

    const [user] = await db
      .insert(users)
      .values({
        id: createId("usr"),
        name: input.name,
        email: input.email,
        phone: input.phone,
        role: input.role,
        active: input.active,
        passwordHash: await hash(input.password, 12),
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        active: users.active,
      });

    return Response.json(user, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
