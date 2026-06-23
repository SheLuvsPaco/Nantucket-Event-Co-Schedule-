import { loadEnvConfig } from "@next/env";
import { hash } from "bcryptjs";
import { eq, inArray } from "drizzle-orm";
import { crewRoles } from "../src/lib/roles";

loadEnvConfig(process.cwd());

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function main() {
  const [{ db }, schema] = await Promise.all([
    import("../src/db"),
    import("../src/db/schema")
  ]);

  const { users } = schema;

  console.log("Updating owner...");
  const ownerHash = await hash(required("SEED_OWNER_PASSWORD"), 12);
  await db.update(users)
    .set({ name: "Porter", passwordHash: ownerHash })
    .where(eq(users.role, "OWNER"));

  console.log("Fetching staff...");
  const staffList = await db
    .select()
    .from(users)
    .where(inArray(users.role, crewRoles));

  console.log(`Updating ${staffList.length} staff users...`);
  for (const staff of staffList) {
    const cleanName = staff.name.replace(/\s+/g, '');
    const pass = `${cleanName}1234`;
    const pwdHash = await hash(pass, 12);

    await db.update(users)
      .set({ passwordHash: pwdHash })
      .where(eq(users.id, staff.id));

    console.log(`Updated password for ${staff.name}.`);
  }

  console.log("Done!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
