import { label, type SessionBlock } from "@/features/workouts/services/sessionStructure";
export function SessionBlocks({ blocks }: { blocks: SessionBlock[] }) {
  return <div className="session-blocks">{blocks.map((b, i) => <article key={b.id || i} className="session-block">
    <strong>{b.label || `Block ${i + 1}`} · {label(b.format)}</strong>
    <p>{Math.round((b.duration_seconds || 0) / 60)} min{b.rounds ? ` · ${b.rounds} ${b.format === "emom" || b.format === "intervals" ? "intervals" : "rounds"}` : ""}{b.format === "emom" ? " · Alternate movements each minute; rest the remaining time" : b.work_seconds ? ` · ${b.work_seconds}s work / ${b.rest_seconds || 0}s rest` : ""}</p>
    <ul>{b.movements?.map((m, j) => <li key={j}>{label(m.exercise_code || m.sport)}{m.reps ? ` · ${m.reps} reps` : ""}{m.load_kg ? ` · ${m.load_kg} kg` : ""}{m.distance_m ? ` · ${m.distance_m} m` : ""}</li>)}</ul>
  </article>)}</div>;
}
