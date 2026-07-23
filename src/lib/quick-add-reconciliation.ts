import { z } from "zod";
import { businesses, type Business } from "@/lib/businesses";
import type { PreparedQuickAddEvent } from "@/lib/quick-add";

const reconciliationEventStatuses = ["DRAFT", "CONFIRMED", "COMPLETED"] as const;

const nullableTextSchema = z
  .string()
  .trim()
  .max(5000)
  .nullable()
  .transform((value) => value || null);

const nullableTimeSchema = z
  .union([z.string().regex(/^\d{2}:\d{2}$/), z.literal(""), z.null()])
  .transform((value) => value || null);

const requiredTimeSchema = z.preprocess(
  (value) => (typeof value === "string" && value ? value : "00:00"),
  z.string().regex(/^\d{2}:\d{2}$/),
);

export const quickAddDraftSchema = z.object({
  title: z.string().trim().min(1).max(160),
  eventDate: z.string().date(),
  venue: nullableTextSchema,
  address: nullableTextSchema,
  clientName: nullableTextSchema,
  business: z.enum(businesses),
  status: z.enum(reconciliationEventStatuses).default("CONFIRMED"),
  callTime: nullableTimeSchema,
  departureTime: nullableTimeSchema,
  returnTime: nullableTimeSchema,
  notes: nullableTextSchema,
  staffBrief: nullableTextSchema,
  packerUserId: nullableTextSchema,
  timeline: z
    .array(
      z.object({
        time: requiredTimeSchema,
        endTime: nullableTimeSchema,
        label: z.string().trim().min(1).max(240),
        details: nullableTextSchema,
        sortOrder: z.coerce.number().int().min(0).default(0),
      }),
    )
    .max(100)
    .default([]),
  inventory: z
    .array(
      z.object({
        inventoryItemId: z.string().min(1),
        quantity: z.coerce.number().int().min(1).max(100_000),
        packed: z.boolean().default(false),
        notes: nullableTextSchema,
      }),
    )
    .max(500)
    .default([]),
  staff: z
    .array(
      z.object({
        userId: z.string().min(1),
        assignment: nullableTextSchema,
        callTime: nullableTimeSchema,
        notes: nullableTextSchema,
      }),
    )
    .max(200)
    .default([]),
  vehicles: z
    .array(
      z.object({
        vehicleId: z.string().min(1),
        driverUserId: nullableTextSchema,
        destination: nullableTextSchema,
        departureTime: nullableTimeSchema,
        notes: nullableTextSchema,
      }),
    )
    .max(100)
    .default([]),
});

export type QuickAddEventDraft = z.infer<typeof quickAddDraftSchema>;

export const quickAddPublishSchema = z.object({
  rows: z
    .array(
      z.object({
        rowId: z.string().min(1).max(120),
        originalStatus: z
          .enum(["skip", "create", "needs_review"])
          .optional()
          .default("needs_review"),
        action: z.enum(["create", "update", "skip"]),
        matchedEventId: z.string().nullable().optional(),
        draft: quickAddDraftSchema,
      }),
    )
    .max(200),
});

export type QuickAddPublishInput = z.infer<typeof quickAddPublishSchema>;

export type ReconciliationEvent = {
  id: string;
  title: string;
  eventDate: string;
  venue: string | null;
  address: string | null;
  clientName: string | null;
  business: Business;
  status: (typeof reconciliationEventStatuses)[number];
  callTime: string | null;
  departureTime: string | null;
  returnTime: string | null;
  notes: string | null;
  staffBrief: string | null;
  packerUserId: string | null;
  timeline: Array<{
    time: string;
    endTime: string | null;
    label: string;
    details: string | null;
    sortOrder: number;
  }>;
  inventory: Array<{
    inventoryItemId: string;
    quantity: number;
    packed: boolean;
    notes: string | null;
  }>;
  staff: Array<{
    userId: string;
    assignment: string | null;
    callTime: string | null;
    notes: string | null;
  }>;
  vehicles: Array<{
    vehicleId: string;
    driverUserId: string | null;
    destination: string | null;
    departureTime: string | null;
    notes: string | null;
  }>;
};

