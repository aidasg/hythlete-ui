import type { WorkoutRequest, WorkoutCatalogResponse, WorkoutComponentRequest, ExerciseSetRequest } from './workoutApi';
import type { SessionBlock, SessionMovement } from './sessionStructure';

export type BuilderActivity = NonNullable<WorkoutCatalogResponse['activities']>[number];
export type BuilderDraft = {
  workout: WorkoutRequest;
  original?: WorkoutRequest;
  legacy: boolean;
  quick: boolean;
  quickDistanceM?: number;
  log: boolean;
  blocks: SessionBlock[];
};
export const newID = () => crypto.randomUUID();
export const purposes = [['training', 'General training'], ['recovery', 'Recovery'], ['skill', 'Skill practice'], ['benchmark', 'Benchmark'], ['competition', 'Competition']] as const;
export const displayName = (value?: string) => ({ vo2max: 'VO2 max', vo2: 'VO2 max', amrap: 'AMRAP', emom: 'EMOM', hiit: 'HIIT', seconds_per_km: 'seconds / km', seconds_per_100m: 'seconds / 100 m' }[value || ''] || (value || '').replace(/_/g, ' ').replace(/^./, s => s.toUpperCase()));
export function activityCategory(a?: BuilderActivity, purpose?: string) {
  const overrides: Record<string, string> = { recovery: 'recovery', skill: 'skill_technical', benchmark: 'test_benchmark', competition: 'competition_event' };
  return overrides[purpose || ''] || ({ strength: 'strength', strength_endurance: 'mixed', mixed: 'mixed', mobility: 'mobility_durability' }[a?.training_category || ''] || 'endurance');
}
export function movementSets(m: SessionMovement): ExerciseSetRequest[] {
  return m.sets?.length ? m.sets : [{ set_order: 1, reps: m.reps || undefined, load_kg: m.load_kg || undefined, duration_seconds: m.duration_seconds || undefined, distance_m: m.distance_m || undefined }];
}
export function upgradeBlock(b: SessionBlock): SessionBlock {
  return { ...b, completion: b.completion || (b.format === 'straight_sets' ? 'manual' : 'time'), movements: b.movements?.map(m => ({ ...m, intensity_zone: m.intensity_zone || (!b.completion && !m.exercise_code ? "easy" : undefined), sets: m.exercise_code ? (m.sets?.length ? m.sets : Array.from({ length: b.format === 'straight_sets' ? Math.max(1, b.rounds || 1) : 1 }, (_, i) => ({ ...movementSets(m)[0], set_order: i + 1 }))) : undefined })), rounds: b.format === 'straight_sets' ? 1 : b.rounds };
}
function componentBlock(c: WorkoutComponentRequest, i: number): SessionBlock {
  return { id: `legacy-${i}`, label: c.type === 'exercise' ? displayName(c.exercise_code) : displayName(c.type), format: c.type === 'exercise' ? 'straight_sets' : 'steady', completion: c.type === 'exercise' ? 'manual' : c.duration_seconds ? 'time' : 'distance', duration_seconds: c.duration_seconds, rounds: 1,
    movements: [{ sport: c.type === 'exercise' ? undefined : c.sport, exercise_code: c.exercise_code || undefined, sets: c.exercise_code ? c.sets : undefined, duration_seconds: c.duration_seconds, distance_m: c.distance_m, intensity_zone: c.intensity_zone, metrics: c.metrics }] };
}
export function makeDraft(date: string, today: string, original?: WorkoutRequest): BuilderDraft {
  const workout: WorkoutRequest = original ? structuredClone(original) : { date, sport: '', title: '', category: 'endurance', purpose: 'training', planned: date >= today, completed: date < today, source: 'manual', structure_version: 2 };
  const legacy = !!original && !original.blocks?.length;
  const blocks = legacy ? (original.components || []).map(componentBlock) : (original?.blocks || []).map(upgradeBlock);
  if (original?.execution && original.completed) {
    for (const b of blocks) {
      const result = original.execution.blocks?.find(r => r.block_id === b.id);
      b.movements = structuredClone(result?.movements || []).map(m => ({ ...m, sets: m.exercise_code ? movementSets(m) : undefined }));
      b.duration_seconds = result?.elapsed_seconds || 0;
      b.format = 'steady'; b.completion = 'manual'; b.rounds = 1; b.work_seconds = 0; b.rest_seconds = 0; b.recovery = undefined;
    }
  }
  return { workout, original, legacy, quick: !!workout.completed && (!!workout.execution?.summary_only || workout.components?.[0]?.target_type === "manual_summary" || !blocks.length), quickDistanceM: workout.execution?.distance_m || (workout.components?.[0]?.target_type === "manual_summary" ? workout.components[0].distance_m : undefined), log: !!workout.completed, blocks };
}
export function newBlock(sport: string, format = 'steady', log = false): SessionBlock {
  return { id: newID(), label: format === 'steady' ? 'Main effort' : displayName(format), format, completion: format === 'straight_sets' ? 'manual' : 'time', duration_seconds: format === 'straight_sets' ? undefined : log ? undefined : 1200, rounds: 1,
    movements: format === 'straight_sets' ? [{ exercise_code: '', sets: [{ set_order: 1, rest_seconds: log ? undefined : 90 }] }] : [{ sport, intensity_zone: log ? undefined : 'easy' }] };
}
export function blockSeconds(b: SessionBlock) {
  if (b.format === 'intervals' && b.completion === 'time') return (b.rounds || 0) * ((b.work_seconds || 0) + (b.rest_seconds || 0));
  return b.completion === 'time' ? b.duration_seconds || 0 : 0;
}
export function timedSeconds(blocks: SessionBlock[]) { return blocks.reduce((sum, b) => sum + blockSeconds(b), 0); }
export function needsEstimate(d: BuilderDraft) { return d.legacy || d.quick || !d.blocks.length || d.blocks.some(b => b.completion !== 'time'); }
export function blockSummary(b: SessionBlock) {
  const m = b.movements?.[0];
  if (m?.exercise_code || m?.sets) return `${m.exercise_code ? displayName(m.exercise_code) : 'Choose an exercise'} · ${m.sets?.length || 0} sets`;
  if (b.format === 'intervals') return `${b.rounds || 0} repeats · ${b.completion === 'distance' ? `${m?.distance_m || 0} m` : `${b.work_seconds || 0}s`} work / ${b.rest_seconds || 0}s recovery`;
  return `${b.label || displayName(b.format)} · ${b.completion === 'distance' ? `${m?.distance_m || 0} m` : `${Math.round(blockSeconds(b) / 60)} min`}${m?.intensity_zone ? ` · ${displayName(m.intensity_zone)}` : ''}`;
}
function normalizedBlocks(d: BuilderDraft) {
  return d.blocks.map(b => ({ ...b, duration_seconds: b.completion === 'time' ? blockSeconds(b) : d.log ? b.duration_seconds : undefined,
    movements: b.movements?.map(m => ({ ...m, sets: m.sets?.map((s, i) => ({ ...s, set_order: i + 1 })) })) }));
}
export function draftPayload(d: BuilderDraft, activity?: BuilderActivity): WorkoutRequest {
  const blocks = normalizedBlocks(d);
  const duration = needsEstimate(d) ? d.workout.duration_minutes : Math.ceil(timedSeconds(blocks) / 60);
  const base: WorkoutRequest = { ...d.workout, date: d.workout.date, title: d.workout.title?.trim() || activity?.name || displayName(d.workout.sport), category: d.workout.purpose ? activityCategory(activity, d.workout.purpose) : d.workout.category, duration_minutes: duration, planned: d.original?.planned || !d.log, completed: d.log };
  if (d.quick) {
    if (d.original?.blocks?.length) return { ...base, structure_version: 2, blocks: d.original.blocks.map(upgradeBlock), components: [], execution: { key: d.original.execution?.key || newID(), summary_only: true, distance_m: d.quickDistanceM, elapsed_seconds: Math.round((duration || 0) * 60), blocks: [] } };
    return { ...base, structure_version: 0, blocks: [], execution: undefined, components: d.quickDistanceM ? [{ order: 1, type: "steady", sport: base.sport, duration_seconds: Math.round((duration || 0) * 60), distance_m: d.quickDistanceM, target_type: "manual_summary" }] : [] };
  }
  if (d.legacy) {
    return { ...base, structure_version: 0, blocks: [], components: blocks.flatMap(b => (b.movements || []).map(m => {
      const original = d.original?.components?.[parseInt(b.id?.replace('legacy-', '') || '', 10)];
      return { ...original, type: m.exercise_code ? 'exercise' : original?.type || 'steady', sport: m.sport || original?.sport, exercise_code: m.exercise_code, sets: m.sets, duration_seconds: b.duration_seconds || m.duration_seconds, distance_m: m.distance_m, intensity_zone: m.intensity_zone, metrics: m.metrics || original?.metrics };
    })).map((c, i) => ({ ...c, order: i + 1 })) };
  }
  if (!d.log) return { ...base, structure_version: 2, blocks, components: [], execution: undefined };
  // Only explicitly entered results are sent as performed work. A saved prescription is preserved.
  const elapsed = needsEstimate(d) ? Math.round((duration || 0) * 60) : timedSeconds(blocks);
  const unknown = blocks.filter(b => !b.duration_seconds).length;
  const known = blocks.reduce((sum, b) => sum + (b.duration_seconds || 0), 0);
  return { ...base, structure_version: 2, blocks: d.original?.blocks?.length ? d.original.blocks.map(upgradeBlock) : blocks,
    components: [], execution: { ...d.original?.execution, key: d.original?.execution?.key || newID(), summary_only: false, elapsed_seconds: elapsed,
      blocks: blocks.filter(b => b.movements?.length).map(b => {
        const seconds = b.duration_seconds || Math.max(1, Math.floor((elapsed - known) / Math.max(1, unknown)));
        return { ...d.original?.execution?.blocks?.find(r => r.block_id === b.id), block_id: b.id, elapsed_seconds: seconds,
          movements: recordedMovements(b, seconds) };
      }) } };
}
export function draftError(d: BuilderDraft, step = 2): string | undefined {
  if (!d.workout.sport) return 'Choose an activity.';
  if (!d.workout.date) return 'Choose a date.';
  if (step === 0) return;
  if (!d.quick && !d.blocks.length) return 'Add at least one block, or choose a quick log.';
  for (const b of d.quick ? [] : d.blocks) {
    if (!b.movements?.length) { if (d.original?.execution) continue; return 'Add an activity or exercise to each block.'; }
    if (b.completion === 'time' && blockSeconds(b) <= 0) return 'Enter a positive duration for each timed block.';
    if (b.completion === 'distance' && !((b.movements[0]?.distance_m || 0) > 0)) return 'Enter a positive distance.';
    if (b.format === 'intervals' && (!(b.rounds! > 0) || (b.completion === 'time' && !(b.work_seconds! > 0)))) return 'Enter interval repeats and work duration.';
    if (b.format === 'emom' && (!(b.work_seconds! > 0) || (b.duration_seconds || 0) % b.work_seconds! !== 0)) return 'EMOM duration must contain whole intervals.';
    for (const m of b.movements) {
      if (m.sets) {
        if (!m.exercise_code) return 'Choose an exercise.';
        if (!m.sets.length || m.sets.some(s => !((s.reps || 0) > 0 || (s.duration_seconds || 0) > 0 || (s.distance_m || 0) > 0))) return 'Enter reps, time, or distance for every set.';
      }
      if (m.target && !(m.target.value! > 0)) return 'Enter a positive numeric target or remove it.';
    }
  }
  if (needsEstimate(d) && d.workout.duration_minutes !== undefined && !Number.isInteger(d.workout.duration_minutes)) return 'Enter whole minutes for the session duration.';
  if (step === 2 && d.workout.duration_minutes && needsEstimate(d) && !d.legacy && timedSeconds(d.blocks) > d.workout.duration_minutes * 60) return 'Session duration must cover all timed blocks.';
  if (step === 2 && needsEstimate(d) && !(d.workout.duration_minutes! > 0)) return d.log ? 'Enter the elapsed workout duration.' : 'Enter an estimated workout duration.';
}

