import { getMappedPathKeysForBackendEntity } from "@/features/dashboard/components/bodyStateMapping";
import {
  formatCalendarReadinessValue,
  type CalendarReadinessEntityType,
} from "@/features/workouts/services/calendarReadiness";
import type { WorkoutCatalogResponse } from "@/features/workouts/services/workoutApi";

export type CalendarReadinessTarget = {
  entityType: CalendarReadinessEntityType;
  id: string;
  label: string;
  meta: string;
  pathKeys: string[];
};

export function formatCalendarReadinessTargetFallback(
  entityId: string | undefined
) {
  return formatCalendarReadinessValue(entityId) || entityId || "Target";
}

export function buildCalendarReadinessTargets(
  catalog: WorkoutCatalogResponse | null
): CalendarReadinessTarget[] {
  const muscles =
    catalog?.muscles?.flatMap((muscle) => {
      if (!muscle.code) {
        return [];
      }

      return [
        {
          entityType: "muscle" as const,
          id: muscle.code,
          label:
            muscle.name || formatCalendarReadinessTargetFallback(muscle.code),
          meta: [muscle.group_name, muscle.region].filter(Boolean).join(" / "),
          pathKeys: getMappedPathKeysForBackendEntity(muscle.code, "muscle"),
        },
      ];
    }) || [];
  const tissues =
    catalog?.tissue_regions?.flatMap((tissue) => {
      if (!tissue.code) {
        return [];
      }

      return [
        {
          entityType: "tissue" as const,
          id: tissue.code,
          label:
            tissue.name || formatCalendarReadinessTargetFallback(tissue.code),
          meta: "Tissue region",
          pathKeys: getMappedPathKeysForBackendEntity(tissue.code, "tissue"),
        },
      ];
    }) || [];

  return [...muscles, ...tissues].sort((left, right) =>
    left.label.localeCompare(right.label)
  );
}
