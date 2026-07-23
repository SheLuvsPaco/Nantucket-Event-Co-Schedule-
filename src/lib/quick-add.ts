import { z } from "zod";
import { isDateKey } from "@/lib/date";
import { isCountFreePackItem } from "@/lib/pack-list";

const nullableString = z.string().nullable();

export const quickAddOutputSchema = z.object({
  events: z.array(
    z.object({
      eventId: z.string().nullable().describe("If updating an existing event, provide its exact ID here. Leave null for new events."),
      title: nullableString.describe(
        "The work location, or an arrow-separated route when the crew goes to multiple locations.",
      ),
      locations: z.array(z.string()).describe(
        "Every location the crew must go, in chronological order, without duplicates.",
      ),
      eventDate: nullableString.describe("Event date in YYYY-MM-DD format."),
      venue: nullableString.describe("Primary venue or property name."),
      address: nullableString.describe("Street address or destination when provided."),
      callTime: nullableString.describe(
        "Warehouse call inherited from the date-level schedule, or null only when none applies.",
      ),
      notes: nullableString.describe(
        "Complete staff-facing summary preserving quantities, dimensions, materials, origin, destination, and special instructions.",
      ),
      sourceText: nullableString.describe(
        "The relevant source lines copied verbatim from the pasted schedule.",
      ),
      staffIds: z.array(z.string()),
      vehicleIds: z.array(z.string()),
      vehicleMentions: z.array(z.string()).describe(
        "Every vehicle phrase explicitly mentioned for this event, split into one phrase per vehicle.",
      ),
      inventory: z.array(
        z.object({
          itemId: nullableString,
          quantity: z.number().nullable(),
        }),
      ),
      timeline: z.array(
        z.object({
          time: nullableString,
          endTime: nullableString.describe(
            "End time in HH:mm when the source gives a time range, otherwise null.",
          ),
          label: nullableString.describe(
            "Standalone complete action retaining quantities, dimensions, origin, destination, and venue.",
          ),
          details: nullableString.describe(
            "Materials, equipment, completion requirements, or other critical instructions for this step.",
          ),
        }),
      ),
    }),
  ),
});

export type QuickAddOutput = z.infer<typeof quickAddOutputSchema>;

export type PreparedQuickAddEvent = {
  eventId: string | null;
  title: string;
  eventDate: string;
  venue: string | null;
  address: string | null;
  callTime: string | null;
  notes: string | null;
  sourceText: string | null;
  staffIds: string[];
  vehicleIds: string[];
  inventory: Array<{ itemId: string; quantity: number }>;
  timeline: Array<{
    time: string;
    endTime: string | null;
    label: string;
    details: string | null;
  }>;
  unresolvedReferences: number;
  warnings: string[];
};

function cleanText(value: string | null) {
  const cleaned = value?.trim();
  return cleaned || null;
}

