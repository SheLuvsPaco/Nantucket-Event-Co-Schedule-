import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireApiSession } from "@/lib/auth";
import { readLocalAvatar } from "@/lib/avatar-storage";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  try {
    const { id } = await context.params;
    const [user] = await db
      .select({
        storageKey: users.avatarStorageKey,
        contentType: users.avatarContentType,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!user?.storageKey || !user.contentType) {
      return Response.json(
        { error: "Profile photo not found." },
        { status: 404 },
      );
    }

    const image = await readLocalAvatar(user.storageKey);
    if (!image) {
      return Response.json(
        { error: "Profile photo not found." },
        { status: 404 },
      );
    }

    return new Response(image, {
      headers: {
        "Cache-Control": "private, no-cache",
        "Content-Type": user.contentType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Profile photo read error:", error);
    return Response.json(
      { error: "The profile photo could not be opened." },
      { status: 500 },
    );
  }
}
