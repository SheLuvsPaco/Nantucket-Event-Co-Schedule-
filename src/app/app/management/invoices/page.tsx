import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ManagementInvoices } from "@/components/management-invoices";
import { requireSession } from "@/lib/auth";
import { getManagementInvoices } from "@/lib/data";

export const metadata: Metadata = {
  title: "Invoices",
};

export default async function ManagementInvoicesPage() {
  const [session, invoices] = await Promise.all([
    requireSession(["ADMIN", "OWNER", "LEAD"]),
    getManagementInvoices(),
  ]);
  const canManage = session.role === "ADMIN" || session.role === "OWNER";

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <Link className="back-link" href="/app/management">
            <ArrowLeft aria-hidden="true" />
            Back to management calendar
          </Link>
          <p className="eyebrow">Invoice archive</p>
          <h1>Invoices</h1>
        </div>
        <p className="schedule-intro">
          Every posted invoice in one readable stream, newest event dates first.
        </p>
      </div>

      <ManagementInvoices
        canManage={canManage}
        initialInvoices={invoices}
      />
    </div>
  );
}
