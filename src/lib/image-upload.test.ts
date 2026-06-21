import { describe, expect, it } from "vitest";
import {
  createImageBlobPathname,
  isManagedBlobUrl,
  MAX_IMAGE_UPLOAD_BYTES,
  validateImageUpload,
} from "@/lib/image-upload";

describe("image upload validation", () => {
  it("accepts supported images within the upload limit", () => {
    expect(
      validateImageUpload({
        name: "truck.jpg",
        size: 250_000,
        type: "image/jpeg",
      }),
    ).toBeNull();
  });

  it("rejects unsupported formats and oversized files", () => {
    expect(
      validateImageUpload({
        name: "truck.svg",
        size: 2_000,
        type: "image/svg+xml",
      }),
    ).toContain("JPG");

    expect(
      validateImageUpload({
        name: "truck.png",
        size: MAX_IMAGE_UPLOAD_BYTES + 1,
        type: "image/png",
      }),
    ).toContain("4 MB");
  });
});

describe("image blob helpers", () => {
  it("creates safe image pathnames", () => {
    expect(createImageBlobPathname("Big Tent Ox #1.PNG")).toBe(
      "images/big-tent-ox-1.png",
    );
  });

  it("recognizes only HTTPS Vercel Blob URLs", () => {
    expect(
      isManagedBlobUrl(
        "https://example.public.blob.vercel-storage.com/images/truck.jpg",
      ),
    ).toBe(true);
    expect(isManagedBlobUrl("https://example.com/images/truck.jpg")).toBe(false);
    expect(
      isManagedBlobUrl(
        "http://example.public.blob.vercel-storage.com/images/truck.jpg",
      ),
    ).toBe(false);
  });
});
