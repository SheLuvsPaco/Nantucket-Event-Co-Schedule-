import "server-only";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { inventoryItems, users, vehicles } from "@/db/schema";
import { businesses, defaultBusiness } from "@/lib/businesses";
import { parseQuickAddTextWithCatalog } from "@/lib/quick-add-ai";
import { getTodayKey } from "@/lib/date";
import { env } from "@/lib/env";
import type { QuickAddEventDraft } from "@/lib/quick-add-reconciliation";

export const quickAddRequestSchema = z.object({
  business: z.enum(businesses).default(defaultBusiness),
  text: z.string().trim().min(1).max(50_000),
});

export type QuickAddParseResult = {
  business: (typeof businesses)[number];
  drafts: QuickAddEventDraft[];
  warningsByRow: string[][];
  warnings: {
    skippedDates: string[];
    ignoredReferences: number;
  };
};

export async function parseQuickAddText({
  business,
  text,
}: z.infer<typeof quickAddRequestSchema>): Promise<QuickAddParseResult> {
  if (!env.OPENAI_API_KEY) {
    throw new Error(
      "OpenAI API key is missing. Add OPENAI_API_KEY to .env.local and restart the server.",
    );
  }

  const [dbStaff, dbVehicles, dbInventory] = await Promise.all([
    db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(and(eq(users.active, true), eq(users.business, business))),
    db
      .select({
        id: vehicles.id,
        name: vehicles.name,
        type: vehicles.type,
        color: vehicles.color,
      })
      .from(vehicles)
      .where(and(eq(vehicles.active, true), eq(vehicles.business, business))),
    db
      .select({
        id: inventoryItems.id,
        name: inventoryItems.name,
        category: inventoryItems.category,
        size: inventoryItems.size,
      })
      .from(inventoryItems)
      .where(
        and(eq(inventoryItems.active, true), eq(inventoryItems.business, business)),
      ),
  ]);

  return parseQuickAddTextWithCatalog({
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_MODEL,
    business,
    text,
    today: getTodayKey(env.COMPANY_TIMEZONE),
    catalog: {
      staff: dbStaff,
      vehicles: dbVehicles,
      inventory: dbInventory,
    },
  });
}