export function normalizeClockTime(value: string | null | undefined) {
  if (!value) return null;

  const normalized = value
    .trim()
    .toUpperCase()
    .replaceAll(".", "")
    .replace(/\s+/g, "");
  const periodMatch = normalized.match(/(AM|PM)$/);
  const period = periodMatch?.[1] as "AM" | "PM" | undefined;
  const clock = period ? normalized.slice(0, -period.length) : normalized;

  let hours: number;
  let minutes: number;

  if (clock.includes(":")) {
    const [hourPart, minutePart] = clock.split(":");
    hours = Number(hourPart);
    minutes = Number(minutePart);
  } else if (/^\d{1,4}$/.test(clock)) {
    if (clock.length <= 2) {
      hours = Number(clock);
      minutes = 0;
    } else {
      hours = Number(clock.slice(0, -2));
      minutes = Number(clock.slice(-2));
    }
  } else {
    return null;
  }

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (minutes < 0 || minutes > 59) return null;

  if (period) {
    if (hours < 1 || hours > 12) return null;
    hours %= 12;
    if (period === "PM") hours += 12;
  } else if (hours < 0 || hours > 23) {
    return null;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function normalizeQuickAddDate(value: string | null | undefined) {
  if (!value) return null;
  const cleaned = value.trim();
  if (isDateKey(cleaned)) return cleaned;

  const usDate = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!usDate) return null;

  const [, month, day, year] = usDate;
  const candidate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  return isDateKey(candidate) ? candidate : null;
}

function uniqueValidIds(ids: string[], validIds: Set<string>) {
  return [...new Set(ids.filter((id) => validIds.has(id)))];
}

export function createStaffAliasMap(
  records: Array<{ id: string; name: string }>,
) {
  const aliases = new Map<string, string>();

  for (const record of records) {
    const name = normalizeAlias(record.name);
    aliases.set(name, record.id);

    if (name === "old school") {
      aliases.set("olds", record.id);
    }
  }

  return aliases;
}

function normalizeAlias(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function createVehicleAliasMap(
  records: Array<{
    id: string;
    name: string;
    type?: string | null;
    color?: string | null;
  }>,
) {
  const aliases = new Map<string, string>();

  for (const record of records) {
    const name = normalizeAlias(record.name);
    aliases.set(name, record.id);

    if (name.includes("stake body")) {
      aliases.set(name.replace("stake body", "sb"), record.id);
      if (record.color) {
        aliases.set(`${normalizeAlias(record.color)} sb`, record.id);
      }
    }

    if (name.match(/^transit van \d+$/)) {
      aliases.set("transit van", aliases.get("transit van") ?? record.id);
    }
  }

  return aliases;
}

function resolveVehicleMentions(
  mentions: string[],
  aliases: Map<string, string>,
) {
  const orderedAliases = [...aliases.entries()].toSorted(
    ([left], [right]) => right.length - left.length,
  );
  const matchedIds = new Set<string>();
  let unresolved = 0;

  for (const mention of mentions) {
    const normalizedMention = normalizeAlias(mention);
    const matches = orderedAliases
      .flatMap(([alias, id]) => {
        const match = new RegExp(
          `(?:^| )${alias.replaceAll(" ", "\\s+")}(?: |$)`,
        ).exec(normalizedMention);
        return match ? [{ id, index: match.index }] : [];
      })
      .toSorted((left, right) => left.index - right.index);

    if (!matches.length) {
      unresolved++;
      continue;
    }

    for (const { id } of matches) matchedIds.add(id);
  }

  return { ids: [...matchedIds], unresolved };
}

function resolveAliasesFromText(text: string, aliases: Map<string, string>) {
  const normalizedText = ` ${normalizeAlias(text)} `;
  const matchedIds = new Set<string>();

  for (const [alias, id] of aliases) {
    const pattern = new RegExp(`(?:^| )${alias.replaceAll(" ", "\\s+")}(?: |$)`);
    if (pattern.test(normalizedText)) matchedIds.add(id);
  }

  return [...matchedIds];
}

function getStageDimensions(text: string) {
  const stageFirst = text.match(
    /\bstage\b[^.\n]{0,40}?(\d+)\s*(?:x|×|by)\s*(\d+)/i,
  );
  const dimensionsFirst = text.match(
    /(\d+)\s*(?:x|×|by)\s*(\d+)[^.\n]{0,20}?\bstage\b/i,
  );
  const match = stageFirst ?? dimensionsFirst;
  return match ? { width: Number(match[1]), length: Number(match[2]) } : null;
}

function getItemDimensions(size: string | null) {
  const match = size?.match(/(\d+)\s*(?:x|×|by)\s*(\d+)/i);
  return match ? { width: Number(match[1]), length: Number(match[2]) } : null;
}

function getFloorDimensions(text: string) {
  const floorFirst = text.match(
    /\bfloor\b[^.\n]{0,60}?(\d+)\s*(?:x|×|by)\s*(\d+)/i,
  );
  const dimensionsFirst = text.match(
    /(\d+)\s*(?:x|×|by)\s*(\d+)[^.\n]{0,40}?\b(?:floor|tent)\b/i,
  );
  const match = floorFirst ?? dimensionsFirst;
  return match ? { width: Number(match[1]), length: Number(match[2]) } : null;
}

function calculatePanelQuantity(
  surface: { width: number; length: number },
  panel: { width: number; length: number },
) {
  const firstOrientation =
    Math.ceil(surface.width / panel.width) *
    Math.ceil(surface.length / panel.length);
  const rotatedOrientation =
    Math.ceil(surface.width / panel.length) *
    Math.ceil(surface.length / panel.width);
  return Math.min(firstOrientation, rotatedOrientation);
}

function isActualFloor(name: string) {
  return /\bfloor\b/i.test(name);
}

function uniqueLocations(locations: string[]) {
  const seen = new Set<string>();
  return locations.flatMap((location) => {
    const cleaned = location.trim();
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) return [];
    seen.add(key);
    return [cleaned];
  });
}

export function prepareQuickAddEvents(
  output: QuickAddOutput,
  validIds: {
    staff: Set<string>;
    vehicles: Set<string>;
    inventory: Set<string>;
    staffAliases?: Map<string, string>;
    vehicleAliases?: Map<string, string>;
    inventoryCatalog?: Map<string, { name: string; size: string | null }>;
  },
) {
  const skippedDates: string[] = [];
  let ignoredReferences = 0;

  const events = output.events.flatMap<PreparedQuickAddEvent>((event) => {
    let eventIgnoredReferences = 0;
    const eventDate = normalizeQuickAddDate(event.eventDate);
    if (!eventDate) {
      skippedDates.push(event.eventDate ?? "missing date");
      return [];
    }

    const staffAliasIds = resolveAliasesFromText(
      event.sourceText ?? "",
      validIds.staffAliases ?? new Map(),
    );
    const staffIds = uniqueValidIds(
      [...event.staffIds, ...staffAliasIds],
      validIds.staff,
    );
    const resolvedVehicles = resolveVehicleMentions(
      event.vehicleMentions,
      validIds.vehicleAliases ?? new Map(),
    );
    const vehicleIds = uniqueValidIds(
      [...event.vehicleIds, ...resolvedVehicles.ids],
      validIds.vehicles,
    );
    eventIgnoredReferences += event.staffIds.filter(
      (id) => !validIds.staff.has(id),
    ).length;
    eventIgnoredReferences += event.vehicleIds.filter(
      (id) => !validIds.vehicles.has(id),
    ).length;
    eventIgnoredReferences += resolvedVehicles.unresolved;

    const inventoryById = new Map<string, number>();
    for (const item of event.inventory) {
      if (!item.itemId || !validIds.inventory.has(item.itemId)) {
        eventIgnoredReferences++;
        continue;
      }
      const quantity =
        typeof item.quantity === "number" && Number.isFinite(item.quantity)
        ? Math.max(1, Math.min(100_000, Math.round(item.quantity)))
        : 1;
      inventoryById.set(
        item.itemId,
        (inventoryById.get(item.itemId) ?? 0) + quantity,
      );
    }

    const taskText = [
      event.title,
      event.notes,
      event.sourceText,
      ...event.timeline.flatMap((entry) => [entry.label, entry.details]),
    ]
      .filter(Boolean)
      .join(" ");
    const stageDimensions = getStageDimensions(taskText);
    const floorDimensions = getFloorDimensions(taskText);

    if (stageDimensions && /\bbil[\s-]?jax\b/i.test(taskText)) {
      for (const [itemId, quantity] of inventoryById) {
        const item = validIds.inventoryCatalog?.get(itemId);
        if (!item || !/\bbil[\s-]?jax\b/i.test(item.name)) continue;

        const panel = getItemDimensions(item.size);
        if (!panel) continue;

        const requiredPanels = calculatePanelQuantity(stageDimensions, panel);
        inventoryById.set(itemId, Math.max(quantity, requiredPanels));
      }
    }

    if (floorDimensions && /\bfloor\b/i.test(taskText)) {
      for (const [itemId, quantity] of inventoryById) {
        const item = validIds.inventoryCatalog?.get(itemId);
        if (!item || !isActualFloor(item.name)) continue;

        const panel = getItemDimensions(item.size);
        if (!panel) continue;

        const requiredPanels = calculatePanelQuantity(floorDimensions, panel);
        inventoryById.set(itemId, Math.max(quantity, requiredPanels));
      }
    }

    for (const [itemId] of inventoryById) {
      const item = validIds.inventoryCatalog?.get(itemId);
      if (item && isCountFreePackItem(item.name)) {
        inventoryById.set(itemId, 1);
      }
    }

    const timeline = event.timeline.flatMap((entry) => {
      const time = normalizeClockTime(entry.time);
      const endTime = normalizeClockTime(entry.endTime);
      const label = cleanText(entry.label);
      const details = cleanText(entry.details);
      return time && label ? [{ time, endTime, label, details }] : [];
    });

    const locations = uniqueLocations(event.locations);
    const venue = cleanText(event.venue);
    const address = cleanText(event.address);
    const locationTitle =
      locations.join(" → ") ||
      venue ||
      address ||
      cleanText(event.title) ||
      "Location TBD";
    ignoredReferences += eventIgnoredReferences;
    const eventWarnings =
      eventIgnoredReferences > 0
        ? [
            `${eventIgnoredReferences} staff, vehicle, or inventory reference${
              eventIgnoredReferences === 1 ? "" : "s"
            } could not be matched.`,
          ]
        : [];

    return [
      {
        eventId: event.eventId,
        title: locationTitle,
        eventDate,
        venue,
        address,
        callTime: normalizeClockTime(event.callTime),
        notes: cleanText(event.notes),
        sourceText: cleanText(event.sourceText),
        staffIds,
        vehicleIds,
        inventory: [...inventoryById].map(([itemId, quantity]) => ({
          itemId,
          quantity,
        })),
        timeline,
        unresolvedReferences: eventIgnoredReferences,
        warnings: eventWarnings,
      },
    ];
  });

  return {
    events,
    warnings: {
      skippedDates,
      ignoredReferences,
    },
  };
}
