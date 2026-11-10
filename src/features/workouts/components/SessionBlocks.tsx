import { label, type SessionBlock, type SessionMovement } from "@/features/workouts/services/sessionStructure";
function setTargets(set: NonNullable<SessionMovement["sets"]>[number]) {
  const targets = [
    set.rpe !== undefined ? `RPE ${set.rpe}` : "",
    set.rir !== undefined ? `${set.rir} reps in reserve` : "",
    set.tempo ? `tempo ${set.tempo}` : "",
    set.is_warmup ? "warm-up" : "",
  ].filter(Boolean);
  return targets.length ? ` · ${targets.join(" · ")}` : "";
}

export function SessionBlocks({ blocks, showTargets = false }: { blocks: SessionBlock[]; showTargets?: boolean }) {
  return <div className="session-blocks">{blocks.map((b, i) => <article key={b.id || i} className="session-block">
    <strong>{b.label || `Block ${i + 1}`} · {label(b.format)}</strong>
    <p>{b.completion === "manual" ? "Complete at your own pace" : b.completion === "distance" ? "Distance target" : `${Math.round((b.duration_seconds || 0) / 60)} min`}{b.rounds ? ` · ${b.rounds} ${b.format === "emom" || b.format === "intervals" ? "intervals" : "rounds"}` : ""}{b.format === "emom" ? " · Alternate movements each minute; rest the remaining time" : b.work_seconds ? ` · ${b.work_seconds}s work / ${b.rest_seconds || 0}s rest` : ""}</p>
    {b.recovery && <p>Recovery: {showTargets && b.recovery.sport && `${label(b.recovery.sport)} · `}{label(b.recovery.intensity_zone)}{b.recovery.target ? ` · ${b.recovery.target.value} ${label(b.recovery.target.unit)}` : ""}</p>}
    <ul>{b.movements?.map((m, j) => <li key={j}>{label(m.exercise_code || m.sport)}{m.reps ? ` · ${m.reps} reps` : ""}{m.load_kg ? ` · ${m.load_kg} kg` : ""}{m.distance_m ? ` · ${m.distance_m} m` : ""}{showTargets && m.duration_seconds ? ` · ${m.duration_seconds}s` : ""}{m.intensity_zone ? ` · ${label(m.intensity_zone)}` : ""}{m.target ? ` · ${m.target.value} ${label(m.target.unit)}` : ""}{m.sets?.length ? <ul>{m.sets.map((set, n) => <li key={n}>Set {n + 1}: {set.reps ? `${set.reps} reps` : set.duration_seconds ? `${set.duration_seconds}s` : `${set.distance_m || 0}m`}{set.load_kg !== undefined ? ` · ${set.load_kg} kg` : ""}{set.rest_seconds ? ` · ${set.rest_seconds}s rest` : ""}{showTargets && setTargets(set)}</li>)}</ul> : null}</li>)}</ul>
  </article>)}</div>;
}
