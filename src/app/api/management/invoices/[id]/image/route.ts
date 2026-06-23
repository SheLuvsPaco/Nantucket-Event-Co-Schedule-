import { eq } from "drizzle-orm";
import { db } from "@/db";
import { managementInvoices } from "@/db/schema";
import { requireApiSession } from "@/lib/auth";
import {
  InvoiceStorageNotConfiguredError,
  readInvoiceImage,
} from "@/lib/invoice-storage";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const auth = await requireApiSession(["ADMIN", "OWNER", "LEAD"]);
  if (auth.error) return auth.error;

  try {
    const { id } = await context.params;
    const [invoice] = await db
      .select({
        storageKey: managementInvoices.imageStorageKey,
        contentType: managementInvoices.imageContentType,
        originalName: managementInvoices.imageOriginalName,
      })
      .from(managementInvoices)
      .where(eq(managementInvoices.id, id))
      .limit(1);
    if (!invoice) {
      return Response.json({ error: "Invoice not found." }, { status: 404 });
    }

    const image = await readInvoiceImage(invoice.storageKey);
    if (!image) {
      return Response.json(
        { error: "Invoice image not found." },
        { status: 404 },
      );
    }

    return new Response(image.body, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(invoice.originalName)}`,
        "Content-Type": invoice.contentType,
        ...(image.etag ? { ETag: image.etag } : {}),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof InvoiceStorageNotConfiguredError) {
      return Response.json({ error: error.message }, { status: 503 });
    }
    console.error("Invoice image read error:", error);
    return Response.json(
      { error: "The invoice image could not be opened." },
      { status: 500 },
    );
  }
}
