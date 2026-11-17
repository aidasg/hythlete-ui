import type { components } from '@/services/api/types';

type Workload = components['schemas']['workout.WorkloadSummary'];
const amount = (n?: number) => (n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

export function WorkoutWorkloadSummary({ workload }: { workload?: Workload }) {
  if (!workload || workload.model_version !== 'strength-workload-v3') return null;
  return <section className="workout-workload-summary" aria-label="Exercise workload">
    <p>External volume: {amount(workload.external_volume_kg_reps)} kg·reps</p>
    {!!workload.bodyweight_reps && <p>Bodyweight work: {workload.bodyweight_reps} reps</p>}
    {!!workload.hold_seconds && <p>Timed holds: {workload.hold_seconds}s total hold</p>}
    <p>Estimated resistance volume: {amount(workload.estimated_volume_kg_reps)} kg·reps</p>
    <details><summary>Workload estimate details</summary>
      <p>{workload.bodyweight_kg ? `Using ${amount(workload.bodyweight_kg)} kg profile bodyweight at calculation time.` : 'Profile bodyweight unavailable; affected sets use a reps/time estimate.'}</p>
      {!!workload.hold_seconds && <p>Resistance × hold time: {amount(workload.resistance_time_kg_seconds)} kg·seconds</p>}
      {!!workload.partial_sets && <p>{workload.partial_sets} of {workload.sets} sets have partial estimates because resistance information is missing or uncertain.</p>}
      <ul>{workload.set_estimates?.map((set, i) => <li key={i}>{set.exercise_code?.replace(/_/g, ' ')} · Set {set.set_order}: {set.estimate?.effective_resistance_kg == null ? 'Resistance estimate incomplete' : `Approx. ${amount(set.estimate.effective_resistance_kg)} kg resistance`}{set.estimate?.partial_reasons?.map(reason => <span key={reason}> · {reason}</span>)}</li>)}</ul>
      <p>Resistance and training-load scores use exercise-specific estimates. Hold seconds and rep volume are displayed separately.</p>
    </details>
  </section>;
}
