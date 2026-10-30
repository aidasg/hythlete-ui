import type { WorkoutResponse } from './workoutApi';
import type { SessionBlock, SessionMovement } from './sessionStructure';

// The API's open object is emitted as Record<string, never>; widen only this read model.
export type TimelineComponent = Omit<NonNullable<WorkoutResponse['components']>[number], 'target_value'> & { target_value?: Record<string, unknown> };
export const timelineZones = [
  { key: 'unknown', label: 'Unknown', color: '#7b879b' },
  { key: 'recovery', label: 'Recovery', color: '#77c5db' },
  { key: 'easy', label: 'Easy', color: '#38bdf8' },
  { key: 'steady', label: 'Steady', color: '#5b93f5' },
  { key: 'tempo', label: 'Tempo', color: '#9b8afb' },
  { key: 'threshold', label: 'Threshold', color: '#d997f2' },
  { key: 'vo2max', label: 'VO2 max', color: '#f7bc62' },
  { key: 'anaerobic_capacity', label: 'Anaerobic', color: '#f59365' },
  { key: 'sprint', label: 'Sprint', color: '#fa7185' },
] as const;
export function timelineZone(value?: string) {
  const normalized = value?.toLowerCase();
  const key = normalized === 'vo2' ? 'vo2max' : normalized;
  return timelineZones.find(z => z.key === key) || timelineZones[0];
}
export type TimelineInterval = {
  key: string;
  component: TimelineComponent;
  start: number;
  end: number;
  zone: ReturnType<typeof timelineZone>;
  recordedStart?: string;
  recordedEnd?: string;
  alignment?: string;
  repetition?: number;
};
export type WorkoutTimelineData = {
  intervals: TimelineInterval[];
  totalSeconds: number;
  planned: boolean;
  partial: boolean;
  supported: boolean;
};
const positive = (n?: number): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
const isExercise = (c: TimelineComponent) => c.type === 'exercise' || !!c.exercise_code || !!c.sets?.length;

function plannedComponents(blocks: SessionBlock[]): TimelineComponent[] | null {
  const output: TimelineComponent[] = [];
  function add(m: SessionMovement, seconds: number, recovery = false) {
    output.push({ sport: m.sport, type: recovery ? 'recovery' : 'steady', duration_seconds: seconds,
      intensity_zone: m.intensity_zone || (recovery ? 'recovery' : undefined),
      target_type: m.target?.metric, target_value: m.target ? { value: m.target.value, unit: m.target.unit } : undefined });
  }
  for (const b of blocks) {
    if (b.completion && b.completion !== 'time') return null;
    const movements = b.movements || [];
    if (!movements.length || movements.some(m => m.exercise_code || m.sets?.length)) return null;
    if (b.format !== 'steady' && b.format !== 'intervals') return null;
    const seconds = b.format === 'intervals' ? b.work_seconds : b.duration_seconds;
    const rounds = b.format === 'intervals' ? b.rounds : 1;
    if (!positive(seconds) || !positive(rounds) || !Number.isInteger(rounds) || rounds > 1000) return null;
    const durations = movements.length === 1 ? [seconds] : movements.map(m => m.duration_seconds || 0);
    if (durations.some(n => !positive(n)) || Math.abs(durations.reduce((a,b) => a+b, 0) - seconds) > 1) return null;
    const rest = b.format === 'intervals' ? b.rest_seconds || 0 : 0;
    if (!Number.isFinite(rest) || rest < 0) return null;
    for (let round = 0; round < rounds; round++) {
      movements.forEach((m,i) => add(m, durations[i]!));
      if (rest > 0) add(b.recovery || { sport: movements[0]?.sport }, rest, true);
    }
  }
  return output;
}