export type QuickAddMatchedEvent = {
  id: string;
  title: string;
  eventDate: string;
  venue: string | null;
  callTime: string | null;
};

export type QuickAddPreviewRow = {
  rowId: string;
  status: "skip" | "create" | "needs_review";
  recommendedAction: "skip" | "create" | "update";
  draft: QuickAddEventDraft;
  matchedEvent: QuickAddMatchedEvent | null;
  candidates: QuickAddMatchedEvent[];
  confidence: number;
  reason: string;
  differences: string[];
  warnings: string[];
};

type ComparableInput = QuickAddEventDraft | ReconciliationEvent;

type CandidateScore = {
  event: ReconciliationEvent;
  score: number;
  reasons: string[];
  locationSimilarity: number;
  timelineSimilarity: number;
};

function sortedJson<T>(values: T[]) {
  return JSON.stringify(
    [...values].sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
    ),
  );
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/&/g, " and ")
    .replace(/[×✕]/g, "x")
    .replace(/\bby\b/g, "x")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) =>
      token.length > 3 && token.endsWith("s") ? token.slice(0, -1) : token,
    )
    .join(" ");
}

function tokenSet(value: string | null | undefined) {
  const normalized = normalizeText(value);
  return new Set(normalized ? normalized.split(" ") : []);
}

function textSimilarity(left: string | null | undefined, right: string | null | undefined) {
  const leftKey = normalizeText(left);
  const rightKey = normalizeText(right);
  if (!leftKey && !rightKey) return 1;
  if (!leftKey || !rightKey) return 0;
  if (leftKey === rightKey) return 1;

  const leftTokens = tokenSet(leftKey);
  const rightTokens = tokenSet(rightKey);
  const shared = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return (2 * shared) / (leftTokens.size + rightTokens.size || 1);
}

function jaccard(left: string[], right: string[]) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  if (!leftSet.size && !rightSet.size) return 1;
  const shared = [...leftSet].filter((value) => rightSet.has(value)).length;
  const union = new Set([...leftSet, ...rightSet]).size;
  return shared / (union || 1);
}

function mapEventSummary(event: ReconciliationEvent): QuickAddMatchedEvent {
  return {
    id: event.id,
    title: event.title,
    eventDate: event.eventDate,
    venue: event.venue,
    callTime: event.callTime,
  };
}

function timelineOf(input: ComparableInput) {
  return [...input.timeline]
    .sort((left, right) => left.sortOrder - right.sortOrder || left.time.localeCompare(right.time))
    .map((entry, index) => ({
      time: entry.time,
      endTime: entry.endTime,
      label: normalizeText(entry.label),
      details: normalizeText(entry.details),
      sortOrder: index,
    }));
}

function inventoryOf(input: ComparableInput, includePacked: boolean) {
  return [...input.inventory]
    .map((entry) => ({
      inventoryItemId: entry.inventoryItemId,
      quantity: entry.quantity,
      packed: includePacked ? entry.packed : undefined,
      notes: normalizeText(entry.notes),
    }))
    .sort((left, right) =>
      left.inventoryItemId.localeCompare(right.inventoryItemId),
    );
}

function staffOf(input: ComparableInput) {
  return [...input.staff]
    .map((entry) => ({
      userId: entry.userId,
      assignment: normalizeText(entry.assignment),
      callTime: entry.callTime,
      notes: normalizeText(entry.notes),
    }))
    .sort((left, right) => left.userId.localeCompare(right.userId));
}

