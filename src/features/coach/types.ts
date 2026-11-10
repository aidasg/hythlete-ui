import type { components } from "@/services/api/types";
import type { StrategyConstraints } from "@/features/strategy/services/strategyConstraints";
export type CoachAction = "coach_chat" | "review_recent_workout" | "plan_next_workout" | "adapt_session" | "plan_training";
export type CoachTarget = {
  surface: "today" | "workout" | "calendar" | "plan" | "progress" | "profile" | "execution";
  date?: string; workoutID?: number; title?: string;
  progressView?: string; exerciseCode?: string;
  constraints?: StrategyConstraints;
};
export type CoachIntent = { action?: CoachAction; target?: CoachTarget; conversationID?: number; proposalID?: number; changeID?: number };
export type CoachResult = components["schemas"]["ai.TurnResult"];
export const coachActions: Record<CoachAction, string> = {
  coach_chat: "Ask Coach", review_recent_workout: "Coach insights", plan_next_workout: "Plan with Coach",
  adapt_session: "Adapt with Coach", plan_training: "Plan my training with Coach",
};
export function contextLabel(target: CoachTarget | null) {
  if (!target) return "Your training";
  const subject = target.title || (target.workoutID ? `Saved workout #${target.workoutID}` : target.exerciseCode?.replace(/_/g, " ") || target.progressView?.replace(/_/g, " ") || ({ today: "Today", plan: "Your training plan", progress: "Your progress", calendar: "Calendar", profile: "Your goals", workout: "Saved workout", execution: "Saved workout" }[target.surface]));
  return `${subject}${target.date ? ` · ${target.date}` : ""}`;
}

export function coachStarter(action: CoachAction, target: CoachTarget | null) {
  switch (action) {
    case "review_recent_workout": return "Review this workout against its prescription, my recent training, and my goals.";
    case "plan_next_workout": return "Plan a workout that fits my training goals and readiness.";
    case "adapt_session": return "Help me adapt this planned workout.";
    case "plan_training": return "Draft a training plan around my goals and weekly schedule.";
    case "coach_chat": return target ? `Explain ${contextLabel(target)} using my saved training data.` : "";
  }
}
