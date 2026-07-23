import type { MetadataRoute } from "next";

export function createPwaManifest({
  appName,
  companyName,
}: {
  appName: string;
  companyName: string;
}): MetadataRoute.Manifest {
  return {
    id: "/",
    name: appName,
    short_name: "Nantucket Events",
    description: `${companyName} operations, inventory, and crew scheduling.`,
    start_url: "/app/schedule",
    scope: "/",
    display: "standalone",
    background_color: "#f4f1e8",
    theme_color: "#124a85",
    orientation: "any",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
