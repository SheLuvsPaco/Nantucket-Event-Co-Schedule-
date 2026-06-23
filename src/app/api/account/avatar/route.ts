import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireApiSession } from "@/lib/auth";
import {
  AvatarStorageNotConfiguredError,
  deleteAvatarImage,
  storeAvatarImage,
} from "@/lib/avatar-storage";
import {
  MAX_IMAGE_UPLOAD_BYTES,
  validateImageUpload,
} from "@/lib/image-upload";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  let storedAvatar: Awaited<ReturnType<typeof storeAvatarImage>> | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get("avatar");
    if (!(file instanceof File)) {
      return Response.json(
        { error: "Please choose a profile photo." },
        { status: 400 },
      );
    }

    const validationError = validateImageUpload(file);
    if (validationError) {
      return Response.json({ error: validationError }, { status: 400 });
    }

    const [current] = await db
      .select({
        storageKey: users.avatarStorageKey,
      })
      .from(users)
      .where(eq(users.id, auth.session.id))
      .limit(1);
    if (!current) {
      return Response.json({ error: "Account not found." }, { status: 404 });
    }

    storedAvatar = await storeAvatarImage(file, auth.session.id);
    await db
      .update(users)
      .set({
        avatarUrl: storedAvatar.avatarUrl,
        avatarStorageKey: storedAvatar.storageKey,
        avatarContentType: storedAvatar.contentType,
        updatedAt: new Date(),
      })
      .where(eq(users.id, auth.session.id));

    await deleteAvatarImage(current.storageKey).catch((error) => {
      console.error("Unable to remove replaced profile photo:", error);
    });

    return Response.json({
      avatarUrl: storedAvatar.avatarUrl,
      maximumSizeInBytes: MAX_IMAGE_UPLOAD_BYTES,
    });
  } catch (error) {
    if (storedAvatar) {
      await deleteAvatarImage(storedAvatar.storageKey).catch(() => undefined);
    }
    if (error instanceof AvatarStorageNotConfiguredError) {
      return Response.json({ error: error.message }, { status: 503 });
    }
    console.error("Profile photo upload error:", error);
    return Response.json(
      { error: "The profile photo could not be saved." },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  try {
    const [current] = await db
      .select({ storageKey: users.avatarStorageKey })
      .from(users)
      .where(eq(users.id, auth.session.id))
      .limit(1);
    if (!current) {
      return Response.json({ error: "Account not found." }, { status: 404 });
    }

    await db
      .update(users)
      .set({
        avatarUrl: null,
        avatarStorageKey: null,
        avatarContentType: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, auth.session.id));
    await deleteAvatarImage(current.storageKey);

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof AvatarStorageNotConfiguredError) {
      return Response.json({ error: error.message }, { status: 503 });
    }
    console.error("Profile photo removal error:", error);
    return Response.json(
      { error: "The profile photo could not be removed." },
      { status: 500 },
    );
  }
}
