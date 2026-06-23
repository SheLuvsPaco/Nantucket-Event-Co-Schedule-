import { compare, hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  clearPasswordChangeAttempts,
  passwordChangeIsRateLimited,
  recordFailedPasswordChange,
} from "@/lib/account-security";
import { requireApiSession } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { passwordChangeSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  if (passwordChangeIsRateLimited(auth.session.id)) {
    return Response.json(
      { error: "Too many incorrect attempts. Try again in 15 minutes." },
      { status: 429 },
    );
  }

  try {
    const input = passwordChangeSchema.parse(await request.json());
    const [user] = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, auth.session.id))
      .limit(1);

    if (!user || !(await compare(input.currentPassword, user.passwordHash))) {
      recordFailedPasswordChange(auth.session.id);
      return Response.json(
        { error: "Current password is incorrect." },
        { status: 400 },
      );
    }

    await db
      .update(users)
      .set({
        passwordHash: await hash(input.newPassword, 12),
        updatedAt: new Date(),
      })
      .where(eq(users.id, auth.session.id));

    clearPasswordChangeAttempts(auth.session.id);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
