import { createRequire } from "node:module";
import { z } from "zod";
import type { InventoryRecord } from "@/types";

export type PicklistTimelineDraft = {
  time: string;
  endTime: string | null;
  label: string;
  details: string | null;
};

export type PicklistStaffDraft = {
  userId: string;
  assignment: string | null;
  callTime: string | null;
  notes: string | null;
};

export type PicklistVehicleDraft = {
  vehicleId: string;
  driverUserId: string | null;
  destination: string | null;
  departureTime: string | null;
  notes: string | null;
};

export type PicklistEventDraft = {
  title: string;
  eventDate: string;
  venue: string | null;
  address: string | null;
  clientName: string | null;
  status: "DRAFT" | "CONFIRMED" | "COMPLETED";
  business: "TENTS";
  callTime: string | null;
  departureTime: string | null;
  returnTime: string | null;
  notes: string | null;
  staffBrief: string | null;
  packerUserId: string | null;
  timeline: PicklistTimelineDraft[];
  staff: PicklistStaffDraft[];
  vehicles: PicklistVehicleDraft[];
};

export type PicklistNewInventoryDraft = {
  name: string;
  category: string;
  size: string | null;
  quantity: number;
};

export type PicklistPackItemDraft = {
  key: string;
  itemName: string;
  quantity: number;
  notes: string | null;
  sectionBreakdown: Array<{ section: string; quantity: number }>;
  inventoryItemId: string | null;
  matchStatus: "matched" | "new";
  matchedInventoryName: string | null;
  newItem: PicklistNewInventoryDraft | null;
};

export type PicklistPreview = {
  draft: PicklistEventDraft;
  packItems: PicklistPackItemDraft[];
  warnings: string[];
  sections: string[];
  source: {
    orderId: string | null;
    orderTitle: string | null;
    orderStart: string | null;
    orderEnd: string | null;
    dropOffStart: string | null;
    dropOffEnd: string | null;
    pickupStart: string | null;
    pickupEnd: string | null;
    contactName: string | null;
    contactPhone: string | null;
  };
};

type PositionedText = {
  text: string;
  x: number;
  y: number;
};

export type PositionedPdfPage = {
  pageNumber: number;
  items: PositionedText[];
};

type ParsedPdfText = {
  text: string;
  pages: PositionedPdfPage[];
};

type Pdf2JsonParser = {
  on(
    event: "pdfParser_dataError",
    callback: (error: unknown) => void,
  ): void;
  on(event: "pdfParser_dataReady", callback: (data: Pdf2JsonData) => void): void;
  parseBuffer(buffer: Buffer, verbosity?: number): void;
  destroy?: () => void;
};

type Pdf2JsonData = {
  Pages: Array<{
    Height: number;
    Texts: Array<{
      x: number;
      y: number;
      R: Array<{ T: string }>;
    }>;
  }>;
};

type Pdf2JsonConstructor = new (
  context?: unknown,
  needRawText?: boolean,
) => Pdf2JsonParser;

type SourcePackItem = {
  name: string;
  quantity: number;
  section: string;
  notes: string[];
};

type DateTimeWindow = {
  start: string | null;
  end: string | null;
  startDate: string | null;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
};

export const picklistPublishSchema = z.object({
  draft: z.object({
    title: z.string().trim().min(1).max(160),
    eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    venue: z.string().trim().max(160).nullable(),
    address: z.string().trim().max(500).nullable(),
    clientName: z.string().trim().max(160).nullable(),
    status: z.enum(["DRAFT", "CONFIRMED", "COMPLETED"]).default("CONFIRMED"),
    business: z.literal("TENTS"),
    callTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
    departureTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
    returnTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
    notes: z.string().trim().max(10_000).nullable(),
    staffBrief: z.string().trim().max(10_000).nullable(),
    packerUserId: z.string().trim().nullable(),
    timeline: z
      .array(
        z.object({
          time: z.string().regex(/^\d{2}:\d{2}$/),
          endTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
          label: z.string().trim().min(1).max(160),
          details: z.string().trim().max(2000).nullable(),
        }),
      )
      .max(100),
    staff: z
      .array(
        z.object({
          userId: z.string().trim().min(1),
          assignment: z.string().trim().max(160).nullable(),
          callTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
          notes: z.string().trim().max(1000).nullable(),
        }),
      )
      .max(200),
    vehicles: z
      .array(
        z.object({
          vehicleId: z.string().trim().min(1),
          driverUserId: z.string().trim().nullable(),
          destination: z.string().trim().max(500).nullable(),
          departureTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
          notes: z.string().trim().max(1000).nullable(),
        }),
      )
      .max(100),
  }),
  packItems: z
    .array(
      z.object({
        key: z.string().trim().min(1),
        itemName: z.string().trim().min(1).max(240),
        quantity: z.coerce.number().int().min(1).max(100_000),
        notes: z.string().trim().max(2000).nullable(),
        inventoryItemId: z.string().trim().nullable(),
        matchStatus: z.enum(["matched", "new"]),
        newItem: z
          .object({
            name: z.string().trim().min(1).max(240),
            category: z.string().trim().min(1).max(120),
            size: z.string().trim().max(80).nullable(),
            quantity: z.coerce.number().int().min(0).max(100_000),
          })
          .nullable(),
      }),
    )
    .max(700),
});

