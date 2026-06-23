"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Box,
  CalendarX2,
  Clock3,
  MapPin,
  StickyNote,
  Truck,
  UsersRound,
} from "lucide-react";
import { formatLongDate, formatTime } from "@/lib/date";
import {
  getStaffCardStart,
  sortStaffDayEvents,
} from "@/lib/schedule-order";
import { isCountFreePackItem } from "@/lib/pack-list";
import type { ScheduleEvent } from "@/types";
import { PackItemCheckbox } from "./pack-item-checkbox";
import { UserAvatar } from "./user-avatar";
import styles from "./staff-day-view.module.css";

function subscribeToClientState() {
  return () => {};
}

export function StaffDayView({
  backHref,
  date,
  emptyDescription = "There are no events on this date.",
  emptyTitle = "No work scheduled",
  events,
  sessionUserId,
}: {
  backHref: string;
  date: string;
  emptyDescription?: string;
  emptyTitle?: string;
  events: ScheduleEvent[];
  sessionUserId: string;
}) {
  const isClient = useSyncExternalStore(
    subscribeToClientState,
    () => true,
    () => false,
  );
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const orderedEvents = sortStaffDayEvents(events);

  let activeEventIndex = 0;
  const isToday = new Date().toISOString().split("T")[0] === date;
  if (isToday) {
    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    for (let i = 0; i < orderedEvents.length; i++) {
      const cardStart = getStaffCardStart(orderedEvents[i]);
      if (cardStart.time) {
        const [hh, mm] = cardStart.time.split(":");
        const eventMinutes = parseInt(hh, 10) * 60 + parseInt(mm, 10);
        if (currentMinutes >= eventMinutes) {
          activeEventIndex = i;
        } else {
          break;
        }
      }
    }
  } else if (new Date(date) < new Date()) {
    // Past day, focus on the last event
    activeEventIndex = orderedEvents.length - 1;
  }

  return (
    <div className={`page-shell ${styles.page}`}>
      <div className={styles.header}>
        <Link className="back-link" href={backHref}>
          <ArrowLeft aria-hidden="true" />
          Calendar
        </Link>
        <p className="eyebrow">Your field brief</p>
        <h1>{formatLongDate(date)}</h1>
        <p className={styles.headerInstruction}>
          Read every section before leaving the warehouse.
        </p>
      </div>

      {orderedEvents.length === 0 ? (
        <div className={`panel empty-state ${styles.empty}`}>
          <div>
            <CalendarX2 aria-hidden="true" />
            <h2>{emptyTitle}</h2>
            <p className="muted">{emptyDescription}</p>
          </div>
        </div>
      ) : (
        <div className={styles.eventList}>
          {orderedEvents.map((event, eventIndex) => {
            const cardStart = getStaffCardStart(event);
            const displayVenue =
              event.venue?.trim().toLowerCase() ===
              event.title.trim().toLowerCase()
                ? null
                : event.venue;

            const isFocus = eventIndex === activeEventIndex;

            let cardClass = styles.event;
            if (isClient && isFocus) {
              cardClass += ` ${styles.eventFocus}`;
            }

            const cardBody = (
              <>
                {event.staffBrief ? (
                  <section className={styles.brief}>
                    <AlertTriangle aria-hidden="true" />
                    <div>
                      <h3>Read this first</h3>
                      <p>{event.staffBrief}</p>
                    </div>
                  </section>
                ) : null}

                {event.notes ? (
                  <section className={styles.jobInstructions}>
                    <StickyNote aria-hidden="true" />
                    <div>
                      <p>Read before starting</p>
                      <h3>Job instructions</h3>
                      <div>{event.notes}</div>
                    </div>
                  </section>
                ) : null}

                <div className={styles.sections}>
                <section className={styles.section}>
                  <div className={styles.sectionHeading}>
                    <Clock3 aria-hidden="true" />
                    <div>
                      <p>Order of the day</p>
                      <h3>Timeline</h3>
                    </div>
                  </div>
                  {event.timeline.length ? (
                    <ol className={styles.timeline}>
                      {event.timeline.map((entry) => (
                        <li key={entry.id}>
                          <time>
                            <span>{formatTime(entry.time)}</span>
                            {entry.endTime ? (
                              <small>to {formatTime(entry.endTime)}</small>
                            ) : null}
                          </time>
                          <div>
                            <strong>{entry.label}</strong>
                            {entry.details ? <p>{entry.details}</p> : null}
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className={styles.missing}>No timeline added yet.</p>
                  )}
                </section>

                <section className={styles.section}>
                  <div className={styles.sectionHeading}>
                    <Truck aria-hidden="true" />
                    <div>
                      <p>What to drive</p>
                      <h3>Vehicles</h3>
                    </div>
                  </div>
                  {event.vehicles.length ? (
                    <div className={styles.vehicleList}>
                      {event.vehicles.map((assignment) => (
                        <div className={styles.vehicle} key={assignment.vehicleId}>
                          <div className={styles.vehicleTop}>
                            <strong>{assignment.vehicle?.name}</strong>
                            <span>
                              {formatTime(
                                assignment.departureTime ?? event.departureTime,
                              )}
                            </span>
                          </div>
                          <dl>
                            <div>
                              <dt>Driver</dt>
                              <dd>{assignment.driver?.name ?? "Not assigned"}</dd>
                            </div>
                            <div>
                              <dt>Going to</dt>
                              <dd>
                                {assignment.destination ??
                                  event.address ??
                                  "See site lead"}
                              </dd>
                            </div>
                          </dl>
                          {assignment.notes ? <p>{assignment.notes}</p> : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={styles.missing}>No vehicles assigned yet.</p>
                  )}
                </section>

                <section className={`${styles.section} ${styles.packSection}`}>
                  <div className={styles.sectionHeading}>
                    <Box aria-hidden="true" />
                    <div>
                      <p>Load every item</p>
                      <h3>Pack list</h3>
                    </div>
                  </div>
                  {event.inventory.length ? (
                    <div className={styles.packList}>
                      {event.inventory.map((entry) => {
                        const countFree = isCountFreePackItem(entry.item?.name);
                        const shortage =
                          !countFree &&
                          entry.item &&
                          entry.quantity > entry.item.quantity;
                        return (
                          <div
                            className={styles.packItem}
                            data-shortage={shortage}
                            key={entry.inventoryItemId}
                            style={{ display: "flex", alignItems: "flex-start", opacity: entry.packed ? 0.5 : 1 }}
                          >
                            <PackItemCheckbox
                              eventId={event.id}
                              inventoryItemId={entry.inventoryItemId}
                              initialPacked={entry.packed}
                            />
                            {countFree ? null : (
                              <span
                                className={styles.quantity}
                                style={{ marginTop: "0.125rem" }}
                              >
                                {entry.quantity}
                              </span>
                            )}
                            <div style={{ textDecoration: entry.packed ? "line-through" : "none" }}>
                              <strong>{entry.item?.name}</strong>
                              <span>
                                {entry.item?.size || entry.item?.category || "Item"}
                              </span>
                              {entry.notes ? <p>{entry.notes}</p> : null}
                              {shortage ? (
                                <p className={styles.shortage}>
                                  Inventory shows only {entry.item?.quantity} available.
                                </p>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className={styles.missing}>No packing list added yet.</p>
                  )}
                </section>

                <section className={styles.section}>
                  <div className={styles.sectionHeading}>
                    <UsersRound aria-hidden="true" />
                    <div>
                      <p>Who is working</p>
                      <h3>Crew</h3>
                    </div>
                  </div>
                  {event.staff.length ? (
                    <div className={styles.crewList}>
                      {event.staff.map((assignment) => (
                        <div
                          className={styles.crew}
                          data-current={assignment.userId === sessionUserId}
                          key={assignment.userId}
                        >
                          <UserAvatar
                            avatarUrl={assignment.user?.avatarUrl}
                            className={styles.crewAvatar}
                            name={assignment.user?.name ?? "Crew member"}
                          />
                          <div>
                            <strong>
                              {assignment.user?.name}
                              {assignment.userId === sessionUserId ? " — You" : ""}
                            </strong>
                            <span>
                              {assignment.assignment || "Crew"} ·{" "}
                              {formatTime(assignment.callTime ?? event.callTime)}
                            </span>
                            {assignment.notes ? <p>{assignment.notes}</p> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={styles.missing}>Crew has not been assigned yet.</p>
                  )}
                </section>

              </div>
              </>
            );

            return (
            <article className={cardClass} key={event.id}>
              <header className={styles.eventHeader}>
                <div className={styles.eventStart}>
                  <p className={styles.eventNumber}>Job {eventIndex + 1}</p>
                  <p className={styles.callLabel}>{cardStart.label}</p>
                  <p className={styles.callTime}>{formatTime(cardStart.time)}</p>
                </div>
                <div className={styles.eventTitle}>
                  <span
                    className={`status-pill status-${event.status.toLowerCase()}`}
                  >
                    {event.status}
                  </span>
                  <h2>{event.title}</h2>
                  {displayVenue || event.address ? (
                    <p>
                      <MapPin aria-hidden="true" />
                      <span>
                        {displayVenue ? <strong>{displayVenue}</strong> : null}
                        {event.address ? <span>{event.address}</span> : null}
                      </span>
                    </p>
                  ) : null}
                </div>
              </header>

              <div className={styles.focusBody}>
                {cardBody}
              </div>
            </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
