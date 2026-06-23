import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ManagementInvoices } from "@/components/management-invoices";
import { requireSession } from "@/lib/auth";
import { getManagementInvoicesForDate } from "@/lib/data";
import { formatLongDate, isDateKey, monthKeyFromDate } from "@/lib/date";

export const metadata: Metadata = {
  title: "Management invoices",
};

export default async function ManagementDayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const [{ date }, session] = await Promise.all([
    params,
    requireSession(["ADMIN", "OWNER", "LEAD"]),
  ]);
  if (!isDateKey(date)) notFound();

  const invoices = await getManagementInvoicesForDate(date);
  const canManage = session.role === "ADMIN" || session.role === "OWNER";

  return (
    <div className="page-shell">
      <div className="day-page-heading">
        <div>
          <Link
            className="back-link"
            href={`/app/management?month=${monthKeyFromDate(date)}`}
          >
            <ArrowLeft aria-hidden="true" />
            Back to management
          </Link>
          <p className="eyebrow">Invoices and notes</p>
          <h1>{formatLongDate(date)}</h1>
        </div>
      </div>

      <ManagementInvoices
        canManage={canManage}
        defaultDate={date}
        initialInvoices={invoices}
        showAddButton
      />
    </div>
  );
}
