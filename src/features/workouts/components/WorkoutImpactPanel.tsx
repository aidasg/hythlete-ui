import { useState } from "react";
import { BodyVisualization } from "@/components/body/BodyVisualization";
import { useWorkoutImpactPreview } from "../hooks/useWorkoutImpactPreview";
import { recentBodyRegions, sessionBodyRegions } from "../services/bodyImpact";
import type { PlannedImpactResponse, WorkoutRequest, WorkoutResponse } from "../services/workoutApi";

function ImpactForecast({ preview }: { preview: PlannedImpactResponse }) {
  const [view, setView] = useState<"before" | "after_today" | "tomorrow">("before");
  const [open, setOpen] = useState(false);
  return <details className="body-forecast" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Recent load forecast: Before / After / Tomorrow</summary>
    {open && <><p>This separate estimate shows how the session could change your recent training load.</p>
      <div className="body-layer-switch" role="group" aria-label="Forecast time">
        {([ ["before", "Before"], ["after_today", "After"], ["tomorrow", "Tomorrow"] ] as const).map(([key, label]) => <button type="button" key={key} aria-pressed={view === key} onClick={() => setView(key)}>{label}</button>)}
      </div>
      <BodyVisualization key={view} mode="recent-load" regions={recentBodyRegions(preview[view])} />
      <details><summary>Estimate details</summary><p>Confidence: {preview.confidence === undefined ? "Not available" : `${Math.round(preview.confidence * 100)}%`}</p>{preview.reasons?.map(reason => <p key={reason}>{reason}</p>)}</details>
    </>}
  </details>;
}

export function PlannedWorkoutImpact({ workout, enabled = true }: { workout: WorkoutRequest; enabled?: boolean }) {
  const estimate = useWorkoutImpactPreview(workout, enabled);
  if (workout.completed) return null;
  return <section className="workout-body-impact" aria-label="Expected areas worked" aria-busy={estimate.loading}>
    <h3>Expected areas worked</h3>
    {!enabled && <p>Complete the session details to estimate the areas worked.</p>}
    {estimate.loading && <p role="status">Updating area estimates...</p>}
    {estimate.error && <p role="alert">{estimate.error.message} <button type="button" onClick={() => void estimate.retry()}>Retry estimate</button></p>}
    {estimate.preview && <><BodyVisualization mode="session-impact" regions={sessionBodyRegions(estimate.preview)} /><ImpactForecast preview={estimate.preview} /></>}
  </section>;
}

export function WorkoutImpactPanel({ workout }: { workout: WorkoutResponse }) {
  // Completed loads are persisted performance estimates. Never preview them again.
  if (workout.completed) return <section className="workout-body-impact" aria-label="Areas worked"><h3>Areas worked</h3><p>Based on your recorded performance.</p><BodyVisualization mode="session-impact" regions={sessionBodyRegions(workout)} /></section>;
  const request: WorkoutRequest = {
    date: workout.date, category: workout.category, subtype: workout.subtype, sport: workout.sport,
    title: workout.title, duration_minutes: workout.duration_minutes, rpe: workout.rpe,
    planned: true, completed: false, components: workout.components,
    structure_version: workout.structure_version, blocks: workout.blocks,
  };
  return <PlannedWorkoutImpact workout={request} />;
}
