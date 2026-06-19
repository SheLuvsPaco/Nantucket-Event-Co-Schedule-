import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { env } from "@/lib/env";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  porterClient?: ReturnType<typeof createClient>;
};

const client =
  globalForDb.porterClient ??
  createClient({
    url: env.DATABASE_URL,
    authToken: env.DATABASE_AUTH_TOKEN || undefined,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.porterClient = client;
}

export const db = drizzle(client, { schema });
export { client };
