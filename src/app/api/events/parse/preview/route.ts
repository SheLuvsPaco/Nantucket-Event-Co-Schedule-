import { APICallError, NoOutputGeneratedError } from "ai";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { events } from "@/db/schema";
import { requireApiSession } from "@/lib/auth";
import { apiError } from "@/lib/http";
import {
  reconcileQuickAddDrafts,
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

    return Response.json({
      business: parsed.business,
      rows,
      warnings: parsed.warnings,
      summary: {
        create: rows.filter((row) => row.status === "create").length,
        skip: rows.filter((row) => row.status === "skip").length,
        needsReview: rows.filter((row) => row.status === "needs_review").length,
      },
    });
  } catch (error) {
    console.error("Quick Add preview error:", error);
    const aiError = parseApiError(error);
    if (aiError) return aiError;
    return apiError(error);
  }
}
