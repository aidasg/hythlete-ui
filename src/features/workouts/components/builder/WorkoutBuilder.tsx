import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/context/useAuth';
import { useTodayDate } from '@/features/strategy/hooks/useTodayDate';
import { invalidateWorkoutDerivedData } from '@/services/query/invalidation';
import { createWorkout, getWorkoutCatalog, updateWorkout, type WorkoutCatalogResponse, type WorkoutRequest, type WorkoutResponse } from '../../services/workoutApi';
import { startLogging, activityCategory, blockSummary, displayName, draftError, draftPayload, makeDraft, needsEstimate, newBlock, newID, purposes, timedSeconds, type BuilderActivity, type BuilderDraft } from '../../services/workoutBuilder';
import { BlockEditor } from './BlockEditor';
import { NumberField } from './TargetEditors';
import { BenchmarkFields } from './BenchmarkFields';
import { PlannedWorkoutImpact } from '../WorkoutImpactPanel';
import type { SessionBlock } from '../../services/sessionStructure';

export type WorkoutBuilderProps = { selectedDate: string; initialWorkout?: WorkoutRequest; workoutId?: number; catalog?: WorkoutCatalogResponse | null; onCreated?: (w: WorkoutResponse) => void; onApply?: (w: WorkoutRequest) => void };
export function WorkoutBuilder({ selectedDate, initialWorkout, workoutId, catalog: provided, onCreated, onApply }: WorkoutBuilderProps) {
  const { session } = useAuth();
  const today = useTodayDate(session?.profile?.timezone);
  const [draft, setDraft] = useState(() => makeDraft(selectedDate, today, initialWorkout));
  const modeDrafts = useRef<{ plan?: BuilderDraft; log?: BuilderDraft }>({});
  const initialSnapshot = useRef(JSON.stringify(draft));
  const [step, setStep] = useState(initialWorkout ? 1 : 0);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [removed, setRemoved] = useState<{ block: SessionBlock; index: number }>();
  const [impactOpen, setImpactOpen] = useState(false);
  const [activityChange, setActivityChange] = useState<BuilderActivity>();
  const client = useQueryClient();
  const heading = useRef<HTMLHeadingElement>(null);
  const query = useQuery({ queryKey: ['workouts', 'catalog'], initialData: provided?.activities ? provided : undefined, queryFn: async () => { const r = await getWorkoutCatalog(); if (r.error) throw Error(r.error.error); return r.data; } });
  const catalog = query.data;
  const activity = catalog?.activities?.find(a => a.code === draft.workout.sport);
  const kind = activity?.builder_kind || (draft.workout.category === 'strength' ? 'strength' : 'general');
  const dirty = !saved && JSON.stringify(draft) !== initialSnapshot.current;
  const payload = useMemo(() => draftPayload(draft, activity), [draft, activity]);
  const favorites = session?.profile?.preferred_sports?.map(s => s.code) || [];
  const activities = (catalog?.activities || []).filter(a => `${a.name} ${a.code}`.toLowerCase().includes(search.toLowerCase()));
  const groups = new Map<string, BuilderActivity[]>();
  for (const a of activities) {
    const name = favorites.includes(a.code) ? 'My activities' : catalog?.activities?.find(p => p.code === a.parent_code)?.name || a.name || 'Other';
    groups.set(name, [...(groups.get(name) || []), a]);
  }
  useEffect(() => { heading.current?.focus({ preventScroll: true }); heading.current?.closest(".workout-modal")?.scrollTo?.({ top: 0 }); }, [step]);
  useEffect(() => {
    if (!dirty) return;
    const leave = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', leave); return () => window.removeEventListener('beforeunload', leave);
  }, [dirty]);
  function change(next: BuilderDraft) { setDraft(next); setError(''); setSaved(false); }
  function field(patch: Partial<WorkoutRequest>) { change({ ...draft, workout: { ...draft.workout, ...patch } }); }
  function blocks(next: SessionBlock[]) { change({ ...draft, quick: false, blocks: next }); }
  function switchMode(log: boolean) {
    if (draft.log === log) return;
    modeDrafts.current[draft.log ? 'log' : 'plan'] = draft;
    const previous = modeDrafts.current[log ? 'log' : 'plan'];
    change(previous || (log ? startLogging(draft) : { ...draft, log: false, quick: false, blocks: draft.blocks.length ? draft.blocks : draft.workout.sport ? [newBlock(draft.workout.sport, kind === 'strength' ? 'straight_sets' : 'steady')] : [] }));
  }
  function choose(a: BuilderActivity) {
    if (draft.blocks.length && draft.workout.sport !== a.code) { setActivityChange(a); return; }
    changeActivity(a, false);
  }
  function changeActivity(a: BuilderActivity, updateMovements: boolean) {
    const code = a.code || '';
    change({ ...draft, workout: { ...draft.workout, sport: code, title: !draft.workout.title || draft.workout.title === activity?.name ? a.name : draft.workout.title, purpose: draft.workout.purpose || 'training', category: activityCategory(a, draft.workout.purpose) },
      blocks: draft.blocks.length ? draft.blocks.map(b => ({ ...b, movements: b.movements?.map(m => updateMovements && !m.exercise_code && !m.sets ? { ...m, sport: code } : m), recovery: updateMovements && b.recovery ? { ...b.recovery, sport: code } : b.recovery })) : draft.quick ? [] : [a.builder_kind === 'general' ? { ...newBlock(code, 'steady', draft.log), movements: [{ sport: code }] } : newBlock(code, a.builder_kind === 'strength' ? 'straight_sets' : 'steady', draft.log)] });
    setActivityChange(undefined);
  }
  function navigate(next: number) { const validation = next > step ? draftError(draft, step) : undefined; if (validation) { setError(validation); return; } setError(''); setStep(next); }
  function add(format: string, label?: string) {
    const block = newBlock(draft.workout.sport || '', format, draft.log);
    if (format === 'intervals' && !draft.log) Object.assign(block, { rounds: 4, work_seconds: 60, rest_seconds: 60, duration_seconds: 480 });
    if (format === 'emom' && !draft.log) Object.assign(block, { work_seconds: 60, duration_seconds: 1200 });
    if (['circuit', 'amrap', 'emom', 'for_time'].includes(format)) block.movements = [{ sets: [{ set_order: 1 }] }];
    if (label) block.label = label;
    blocks([...draft.blocks, block]);
  }
  async function save() {
    const validation = draftError(draft);
    if (validation) { setError(validation); return; }
    if (payload.benchmark_result?.variant_id && payload.benchmark_result.score_value === undefined) { setError('Enter the benchmark score.'); return; }
    setBusy(true); setError('');
    try {
      const unchanged = initialWorkout && JSON.stringify(draft) === initialSnapshot.current;
      const body = unchanged ? initialWorkout : payload;
      if (onApply) { setSaved(true); onApply(body); return; }
      if (unchanged && workoutId) { setSaved(true); onCreated?.({ ...initialWorkout, id: workoutId }); return; }
      const response = workoutId ? await updateWorkout(workoutId, body) : await createWorkout(body);
      if (response.error) throw Error(response.error.error || 'Could not save workout.');
      setSaved(true); await invalidateWorkoutDerivedData(client); onCreated?.(response.data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save workout. Your changes are still here.'); }
    finally { setBusy(false); }
  }
  if (!catalog) return <div className="workout-builder"><p role="status">{query.error ? 'Could not load the activity catalog.' : 'Loading activities and exercises…'}</p>{query.error && <button type="button" onClick={() => void query.refetch()}>Retry</button>}</div>;
  return <section className="workout-builder" data-builder-dirty={dirty ? 'true' : 'false'} aria-label="Workout builder">
    <nav className="builder-steps" aria-label="Workout steps">{['Activity', 'Build', 'Review'].map((name, i) => <button key={name} type="button" aria-current={step === i ? 'step' : undefined} onClick={() => navigate(i)}><span>{i + 1}</span>{name}</button>)}</nav>
    <header className="builder-heading"><span className="eyebrow">{draft.log ? 'Completed workout' : 'Planned workout'}{draft.workout.sport ? ` · ${activity?.name || displayName(draft.workout.sport)}` : ''}</span><h2 tabIndex={-1} ref={heading}>{['What are you doing?', draft.log ? 'What did you do?' : 'Build your workout', 'Review your workout'][step]}</h2></header>
    {step === 0 && <>
      <div className="builder-mode" role="group" aria-label="Workout entry mode"><button type="button" disabled={!!initialWorkout?.completed} aria-pressed={!draft.log} onClick={() => switchMode(false)}>Plan a workout</button><button type="button" aria-pressed={draft.log} onClick={() => switchMode(true)}>Log a completed workout</button></div>
      <label>Date<input type="date" value={draft.workout.date || ''} onChange={e => field({ date: e.target.value })} /></label>
      <label>Find an activity<input type="search" value={search} placeholder="Running, strength, swimming…" onChange={e => setSearch(e.target.value)} /></label>
      <div className="builder-activity-list">{[...groups].sort(([a], [b]) => a === 'My activities' ? -1 : b === 'My activities' ? 1 : a.localeCompare(b)).map(([name, items]) => <section key={name}><h3>{name}</h3><div>{items.map(a => <button type="button" key={a.code} aria-pressed={a.code === draft.workout.sport} onClick={() => choose(a)}>{a.name}</button>)}</div></section>)}{!activities.length && <p>No matching activities.</p>}</div>
      {activityChange && <div role="alert" className="builder-change"><p>Keep existing block activities, or change activity blocks to {activityChange.name}? Exercise sets will stay in place.</p><button type="button" onClick={() => changeActivity(activityChange, false)}>Keep block activities</button><button type="button" onClick={() => changeActivity(activityChange, true)}>Update activity blocks</button><button type="button" onClick={() => setActivityChange(undefined)}>Cancel</button></div>}
    </>}
    {step === 1 && <>
      {draft.log && <div className="builder-mode" role="group" aria-label="Logging detail"><button type="button" aria-pressed={draft.quick} onClick={() => change({ ...draft, quick: true })}>Quick log</button><button type="button" aria-pressed={!draft.quick} onClick={() => change({ ...draft, quick: false, blocks: draft.blocks.length ? draft.blocks : [newBlock(draft.workout.sport || '', kind === 'strength' ? 'straight_sets' : 'steady', true)] })}>Detailed log</button></div>}
      {draft.quick ? <><NumberField label="Elapsed duration (minutes)" min={1} step="1" value={draft.workout.duration_minutes} onChange={v => field({ duration_minutes: v })} />{kind !== "strength" && <NumberField label="Distance (m, optional)" value={draft.quickDistanceM} onChange={v => change({ ...draft, quickDistanceM: v })} />}<NumberField label="Session effort / RPE (optional, 1–10)" min={1} value={draft.workout.rpe} onChange={v => field({ rpe: v })} /></> : <>
        {draft.original?.blocks?.length && draft.log && !draft.original.completed && <p>Enter only the work you completed. Remove skipped sets or blocks before saving.</p>}
        {draft.blocks.map((b, i) => <BlockEditor key={b.id} block={b} catalog={catalog} log={draft.log} legacy={draft.legacy} general={kind === "general"} recordingPlan={draft.log && !!draft.original?.blocks?.length} first={i === 0} last={i === draft.blocks.length - 1} onChange={v => blocks(draft.blocks.map((x, n) => n === i ? v : x))} onDuplicate={() => { const next = [...draft.blocks]; next.splice(i + 1, 0, { ...structuredClone(b), id: draft.legacy ? `${b.id}-copy-${newID()}` : newID() }); blocks(next); }} onRemove={() => { setRemoved({ block: b, index: i }); blocks(draft.blocks.filter((_, n) => n !== i)); }} onMove={direction => { const next = [...draft.blocks]; const other = i + direction; [next[i], next[other]] = [next[other]!, next[i]!]; blocks(next); }} />)}
        {removed && <p role="status">Block removed. <button type="button" onClick={() => { const next = [...draft.blocks]; next.splice(removed.index, 0, removed.block); blocks(next); setRemoved(undefined); }}>Undo</button></p>}
        {!(draft.log && draft.original?.blocks?.length) && <div className="builder-add"><strong>Add to your workout</strong><div>
          {(draft.legacy ? ['steady', 'straight_sets'] : activity?.formats || ['steady']).map(format => <button key={format} type="button" className="secondary-button" onClick={() => add(format)}>{format === 'straight_sets' ? 'Exercise' : format === 'steady' ? 'Continuous effort' : displayName(format)}</button>)}
          {(kind === 'endurance' || kind === 'mixed') && <>{['Warm-up', 'Recovery', 'Cool-down'].map(label => <button key={label} type="button" onClick={() => add('steady', label)}>{label}</button>)}</>}
          {kind === 'mixed' && !draft.legacy && <button type="button" onClick={() => blocks([...draft.blocks, { ...newBlock(draft.workout.sport || '', 'intervals'), label: 'Tabata', rounds: 8, work_seconds: 20, rest_seconds: 10, duration_seconds: 240 }])}>Tabata preset</button>}
        </div></div>}
      </>}
    </>}
    {step === 2 && <>
      <div className="builder-field-grid"><label>Workout title<input value={draft.workout.title || ''} placeholder={activity?.name || displayName(draft.workout.sport)} onChange={e => field({ title: e.target.value })} /></label><label>Date<input type="date" value={draft.workout.date || ''} onChange={e => field({ date: e.target.value })} /></label></div>
      {needsEstimate(draft) ? <NumberField label={draft.log ? 'Elapsed duration (minutes)' : 'Estimated session duration (minutes)'} min={1} step="1" value={draft.workout.duration_minutes} onChange={v => field({ duration_minutes: v })} /> : <p className="builder-total">Total duration <strong>{Math.round(timedSeconds(draft.blocks) / 60)} min</strong></p>}
      {!draft.quick && <ol className="builder-review">{draft.blocks.map(b => <li key={b.id}>{blockSummary(b)}{b.movements?.map((m, i) => m.exercise_code ? <ul key={i}>{m.sets?.map((s, j) => <li key={j}>Set {j + 1}: {s.reps ? `${s.reps} reps` : s.duration_seconds ? `${s.duration_seconds}s` : `${s.distance_m || 0}m`}{s.load_kg !== undefined ? ` · ${s.load_kg} kg` : ''}{s.rest_seconds ? ` · ${s.rest_seconds}s rest` : ''}</li>)}</ul> : m.target ? <p key={i}>{displayName(m.target.metric)}: {m.target.value} {displayName(m.target.unit)}</p> : null)}</li>)}</ol>}
      <div className="builder-field-grid"><label>Purpose (optional)<select value={draft.workout.purpose || ''} onChange={e => field({ purpose: e.target.value || undefined })}><option value="">Unspecified</option>{purposes.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label><NumberField label="Session RPE (optional, 1–10)" min={1} value={draft.workout.rpe} onChange={v => field({ rpe: v })} /></div>
      <label>Notes (optional)<textarea value={draft.workout.notes || ''} onChange={e => field({ notes: e.target.value })} /></label>
      {draft.log && (draft.workout.purpose === 'benchmark' || draft.workout.category === 'test_benchmark' || draft.workout.benchmark_result) && <BenchmarkFields value={draft.workout} onChange={v => change({ ...draft, workout: v })} />}
      {!draft.log && <details onToggle={e => setImpactOpen(e.currentTarget.open)}><summary>Predicted training impact</summary>{impactOpen && <PlannedWorkoutImpact workout={payload} enabled={!draftError(draft)} />}</details>}
    </>}
    {error && <p className="form-message form-message-error" role="alert">{error}</p>}
    {saved && <p role="status">Workout saved.</p>}
    <footer className="builder-footer"><span>{draft.quick ? 'Quick log' : `${draft.blocks.length} ${draft.blocks.length === 1 ? 'block' : 'blocks'}`}</span><div>{step > 0 && <button type="button" className="secondary-button" disabled={busy} onClick={() => navigate(step - 1)}>Back</button>}{step < 2 ? <button type="button" className="primary-button" onClick={() => navigate(step + 1)}>Continue</button> : <button type="button" className="primary-button" disabled={busy || saved} onClick={() => void save()}>{busy ? 'Saving…' : onApply ? 'Use changes' : workoutId ? 'Save changes' : draft.log ? 'Save completed workout' : 'Save planned workout'}</button>}</div></footer>
  </section>;
}