export function startLogging(d: BuilderDraft): BuilderDraft {
  if (d.log) return d;
  return { ...d, log: true, quick: !d.blocks.length, original: d.original || structuredClone(draftPayload(d)),
    blocks: d.blocks.map(b => ({ ...b, format: b.movements?.some(m => m.exercise_code) ? 'straight_sets' : 'steady', completion: 'manual', rounds: 1, work_seconds: undefined, rest_seconds: undefined, recovery: undefined, duration_seconds: undefined,
      movements: b.movements?.map(m => m.exercise_code || m.sets ? { exercise_code: m.exercise_code, sets: [] } : { sport: m.sport }) })),
    workout: { ...d.workout, duration_minutes: undefined, rpe: undefined } };
}

// In manual logging, rounds are entered results. They are expanded once, whereas
// execution-result edits already contain individual performed entries.
function recordedMovements(b: SessionBlock, seconds: number): SessionMovement[] {
  const repeats = ['intervals', 'circuit', 'for_time'].includes(b.format || '') ? Math.max(1, b.rounds || 1) : 1;
  const recovery = b.format === 'intervals' ? (b.rest_seconds || 0) * repeats : 0;
  const movements = (b.movements || []).map((m, i) => {
    const count = b.format === 'emom' && b.work_seconds ? Math.max(0, Math.ceil(((b.duration_seconds || 0) / b.work_seconds - i) / (b.movements?.length || 1))) : repeats;
    return { ...m, target: undefined, distance_m: m.distance_m ? m.distance_m * count : undefined,
      sets: m.sets ? Array.from({ length: count }, () => m.sets || []).flat().map((set, i) => ({ ...set, set_order: i + 1 })) : undefined,
      duration_seconds: m.exercise_code ? m.duration_seconds : m.duration_seconds ? m.duration_seconds * count : Math.floor((seconds - recovery) / (b.movements?.length || 1)) };
  }).filter(m => !m.sets || m.sets.length);
  if (recovery > 0 && b.movements?.[0]?.sport) movements.push({ sport: b.movements[0].sport, intensity_zone: b.recovery?.intensity_zone || 'recovery', duration_seconds: recovery, target: undefined, distance_m: undefined, sets: undefined });
  return movements;
}
