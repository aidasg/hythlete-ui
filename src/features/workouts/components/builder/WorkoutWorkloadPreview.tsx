import { useState } from 'react';
import { useWorkoutImpactPreview } from '../../hooks/useWorkoutImpactPreview';
import type { WorkoutRequest } from '../../services/workoutApi';
import { WorkoutWorkloadSummary } from '../WorkoutWorkloadSummary';

function WorkloadEstimate({ workout, enabled }: { workout: WorkoutRequest; enabled: boolean }) {
  const result = useWorkoutImpactPreview(workout, enabled, true);
  return <section aria-label="Workload preview" aria-busy={result.loading}>
    {result.loading && <p role="status">Updating workload estimate...</p>}
    {result.error && <p role="alert">{result.error.message} <button type="button" onClick={() => void result.retry()}>Retry workload estimate</button></p>}
    {result.preview && <WorkoutWorkloadSummary workload={result.preview.workload} />}
  </section>;
}

export function WorkoutWorkloadPreview({ workout, enabled }: { workout: WorkoutRequest; enabled: boolean }) {
  const [open, setOpen] = useState(false);
  return <details onToggle={event => setOpen(event.currentTarget.open)}><summary>Estimated exercise workload</summary>{open && <WorkloadEstimate workout={workout} enabled={enabled} />}</details>;
}
