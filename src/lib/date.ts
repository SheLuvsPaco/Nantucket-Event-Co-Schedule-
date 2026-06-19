import { format, isValid, parse } from "date-fns";

export function getTodayKey(timeZone: string, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function parseDateKey(dateKey: string) {
  return parse(dateKey, "yyyy-MM-dd", new Date());
}

export function isDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseDateKey(value));
}

export function formatDateKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function formatLongDate(dateKey: string) {
  return format(parseDateKey(dateKey), "EEEE, MMMM d");
}

export function formatShortDate(dateKey: string) {
  return format(parseDateKey(dateKey), "EEE, MMM d");
}

export function formatTime(time: string | null | undefined) {
  if (!time) return "Time TBD";
  const [hours, minutes] = time.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function monthKeyFromDate(dateKey: string) {
  return dateKey.slice(0, 7);
}
