import { Sparkles } from "lucide-react";
import { useCoach } from "@/features/coach/context/coachContext";
import type { CoachIntent } from "@/features/coach/types";
export function CoachTrigger({ label, intent, description }: { label: string; intent?: CoachIntent; description?: string }) {
  const coach = useCoach();
  if (!coach) return null;
  return <span className="coach-entry"><button type="button" className="secondary-button coach-trigger" aria-haspopup="dialog" aria-controls="ai-coach-panel" onClick={event => coach.openCoach({ ...intent, target: intent?.target || coach.currentContext || undefined }, event.currentTarget)}><Sparkles size={16} aria-hidden="true" />{label}</button>{description && <small>{description}</small>}</span>;
}
export function CoachLauncher() {
  const coach = useCoach();
  if (!coach) return null;
  return <button type="button" className="secondary-button coach-trigger coach-launcher" data-coach-launcher aria-label="AI Coach" aria-haspopup="dialog" aria-controls="ai-coach-panel" aria-expanded={coach.isOpen} onClick={event => coach.isOpen ? coach.closeCoach() : coach.openCoach({}, event.currentTarget)}><Sparkles size={17} aria-hidden="true" /><span>AI Coach</span>{coach.busy || coach.acceptingProposalID ? <span className="coach-indicator" role="status" aria-label="Coach is working" /> : coach.unread ? <span className="coach-indicator coach-unread" role="status" aria-label="Coach response ready" /> : null}</button>;
}
