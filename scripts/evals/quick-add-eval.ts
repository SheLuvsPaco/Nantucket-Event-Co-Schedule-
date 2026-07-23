import { loadEnvConfig } from "@next/env";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  parseQuickAddTextWithCatalog,
  type QuickAddCatalog,
} from "../../src/lib/quick-add-ai";
import {
  reconcileQuickAddDrafts,
  type QuickAddEventDraft,
  type QuickAddPreviewRow,
  type ReconciliationEvent,
} from "../../src/lib/quick-add-reconciliation";

loadEnvConfig(process.cwd(), true);

function unquoteEnvValue(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function preferLocalEnv(keys: string[]) {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  const contents = readFileSync(envPath, "utf8");
  const values = new Map<string, string>();
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || line.trimStart().startsWith("#")) continue;
    values.set(match[1], unquoteEnvValue(match[2]));
  }

  for (const key of keys) {
    const value = values.get(key);
    if (value) process.env[key] = value;
  }
}

preferLocalEnv(["OPENAI_API_KEY", "OPENAI_MODEL"]);

function redactSecrets(value: string) {
  return value.replace(/sk-[A-Za-z0-9_-]{8,}/g, "[redacted-openai-key]");
}

const TODAY = "2026-06-18";

const catalog: QuickAddCatalog = {
  staff: [
    { id: "usr_zach", name: "Zach" },
    { id: "usr_fuerte", name: "Fuerte" },
    { id: "usr_jay", name: "Jay" },
    { id: "usr_gabe", name: "Gabe" },
    { id: "usr_courtney", name: "Courtney" },
    { id: "usr_reid", name: "Reid" },
    { id: "usr_old_school", name: "Old School" },
    { id: "usr_kenroy", name: "Kenroy" },
    { id: "usr_colin", name: "Colin" },
    { id: "usr_simone", name: "Simone" },
    { id: "usr_goran", name: "Goran" },
    { id: "usr_stivan", name: "Stivan" },
    { id: "usr_younes", name: "Younes" },
    { id: "usr_paco", name: "Paco" },
    { id: "usr_sardine", name: "Sardine" },
    { id: "usr_porter", name: "Porter" },
  ],
  vehicles: [
    {
      id: "veh_black_stake_body",
      name: "Black Stake Body",
      type: "Stake Body",
      color: "Black",
    },
    {
      id: "veh_white_stake_body",
      name: "White Stake Body",
      type: "Stake Body",
      color: "White",
    },
    {
      id: "veh_big_tent_ox",
      name: "Big Tent Ox",
      type: "Loader",
      color: "Green",
    },
    {
      id: "veh_small_tent_ox",
      name: "Small Tent Ox",
      type: "Loader",
      color: "Green",
    },
    {
      id: "veh_transit_van_1",
      name: "Transit Van 1",
      type: "Passenger Van",
      color: "White",
    },
    {
      id: "veh_box_truck",
      name: "Box Truck",
      type: "Box Truck",
      color: "White",
    },
  ],
  inventory: [
    {
      id: "inv_new_white_floor",
      name: "New white floor",
      category: "Flooring",
      size: "4x8 ft",
    },
    {
      id: "inv_new_brown_floor",
      name: "New brown floor",
      category: "Flooring",
      size: "4x8 ft",
    },
    {
      id: "inv_pine_floor",
      name: "Pine floor",
      category: "Flooring",
      size: "4x8 ft",
    },
    {
      id: "inv_biljax",
      name: "Biljax",
      category: "Flooring",
      size: "4x4",
    },
    {
      id: "inv_turfs",
      name: "Turfs",
      category: "Flooring",
      size: null,
    },
    {
      id: "inv_stage_legs",
      name: "Stage legs",
      category: "Flooring",
      size: null,
    },
    {
      id: "inv_frame_tops_50",
      name: "50 Wide Frame Tops",
      category: "Tent Accessories",
      size: "50 wide",
    },
    {
      id: "inv_chef_tent_20",
      name: "Chef Tent",
      category: "Tents",
      size: "20x20",
    },
    {
      id: "inv_chef_tent_30",
      name: "Chef Tent",
      category: "Tents",
      size: "30x30",
    },
    {
      id: "inv_clear_sides_20",
      name: "Clear Sides",
      category: "Tent Accessories",
      size: "7.5x20",
    },
    {
      id: "inv_cafe_lighting",
      name: "Cafe lighting",
      category: "Lighting",
      size: null,
    },
    {
      id: "inv_stakes",
      name: "Stakes",
      category: "Hardware",
      size: null,
    },
    {
      id: "inv_whacker",
      name: "Whacker",
      category: "Tools",
      size: null,
    },
  ],
};

