import { WorkoutImpactPanel } from "@/features/workouts/components/WorkoutImpactPanel";
import { ExerciseSearchSelect } from "@/features/workouts/components/ExerciseSearchSelect";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/features/auth/context/useAuth";
import { getWorkout, getWorkoutCatalog } from "@/features/workouts/services/workoutApi";
import { elapsed, timerPosition, readExecution, persistExecution, beginExecution, completeExecution, type ExecutionState, type BlockResult } from "@/features/execution/services/execution";
import { label, type SessionMovement } from "@/features/workouts/services/sessionStructure";
import { invalidateWorkoutDerivedData } from "@/services/query/invalidation";
import { paths } from "@/routes/paths";

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
export function WorkoutExecution() {
  const { session } = useAuth(); const { id } = useParams();
  const uid = session?.profile?.user_id || 0;
  return <ExecutionContent key={`${uid}:${id}`} uid={uid} id={Number(id)} />;
}
function ExecutionContent({ uid, id }: { uid: number; id: number }) {
  const [state, setState] = useState<ExecutionState | null>(() => readExecution(uid, id));
  const [now, setNow] = useState(Date.now()); const [error, setError] = useState("");
  const [storageError, setStorageError] = useState(""); const [syncing, setSyncing] = useState(false);
  const [substitutions, setSubstitutions] = useState<Record<string, string>>({});
  const [loads, setLoads] = useState<Record<string, number>>({});
  const [distances, setDistances] = useState<Record<string, number>>({});
  const [reps, setReps] = useState<Record<string, number>>({});
  const inFlight = useRef(false); const client = useQueryClient();
  const workout = useQuery({ queryKey: ["workouts", "detail", id, uid], enabled: !!uid && Number.isInteger(id), queryFn: async () => { const r = await getWorkout(id); if (r.error) throw Error(r.error.error); return r.data; } });
  const catalog = useQuery({ queryKey: ["workouts", "catalog"], queryFn: async () => { const r = await getWorkoutCatalog(); if (r.error) throw Error("Cannot load substitutions"); return r.data; } });
  useEffect(() => {
    if (!state && workout.data) {
      try { setState(beginExecution(uid, workout.data)); } catch { setStorageError("Local storage is unavailable. Keep this page open until your results are saved."); setState({ version: 1, userID: uid, workout: workout.data, elapsedMs: 0, runningSince: null, result: { key: crypto.randomUUID(), blocks: [] }, pending: false, saved: !!workout.data.completed }); }
    }
  }, [state, workout.data, uid]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);
  useEffect(() => { if (state) { try { persistExecution(state); } catch { setStorageError("Could not store recovery state. Keep this page open until your results are saved."); } } }, [state]);

  const sync = useCallback(async () => {
    if (!state?.pending || state.saved || inFlight.current) return;
    inFlight.current = true; setSyncing(true); setError("");
    try { const response = await completeExecution(id, state.result); if (response.error) throw Error(response.error.error || "Could not save completion"); setState(s => s && { ...s, pending: false, saved: true, workout: response.data }); await invalidateWorkoutDerivedData(client); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not save. Your results are kept on this device."); }
    finally { inFlight.current = false; setSyncing(false); }
  }, [state, id, client]);
  // One automatic attempt per transition to pending; further retries use online or the retry button.
  useEffect(() => { if (state?.pending) { void sync(); } /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [state?.pending]);
  useEffect(() => { const retry = () => { void sync(); }; window.addEventListener("online", retry); return () => window.removeEventListener("online", retry); }, [sync]);
  if (!state) return <section className="dashboard-content"><h1>Workout</h1><p role="status">{workout.error?.message || "Loading your session…"}</p><button onClick={() => void workout.refetch()}>Retry</button></section>;
  const blocks = state.workout.blocks || [];
  if (!blocks.length) return <section className="dashboard-content"><h1>{state.workout.title}</h1><p>This workout has no executable structure.</p><Link to={paths.workouts}>Open Calendar</Link></section>;
  const seconds = Math.floor(elapsed(state, now) / 1000);
  const position = timerPosition(blocks, seconds); const block = blocks[position.index]!;
  const result = state.result.blocks?.find(r => r.block_id === block.id);
  function record(movement?: SessionMovement, index = 0) {
    if (!state || state.pending || state.saved) return;
    setError("");
    const results = [...(state.result.blocks || [])];
    const existing = results.find(r => r.block_id === block.id);
    const next: BlockResult = { ...(existing || { block_id: block.id, rounds: 0, movements: [] }), elapsed_seconds: Math.min(seconds, Math.max(1, Math.floor(position.seconds))) };
    if (movement) {
      const key = `${block.id}:${index}`;
      const performed = { ...movement, exercise_code: substitutions[key] || movement.exercise_code, reps: reps[key] ?? movement.reps, load_kg: loads[key] ?? movement.load_kg, distance_m: distances[key] || 0, duration_seconds: movement.exercise_code ? movement.duration_seconds : Math.max(1, Math.floor(position.seconds) - (existing?.elapsed_seconds || 0)) };
      if (!Number.isFinite(performed.reps || 0) || (performed.reps || 0) < 0 || (performed.reps || 0) > 10000 || !Number.isFinite(performed.load_kg || 0) || (performed.load_kg || 0) < 0 || !Number.isFinite(performed.distance_m || 0) || (performed.distance_m || 0) < 0) {
        setError("Enter valid performed reps, load, and distance before logging."); return;
      }
      next.movements = [...(next.movements || []), performed];
    } else { next.rounds = (next.rounds || 0) + 1; }
    setState({ ...state, result: { ...state.result, blocks: [...results.filter(r => r.block_id !== block.id), next] } });
  }
  function finish() {
    if (!state) return;
    const ms = elapsed(state);
    setState({ ...state, elapsedMs: ms, runningSince: null, pending: true, result: { ...state.result, elapsed_seconds: Math.max(1, Math.floor(ms / 1000)) } });
  }
  return <section className="dashboard-content live-workout"><Link to={paths.dashboard}>Back to Today</Link><h1>{state.workout.title}</h1>
    {storageError && <p role="alert">{storageError}</p>}
    {state.saved ? <article className="today-session"><h2>Workout saved</h2><p>Your recorded performance is now included in Progress.</p><p>{clock(state.result.elapsed_seconds || state.workout.execution?.elapsed_seconds || 0)} performed</p>{(state.result.blocks?.length ? state.result.blocks : state.workout.execution?.blocks)?.map(r => <p key={r.block_id}>{r.rounds || 0} rounds + {r.extra_reps || 0} reps · {r.movements?.length || 0} movement entries</p>)}<WorkoutImpactPanel workout={state.workout} /><Link to={paths.progress}>View progress</Link></article> : <>
      <span className="eyebrow">Block {position.index + 1} of {blocks.length} · {label(block.format)}</span><h2>{block.label}</h2>
      <div className="workout-timer" role="timer" aria-label="Workout timer">{clock(block.format === "for_time" ? position.seconds : block.work_seconds && position.remaining > 0 ? ((position.phase === "Rest" ? (block.work_seconds + (block.rest_seconds || 0)) : block.work_seconds) - position.seconds % (block.work_seconds + (block.rest_seconds || 0))) : position.remaining)}</div><p>{position.phase}{block.work_seconds ? ` · Interval ${position.interval}` : ""} · Total {clock(seconds)}</p>
      {!state.pending && <button className="primary-button" onClick={() => setState({ ...state, elapsedMs: elapsed(state), runningSince: state.runningSince === null ? Date.now() : null })}>{state.runningSince === null ? (seconds ? "Resume" : "Begin") : "Pause"}</button>}
      <p>Log what you actually performed. Only logged movements count toward detailed training results.</p>
      {block.movements?.map((m, i) => { if (block.format === "emom" && i !== (position.interval - 1) % (block.movements?.length || 1)) return null; const key = `${block.id}:${i}`; return <div className="live-movement" key={key}><strong>{label(m.exercise_code || m.sport)}</strong>
        {m.exercise_code && <><div><span>Substitute</span><ExerciseSearchSelect options={(catalog.data?.exercises || []).flatMap(e => e.code ? [{ code: e.code, name: e.name || e.code }] : [])} value={substitutions[key] || m.exercise_code} onChange={code => setSubstitutions({ ...substitutions, [key]: code })} /></div><label>Performed reps<input type="number" min={0} value={reps[key] ?? m.reps ?? 0} onChange={e => setReps({ ...reps, [key]: Number(e.target.value) })} /></label><label>Performed load (kg)<input type="number" min={0} step={0.5} value={loads[key] ?? m.load_kg ?? 0} onChange={e => setLoads({ ...loads, [key]: Number(e.target.value) })} /></label></>}
        {!m.exercise_code && <label>Performed distance (m)<input type="number" min={0} value={distances[key] || 0} disabled={state.pending} onChange={e => setDistances({ ...distances, [key]: Number(e.target.value) })} /></label>}
        <button disabled={state.pending || seconds < 1} className="secondary-button" onClick={() => record(m, i)}>Log {m.exercise_code ? "set" : "activity"}</button></div>; })}
      <button disabled={state.pending || seconds < 1} className="secondary-button" onClick={() => record()}>Log round</button>
      {block.format === "amrap" && <label>Extra reps after full rounds<input type="number" min={0} max={10000} disabled={state.pending} value={result?.extra_reps || 0} onChange={e => { const extra = Number(e.target.value); if (!Number.isInteger(extra) || extra < 0 || extra > 10000) return; const next = { ...(result || { block_id: block.id, rounds: 0, movements: [] }), extra_reps: extra }; setState({ ...state, result: { ...state.result, blocks: [...(state.result.blocks || []).filter(r => r.block_id !== block.id), next] } }); }} /></label>}
      {!!result?.movements?.length && <button disabled={state.pending} className="secondary-button" onClick={() => setState({ ...state, result: { ...state.result, blocks: state.result.blocks?.map(r => r.block_id === block.id ? { ...r, movements: r.movements?.slice(0, -1) } : r) } })}>Undo last movement entry</button>}<p>{result?.rounds || 0} rounds · {result?.movements?.length || 0} movement entries logged</p>
      <button disabled={state.pending || !state.result.blocks?.some(b => b.movements?.length)} className="primary-button" onClick={finish}>Finish and save</button>
      {state.pending && <p role="status">{syncing ? "Saving results…" : "Results waiting to sync. They are kept on this device."}</p>}
    </>}
    {error && <p role="alert">{error} {state.pending && <button disabled={syncing} onClick={() => void sync()}>Retry save</button>}</p>}
  </section>;
}