function vehicleOf(input: ComparableInput) {
  return [...input.vehicles]
    .map((entry) => ({
      vehicleId: entry.vehicleId,
      driverUserId: entry.driverUserId,
      destination: normalizeText(entry.destination),
      departureTime: entry.departureTime,
      notes: normalizeText(entry.notes),
    }))
    .sort((left, right) => left.vehicleId.localeCompare(right.vehicleId));
}

function jobCardSignature(input: ComparableInput, includePacked = false) {
  return JSON.stringify({
    title: normalizeText(input.title),
    eventDate: input.eventDate,
    venue: normalizeText(input.venue),
    address: normalizeText(input.address),
    clientName: normalizeText(input.clientName),
    business: input.business,
    status: input.status,
    callTime: input.callTime,
    departureTime: input.departureTime,
    returnTime: input.returnTime,
    notes: normalizeText(input.notes),
    staffBrief: normalizeText(input.staffBrief),
    packerUserId: input.packerUserId,
    timeline: timelineOf(input),
    inventory: inventoryOf(input, includePacked),
    staff: staffOf(input),
    vehicles: vehicleOf(input),
  });
}

function operationalSignature(input: ComparableInput) {
  return JSON.stringify({
    title: normalizeText(input.title),
    eventDate: input.eventDate,
    venue: normalizeText(input.venue),
    address: normalizeText(input.address),
    business: input.business,
    callTime: input.callTime,
    timeline: timelineOf(input),
    inventory: inventoryOf(input, false).map(({ packed: _packed, ...entry }) => entry),
    staff: staffOf(input),
    vehicles: vehicleOf(input),
  });
}

function duplicateSignature(input: ComparableInput) {
  return JSON.stringify({
    title: normalizeText(input.title),
    eventDate: input.eventDate,
    business: input.business,
    callTime: input.callTime,
    timeline: timelineOf(input).map((entry) => ({
      time: entry.time,
      endTime: entry.endTime,
      label: entry.label,
    })),
    inventory: inventoryOf(input, false).map((entry) => ({
      inventoryItemId: entry.inventoryItemId,
      quantity: entry.quantity,
    })),
    staff: staffOf(input).map((entry) => ({
      userId: entry.userId,
      callTime: entry.callTime,
    })),
    vehicles: vehicleOf(input).map((entry) => ({
      vehicleId: entry.vehicleId,
    })),
  });
}

function instructionText(input: ComparableInput) {
  return [
    input.notes,
    ...timelineOf(input).map((entry) => entry.details),
    ...staffOf(input).map((entry) => entry.notes),
    ...vehicleOf(input).map((entry) => entry.notes),
  ]
    .filter(Boolean)
    .join(" ");
}

function hasCriticalInstructionSignal(input: ComparableInput) {
  const text = normalizeText(instructionText(input));
  if (!text) return false;

  const withoutBoilerplate = text
    .replace(/\b(?:no|none|nothing)\s+(?:special|important)\s+(?:notes?|instructions?|details?)\b/g, " ")
    .replace(/\bno\s+(?:notes?|instructions?|details?)\b/g, " ")
    .replace(/\bno\s+special\b/g, " ")
    .trim();

  return /\b(?:access|careful|do not|don't|gate|gate code|permit|rain|no parking|client requested|client says|fragile|hand carry|call client|call owner|call before|call when)\b/i.test(
    withoutBoilerplate,
  );
}

export function hasJobCardChanged(
  previous: ReconciliationEvent,
  draft: QuickAddEventDraft,
) {
  return jobCardSignature(previous, false) !== jobCardSignature(draft, false);
}

export function isOperationalDuplicate(
  previous: ReconciliationEvent,
  draft: QuickAddEventDraft,
) {
  if (duplicateSignature(previous) !== duplicateSignature(draft)) return false;

  if (!hasCriticalInstructionSignal(draft)) return true;

  return textSimilarity(instructionText(previous), instructionText(draft)) >= 0.5;
}

function firstTimelineTime(input: ComparableInput) {
  return timelineOf(input)[0]?.time ?? null;
}

