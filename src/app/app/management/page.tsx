import type { Metadata } from "next";
import Link from "next/link";
import {
  endOfMonth,
  endOfWeek,
  format,
  isValid,
  parse,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ReceiptText } from "lucide-react";
import { ScheduleCalendar } from "@/components/schedule-calendar";
import { requireSession } from "@/lib/auth";
import { getManagementInvoiceCalendar } from "@/lib/data";
import { formatDateKey, getTodayKey } from "@/lib/date";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Management",
};

function resolveMonth(value: string | undefined, todayKey: string) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return todayKey.slice(0, 7);
  const date = parse(value, "yyyy-MM", new Date());
  return isValid(date) ? value : todayKey.slice(0, 7);
}

export default async function ManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const [, params] = await Promise.all([
    requireSession(["ADMIN", "OWNER", "LEAD"]),
    searchParams,
  ]);
  const todayKey = getTodayKey(env.COMPANY_TIMEZONE);
  const monthKey = resolveMonth(params.month, todayKey);
  const monthDate = parse(monthKey, "yyyy-MM", new Date());
  const rangeStart = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 0 });
  const rangeEnd = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 0 });
  const invoices = await getManagementInvoiceCalendar(
    formatDateKey(rangeStart),
    formatDateKey(rangeEnd),
  );

  return (
    <div className="page-shell">
      <div className="page-heading schedule-heading">
        <div>
          <p className="eyebrow">Management reference</p>
          <h1>{format(monthDate, "MMMM yyyy")}</h1>
        </div>
        <Link
          className="button button-secondary"
          href="/app/management/invoices"
        >
          <ReceiptText aria-hidden="true" />
          Invoices
        </Link>
        <p className="schedule-intro">
          Tap a date to open every invoice, note, and event detail posted for
          management and crew leads.
        </p>
      </div>

      <ScheduleCalendar
        basePath="/app/management"
        events={invoices}
        itemNoun="invoices"
        monthKey={monthKey}
        todayKey={todayKey}
      />
    </div>
  );
}
