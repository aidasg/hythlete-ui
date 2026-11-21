import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/features/auth/context/useAuth';
import { CoachTrigger } from '@/features/coach/components/CoachTrigger';
import { useCoachPageContext } from '@/features/coach/context/coachContext';
import { useTodayDate } from '@/features/strategy/hooks/useTodayDate';
import { formatMeasurement } from '@/services/units';
import { invalidateStrategyAndProgress } from '@/services/query/invalidation';
import { paths } from '@/routes/paths';
import { GoalForm } from './GoalForm';
import { definitionOf, getGoalCatalog, getGoalHistory, getGoalProgress, getGoals, mutateGoal, saveGoalCheckIn, type AthleteGoal, type GoalCheckIn, type GoalDefinition } from '../services/goalApi';
import { goalError, human, inputValue, newGoal, storedValue, targetLabel } from '../services/goalModel';

export function GoalsWorkspace() {
 const { id } = useParams(); const selectedID = id ? Number(id) : undefined;
 const { session, refreshSession } = useAuth(); const uid = session?.profile?.user_id || 0;
 const date = useTodayDate(session?.profile?.timezone);
 const client = useQueryClient();
 const portfolio = useQuery({ queryKey: ['goals', uid, 'portfolio'], queryFn: getGoals });
 const catalog = useQuery({ queryKey: ['goals', uid, 'templates'], queryFn: getGoalCatalog });
 const [editing, setEditing] = useState<{ id?: number; value: GoalDefinition; version?:number; revision?:number }>();
 const [validation, setValidation] = useState('');
 const [filter, setFilter] = useState('active');
 const goals = portfolio.data?.goals || [];
 const selected = goals.find(g => g.id === selectedID);
 useCoachPageContext({ surface: 'goals', title: selected?.title || 'Athlete goals', goalID: selectedID });
 async function refresh() { await client.invalidateQueries({ queryKey: ['goals', uid] }); await invalidateStrategyAndProgress(client); await refreshSession(); }
 const save = useMutation({ mutationFn: mutateGoal, onSuccess: async () => { setEditing(undefined); setValidation(''); await refresh(); }, onError: async () => { await portfolio.refetch(); } });
 const current = editing?.id ? goals.find(g => g.id === editing.id) : undefined;
 const oldPrimary = goals.find(g => g.status === 'active' && g.role === 'primary' && g.id !== editing?.id);
 const demote = editing?.value.status === 'active' && editing.value.role === 'primary' ? oldPrimary : undefined;
 function submit(event: FormEvent) {
  event.preventDefault(); if (!editing || !portfolio.data) return;
  if(editing.version!==portfolio.data.version || (editing.id && editing.revision!==current?.revision)){setValidation("Goals changed while you were editing. Cancel and reopen the editor to review the latest goals.");return;}
  const error = goalError(editing.value); if (error) { setValidation(error); return; }
  const rank = current && current.role === editing.value.role ? current.rank : 1 + Math.max(0, ...goals.filter(g => g.role === editing.value.role).map(g => g.rank || 0));
  const priorities = demote ? [{ id: demote.id, role: 'secondary', rank: 1 + Math.max(0, ...goals.filter(g => g.role === 'secondary').map(g => g.rank || 0)) }] : [];
  save.mutate({ action: editing.id ? 'update' : 'create', goal_id: editing.id, expected_revision: editing.revision, expected_version: editing.version, goal: { ...editing.value, rank }, priorities });
 }
 function status(g: AthleteGoal, next: string) { if(next==='active' && g.role==='primary' && goals.some(v=>v.id!==g.id && v.status==='active' && v.role==='primary')) {setEditing({id:g.id,value:{...definitionOf(g),status:'active'},version:portfolio.data?.version,revision:g.revision});return;} save.mutate({ action: 'update', goal_id: g.id, expected_revision: g.revision, expected_version: portfolio.data?.version, goal: { ...definitionOf(g), status: next } }); }
 function move(g: AthleteGoal, offset: number) {
  const siblings = goals.filter(v => v.status === 'active' && v.role === g.role);
  const index = siblings.findIndex(v => v.id === g.id); const next = index + offset;
  if (next < 0 || next >= siblings.length) return;
  [siblings[index], siblings[next]] = [siblings[next]!, siblings[index]!];
  const priorities = siblings.map((v, i) => ({ id: v.id, role: v.role, rank: i + 1 }));
  save.mutate({ action: 'priorities', expected_version: portfolio.data?.version, priorities });
 }
 if (portfolio.isPending || catalog.isPending) return <p role="status">Loading your goals...</p>;
 if (portfolio.error || catalog.error || !portfolio.data || !catalog.data) return <section className="goals-page"><p role="alert">Could not load your goals. {portfolio.error?.message || catalog.error?.message}</p><button type="button" onClick={() => { void portfolio.refetch(); void catalog.refetch(); }}>Retry</button></section>;
 return <section className="dashboard-content goals-page">
  <header className="today-page-heading"><div><span className="eyebrow">Your training direction</span><h1>{selectedID ? selected?.title || 'Goal not found' : 'Your goals'}</h1><p>Choose what to develop, what to maintain, and what matters now.</p></div><CoachTrigger label="Discuss goals with Coach" intent={{ action: 'coach_chat', target: { surface: 'goals', goalID: selectedID, title: selected?.title } }} /></header>
  {selectedID && <Link to={paths.goals}>All goals</Link>}
  {(validation || save.error) && <p role="alert">{validation || save.error?.message}</p>}
  {!editing && !selectedID && <button type="button" className="primary-button" onClick={() => { setValidation(''); setEditing({ version:portfolio.data?.version, value: newGoal(date, goals.some(g => g.role === 'primary' && g.status === 'active') ? 'secondary' : 'primary') }); }}>Add goal</button>}
  {editing && <form className="goal-editor" onSubmit={submit} aria-label="Goal editor"><h2>{editing.id ? 'Edit goal' : 'New goal'}</h2><GoalForm value={editing.value} catalog={catalog.data} onChange={value => { setEditing({ ...editing, value }); setValidation(''); }} />
   {demote && <p role="status">Saving will make “{demote.title}” a secondary goal. Your training guidance will use the new priorities.</p>}
   <div className="goal-actions"><button type="submit" className="primary-button" disabled={save.isPending}>{save.isPending ? 'Saving...' : demote ? 'Save goal and update priorities' : 'Save goal'}</button><button type="button" className="secondary-button" disabled={save.isPending} onClick={() => { setEditing(undefined); setValidation(''); save.reset(); }}>Cancel</button></div>
  </form>}
  {!editing && selected && <><GoalCard goal={selected} busy={save.isPending} edit={() => setEditing({ id: selected.id, value: definitionOf(selected),version:portfolio.data?.version,revision:selected.revision })} status={next => status(selected, next)} /><GoalDetail key={`${selected.id}:${selected.revision}`} goal={selected} refresh={refresh} date={date} complete={() => status(selected, 'completed')} /></>}
  {!selectedID && <><div className="goal-filters" role="group" aria-label="Goal status">{['active', 'paused', 'completed', 'archived'].map(v => <button type="button" key={v} aria-pressed={filter === v} onClick={() => setFilter(v)}>{human(v)}</button>)}</div>
   <div className="goal-grid">{goals.filter(g => g.status === filter).map(g => { const siblings = goals.filter(v => v.status === 'active' && v.role === g.role); const index = siblings.findIndex(v => v.id === g.id); return <GoalCard key={g.id} goal={g} busy={save.isPending} edit={() => setEditing({ id: g.id, value: definitionOf(g),version:portfolio.data?.version,revision:g.revision })} status={next => status(g, next)} move={g.status === 'active' && g.role !== 'primary' ? offset => move(g, offset) : undefined} first={index === 0} last={index === siblings.length - 1} />; })}</div>
   {!goals.some(g => g.status === filter) && <p className="goal-empty">{filter === 'active' ? 'Start with one direction. You can add a target, event, or maintenance goal whenever you are ready.' : `No ${filter} goals yet.`}</p>}
  </>}
 </section>;
}
function GoalCard({ goal: g, busy, edit, status, move, first, last }: { goal: AthleteGoal; busy: boolean; edit: () => void; status: (value: string) => void; move?: (offset: number) => void; first?: boolean; last?: boolean }) {
 const { session } = useAuth(); const units = { weightUnit: session?.profile?.weight_unit === 'lb' ? 'lb' as const : 'kg' as const, distanceUnit: session?.profile?.distance_unit === 'mi' ? 'mi' as const : 'km' as const };
 return <article className="goal-card" data-role={g.role}><div className="goal-card-meta"><span>{human(g.role)}</span><span>{human(g.status)}</span></div><h2><Link to={`/goals/${g.id}`}>{g.title}</Link></h2><p>{human(g.intent)} · {human(g.subject?.code)}</p><strong>{targetLabel(g.target, units)}</strong>{(g.deadline || g.event_date) && <p>{g.event_name || 'Target date'} · {g.event_date || g.deadline}</p>}{g.notes && <p>{g.notes}</p>}
  <div className="goal-actions"><button type="button" disabled={busy} onClick={edit}>Edit</button>{g.status === 'active' ? <><button type="button" disabled={busy} onClick={() => status('paused')}>Pause</button><button type="button" disabled={busy} onClick={() => status('completed')}>Complete</button></> : <button type="button" disabled={busy} onClick={() => status('active')}>Reopen</button>}{g.status !== 'archived' && <button type="button" disabled={busy} onClick={() => status('archived')}>Archive</button>}{move && <><button type="button" aria-label={`Move ${g.title} up`} disabled={busy || first} onClick={() => move(-1)}>Up</button><button type="button" aria-label={`Move ${g.title} down`} disabled={busy || last} onClick={() => move(1)}>Down</button></>}</div>
 </article>;
}
function GoalDetail({ goal: g, refresh, date, complete }: { goal: AthleteGoal; refresh: () => Promise<void>; date: string; complete: () => void }) {
 const id = g.id!; const { session } = useAuth(); const uid = session?.profile?.user_id;
 const units = { weightUnit: session?.profile?.weight_unit === 'lb' ? 'lb' as const : 'kg' as const, distanceUnit: session?.profile?.distance_unit === 'mi' ? 'mi' as const : 'km' as const };
 const progress = useQuery({ queryKey: ['goals', uid, id, 'progress', g.revision], queryFn: () => getGoalProgress(id) });
 const history = useQuery({ queryKey: ['goals', uid, id, 'history', g.revision], queryFn: () => getGoalHistory(id) });
 const [correction, setCorrection] = useState<GoalCheckIn>(); const [note, setNote] = useState(''); const [value, setValue] = useState(''); const [achieved, setAchieved] = useState(false); const [checkDate, setCheckDate] = useState(date);
 const reportMetric=correction?.metric || g.target?.metric; const reportUnit=correction?.unit || g.target?.unit;
 const check = useMutation({ mutationFn: () => saveGoalCheckIn(id, { id: correction?.id, expected_revision: correction?.revision, expected_goal_revision: g.revision, date: checkDate, notes: note, achieved, value: value === '' ? undefined : storedValue(Number(value), reportMetric, units) }), onSuccess: async () => { setCorrection(undefined); setValue(''); setNote(''); setAchieved(false); await refresh(); } });
 function correct(c: GoalCheckIn) { setCorrection(c); setNote(c.notes || ''); setCheckDate(c.date || date); setAchieved(c.achieved || false); setValue(c.value === undefined ? '' : String(inputValue(c.value, c.metric || g.target?.metric, units))); }
 return <>
  <section className="goal-detail"><h2>Progress toward this goal</h2>{progress.isPending && <p role="status">Loading progress...</p>}{progress.error && <p role="alert">{progress.error.message}<button type="button" onClick={() => void progress.refetch()}>Retry</button></p>}
   {progress.data && <><p className="goal-measurement">{human(progress.data.measurement)} evidence · {human(progress.data.status)}</p>{progress.data.status === 'target_reached' && g.status === 'active' && <div className="goal-achieved"><strong>Target reached</strong><p>Your evidence meets the target. Choose whether to complete this goal or keep developing it.</p><button type="button" className="primary-button" onClick={complete}>Complete goal</button></div>}
    <div className="goal-progress-grid">{([['Baseline', progress.data.baseline], ['Current', progress.data.current], ['Best since starting', progress.data.best]] as const).map(([name, observation]) => <div key={name}><span>{name}</span><strong>{observation ? formatMeasurement(observation.value, observation.unit, undefined, units) : 'Awaiting evidence'}</strong>{observation && <small>{observation.date?.slice(0, 10)} · {human(observation.source)}{observation.estimated ? ' (estimate)' : ''}</small>}</div>)}</div>
    {progress.data.limitations?.map(l => <p className="profile-help-text" key={l}>{l}</p>)}
   </>}
  </section>
  <section className="goal-detail"><h2>{correction ? 'Correct your update' : 'Record a personal update'}</h2><p>These updates are labeled athlete reported and stay separate from workout measurements.</p>
   <form className="goal-check-in" onSubmit={e => { e.preventDefault(); check.mutate(); }}><label>Date<input required type="date" min={g.starts_on} max={date} value={checkDate} onChange={e => setCheckDate(e.target.value)} /></label>{(g.target?.kind === 'numeric' || correction?.value!==undefined) && <label>Reported value ({reportMetric?.endsWith('_kg') ? units.weightUnit : reportMetric === 'time_seconds' ? 'minutes' : reportMetric === 'distance_m' ? units.distanceUnit : reportUnit})<input type="number" min="0" step="any" value={value} onChange={e => setValue(e.target.value)} /></label>}{g.target?.kind === 'milestone' && <label className="goal-check"><input type="checkbox" checked={achieved} onChange={e => setAchieved(e.target.checked)} />I reached this milestone</label>}<label>Personal notes<textarea maxLength={4000} value={note} onChange={e => setNote(e.target.value)} /></label><button type="submit" className="primary-button" disabled={check.isPending}>{check.isPending ? 'Saving...' : correction ? 'Save correction' : 'Save update'}</button>{correction && <button type="button" onClick={() => { setCorrection(undefined); setValue(''); setNote(''); setAchieved(false); }}>Cancel correction</button>}{check.error && <p role="alert">{check.error.message}</p>}</form>
   <ul className="goal-check-ins">{progress.data?.check_ins?.map(c => <li key={c.id}><strong>{c.date}</strong> · {c.value === undefined ? c.achieved ? 'Milestone reached' : 'Personal update' : formatMeasurement(c.value, c.unit || g.target?.unit, undefined, units)}<p>{c.notes}</p><button type="button" onClick={() => correct(c)}>Correct update</button></li>)}</ul>
  </section>
  <section className="goal-detail"><h2>Goal history</h2>{history.isPending && <p role="status">Loading history...</p>}{history.error && <p role="alert">{history.error.message}<button type="button" onClick={() => void history.refetch()}>Retry</button></p>}<ol className="goal-history">{history.data?.map(r => <li key={r.revision}><strong>{r.after?.title}</strong><small>{r.recorded_at?.slice(0, 10)} · {human(r.source)}</small><p>{r.before ? `${human(r.before.role)} / ${human(r.before.status)} → ` : 'Created as '}{human(r.after?.role)} / {human(r.after?.status)}</p><p>{targetLabel(r.after?.target, units)}</p>{r.after?.deadline && <p>Target date: {r.after.deadline}</p>}</li>)}</ol></section>
 </>;
}
export function GoalsSummary({ conflict = false }: { conflict?: boolean }) {
 const { session } = useAuth(); const active = session?.profile?.goal_summary?.goals?.filter(g => g.status === 'active') || [];
 return <aside className="goals-summary"><div><strong>{active.find(g => g.role === 'primary')?.title || active[0]?.title || 'Choose your training direction'}</strong><p>{active.length ? `${active.length} active ${active.length === 1 ? 'goal' : 'goals'}` : 'Start with one goal, then add development and maintenance priorities.'}</p>{conflict && <p role="status">Your saved focus block differs from your current goals. Guidance uses your new priorities. Review a replacement in Focus block.</p>}</div><Link to={paths.goals}>Manage goals</Link></aside>;
}
