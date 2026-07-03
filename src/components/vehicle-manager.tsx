"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Archive, Pencil, Plus, Search, Truck, X } from "lucide-react";
import {
  businesses,
  businessLabels,
  defaultBusiness,
  type Business,
} from "@/lib/businesses";
import type { VehicleRecord } from "@/types";
import styles from "./resource-manager.module.css";

const emptyVehicle: Omit<VehicleRecord, "id"> = {
  name: "",
  type: "Box Truck",
  capacity: "",
  plate: "",
  color: "",
  notes: "",
  imageUrl: null,
  business: defaultBusiness,
  active: true,
};

type BusinessFilter = "ALL" | Business;

export function VehicleManager({
  initialVehicles,
}: {
  initialVehicles: VehicleRecord[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [businessFilter, setBusinessFilter] = useState<BusinessFilter>("ALL");
  const [editing, setEditing] = useState<VehicleRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(emptyVehicle);
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const needle = query.toLowerCase().trim();
    return initialVehicles.filter(
      (vehicle) =>
        (businessFilter === "ALL" || vehicle.business === businessFilter) &&
        (!needle ||
          [
            vehicle.name,
            vehicle.type,
            vehicle.plate,
            vehicle.capacity,
            vehicle.notes,
          ].some((value) => value?.toLowerCase().includes(needle))),
    );
  }, [businessFilter, initialVehicles, query]);

  function startCreate() {
    setEditing(null);
    setCreating(true);
    setDraft({
      ...emptyVehicle,
      business: businessFilter === "ALL" ? defaultBusiness : businessFilter,
    });
    setError("");
  }

  function startEdit(vehicle: VehicleRecord) {
    setCreating(false);
    setEditing(vehicle);
    setDraft({
      name: vehicle.name,
      type: vehicle.type,
      capacity: vehicle.capacity ?? "",
      plate: vehicle.plate ?? "",
      color: vehicle.color ?? "",
      notes: vehicle.notes ?? "",
      imageUrl: vehicle.imageUrl ?? null,
      business: vehicle.business,
      active: vehicle.active,
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
    setCreating(false);
    setEditing(null);
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
        editing ? `/api/vehicles/${editing.id}` : "/api/vehicles",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "The vehicle could not be saved.");
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

  async function archive(vehicle: VehicleRecord) {
    if (
      !window.confirm(
        `Archive “${vehicle.name}”? Past event records will keep the vehicle.`,
      )
    ) {
      return;
    }
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/vehicles/${vehicle.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "The vehicle could not be archived.");
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
            aria-label="Search vehicles"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search vehicle, plate, or note"
          />
        </div>
        <select
          aria-label="Filter vehicles by business"
          className="select"
          value={businessFilter}
          onChange={(event) =>
            setBusinessFilter(event.target.value as BusinessFilter)
          }
        >
          <option value="ALL">All branches</option>
          {businesses.map((business) => (
            <option key={business} value={business}>
              {businessLabels[business]}
            </option>
          ))}
        </select>
        <button className="button button-primary" onClick={startCreate} type="button">
          <Plus aria-hidden="true" /> Add vehicle
        </button>
      </div>

      {editorOpen ? (
        <section className={`${styles.editor} panel`}>
          <div className="panel-header">
            <div>
              <p className="eyebrow">{editing ? "Edit vehicle" : "New vehicle"}</p>
              <h2>{editing?.name ?? "Add to fleet"}</h2>
            </div>
            <button
              aria-label="Close vehicle editor"
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
                  <label htmlFor="vehicle-name">Vehicle name</label>
                  <input
                    className="input"
                    id="vehicle-name"
                    value={draft.name}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="Box Truck 1"
                  />
                </div>
                <div className="field">
                  <label htmlFor="vehicle-business">Business</label>
                  <select
                    className="select"
                    id="vehicle-business"
                    value={draft.business}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        business: event.target.value as Business,
                      }))
                    }
                  >
                    {businesses.map((business) => (
                      <option key={business} value={business}>
                        {businessLabels[business]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="vehicle-type">Type</label>
                  <input
                    className="input"
                    id="vehicle-type"
                    value={draft.type}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, type: event.target.value }))
                    }
                    placeholder="26 ft Box Truck"
                  />
                </div>
              </div>
              <div className="form-grid form-grid-3">
                <div className="field">
                  <label htmlFor="vehicle-capacity">Capacity</label>
                  <input
                    className="input"
                    id="vehicle-capacity"
                    value={draft.capacity ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        capacity: event.target.value,
                      }))
                    }
                    placeholder="26,000 lb GVWR"
                  />
                </div>
                <div className="field">
                  <label htmlFor="vehicle-plate">Plate / identifier</label>
                  <input
                    className="input"
                    id="vehicle-plate"
                    value={draft.plate ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, plate: event.target.value }))
                    }
                    placeholder="NEC-01"
                  />
                </div>
                <div className="field">
                  <label htmlFor="vehicle-color">Color</label>
                  <input
                    className="input"
                    id="vehicle-color"
                    value={draft.color ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, color: event.target.value }))
                    }
                    placeholder="White"
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="vehicle-image">Image URL</label>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <input
                    className="input"
                    id="vehicle-image"
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
              <div className="field">
                <label htmlFor="vehicle-notes">Fleet notes</label>
                <textarea
                  className="textarea"
                  id="vehicle-notes"
                  value={draft.notes ?? ""}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, notes: event.target.value }))
                  }
                  placeholder="Lift gate, fuel, keys, loading specialty…"
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
                  Active and available for new events
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
                    <Archive aria-hidden="true" /> Archive vehicle
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
                  {pending ? "Saving vehicle…" : "Save vehicle"}
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

      {filtered.length ? (
        <div className={styles.list}>
          {filtered.map((vehicle) => (
            <article
              className={styles.listItem}
              data-inactive={!vehicle.active}
              key={vehicle.id}
            >
              <span className={styles.listIcon}>
                {vehicle.imageUrl ? (
                  <Image
                    alt={vehicle.name}
                    height={48}
                    src={vehicle.imageUrl}
                    style={{ height: "100%", objectFit: "cover", width: "100%" }}
                    unoptimized
                    width={48}
                  />
                ) : (
                  <Truck aria-hidden="true" />
                )}
              </span>
              <div className={styles.listMain}>
                <h2>{vehicle.name}</h2>
                <p>{vehicle.notes || "No fleet notes"}</p>
                <div className={styles.listMeta}>
                  {businessFilter === "ALL" ? (
                    <span>{businessLabels[vehicle.business]}</span>
                  ) : null}
                  <span>{vehicle.type}</span>
                  {vehicle.plate ? <span>{vehicle.plate}</span> : null}
                  {vehicle.capacity ? <span>{vehicle.capacity}</span> : null}
                  {!vehicle.active ? <span>Archived</span> : null}
                </div>
              </div>
              <button
                aria-label={`Edit ${vehicle.name}`}
                className="icon-button"
                onClick={() => startEdit(vehicle)}
                type="button"
              >
                <Pencil aria-hidden="true" />
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel empty-state">
          <div>
            <Truck aria-hidden="true" />
            <h2>No vehicles match</h2>
            <p className="muted">Clear the search or add a vehicle.</p>
          </div>
        </div>
      )}
    </div>
  );
}
