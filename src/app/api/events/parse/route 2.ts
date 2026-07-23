import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { events, eventStaff, eventVehicles, eventInventory, eventTimeline, users, vehicles, inventoryItems } from "@/db/schema";
import { requireApiSession } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { createId } from "@/lib/ids";

export async function POST(request: Request) {
  const auth = await requireApiSession(["ADMIN", "OWNER"]);
  if (auth.error) return auth.error;

  try {
    const { text } = await request.json();

    if (!text || typeof text !== "string") {
      return Response.json({ error: "Missing text to parse." }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "OpenAI API key is missing. Please add OPENAI_API_KEY to your environment variables." }, { status: 400 });
    }

    // Fetch existing entities to provide exact mappings
    const [dbStaff, dbVehicles, dbInventory] = await Promise.all([
      db.select({ id: users.id, name: users.name }).from(users).where(eq(users.active, true)),
      db.select({ id: vehicles.id, name: vehicles.name }).from(vehicles),
      db.select({ id: inventoryItems.id, name: inventoryItems.name, category: inventoryItems.category }).from(inventoryItems),
    ]);

    const staffList = dbStaff.map(s => `${s.id}: ${s.name}`).join("\n");
    const vehicleList = dbVehicles.map(v => `${v.id}: ${v.name}`).join("\n");
    const inventoryList = dbInventory.map(i => `${i.id}: ${i.name} (${i.category})`).join("\n");

    const systemPrompt = `You are an expert event coordinator parsing unstructured WhatsApp messages into structured event data.
The current year is ${new Date().getFullYear()}.
Infer full dates (YYYY-MM-DD). If no year is specified, use the current year.

Here are the IDs and Names of valid staff, vehicles, and inventory items. 
CRITICAL: When assigning staff, vehicles, or inventory, YOU MUST USE THE EXACT ID PROVIDED BELOW. Do not invent IDs.
If you cannot find a close match, omit the item or use notes. Note: "NGC" often means Nantucket Golf Club, "AAN" or "antiques" = Antiques at Bartlett, "WMC" = Westmoor Club.

STAFF:
${staffList}

VEHICLES:
${vehicleList}

INVENTORY:
${inventoryList}

Your goal is to extract all events mentioned. For each event, infer the title, venue, date, call time, and create a timeline of activities. Map all mentioned staff, vehicles, and items.`;

    const result = await generateObject({
      model: openai("gpt-4o"),
      system: systemPrompt,
      prompt: text,
      schema: z.object({
        events: z.array(z.object({
          title: z.string(),
          eventDate: z.string().describe("YYYY-MM-DD"),
          venue: z.string().optional(),
          address: z.string().optional(),
          callTime: z.string().optional(),
          notes: z.string().optional(),
          staffIds: z.array(z.string()).optional(),
          vehicleIds: z.array(z.string()).optional(),
          inventory: z.array(z.object({
            itemId: z.string(),
            quantity: z.number().default(1),
          })).optional(),
          timeline: z.array(z.object({
            time: z.string().describe("e.g. 7:00 AM"),
            label: z.string(),
          })).optional()
        }))
      })
    });

    const parsedEvents = result.object.events;
    let createdCount = 0;

    await db.transaction(async (tx) => {
      for (const ev of parsedEvents) {
        const eventId = createId("evt");

        await tx.insert(events).values({
          id: eventId,
          title: ev.title,
          eventDate: ev.eventDate,
          venue: ev.venue ?? "",
          address: ev.address ?? "",
          clientName: "",
          status: "CONFIRMED",
          callTime: ev.callTime ?? "",
          departureTime: "",
          returnTime: "",
          notes: ev.notes ?? "",
          staffBrief: "",
          createdBy: auth.session.id,
        });

        if (ev.timeline && ev.timeline.length > 0) {
          await tx.insert(eventTimeline).values(
            ev.timeline.map((entry, idx) => ({
              id: createId("tml"),
              eventId,
              time: entry.time,
              label: entry.label,
              details: "",
              sortOrder: idx,
            }))
          );
        }

        if (ev.inventory && ev.inventory.length > 0) {
          await tx.insert(eventInventory).values(
            ev.inventory.map((entry) => ({
              eventId,
              inventoryItemId: entry.itemId,
              quantity: entry.quantity,
              packed: false,
            }))
          );
        }

        if (ev.staffIds && ev.staffIds.length > 0) {
          await tx.insert(eventStaff).values(
            ev.staffIds.map(userId => ({
              eventId,
              userId,
            }))
          );
        }

        if (ev.vehicleIds && ev.vehicleIds.length > 0) {
          await tx.insert(eventVehicles).values(
            ev.vehicleIds.map(vehicleId => ({
              eventId,
              vehicleId,
            }))
          );
        }

        createdCount++;
      }
    });

    return Response.json({ success: true, createdCount, events: parsedEvents });

  } catch (error) {
    console.error("Parse Error:", error);
    return apiError(error);
  }
}
