"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  Box,
  Check,
  ChevronDown,
  Clock3,
  FileText,
  MapPin,
  Minus,
  Plus,
  Save,
  Search,
  Trash2,
  Truck,
  UsersRound,
  X,
} from "lucide-react";
import type {
  InventoryRecord,
  ScheduleEvent,
  UserRecord,
  VehicleRecord,
} from "@/types";
import { isCountFreePackItem } from "@/lib/pack-list";
import styles from "./event-workspace.module.css";

type EventDraft = {
  id?: string;
  title: string;
  eventDate: string;
  address: string;
  status: "DRAFT" | "CONFIRMED" | "COMPLETED";
  callTime: string;
  departureTime: string;
  returnTime: string;
  notes: string;
  staffBrief: string;
  packerUserId: string;
  timeline: Array<{
    id?: string;
    time: string;
    endTime: string;
    label: string;
    details: string;
    sortOrder: number;
  }>;
  inventory: Array<{
    inventoryItemId: string;
    quantity: number;
    packed: boolean;
    notes: string;
  }>;
  staff: Array<{
    userId: string;
    assignment: string;
    callTime: string;
    notes: string;
  }>;
  vehicles: Array<{
    vehicleId: string;
    driverUserId: string;
    destination: string;
    departureTime: string;
    notes: string;
  }>;
};

function blankEvent(date: string): EventDraft {
  return {
    title: "",
    eventDate: date,
    address: "",
    status: "DRAFT",
    callTime: "",
    departureTime: "",
    returnTime: "",
    notes: "",
    staffBrief: "",
    packerUserId: "",
    timeline: [],
    inventory: [],
    staff: [],
    vehicles: [],
  };
}

function toDraft(event: ScheduleEvent): EventDraft {
  return {
    id: event.id,
    title: event.title,
    eventDate: event.eventDate,
    address: event.address ?? "",
    status: event.status,
    callTime: event.callTime ?? "",
    departureTime: event.departureTime ?? "",
    returnTime: event.returnTime ?? "",
    notes: event.notes ?? "",
    staffBrief: event.staffBrief ?? "",
    packerUserId: event.packerUserId ?? "",
    timeline: event.timeline.map((entry) => ({
      id: entry.id,
      time: entry.time,
      endTime: entry.endTime ?? "",
      label: entry.label,
      details: entry.details ?? "",
      sortOrder: entry.sortOrder,
    })),
    inventory: event.inventory.map((entry) => ({
      inventoryItemId: entry.inventoryItemId,
      quantity: entry.quantity,
      packed: entry.packed,
      notes: entry.notes ?? "",
    })),
    staff: event.staff.map((entry) => ({
      userId: entry.userId,
      assignment: entry.assignment ?? "",
      callTime: entry.callTime ?? "",
      notes: entry.notes ?? "",
    })),
    vehicles: event.vehicles.map((entry) => ({
      vehicleId: entry.vehicleId,
      driverUserId: entry.driverUserId ?? "",
      destination: entry.destination ?? "",
      departureTime: entry.departureTime ?? "",
      notes: entry.notes ?? "",
    })),
  };
}

function EditorSection({
  children,
  count,
  description,
  icon,
  title,
}: {
  children: ReactNode;
  count?: number;
  description: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <details className={styles.editorSection} open>
      <summary>
        <span className={styles.sectionIcon}>{icon}</span>
        <span>
          <strong>{title}</strong>
          <small>{description}</small>
        </span>
        {typeof count === "number" ? (
          <span className={styles.count}>{count}</span>
        ) : null}
        <ChevronDown className={styles.chevron} aria-hidden="true" />
      </summary>
      <div className={styles.sectionContent}>{children}</div>
    </details>
  );
}

const clockHours = Array.from({ length: 12 }, (_, index) => index + 1);
const clockMinutes = Array.from({ length: 12 }, (_, index) => index * 5);

