import { useUnits } from '@/services/useUnits';
import { formatWeight, formatDuration } from '@/services/units';
import type { components } from '@/services/api/types';

type Workload = components['schemas']['workout.WorkloadSummary'];

export function WorkoutWorkloadSummary({ workload }: { workload?: Workload }) {
  const units = useUnits();
  if (!workload || workload.model_version !== 'strength-workload-v3') return null;
  return <section className="workout-workload-summary" aria-label="Exercise workload">
    <p>External volume: {formatWeight(workload.external_volume_kg_reps || 0, units.weightUnit)}·reps</p>
    {!!workload.bodyweight_reps && <p>Bodyweight work: {workload.bodyweight_reps} reps</p>}
    {!!workload.hold_seconds && <p>Timed holds: {formatDuration(workload.hold_seconds)} total hold</p>}
    <p>Estimated resistance volume: {formatWeight(workload.estimated_volume_kg_reps || 0, units.weightUnit)}·reps</p>
    <details><summary>Workload estimate details</summary>
      <p>{workload.bodyweight_kg ? `Using ${formatWeight(workload.bodyweight_kg, units.weightUnit)} profile bodyweight at calculation time.` : 'Profile bodyweight unavailable; affected sets use a reps/time estimate.'}</p>
      {!!workload.hold_seconds && <p>Resistance × hold time: {formatWeight(workload.resistance_time_kg_seconds || 0, units.weightUnit)}·seconds</p>}
      {!!workload.partial_sets && <p>{workload.partial_sets} of {workload.sets} sets have partial estimates because resistance information is missing or uncertain.</p>}
      <ul>{workload.set_estimates?.map((set, i) => <li key={i}>{set.exercise_code?.replace(/_/g, ' ')} · Set {set.set_order}: {set.estimate?.effective_resistance_kg == null ? 'Resistance estimate incomplete' : `Approx. ${formatWeight(set.estimate.effective_resistance_kg, units.weightUnit)} resistance`}{set.estimate?.partial_reasons?.map(reason => <span key={reason}> · {reason}</span>)}</li>)}</ul>
      <p>Resistance and training-load scores use exercise-specific estimates. Hold seconds and rep volume are displayed separately.</p>
    </details>
  </section>;
}
