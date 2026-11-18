import { useUnits } from '@/services/useUnits';
import { formatDuration, formatDistance, formatTarget, type ActivityUnits } from '@/services/units';
import type { WorkoutCatalogResponse } from '../services/workoutApi';
import { exerciseSetSummary } from '../services/workoutBuilder';
import { label, type SessionBlock, type SessionMovement } from "@/features/workouts/services/sessionStructure";
function setTargets(set: NonNullable<SessionMovement["sets"]>[number]) {
  const targets = [
    typeof set.rpe === 'number' ? `RPE ${set.rpe}` : "",
    typeof set.rir === 'number' ? `${set.rir} reps in reserve` : "",
    set.tempo ? `tempo ${set.tempo}` : "",
    set.is_warmup ? "warm-up" : "",
  ].filter(Boolean);
  return targets.length ? ` · ${targets.join(" · ")}` : "";
}

export function SessionBlocks({ blocks, showTargets = false, exercises, sport, activities }: { blocks: SessionBlock[]; showTargets?: boolean; exercises?: WorkoutCatalogResponse['exercises']; sport?: string; activities?: ActivityUnits[] }) {
  const units = useUnits();
  return <div className="session-blocks">{blocks.map((b, i) => <article key={b.id || i} className="session-block">
    <strong>{b.label || `Block ${i + 1}`} · {label(b.format)}</strong>
    <p>{b.completion === "manual" ? "Complete at your own pace" : b.completion === "distance" ? "Distance target" : formatDuration(b.duration_seconds)}{b.rounds ? ` · ${b.rounds} ${b.format === "emom" || b.format === "intervals" ? "intervals" : "rounds"}` : ""}{b.format === "emom" ? " · Alternate movements each minute; rest the remaining time" : b.work_seconds ? ` · ${formatDuration(b.work_seconds)} work / ${formatDuration(b.rest_seconds || 0)} rest` : ""}</p>
    {b.recovery && <p>Recovery: {showTargets && b.recovery.sport && `${label(b.recovery.sport)} · `}{label(b.recovery.intensity_zone)}{b.recovery.target ? ` · ${formatTarget(b.recovery.target, b.recovery.sport || b.movements?.[0]?.sport || sport, units.distanceUnit, activities)}` : ""}</p>}
    <ul>{b.movements?.map((m, j) => <li key={j}>{label(m.exercise_code || m.sport)}{m.exercise_code && !m.sets?.length ? ` · ${exerciseSetSummary([{ reps: m.reps || undefined, load_kg: m.load_kg || undefined, counting_version: m.counting_version, counting_convention: m.counting_convention, duration_seconds: m.duration_seconds || undefined, distance_m: m.distance_m || undefined }], exercises?.find(e => e.code === m.exercise_code)?.load_profile, units)}` : ""}{m.distance_m ? ` · ${formatDistance(m.distance_m, units.distanceUnit, m.sport || sport, activities)}` : ""}{showTargets && m.duration_seconds ? ` · ${formatDuration(m.duration_seconds)}` : ""}{m.intensity_zone ? ` · ${label(m.intensity_zone)}` : ""}{m.target ? ` · ${formatTarget(m.target, m.sport || sport, units.distanceUnit, activities)}` : ""}{m.sets?.length ? <ul>{m.sets.map((set, n) => <li key={n}>Set {n + 1}: {exerciseSetSummary([set], exercises?.find(e => e.code === m.exercise_code)?.load_profile, units)}{set.rest_seconds ? ` · ${formatDuration(set.rest_seconds)} rest` : ""}{showTargets && setTargets(set)}</li>)}</ul> : null}</li>)}</ul>
  </article>)}</div>;
}
