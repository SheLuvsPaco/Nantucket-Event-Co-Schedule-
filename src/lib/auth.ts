import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { type Role, users } from "@/db/schema";
import { env } from "@/lib/env";
import { isRole } from "@/lib/roles";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: Role;
};

const secret = new TextEncoder().encode(env.AUTH_SECRET);
const sessionDurationSeconds = 60 * 60 * 24 * 14;

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({
    name: user.name,
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${sessionDurationSeconds}s`)
    .sign(secret);

  const cookieStore = await cookies();
  cookieStore.set(env.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: sessionDurationSeconds,
    path: "/",
    priority: "high",
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(env.SESSION_COOKIE_NAME);
}

export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(env.SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });

    if (
      !payload.sub ||
      typeof payload.name !== "string" ||
      typeof payload.email !== "string" ||
      !isRole(payload.role)
    ) {
      return null;
    }

    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl,
        role: users.role,
      })
      .from(users)
      .where(and(eq(users.id, payload.sub), eq(users.active, true)))
      .limit(1);

    return user ?? null;
  } catch {
    return null;
  }
}

export async function requireSession(allowedRoles?: Role[]) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (allowedRoles && !allowedRoles.includes(session.role)) {
    redirect("/app/schedule");
  }
  return session;
}

export async function requireApiSession(allowedRoles?: Role[]) {
  const session = await getSession();
  if (!session) {
    return {
      error: Response.json({ error: "Please sign in again." }, { status: 401 }),
      session: null,
    } as const;
  }
  if (allowedRoles && !allowedRoles.includes(session.role)) {
    return {
      error: Response.json(
        { error: "You do not have permission to do that." },
        { status: 403 },
      ),
      session: null,
    } as const;
  }
  return { error: null, session } as const;
}
