import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth";
import { env } from "@/lib/env";
import {
  createImageBlobPathname,
  isManagedBlobUrl,
  MAX_IMAGE_UPLOAD_BYTES,
  validateImageUpload,
} from "@/lib/image-upload";
import { deleteManagedImageIfUnreferenced } from "@/lib/image-storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { error } = await requireApiSession(["ADMIN", "OWNER"]);
    if (error) return error;

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }

    const validationError = validateImageUpload(file);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    if (!env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: "Image storage is not configured." },
        { status: 503 },
      );
    }

    const blob = await put(createImageBlobPathname(file.name), file, {
      access: "public",
      addRandomSuffix: true,
      cacheControlMaxAge: 31_536_000,
      contentType: file.type,
      maximumSizeInBytes: MAX_IMAGE_UPLOAD_BYTES,
    });

    return NextResponse.json({
      url: blob.url,
      pathname: blob.pathname,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "The image could not be uploaded. Please try again." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { error } = await requireApiSession(["ADMIN", "OWNER"]);
    if (error) return error;

    const body = (await request.json()) as { url?: unknown };
    if (typeof body.url !== "string" || !isManagedBlobUrl(body.url)) {
      return NextResponse.json(
        { error: "A valid managed image URL is required." },
        { status: 400 },
      );
    }

    const deleted = await deleteManagedImageIfUnreferenced(body.url);
    if (!deleted) {
      return NextResponse.json(
        { error: "The image is still in use or is not managed by this app." },
        { status: 409 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Image cleanup error:", error);
    return NextResponse.json(
      { error: "The unused image could not be removed." },
      { status: 500 },
    );
  }
}
