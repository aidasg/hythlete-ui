import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { proposeCoaching, acceptCoaching, type CoachProposal } from "@/features/coach/services/coachApi";
import { useAuth } from "@/features/auth/context/useAuth";
import { getStrategyConstraints } from "@/features/strategy/services/strategyConstraints";
import { invalidateWorkoutDerivedData } from "@/services/query/invalidation";
import { SessionBlocks } from "@/features/workouts/components/SessionBlocks";
export function CoachPanel({ date, workoutID }: { date: string; workoutID?: number }) {
 const { session } = useAuth(); const constraints = getStrategyConstraints(date, session?.profile);
 const [instruction, setInstruction] = useState(""); const [weeks, setWeeks] = useState(4);
 const [proposal, setProposal] = useState<CoachProposal | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [accepted, setAccepted] = useState(false);
 const client = useQueryClient();
 async function propose() { setBusy(true); setError(""); setAccepted(false); try { const r = await proposeCoaching({ start: date, weeks, workout_id: workoutID, minutes: constraints.availableMinutes, equipment: constraints.equipment, activities: constraints.allowedSports, instruction }); if (r.error) throw Error(r.error.error); setProposal(r.data); } catch (e) { setError(e instanceof Error ? e.message : "Could not generate proposal"); } finally { setBusy(false); } }
 async function accept() { if (!proposal?.id) return; setBusy(true); setError(""); try { const r = await acceptCoaching(proposal.id); if (r.error) throw Error(r.error.error); setAccepted(true); await invalidateWorkoutDerivedData(client); } catch (e) { setError(e instanceof Error ? e.message : "Could not accept proposal"); } finally { setBusy(false); } }
 return <section className="today-session"><span className="eyebrow">Premium pilot · invitation required</span><h2>{workoutID ? "Adapt this session" : "Coaching proposals"}</h2><p>Review a proposed change before it affects your calendar.</p>
 <label>What would you like to change?<textarea maxLength={4000} value={instruction} onChange={e => setInstruction(e.target.value)} placeholder="For example: shorter sessions and more variety" /></label>
 {!workoutID && <label>Plan length<select value={weeks} onChange={e => setWeeks(Number(e.target.value))}>{[4, 5, 6].map(n => <option key={n} value={n}>{n} weeks</option>)}</select></label>}
 <button className="secondary-button" disabled={busy} onClick={() => void propose()}>{busy ? "Working…" : "Propose changes"}</button>
 {error && <p role="alert">{error}</p>}{accepted && <p role="status">Accepted. Your calendar has been updated.</p>}
 {proposal && !accepted && <div><h3>Review proposed changes</h3><p>{proposal.source === "ai" ? "AI-assisted proposal" : "Algorithmic fallback"}</p><p>{proposal.reason}</p>
 <h4>Planned sessions to replace</h4>{proposal.before?.filter(w => w.planned && !w.completed).map(w => <p key={w.id}>{w.date} · {w.title}</p>)}
 <h4>Proposed sessions</h4>{proposal.sessions?.map((w, i) => <details key={i}><summary>{w.date} · {w.title} · {w.duration_minutes} min</summary><SessionBlocks blocks={w.blocks || []} /></details>)}
 <p>Completed sessions remain in your history. The proposal expires {proposal.expires_at ? new Date(proposal.expires_at).toLocaleString() : "in 24 hours"}.</p><button className="primary-button" disabled={busy} onClick={() => void accept()}>Accept calendar changes</button><button className="secondary-button" onClick={() => setProposal(null)}>Discard</button></div>}
 </section>;
}
