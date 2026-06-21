export const MAX_IMAGE_UPLOAD_BYTES = 4 * 1024 * 1024;

export const ALLOWED_IMAGE_UPLOAD_TYPES = [
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

type ImageUploadCandidate = {
  name: string;
  size: number;
  type: string;
};

export function validateImageUpload(file: ImageUploadCandidate) {
  if (!ALLOWED_IMAGE_UPLOAD_TYPES.includes(file.type as never)) {
    return "Use a JPG, PNG, WebP, GIF, or AVIF image.";
  }

  if (file.size <= 0) {
    return "The selected image is empty.";
  }

  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    return "Images must be 4 MB or smaller.";
  }

  return null;
}

export function createImageBlobPathname(fileName: string) {
  const normalized = fileName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return `images/${normalized || "upload"}`;
}

export function isManagedBlobUrl(
  value: string | null | undefined,
): value is string {
  if (!value) return false;

  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname.endsWith(".blob.vercel-storage.com")
    );
  } catch {
    return false;
  }
}
