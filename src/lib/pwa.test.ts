import { describe, expect, it } from "vitest";
import { createPwaManifest } from "@/lib/pwa-manifest";

describe("PWA manifest", () => {
  it("is installable and launches the existing schedule", () => {
    const value = createPwaManifest({
      appName: "Nantucket Event Co.",
      companyName: "Nantucket Event Co.",
    });

    expect(value.start_url).toBe("/app/schedule");
    expect(value.scope).toBe("/");
    expect(value.display).toBe("standalone");
    expect(value.theme_color).toBe("#124a85");
    expect(value.background_color).toBe("#f4f1e8");
  });

  it("provides regular, large, and maskable PNG icons", () => {
    const value = createPwaManifest({
      appName: "Nantucket Event Co.",
      companyName: "Nantucket Event Co.",
    });

    expect(value.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: "/icons/icon-192x192.png",
          sizes: "192x192",
          purpose: "any",
        }),
        expect.objectContaining({
          src: "/icons/icon-512x512.png",
          sizes: "512x512",
          purpose: "any",
        }),
        expect.objectContaining({
          src: "/icons/icon-maskable-512x512.png",
          sizes: "512x512",
          purpose: "maskable",
        }),
      ]),
    );
  });
});
