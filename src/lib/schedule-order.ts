import type { ScheduleEvent } from "@/types";

function isVisitEvent(event: ScheduleEvent) {
  const searchableText = [
    event.title,
    event.notes,
    ...event.timeline.map((entry) => entry.label),
  ]
    .join(" ")
    .toLowerCase();

  return /\bvisits?\b/.test(searchableText);
}

function firstTaskTime(event: ScheduleEvent) {
  return event.timeline.find((entry) => entry.time)?.time ?? "99:99";
}

export function sortStaffDayEvents(dayEvents: ScheduleEvent[]) {
  return dayEvents.toSorted((left, right) => {
    const leftRank = isVisitEvent(left) ? 2 : left.callTime ? 0 : 1;
    const rightRank = isVisitEvent(right) ? 2 : right.callTime ? 0 : 1;

    if (leftRank !== rightRank) return leftRank - rightRank;

    const callOrder = (left.callTime ?? "99:99").localeCompare(
      right.callTime ?? "99:99",
    );
    if (callOrder !== 0) return callOrder;

    const timeOrder = firstTaskTime(left).localeCompare(firstTaskTime(right));
    if (timeOrder !== 0) return timeOrder;

    return left.title.localeCompare(right.title);
  });
}

export function getStaffCardStart(event: ScheduleEvent) {
  if (event.callTime) {
    return { label: "Warehouse call", time: event.callTime };
  }

  return {
    label: isVisitEvent(event) ? "First visit" : "First task",
    time: event.timeline.find((entry) => entry.time)?.time ?? null,
  };
}
