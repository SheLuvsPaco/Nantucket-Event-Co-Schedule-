import { and, eq } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/db";
import { managementInvoices, users } from "@/db/schema";
import { requireApiSession } from "@/lib/auth";
import { getManagementInvoices } from "@/lib/data";
import { apiError } from "@/lib/http";
import { createId } from "@/lib/ids";
import { managementInvoiceNotification } from "@/lib/notification-content";
import { sendPushToUsers } from "@/lib/push-notifications";
import {
  deleteInvoiceImage,
  InvoiceStorageNotConfiguredError,
  storeInvoiceImage,
} from "@/lib/invoice-storage";
import { validateImageUpload } from "@/lib/image-upload";
import { managementInvoiceSchema } from "@/lib/validation";

export const runtime = "nodejs";

function storageError(error: unknown) {
  if (error instanceof InvoiceStorageNotConfiguredError) {
    return Response.json({ error: error.message }, { status: 503 });
  }
  return apiError(error);
}

export async function GET() {
  const auth = await requireApiSession(["ADMIN", "OWNER", "LEAD"]);
  if (auth.error) return auth.error;
  return Response.json(await getManagementInvoices());
}

export async function POST(request: Request) {
  const auth = await requireApiSession(["ADMIN", "OWNER"]);
  if (auth.error) return auth.error;

  let storedImage: Awaited<ReturnType<typeof storeInvoiceImage>> | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get("invoiceImage");
    if (!(file instanceof File)) {
      return Response.json(
        { error: "invoiceImage: Please upload the invoice image." },
        { status: 400 },
      );
    }

    const uploadError = validateImageUpload(file);
    if (uploadError) {
      return Response.json(
        { error: `invoiceImage: ${uploadError}` },
        { status: 400 },
      );
    }

    const input = managementInvoiceSchema.parse({
      eventName: formData.get("eventName"),
      eventDate: formData.get("eventDate"),
      eventTime: formData.get("eventTime"),
      notes: formData.get("notes"),
    });
    storedImage = await storeInvoiceImage(file);

    const [invoice] = await db
      .insert(managementInvoices)
      .values({
        id: createId("minv"),
        ...input,
        imageStorageKey: storedImage.storageKey,
        imageContentType: storedImage.contentType,
        imageOriginalName: storedImage.originalName,
        createdBy: auth.session.id,
      })
      .returning({ id: managementInvoices.id });

    after(async () => {
      const leads = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.role, "LEAD"), eq(users.active, true)));
      await sendPushToUsers(
        leads.map((lead) => lead.id),
        managementInvoiceNotification({
          invoiceId: invoice.id,
          eventName: input.eventName,
          eventDate: input.eventDate,
          eventTime: input.eventTime,
        }),
      );
    });

    return Response.json(invoice, { status: 201 });
  } catch (error) {
    if (storedImage) {
      await deleteInvoiceImage(storedImage.storageKey).catch(() => undefined);
    }
    return storageError(error);
  }
}
