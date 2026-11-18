import type { WeightUnit } from '@/services/units';
import type { ExerciseSetRequest, WorkoutCatalogResponse } from './workoutApi';
import type { SessionBlock } from './sessionStructure';

export type CountingConvention = NonNullable<ExerciseSetRequest['counting_convention']>;

export type ExerciseLoadProfile = NonNullable<ExerciseSetRequest['load_profile']>;
export function weightLabel(c?: CountingConvention, profile?: ExerciseLoadProfile, unit: WeightUnit = 'kg') {
  if ((profile?.bodyweight || (profile?.bodyweight_fraction || 0)>0)) return `${profile?.additional_weight_required ? 'Added weight' : 'Added weight (optional)'}${c?.weight_basis === 'per_hand' ? ` per hand (${unit})` : ` (${unit})`}`;
  return c?.weight_basis === 'per_hand' ? `Weight per hand (${unit})` : c ? `Total weight (${unit})` : `Load (${unit}, optional)`;
}
export function repsLabel(c?: CountingConvention) {
  return c?.reps_basis === 'per_side' ? `Reps per ${c.side || 'side'}` : c?.weight_basis === 'per_hand' && c.weights_moved === 2 && c.movement === 'simultaneous' ? 'Paired reps' : 'Reps';
}
export function weightUnit(c?: CountingConvention, unit: WeightUnit = 'kg') { return c?.weight_basis === 'per_hand' ? `${unit} per hand` : unit; }
export function repsUnit(c?: CountingConvention) { return c?.reps_basis === 'per_side' ? `reps per ${c.side || 'side'}` : c?.weight_basis === 'per_hand' && c.weights_moved === 2 && c.movement === 'simultaneous' ? 'paired reps' : 'reps'; }
export function setConvention(set: ExerciseSetRequest): CountingConvention | undefined {
  return set.counting_version === set.counting_convention?.version ? set.counting_convention : undefined;
}
export function externalVolume(set: ExerciseSetRequest): number | undefined {
  const c = setConvention(set);
  if (!c || set.load_kg == null || !set.reps) return;
  const weights = c.weight_basis === 'per_hand' ? c.weights_moved || 1 : 1;
  const sides = c.reps_basis === 'per_side' && c.movement === 'alternating' ? 2 : 1;
  return Math.round(set.load_kg * weights * set.reps * sides * 100) / 100;
}
export function applySetConvention(set: ExerciseSetRequest, convention?: CountingConvention): ExerciseSetRequest {
  return { ...set, counting_version: convention?.version, counting_convention: convention, external_volume_kg_reps: undefined, workload: undefined };
}
export function applyCatalogCounting(blocks: SessionBlock[], catalog: WorkoutCatalogResponse): SessionBlock[] {
  return blocks.map(b => ({ ...b, movements: b.movements?.map(m => {
    const c = catalog.exercises?.find(e => e.code === m.exercise_code)?.counting_convention;
    return c ? { ...m, sets: m.sets?.map(s => ({ ...applySetConvention(s, c), load_profile: catalog.exercises?.find(e => e.code === m.exercise_code)?.load_profile })) } : m;
  }) }));
}
