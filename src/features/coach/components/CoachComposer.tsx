import { useEffect, useRef } from "react";
import { ArrowUp, Square } from "lucide-react";
import { Link } from "react-router-dom";
import { useCoach } from "@/features/coach/context/coachContext";
import { paths } from "@/routes/paths";
import { PlanningInputs } from "./PlanningInputs";

export function CoachComposer() {
  const coach = useCoach();
  const input = useRef<HTMLTextAreaElement>(null);
  const focusAfterStop = useRef(false);
  const locked = !coach?.paid || coach.busy || coach.stopping || !!coach.reconnectJob;
  useEffect(() => {
    if (locked || !focusAfterStop.current) return;
    focusAfterStop.current = false;
    if (document.activeElement === document.body) input.current?.focus();
  }, [locked]);
  if (!coach) return null;
  const invalidPreferences = coach.attachPreferences && coach.planning.activity_mode === "custom" && coach.planning.activities.length === 0;

  return <div className="coach-composer">
    {coach.checkingAccess && <p role="status">Checking your plan…</p>}
    {coach.accessError && <p role="alert">{coach.accessError.message} <button type="button" onClick={coach.retryAccess}>Retry</button></p>}
    {!coach.checkingAccess && !coach.accessError && !coach.paid && <div className="coach-upgrade">
      <strong>AI coaching is included with Pro</strong><p>Your saved conversations remain available.</p><Link to={paths.billing}>Choose a plan</Link>
    </div>}
    <form onSubmit={event => { event.preventDefault(); coach.submit(); }}>
      <fieldset>
        <details className="coach-planning">
          <summary>Workout preferences{coach.attachPreferences ? ` · ${coach.planning.date} · ${coach.planning.minutes} min attached` : ""}</summary>
          <label>
            <input type="checkbox" checked={coach.attachPreferences} disabled={locked} onChange={event => coach.setAttachPreferences(event.target.checked)} />
            Attach preferences to this message
          </label>
          {coach.attachPreferences && <PlanningInputs value={coach.planning} onChange={coach.setPlanning} disabled={locked} />}
        </details>
        <div className="coach-input-card">
          <label className="coach-input-label">Message to Coach
            <textarea id="coach-message-input" ref={input} disabled={locked} maxLength={8000} value={coach.content} onChange={event => coach.setContent(event.target.value)}
              placeholder="Ask about your training…" />
          </label>
          <div className="coach-input-actions">
            {coach.stopJob || coach.stopping
              ? <button type="button" className="coach-quiet-button coach-stop" disabled={coach.stopping} onClick={() => {
                focusAfterStop.current = true;
                coach.stopJob?.();
              }}>
                <Square size={15} aria-hidden="true" /> {coach.stopping ? "Stopping…" : "Stop generation"}
              </button>
              : <button className="primary-button coach-send" disabled={locked || !coach.content.trim() || invalidPreferences}>
                Send<ArrowUp size={16} aria-hidden="true" />
              </button>}
          </div>
        </div>
      </fieldset>
    </form>
  </div>;
}
