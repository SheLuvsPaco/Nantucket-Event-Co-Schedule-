"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileImage,
  Pencil,
  Plus,
  ReceiptText,
  Trash2,
  X,
} from "lucide-react";
import { formatLongDate, formatTime } from "@/lib/date";
import type { ManagementInvoiceRecord } from "@/types";
import styles from "./management-invoices.module.css";

type InvoiceDraft = {
  eventName: string;
  eventDate: string;
  eventTime: string;
  notes: string;
};

function emptyDraft(date = ""): InvoiceDraft {
  return {
    eventName: "",
    eventDate: date,
    eventTime: "",
    notes: "",
  };
}

function InvoiceCard({
  canManage,
  invoice,
  onEdit,
  onDelete,
  pending,
}: {
  canManage: boolean;
  invoice: ManagementInvoiceRecord;
  onEdit: (invoice: ManagementInvoiceRecord) => void;
  onDelete: (invoice: ManagementInvoiceRecord) => void;
  pending: boolean;
}) {
  return (
    <article className={styles.invoiceCard}>
      <a
        aria-label={`Open invoice image for ${invoice.eventName}`}
        className={styles.invoiceImage}
        href={`/api/management/invoices/${invoice.id}/image`}
        rel="noreferrer"
        target="_blank"
      >
        {/* Authenticated application route; next/image cannot optimize private responses. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={`Invoice for ${invoice.eventName}`}
          loading="lazy"
          src={`/api/management/invoices/${invoice.id}/image`}
        />
        <span>
          <FileImage aria-hidden="true" />
          Open full invoice
        </span>
      </a>

      <div className={styles.invoiceBody}>
        <div className={styles.invoiceTop}>
          <div>
            <p className={styles.invoiceKicker}>Management invoice</p>
            <h2>{invoice.eventName}</h2>
          </div>
          {canManage ? (
            <div className={styles.cardActions}>
              <button
                aria-label={`Edit ${invoice.eventName}`}
                className="icon-button"
                disabled={pending}
                onClick={() => onEdit(invoice)}
                type="button"
              >
                <Pencil aria-hidden="true" />
              </button>
              <button
                aria-label={`Delete ${invoice.eventName}`}
                className={`icon-button ${styles.deleteButton}`}
                disabled={pending}
                onClick={() => onDelete(invoice)}
                type="button"
              >
                <Trash2 aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </div>

        <div className={styles.when}>
          <strong>{formatLongDate(invoice.eventDate)}</strong>
          <span>{formatTime(invoice.eventTime)}</span>
        </div>

        {invoice.notes ? (
          <div className={styles.notes}>
            <p>Notes</p>
            <div>{invoice.notes}</div>
          </div>
        ) : null}

        <p className={styles.postedBy}>
          Added by {invoice.creator.name}
        </p>
      </div>
    </article>
  );
}

export function ManagementInvoices({
  canManage,
  defaultDate = "",
  initialInvoices,
  showAddButton = false,
}: {
  canManage: boolean;
  defaultDate?: string;
  initialInvoices: ManagementInvoiceRecord[];
  showAddButton?: boolean;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ManagementInvoiceRecord | null>(null);
  const [draft, setDraft] = useState<InvoiceDraft>(() => emptyDraft(defaultDate));
  const [image, setImage] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const editorOpen = canManage && (creating || editing !== null);

  function startCreate() {
    setCreating(true);
    setEditing(null);
    setDraft(emptyDraft(defaultDate));
    setImage(null);
    setError("");
  }

  function startEdit(invoice: ManagementInvoiceRecord) {
    setCreating(false);
    setEditing(invoice);
    setDraft({
      eventName: invoice.eventName,
      eventDate: invoice.eventDate,
      eventTime: invoice.eventTime ?? "",
      notes: invoice.notes ?? "",
    });
    setImage(null);
    setError("");
  }

  function closeEditor() {
    setCreating(false);
    setEditing(null);
    setImage(null);
    setError("");
  }

  async function saveInvoice() {
    if (!editing && !image) {
      setError("Please upload the invoice image.");
      return;
    }

    const formData = new FormData();
    formData.set("eventName", draft.eventName);
    formData.set("eventDate", draft.eventDate);
    formData.set("eventTime", draft.eventTime);
    formData.set("notes", draft.notes);
    if (image) formData.set("invoiceImage", image);

    setPending(true);
    setError("");
    try {
      const response = await fetch(
        editing
          ? `/api/management/invoices/${editing.id}`
          : "/api/management/invoices",
        {
          method: editing ? "PATCH" : "POST",
          body: formData,
        },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "The invoice could not be saved.");
        return;
      }

      closeEditor();
      router.refresh();
    } catch {
      setError("We could not reach the app. Check your connection and save again.");
    } finally {
      setPending(false);
    }
  }

  async function deleteInvoice(invoice: ManagementInvoiceRecord) {
    if (
      !window.confirm(
        `Delete the invoice for “${invoice.eventName}”? This cannot be undone.`,
      )
    ) {
      return;
    }

    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/management/invoices/${invoice.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "The invoice could not be deleted.");
        return;
      }
      router.refresh();
    } catch {
      setError("We could not reach the app. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.collection}>
      {canManage && showAddButton && !editorOpen ? (
        <div className={styles.addRow}>
          <button
            className="button button-primary"
            onClick={startCreate}
            type="button"
          >
            <Plus aria-hidden="true" />
            Add invoice
          </button>
        </div>
      ) : null}

      {editorOpen ? (
        <section className={`${styles.editor} panel`}>
          <div className="panel-header">
            <div>
              <p className="eyebrow">
                {editing ? "Update invoice" : "New invoice"}
              </p>
              <h2>{editing?.eventName ?? "Add management invoice"}</h2>
            </div>
            <button
              aria-label="Close invoice editor"
              className="icon-button"
              onClick={closeEditor}
              type="button"
            >
              <X aria-hidden="true" />
            </button>
          </div>

          <div className="panel-body">
            <div className="form-grid">
              <div className="field">
                <label htmlFor="invoice-event-name">Event name</label>
                <input
                  className="input"
                  id="invoice-event-name"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      eventName: event.target.value,
                    }))
                  }
                  placeholder="Wedding, installation, or client event"
                  value={draft.eventName}
                />
              </div>

              <div className="form-grid form-grid-2">
                <div className="field">
                  <label htmlFor="invoice-date">Date</label>
                  <input
                    className="input"
                    id="invoice-date"
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        eventDate: event.target.value,
                      }))
                    }
                    type="date"
                    value={draft.eventDate}
                  />
                </div>
                <div className="field">
                  <label htmlFor="invoice-time">Time</label>
                  <input
                    className="input"
                    id="invoice-time"
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        eventTime: event.target.value,
                      }))
                    }
                    type="time"
                    value={draft.eventTime}
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="invoice-image">
                  {editing ? "Replace invoice image (optional)" : "Invoice image"}
                </label>
                <input
                  accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
                  className={styles.fileInput}
                  id="invoice-image"
                  onChange={(event) =>
                    setImage(event.target.files?.item(0) ?? null)
                  }
                  type="file"
                />
                <label className={styles.upload} htmlFor="invoice-image">
                  <ReceiptText aria-hidden="true" />
                  <span>
                    <strong>{image?.name ?? editing?.imageOriginalName ?? "Choose invoice image"}</strong>
                    <small>JPG, PNG, WebP, GIF, or AVIF · 4 MB maximum</small>
                  </span>
                </label>
              </div>

              <div className="field">
                <label htmlFor="invoice-notes">Notes</label>
                <textarea
                  className="textarea"
                  id="invoice-notes"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  placeholder="Anything management or the lead should know"
                  value={draft.notes}
                />
              </div>

              {error ? (
                <p className="error-message" role="alert">
                  {error}
                </p>
              ) : null}

              <div className={styles.editorActions}>
                <button
                  className="button button-secondary"
                  disabled={pending}
                  onClick={closeEditor}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="button button-primary"
                  disabled={pending}
                  onClick={saveInvoice}
                  type="button"
                >
                  {pending ? "Saving invoice…" : "Save invoice"}
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {error && !editorOpen ? (
        <p className="error-message" role="alert">
          {error}
        </p>
      ) : null}

      {initialInvoices.length ? (
        <div className={styles.invoiceList}>
          {initialInvoices.map((invoice) => (
            <InvoiceCard
              canManage={canManage}
              invoice={invoice}
              key={invoice.id}
              onDelete={deleteInvoice}
              onEdit={startEdit}
              pending={pending}
            />
          ))}
        </div>
      ) : (
        <div className="panel empty-state">
          <div>
            <ReceiptText aria-hidden="true" />
            <h2>No invoices here yet</h2>
            <p className="muted">
              {canManage
                ? "Add the first invoice so management and leads have one clear reference."
                : "Management has not posted an invoice here yet."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