type EvalContext = {
  parsed: Awaited<ReturnType<typeof parseQuickAddTextWithCatalog>>;
  rows: QuickAddPreviewRow[];
};

type EvalCheck = {
  label: string;
  run: (context: EvalContext) => boolean | string;
};

type EvalCase = {
  id: string;
  name: string;
  text: string;
  existingEvents?: ReconciliationEvent[];
  checks: EvalCheck[];
};

function draftEvent(
  overrides: Partial<QuickAddEventDraft> & { title: string; eventDate: string },
): QuickAddEventDraft {
  return {
    title: overrides.title,
    eventDate: overrides.eventDate,
    venue: overrides.venue ?? overrides.title,
    address: overrides.address ?? null,
    clientName: null,
    business: "TENTS",
    status: "CONFIRMED",
    callTime: overrides.callTime ?? "07:00",
    departureTime: null,
    returnTime: null,
    notes: overrides.notes ?? null,
    staffBrief: null,
    packerUserId: null,
    timeline: overrides.timeline ?? [],
    inventory: overrides.inventory ?? [],
    staff: overrides.staff ?? [],
    vehicles: overrides.vehicles ?? [],
  };
}

function existingEvent(
  id: string,
  draft: QuickAddEventDraft,
  overrides: Partial<ReconciliationEvent> = {},
): ReconciliationEvent {
  return {
    id,
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
    timeline: draft.timeline,
    inventory: draft.inventory.map((entry) => ({ ...entry, packed: false })),
    staff: draft.staff,
    vehicles: draft.vehicles,
    ...overrides,
  };
}

const sconsetBaseDraft = draftEvent({
  title: "Sconset Casino",
  eventDate: "2026-06-23",
  callTime: "07:00",
  notes: "Install 20x20 Chef Tent at Sconset Casino.",
  timeline: [
    {
      time: "08:00",
      endTime: "10:00",
      label: "Install 20x20 Chef Tent at Sconset Casino",
      details: null,
      sortOrder: 0,
    },
  ],
  inventory: [
    {
      inventoryItemId: "inv_chef_tent_20",
      quantity: 1,
      packed: false,
      notes: null,
    },
  ],
  staff: [
    { userId: "usr_zach", assignment: null, callTime: "07:00", notes: null },
    { userId: "usr_fuerte", assignment: null, callTime: "07:00", notes: null },
  ],
  vehicles: [
    {
      vehicleId: "veh_black_stake_body",
      driverUserId: null,
      destination: "Sconset Casino",
      departureTime: null,
      notes: null,
    },
  ],
});

function findDraft(context: EvalContext, titlePart: string) {
  const needle = titlePart.toLowerCase();
  return context.parsed.drafts.find((draft) =>
    draft.title.toLowerCase().includes(needle),
  );
}

function countStatuses(rows: QuickAddPreviewRow[]) {
  return rows.reduce(
    (counts, row) => {
      counts[row.status] += 1;
      return counts;
    },
    { create: 0, skip: 0, needs_review: 0 },
  );
}

function hasVehicle(draft: QuickAddEventDraft | undefined, vehicleId: string) {
  return Boolean(draft?.vehicles.some((entry) => entry.vehicleId === vehicleId));
}

function hasStaff(draft: QuickAddEventDraft | undefined, userId: string) {
  return Boolean(draft?.staff.some((entry) => entry.userId === userId));
}

function inventoryQuantity(
  draft: QuickAddEventDraft | undefined,
  inventoryItemId: string,
) {
  return (
    draft?.inventory.find((entry) => entry.inventoryItemId === inventoryItemId)
      ?.quantity ?? 0
  );
}

function statusCount(status: QuickAddPreviewRow["status"], expected: number): EvalCheck {
  return {
    label: `reconciliation has ${expected} ${status} row(s)`,
    run: ({ rows }) => {
      const actual = countStatuses(rows)[status];
      return actual === expected || `expected ${expected}, got ${actual}`;
    },
  };
}