export function buildWorkoutTimeline(workout: WorkoutResponse): WorkoutTimelineData {
  const planned = !workout.completed;
  const result: WorkoutTimelineData = { intervals: [], totalSeconds: 0, planned, partial: false, supported: true };
  const actuals = !planned ? workout.execution?.imported_activity : undefined;
  const imported = actuals?.segments;
  let components: TimelineComponent[];
  if (actuals) components = (imported || []).map(s => s.component || {});
  else if (planned && workout.blocks?.length) {
    const projected = plannedComponents(workout.blocks);
    if (!projected) return { ...result, supported: false };
    components = projected;
  } else components = [...(workout.components || [])].sort((a,b) => (a.order || 0) - (b.order || 0));
  if (components.some(isExercise) || ['strength', 'mixed', 'strength_endurance'].includes(workout.category || '')) return { ...result, supported: false };
  components.forEach((component, index) => {
    if (!positive(component.duration_seconds)) { result.partial = true; return; }
    const repeats = imported?.length ? 1 : component.repeats ?? 1;
    if (!positive(repeats) || !Number.isInteger(repeats) || repeats > 1000) { result.partial = true; return; }
    for (let repeat = 0; repeat < repeats; repeat++) {
      const start = result.totalSeconds;
      result.totalSeconds += component.duration_seconds;
      const metadata = imported?.[index];
      result.intervals.push({ key: `${index}-${repeat}`, component, start, end: result.totalSeconds,
        zone: timelineZone(planned ? component.intensity_zone : component.effort?.zone || component.intensity_zone),
        recordedStart: metadata?.start || (typeof component.target_value?.start_time === 'string' ? component.target_value.start_time : undefined),
        recordedEnd: metadata?.end, alignment: metadata?.alignment,
        repetition: repeats > 1 ? repeat + 1 : undefined });
    }
  });
  const exactDuration = workout.execution?.elapsed_seconds;
  if (!planned && positive(exactDuration) && Math.abs(exactDuration - result.totalSeconds) > 1) result.partial = true;
  else if (positive(workout.duration_minutes) && Math.abs(workout.duration_minutes * 60 - result.totalSeconds) >= 60) result.partial = true;
  return result;
}

export function timelineTime(seconds: number) {
  const rounded = Math.max(0, Math.round(seconds));
  const h = Math.floor(rounded / 3600);
  const m = Math.floor(rounded % 3600 / 60);
  const s = String(rounded % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}
export function intervalTarget(c: TimelineComponent): string | undefined {
  const target = c.target_value;
  if (!target) return undefined;
  if (target.fit_workout_step && typeof target.fit_workout_step === 'object') {
    return fitStepTarget(target.fit_workout_step as Record<string, unknown>);
  }
  if (!['power', 'heart_rate', 'pace'].includes(c.target_type || '')) return undefined;
  const value = target.value;
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const units: Record<string,string> = { watts: 'W', bpm: 'bpm', seconds_per_km: 'sec/km', seconds_per_100m: 'sec/100 m' };
  const unit = typeof target.unit === 'string' ? units[target.unit] || target.unit.replace(/_/g, ' ') : '';
  return `${value} ${unit}`.trim();
}

// FIT zone numbers are device prescriptions, not our named effort-zone scale.
function fitStepTarget(step: Record<string, unknown>): string | undefined {
  const type = typeof step.type === 'string' ? step.type : '';
  if (!['power', 'heart_rate', 'cadence', 'speed'].includes(type)) return undefined;
  const label = type.replace(/_/g, ' ');
  if (typeof step.value === 'number' && step.value > 0 && step.value < 255) return `FIT ${label} zone ${step.value}`;
  const format = (value: unknown) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value === 0xffffffff) return undefined;
    // FIT workout power and HR use offsets for absolute values.
    if (type === 'power') return value > 1000 ? `${value - 1000} W` : `${value}% FTP`;
    if (type === 'heart_rate') return value > 100 ? `${value - 100} bpm` : `${value}% max HR`;
    if (type === 'cadence') return `${value} rpm`;
    return `${value / 1000} m/s`;
  };
  const low = format(step.low), high = format(step.high);
  return low && high ? `${low} - ${high}` : low ? `At least ${low}` : high ? `Up to ${high}` : undefined;
}
