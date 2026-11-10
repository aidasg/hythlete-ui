import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCoach } from "@/features/coach/context/coachContext";
import { coachActions, type CoachAction, type CoachIntent } from "@/features/coach/types";
import { paths } from "@/routes/paths";
function positive(value: string | null) { return value && /^[1-9]\d{0,8}$/.test(value) ? Number(value) : undefined; }
function validDate(value: string | null) { if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined; const date = new Date(`${value}T12:00:00Z`); return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : undefined; }
// Compatibility only: old coaching links open the persistent panel over a real workspace.
export function CoachPage() {
  const coach = useCoach(); const navigate = useNavigate(); const [params] = useSearchParams(); const handled = useRef(false);
  useEffect(() => {
    if (!coach || handled.current) return; handled.current = true;
    const workoutID = positive(params.get("workout")), proposalID = positive(params.get("proposal")), conversationID = positive(params.get("conversation"));
    const changeID = positive(params.get("change"));
    if (changeID) {
      navigate(paths.dashboard, { replace: true });
      coach.openCoach({ changeID });
      return;
    }
    const rawAction = params.get("action"); const action: CoachAction = rawAction && Object.prototype.hasOwnProperty.call(coachActions, rawAction) ? rawAction as CoachAction : workoutID ? "review_recent_workout" : "coach_chat";
    const date = validDate(params.get("date"));
    const intent: CoachIntent = { action, conversationID, proposalID, target: workoutID ? { surface: "workout", workoutID, date } : { surface: action === "plan_next_workout" || proposalID ? "plan" : "today", date } };
    navigate(workoutID ? `${paths.workouts}?workout=${workoutID}` : proposalID || action === "plan_next_workout" || action === "plan_training" ? paths.plan : paths.dashboard, { replace: true });
    coach.openCoach(intent);
  }, [coach, navigate, params]);
  return null;
}
