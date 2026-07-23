import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, put } from "@vercel/blob";
import { env } from "@/lib/env";

const localInvoiceDirectory = path.join(
  process.cwd(),
  ".data",
  "invoices",
);

function safeFileName(fileName: string) {
  return fileName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "invoice";
}

export class InvoiceStorageNotConfiguredError extends Error {
  constructor() {
    super(
      "Private invoice storage is not configured. Add INVOICE_BLOB_READ_WRITE_TOKEN.",
    );
  }
}

export async function storeInvoiceImage(file: File) {
  const normalizedName = safeFileName(file.name);

  if (env.INVOICE_BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`invoices/${normalizedName}`, file, {
      access: "private",
      addRandomSuffix: true,
      cacheControlMaxAge: 3600,
      contentType: file.type,
      token: env.INVOICE_BLOB_READ_WRITE_TOKEN,
    });

    return {
      storageKey: blob.pathname,
      contentType: file.type,
      originalName: file.name,
    };
  }

  if (process.env.NODE_ENV === "production") {
    throw new InvoiceStorageNotConfiguredError();
  }

  const extension = path.extname(normalizedName);
  const localName = `${randomUUID()}${extension}`;
  await mkdir(localInvoiceDirectory, { recursive: true });
  await writeFile(
    path.join(localInvoiceDirectory, localName),
    Buffer.from(await file.arrayBuffer()),
  );

  return {
    storageKey: `local/${localName}`,
    contentType: file.type,
    originalName: file.name,
  };
}

export async function readInvoiceImage(storageKey: string) {
  if (storageKey.startsWith("local/")) {
    if (process.env.NODE_ENV === "production") return null;
    const localName = path.basename(storageKey.slice("local/".length));
    return {
      body: await readFile(path.join(localInvoiceDirectory, localName)),
      etag: null,
    };
  }

  if (!env.INVOICE_BLOB_READ_WRITE_TOKEN) {
    throw new InvoiceStorageNotConfiguredError();
  }

  const result = await get(storageKey, {
    access: "private",
    token: env.INVOICE_BLOB_READ_WRITE_TOKEN,
  });
  if (!result || result.statusCode !== 200) return null;

  return {
    body: result.stream,
    etag: result.blob.etag,
  };
}

export async function deleteInvoiceImage(storageKey: string) {
  if (storageKey.startsWith("local/")) {
    if (process.env.NODE_ENV === "production") return;
    const localName = path.basename(storageKey.slice("local/".length));
    await rm(path.join(localInvoiceDirectory, localName), { force: true });
    return;
  }

  if (!env.INVOICE_BLOB_READ_WRITE_TOKEN) {
    throw new InvoiceStorageNotConfiguredError();
  }

  await del(storageKey, { token: env.INVOICE_BLOB_READ_WRITE_TOKEN });
}
