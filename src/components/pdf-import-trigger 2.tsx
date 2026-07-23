"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Check,
  FilePlus2,
  Loader2,
  Trash2,
  Truck,
  Upload,
  UsersRound,
  X,
} from "lucide-react";
import type {
  PicklistEventDraft,
  PicklistPackItemDraft,
  PicklistPreview,
} from "@/lib/pdf-picklist";
import type { InventoryRecord, UserRecord, VehicleRecord } from "@/types";
import styles from "./pdf-import-trigger.module.css";

type PreviewPayload = {
  preview: PicklistPreview;
  catalog: {
    inventory: InventoryRecord[];
    people: UserRecord[];
    vehicles: VehicleRecord[];
  };
};

type PublishResponse = {
  id: string;
  eventDate: string;
  createdInventoryCount: number;
};

function emptyToNull(value: string) {
  const cleaned = value.trim();
  return cleaned || null;
}

function updateTimeline(
  draft: PicklistEventDraft,
  index: number,
  patch: Partial<PicklistEventDraft["timeline"][number]>,
) {
  return {
    ...draft,
    timeline: draft.timeline.map((entry, entryIndex) =>
      entryIndex === index ? { ...entry, ...patch } : entry,
    ),
  };
}

export function PdfImportTrigger() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewPayload, setPreviewPayload] = useState<PreviewPayload | null>(
    null,
  );
  const [draft, setDraft] = useState<PicklistEventDraft | null>(null);
  const [packItems, setPackItems] = useState<PicklistPackItemDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !loading && !publishing) setOpen(false);
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [loading, open, publishing]);

  const crew = useMemo(
    () =>
      (previewPayload?.catalog.people ?? []).filter((person) =>
        ["STAFF", "LEAD"].includes(person.role),
      ),
    [previewPayload],
  );

  function reset() {
    setFile(null);
    setPreviewPayload(null);
    setDraft(null);
    setPackItems([]);
    setError("");
  }

  async function previewPdf() {
    if (!file) return;
    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.set("pdf", file);
      const response = await fetch("/api/events/import-pdf/preview", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as PreviewPayload | { error?: string };
      if (!response.ok) {
        throw new Error(
          "error" in data
            ? data.error ?? "The PDF could not be read."
            : "The PDF could not be read.",
        );
      }

      const payload = data as PreviewPayload;
      setPreviewPayload(payload);
      setDraft(payload.preview.draft);
      setPackItems(payload.preview.packItems);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The PDF could not be imported. Try the original picklist PDF.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function publish() {
    if (!draft) return;
    setPublishing(true);
    setError("");

    try {
      const response = await fetch("/api/events/import-pdf/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft, packItems }),
      });
      const data = (await response.json()) as PublishResponse | { error?: string };
      if (!response.ok) {
        throw new Error(
          "error" in data
            ? data.error ?? "The event could not be created."
            : "The event could not be created.",
        );
      }

      const published = data as PublishResponse;
      router.refresh();
      setOpen(false);
      reset();
      router.push(
        `/app/schedule/${published.eventDate}?event=${published.id}&businesses=tents`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The event could not be published. Please try again.",
      );
    } finally {
      setPublishing(false);
    }
  }

  function toggleCrew(person: UserRecord) {
    if (!draft) return;
    const exists = draft.staff.some((entry) => entry.userId === person.id);
    setDraft({
      ...draft,
      staff: exists
        ? draft.staff.filter((entry) => entry.userId !== person.id)
        : [
            ...draft.staff,
            {
              userId: person.id,
              assignment: null,
              callTime: draft.callTime,
              notes: null,
            },
          ],
    });
  }

  function toggleVehicle(vehicle: VehicleRecord) {
    if (!draft) return;
    const exists = draft.vehicles.some((entry) => entry.vehicleId === vehicle.id);
    setDraft({
      ...draft,
      vehicles: exists
        ? draft.vehicles.filter((entry) => entry.vehicleId !== vehicle.id)
        : [
            ...draft.vehicles,
            {
              vehicleId: vehicle.id,
              driverUserId: null,
              destination: draft.address ?? draft.venue,
              departureTime: draft.callTime,
              notes: null,
            },
          ],
    });
  }

  return (
    <>
      <button
        aria-label="Import PDF picklist"
        className={`button button-secondary ${styles.trigger}`}
        onClick={() => setOpen(true)}
        type="button"
      >
        <FilePlus2 aria-hidden="true" />
        <span>PDF</span>
      </button>

      {open ? (
        <div
          aria-labelledby="pdf-import-title"
          aria-modal="true"
          className={styles.backdrop}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget && !loading && !publishing) {
              setOpen(false);
            }
          }}
          role="dialog"
        >
          <div className={styles.modal}>
            <button
              aria-label="Close PDF import"
              className={styles.closeButton}
              disabled={loading || publishing}
              onClick={() => setOpen(false)}
              type="button"
            >
              <X aria-hidden="true" />
            </button>

            <div className={styles.header}>
              <p className="eyebrow">Tents PDF import</p>
              <h2 id="pdf-import-title">Create event from picklist</h2>
              <p>
                Upload the standard picklist PDF, review the generated event,
                assign crew and vehicles, then publish.
              </p>
            </div>

            {!draft ? (
              <div className={styles.uploadPanel}>
                <label className={styles.uploadBox}>
                  <Upload aria-hidden="true" />
                  <strong>{file?.name ?? "Choose picklist PDF"}</strong>
                  <small>Nothing is saved until you review and publish.</small>
                  <input
                    accept="application/pdf"
                    disabled={loading}
                    onChange={(event) => {
                      setFile(event.target.files?.item(0) ?? null);
                      setError("");
                    }}
                    type="file"
                  />
                </label>
                {error ? (
                  <p className={styles.error} role="alert">
                    {error}
                  </p>
                ) : null}
                <div className={styles.actions}>
                  <button
                    className="button button-primary"
                    disabled={!file || loading}
                    onClick={previewPdf}
                    type="button"
                  >
                    {loading ? <Loader2 aria-hidden="true" /> : <FilePlus2 aria-hidden="true" />}
                    {loading ? "Reading PDF..." : "Preview event"}
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.preview}>
                {previewPayload?.preview.warnings.length ? (
                  <div className={styles.warnings}>
                    {previewPayload.preview.warnings.map((warning) => (
                      <p key={warning}>{warning}</p>
                    ))}
                  </div>
                ) : null}

                <section className={styles.panel}>
                  <div className={styles.panelTitle}>
                    <FilePlus2 aria-hidden="true" />
                    <div>
                      <p>Event details</p>
                      <h3>Generated job card</h3>
                    </div>
                  </div>
                  <div className={styles.gridTwo}>
                    <label>
                      Event name
                      <input
                        className="input"
                        onChange={(event) =>
                          setDraft({ ...draft, title: event.target.value })
                        }
                        value={draft.title}
                      />
                    </label>
                    <label>
                      Event date
                      <input
                        className="input"
                        onChange={(event) =>
                          setDraft({ ...draft, eventDate: event.target.value })
                        }
                        type="date"
                        value={draft.eventDate}
                      />
                    </label>
                    <label>
                      Warehouse call
                      <input
                        className="input"
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            callTime: emptyToNull(event.target.value),
                          })
                        }
                        type="time"
                        value={draft.callTime ?? ""}
                      />
                    </label>
                    <label>
                      Address
                      <input
                        className="input"
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            address: emptyToNull(event.target.value),
                          })
                        }
                        value={draft.address ?? ""}
                      />
                    </label>
                  </div>
                  <label>
                    Notes
                    <textarea
                      className="textarea"
                      onChange={(event) =>
                        setDraft({ ...draft, notes: emptyToNull(event.target.value) })
                      }
                      value={draft.notes ?? ""}
                    />
                  </label>
                </section>

                <section className={styles.panel}>
                  <div className={styles.panelTitle}>
                    <Check aria-hidden="true" />
                    <div>
                      <p>Arrival plan</p>
                      <h3>Timeline</h3>
                    </div>
                  </div>
                  {draft.timeline.map((entry, index) => (
                    <div className={styles.timelineRow} key={`${entry.time}-${index}`}>
                      <input
                        aria-label="Timeline start time"
                        className="input"
                        onChange={(event) =>
                          setDraft(updateTimeline(draft, index, { time: event.target.value }))
                        }
                        type="time"
                        value={entry.time}
                      />
                      <input
                        aria-label="Timeline end time"
                        className="input"
                        onChange={(event) =>
                          setDraft(
                            updateTimeline(draft, index, {
                              endTime: emptyToNull(event.target.value),
                            }),
                          )
                        }
                        type="time"
                        value={entry.endTime ?? ""}
                      />
                      <input
                        aria-label="Timeline label"
                        className="input"
                        onChange={(event) =>
                          setDraft(
                            updateTimeline(draft, index, { label: event.target.value }),
                          )
                        }
                        value={entry.label}
                      />
                    </div>
                  ))}
                </section>

                <section className={styles.panel}>
                  <div className={styles.panelTitle}>
                    <UsersRound aria-hidden="true" />
                    <div>
                      <p>No crew in PDF</p>
                      <h3>Assign crew</h3>
                    </div>
                  </div>
                  <div className={styles.choiceGrid}>
                    {crew.map((person) => {
                      const selected = draft.staff.some(
                        (entry) => entry.userId === person.id,
                      );
                      return (
                        <button
                          className={styles.choice}
                          data-selected={selected}
                          key={person.id}
                          onClick={() => toggleCrew(person)}
                          type="button"
                        >
                          {person.name}
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className={styles.panel}>
                  <div className={styles.panelTitle}>
                    <Truck aria-hidden="true" />
                    <div>
                      <p>No vehicles in PDF</p>
                      <h3>Assign vehicles</h3>
                    </div>
                  </div>
                  <div className={styles.choiceGrid}>
                    {(previewPayload?.catalog.vehicles ?? []).map((vehicle) => {
                      const selected = draft.vehicles.some(
                        (entry) => entry.vehicleId === vehicle.id,
                      );
                      return (
                        <button
                          className={styles.choice}
                          data-selected={selected}
                          key={vehicle.id}
                          onClick={() => toggleVehicle(vehicle)}
                          type="button"
                        >
                          {vehicle.name}
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className={styles.panel}>
                  <div className={styles.panelTitle}>
                    <Box aria-hidden="true" />
                    <div>
                      <p>PDF sections preserved</p>
                      <h3>Pack list</h3>
                    </div>
                  </div>
                  <div className={styles.packRows}>
                    {packItems.map((item, index) => (
                      <div className={styles.packRow} key={item.key}>
                        <div className={styles.packTop}>
                          <strong>{item.itemName}</strong>
                          <span data-status={item.matchStatus}>
                            {item.matchStatus === "matched"
                              ? `Matched: ${item.matchedInventoryName}`
                              : "New inventory item"}
                          </span>
                        </div>
                        <div className={styles.gridThree}>
                          <label>
                            Inventory
                            <select
                              className="select"
                              onChange={(event) => {
                                const value = event.target.value;
                                const inventoryItem =
                                  previewPayload?.catalog.inventory.find(
                                    (candidate) => candidate.id === value,
                                  ) ?? null;
                                setPackItems((current) =>
                                  current.map((entry, entryIndex) =>
                                    entryIndex === index
                                      ? value === "__new"
                                        ? {
                                            ...entry,
                                            inventoryItemId: null,
                                            matchStatus: "new",
                                            matchedInventoryName: null,
                                            newItem: entry.newItem ?? {
                                              name: entry.itemName,
                                              category: "Other",
                                              size: null,
                                              quantity: entry.quantity,
                                            },
                                          }
                                        : {
                                            ...entry,
                                            inventoryItemId: value,
                                            matchStatus: "matched",
                                            matchedInventoryName:
                                              inventoryItem?.name ?? "Selected item",
                                          }
                                      : entry,
                                  ),
                                );
                              }}
                              value={item.inventoryItemId ?? "__new"}
                            >
                              <option value="__new">Create new item</option>
                              {(previewPayload?.catalog.inventory ?? []).map(
                                (inventoryItem) => (
                                  <option
                                    key={inventoryItem.id}
                                    value={inventoryItem.id}
                                  >
                                    {inventoryItem.name}
                                    {inventoryItem.size
                                      ? ` · ${inventoryItem.size}`
                                      : ""}
                                  </option>
                                ),
                              )}
                            </select>
                          </label>
                          <label>
                            Pack quantity
                            <input
                              className="input"
                              min={1}
                              onChange={(event) =>
                                setPackItems((current) =>
                                  current.map((entry, entryIndex) =>
                                    entryIndex === index
                                      ? {
                                          ...entry,
                                          quantity: Number(event.target.value),
                                          newItem: entry.newItem
                                            ? {
                                                ...entry.newItem,
                                                quantity: Number(event.target.value),
                                              }
                                            : null,
                                        }
                                      : entry,
                                  ),
                                )
                              }
                              type="number"
                              value={item.quantity}
                            />
                          </label>
                          <button
                            aria-label={`Remove ${item.itemName}`}
                            className={`button button-danger ${styles.removeButton}`}
                            onClick={() =>
                              setPackItems((current) =>
                                current.filter((_, entryIndex) => entryIndex !== index),
                              )
                            }
                            type="button"
                          >
                            <Trash2 aria-hidden="true" />
                          </button>
                        </div>
                        {item.newItem ? (
                          <div className={styles.gridThree}>
                            <label>
                              New item name
                              <input
                                className="input"
                                onChange={(event) =>
                                  setPackItems((current) =>
                                    current.map((entry, entryIndex) =>
                                      entryIndex === index && entry.newItem
                                        ? {
                                            ...entry,
                                            itemName: event.target.value,
                                            newItem: {
                                              ...entry.newItem,
                                              name: event.target.value,
                                            },
                                          }
                                        : entry,
                                    ),
                                  )
                                }
                                value={item.newItem.name}
                              />
                            </label>
                            <label>
                              Category
                              <input
                                className="input"
                                onChange={(event) =>
                                  setPackItems((current) =>
                                    current.map((entry, entryIndex) =>
                                      entryIndex === index && entry.newItem
                                        ? {
                                            ...entry,
                                            newItem: {
                                              ...entry.newItem,
                                              category: event.target.value,
                                            },
                                          }
                                        : entry,
                                    ),
                                  )
                                }
                                value={item.newItem.category}
                              />
                            </label>
                            <label>
                              Size
                              <input
                                className="input"
                                onChange={(event) =>
                                  setPackItems((current) =>
                                    current.map((entry, entryIndex) =>
                                      entryIndex === index && entry.newItem
                                        ? {
                                            ...entry,
                                            newItem: {
                                              ...entry.newItem,
                                              size: emptyToNull(event.target.value),
                                            },
                                          }
                                        : entry,
                                    ),
                                  )
                                }
                                value={item.newItem.size ?? ""}
                              />
                            </label>
                          </div>
                        ) : null}
                        <label>
                          Packing note
                          <textarea
                            className="textarea"
                            onChange={(event) =>
                              setPackItems((current) =>
                                current.map((entry, entryIndex) =>
                                  entryIndex === index
                                    ? {
                                        ...entry,
                                        notes: emptyToNull(event.target.value),
                                      }
                                    : entry,
                                ),
                              )
                            }
                            value={item.notes ?? ""}
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                </section>

                {error ? (
                  <p className={styles.error} role="alert">
                    {error}
                  </p>
                ) : null}

                <div className={styles.stickyActions}>
                  <button
                    className="button button-secondary"
                    disabled={publishing}
                    onClick={reset}
                    type="button"
                  >
                    Start over
                  </button>
                  <button
                    className="button button-primary"
                    disabled={publishing || !draft.eventDate || !draft.title}
                    onClick={publish}
                    type="button"
                  >
                    {publishing ? (
                      <Loader2 aria-hidden="true" />
                    ) : (
                      <Check aria-hidden="true" />
                    )}
                    {publishing ? "Publishing..." : "Publish event"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
