import type {
  CalendarReadinessEntryRequest,
  CalendarReadinessEntryResponse,
} from "@/features/workouts/services/calendarReadinessApi";
import type { TrainingStateBand } from "@/features/workouts/services/trainingStateDisplay";

export type CalendarReadinessKind = "injury" | "limiter";
export type CalendarReadinessEntityType = "muscle" | "tissue";
export type CalendarReadinessBand = "none" | "loaded" | "caution" | "avoid";

export const calendarReadinessKinds: CalendarReadinessKind[] = [
  "injury",
  "limiter",
];

export const calendarReadinessEntityTypes: CalendarReadinessEntityType[] = [
  "muscle",
  "tissue",
];

export function clampMagnitude(value: number | string | undefined) {
  const numericValue =
    typeof value === "string" ? Number(value) : typeof value === "number" ? value : 0;

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(numericValue)));
}

export function getCalendarReadinessBand(
  magnitude: number | string | undefined
): CalendarReadinessBand {
  const value = clampMagnitude(magnitude);

  if (value === 0) {
    return "none";
  }

  if (value <= 39) {
    return "loaded";
  }

  if (value <= 69) {
    return "caution";
  }

  return "avoid";
}

export function getCalendarReadinessCssBand(
  magnitude: number | string | undefined
): TrainingStateBand {
  const band = getCalendarReadinessBand(magnitude);

  return band === "none" ? "unknown" : band;
}

export function getCalendarReadinessBandLabel(
  magnitude: number | string | undefined
) {
  switch (getCalendarReadinessBand(magnitude)) {
    case "loaded":
      return "Loaded";
    case "caution":
      return "Caution";
    case "avoid":
      return "Avoid";
    default:
      return "No issues";
  }
}

export function formatCalendarReadinessValue(value: string | undefined) {
  if (!value) {
    return null;
  }

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getCalendarReadinessEntryKey(
  entry: CalendarReadinessEntryRequest | CalendarReadinessEntryResponse
) {
  return [
    entry.date || "unknown",
    entry.kind || "unknown",
    entry.entity_type || "unknown",
    entry.entity_id || "unknown",
  ].join(":");
}

export function sortCalendarReadinessEntries<
  Entry extends CalendarReadinessEntryRequest | CalendarReadinessEntryResponse,
>(entries: Entry[]) {
  return [...entries].sort(
    (left, right) =>
      clampMagnitude(right.magnitude) - clampMagnitude(left.magnitude)
  );
}

export function isCalendarReadinessKind(
  value: string | undefined
): value is CalendarReadinessKind {
  return value === "injury" || value === "limiter";
}

export function isCalendarReadinessEntityType(
  value: string | undefined
): value is CalendarReadinessEntityType {
  return value === "muscle" || value === "tissue";
}

export function isActiveCalendarReadinessEntry(
  entry: CalendarReadinessEntryRequest | CalendarReadinessEntryResponse
) {
  return clampMagnitude(entry.magnitude) > 0;
}