function combinedLocationText(input: ComparableInput) {
  return [input.title, input.venue, input.address].filter(Boolean).join(" ");
}

function timelineText(input: ComparableInput) {
  return timelineOf(input)
    .flatMap((entry) => [entry.time, entry.endTime, entry.label, entry.details])
    .filter(Boolean)
    .join(" ");
}

function scoreCandidate(
  draft: QuickAddEventDraft,
  event: ReconciliationEvent,
): CandidateScore {
  let score = 0;
  const reasons: string[] = [];

  if (draft.eventDate === event.eventDate) {
    score += 30;
    reasons.push("same date");
  }

  const locationSimilarity = textSimilarity(
    combinedLocationText(draft),
    combinedLocationText(event),
  );
  if (locationSimilarity === 1) reasons.push("same location/title");
  else if (locationSimilarity >= 0.65) reasons.push("similar location/title");
  score += Math.round(locationSimilarity * 34);

  if (draft.callTime && draft.callTime === event.callTime) {
    score += 8;
    reasons.push("same warehouse call");
  }

  const draftFirstTime = firstTimelineTime(draft);
  const eventFirstTime = firstTimelineTime(event);
  if (draftFirstTime && draftFirstTime === eventFirstTime) {
    score += 8;
    reasons.push("same first job time");
  }

  const timelineSimilarity = textSimilarity(timelineText(draft), timelineText(event));
  score += Math.round(timelineSimilarity * 10);
  if (timelineSimilarity >= 0.8) reasons.push("similar timeline");

  score += Math.round(
    jaccard(
      draft.staff.map((entry) => entry.userId),
      event.staff.map((entry) => entry.userId),
    ) * 5,
  );
  score += Math.round(
    jaccard(
      draft.vehicles.map((entry) => entry.vehicleId),
      event.vehicles.map((entry) => entry.vehicleId),
    ) * 5,
  );
  score += Math.round(
    jaccard(
      draft.inventory.map((entry) => entry.inventoryItemId),
      event.inventory.map((entry) => entry.inventoryItemId),
    ) * 5,
  );

  return { event, score, reasons, locationSimilarity, timelineSimilarity };
}

function isWeakDraft(draft: QuickAddEventDraft) {
  const weakTitle = normalizeText(draft.title) === "location tbd";
  return (
    weakTitle ||
    (!draft.timeline.length &&
      !draft.staff.length &&
      !draft.vehicles.length &&
      !draft.inventory.length)
  );
}

function makeDifferences(
  previous: ReconciliationEvent,
  draft: QuickAddEventDraft,
) {
  const differences: string[] = [];

  if (normalizeText(previous.title) !== normalizeText(draft.title)) {
    differences.push(`Title changes from “${previous.title}” to “${draft.title}”.`);
  }
  if (previous.eventDate !== draft.eventDate) {
    differences.push(`Date changes from ${previous.eventDate} to ${draft.eventDate}.`);
  }
  if (previous.callTime !== draft.callTime) {
    differences.push(
      `Warehouse call changes from ${previous.callTime ?? "TBD"} to ${
        draft.callTime ?? "TBD"
      }.`,
    );
  }
  if (sortedJson(timelineOf(previous)) !== sortedJson(timelineOf(draft))) {
    differences.push("Timeline changed.");
  }
  if (sortedJson(staffOf(previous)) !== sortedJson(staffOf(draft))) {
    differences.push("Crew changed.");
  }
  if (sortedJson(vehicleOf(previous)) !== sortedJson(vehicleOf(draft))) {
    differences.push("Vehicles changed.");
  }
  if (
    sortedJson(inventoryOf(previous, false)) !==
    sortedJson(inventoryOf(draft, false))
  ) {
    differences.push("Pack list changed.");
  }
  if (textSimilarity(previous.notes, draft.notes) < 0.86) {
    differences.push("Notes changed.");
  }

  return differences.length ? differences : ["Job card details changed."];
}

