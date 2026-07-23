import { APICallError, NoOutputGeneratedError } from "ai";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  eventInventory,
  eventStaff,
  eventTimeline,
  eventVehicles,
  events,
} from "@/db/schema";
import { requireApiSession } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { createId } from "@/lib/ids";
import {
  reconcileQuickAddDrafts,
  type QuickAddEventDraft,
  type ReconciliationEvent,
} from "@/lib/quick-add-reconciliation";
import {
  parseQuickAddText,
  quickAddRequestSchema,
} from "@/lib/quick-add-server";

export const runtime = "nodejs";

function shiftDate(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function insertCreatedEvent({
  tx,
  draft,
  createdBy,
}: {
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0];
  draft: QuickAddEventDraft;
  createdBy: string;
}) {
  const eventId = createId("evt");

  await tx.insert(events).values({
    id: eventId,
    title: draft.title,
    eventDate: draft.eventDate,
    venue: draft.venue,
    address: draft.address,
    clientName: draft.clientName,
    business: draft.business,
    status: draft.status,
    callTime: draft.callTime,
    departureTime: draft.departureTime,
    returnTime: draft.returnTime,
    notes: draft.notes,
    staffBrief: draft.staffBrief,
    packerUserId: draft.packerUserId,
    createdBy,
  });

  if (draft.timeline.length) {
    await tx.insert(eventTimeline).values(
      draft.timeline.map((entry, index) => ({
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
  if (draft.inventory.length) {
    await tx.insert(eventInventory).values(
      draft.inventory.map((entry, index) => ({
        id: createId("evi"),
        eventId,
        ...entry,
        section: null,
        sortOrder: index,
      })),
    );
  }
  if (draft.staff.length) {
    await tx
      .insert(eventStaff)
      .values(draft.staff.map((entry) => ({ eventId, ...entry })));
  }
  if (draft.vehicles.length) {
    await tx
      .insert(eventVehicles)
      .values(draft.vehicles.map((entry) => ({ eventId, ...entry })));
  }

  return eventId;
}

function parseApiError(error: unknown) {
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

  if (error instanceof Error && error.message.includes("OpenAI API key is missing")) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return null;
}

export async function POST(request: Request) {
  const auth = await requireApiSession(["ADMIN", "OWNER"]);
  if (auth.error) return auth.error;

  try {
    const input = quickAddRequestSchema.parse(await request.json());
    const parsed = await parseQuickAddText(input);

    if (!parsed.drafts.length) {
      return Response.json(
        {
          error:
            "No events with recognizable dates were found. Include a date such as “June 21” and try again.",
          warnings: parsed.warnings,
        },
        { status: 422 },
      );
    }

    const dates = parsed.drafts.map((draft) => draft.eventDate).sort();
    const startDate = shiftDate(dates[0], -14);
    const endDate = shiftDate(dates.at(-1)!, 14);
    const existingEvents = (await db.query.events.findMany({
      where: and(
        eq(events.business, parsed.business),
        gte(events.eventDate, startDate),
        lte(events.eventDate, endDate),
      ),
      orderBy: [asc(events.eventDate), asc(events.callTime), asc(events.title)],
      with: {
        timeline: true,
        inventory: true,
        staff: true,
        vehicles: true,
      },
    })) as ReconciliationEvent[];

    const rows = reconcileQuickAddDrafts({
      drafts: parsed.drafts,
      existingEvents,
      warningsByRow: parsed.warningsByRow,
    });
    const needsReview = rows.filter((row) => row.status === "needs_review");
    if (needsReview.length) {
      return Response.json(
        {
          error:
            "Some jobs need review before saving. Open Quick Add again to review the changes.",
          rows,
          warnings: parsed.warnings,
        },
        { status: 409 },
      );
    }

    const createRows = rows.filter((row) => row.status === "create");
    const createdIds: string[] = [];

    await db.transaction(async (tx) => {
      for (const row of createRows) {
        createdIds.push(
          await insertCreatedEvent({
            tx,
            draft: row.draft,
            createdBy: auth.session.id,
          }),
        );
      }
    });

    return Response.json({
      createdCount: createdIds.length,
      updatedCount: 0,
      skippedCount: rows.filter((row) => row.status === "skip").length,
      createdIds,
      warnings: parsed.warnings,
    });
  } catch (error) {
    console.error("Quick Add parse error:", error);
    const aiError = parseApiError(error);
    if (aiError) return aiError;
    return apiError(error);
  }
}
