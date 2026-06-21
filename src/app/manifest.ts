import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { createPwaManifest } from "@/lib/pwa-manifest";

export default function manifest(): MetadataRoute.Manifest {
  return createPwaManifest({
    appName: env.APP_NAME,
    companyName: env.COMPANY_NAME,
  });
}