function displayTime(value: string) {
  if (!value) return "Select time";
  const [hours, minutes] = value.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${period}`;
}

function ClockPicker({
  id,
  onChange,
  value,
}: {
  id: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"hour" | "minute">("hour");
  const [fallbackTime, setFallbackTime] = useState("08:00");
  const activeValue = value || fallbackTime;
  const [hour24, minute] = activeValue.split(":").map(Number);
  const hour12 = hour24 % 12 || 12;
  const period = hour24 >= 12 ? "PM" : "AM";

  function commit(nextHour12: number, nextMinute: number, nextPeriod: "AM" | "PM") {
    let nextHour = nextHour12 % 12;
    if (nextPeriod === "PM") nextHour += 12;
    const nextValue = `${String(nextHour).padStart(2, "0")}:${String(
      nextMinute,
    ).padStart(2, "0")}`;
    setFallbackTime(nextValue);
    onChange(nextValue);
  }

  function adjustMinute(amount: number) {
    const total = (hour24 * 60 + minute + amount + 24 * 60) % (24 * 60);
    const nextValue = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(
      total % 60,
    ).padStart(2, "0")}`;
    setFallbackTime(nextValue);
    onChange(nextValue);
  }

  const markers = mode === "hour" ? clockHours : clockMinutes;

  return (
    <div className={styles.timePicker}>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        className={styles.timeTrigger}
        id={id}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <Clock3 aria-hidden="true" />
        <span data-empty={!value}>{displayTime(value)}</span>
        <ChevronDown aria-hidden="true" />
      </button>

      {open ? (
        <div
          aria-label="Choose a time"
          className={styles.clockPopover}
          role="dialog"
        >
          <div className={styles.clockHeader}>
            <button
              className={styles.clockValue}
              data-active={mode === "hour"}
              onClick={() => setMode("hour")}
              type="button"
            >
              {hour12}
            </button>
            <span>:</span>
            <button
              className={styles.clockValue}
              data-active={mode === "minute"}
              onClick={() => setMode("minute")}
              type="button"
            >
              {String(minute).padStart(2, "0")}
            </button>
            <div className={styles.periodControl}>
              {(["AM", "PM"] as const).map((option) => (
                <button
                  data-active={period === option}
                  key={option}
                  onClick={() => commit(hour12, minute, option)}
                  type="button"
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div
            className={styles.clockFace}
            data-mode={mode}
            style={
              {
                "--clock-hand-angle": `${mode === "hour" ? (hour12 % 12) * 30 : minute * 6
                  }deg`,
              } as CSSProperties
            }
          >
            <span className={styles.clockHand} />
            <span className={styles.clockCenter} />
            {markers.map((marker, index) => {
              const angle = index * 30;
              const selected =
                mode === "hour" ? marker === hour12 : marker === minute;
              const markerStyle = {
                "--clock-angle": `${angle}deg`,
              } as CSSProperties;

              return (
                <button
                  aria-label={
                    mode === "hour"
                      ? `${marker} o'clock`
                      : `${marker} minutes`
                  }
                  className={styles.clockMarker}
                  data-selected={selected}
                  key={marker}
                  onClick={() => {
                    if (mode === "hour") {
                      commit(marker, minute, period);
                      setMode("minute");
                    } else {
                      commit(hour12, marker, period);
                    }
                  }}
                  style={markerStyle}
                  type="button"
                >
                  {mode === "minute" ? String(marker).padStart(2, "0") : marker}
                </button>
              );
            })}
          </div>

          <div className={styles.minuteNudge}>
            <button onClick={() => adjustMinute(-1)} type="button">
              <Minus aria-hidden="true" /> 1 min
            </button>
            <span>Exact minute</span>
            <button onClick={() => adjustMinute(1)} type="button">
              <Plus aria-hidden="true" /> 1 min
            </button>
          </div>

          <div className={styles.clockActions}>
            <button
              className="button button-ghost"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              type="button"
            >
              Clear
            </button>
            <button
              className="button button-primary"
              onClick={() => {
                if (!value) commit(hour12, minute, period);
                setOpen(false);
              }}
              type="button"
            >
              Set time
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InventoryCombobox({
  id,
  inventory,
  onChange,
  selectedElsewhere,
  value,
}: {
  id: string;
  inventory: InventoryRecord[];
  onChange: (value: string) => void;
  selectedElsewhere: Set<string>;
  value: string;
}) {
  const selectedItem = inventory.find((item) => item.id === value);
  const [query, setQuery] = useState(selectedItem?.name ?? "");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);

  const options = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return inventory
      .filter(
        (item) =>
          (item.id === value || (item.active && !selectedElsewhere.has(item.id))) &&
          (!needle || item.name.toLowerCase().startsWith(needle)),
      )
      .slice(0, 12);
  }, [inventory, query, selectedElsewhere, value]);

  function selectItem(item: InventoryRecord) {
    onChange(item.id);
    setQuery(item.name);
    setOpen(false);
    setHighlighted(0);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlighted((current) => Math.min(current + 1, options.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter" && open && options[highlighted]) {
      event.preventDefault();
      selectItem(options[highlighted]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className={styles.combobox}>
      <Search aria-hidden="true" />
      <input
        aria-autocomplete="list"
        aria-controls={`${id}-options`}
        aria-expanded={open}
        autoComplete="off"
        className="input"
        id={id}
        onBlur={() => window.setTimeout(() => setOpen(false), 100)}
        onChange={(event) => {
          setQuery(event.target.value);
          onChange("");
          setOpen(true);
          setHighlighted(0);
        }}
        onFocus={(event) => {
          event.currentTarget.select();
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Type an item name…"
        role="combobox"
        value={query}
      />
      {query ? (
        <button
          aria-label="Clear inventory search"
          className={styles.comboboxClear}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setQuery("");
            onChange("");
            setOpen(true);
          }}
          type="button"
        >
          <X aria-hidden="true" />
        </button>
      ) : null}
      {open ? (
        <div className={styles.comboboxOptions} id={`${id}-options`} role="listbox">
          {options.length ? (
            options.map((item, index) => (
              <button
                aria-selected={item.id === value}
                data-highlighted={index === highlighted}
                key={item.id}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectItem(item)}
                role="option"
                type="button"
              >
                <span>
                  <strong>{item.name}</strong>
                  <small>
                    {item.category}
                    {item.size ? ` · ${item.size}` : ""}
                  </small>
                </span>
                <span className={styles.availableCount}>{item.quantity} available</span>
              </button>
            ))
          ) : (
            <p>No inventory starts with “{query}”.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function EventWorkspace({
  date,
  events,
  inventory,
  people,
  selectedId,
  vehicles,
}: {
  date: string;
  events: ScheduleEvent[];
  inventory: InventoryRecord[];
  people: UserRecord[];
  selectedId: string | null;
  vehicles: VehicleRecord[];
}) {
  const selected = events.find((event) => event.id === selectedId) ?? null;

  return (
    <div className={styles.workspace}>
      <div className={styles.tabs} aria-label="Events on this date">
        {events.map((event, index) => (
          <Link
            className={styles.tab}
            data-active={event.id === selectedId}
            href={`/app/schedule/${date}?event=${event.id}`}
            key={event.id}
          >
            <span>Job {index + 1}</span>
            <strong>{event.title}</strong>
            <small>{event.callTime || "Time TBD"}</small>
          </Link>
        ))}
        <Link
          className={`${styles.tab} ${styles.newTab}`}
          data-active={selectedId === null}
          href={`/app/schedule/${date}?create=1`}
        >
          <Plus aria-hidden="true" />
          <strong>New event</strong>
          <small>Start a clean plan</small>
        </Link>
      </div>

      <EventForm
        date={date}
        event={selected}
        inventory={inventory}
        key={selected?.id ?? `new-${date}`}
        people={people}
        vehicles={vehicles}
      />
    </div>
  );
}

function EventForm({
  date,
  event,
  inventory,
  people,
  vehicles,
}: {
  date: string;
  event: ScheduleEvent | null;
  inventory: InventoryRecord[];
  people: UserRecord[];
  vehicles: VehicleRecord[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<EventDraft>(() =>
    event ? toDraft(event) : blankEvent(date),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function update<K extends keyof EventDraft>(key: K, value: EventDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  async function saveEvent() {
    setPending(true);
    setError("");
    setSaved(false);

    try {
      const response = await fetch(
        draft.id ? `/api/events/${draft.id}` : "/api/events",
        {
          method: draft.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...draft,
            eventDate: draft.eventDate || date,
          }),
        },
      );
      const data = (await response.json()) as ScheduleEvent & { error?: string };
      if (!response.ok) {
        setError(data.error ?? "The event could not be saved.");
        return;
      }
      setDraft(toDraft(data));
      setSaved(true);
      router.push(`/app/schedule/${data.eventDate}?event=${data.id}`);
      router.refresh();
    } catch {
      setError("We could not reach the schedule. Check your connection and save again.");
    } finally {
      setPending(false);
    }
  }

  async function deleteEvent() {
    if (!draft.id) return;
    const confirmed = window.confirm(
      `Delete “${draft.title}”? This removes the event from every schedule.`,
    );
    if (!confirmed) return;

    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/events/${draft.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "The event could not be deleted.");
        return;
      }
      router.push(`/app/schedule/${date}`);
      router.refresh();
    } catch {
      setError("We could not reach the schedule. Try deleting the event again.");
    } finally {
      setPending(false);
    }
  }

  function addTimeline() {
    update("timeline", [
      ...draft.timeline,
      {
        time: draft.callTime || "08:00",
        endTime: "",
        label: "",
        details: "",
        sortOrder: draft.timeline.length,
      },
    ]);
  }

  function addInventory() {
    const selected = new Set(draft.inventory.map((item) => item.inventoryItemId));
    const available = inventory.find((item) => item.active && !selected.has(item.id));
    if (!available) return;
    update("inventory", [
      ...draft.inventory,
      { inventoryItemId: available.id, quantity: 1, packed: false, notes: "" },
    ]);
  }

  function addStaff() {
    const selected = new Set(draft.staff.map((item) => item.userId));
    const available = people.find((person) => person.active && !selected.has(person.id));
    if (!available) return;
    update("staff", [
      ...draft.staff,
      {
        userId: available.id,
        assignment: "",
        callTime: draft.callTime,
        notes: "",
      },
    ]);
  }

  function addVehicle() {
    const selected = new Set(draft.vehicles.map((item) => item.vehicleId));
    const available = vehicles.find(
      (vehicle) => vehicle.active && !selected.has(vehicle.id),
    );
    if (!available) return;
    update("vehicles", [
      ...draft.vehicles,
      {
        vehicleId: available.id,
        driverUserId: "",
        destination: draft.address,
        departureTime: draft.departureTime,
        notes: "",
      },
    ]);
  }

  return (
    <div className={styles.editor}>
      <div className={styles.editorIntro}>
        <div>
          <p className="eyebrow">{draft.id ? "Edit event" : "Create event"}</p>
          <h2>{draft.title || "Untitled event"}</h2>
          <p>
            The crew will see this information in a simplified field brief.
          </p>
        </div>
        <span
          className={`status-pill status-${draft.status.toLowerCase()}`}
        >
          {draft.status}
        </span>
      </div>

      {error ? (
        <p className="error-message" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="success-message">
          <Check aria-hidden="true" /> Event saved. The crew schedule is current.
        </p>
      ) : null}

      <div className={styles.editorStack}>
        <EditorSection
          description="Name, date, address, and overall status."
          icon={<MapPin aria-hidden="true" />}
          title="Event details"
        >
          <div className="form-grid">
            <div className="field">
              <label htmlFor="event-title">Event name</label>
              <input
                className="input"
                id="event-title"
                value={draft.title}
                onChange={(event) => update("title", event.target.value)}
                placeholder="Wedding install, rehearsal dinner…"
              />
            </div>
            <div className="form-grid form-grid-2">
              <div className="field">
                <label htmlFor="event-date">Date</label>
                <input
                  className="input"
                  id="event-date"
                  type="date"
                  value={draft.eventDate}
                  onChange={(event) => update("eventDate", event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="event-status">Status</label>
                <select
                  className="select"
                  id="event-status"
                  value={draft.status}
                  onChange={(event) =>
                    update(
                      "status",
                      event.target.value as EventDraft["status"],
                    )
                  }
                >
                  <option value="DRAFT">Draft</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label htmlFor="event-address">Address</label>
              <input
                className="input"
                id="event-address"
                value={draft.address}
                onChange={(event) => update("address", event.target.value)}
                placeholder="Street address and access point"
              />
            </div>
          </div>
        </EditorSection>

        <EditorSection
          description="The three times that anchor the whole day."
          icon={<Clock3 aria-hidden="true" />}
          title="Crew times"
        >
          <div className="form-grid form-grid-3">
            <div className="field">
              <label htmlFor="call-time">Warehouse call</label>
              <ClockPicker
                id="call-time"
                value={draft.callTime}
                onChange={(value) => update("callTime", value)}
              />
            </div>
            <div className="field">
              <label htmlFor="departure-time">Warehouse departure</label>
              <ClockPicker
                id="departure-time"
                value={draft.departureTime}
                onChange={(value) => update("departureTime", value)}
              />
            </div>
            <div className="field">
              <label htmlFor="return-time">Expected return</label>
              <ClockPicker
                id="return-time"
                value={draft.returnTime}
                onChange={(value) => update("returnTime", value)}
              />
            </div>
          </div>
        </EditorSection>

        <EditorSection
          count={draft.timeline.length}
          description="A flexible, step-by-step order of operations."
          icon={<Clock3 aria-hidden="true" />}
          title="Timeline"
        >
          <div className={styles.rows}>
            {draft.timeline.map((entry, index) => (
              <div className={styles.formRow} key={entry.id ?? `timeline-${index}`}>
                <div className={styles.rowNumber}>{index + 1}</div>
                <div className={`form-grid ${styles.rowFields}`}>
                  <div className="form-grid form-grid-3">
                    <div className="field">
                      <label htmlFor={`timeline-time-${index}`}>Start time</label>
                      <input
                        className="input"
                        id={`timeline-time-${index}`}
                        type="time"
                        value={entry.time}
                        onChange={(event) => {
                          const next = [...draft.timeline];
                          next[index] = { ...entry, time: event.target.value };
                          update("timeline", next);
                        }}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`timeline-end-time-${index}`}>End time</label>
                      <input
                        className="input"
                        id={`timeline-end-time-${index}`}
                        type="time"
                        value={entry.endTime}
                        onChange={(event) => {
                          const next = [...draft.timeline];
                          next[index] = {
                            ...entry,
                            endTime: event.target.value,
                          };
                          update("timeline", next);
                        }}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`timeline-label-${index}`}>Step</label>
                      <input
                        className="input"
                        id={`timeline-label-${index}`}
                        value={entry.label}
                        onChange={(event) => {
                          const next = [...draft.timeline];
                          next[index] = { ...entry, label: event.target.value };
                          update("timeline", next);
                        }}
                        placeholder="Depart, install, strike…"
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor={`timeline-details-${index}`}>Instructions</label>
                    <input
                      className="input"
                      id={`timeline-details-${index}`}
                      value={entry.details}
                      onChange={(event) => {
                        const next = [...draft.timeline];
                        next[index] = { ...entry, details: event.target.value };
                        update("timeline", next);
                      }}
                      placeholder="What needs to happen at this time?"
                    />
                  </div>
                </div>
                <button
                  aria-label={`Delete timeline step ${index + 1}`}
                  className="icon-button"
                  onClick={() =>
                    update(
                      "timeline",
                      draft.timeline.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                  type="button"
                >
                  <X aria-hidden="true" />
                </button>
              </div>
            ))}
            {draft.timeline.length === 0 ? (
              <p className={styles.inlineEmpty}>No timeline steps yet.</p>
            ) : null}
          </div>
          <button className="button button-secondary" onClick={addTimeline} type="button">
            <Plus aria-hidden="true" /> Add timeline step
          </button>
        </EditorSection>

        <EditorSection
          count={draft.inventory.length}
          description="The exact quantities the crew must load."
          icon={<Box aria-hidden="true" />}
          title="Pack list"
        >
          {draft.id && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "-1.5rem", position: "relative", zIndex: 10 }}>
              <a href={`/print/packlist/${draft.id}`} target="_blank" className="button button-secondary" style={{ padding: "6px 12px", fontSize: "13px" }}>
                <FileText aria-hidden="true" style={{ width: 16, height: 16, marginRight: 6 }} />
                Export to PDF
              </a>
            </div>
          )}
          <div className="field" style={{ marginBottom: "1.5rem" }}>
            <label htmlFor="packer-user-id">Assigned Packer</label>
            <select
              className="input"
              id="packer-user-id"
              value={draft.packerUserId}
              onChange={(e) => update("packerUserId", e.target.value)}
            >
              <option value="">No specific packer assigned</option>
              {people
                .filter((p) => p.active || p.id === draft.packerUserId)
                .map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
            </select>
          </div>
          <div className={styles.rows}>
            {draft.inventory.map((entry, index) => {
              const selectedItem = inventory.find(
                (item) => item.id === entry.inventoryItemId,
              );
              const countFree = isCountFreePackItem(selectedItem?.name);

              return (
                <div className={styles.formRow} key={`pack-item-${index}`}>
                <div className={styles.rowNumber}>{index + 1}</div>
                <div className={`form-grid ${styles.rowFields}`}>
                  <div className="form-grid form-grid-2">
                    <div className="field">
                      <label htmlFor={`inventory-item-${index}`}>Inventory item</label>
                      <InventoryCombobox
                        id={`inventory-item-${index}`}
                        inventory={inventory}
                        value={entry.inventoryItemId}
                        selectedElsewhere={
                          new Set(
                            draft.inventory
                              .filter((_, itemIndex) => itemIndex !== index)
                              .map((selected) => selected.inventoryItemId),
                          )
                        }
                        onChange={(value) => {
                          const next = [...draft.inventory];
                          next[index] = {
                            ...entry,
                            inventoryItemId: value,
                            quantity: isCountFreePackItem(
                              inventory.find((item) => item.id === value)?.name,
                            )
                              ? 1
                              : entry.quantity,
                          };
                          update("inventory", next);
                        }}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`inventory-quantity-${index}`}>
                        Pack quantity
                      </label>
                      {countFree ? (
                        <input
                          className="input"
                          id={`inventory-quantity-${index}`}
                          readOnly
                          type="text"
                          value="No count needed"
                        />
                      ) : (
                        <input
                          className="input"
                          id={`inventory-quantity-${index}`}
                          min="1"
                          type="number"
                          value={entry.quantity}
                          onChange={(event) => {
                            const next = [...draft.inventory];
                            next[index] = {
                              ...entry,
                              quantity: Number(event.target.value),
                            };
                            update("inventory", next);
                          }}
                        />
                      )}
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor={`inventory-notes-${index}`}>Packing note</label>
                    <input
                      className="input"
                      id={`inventory-notes-${index}`}
                      value={entry.notes}
                      onChange={(event) => {
                        const next = [...draft.inventory];
                        next[index] = { ...entry, notes: event.target.value };
                        update("inventory", next);
                      }}
                      placeholder="Color, condition, loading position…"
                    />
                  </div>
                </div>
                <button
                  aria-label={`Delete pack item ${index + 1}`}
                  className="icon-button"
                  onClick={() =>
                    update(
                      "inventory",
                      draft.inventory.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                  type="button"
                >
                  <X aria-hidden="true" />
                </button>
                </div>
              );
            })}
            {draft.inventory.length === 0 ? (
              <p className={styles.inlineEmpty}>No items on the pack list yet.</p>
            ) : null}
          </div>
          <button className="button button-secondary" onClick={addInventory} type="button">
            <Plus aria-hidden="true" /> Add inventory item
          </button>
        </EditorSection>

        <EditorSection
          count={draft.staff.length}
          description="Who is working, their job, and their call time."
          icon={<UsersRound aria-hidden="true" />}
          title="Staff"
        >
          <div className={styles.rows}>
            {draft.staff.map((entry, index) => (
              <div className={styles.formRow} key={`${entry.userId}-${index}`}>
                <div className={styles.rowNumber}>{index + 1}</div>
                <div className={`form-grid ${styles.rowFields}`}>
                  <div className="form-grid form-grid-3">
                    <div className="field">
                      <label htmlFor={`staff-person-${index}`}>Person</label>
                      <select
                        className="select"
                        id={`staff-person-${index}`}
                        value={entry.userId}
                        onChange={(event) => {
                          const next = [...draft.staff];
                          next[index] = { ...entry, userId: event.target.value };
                          update("staff", next);
                        }}
                      >
                        {people
                          .filter(
                            (person) =>
                              person.id === entry.userId ||
                              !draft.staff.some(
                                (selected) => selected.userId === person.id,
                              ),
                          )
                          .map((person) => (
                            <option key={person.id} value={person.id}>
                              {person.name}
                              {person.active ? "" : " · Inactive"}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor={`staff-assignment-${index}`}>Assignment</label>
                      <input
                        className="input"
                        id={`staff-assignment-${index}`}
                        value={entry.assignment}
                        onChange={(event) => {
                          const next = [...draft.staff];
                          next[index] = {
                            ...entry,
                            assignment: event.target.value,
                          };
                          update("staff", next);
                        }}
                        placeholder="Site lead, tent crew…"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`staff-time-${index}`}>Call time</label>
                      <input
                        className="input"
                        id={`staff-time-${index}`}
                        type="time"
                        value={entry.callTime}
                        onChange={(event) => {
                          const next = [...draft.staff];
                          next[index] = { ...entry, callTime: event.target.value };
                          update("staff", next);
                        }}
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor={`staff-notes-${index}`}>Personal instruction</label>
                    <input
                      className="input"
                      id={`staff-notes-${index}`}
                      value={entry.notes}
                      onChange={(event) => {
                        const next = [...draft.staff];
                        next[index] = { ...entry, notes: event.target.value };
                        update("staff", next);
                      }}
                      placeholder="Keys, tools, special responsibility…"
                    />
                  </div>
                </div>
                <button
                  aria-label={`Delete staff assignment ${index + 1}`}
                  className="icon-button"
                  onClick={() =>
                    update(
                      "staff",
                      draft.staff.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                  type="button"
                >
                  <X aria-hidden="true" />
                </button>
              </div>
            ))}
            {draft.staff.length === 0 ? (
              <p className={styles.inlineEmpty}>No crew assigned yet.</p>
            ) : null}
          </div>
          <button className="button button-secondary" onClick={addStaff} type="button">
            <Plus aria-hidden="true" /> Assign crew member
          </button>
        </EditorSection>

        <EditorSection
          count={draft.vehicles.length}
          description="Vehicle, driver, departure, destination, and load notes."
          icon={<Truck aria-hidden="true" />}
          title="Vehicles"
        >
          <div className={styles.rows}>
            {draft.vehicles.map((entry, index) => (
              <div className={styles.formRow} key={`${entry.vehicleId}-${index}`}>
                <div className={styles.rowNumber}>{index + 1}</div>
                <div className={`form-grid ${styles.rowFields}`}>
                  <div className="form-grid form-grid-3">
                    <div className="field">
                      <label htmlFor={`vehicle-${index}`}>Vehicle</label>
                      <select
                        className="select"
                        id={`vehicle-${index}`}
                        value={entry.vehicleId}
                        onChange={(event) => {
                          const next = [...draft.vehicles];
                          next[index] = { ...entry, vehicleId: event.target.value };
                          update("vehicles", next);
                        }}
                      >
                        {vehicles
                          .filter(
                            (vehicle) =>
                              vehicle.id === entry.vehicleId ||
                              !draft.vehicles.some(
                                (selected) => selected.vehicleId === vehicle.id,
                              ),
                          )
                          .map((vehicle) => (
                            <option key={vehicle.id} value={vehicle.id}>
                              {vehicle.name}
                              {vehicle.active ? "" : " · Archived"}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor={`vehicle-driver-${index}`}>Driver</label>
                      <select
                        className="select"
                        id={`vehicle-driver-${index}`}
                        value={entry.driverUserId}
                        onChange={(event) => {
                          const next = [...draft.vehicles];
                          next[index] = {
                            ...entry,
                            driverUserId: event.target.value,
                          };
                          update("vehicles", next);
                        }}
                      >
                        <option value="">Not assigned</option>
                        {people
                          .filter((person) => person.active || person.id === entry.driverUserId)
                          .map((person) => (
                            <option key={person.id} value={person.id}>
                              {person.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor={`vehicle-time-${index}`}>Departure</label>
                      <input
                        className="input"
                        id={`vehicle-time-${index}`}
                        type="time"
                        value={entry.departureTime}
                        onChange={(event) => {
                          const next = [...draft.vehicles];
                          next[index] = {
                            ...entry,
                            departureTime: event.target.value,
                          };
                          update("vehicles", next);
                        }}
                      />
                    </div>
                  </div>
                  <div className="form-grid form-grid-2">
                    <div className="field">
                      <label htmlFor={`vehicle-destination-${index}`}>Destination</label>
                      <input
                        className="input"
                        id={`vehicle-destination-${index}`}
                        value={entry.destination}
                        onChange={(event) => {
                          const next = [...draft.vehicles];
                          next[index] = {
                            ...entry,
                            destination: event.target.value,
                          };
                          update("vehicles", next);
                        }}
                        placeholder="Address, gate, or drop point"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`vehicle-notes-${index}`}>Vehicle note</label>
                      <input
                        className="input"
                        id={`vehicle-notes-${index}`}
                        value={entry.notes}
                        onChange={(event) => {
                          const next = [...draft.vehicles];
                          next[index] = { ...entry, notes: event.target.value };
                          update("vehicles", next);
                        }}
                        placeholder="What is loaded in this vehicle?"
                      />
                    </div>
                  </div>
                </div>
                <button
                  aria-label={`Delete vehicle assignment ${index + 1}`}
                  className="icon-button"
                  onClick={() =>
                    update(
                      "vehicles",
                      draft.vehicles.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                  type="button"
                >
                  <X aria-hidden="true" />
                </button>
              </div>
            ))}
            {draft.vehicles.length === 0 ? (
              <p className={styles.inlineEmpty}>No vehicles assigned yet.</p>
            ) : null}
          </div>
          <button className="button button-secondary" onClick={addVehicle} type="button">
            <Plus aria-hidden="true" /> Assign vehicle
          </button>
        </EditorSection>

        <EditorSection
          description="Put the highest-priority crew instruction first."
          icon={<FileText aria-hidden="true" />}
          title="Crew brief and notes"
        >
          <div className="form-grid form-grid-2">
            <div className="field">
              <label htmlFor="staff-brief">Read this first</label>
              <textarea
                className="textarea"
                id="staff-brief"
                value={draft.staffBrief}
                onChange={(event) => update("staffBrief", event.target.value)}
                placeholder="The one instruction nobody can miss."
              />
            </div>
            <div className="field">
              <label htmlFor="event-notes">Additional notes</label>
              <textarea
                className="textarea"
                id="event-notes"
                value={draft.notes}
                onChange={(event) => update("notes", event.target.value)}
                placeholder="Access, weather, client requests, site restrictions…"
              />
            </div>
          </div>
        </EditorSection>
      </div>

      <div className={styles.saveBar}>
        {draft.id ? (
          <button
            className="button button-danger"
            disabled={pending}
            onClick={deleteEvent}
            type="button"
          >
            <Trash2 aria-hidden="true" /> Delete event
          </button>
        ) : (
          <span />
        )}
        <button
          className="button button-primary"
          disabled={pending}
          onClick={saveEvent}
          type="button"
        >
          <Save aria-hidden="true" />
          {pending ? "Saving event…" : draft.id ? "Save changes" : "Create event"}
        </button>
      </div>
    </div>
  );
}
