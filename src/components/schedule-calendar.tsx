"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parse,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatDateKey } from "@/lib/date";
import type { CalendarEvent } from "@/types";
import styles from "./schedule-calendar.module.css";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ScheduleCalendar({
  basePath = "/app/schedule",
  events,
  itemNoun = "events",
  monthKey,
  querySuffix = "",
  todayKey,
}: {
  basePath?: string;
  events: CalendarEvent[];
  itemNoun?: string;
  monthKey: string;
  querySuffix?: string;
  todayKey: string;
}) {
  const router = useRouter();
  const monthDate = parse(monthKey, "yyyy-MM", new Date());
  const start = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start, end });
  const eventsByDay = new Map<string, CalendarEvent[]>();

  for (const event of events) {
    const dayEvents = eventsByDay.get(event.eventDate) ?? [];
    dayEvents.push(event);
    eventsByDay.set(event.eventDate, dayEvents);
  }

  function goToMonth(date: Date) {
    router.push(`${basePath}?month=${format(date, "yyyy-MM")}`);
  }

  return (
    <section className={styles.calendar} aria-label={`${itemNoun} calendar`}>
      <div className={styles.toolbar}>
        <h2 className={styles.monthTitle}>
          {format(monthDate, "MMMM yyyy")}
        </h2>
        <div className={styles.controls}>
          <button
            aria-label="Previous month"
            className="icon-button"
            onClick={() => goToMonth(subMonths(monthDate, 1))}
            type="button"
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <button
            aria-label="Next month"
            className="icon-button"
            onClick={() => goToMonth(addMonths(monthDate, 1))}
            type="button"
          >
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className={styles.weekdays} aria-hidden="true">
        {weekdays.map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>

      <div className={styles.grid}>
        {days.map((day) => {
          const dateKey = formatDateKey(day);
          const dayEvents = eventsByDay.get(dateKey) ?? [];
          const isToday = dateKey === todayKey;
          const outside = !isSameMonth(day, monthDate);

          return (
            <Link
              aria-label={`${format(day, "EEEE, MMMM d")}, ${dayEvents.length} ${itemNoun}`}
              className={styles.day}
              data-outside={outside}
              data-today={isToday}
              href={`${basePath}/${dateKey}${querySuffix}`}
              key={dateKey}
            >
              <span className={styles.dateNumber}>{format(day, "d")}</span>
              <span className={styles.mobileDots} aria-hidden="true">
                {dayEvents.slice(0, 3).map((event) => (
                  <i
                    data-business={event.business.toLowerCase()}
                    data-status={event.status.toLowerCase()}
                    key={event.id}
                  />
                ))}
              </span>
              <span className={styles.events}>
                {dayEvents.slice(0, 3).map((event) => (
                  <span
                    className={styles.event}
                    data-business={event.business.toLowerCase()}
                    data-status={event.status.toLowerCase()}
                    key={event.id}
                  >
                    <strong>{event.callTime || "TBD"}</strong>
                    <span>{event.title}</span>
                  </span>
                ))}
                {dayEvents.length > 3 ? (
                  <span className={styles.more}>+{dayEvents.length - 3} more</span>
                ) : null}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
