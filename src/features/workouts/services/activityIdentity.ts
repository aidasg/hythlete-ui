import { Activity, Bike, Dumbbell, Footprints, MountainSnow, PersonStanding, Waves, type LucideIcon } from 'lucide-react';
import type { WorkoutCatalogResponse } from './workoutApi';

export type ActivityCatalog = NonNullable<WorkoutCatalogResponse['activities']>;
const familyIcons: Record<string, LucideIcon> = {
  cycling: Bike, e_biking: Bike,
  running: Footprints, walking: Footprints, hiking: Footprints,
  skating: PersonStanding, inline_skating: PersonStanding, ice_skating: PersonStanding,
  swimming: Waves, rowing: Waves, paddling: Waves, kayaking: Waves, rafting: Waves,
  stand_up_paddleboarding: Waves, surfing: Waves, wakeboarding: Waves, water_skiing: Waves,
  windsurfing: Waves, kitesurfing: Waves,
  strength_training: Dumbbell,
  cross_country_skiing: MountainSnow, alpine_skiing: MountainSnow,
  snowboarding: MountainSnow, snowshoeing: MountainSnow,
};

export function resolveActivityIdentity(code: string | undefined, activities: ActivityCatalog = []) {
  const activityCode = code?.trim() || '';
  const definition = activities.find((item) => item.code === activityCode);
  const name = definition?.name || (activityCode
    ? activityCode.replace(/[_-]+/g, ' ').replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
    : 'Unspecified activity');
  const visited = new Set<string>();
  let current = activityCode;
  while (current && !visited.has(current)) {
    visited.add(current);
    const Icon = familyIcons[current];
    if (Icon) return { name, Icon };
    const parent = activities.find((item) => item.code === current)?.parent_code;
    if (!parent) break;
    current = parent;
  }
  // Keep familiar variants recognizable while the catalog is loading or unavailable.
  const family = Object.keys(familyIcons).find((key) => activityCode.endsWith(`_${key}`));
  const Icon = family ? familyIcons[family] || Activity : definition?.training_category === 'strength' ? Dumbbell : Activity;
  return { name, Icon };
}
