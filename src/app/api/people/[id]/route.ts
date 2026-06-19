import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireApiSession } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { userSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const auth = await requireApiSession(["ADMIN"]);
  if (auth.error) return auth.error;

  try {
    const { id } = await context.params;
    const input = userSchema.parse(await request.json());
    if (id === auth.session.id && !input.active) {
      return Response.json(
        { error: "You cannot deactivate your own account." },
        { status: 400 },
      );
    }

    const update: typeof users.$inferInsert = {
      id,
      name: input.name,
      email: input.email,
      phone: input.phone,
      role: input.role,
      active: input.active,
      updatedAt: new Date(),
      passwordHash: "",
    };

    if (input.password) {
      update.passwordHash = await hash(input.password, 12);
    } else {
      delete (update as Partial<typeof update>).passwordHash;
    }

    const [user] = await db
      .update(users)
      .set(update)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        active: users.active,
      });

    if (!user) {
      return Response.json({ error: "Team member not found." }, { status: 404 });
    }
    return Response.json(user);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  const auth = await requireApiSession(["ADMIN"]);
  if (auth.error) return auth.error;

  try {
    const { id } = await context.params;
    if (id === auth.session.id) {
      return Response.json(
        { error: "You cannot deactivate your own account." },
        { status: 400 },
      );
    }

    const [user] = await db
      .update(users)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();

    if (!user) {
      return Response.json({ error: "Team member not found." }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
