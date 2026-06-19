import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const [{ db }, { migrate }] = await Promise.all([
    import("../src/db"),
    import("drizzle-orm/libsql/migrator"),
  ]);

  await migrate(db, { migrationsFolder: "drizzle" });
  console.log("Database migrations complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