const knownSectionTitles = new Set([
  "ADMIN / SERVICE",
  "ADDITIONAL FOOD TENT OFF BAR TENT",
  "BAR INTO FOOD TENT",
  "MAIN TENT",
  "SOUTH LAWN",
]);

const nonPhysicalItemPattern =
  /\b(?:fee|permit|attendant|labor|delivery|pickup|pick up|install|strike|service)\b/i;

function cleanText(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() || null;
}

function normalizeBrokenPdfText(value: string) {
  return value
    .replace(/Drop o!/g, "Drop off")
    .replace(/Drop o"/g, "Drop off")
    .replace(/Gri\s*!\s*n/g, "Griffin")
    .replace(/Gri!n/g, "Griffin");
}

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\bcafe\b/g, "cafe")
    .replace(/\bcafé\b/g, "cafe")
    .replace(/×/g, "x")
    .replace(/\bby\b/g, "x")
    .replace(/(\d)\s*[x]\s*(\d)/g, "$1x$2")
    .replace(/(\d)\s*(?:ft|feet|foot|')\b/g, "$1")
    .replace(/(\d)\s*(?:in|inch|inches|")\b/g, "$1 inch")
    .replace(/[^a-z0-9.]+/g, " ")
    .replace(/\bnavitrac\b/g, "")
    .replace(/\bsperry\b/g, "")
    .replace(/\bgas powered\b/g, "")
    .replace(/\brubber\b/g, "")
    .replace(/\bregular\b/g, "")
    .replace(/\bdecks?\b/g, "")
    .replace(/\bsidewalls?\b/g, "sides")
    .replace(/\bsides?\b/g, "sides")
    .replace(/\btops?\b/g, "tops")
    .replace(/\bpoles?\b/g, "poles")
    .replace(/\btarps?\b/g, "tarp")
    .replace(/\bstakes?\b/g, "stake")
    .replace(/\bhammers?\b/g, "hammer")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalKey(value: string) {
  return normalizeName(value).replace(/\b\d{6,}\b/g, "").trim();
}

function extractSize(value: string) {
  const dimension = value.match(
    /(\d+(?:\.\d+)?)\s*(?:'|ft|feet|foot)?\s*(?:x|×|by)\s*(\d+(?:\.\d+)?)\s*(?:'|ft|feet|foot)?/i,
  );
  if (dimension) return `${dimension[1]}x${dimension[2]}`;

  const single = value.match(/(\d+(?:\.\d+)?)\s*(?:'|ft|feet|foot|")/i);
  return single ? single[0].trim() : null;
}

function inferCategory(name: string) {
  if (/\b(?:tent|marquee|archway)\b/i.test(name)) return "Tents";
  if (/\b(?:sidewall|side wall|sides|top|skirt|flag|p-?plates?)\b/i.test(name)) {
    return "Tent Accessories";
  }
  if (/\b(?:light|lighting)\b/i.test(name)) return "Lighting";
  if (/\bpoles?\b/i.test(name)) return "Poles";
  if (/\b(?:biljax|stage|floor|turf)\b/i.test(name)) return "Flooring";
  if (/\b(?:stake|ratchet|strap|plate)\b/i.test(name)) return "Hardware";
  if (/\b(?:whacker|hammer|tape|zip)\b/i.test(name)) return "Tools";
  if (/\b(?:generator|power)\b/i.test(name)) return "Power";
  return "Other";
}

function parsePdfDate(value: string | null) {
  if (!value) return null;

  const match = value.match(
    /(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})/i,
  );
  if (!match) return null;

  const month = {
    jan: "01",
    feb: "02",
    mar: "03",
    apr: "04",
    may: "05",
    jun: "06",
    jul: "07",
    aug: "08",
    sep: "09",
    oct: "10",
    nov: "11",
    dec: "12",
  }[match[1].toLowerCase()];
  if (!month) return null;

  return `${match[3]}-${month}-${match[2].padStart(2, "0")}`;
}

function parsePdfTime(value: string | null) {
  const match = value?.match(/\b(\d{1,2}):(\d{2})\s*(AM|PM)\b/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3].toUpperCase();
  if (hour === 12) hour = 0;
  if (period === "PM") hour += 12;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function subtractOneHour(time: string | null) {
  if (!time) return null;
  const [hourPart, minutePart] = time.split(":");
  const minutes = Math.max(0, Number(hourPart) * 60 + Number(minutePart) - 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(
    minutes % 60,
  ).padStart(2, "0")}`;
}

function extractDateTimeWindow(text: string, label: string): DateTimeWindow {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const throughPattern = new RegExp(
    `${escaped}\\s+((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\\s+[A-Za-z]{3}\\s+\\d{1,2},\\s+\\d{4})\\s+(\\d{1,2}:\\d{2}\\s+[AP]M\\s+EDT)\\s+Through\\s+((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\\s+[A-Za-z]{3}\\s+\\d{1,2},\\s+\\d{4})\\s+(\\d{1,2}:\\d{2}\\s+[AP]M\\s+EDT)`,
    "i",
  );
  const singlePattern = new RegExp(
    `${escaped}\\s+((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\\s+[A-Za-z]{3}\\s+\\d{1,2},\\s+\\d{4})\\s+(\\d{1,2}:\\d{2}\\s+[AP]M\\s+EDT)`,
    "i",
  );

  const through = text.match(throughPattern);
  if (through) {
    return {
      start: `${through[1]} ${through[2]}`,
      end: `${through[3]} ${through[4]}`,
      startDate: parsePdfDate(through[1]),
      endDate: parsePdfDate(through[3]),
      startTime: parsePdfTime(through[2]),
      endTime: parsePdfTime(through[4]),
    };
  }

  const single = text.match(singlePattern);
  return {
    start: single ? `${single[1]} ${single[2]}` : null,
    end: null,
    startDate: parsePdfDate(single?.[1] ?? null),
    endDate: null,
    startTime: parsePdfTime(single?.[2] ?? null),
    endTime: null,
  };
}

function emptyWindow(): DateTimeWindow {
  return {
    start: null,
    end: null,
    startDate: null,
    endDate: null,
    startTime: null,
    endTime: null,
  };
}

function dateTimeWindowFromValues(start: string | null, end: string | null): DateTimeWindow {
  const startDateText = start?.match(
    /(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+[A-Za-z]{3}\s+\d{1,2},\s+\d{4}/i,
  )?.[0];
  const endDateText = end?.match(
    /(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+[A-Za-z]{3}\s+\d{1,2},\s+\d{4}/i,
  )?.[0];

  return {
    start,
    end,
    startDate: parsePdfDate(startDateText ?? null),
    endDate: parsePdfDate(endDateText ?? null),
    startTime: parsePdfTime(start),
    endTime: parsePdfTime(end),
  };
}

function sortedPageLines(page: PositionedPdfPage) {
  const lineMap = new Map<number, PositionedText[]>();
  for (const item of page.items) {
    const key = Math.round(item.y / 3) * 3;
    lineMap.set(key, [...(lineMap.get(key) ?? []), item]);
  }

  return [...lineMap]
    .map(([y, items]) => ({
      y,
      items: [...items].sort((left, right) => left.x - right.x),
      text:
        cleanText(
          [...items]
            .sort((left, right) => left.x - right.x)
            .map((item) => item.text)
            .join(" "),
        ) ?? "",
    }))
    .sort((left, right) => right.y - left.y);
}

type PositionedLine = ReturnType<typeof sortedPageLines>[number];

function lineTextBetweenX(line: PositionedLine, minX: number, maxX: number) {
  return cleanText(
    line.items
      .filter((item) => item.x >= minX && item.x <= maxX)
      .map((item) => item.text)
      .join(" "),
  );
}

function normalizeAddressText(value: string | null) {
  return (
    value
      ?.replace(/\s+,/g, ",")
      .replace(/\s+Nantucket,/i, ", Nantucket,")
      .replace(/\s+/g, " ")
      .trim() ?? null
  );
}

function extractWindowFromPositionedLines(
  lines: PositionedLine[],
  labelPattern: RegExp,
) {
  const startIndex = lines.findIndex(
    (line) =>
      line.items.some(
        (item) => item.x >= 190 && item.x <= 265 && labelPattern.test(item.text),
      ) && /\d{1,2}:\d{2}\s+[AP]M\s+EDT/i.test(line.text),
  );
  if (startIndex < 0) return emptyWindow();

  const start = normalizeBrokenPdfText(lineTextBetweenX(lines[startIndex], 240, 380) ?? "");
  const throughIndex = lines.findIndex(
    (line, index) =>
      index > startIndex &&
      index <= startIndex + 3 &&
      line.items.some(
        (item) => item.x >= 230 && item.x <= 280 && /^Through$/i.test(item.text),
      ),
  );
  const endLine =
    throughIndex >= 0
      ? lines.find(
          (line, index) =>
            index > throughIndex &&
            index <= throughIndex + 5 &&
            /\d{1,2}:\d{2}\s+[AP]M\s+EDT/i.test(lineTextBetweenX(line, 240, 380) ?? ""),
        )
      : null;
  const end = endLine
    ? normalizeBrokenPdfText(lineTextBetweenX(endLine, 240, 380) ?? "")
    : null;

  return dateTimeWindowFromValues(cleanText(start), cleanText(end));
}

function extractPositionedMetadata(pages: PositionedPdfPage[]) {
  const firstPage = pages[0];
  if (!firstPage) {
    return {
      orderTitle: null,
      deliveryInfo: { venue: null, address: null },
      dropOff: emptyWindow(),
      pickup: emptyWindow(),
    };
  }

  const lines = sortedPageLines(firstPage);
  const orderInfoIndex = lines.findIndex((line) => /\bOrder Info\b/i.test(line.text));
  const orderStartIndex = lines.findIndex((line) => /\bOrder Start\b/i.test(line.text));
  const orderTitle =
    orderInfoIndex >= 0 && orderStartIndex > orderInfoIndex
      ? cleanText(
          lines
            .slice(orderInfoIndex + 1, orderStartIndex)
            .map((line) => lineTextBetweenX(line, 390, 650))
            .filter(Boolean)
            .join(" "),
        )
      : null;

  const manualDeliveryIndex = lines.findIndex((line) =>
    line.items.some((item) => item.x >= 45 && item.x <= 180 && /Manual Delivery/i.test(item.text)),
  );
  const venueIndex =
    manualDeliveryIndex >= 0
      ? lines.findIndex((line, index) => {
          if (index <= manualDeliveryIndex) return false;
          const text = lineTextBetweenX(line, 45, 190);
          return Boolean(text && !/^(?:Delivery|Address|Type)$/i.test(text));
        })
      : -1;
  const venue = venueIndex >= 0 ? lineTextBetweenX(lines[venueIndex], 45, 190) : null;
  const pickupStartIndex = lines.findIndex(
    (line) =>
      line.items.some(
        (item) => item.x >= 190 && item.x <= 265 && /^Pick Up$/i.test(item.text),
      ) && /\d{1,2}:\d{2}\s+[AP]M\s+EDT/i.test(line.text),
  );
  const addressLines =
    venueIndex >= 0
      ? lines
          .slice(venueIndex + 1, pickupStartIndex > 0 ? pickupStartIndex : venueIndex + 8)
          .map((line) => lineTextBetweenX(line, 45, 190))
          .filter((line): line is string => Boolean(line))
          .filter((line) => !/^(?:Delivery|Address|Type)$/i.test(line))
      : [];

  return {
    orderTitle,
    deliveryInfo: {
      venue,
      address: normalizeAddressText(addressLines.join(" ")),
    },
    dropOff: extractWindowFromPositionedLines(lines, /^Drop o/i),
    pickup: extractWindowFromPositionedLines(lines, /^Pick Up$/i),
  };
}

function isSectionHeading(text: string) {
  return knownSectionTitles.has(text.trim().toUpperCase());
}

function lineHasHeaderOnly(text: string) {
  return /^(?:Qty|Item|Out|In|Missing|Initial)(?:\s+(?:Qty|Item|Out|In|Missing|Initial))*$/i.test(
    text,
  );
}

function getLineItemTextNearY(
  lines: ReturnType<typeof sortedPageLines>,
  qty: PositionedText,
) {
  const candidates = lines
    .filter((line) => line.y >= qty.y - 4 && line.y <= qty.y + 12)
    .flatMap((line) => line.items.filter((item) => item.x > qty.x + 22));
  const text = cleanText(candidates.map((item) => item.text).join(" "));
  return text && !lineHasHeaderOnly(text) ? text : null;
}

function lineLooksLikeUpcomingItem(
  line: ReturnType<typeof sortedPageLines>[number],
  regionLines: ReturnType<typeof sortedPageLines>,
) {
  if (/^Notes:/i.test(line.text)) return false;
  const hasItemColumnText = line.items.some((item) => item.x > 130 && item.text.trim());
  if (!hasItemColumnText) return false;

  return regionLines.some(
    (candidate) =>
      candidate.y < line.y &&
      candidate.y >= line.y - 12 &&
      candidate.items.some((item) => item.x < 130 && /^\d+$/.test(item.text.trim())),
  );
}

function parsePositionedItems(pages: PositionedPdfPage[]) {
  const items: SourcePackItem[] = [];
  const sections = new Set<string>();
  let carriedSection: string | null = null;

  for (const page of pages) {
    const lines = sortedPageLines(page);
    const sectionLines = lines.filter((line) => isSectionHeading(line.text));
    const serviceLine = lines.find((line) => /^Services$/i.test(line.text));
    const regions = sectionLines.map((line, index) => ({
      section: line.text.trim(),
      top: line.y,
      bottom:
        sectionLines[index + 1]?.y ??
        (serviceLine && serviceLine.y < line.y ? serviceLine.y : -Infinity),
    }));

    if (!regions.length && carriedSection) {
      regions.push({
        section: carriedSection,
        top: Infinity,
        bottom: serviceLine?.y ?? -Infinity,
      });
    }

    for (const region of regions) {
      sections.add(region.section);
      let current: SourcePackItem | null = null;

      const regionLines = lines.filter(
        (line) => line.y < region.top && line.y > region.bottom,
      );

      for (const line of regionLines) {
        if (lineHasHeaderOnly(line.text) || /^Services$/i.test(line.text)) continue;

        const qty = line.items.find(
          (item) => item.x < 130 && /^\d+$/.test(item.text.trim()),
        );
        const itemText = qty ? getLineItemTextNearY(regionLines, qty) : null;

        if (qty && itemText) {
          if (nonPhysicalItemPattern.test(itemText)) {
            current = null;
            continue;
          }

          current = {
            name: itemText,
            quantity: Number(qty.text),
            section: region.section,
            notes: [],
          };
          items.push(current);
          continue;
        }

        if (!current) continue;
        if (lineLooksLikeUpcomingItem(line, regionLines)) continue;
        const noteText = line.text.replace(/^Notes:\s*/i, "").trim();
        if (!noteText || lineHasHeaderOnly(noteText)) continue;
        if (!/^(?:Out|In|Missing|Initial)$/i.test(noteText)) current.notes.push(noteText);
      }
    }

    carriedSection = regions.at(-1)?.section ?? carriedSection;
  }

  return { items, sections: [...sections] };
}

function extractOrderTitle(text: string) {
  const match = text.match(
    /Order Info\s+(#[A-F0-9]+)\s+([\s\S]+?)\s+Order Start/i,
  );
  return cleanText(match?.[2]?.replace(/\n/g, " "));
}

function extractDeliveryInfo(text: string) {
  const match = text.match(
    /Delivery\s+Address\s+(.+?)\s+(\d+\s+.+?\s+Nantucket,\s+MA\s+\d{5},\s+USA)/i,
  );
  const fallbackVenue = text.match(/Company\s+Primary\s+(.+?)\s+\(\d{3}\)/i);
  const venue = cleanText(match?.[1] ?? fallbackVenue?.[1]);
  const rawAddress = cleanText(
    match
      ? match[2]
      : text.match(/\d+\s+[^,\n]+Lane?\s+Nantucket,\s+MA\s+\d{5},\s+USA/i)?.[0],
  );
  const address = rawAddress?.replace(/\s+Nantucket,/i, ", Nantucket,") ?? null;
  return { venue, address };
}

function formatWindow(label: string, window: DateTimeWindow) {
  if (!window.start) return null;
  return window.end
    ? `${label}: ${window.start} through ${window.end}`
    : `${label}: ${window.start}`;
}

function buildNotes({
  text,
  orderId,
  orderTitle,
  deliveryInfo,
  orderStart,
  orderEnd,
  dropOff,
  pickup,
}: {
  text: string;
  orderId: string | null;
  orderTitle: string | null;
  deliveryInfo: { venue: string | null; address: string | null };
  orderStart: string | null;
  orderEnd: string | null;
  dropOff: DateTimeWindow;
  pickup: DateTimeWindow;
}) {
  const contactPhone = text.match(/\(\d{3}\)\s*\d{3}-\d{4}/)?.[0] ?? null;
  const pdfNotes = text.match(/Notes\s+([\s\S]+?)\s+MAIN TENT/i)?.[1] ?? null;
  const services = text.match(/Service\s+Pricing\s+Time In\s+Time Out\s+([\s\S]+?)\s+Check Out/i)?.[1] ?? null;
  const lines = [
    orderId ? `PDF order ${orderId}` : null,
    orderTitle ? `Order: ${orderTitle}` : null,
    deliveryInfo.venue ? `Location: ${deliveryInfo.venue}` : null,
    deliveryInfo.address ? `Address: ${deliveryInfo.address}` : null,
    orderStart && orderEnd ? `Event window: ${orderStart} through ${orderEnd}` : null,
    formatWindow("Drop off", dropOff),
    formatWindow("Pickup", pickup),
    contactPhone ? `Contact phone: ${contactPhone}` : null,
    pdfNotes ? `PDF notes: ${cleanText(pdfNotes)}` : null,
    services ? `Services: ${cleanText(services)}` : null,
    pickup.start ? "Pickup is reference-only from the PDF and was not created as a separate schedule card." : null,
  ];
  return lines.filter(Boolean).join("\n");
}

export function findPicklistInventoryMatch(
  sourceName: string,
  inventory: Array<Pick<InventoryRecord, "id" | "name" | "size" | "category">>,
) {
  const sourceKey = canonicalKey(sourceName);
  const sourceSize = extractSize(sourceName);

  const exact = inventory.find((item) => canonicalKey(item.name) === sourceKey);
  if (exact) return exact;

  const normalizedSource = normalizeName(sourceName);
  const lowerSource = sourceName.toLowerCase();

  if (/\bbil[\s-]?jax\b/i.test(sourceName)) {
    return inventory.find((item) => /\bbil[\s-]?jax\b/i.test(item.name)) ?? null;
  }

  if (/\btent caf[eé] lighting\b/i.test(sourceName)) {
    return inventory.find((item) => /^cafe lighting$/i.test(item.name)) ?? null;
  }

  if (/\bwhacker\b/i.test(sourceName)) {
    return inventory.find((item) => /\bwhacker\b/i.test(item.name)) ?? null;
  }

  if (/\bsledge hammer\b/i.test(sourceName)) {
    return inventory.find((item) => /\bsledge hammers?\b/i.test(item.name)) ?? null;
  }

  if (/\bratchet\s*2/i.test(sourceName)) {
    return inventory.find((item) => /^2 inch straps$/i.test(item.name)) ?? null;
  }

  if (/\bstake\b/i.test(sourceName)) {
    return inventory.find((item) => /^stakes$/i.test(item.name)) ?? null;
  }

  if (/\bsolid sidewall\b/i.test(sourceName)) {
    return inventory.find((item) => /frame solid sides/i.test(item.name)) ?? null;
  }

  if (/\bclear sidewall\b/i.test(sourceName)) {
    const preferred = /navitrac/i.test(sourceName) ? /frame clear sides/i : /^clear sides$/i;
    return (
      inventory.find((item) => preferred.test(item.name)) ??
      inventory.find((item) => /clear sides/i.test(item.name)) ??
      null
    );
  }

  if (/\bsolid top\b/i.test(sourceName)) {
    return inventory.find((item) => /frame solid tops/i.test(item.name)) ?? null;
  }

  if (/\bcenter pole\b/i.test(sourceName)) {
    return (
      inventory.find(
        (item) =>
          /^center pole$/i.test(item.name) &&
          (!sourceSize || normalizeName(item.size ?? "").includes(normalizeName(sourceSize))),
      ) ??
      inventory.find((item) => /^center pole$/i.test(item.name)) ??
      null
    );
  }

  if (/\bperimeter pole\b/i.test(sourceName)) {
    return inventory.find((item) => /^perimeter poles$/i.test(item.name)) ?? null;
  }

  return (
    inventory.find((item) => {
      const itemKey = canonicalKey(`${item.name} ${item.size ?? ""}`);
      return (
        itemKey === sourceKey ||
        (sourceSize &&
          item.size &&
          normalizedSource.includes(normalizeName(item.name)) &&
          normalizeName(item.size).includes(normalizeName(sourceSize))) ||
        lowerSource === item.name.toLowerCase()
      );
    }) ?? null
  );
}

function aggregatePackItems(
  sourceItems: SourcePackItem[],
  inventory: Array<Pick<InventoryRecord, "id" | "name" | "size" | "category">>,
) {
  const aggregate = new Map<
    string,
    {
      itemName: string;
      quantity: number;
      notes: string[];
      sections: Map<string, number>;
      match: Pick<InventoryRecord, "id" | "name" | "size" | "category"> | null;
      sourceNames: Set<string>;
    }
  >();

  for (const item of sourceItems) {
    const match = findPicklistInventoryMatch(item.name, inventory);
    const key = match ? `inventory:${match.id}` : `new:${canonicalKey(item.name)}`;
    const current =
      aggregate.get(key) ??
      {
        itemName: item.name,
        quantity: 0,
        notes: [],
        sections: new Map<string, number>(),
        match,
        sourceNames: new Set<string>(),
      };

    current.quantity += item.quantity;
    current.sections.set(item.section, (current.sections.get(item.section) ?? 0) + item.quantity);
    current.sourceNames.add(item.name);
    if (item.notes.length) current.notes.push(...item.notes);
    aggregate.set(key, current);
  }

  return [...aggregate.entries()].map<PicklistPackItemDraft>(([key, item]) => {
    const sectionBreakdown = [...item.sections].map(([section, quantity]) => ({
      section,
      quantity,
    }));
    const sourceNames = [...item.sourceNames];
    const sourceNote =
      sourceNames.length > 1 ? `PDF names: ${sourceNames.join("; ")}` : null;
    const sectionNote = `PDF sections: ${sectionBreakdown
      .map((section) => `${section.section} × ${section.quantity}`)
      .join("; ")}`;
    const details = [...new Set([sourceNote, sectionNote, ...item.notes].filter(Boolean))];
    const size = extractSize(item.itemName);

    return {
      key,
      itemName: item.itemName,
      quantity: item.quantity,
      notes: details.join("\n") || null,
      sectionBreakdown,
      inventoryItemId: item.match?.id ?? null,
      matchStatus: item.match ? "matched" : "new",
      matchedInventoryName: item.match?.name ?? null,
      newItem: item.match
        ? null
        : {
            name: item.itemName,
            category: inferCategory(item.itemName),
            size,
            quantity: item.quantity,
          },
    };
  });
}

export async function extractPdfText(buffer: Buffer): Promise<ParsedPdfText> {
  const require = createRequire(`${process.cwd()}/package.json`);
  const Parser = require("pdf2json") as Pdf2JsonConstructor;
  const parser = new Parser(null, true);
  const data = await new Promise<Pdf2JsonData>((resolve, reject) => {
    parser.on("pdfParser_dataError", (error) => {
      reject(error instanceof Error ? error : new Error("Unable to parse PDF."));
    });
    parser.on("pdfParser_dataReady", resolve);
    parser.parseBuffer(buffer, 0);
  });

  try {
    const pages = data.Pages.map<PositionedPdfPage>((page, index) => ({
      pageNumber: index + 1,
      items: page.Texts.flatMap((item) => {
        const decoded = cleanText(
          item.R.map((run) => {
            try {
              return decodeURIComponent(run.T);
            } catch {
              return run.T;
            }
          })
            .join("")
            .replace(/\u00a0/g, " "),
        );
        if (!decoded) return [];
        return [
          {
            text: decoded,
            x: item.x * 16,
            y: (page.Height - item.y) * 16,
          },
        ];
      }),
    }));

    return {
      text: normalizeBrokenPdfText(
        pages
          .map((page) => sortedPageLines(page).map((line) => line.text).join("\n"))
          .join("\n"),
      ),
      pages,
    };
  } finally {
    parser.destroy?.();
  }
}

export function buildPicklistPreviewFromParsedPdf(
  parsed: ParsedPdfText,
  inventory: Array<Pick<InventoryRecord, "id" | "name" | "size" | "category">>,
): PicklistPreview {
  const text = normalizeBrokenPdfText(parsed.text);
  const positionedMetadata = extractPositionedMetadata(parsed.pages);
  const orderId = text.match(/#[A-F0-9]+/i)?.[0] ?? null;
  const orderTitle = positionedMetadata.orderTitle ?? extractOrderTitle(text);
  const fallbackDeliveryInfo = extractDeliveryInfo(text);
  const deliveryInfo = {
    venue: positionedMetadata.deliveryInfo.venue ?? fallbackDeliveryInfo.venue,
    address: positionedMetadata.deliveryInfo.address ?? fallbackDeliveryInfo.address,
  };
  const orderStart = extractDateTimeWindow(text, "Order Start");
  const orderEnd = extractDateTimeWindow(text, "Order End");
  const fallbackDropOff = extractDateTimeWindow(text, "Drop off");
  const fallbackPickup = extractDateTimeWindow(text, "Pick Up");
  const dropOff = positionedMetadata.dropOff.start
    ? positionedMetadata.dropOff
    : fallbackDropOff;
  const pickup = positionedMetadata.pickup.start ? positionedMetadata.pickup : fallbackPickup;
  const { items, sections } = parsePositionedItems(parsed.pages);
  const packItems = aggregatePackItems(items, inventory);
  const eventDate = dropOff.startDate ?? orderStart.startDate;
  const arrivalTime = dropOff.startTime;
  const callTime = subtractOneHour(arrivalTime);
  const title = deliveryInfo.venue ?? orderTitle?.split(" - ")[0] ?? "Location TBD";
  const warnings = [
    eventDate ? null : "No drop-off date was found. Review the event date before publishing.",
    arrivalTime ? null : "No drop-off start time was found. Review the timeline before publishing.",
    packItems.some((item) => item.matchStatus === "new")
      ? `${packItems.filter((item) => item.matchStatus === "new").length} item(s) will be created in Tents inventory if published.`
      : null,
  ].filter(Boolean) as string[];

  return {
    draft: {
      title,
      eventDate: eventDate ?? "",
      venue: deliveryInfo.venue ?? title,
      address: deliveryInfo.address,
      clientName: deliveryInfo.venue ?? null,
      status: "CONFIRMED",
      business: "TENTS",
      callTime,
      departureTime: null,
      returnTime: null,
      notes: buildNotes({
        text,
        orderId,
        orderTitle,
        deliveryInfo,
        orderStart: orderStart.start,
        orderEnd: orderEnd.start,
        dropOff,
        pickup,
      }),
      staffBrief: `PDF picklist import${orderId ? ` ${orderId}` : ""}. Review crew and vehicles before work starts.`,
      packerUserId: null,
      timeline: arrivalTime
        ? [
            {
              time: arrivalTime,
              endTime: dropOff.endTime,
              label: `Arrive at ${title} for PDF picklist drop-off/setup`,
              details: `Load and deliver the PDF pack list. Drop-off window: ${
                dropOff.start ?? "Time TBD"
              }${dropOff.end ? ` through ${dropOff.end}` : ""}.`,
            },
          ]
        : [],
      staff: [],
      vehicles: [],
    },
    packItems,
    warnings,
    sections,
    source: {
      orderId,
      orderTitle,
      orderStart: orderStart.start,
      orderEnd: orderEnd.start,
      dropOffStart: dropOff.start,
      dropOffEnd: dropOff.end,
      pickupStart: pickup.start,
      pickupEnd: pickup.end,
      contactName: deliveryInfo.venue,
      contactPhone: text.match(/\(\d{3}\)\s*\d{3}-\d{4}/)?.[0] ?? null,
    },
  };
}

export async function buildPicklistPreview(
  fileBuffer: Buffer,
  inventory: Array<Pick<InventoryRecord, "id" | "name" | "size" | "category">>,
) {
  const parsed = await extractPdfText(fileBuffer);
  return buildPicklistPreviewFromParsedPdf(parsed, inventory);
}
