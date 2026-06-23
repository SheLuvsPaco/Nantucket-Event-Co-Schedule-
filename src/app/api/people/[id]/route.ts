import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireApiSession } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { leadPromotionNotification } from "@/lib/notification-content";
import { sendPushToUsers } from "@/lib/push-notifications";
import { isCrewRole } from "@/lib/roles";
import { crewRoleUpdateSchema, userSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const auth = await requireApiSession(["ADMIN", "OWNER"]);
  if (auth.error) return auth.error;

  try {
    const { id } = await context.params;
    const payload: unknown = await request.json();
    const [target] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!target) {
      return Response.json(
        { error: "Team member not found." },
        { status: 404 },
      );
    }

    if (auth.session.role === "OWNER") {
      const input = crewRoleUpdateSchema.parse(payload);
      if (!isCrewRole(target.role)) {
        return Response.json(
          { error: "Owners can only change Staff and Lead roles." },
          { status: 403 },
        );
      }

      const [user] = await db
        .update(users)
        .set({ role: input.role, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          phone: users.phone,
          avatarUrl: users.avatarUrl,
          role: users.role,
          active: users.active,
        });

      if (target.role !== "LEAD" && user?.role === "LEAD") {
        after(async () => {
          await sendPushToUsers([id], leadPromotionNotification());
        });
      }
      return Response.json(user);
    }

    const input = userSchema.parse(payload);
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
        avatarUrl: users.avatarUrl,
        role: users.role,
        active: users.active,
      });

    if (!user) {
      return Response.json({ error: "Team member not found." }, { status: 404 });
    }
    if (target.role !== "LEAD" && user.role === "LEAD") {
      after(async () => {
        await sendPushToUsers([id], leadPromotionNotification());
      });
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
