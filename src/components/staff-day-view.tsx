import Link from "next/link";
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
import type { ScheduleEvent } from "@/types";
import styles from "./staff-day-view.module.css";

export function StaffDayView({
  backHref,
  date,
  events,
  sessionUserId,
}: {
  backHref: string;
  date: string;
  events: ScheduleEvent[];
  sessionUserId: string;
}) {
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

      {events.length === 0 ? (
        <div className={`panel empty-state ${styles.empty}`}>
          <div>
            <CalendarX2 aria-hidden="true" />
            <h2>No work scheduled</h2>
            <p className="muted">There are no events on this date.</p>
          </div>
        </div>
      ) : (
        <div className={styles.eventList}>
          {events.map((event, eventIndex) => (
            <article className={styles.event} key={event.id}>
              <header className={styles.eventHeader}>
                <div>
                  <p className={styles.eventNumber}>Job {eventIndex + 1}</p>
                  <p className={styles.callLabel}>Crew call</p>
                  <p className={styles.callTime}>{formatTime(event.callTime)}</p>
                </div>
                <div className={styles.eventTitle}>
                  <span
                    className={`status-pill status-${event.status.toLowerCase()}`}
                  >
                    {event.status}
                  </span>
                  <h2>{event.title}</h2>
                  {event.venue || event.address ? (
                    <p>
                      <MapPin aria-hidden="true" />
                      <span>
                        {event.venue ? <strong>{event.venue}</strong> : null}
                        {event.address ? <span>{event.address}</span> : null}
                      </span>
                    </p>
                  ) : null}
                </div>
              </header>

              {event.staffBrief ? (
                <section className={styles.brief}>
                  <AlertTriangle aria-hidden="true" />
                  <div>
                    <h3>Read this first</h3>
                    <p>{event.staffBrief}</p>
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
                          <time>{formatTime(entry.time)}</time>
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
                        const shortage =
                          entry.item && entry.quantity > entry.item.quantity;
                        return (
                          <div
                            className={styles.packItem}
                            data-shortage={shortage}
                            key={entry.inventoryItemId}
                          >
                            <span className={styles.quantity}>{entry.quantity}</span>
                            <div>
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
                          <span className={styles.crewInitial}>
                            {assignment.user?.name.charAt(0)}
                          </span>
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

                {event.notes ? (
                  <section className={`${styles.section} ${styles.notes}`}>
                    <div className={styles.sectionHeading}>
                      <StickyNote aria-hidden="true" />
                      <div>
                        <p>Final details</p>
                        <h3>Notes</h3>
                      </div>
                    </div>
                    <p>{event.notes}</p>
                  </section>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