const cases: EvalCase[] = [
  {
    id: "boss-slang-single-day",
    name: "Boss slang single-day extraction",
    text: `June 19th Friday
Warehouse call 7AM:
Depart for galley 715AM
- 730AM-1030AM Install at Galley Beach,, Full new white floor in 40x40 seasonal tent
- Black stake body, White SB with big tent ox
- Zach, Fuerte, Jay, Gabe, Courtney, Reid, Olds

8AM-12 noon: team kenroy sort out 50 wide frame tops at nancy ann and bring to 45Tomahawk
- 2PM install 12x24 stage at wauwinet biljax/turf/legs
- Kenroy, Colin Simone, Goran, Fuerte, Stivan, Younes, sardine
- Black stake body + big tent ox, transit van`,
    checks: [
      {
        label: "extracts exactly 2 job cards",
        run: ({ parsed }) =>
          parsed.drafts.length === 2 || `got ${parsed.drafts.length} drafts`,
      },
      {
        label: "Galley title is location-based",
        run: (context) => Boolean(findDraft(context, "Galley Beach")),
      },
      {
        label: "Galley keeps White SB as White Stake Body",
        run: (context) =>
          hasVehicle(findDraft(context, "Galley Beach"), "veh_white_stake_body"),
      },
      {
        label: "Galley includes Old School from olds slang",
        run: (context) =>
          hasStaff(findDraft(context, "Galley Beach"), "usr_old_school"),
      },
      {
        label: "40x40 floor becomes 50 floor panels",
        run: (context) =>
          inventoryQuantity(findDraft(context, "Galley Beach"), "inv_new_white_floor") ===
            50 || "floor quantity was not 50",
      },
      {
        label: "Stage route includes Wauwinet",
        run: (context) => Boolean(findDraft(context, "Wauwinet")),
      },
      {
        label: "12x24 stage becomes 18 Biljax",
        run: (context) =>
          inventoryQuantity(findDraft(context, "Wauwinet"), "inv_biljax") === 18 ||
          "Biljax quantity was not 18",
      },
      {
        label: "Turfs stay count-free placeholder",
        run: (context) =>
          inventoryQuantity(findDraft(context, "Wauwinet"), "inv_turfs") === 1 ||
          "turfs did not use placeholder quantity 1",
      },
      statusCount("create", 2),
    ],
  },
  {
    id: "identical-repost-skip",
    name: "Identical repost should skip",
    text: `June 23 Tuesday
Warehouse call 7AM
- 8AM-10AM Install 20x20 Chef Tent at Sconset Casino
- Black stake body
- Zach, Fuerte`,
    existingEvents: [existingEvent("evt_sconset_existing", sconsetBaseDraft)],
    checks: [
      {
        label: "extracts one Sconset job",
        run: ({ parsed }) => parsed.drafts.length === 1 || `got ${parsed.drafts.length}`,
      },
      statusCount("skip", 1),
    ],
  },
  {
    id: "changed-existing-review",
    name: "Changed existing job should require review",
    text: `June 23 Tuesday
Warehouse call 7AM
- 8AM-10AM Install 20x20 Chef Tent at Sconset Casino
- Black stake body, White SB
- Zach, Fuerte, Jay`,
    existingEvents: [existingEvent("evt_sconset_existing", sconsetBaseDraft)],
    checks: [
      statusCount("needs_review", 1),
      {
        label: "recommended action is update",
        run: ({ rows }) => rows[0]?.recommendedAction === "update",
      },
      {
        label: "review mentions crew or vehicle change",
        run: ({ rows }) =>
          rows[0]?.differences.some((difference) =>
            /Crew changed|Vehicles changed/.test(difference),
          ) || `differences: ${rows[0]?.differences.join(", ")}`,
      },
    ],
  },
  {
    id: "moved-date-review",
    name: "Moved job should require review",
    text: `June 24 Wednesday
Warehouse call 7AM
- 8AM-10AM Install 20x20 Chef Tent at Sconset Casino
- Black stake body
- Zach, Fuerte`,
    existingEvents: [existingEvent("evt_sconset_existing", sconsetBaseDraft)],
    checks: [
      statusCount("needs_review", 1),
      {
        label: "review reason detects move",
        run: ({ rows }) => /moved|different date/i.test(rows[0]?.reason ?? ""),
      },
    ],
  },
  {
    id: "ambiguous-candidates-review",
    name: "Ambiguous duplicate candidates require review",
    text: `June 26 Friday
Warehouse call 7AM
- 8AM Install floor at Galley Beach
- Black stake body
- Zach, Fuerte`,
    existingEvents: [
      existingEvent(
        "evt_galley_one",
        draftEvent({
          title: "Galley Beach",
          eventDate: "2026-06-26",
          callTime: "07:00",
          timeline: [
            {
              time: "08:00",
              endTime: null,
              label: "Install floor at Galley Beach",
              details: null,
              sortOrder: 0,
            },
          ],
        }),
      ),
      existingEvent(
        "evt_galley_two",
        draftEvent({
          title: "Galley Beach",
          eventDate: "2026-06-26",
          callTime: "07:00",
          timeline: [
            {
              time: "08:00",
              endTime: null,
              label: "Install floor at Galley Beach",
              details: "Second crew",
              sortOrder: 0,
            },
          ],
        }),
      ),
    ],
    checks: [
      statusCount("needs_review", 1),
      {
        label: "multiple candidates returned",
        run: ({ rows }) =>
          rows[0]?.candidates.length >= 2 ||
          `got ${rows[0]?.candidates.length ?? 0}`,
      },
    ],
  },
  {
    id: "unknown-reference-review",
    name: "Unknown staff/vehicle reference should force review",
    text: `June 27 Saturday
Warehouse call 6AM
- 7AM install 30x30 chef tent at WMC
- Purple monster truck and black stake body
- Bobby, Zach`,
    checks: [
      statusCount("needs_review", 1),
      {
        label: "unmatched reference warning surfaced",
        run: ({ rows }) =>
          rows[0]?.warnings.length > 0 ||
          `warnings missing: ${JSON.stringify(rows[0])}`,
      },
    ],
  },
  {
    id: "month-bulk-stress",
    name: "Month-like bulk paste stress",
    text: `June 28 Sunday
Warehouse call 7AM
- 8AM Install 20x20 Chef Tent at NGC with cafe lights and clear sides
- Black SB, transit van
- Zach, Fuerte, Jay

June 29 Monday
Warehouse call 630AM
- 7AM Breakdown 30x30 chef tent at WMC
- White SB, box truck
- Gabe, Courtney, Reid, olds

June 30 Tuesday
Warehouse call 7AM
- 730AM-1130AM Install new brown floor in 32x40 tent at Antiques
- Black stake body, big tent ox
- Kenroy, Colin, Simone

July 1 Wednesday
Warehouse call 8AM
- 9AM Drop 50 wide frame tops from warehouse to Nancy Ann and bring old sides back
- transit van
- Goran, Stivan, Younes

July 2 Thursday
Warehouse call 6AM
- 7AM install 12x24 stage at Wauwinet biljax/turf/legs
- black stake body + big tent ox
- Paco, Fuerte, Sardine

July 3 Friday
Warehouse call 7AM
- 8AM install clear sides and cafe lighting at Sconset Casino
- White SB
- Zach, Gabe

July 4 Saturday
Warehouse call 7AM
- 8AM standby at Westmoor Club for event, bring stakes, whacker, tarps
- Black stake body
- Porter, Olds

July 5 Sunday
Warehouse call 9AM
- 10AM breakdown at Westmoor Club
- box truck, White SB
- Kenroy, Fuerte, Reid

July 6 Monday
Warehouse call 7AM
- 8AM pickup turfs, legs, and biljax from Wauwinet
- transit van, black stake body
- Goran, Younes, Stivan`,
    checks: [
      {
        label: "extracts at least 8 job cards",
        run: ({ parsed }) =>
          parsed.drafts.length >= 8 || `got ${parsed.drafts.length} drafts`,
      },
      {
        label: "bulk paste does not emit unmatched-reference warnings",
        run: ({ rows }) => {
          const warnings = rows.flatMap((row) => row.warnings);
          return warnings.length === 0 || warnings.join("; ");
        },
      },
      {
        label: "all bulk jobs are clear creates",
        run: ({ rows }) => {
          const counts = countStatuses(rows);
          return (
            counts.needs_review === 0 ||
            `review rows: ${counts.needs_review} / ${rows.length}`
          );
        },
      },
    ],
  },
];