export function buildQuickAddDraft(
  event: PreparedQuickAddEvent,
  business: Business,
): QuickAddEventDraft {
  const rawDraft: QuickAddEventDraft = {
    title: event.title,
    eventDate: event.eventDate,
    venue: event.venue,
    address: event.address,
    clientName: null,
    business,
    status: "CONFIRMED",
    callTime: event.callTime,
    departureTime: null,
    returnTime: null,
    notes: event.notes,
    staffBrief: null,
    packerUserId: null,
    timeline: event.timeline.map((entry, index) => ({
      time: entry.time,
      endTime: entry.endTime,
      label: entry.label,
      details: entry.details,
      sortOrder: index,
    })),
    inventory: event.inventory.map((entry) => ({
      inventoryItemId: entry.itemId,
      quantity: entry.quantity,
      packed: false,
      notes: null,
    })),
    staff: event.staffIds.map((userId) => ({
      userId,
      assignment: null,
      callTime: event.callTime,
      notes: null,
    })),
    vehicles: event.vehicleIds.map((vehicleId) => ({
      vehicleId,
      driverUserId: null,
      destination: event.address ?? event.venue ?? event.title,
      departureTime: null,
      notes: null,
    })),
  };

  return normalizeDraftForWrite(rawDraft);
}

export function normalizeDraftForWrite(
  draft: QuickAddEventDraft,
  options: {
    previousInventory?: ReconciliationEvent["inventory"];
  } = {},
): QuickAddEventDraft {
  const parsed = quickAddDraftSchema.parse(draft);
  const previousInventory = new Map(
    (options.previousInventory ?? []).map((entry) => [
      entry.inventoryItemId,
      entry,
    ]),
  );
  const inventoryById = new Map<
    string,
    { inventoryItemId: string; quantity: number; packed: boolean; notes: string | null }
  >();

  for (const entry of parsed.inventory) {
    const previous = previousInventory.get(entry.inventoryItemId);
    const existing = inventoryById.get(entry.inventoryItemId);
    const quantity = (existing?.quantity ?? 0) + entry.quantity;
    const packed =
      Boolean(previous) &&
      previous?.quantity === quantity &&
      (entry.notes ?? null) === (previous.notes ?? null)
        ? previous.packed
        : false;
    inventoryById.set(entry.inventoryItemId, {
      inventoryItemId: entry.inventoryItemId,
      quantity,
      packed,
      notes: entry.notes,
    });
  }

  const staffById = new Map<string, QuickAddEventDraft["staff"][number]>();
  for (const entry of parsed.staff) {
    if (!staffById.has(entry.userId)) staffById.set(entry.userId, entry);
  }

  const vehiclesById = new Map<string, QuickAddEventDraft["vehicles"][number]>();
  for (const entry of parsed.vehicles) {
    if (!vehiclesById.has(entry.vehicleId)) vehiclesById.set(entry.vehicleId, entry);
  }

  return {
    ...parsed,
    timeline: parsed.timeline.map((entry, index) => ({
      ...entry,
      sortOrder: index,
    })),
    inventory: [...inventoryById.values()],
    staff: [...staffById.values()],
    vehicles: [...vehiclesById.values()],
  };
}

