import { useEffect, useRef, useState } from "react";
import { ArrowUp, SlidersHorizontal, Square } from "lucide-react";
import { Link } from "react-router-dom";
import { useCoach } from "@/features/coach/context/coachContext";
import { coachActions, type CoachAction } from "@/features/coach/types";
import { paths } from "@/routes/paths";
import { PlanningInputs } from "./PlanningInputs";

export function CoachComposer() {
  const coach = useCoach();
  const [toolsOpen, setToolsOpen] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const focusAfterStop = useRef(false);
  const locked = !coach?.paid || coach.busy || coach.stopping || !!coach.reconnectJob;
  useEffect(() => {
    if (locked || !focusAfterStop.current) return;
    focusAfterStop.current = false;
    if (document.activeElement === document.body) input.current?.focus();
  }, [locked]);
  if (!coach) return null;
  const legacy = coach.action === "adapt_session" || coach.action === "plan_training";
  const planning = coach.action === "plan_next_workout" || legacy;
  const sendLabel = coach.action === "review_recent_workout" ? "Get Coach insights"
    : coach.action === "plan_next_workout" ? "Generate workout draft" : legacy ? "Propose changes" : "Ask Coach";

  return <div className="coach-composer">
    {coach.checkingAccess && <p role="status">Checking your plan…</p>}
    {coach.accessError && <p role="alert">{coach.accessError.message} <button type="button" onClick={coach.retryAccess}>Retry</button></p>}
    {!coach.checkingAccess && !coach.accessError && !coach.paid && <div className="coach-upgrade">
      <strong>AI coaching is included with Pro</strong><p>Your saved conversations remain available.</p><Link to={paths.billing}>Choose a plan</Link>
    </div>}
    <form onSubmit={event => { event.preventDefault(); coach.submit(); }}>
      <fieldset>
        {planning && <details open={legacy || undefined} className="coach-planning">
          <summary>Workout preferences · {coach.planning.date} · {coach.planning.minutes} min</summary>
          <PlanningInputs value={coach.planning} onChange={coach.setPlanning} disabled={locked} />
        </details>}
        {coach.action === "plan_training" && <label>Plan length
          <select disabled={locked} value={coach.weeks} onChange={event => coach.setWeeks(Number(event.target.value))}>
            {[4, 5, 6].map(weeks => <option key={weeks} value={weeks}>{weeks} weeks</option>)}
          </select>
        </label>}
        <div className="coach-input-card">
          <label className="coach-input-label">{legacy ? "What would you like to change?" : "Message to Coach"}
            <textarea ref={input} disabled={locked} maxLength={legacy ? 4000 : 8000} value={coach.content} onChange={event => coach.setContent(event.target.value)}
              placeholder="Ask about your training…" />
          </label>
          {toolsOpen && <nav className="coach-tool-options" aria-label="Coaching tools">
            {Object.entries(coachActions).map(([action, title]) => <button type="button" key={action} aria-pressed={coach.action === action}
              disabled={locked || action === "adapt_session" && !coach.target?.workoutID} onClick={() => { coach.setAction(action as CoachAction); setToolsOpen(false); }}>
              {title}
            </button>)}
          </nav>}
          <div className="coach-input-actions">
            <button type="button" className="coach-quiet-button" disabled={locked} aria-expanded={toolsOpen} onClick={() => setToolsOpen(open => !open)}>
              <SlidersHorizontal size={16} aria-hidden="true" /> Coaching tools
            </button>
            {coach.stopJob || coach.stopping
              ? <button type="button" className="coach-quiet-button coach-stop" disabled={coach.stopping} onClick={() => {
                focusAfterStop.current = true;
                coach.stopJob?.();
              }}>
                <Square size={15} aria-hidden="true" /> {coach.stopping ? "Stopping…" : "Stop generation"}
              </button>
              : <button className="primary-button coach-send" disabled={locked || planning && coach.planning.activity_mode === "custom" && coach.planning.activities.length === 0}>
                {sendLabel}<ArrowUp size={16} aria-hidden="true" />
              </button>}
          </div>
        </div>
      </fieldset>
    </form>
  </div>;
}
