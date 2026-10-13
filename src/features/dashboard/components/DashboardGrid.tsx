import { WorkoutImpactPanel } from "@/features/workouts/components/WorkoutImpactPanel";
import { CoachPanel } from "@/features/coach/components/CoachPanel";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/context/useAuth";
import { useTodayDate } from "@/features/strategy/hooks/useTodayDate";
import { useDailyStrategy } from "@/features/strategy/hooks/useDailyStrategy";
import { getStrategyConstraints, saveStrategyConstraints, type StrategyConstraints } from "@/features/strategy/services/strategyConstraints";
import type { RankedStrategyOption } from "@/features/strategy/services/strategyApi";
import { ChangeSession } from "@/features/strategy/components/ChangeSession";
import { createWorkout, updateWorkout, listWorkouts, type WorkoutRequest } from "@/features/workouts/services/workoutApi";
import { beginExecution } from "@/features/execution/services/execution";
import { SessionBlocks } from "@/features/workouts/components/SessionBlocks";
import { label } from "@/features/workouts/services/sessionStructure";
import { StructuredSessionEditor } from "@/features/workouts/components/StructuredSessionEditor";
import { WorkoutModal } from "@/features/workouts/components/WorkoutModal";
import { isProfileComplete } from "@/features/profile/services/profileModel";
import { invalidateWorkoutDerivedData } from "@/services/query/invalidation";
import { queryKeys } from "@/services/query/queryKeys";
import { paths } from "@/routes/paths";

