import type { CoachResult } from "../types";

type Evidence = NonNullable<CoachResult["evidence"]>[number];

export type CoachSource =
  | { kind: "workout"; workoutID: number; date?: string }
  | { kind: "readiness" | "profile"; date: string }
  | { kind: "context"; reference: string; tool: string; date: string };

const labels: Record<string, string> = {
  get_athlete_context: "Athlete context",
  get_readiness: "Training readiness",
  get_training_progress: "Training progress",
  get_training_strategy: "Training strategy",
  list_workouts: "Training history",
  get_workout: "Workout details",
  compare_workout: "Workout comparison",
  get_training_catalog: "Training catalog",
  preview_workout: "Estimated workout demands",
  create_workout_proposal: "Workout draft",
};
const knownTool = (name: string) => Object.prototype.hasOwnProperty.call(labels, name);

export function sourceLabel(id: string) {
  const [name = "", value] = id.split(":");
  if (name === "workout" && value) return `Workout #${value}`;
  return knownTool(name) ? labels[name]! : "Training source";
}

export function sourceFromEvidence(evidence: Evidence): CoachSource | undefined {
  const { id, date, workout_id } = evidence;
  if (workout_id && Number.isSafeInteger(workout_id) && workout_id > 0 && id === `workout:${workout_id}`) {
    return { kind: "workout", workoutID: workout_id, date };
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return;
  if (id === `get_readiness:${date}`) return { kind: "readiness", date };
  if (id === `get_athlete_context:${date}`) return { kind: "profile", date };
  const tool = id?.split(":")[0];
  if (tool && knownTool(tool) && id === `${tool}:${date}`) return { kind: "context", reference: id, tool, date };
}
