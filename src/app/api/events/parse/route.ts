import { openai } from "@ai-sdk/openai";
import { APICallError, generateText, NoOutputGeneratedError, Output } from "ai";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  eventInventory,
  eventStaff,
  eventTimeline,
  eventVehicles,
  events,
  inventoryItems,
  users,
  vehicles,
} from "@/db/schema";
import { requireApiSession } from "@/lib/auth";
import { getTodayKey } from "@/lib/date";
import { env } from "@/lib/env";
import { apiError } from "@/lib/http";
import { createId } from "@/lib/ids";
import {
  createStaffAliasMap,
  createVehicleAliasMap,
  prepareQuickAddEvents,
  quickAddOutputSchema,
} from "@/lib/quick-add";

const requestSchema = z.object({
  text: z.string().trim().min(1).max(50_000),
});

export async function POST(request: Request) {
  const auth = await requireApiSession(["ADMIN", "OWNER"]);
  if (auth.error) return auth.error;

  try {
    const { text } = requestSchema.parse(await request.json());

    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        {
          error:
            "OpenAI API key is missing. Add OPENAI_API_KEY to .env.local and restart the server.",
        },
        { status: 400 },
      );
    }

    const [dbStaff, dbVehicles, dbInventory] = await Promise.all([
      db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(eq(users.active, true)),
      db
        .select({
          id: vehicles.id,
          name: vehicles.name,
          type: vehicles.type,
          color: vehicles.color,
        })
        .from(vehicles)
        .where(eq(vehicles.active, true)),
      db
        .select({
          id: inventoryItems.id,
          name: inventoryItems.name,
          category: inventoryItems.category,
          size: inventoryItems.size,
        })
        .from(inventoryItems)
        .where(eq(inventoryItems.active, true)),
    ]);

    const staffList = dbStaff.map((item) => `${item.id}: ${item.name}`).join("\n");
    const vehicleList = dbVehicles
      .map((item) => {
        const aliases = item.name.includes("Stake Body")
          ? `; aliases include ${item.name.replace("Stake Body", "SB")}`
          : "";
        return `${item.id}: ${item.name}${aliases}`;
      })
      .join("\n");
    const inventoryList = dbInventory
      .map(
        (item) =>
          `${item.id}: ${item.name} (${item.category}${
            item.size ? `, ${item.size}` : ""
          })`,
      )
      .join("\n");
    const today = getTodayKey(env.COMPANY_TIMEZONE);

    const systemPrompt = `You convert Nantucket Event Co. WhatsApp schedules into extremely clear staff job cards.
Today is ${today}. Extract every event mentioned and preserve every operational detail.

SCHEDULING RULES:
- A date-level "Warehouse call" applies to EVERY operational event that follows on that date until another warehouse call or date appears. Put that inherited time in callTime. Owner/Porter visits do not inherit warehouse calls.
- Group tasks into one event when they share the same crew and vehicles. Keep unrelated teams or workstreams separate.
- The event title is ALWAYS the location where the team must go. For one location, use that location alone, such as "Galley Beach." For multiple stops, use the chronological route, such as "Nancy Ann → 45 Tomahawk → Wauwinet." Never use an action such as "Install floor" as the title and never return a missing title when a location appears in the source.
- Put every destination in the locations array in chronological order. This array is used to enforce the title even if title is missing.
- For a time range such as "8AM-12 noon", set time to 08:00 and endTime to 12:00.
- Timeline labels must stand alone. Preserve quantities, dimensions, origin, destination, and venue in the label: for example, "Sort 50-wide frame tops at Nancy Ann and bring them to 45 Tomahawk," not merely "Sort frame tops."
- Put materials and execution requirements in timeline details. Never hide critical instructions only in event notes.
- Copy the relevant original lines into sourceText and produce complete notes as a secondary summary.

STAFF SLANG:
- "olds" always means the staff member "Old School." Map it to Old School's exact database ID.

VEHICLE RULES:
- "SB" means "Stake Body." For example, "White SB" is "White Stake Body."
- Commas, plus signs, and "with" can separate multiple vehicles. "Black stake body, White SB with big tent ox" means three vehicles.
- Put every raw vehicle phrase in vehicleMentions even when you also map its exact database ID.

PACK-LIST RULES:
- Map every explicitly named inventory item. If a quantity truly cannot be derived, use 1.
- Biljax are stage deck sections. Use the inventory size to calculate how many cover the full stage: a 12x24 stage made from 4x4 Biljax needs 18.
- Stage legs and turf are count-free. Include Stage legs and Turf/Turfs in the pack list when mentioned, but do not calculate or communicate a count. The application stores a hidden placeholder quantity only because the database requires one.
- Actual floor inventory items—the records whose names contain "floor," such as New white floor, Pine floor, New brown floor, Old brown floor, and Old white floor—are 4x8-foot panels. Do not apply this rule to every item in the Flooring category; Biljax, turf, and stage legs are not floor panels.
- For a requested finished floor size, calculate the complete panel count. Example: a full 40x40 floor requires 50 panels because 40x40 = 1,600 square feet and each 4x8 panel is 32 square feet. The application verifies this calculation after extraction.
- Retain all stage dimensions in the timeline label and list turf and legs when the message includes them.

EXAMPLE:
Input: "Warehouse call 7AM. 8AM-12 noon team Kenroy sort out 50 wide frame tops at Nancy Ann and bring to 45 Tomahawk. 2PM install 12x24 stage at Wauwinet biljax/turf/legs."
Output behavior: callTime 07:00; first timeline step 08:00-12:00 with the full Nancy Ann-to-45-Tomahawk instruction; second step at 14:00 says "Install 12x24 stage at Wauwinet"; details name Biljax, turf, and legs; pack list contains 18 of the 4x4 Biljax.

If a mentioned person, vehicle, or item has no clear match, omit its ID but preserve the wording in notes, sourceText, or details.

Common venue shorthand: NGC = Nantucket Golf Club; AAN or antiques = Antiques at Bartlett; WMC = Westmoor Club.

Times must be 24-hour HH:mm. Use null for unknown scalar values and empty arrays when a collection has no matches.

STAFF:
${staffList || "No staff records available."}

VEHICLES:
${vehicleList || "No vehicle records available."}

INVENTORY:
${inventoryList || "No inventory records available."}`;

    const { output } = await generateText({
      model: openai(process.env.OPENAI_MODEL || "gpt-4o"),
      system: systemPrompt,
      prompt: text,
      output: Output.object({ schema: quickAddOutputSchema }),
      maxRetries: 2,
      timeout: 45_000,
    });

    const prepared = prepareQuickAddEvents(output, {
      staff: new Set(dbStaff.map((item) => item.id)),
      staffAliases: createStaffAliasMap(dbStaff),
      vehicles: new Set(dbVehicles.map((item) => item.id)),
      inventory: new Set(dbInventory.map((item) => item.id)),
      vehicleAliases: createVehicleAliasMap(dbVehicles),
      inventoryCatalog: new Map(
        dbInventory.map((item) => [
          item.id,
          { name: item.name, size: item.size },
        ]),
      ),
    });

    if (!prepared.events.length) {
      return Response.json(
        {
          error:
            "No events with recognizable dates were found. Include a date such as “June 21” and try again.",
          warnings: prepared.warnings,
        },
        { status: 422 },
      );
    }

    const createdIds: string[] = [];

    await db.transaction(async (tx) => {
      for (const event of prepared.events) {
        const eventId = createId("evt");

        await tx.insert(events).values({
          id: eventId,
          title: event.title,
          eventDate: event.eventDate,
          venue: event.venue,
          address: event.address,
          clientName: null,
          status: "CONFIRMED",
          callTime: event.callTime,
          departureTime: null,
          returnTime: null,
          notes: event.notes,
          staffBrief: null,
          createdBy: auth.session.id,
        });

        if (event.timeline.length) {
          await tx.insert(eventTimeline).values(
            event.timeline.map((entry, index) => ({
              id: createId("tml"),
              eventId,
              time: entry.time,
              endTime: entry.endTime,
              label: entry.label,
              details: entry.details,
              sortOrder: index,
            })),
          );
        }

        if (event.inventory.length) {
          await tx.insert(eventInventory).values(
            event.inventory.map((entry) => ({
              eventId,
              inventoryItemId: entry.itemId,
              quantity: entry.quantity,
              packed: false,
              notes: null,
            })),
          );
        }

        if (event.staffIds.length) {
          await tx.insert(eventStaff).values(
            event.staffIds.map((userId) => ({
              eventId,
              userId,
              assignment: null,
              callTime: event.callTime,
              notes: null,
            })),
          );
        }

        if (event.vehicleIds.length) {
          await tx.insert(eventVehicles).values(
            event.vehicleIds.map((vehicleId) => ({
              eventId,
              vehicleId,
              driverUserId: null,
              destination: event.address ?? event.venue,
              departureTime: null,
              notes: null,
            })),
          );
        }

        createdIds.push(eventId);
      }
    });

    return Response.json({
      success: true,
      createdCount: createdIds.length,
      createdIds,
      warnings: prepared.warnings,
    });
  } catch (error) {
    console.error("Quick Add parse error:", error);

    if (APICallError.isInstance(error)) {
      if (error.statusCode === 401) {
        return Response.json(
          { error: "The OpenAI API key was rejected. Check OPENAI_API_KEY." },
          { status: 502 },
        );
      }
      if (error.statusCode === 429) {
        return Response.json(
          {
            error:
              "OpenAI rate limit or billing limit reached. Wait briefly or check the API account.",
          },
          { status: 429 },
        );
      }
      return Response.json(
        {
          error:
            "OpenAI could not parse this schedule. Please try again in a moment.",
        },
        { status: 502 },
      );
    }

    if (NoOutputGeneratedError.isInstance(error)) {
      return Response.json(
        {
          error:
            "The AI did not return usable event data. Add clearer dates and job headings, then try again.",
        },
        { status: 422 },
      );
    }

    return apiError(error);
  }
}
