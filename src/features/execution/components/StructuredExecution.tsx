import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { WorkoutCatalogResponse, WorkoutResponse } from '@/features/workouts/services/workoutApi';
import type { SessionMovement } from '@/features/workouts/services/sessionStructure';
import { displayName, blockSummary } from '@/features/workouts/services/workoutBuilder';
import { ExerciseEditor, DurationField, EffortEditor, NumberField } from '@/features/workouts/components/builder/TargetEditors';
import { invalidateWorkoutDerivedData } from '@/services/query/invalidation';
import { WorkoutImpactPanel } from '@/features/workouts/components/WorkoutImpactPanel';
import { beginExecution, completeExecution, elapsed, persistExecution, readExecution, type ExecutionState } from '../services/execution';
import { paths } from '@/routes/paths';

type V2State = ExecutionState & { activeBlock?: number; blockStartSeconds?: number };
const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
export function StructuredExecution({ uid, workout, catalog }: { uid: number; workout: WorkoutResponse; catalog: WorkoutCatalogResponse }) {
  const [storageError, setStorageError] = useState('');
  const [state, setState] = useState<V2State>(() => {
    const previous = readExecution(uid, workout.id!);
    if (previous && !workout.completed) return previous;
    if (workout.completed && workout.execution) return { version: 1, userID: uid, workout, elapsedMs: (workout.execution.elapsed_seconds || 0) * 1000, runningSince: null, result: workout.execution, pending: false, saved: true };
    try { return beginExecution(uid, workout); }
    catch { return { version: 1, userID: uid, workout, elapsedMs: 0, runningSince: null, result: workout.execution || { key: crypto.randomUUID(), blocks: [] }, pending: false, saved: !!workout.completed }; }
  });
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [entry, setEntry] = useState<SessionMovement | null>(null);
  const inFlight = useRef(false);
  const client = useQueryClient();
  const blocks = state.workout.blocks || [];
  const index = state.activeBlock || 0;
  const block = blocks[index];
  const seconds = Math.floor(elapsed(state, now) / 1000);
  const blockSeconds = Math.max(0, seconds - (state.blockStartSeconds || 0));
  const result = state.result.blocks?.find(r => r.block_id === block?.id);
  useEffect(() => {
    if (workout.completed && workout.execution && state.saved && JSON.stringify(workout.execution) !== JSON.stringify(state.workout.execution)) {
      setState(s => ({ ...s, workout, result: workout.execution!, elapsedMs: (workout.execution?.elapsed_seconds || 0) * 1000, runningSince: null, pending: false }));
    }
  }, [workout, state.saved, state.workout.execution]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 250); return () => window.clearInterval(timer); }, []);
  useEffect(() => { try { persistExecution(state); } catch { setStorageError('Could not save on this device. Keep this page open until results are synced.'); } }, [state]);
  const sync = useCallback(async () => {
    if (!state.pending || state.saved || inFlight.current) return;
    inFlight.current = true; setSyncing(true); setError('');
    try { const r = await completeExecution(workout.id!, state.result); if (r.error) throw Error(r.error.error); setState(s => ({ ...s, saved: true, pending: false, workout: r.data })); await invalidateWorkoutDerivedData(client); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save results. Retry when connected.'); }
    finally { inFlight.current = false; setSyncing(false); }
  }, [state, workout.id, client]);
  const syncRef = useRef(sync); syncRef.current = sync;
  useEffect(() => { if (state.pending) void syncRef.current(); }, [state.pending]);
  useEffect(() => { const online = () => void syncRef.current(); window.addEventListener('online', online); return () => window.removeEventListener('online', online); }, []);
  function blockResults(movements = result?.movements || [], rounds = result?.rounds) {
    return [...(state.result.blocks || []).filter(r => r.block_id !== block?.id), { ...result, block_id: block?.id, elapsed_seconds: blockSeconds, movements, rounds }];
  }
  function logEntry() {
    if (!entry || seconds <= 0) return;
    if (entry.exercise_code && (!entry.sets?.length || entry.sets.some(s => !(s.reps! > 0 || s.duration_seconds! > 0 || s.distance_m! > 0)))) { setError('Enter reps, time, or distance for each recorded set.'); return; }
    if (!entry.exercise_code && !(entry.duration_seconds! > 0)) { setError('Enter recorded activity time.'); return; }
    const activitySeconds = [...(result?.movements || []), entry].filter(m => !m.exercise_code).reduce((sum, m) => sum + (m.duration_seconds || 0), 0);
    if (activitySeconds > blockSeconds) { setError('Recorded activity time exceeds elapsed block time.'); return; }
    const performed = { ...entry, target: undefined, sets: entry.sets?.map((s, i) => ({ ...s, set_order: i + 1 })) };
    setState({ ...state, result: { ...state.result, blocks: blockResults([...(result?.movements || []), performed]) } }); setEntry(null); setError('');
  }
  function next() {
    if (entry && !window.confirm('Discard this unlogged entry and continue?')) return;
    setState({ ...state, activeBlock: index + 1, blockStartSeconds: seconds, result: { ...state.result, blocks: blockResults() } }); setEntry(null);
  }
  function finish() {
    if (entry && !window.confirm('Discard this unlogged entry and finish?')) return;
    const ms = elapsed(state);
    setState({ ...state, elapsedMs: ms, runningSince: null, pending: true, result: { ...state.result, elapsed_seconds: Math.max(1, Math.floor(ms / 1000)), blocks: blockResults() } }); setEntry(null);
  }
  if (!block) return <p>No workout blocks found.</p>;
  const cycle = (block.work_seconds || 0) + (block.rest_seconds || 0);
  const resting = block.format === 'intervals' && cycle > 0 && blockSeconds % cycle >= (block.work_seconds || 0);
  return <section className="dashboard-content live-workout"><Link to={paths.workouts}>Calendar</Link><h1>{workout.title}</h1>
    {storageError && <p role="alert">{storageError}</p>}
    {state.saved ? <><h2>Workout saved</h2><p>{formatTime(state.result.elapsed_seconds || state.workout.execution?.elapsed_seconds || 0)} performed</p><WorkoutImpactPanel workout={state.workout} /><Link to={paths.workouts}>View or edit results</Link></> : <>
      <span className="eyebrow">Block {index + 1} of {blocks.length}</span><h2>{blockSummary(block)}</h2>
      <div className="workout-timer" role="timer" aria-label="Workout timer">{formatTime(blockSeconds)}</div><p>{block.completion === 'time' ? `${Math.max(0, (block.duration_seconds || 0) - blockSeconds)} seconds remaining` : 'Complete this block when your work is done.'}{block.format === 'intervals' ? ` · ${resting ? 'Recovery' : 'Work'}` : ''} · Total {formatTime(seconds)}</p>
      <button type="button" className="primary-button" disabled={state.pending} onClick={() => setState({ ...state, elapsedMs: elapsed(state), runningSince: state.runningSince === null ? Date.now() : null })}>{state.runningSince === null ? (seconds ? 'Resume' : 'Begin') : 'Pause'}</button>
      <p>Only entries you log are saved as performed work.</p>
      <div className="workout-builder">{block.movements?.map((m, i) => <article className="builder-block" key={i}><strong>{displayName(m.exercise_code || m.sport)}</strong>
        {m.exercise_code ? <ul>{m.sets?.map((s, j) => <li key={j}>Set {j + 1}: {s.reps ? `${s.reps} reps` : s.duration_seconds ? `${s.duration_seconds}s` : `${s.distance_m}m`}{s.load_kg !== undefined ? ` · ${s.load_kg} kg` : ''}{s.rest_seconds ? ` · ${s.rest_seconds}s rest` : ''}<button type="button" disabled={state.pending || seconds < 1} onClick={() => setEntry({ exercise_code: m.exercise_code, sets: [{ ...s, rest_seconds: undefined, set_order: 1 }] })}>Record set {j + 1}</button></li>)}</ul> : <p>{displayName(m.intensity_zone || 'Unspecified intensity')}{m.target ? ` · ${m.target.value} ${displayName(m.target.unit)}` : ''}{m.distance_m ? ` · ${m.distance_m}m` : ''}</p>}
        {!m.exercise_code && <button type="button" disabled={state.pending || seconds < 1} onClick={() => setEntry({ sport: m.sport, duration_seconds: Math.max(1, blockSeconds - (result?.movements || []).filter(v => !v.exercise_code).reduce((sum, v) => sum + (v.duration_seconds || 0), 0)) })}>Record activity</button>}
      </article>)}
      {resting && <p>Recovery target: {displayName(block.recovery?.intensity_zone || 'recovery')}{block.recovery?.target ? ` · ${block.recovery.target.value} ${displayName(block.recovery.target.unit)}` : ''}</p>}
      {entry && <fieldset><legend>Performed work</legend>{entry.exercise_code ? <ExerciseEditor value={entry} onChange={setEntry} catalog={catalog} recorded /> : <><DurationField label="Recorded activity time" seconds={entry.duration_seconds} onChange={v => setEntry({ ...entry, duration_seconds: v })} /><NumberField label="Recorded distance (m)" value={entry.distance_m} onChange={v => setEntry({ ...entry, distance_m: v })} /><EffortEditor value={entry} onChange={setEntry} zones={catalog.effort_zones || []} measured /></>}<div className="builder-row-actions"><button type="button" onClick={logEntry}>Log performed work</button><button type="button" onClick={() => setEntry(null)}>Cancel entry</button></div></fieldset>}
      </div>
      <p>{result?.movements?.length || 0} entries logged in this block</p>
      {!!result?.movements?.length && <button type="button" disabled={state.pending} onClick={() => setState({ ...state, result: { ...state.result, blocks: blockResults(result.movements?.slice(0, -1)) } })}>Undo last entry</button>}
      {['circuit', 'amrap', 'emom', 'for_time'].includes(block.format || '') && <><button type="button" disabled={state.pending || seconds < 1} onClick={() => setState({ ...state, result: { ...state.result, blocks: blockResults(undefined, (result?.rounds || 0) + 1) } })}>Log round ({result?.rounds || 0})</button>{block.format === 'amrap' && <NumberField label="Extra reps" value={result?.extra_reps} onChange={v => setState({ ...state, result: { ...state.result, blocks: blockResults().map(r => r.block_id === block.id ? { ...r, extra_reps: v } : r) } })} />}</>}
      <div className="today-actions">{index < blocks.length - 1 && <button type="button" className="secondary-button" disabled={state.pending || seconds < 1} onClick={next}>Complete block and continue</button>}<button type="button" className="primary-button" disabled={state.pending || !state.result.blocks?.some(r => r.movements?.length)} onClick={finish}>Finish and save</button></div>
      {state.pending && <p role="status">{syncing ? 'Saving results…' : 'Results are waiting to sync.'}</p>}
    </>}
    {error && <p role="alert">{error} {state.pending && <button type="button" disabled={syncing} onClick={() => void sync()}>Retry save</button>}</p>}
  </section>;
}