type CaseResult = {
  id: string;
  name: string;
  durationMs: number;
  draftCount: number;
  rows: Array<{
    status: QuickAddPreviewRow["status"];
    recommendedAction: QuickAddPreviewRow["recommendedAction"];
    title: string;
    eventDate: string;
    reason: string;
    differences: string[];
    warnings: string[];
    draftNotes: string | null;
    matchedNotes: string | null;
    timeline: string[];
    timelineDetails: string[];
    staff: string[];
    vehicles: string[];
    inventory: string[];
  }>;
  checks: Array<{
    label: string;
    passed: boolean;
    detail: string | null;
  }>;
  error: string | null;
};

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    caseId: args.find((arg) => arg.startsWith("--case="))?.slice("--case=".length),
    limit: Number(args.find((arg) => arg.startsWith("--limit="))?.slice("--limit=".length) ?? 0),
    repeat: Math.max(
      1,
      Number(args.find((arg) => arg.startsWith("--repeat="))?.slice("--repeat=".length) ?? 1),
    ),
    reportDir:
      args.find((arg) => arg.startsWith("--report-dir="))?.slice("--report-dir=".length) ??
      "reports/evals",
  };
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. Add it to .env.local or export it.`);
  return value;
}

function markdownReport({
  model,
  results,
}: {
  model: string;
  results: CaseResult[];
}) {
  const totalChecks = results.reduce((sum, result) => sum + result.checks.length, 0);
  const passedChecks = results.reduce(
    (sum, result) => sum + result.checks.filter((check) => check.passed).length,
    0,
  );
  const passedCases = results.filter(
    (result) => !result.error && result.checks.every((check) => check.passed),
  ).length;
  const statusCounts = results.flatMap((result) => result.rows).reduce(
    (counts, row) => {
      counts[row.status] += 1;
      return counts;
    },
    { create: 0, skip: 0, needs_review: 0 },
  );

  const lines = [
    "# Quick Add AI Eval Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Model: ${model}`,
    `Prompt today: ${TODAY}`,
    "",
    "## Summary",
    "",
    `- Cases passed: ${passedCases}/${results.length} (${Math.round(
      (passedCases / Math.max(1, results.length)) * 100,
    )}%)`,
    `- Checks passed: ${passedChecks}/${totalChecks} (${Math.round(
      (passedChecks / Math.max(1, totalChecks)) * 100,
    )}%)`,
    `- Reconciliation rows: ${statusCounts.create} create, ${statusCounts.skip} skip, ${statusCounts.needs_review} needs review`,
    "",
    "## Case Results",
    "",
  ];

  for (const result of results) {
    const passed = !result.error && result.checks.every((check) => check.passed);
    lines.push(
      `### ${passed ? "✅" : "❌"} ${result.name}`,
      "",
      `- ID: \`${result.id}\``,
      `- Duration: ${result.durationMs}ms`,
      `- Drafts: ${result.draftCount}`,
    );
    if (result.error) {
      lines.push(`- Error: ${redactSecrets(result.error)}`);
    }
    lines.push("", "| Check | Result | Detail |", "| --- | --- | --- |");
    for (const check of result.checks) {
      lines.push(
        `| ${check.label} | ${check.passed ? "✅" : "❌"} | ${
          redactSecrets(check.detail ?? "").replace(/\|/g, "\\|")
        } |`,
      );
    }
    lines.push("", "Rows:");
    for (const row of result.rows) {
      lines.push(
        `- ${row.status} / ${row.recommendedAction}: ${row.eventDate} ${row.title} — ${row.reason}`,
      );
      if (row.warnings.length) {
        lines.push(`  - Warnings: ${row.warnings.join("; ")}`);
      }
      if (row.differences.length) {
        lines.push(`  - Differences: ${row.differences.join("; ")}`);
      }
      if (row.draftNotes || row.matchedNotes) {
        lines.push(`  - Draft notes: ${redactSecrets(row.draftNotes ?? "none")}`);
        lines.push(`  - Matched notes: ${redactSecrets(row.matchedNotes ?? "none")}`);
      }
      lines.push(`  - Timeline: ${row.timeline.join(" | ") || "none"}`);
      if (row.timelineDetails.some(Boolean)) {
        lines.push(`  - Timeline details: ${row.timelineDetails.join(" | ")}`);
      }
      lines.push(`  - Staff: ${row.staff.join(", ") || "none"}`);
      lines.push(`  - Vehicles: ${row.vehicles.join(", ") || "none"}`);
      lines.push(`  - Inventory: ${row.inventory.join(", ") || "none"}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

async function runCase({
  apiKey,
  model,
  testCase,
}: {
  apiKey: string;
  model: string;
  testCase: EvalCase;
}): Promise<CaseResult> {
  const startedAt = Date.now();
  try {
    const parsed = await parseQuickAddTextWithCatalog({
      apiKey,
      model,
      business: "TENTS",
      text: testCase.text,
      today: TODAY,
      catalog,
      timeout: 60_000,
    });
    const rows = reconcileQuickAddDrafts({
      drafts: parsed.drafts,
      existingEvents: testCase.existingEvents ?? [],
      warningsByRow: parsed.warningsByRow,
    });
    const context = { parsed, rows };
    const checks = testCase.checks.map((check) => {
      const result = check.run(context);
      return {
        label: check.label,
        passed: result === true,
        detail: result === true ? null : typeof result === "string" ? result : "failed",
      };
    });

    return {
      id: testCase.id,
      name: testCase.name,
      durationMs: Date.now() - startedAt,
      draftCount: parsed.drafts.length,
      rows: rows.map((row) => ({
        status: row.status,
        recommendedAction: row.recommendedAction,
        title: row.draft.title,
        eventDate: row.draft.eventDate,
        reason: row.reason,
        differences: row.differences,
        warnings: row.warnings,
        draftNotes: row.draft.notes,
        matchedNotes:
          (testCase.existingEvents ?? []).find(
            (event) => event.id === row.matchedEvent?.id,
          )?.notes ?? null,
        timeline: row.draft.timeline.map((entry) =>
          `${entry.time}${entry.endTime ? `-${entry.endTime}` : ""} ${entry.label}`,
        ),
        timelineDetails: row.draft.timeline.map((entry) => entry.details ?? ""),
        staff: row.draft.staff.map((entry) => entry.userId),
        vehicles: row.draft.vehicles.map((entry) => entry.vehicleId),
        inventory: row.draft.inventory.map(
          (entry) => `${entry.inventoryItemId} x${entry.quantity}`,
        ),
      })),
      checks,
      error: null,
    };
  } catch (error) {
    return {
      id: testCase.id,
      name: testCase.name,
      durationMs: Date.now() - startedAt,
      draftCount: 0,
      rows: [],
      checks: testCase.checks.map((check) => ({
        label: check.label,
        passed: false,
        detail: "not run",
      })),
      error: redactSecrets(error instanceof Error ? error.message : String(error)),
    };
  }
}

async function main() {
  const args = parseArgs();
  const apiKey = requireEnv("OPENAI_API_KEY");
  const model = process.env.OPENAI_MODEL || "gpt-4o";
  const selectedCases = cases
    .filter((testCase) => !args.caseId || testCase.id === args.caseId)
    .slice(0, args.limit || undefined);
  const repeatedCases = Array.from({ length: args.repeat }).flatMap((_, index) =>
    selectedCases.map((testCase) => ({
      ...testCase,
      id: args.repeat > 1 ? `${testCase.id}#${index + 1}` : testCase.id,
      name:
        args.repeat > 1
          ? `${testCase.name} — run ${index + 1}`
          : testCase.name,
    })),
  );

  if (!repeatedCases.length) {
    throw new Error(`No eval cases matched${args.caseId ? ` ${args.caseId}` : ""}.`);
  }

  console.log(
    `Running ${repeatedCases.length} Quick Add eval case(s) with ${model}...`,
  );

  const results: CaseResult[] = [];
  for (const [index, testCase] of repeatedCases.entries()) {
    process.stdout.write(
      `[${index + 1}/${repeatedCases.length}] ${testCase.id}... `,
    );
    const result = await runCase({ apiKey, model, testCase });
    const passed =
      !result.error && result.checks.every((check) => check.passed);
    results.push(result);
    console.log(`${passed ? "PASS" : "FAIL"} (${result.durationMs}ms)`);
  }

  await mkdir(args.reportDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const basePath = path.join(args.reportDir, `quick-add-eval-${timestamp}`);
  await writeFile(`${basePath}.md`, markdownReport({ model, results }));
  await writeFile(`${basePath}.json`, JSON.stringify({ model, today: TODAY, results }, null, 2));

  const totalChecks = results.reduce((sum, result) => sum + result.checks.length, 0);
  const passedChecks = results.reduce(
    (sum, result) => sum + result.checks.filter((check) => check.passed).length,
    0,
  );
  const passedCases = results.filter(
    (result) => !result.error && result.checks.every((check) => check.passed),
  ).length;

  console.log("");
  console.log(`Cases passed: ${passedCases}/${results.length}`);
  console.log(`Checks passed: ${passedChecks}/${totalChecks}`);
  console.log(`Report: ${basePath}.md`);
  console.log(`Raw JSON: ${basePath}.json`);

  if (passedCases !== results.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