export function DashboardGrid() {
  const { session } = useAuth();
  const date = useTodayDate(session?.profile?.timezone);
  // Reconcile day/account/profile changes without reusing yesterday's draft.
  const identity = `${session?.profile?.user_id}:${date}:${session?.profile?.preferred_sports?.map(s => s.code).join(",")}`;
  return <TodayContent key={identity} date={date} />;
}
function TodayContent({ date }: { date: string }) {
  const { session } = useAuth();
  const userID = session?.profile?.user_id || 0;
  const [constraints, setConstraints] = useState(() => getStrategyConstraints(date, session?.profile));
  const [change, setChange] = useState(false);
  const [chosen, setChosen] = useState<RankedStrategyOption | null>(null);
  const [edited, setEdited] = useState<WorkoutRequest | null>(null);
  const [coaching, setCoaching] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [replaceID, setReplaceID] = useState<number | undefined>();
  const [additional, setAdditional] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const client = useQueryClient();
  const daily = useDailyStrategy(date, constraints, !!userID, userID);
  const workouts = useQuery({ queryKey: [...queryKeys.workouts.list(date, date), userID], enabled: !!userID, queryFn: async () => { const r = await listWorkouts({ from: date, to: date }); if (r.error) throw Error("Cannot load today's workouts"); return r.data; } });
  const planned = workouts.data?.find(w => w.planned && !w.completed);
  const completed = workouts.data?.filter(w => w.completed) || [];
  const option = chosen || daily.data?.today?.primary;
  const recommendation = edited || option?.session;
  const showPlanned = !!planned && !additional;
  const showCompleted = !planned && completed.length > 0 && !additional;
  const current = showPlanned ? planned : recommendation;

  function apply(next: StrategyConstraints) {
    saveStrategyConstraints(date, next, userID); setConstraints(next); setChosen(null); setEdited(null); setChange(false);
  }
  async function start() {
    if (!current || busy) return;
    setBusy(true); setError("");
    try {
      if (showPlanned && planned?.id) { navigate(`/workouts/${planned.id}/execute`); return; }
      const payload = { ...recommendation, date, planned: true, completed: false };
      const r = replaceID ? await updateWorkout(replaceID, payload) : await createWorkout(payload);
      if (r.error || !r.data.id) throw Error(r.error?.error || "Could not save your session");
      try { beginExecution(userID, r.data); } catch { /* Execution shows persistence failures. */ }
      await invalidateWorkoutDerivedData(client);
      navigate(`/workouts/${r.data.id}/execute`);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not start session"); }
    finally { setBusy(false); }
  }
  return <section className="dashboard-content simple-today" aria-labelledby="today-page-title">
    <div className="today-page-heading"><div><span className="eyebrow">{date}</span><h1 id="today-page-title">What can I do today?</h1><p>A session that fits your day.</p></div><Link to={paths.plan}>Your plan</Link></div>
    {!isProfileComplete(session?.profile) && <p><Link to={paths.setup}>Continue setup</Link> to personalize your recommendations.</p>}
    {showCompleted ? <article className="today-session"><span className="eyebrow">Today's training</span><h2>Session complete</h2>{completed.map(w => <p key={w.id}>{w.title} · {w.duration_minutes} min</p>)}<button className="secondary-button" onClick={() => setAdditional(true)}>Plan an additional session</button></article> :
      daily.isLoading || workouts.isLoading ? <p role="status">Finding your session…</p> :
      current ? <article className="today-session">
        <span className="eyebrow">{showPlanned ? "Your planned session" : "Suggested for today"}</span><h2>{current.title}</h2>
        <p className="today-session-meta">{label(current.sport)} · {current.duration_minutes} min · Controlled effort</p>
        <p>{showPlanned ? "Your saved plan for today." : option?.reasons?.[0] || "Fits your activities and available time."}</p>
        <SessionBlocks blocks={current.blocks || []} />
        <div className="today-actions"><button className="primary-button" disabled={busy || !current.blocks?.length} onClick={() => void start()}>{busy ? "Saving…" : "Start"}</button><button className="secondary-button" onClick={() => { if (showPlanned) setReplaceID(planned?.id); setAdditional(true); setChange(true); }}>Change</button>{!showPlanned && <button className="secondary-button" onClick={() => setEditing(true)}>Edit session</button>}</div>
        {!current.blocks?.length && <p>This existing workout uses the earlier format. <Link to={paths.workouts}>Open it in Calendar</Link> to record it.</p>}
        {showPlanned && <button className="secondary-button" onClick={() => setCoaching(true)}>Adapt with coach</button>}
        <details onToggle={e => setDetailsOpen(e.currentTarget.open)}><summary>View details</summary>{detailsOpen && <WorkoutImpactPanel workout={current} />}<p>{label(option?.recommendation)}</p><ul>{option?.reasons?.map(r => <li key={r}>{r}</li>)}</ul>{option?.score !== undefined && <p>Recommendation score: {Math.round(option.score)}</p>}</details>
      </article> : <article className="today-session"><h2>Let's find something that fits</h2><p>{daily.data?.today?.no_fit_reason || "Choose your activities and available time to get started."}</p><button className="primary-button" onClick={() => setChange(true)}>Adjust today's choices</button><p><Link to={paths.workouts}>Record your own session</Link> or take a rest day.</p></article>}
    {(error || daily.error || workouts.error) && <p role="alert">{error || daily.error?.message || workouts.error?.message}<button onClick={() => { void daily.refetch(); void workouts.refetch(); }}>Retry</button></p>}
    {daily.isFetching && !daily.isLoading && <p role="status">Updating session…</p>}
    {daily.data?.active_focus && <p className="today-plan-note">Working toward {label(daily.data.active_focus.capabilities?.find(c => c.role === "primary")?.capability_code)}. <Link to={paths.plan}>View plan</Link></p>}
    {coaching && planned?.id && <WorkoutModal title="Adapt session" eyebrow="Premium pilot" onClose={() => setCoaching(false)}><CoachPanel date={date} workoutID={planned.id} /></WorkoutModal>}
    {change && <ChangeSession value={constraints} onApply={apply} onClose={() => { setChange(false); if (replaceID) { setAdditional(false); setReplaceID(undefined); } }} alternatives={daily.data?.today?.alternatives || []} onChoose={o => { setChosen(o); setEdited(null); setChange(false); }} onSomethingElse={() => apply({ ...constraints, excludedKeys: [...(constraints.excludedKeys || []), ...[option, ...(daily.data?.today?.alternatives || [])].flatMap(o => o?.key ? [o.key] : [])] })} />}
    {editing && recommendation && <WorkoutModal title="Edit session" eyebrow="Today's workout" onClose={() => setEditing(false)}><StructuredSessionEditor value={recommendation} onChange={v => { setEdited(v); setEditing(false); }} /></WorkoutModal>}
  </section>;
}