export function reconcileQuickAddDrafts({
  drafts,
  existingEvents,
  warningsByRow,
}: {
  drafts: QuickAddEventDraft[];
  existingEvents: ReconciliationEvent[];
  warningsByRow?: string[][];
}): QuickAddPreviewRow[] {
  return drafts.map((draft, index) => {
    const rowWarnings = warningsByRow?.[index] ?? [];
    const sameDateCandidates = existingEvents
      .filter((event) => event.eventDate === draft.eventDate)
      .map((event) => scoreCandidate(draft, event))
      .filter((candidate) => candidate.score >= 62 && candidate.locationSimilarity >= 0.5)
      .sort((left, right) => right.score - left.score);
    const movedCandidates = existingEvents
      .filter((event) => event.eventDate !== draft.eventDate)
      .map((event) => scoreCandidate(draft, event))
      .filter((candidate) => candidate.score >= 72 && candidate.locationSimilarity >= 0.5)
      .sort((left, right) => right.score - left.score);

    const top = sameDateCandidates[0] ?? null;
    const second = sameDateCandidates[1] ?? null;
    const candidates = sameDateCandidates.slice(0, 3).map((candidate) => candidate.event);

    if (rowWarnings.length) {
      return {
        rowId: `quick-add-${index}`,
        status: "needs_review",
        recommendedAction: top ? "update" : "create",
        draft,
        matchedEvent: top ? mapEventSummary(top.event) : null,
        candidates: candidates.map(mapEventSummary),
        confidence: top?.score ?? 0,
        reason: "Some staff, vehicle, or inventory references need a human check.",
        differences: top ? makeDifferences(top.event, draft) : [],
        warnings: rowWarnings,
      };
    }

    if (isWeakDraft(draft)) {
      return {
        rowId: `quick-add-${index}`,
        status: "needs_review",
        recommendedAction: top ? "update" : "create",
        draft,
        matchedEvent: top ? mapEventSummary(top.event) : null,
        candidates: candidates.map(mapEventSummary),
        confidence: top?.score ?? 0,
        reason: "Date, location, or job details are too weak to publish automatically.",
        differences: top ? makeDifferences(top.event, draft) : [],
        warnings: ["Review this row before saving."],
      };
    }

    if (top && second && second.score >= top.score - 8) {
      return {
        rowId: `quick-add-${index}`,
        status: "needs_review",
        recommendedAction: "skip",
        draft,
        matchedEvent: mapEventSummary(top.event),
        candidates: candidates.map(mapEventSummary),
        confidence: top.score,
        reason: "Multiple existing jobs look like possible matches.",
        differences: makeDifferences(top.event, draft),
        warnings: ["Choose whether this is an update or a separate job."],
      };
    }

    if (top) {
      if (isOperationalDuplicate(top.event, draft)) {
        return {
          rowId: `quick-add-${index}`,
          status: "skip",
          recommendedAction: "skip",
          draft,
          matchedEvent: mapEventSummary(top.event),
          candidates: candidates.map(mapEventSummary),
          confidence: top.score,
          reason: `Already exists (${top.reasons.join(", ")}).`,
          differences: [],
          warnings: [],
        };
      }

      return {
        rowId: `quick-add-${index}`,
        status: "needs_review",
        recommendedAction: "update",
        draft,
        matchedEvent: mapEventSummary(top.event),
        candidates: candidates.map(mapEventSummary),
        confidence: top.score,
        reason: `Looks like an existing job, but the job card changed (${top.reasons.join(
          ", ",
        )}).`,
        differences: makeDifferences(top.event, draft),
        warnings: [],
      };
    }

    const moved = movedCandidates[0] ?? null;
    if (moved) {
      return {
        rowId: `quick-add-${index}`,
        status: "needs_review",
        recommendedAction: "update",
        draft,
        matchedEvent: mapEventSummary(moved.event),
        candidates: movedCandidates.slice(0, 3).map((candidate) =>
          mapEventSummary(candidate.event),
        ),
        confidence: moved.score,
        reason:
          "This looks like an existing job that may have moved to a different date.",
        differences: makeDifferences(moved.event, draft),
        warnings: ["Moved jobs require review before replacing the old card."],
      };
    }

    return {
      rowId: `quick-add-${index}`,
      status: "create",
      recommendedAction: "create",
      draft,
      matchedEvent: null,
      candidates: [],
      confidence: 0,
      reason: "No plausible existing job found.",
      differences: [],
      warnings: [],
    };
  });
}
