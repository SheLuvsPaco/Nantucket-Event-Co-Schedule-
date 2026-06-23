import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { loginSchema } from "@/lib/validation";

const dummyHash =
  "$2b$12$0wYplW1TPT0VHY/y83TUIuVsBF3nV8fCgQxqNlH5V1QS6Z3XnY4Yq";

export async function POST(request: Request) {
  try {
    const credentials = loginSchema.parse(await request.json());
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.name, credentials.name))
      .limit(1);

    const passwordMatches = await compare(
      credentials.password,
      user?.passwordHash ?? dummyHash,
    );

    if (!user || !user.active || !passwordMatches) {
      return Response.json(
        { error: "Name or password is incorrect." },
        { status: 401 },
      );
    }

    await createSession({
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: user.role,
    });

    return Response.json({ user: { name: user.name, role: user.role } });
  } catch (error) {
    return apiError(error);
  }
}
