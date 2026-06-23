import { eq } from "drizzle-orm";
import { db } from "@/db";
import { managementInvoices } from "@/db/schema";
import { requireApiSession } from "@/lib/auth";
import { apiError } from "@/lib/http";
import {
  deleteInvoiceImage,
  InvoiceStorageNotConfiguredError,
  storeInvoiceImage,
} from "@/lib/invoice-storage";
import { validateImageUpload } from "@/lib/image-upload";
import { managementInvoiceSchema } from "@/lib/validation";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

function storageError(error: unknown) {
  if (error instanceof InvoiceStorageNotConfiguredError) {
    return Response.json({ error: error.message }, { status: 503 });
  }
  return apiError(error);
}

export async function PATCH(request: Request, context: Context) {
  const auth = await requireApiSession(["ADMIN", "OWNER"]);
  if (auth.error) return auth.error;

  let storedImage: Awaited<ReturnType<typeof storeInvoiceImage>> | null = null;

  try {
    const { id } = await context.params;
    const [current] = await db
      .select()
      .from(managementInvoices)
      .where(eq(managementInvoices.id, id))
      .limit(1);
    if (!current) {
      return Response.json({ error: "Invoice not found." }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("invoiceImage");
    if (file instanceof File && file.size > 0) {
      const uploadError = validateImageUpload(file);
      if (uploadError) {
        return Response.json(
          { error: `invoiceImage: ${uploadError}` },
          { status: 400 },
        );
      }
      storedImage = await storeInvoiceImage(file);
    }

    const input = managementInvoiceSchema.parse({
      eventName: formData.get("eventName"),
      eventDate: formData.get("eventDate"),
      eventTime: formData.get("eventTime"),
      notes: formData.get("notes"),
    });
    const [invoice] = await db
      .update(managementInvoices)
      .set({
        ...input,
        ...(storedImage
          ? {
              imageStorageKey: storedImage.storageKey,
              imageContentType: storedImage.contentType,
              imageOriginalName: storedImage.originalName,
            }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(managementInvoices.id, id))
      .returning({ id: managementInvoices.id });

    if (storedImage) {
      await deleteInvoiceImage(current.imageStorageKey).catch((error) => {
        console.error("Unable to remove replaced invoice image:", error);
      });
    }

    return Response.json(invoice);
  } catch (error) {
    if (storedImage) {
      await deleteInvoiceImage(storedImage.storageKey).catch(() => undefined);
    }
    return storageError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  const auth = await requireApiSession(["ADMIN", "OWNER"]);
  if (auth.error) return auth.error;

  try {
    const { id } = await context.params;
    const [invoice] = await db
      .delete(managementInvoices)
      .where(eq(managementInvoices.id, id))
      .returning({ imageStorageKey: managementInvoices.imageStorageKey });
    if (!invoice) {
      return Response.json({ error: "Invoice not found." }, { status: 404 });
    }

    await deleteInvoiceImage(invoice.imageStorageKey).catch((error) => {
      console.error("Unable to remove deleted invoice image:", error);
    });
    return Response.json({ ok: true });
  } catch (error) {
    return storageError(error);
  }
}
