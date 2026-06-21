"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  Boxes,
  ImageIcon,
  Pencil,
  Plus,
  Search,
  X,
} from "lucide-react";
import type { InventoryRecord } from "@/types";
import styles from "./resource-manager.module.css";

const emptyItem: Omit<InventoryRecord, "id"> = {
  name: "",
  category: "Tents",
  quantity: 0,
  size: "",
  imageUrl: "",
  notes: "",
  active: true,
};

export function InventoryManager({
  initialItems,
}: {
  initialItems: InventoryRecord[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [editing, setEditing] = useState<InventoryRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(emptyItem);
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  const categories = useMemo(
    () => ["All", ...new Set(initialItems.map((item) => item.category))],
    [initialItems],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return initialItems.filter(
      (item) =>
        (category === "All" || item.category === category) &&
        (!needle ||
          item.name.toLowerCase().includes(needle) ||
          item.size?.toLowerCase().includes(needle) ||
          item.notes?.toLowerCase().includes(needle)),
    );
  }, [category, initialItems, query]);

  function startCreate() {
    setEditing(null);
    setDraft(emptyItem);
    setCreating(true);
    setError("");
  }

  function startEdit(item: InventoryRecord) {
    setCreating(false);
    setEditing(item);
    setDraft({
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      size: item.size ?? "",
      imageUrl: item.imageUrl ?? "",
      notes: item.notes ?? "",
      active: item.active,
    });
    setError("");
  }

  async function removePendingImage(url: string) {
    try {
      await fetch("/api/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
    } finally {
      setPendingImageUrl((current) => (current === url ? null : current));
    }
  }

  function closeEditor(preservePendingImage = false) {
    if (pendingImageUrl && !preservePendingImage) {
      void removePendingImage(pendingImageUrl);
    } else if (preservePendingImage) {
      setPendingImageUrl(null);
    }
    setEditing(null);
    setCreating(false);
    setError("");
  }

  async function save() {
    setPending(true);
    setError("");
    try {
      if (pendingImageUrl && draft.imageUrl !== pendingImageUrl) {
        await removePendingImage(pendingImageUrl);
      }

      const response = await fetch(
        editing ? `/api/inventory/${editing.id}` : "/api/inventory",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "The inventory item could not be saved.");
        return;
      }
      closeEditor(true);
      router.refresh();
    } catch {
      setError("We could not reach the schedule. Check your connection and save again.");
    } finally {
      setPending(false);
    }
  }

  async function uploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as { error?: string; url?: string };
      if (!response.ok) {
        setError(data.error ?? "Failed to upload image.");
        return;
      }

      if (!data.url) {
        setError("The image upload did not return a URL.");
        return;
      }

      const uploadedUrl = data.url;
      if (pendingImageUrl && pendingImageUrl !== uploadedUrl) {
        void removePendingImage(pendingImageUrl);
      }
      setPendingImageUrl(uploadedUrl);
      setDraft((current) => ({ ...current, imageUrl: uploadedUrl }));
    } catch {
      setError("Network error while uploading image.");
    } finally {
      setUploading(false);
    }
  }

  async function archive(item: InventoryRecord) {
    const confirmed = window.confirm(
      `Archive “${item.name}”? It will stay on past event records.`,
    );
    if (!confirmed) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/inventory/${item.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "The inventory item could not be archived.");
        return;
      }
      closeEditor();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const editorOpen = creating || editing !== null;

  return (
    <div className={styles.manager}>
      <div className={styles.toolbar}>
        <div className={styles.search}>
          <Search aria-hidden="true" />
          <input
            aria-label="Search inventory"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, size, or note"
          />
        </div>
        <select
          aria-label="Filter by category"
          className="select"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          {categories.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
        <button className="button button-primary" onClick={startCreate} type="button">
          <Plus aria-hidden="true" />
          Add item
        </button>
      </div>

      {error && !editorOpen ? (
        <p className="error-message" role="alert">
          {error}
        </p>
      ) : null}

      {editorOpen ? (
        <section className={`${styles.editor} panel`}>
          <div className="panel-header">
            <div>
              <p className="eyebrow">{editing ? "Edit item" : "New item"}</p>
              <h2>{editing?.name ?? "Add inventory"}</h2>
            </div>
            <button
              aria-label="Close inventory editor"
              className="icon-button"
              onClick={() => closeEditor()}
              type="button"
            >
              <X aria-hidden="true" />
            </button>
          </div>
          <div className="panel-body">
            <div className="form-grid">
              <div className="form-grid form-grid-3">
                <div className="field">
                  <label htmlFor="inventory-name">Name</label>
                  <input
                    className="input"
                    id="inventory-name"
                    value={draft.name}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="44 × 63 Sailcloth Tent"
                  />
                </div>
                <div className="field">
                  <label htmlFor="inventory-category">Category</label>
                  <input
                    className="input"
                    id="inventory-category"
                    value={draft.category}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        category: event.target.value,
                      }))
                    }
                    placeholder="Tents"
                  />
                </div>
                <div className="field">
                  <label htmlFor="inventory-quantity">Count available</label>
                  <input
                    className="input"
                    id="inventory-quantity"
                    min="0"
                    type="number"
                    value={draft.quantity}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        quantity: Number(event.target.value),
                      }))
                    }
                  />
                </div>
              </div>
              <div className="form-grid form-grid-2">
                <div className="field">
                  <label htmlFor="inventory-size">Size</label>
                  <input
                    className="input"
                    id="inventory-size"
                    value={draft.size ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, size: event.target.value }))
                    }
                    placeholder="44 × 63 ft"
                  />
                </div>
                <div className="field">
                  <label htmlFor="inventory-image">Image URL</label>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <input
                      className="input"
                      id="inventory-image"
                      type="url"
                      value={draft.imageUrl ?? ""}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          imageUrl: event.target.value,
                        }))
                      }
                      placeholder="https://…"
                      style={{ flex: 1 }}
                    />
                    <label className="button button-secondary" style={{ cursor: "pointer", margin: 0, padding: "0.5rem 1rem" }}>
                      {uploading ? "Uploading..." : "Upload"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                        onChange={uploadImage}
                        disabled={uploading}
                        style={{ display: "none" }}
                      />
                    </label>
                  </div>
                </div>
              </div>
              <div className="field">
                <label htmlFor="inventory-notes">Warehouse and packing notes</label>
                <textarea
                  className="textarea"
                  id="inventory-notes"
                  value={draft.notes ?? ""}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, notes: event.target.value }))
                  }
                  placeholder="Storage location, matching hardware, handling instructions…"
                />
              </div>
              {editing ? (
                <label className={styles.checkRow}>
                  <input
                    checked={draft.active}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        active: event.target.checked,
                      }))
                    }
                    type="checkbox"
                  />
                  Active and available for new pack lists
                </label>
              ) : null}
              {error ? (
                <p className="error-message" role="alert">
                  {error}
                </p>
              ) : null}
              <div className={styles.editorActions}>
                {editing ? (
                  <button
                    className="button button-danger"
                    disabled={pending}
                    onClick={() => archive(editing)}
                    type="button"
                  >
                    <Archive aria-hidden="true" /> Archive item
                  </button>
                ) : (
                  <span />
                )}
                <button
                  className="button button-primary"
                  disabled={pending}
                  onClick={save}
                  type="button"
                >
                  {pending ? "Saving item…" : "Save item"}
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <div className={styles.summary}>
        <span>
          <strong>{initialItems.filter((item) => item.active).length}</strong>
          active items
        </span>
        <span>
          <strong>
            {initialItems
              .filter((item) => item.active)
              .reduce((total, item) => total + item.quantity, 0)}
          </strong>
          total units
        </span>
      </div>

      {filtered.length ? (
        <div className={styles.grid}>
          {filtered.map((item) => (
            <article className={styles.card} data-inactive={!item.active} key={item.id}>
              <div
                className={styles.image}
                style={
                  item.imageUrl
                    ? { backgroundImage: `url("${item.imageUrl.replaceAll('"', "%22")}")` }
                    : undefined
                }
              >
                {!item.imageUrl ? <ImageIcon aria-hidden="true" /> : null}
                {!item.active ? <span>Archived</span> : null}
              </div>
              <div className={styles.cardBody}>
                <div className={styles.cardTop}>
                  <span>{item.category}</span>
                  <button
                    aria-label={`Edit ${item.name}`}
                    className="icon-button"
                    onClick={() => startEdit(item)}
                    type="button"
                  >
                    <Pencil aria-hidden="true" />
                  </button>
                </div>
                <h2>{item.name}</h2>
                <p className={styles.size}>{item.size || "Size not specified"}</p>
                <div className={styles.count}>
                  <strong>{item.quantity}</strong>
                  <span>available</span>
                </div>
                {item.notes ? <p className={styles.notes}>{item.notes}</p> : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel empty-state">
          <div>
            <Boxes aria-hidden="true" />
            <h2>No inventory matches</h2>
            <p className="muted">Clear the search or add a new item.</p>
          </div>
        </div>
      )}
    </div>
  );
}
