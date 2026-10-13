import { PlannedWorkoutImpact } from "./WorkoutImpactPanel";
import { ExerciseSearchSelect } from "@/features/workouts/components/ExerciseSearchSelect";
import { getProfileOptions } from "@/features/profile/services/profileApi";
import { useQuery } from "@tanstack/react-query";
import { getWorkoutCatalog, type WorkoutRequest } from "@/features/workouts/services/workoutApi";
import { label, sessionFormats, type SessionBlock } from "@/features/workouts/services/sessionStructure";
export function StructuredSessionEditor({ value, onChange }: { value: WorkoutRequest; onChange: (v: WorkoutRequest) => void }) {
  const activities = useQuery({ queryKey: ["profile", "options"], queryFn: async () => { const r = await getProfileOptions(); if (r.error) throw Error("Cannot load activities"); return r.data; } });
  const catalog = useQuery({ queryKey: ["workouts", "catalog"], queryFn: async () => { const r = await getWorkoutCatalog(); if (r.error) throw Error("Cannot load exercises"); return r.data; } });
  function blocks(next: SessionBlock[]) { onChange({ ...value, structure_version: 1, blocks: next, duration_minutes: Math.ceil(next.reduce((sum, b) => sum + (b.duration_seconds || 0), 0) / 60) }); }
  function update(index: number, patch: Partial<SessionBlock>) { blocks((value.blocks || []).map((b, i) => i === index ? { ...b, ...patch } : b)); }
  return <div className="structured-editor"><label>Session title<input value={value.title || ""} onChange={e => onChange({ ...value, title: e.target.value })} /></label>
    <label>Activity<select value={value.sport} onChange={e => { const sport = activities.data?.sports?.find(s => s.code === e.target.value); const category = sport?.training_category === "strength_endurance" ? "mixed" : sport?.training_category === "mobility" ? "recovery" : sport?.training_category || "endurance"; onChange({ ...value, sport: e.target.value, category, blocks: value.blocks?.map(b => ({ ...b, movements: b.movements?.map(m => m.exercise_code ? m : { ...m, sport: e.target.value }) })) }); }}>{activities.data?.sports?.map(s => <option key={s.id} value={s.code}>{s.name}</option>)}</select></label>
    {value.blocks?.map((b, i) => <fieldset key={b.id}><legend>Block {i + 1}</legend>
      <label>Format<select value={b.format} onChange={e => update(i, { format: e.target.value })}>{sessionFormats.map(f => <option key={f} value={f}>{label(f)}</option>)}</select></label>
      <button type="button" onClick={() => update(i, { format: "intervals", rounds: 8, work_seconds: 20, rest_seconds: 10, duration_seconds: 240 })}>Tabata preset</button>
      {([ ["duration_seconds", "Time cap (seconds)"], ["rounds", "Rounds"], ["work_seconds", "Work / interval seconds"], ["rest_seconds", "Rest seconds"] ] as const).map(([key, title]) => <label key={key}>{title}<input type="number" min={0} value={b[key] || 0} onChange={e => update(i, { [key]: Number(e.target.value) })} /></label>)}
      {b.movements?.map((m, j) => <div key={j} className="movement-editor"><div><span>Movement</span><ExerciseSearchSelect value={m.exercise_code || ""} options={[{ code: "", name: label(value.sport) }, ...(catalog.data?.exercises || []).flatMap(e => e.code ? [{code:e.code,name:e.name || e.code}] : [])]} onChange={code => update(i, { movements: b.movements?.map((v, n) => n === j ? { ...v, exercise_code: code, sport: code ? "" : value.sport } : v) })} /></div>
        {(["reps", "load_kg", "distance_m", "duration_seconds"] as const).map(key => <label key={key}>{label(key)}<input type="number" min={0} value={m[key] || 0} onChange={e => update(i, { movements: b.movements?.map((v, n) => n === j ? { ...v, [key]: Number(e.target.value) } : v) })} /></label>)}
        <button onClick={() => update(i, { movements: b.movements?.filter((_, n) => n !== j) })}>Remove movement</button></div>)}
      <button onClick={() => update(i, { movements: [...(b.movements || []), { sport: value.sport }] })}>Add movement</button><button onClick={() => blocks(value.blocks?.filter((_, n) => n !== i) || [])}>Remove block</button>
    </fieldset>)}
    <button className="secondary-button" onClick={() => blocks([...(value.blocks || []), { id: crypto.randomUUID(), format: "steady", label: "Additional block", duration_seconds: 300, rounds: 1, movements: [{ sport: value.sport }] }])}>Add block</button>
    <p>Interval duration must equal rounds × (work + rest). EMOM time caps must contain whole intervals.</p>
    {!value.completed && <PlannedWorkoutImpact workout={value} enabled={!!value.blocks?.length} />}
  </div>;
}
