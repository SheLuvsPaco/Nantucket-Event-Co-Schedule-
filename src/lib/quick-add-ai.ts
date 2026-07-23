import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { businesses, businessLabels, type Business } from "@/lib/businesses";
import {
  createStaffAliasMap,
  createVehicleAliasMap,
  prepareQuickAddEvents,
  quickAddOutputSchema,
} from "@/lib/quick-add";
import {
  buildQuickAddDraft,
  type QuickAddEventDraft,
} from "@/lib/quick-add-reconciliation";

export type QuickAddCatalog = {
  staff: Array<{ id: string; name: string }>;
  vehicles: Array<{
    id: string;
    name: string;
    type?: string | null;
    color?: string | null;
  }>;
  inventory: Array<{
    id: string;
    name: string;
    category: string;
    size: string | null;
  }>;
};

export type QuickAddAiParseInput = {
  apiKey: string;
  model: string;
  business: Business;
  text: string;
  today: string;
  catalog: QuickAddCatalog;
  timeout?: number;
};

export type QuickAddAiParseResult = {
  business: Business;
  drafts: QuickAddEventDraft[];
  warningsByRow: string[][];
  warnings: {
    skippedDates: string[];
    ignoredReferences: number;
  };
};

function makeSystemPrompt({
  business,
  catalog,
  today,
}: Pick<QuickAddAiParseInput, "business" | "catalog" | "today">) {
  const staffList = catalog.staff
    .map((item) => `${item.id}: ${item.name}`)
    .join("\n");
  const vehicleList = catalog.vehicles
    .map((item) => {
      const aliases = item.name.includes("Stake Body")
        ? `; aliases include ${item.name.replace("Stake Body", "SB")}`
        : "";
      return `${item.id}: ${item.name}${aliases}`;
    })
    .join("\n");
  const inventoryList = catalog.inventory
    .map(
      (item) =>
        `${item.id}: ${item.name} (${item.category}${
          item.size ? `, ${item.size}` : ""
        })`,
    )
    .join("\n");

  return `You convert Nantucket Event Co. WhatsApp schedules into extremely clear staff job cards.
Today is ${today}. Extract every event mentioned and preserve every operational detail.

IMPORTANT RECONCILIATION RULE:
- Do not decide whether a job already exists. Always leave eventId null. The server will safely compare the extracted drafts against the database.

SCHEDULING RULES:
- The branch for this import is ${businessLabels[business]}. Every extracted event from this message belongs to ${businessLabels[business]}.
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
}

function estimateTimedJobLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) =>
      /\b(?:\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)|noon|midnight)\b/i.test(
        line,
      ),
    )
    .filter((line) => !/\b(?:warehouse\s+call|depart(?:ure)?\s+for)\b/i.test(line))
    .filter((line) =>
      /\b(?:break(?:\s|-)?down|bring|deliver|drop(?:\s|-)?off|floor|install|pick(?:\s|-)?up|set(?:\s|-)?up|sort|stage|tent|visit)\b/i.test(
        line,
      ),
    ).length;
}

function shouldRetrySparseBulkExtraction(text: string, draftCount: number) {
  const expectedJobLines = estimateTimedJobLines(text);
  return expectedJobLines >= 4 && draftCount < Math.ceil(expectedJobLines * 0.65);
}

export async function parseQuickAddTextWithCatalog({
  apiKey,
  model,
  business,
  text,
  today,
  catalog,
  timeout = 45_000,
}: QuickAddAiParseInput): Promise<QuickAddAiParseResult> {
  if (!apiKey) {
    throw new Error("OpenAI API key is missing.");
  }
  if (!businesses.includes(business)) {
    throw new Error(`Unsupported business: ${business}`);
  }

  const openai = createOpenAI({ apiKey });
  const system = makeSystemPrompt({ business, catalog, today });
  const extractionOptions = {
    staff: new Set(catalog.staff.map((item) => item.id)),
    staffAliases: createStaffAliasMap(catalog.staff),
    vehicles: new Set(catalog.vehicles.map((item) => item.id)),
    inventory: new Set(catalog.inventory.map((item) => item.id)),
    vehicleAliases: createVehicleAliasMap(catalog.vehicles),
    inventoryCatalog: new Map(
      catalog.inventory.map((item) => [
        item.id,
        { name: item.name, size: item.size },
      ]),
    ),
  };

  async function extractAndPrepare(prompt: string) {
    const { output } = await generateText({
      model: openai(model),
      system,
      prompt,
      output: Output.object({ schema: quickAddOutputSchema }),
      maxRetries: 2,
      timeout,
    });
    return prepareQuickAddEvents(output, extractionOptions);
  }

  let prepared = await extractAndPrepare(text);
  if (shouldRetrySparseBulkExtraction(text, prepared.events.length)) {
    try {
      const repaired = await extractAndPrepare(
        `The previous extraction returned too few job cards for this bulk schedule paste.

Extract EVERY operational job line. Do not summarize the month into one event. Preserve separate dates and separate timed jobs. If multiple lines on the same date are unrelated workstreams, create separate events. If multiple lines share the same crew and vehicles, group them into one event with multiple timeline steps.

SOURCE WHATSAPP MESSAGE:
${text}`,
      );
      if (repaired.events.length > prepared.events.length) {
        prepared = repaired;
      }
    } catch {
      // Keep the first extraction. The preview/reconciliation layer will still surface
      // what was parsed instead of making the whole Quick Add flow fail.
    }
  }

  return {
    business,
    drafts: prepared.events.map((event) => buildQuickAddDraft(event, business)),
    warningsByRow: prepared.events.map((event) => event.warnings),
    warnings: prepared.warnings,
  };
}
