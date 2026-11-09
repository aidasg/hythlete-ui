import { Link } from "react-router-dom";
import { useLayoutEffect, useRef, useState, type MutableRefObject } from "react";
import { useCoach } from "@/features/coach/context/coachContext";
import { coachActions, contextLabel, type CoachAction, type CoachResult } from "@/features/coach/types";
import { ProposalReview } from "./ProposalReview";
import { PlanningInputs } from "./PlanningInputs";
import { CoachHistory } from "./CoachHistory";
import { CoachEvidencePreview } from "./CoachEvidencePreview";
import { paths } from "@/routes/paths";
const toolLabels: Record<string,string> = { get_athlete_context: "Your goals and preferences", list_workouts: "Training history and schedule", get_workout: "Workout details", compare_workout: "Comparison with your plan and history", get_readiness: "Training readiness", get_training_progress: "Progress evidence", get_training_strategy: "Training priorities", get_training_catalog: "Supported activities and equipment", preview_workout: "Estimated workout demands", create_workout_proposal: "Validated workout draft" };
function EvidenceDetails({ result }: { result: CoachResult }) {
  const coach = useCoach();
  const statuses: Record<string,string> = { needs_input: "More details needed", no_fit: "No matching workout", failed: "Coach unavailable", explanation_unavailable: "Draft ready; explanation unavailable" };
  return <>
    {result.outcome && statuses[result.outcome] && <p role="status">{statuses[result.outcome]}</p>}
    {!!result.tools?.length && <details><summary>What Coach considered</summary><ul>{result.tools.map((tool, i) => <li key={i}>{toolLabels[tool.name || ""] || "Training evidence"}{tool.outcome !== "ok" && tool.outcome !== "ready" ? " · unavailable or limited" : ""}</li>)}</ul></details>}
    {!!result.evidence?.some(item => item.workout_id) && <div className="coach-evidence">{result.evidence.filter(item => item.workout_id).map(item => <button type="button" className="coach-source-link" key={item.id} onClick={() => item.workout_id && coach?.setPreviewID(item.workout_id)}>{item.date} · Workout #{item.workout_id}</button>)}</div>}
    {!!result.missing?.length && <details><summary>Data limitations</summary><ul>{result.missing.map((missing, i) => <li key={i}>{missing.replace(/_/g, " ")}</li>)}</ul></details>}
    {result.proposals?.map(proposal => proposal.id ? <ProposalReview key={proposal.id} id={proposal.id} canAccept={coach?.paid === true} /> : null)}
  </>;
}
export function CoachWorkspace({ scrollPosition }: { scrollPosition?: MutableRefObject<number> }) {
  const [toolsOpen, setToolsOpen] = useState(false);
  const coach = useCoach(); const scrollRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { const root = scrollRef.current; if (root && scrollPosition) root.scrollTop = scrollPosition.current; return () => { if (root && scrollPosition) scrollPosition.current = root.scrollTop; }; }, [scrollPosition]);
  if (!coach) return null;
  const legacy = coach.action === "adapt_session" || coach.action === "plan_training";
  const messages = coach.conversation?.messages || [];
  const lastResult = messages[messages.length - 1]?.result;
  return <div className="coach-workspace coach-panel-workspace">
    <div className="coach-context"><span className="eyebrow">Coaching context</span><strong>{contextLabel(coach.target)}</strong>{coach.target?.workoutID && <small>Using the saved workout; unsaved edits stay in your workspace.</small>}
      {coach.currentContext && JSON.stringify(coach.target) !== JSON.stringify(coach.currentContext) && <button type="button" className="coach-source-link" onClick={() => coach.openCoach({ target: coach.currentContext! })}>Use current view: {contextLabel(coach.currentContext)}</button>}
    </div>
    <CoachHistory />
    <div ref={scrollRef} className="coach-conversation-scroll" onScroll={event => { if (scrollPosition) scrollPosition.current = event.currentTarget.scrollTop; }}>
      {coach.previewID ? <CoachEvidencePreview id={coach.previewID} /> : <section className="coach-chat" aria-label="Coach conversation">
        {coach.conversation?.title && <h3>{coach.conversation.title}</h3>}
        {coach.loadingConversation && <p role="status">Loading conversation...</p>}
        {messages.length === 0 && <p className="coach-introduction">{coach.action === "review_recent_workout" ? "Understand this session against your plan and recent training." : coach.action === "plan_next_workout" ? "Prepare a workout that fits your goals, recent training and available time." : coach.action === "adapt_session" ? "Tell Coach how this planned session should change." : coach.action === "plan_training" ? "Build a four-to-six-week proposal around your training priorities." : "Ask about your training, explore your progress, or prepare your next session."}</p>}
        {messages.map(message => <article key={message.id} className={`coach-message coach-message-${message.role}`}><strong>{message.role === "user" ? "You" : "Coach"}</strong><p className="coach-answer">{message.content}</p>{message.result && <EvidenceDetails result={message.result} />}</article>)}
        {coach.optimisticResult && coach.optimisticResult.content !== lastResult?.content && <article className="coach-message coach-message-assistant"><strong>Coach</strong><p className="coach-answer">{coach.optimisticResult.content}</p><EvidenceDetails result={coach.optimisticResult} /></article>}
        {coach.proposalID > 0 && <ProposalReview id={coach.proposalID} canAccept={coach.paid} />}
        {coach.extraProposals.map(id => <ProposalReview key={id} id={id} canAccept={coach.paid} />)}
        {coach.busy && <p role="status">Coach is working on {coach.pendingLabel || "your training"}. You can keep using your workspace.</p>}
        {coach.error && <p role="alert">{coach.error}</p>}
      </section>}
    </div>
    <div className="coach-composer">
      {coach.checkingAccess && <p role="status">Checking your plan...</p>}
      {coach.accessError && <p role="alert">{coach.accessError.message} <button type="button" onClick={coach.retryAccess}>Retry</button></p>}
      {!coach.checkingAccess && !coach.accessError && !coach.paid && <div className="coach-upgrade"><strong>AI coaching is included with Pro</strong><p>Your saved conversations remain available.</p><Link to={paths.billing}>Choose a plan</Link></div>}
      <form onSubmit={event => { event.preventDefault(); coach.submit(); }}><fieldset disabled={!coach.paid || coach.busy}>
        <div className="coach-tools-menu"><button type="button" className="coach-source-link" aria-expanded={toolsOpen} onClick={() => setToolsOpen(!toolsOpen)}>Coaching tools</button>{toolsOpen && <nav aria-label="Coaching tools">{Object.entries(coachActions).map(([action, title]) => <button type="button" key={action} aria-pressed={coach.action === action} disabled={action === "adapt_session" && !coach.target?.workoutID} onClick={() => { coach.setAction(action as CoachAction); setToolsOpen(false); }}>{title}</button>)}</nav>}</div>
        {(coach.action === "plan_next_workout" || legacy) && <details open={legacy || undefined}><summary>Workout preferences · {coach.planning.date} · {coach.planning.minutes} min</summary><PlanningInputs value={coach.planning} onChange={coach.setPlanning} disabled={coach.busy} /></details>}
        {coach.action === "plan_training" && <label>Plan length<select value={coach.weeks} onChange={event => coach.setWeeks(Number(event.target.value))}>{[4, 5, 6].map(weeks => <option key={weeks} value={weeks}>{weeks} weeks</option>)}</select></label>}
        <label>{legacy ? "What would you like to change?" : "Message to Coach"}<textarea maxLength={legacy ? 4000 : 8000} value={coach.content} onChange={event => coach.setContent(event.target.value)} placeholder="Ask a question or add preferences..." /></label>
        <button className="primary-button" disabled={coach.busy || (coach.action === "plan_next_workout" || legacy) && coach.planning.activity_mode === "custom" && coach.planning.activities.length === 0}>{coach.busy ? "Working..." : coach.action === "review_recent_workout" ? "Get Coach insights" : coach.action === "plan_next_workout" ? "Generate workout draft" : legacy ? "Propose changes" : "Ask Coach"}</button>
      </fieldset></form>
    </div>
  </div>;
}
