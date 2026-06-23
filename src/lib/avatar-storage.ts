import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";
import { env } from "@/lib/env";

const localAvatarDirectory = path.join(process.cwd(), ".data", "avatars");

function safeFileName(fileName: string) {
  return (
    fileName
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "profile-photo"
  );
}

export class AvatarStorageNotConfiguredError extends Error {
  constructor() {
    super("Profile photo storage is not configured.");
  }
}

export async function storeAvatarImage(file: File, userId: string) {
  const normalizedName = safeFileName(file.name);

  if (env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`avatars/${userId}/${normalizedName}`, file, {
      access: "public",
      addRandomSuffix: true,
      cacheControlMaxAge: 31_536_000,
      contentType: file.type,
      token: env.BLOB_READ_WRITE_TOKEN,
    });

    return {
      avatarUrl: blob.url,
      storageKey: blob.url,
      contentType: file.type,
    };
  }

  if (process.env.NODE_ENV === "production") {
    throw new AvatarStorageNotConfiguredError();
  }

  const extension = path.extname(normalizedName);
  const localName = `${randomUUID()}${extension}`;
  await mkdir(localAvatarDirectory, { recursive: true });
  await writeFile(
    path.join(localAvatarDirectory, localName),
    Buffer.from(await file.arrayBuffer()),
  );

  return {
    avatarUrl: `/api/people/${userId}/avatar?v=${Date.now()}`,
    storageKey: `local/${localName}`,
    contentType: file.type,
  };
}

export async function readLocalAvatar(storageKey: string) {
  if (!storageKey.startsWith("local/")) return null;
  if (process.env.NODE_ENV === "production") return null;

  const localName = path.basename(storageKey.slice("local/".length));
  return readFile(path.join(localAvatarDirectory, localName));
}

export async function deleteAvatarImage(
  storageKey: string | null | undefined,
) {
  if (!storageKey) return;

  if (storageKey.startsWith("local/")) {
    if (process.env.NODE_ENV === "production") return;
    const localName = path.basename(storageKey.slice("local/".length));
    await rm(path.join(localAvatarDirectory, localName), { force: true });
    return;
  }

  if (!env.BLOB_READ_WRITE_TOKEN) {
    throw new AvatarStorageNotConfiguredError();
  }
  await del(storageKey, { token: env.BLOB_READ_WRITE_TOKEN });
}
