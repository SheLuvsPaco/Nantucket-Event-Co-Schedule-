import { createClient, type InValue } from "@libsql/client";

const tables = [
  "users",
  "inventory_items",
  "vehicles",
  "management_invoices",
  "push_subscriptions",
  "push_notification_log",
  "events",
  "event_timeline",
  "event_inventory",
  "event_staff",
  "event_vehicles",
] as const;

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

async function main() {
  const source = createClient({
    url: required("SOURCE_DATABASE_URL"),
    authToken: process.env.SOURCE_DATABASE_AUTH_TOKEN || undefined,
  });
  const target = createClient({
    url: required("TARGET_DATABASE_URL"),
    authToken: required("TARGET_DATABASE_AUTH_TOKEN"),
  });

  try {
    const sourceRows = new Map<
      (typeof tables)[number],
      Record<string, InValue>[]
    >();

    for (const table of tables) {
      const result = await source.execute(`SELECT * FROM ${table}`);
      sourceRows.set(
        table,
        result.rows.map((row) => ({ ...row }) as Record<string, InValue>),
      );
    }

    const populatedTargets: string[] = [];
    for (const table of tables) {
      const result = await target.execute(`SELECT COUNT(*) AS count FROM ${table}`);
      if (Number(result.rows[0]?.count ?? 0) > 0) populatedTargets.push(table);
    }

    if (populatedTargets.length) {
      throw new Error(
        `Target database is not empty (${populatedTargets.join(", ")}). Copy aborted.`,
      );
    }

    await target.execute("PRAGMA foreign_keys = ON");

    for (const table of tables) {
      const rows = sourceRows.get(table) ?? [];
      for (let offset = 0; offset < rows.length; offset += 100) {
        const chunk = rows.slice(offset, offset + 100);
        await target.batch(
          chunk.map((row) => {
            const columns = Object.keys(row);
            return {
              sql: `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns
                .map(() => "?")
                .join(", ")})`,
              args: columns.map((column) => row[column]),
            };
          }),
          "write",
        );
      }
      console.log(`Copied ${rows.length} rows to ${table}.`);
    }

    for (const table of tables) {
      const expected = sourceRows.get(table)?.length ?? 0;
      const result = await target.execute(`SELECT COUNT(*) AS count FROM ${table}`);
      const actual = Number(result.rows[0]?.count ?? 0);
      if (actual !== expected) {
        throw new Error(
          `${table} verification failed: expected ${expected}, received ${actual}.`,
        );
      }
    }

    console.log("Database copy completed and row counts verified.");
  } finally {
    source.close();
    target.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
