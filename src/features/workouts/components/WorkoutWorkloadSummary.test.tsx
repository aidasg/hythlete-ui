import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { WorkoutWorkloadSummary } from './WorkoutWorkloadSummary';
import { WorkoutDetailPanel } from './WorkoutDetailPanel';
vi.mock('./WorkoutImpactPanel', () => ({ WorkoutImpactPanel: () => <div /> }));

it('separates bodyweight reps, hold time, and estimated volume', () => {
  render(<WorkoutWorkloadSummary workload={{ model_version: 'strength-workload-v3', bodyweight_kg: 75, bodyweight_reps: 45, hold_seconds: 180, external_volume_kg_reps: 0, estimated_volume_kg_reps: 2362.5, resistance_time_kg_seconds: 9450, sets: 6, partial_sets: 1, set_estimates: [{ exercise_code: 'push_up', set_order: 1, estimate: { partial_reasons: ['Assistance is unspecified'] } }] }} />);
  expect(screen.getByText('Bodyweight work: 45 reps')).toBeInTheDocument();
  expect(screen.getByText('Timed holds: 3 min total hold')).toBeInTheDocument();
  expect(screen.getByText(/Using 75 kg profile bodyweight/)).toBeInTheDocument();
  expect(screen.getByText(/1 of 6 sets have partial estimates/)).toBeInTheDocument();
  expect(screen.getByText(/Assistance is unspecified/)).toBeInTheDocument();
  expect(screen.queryByText(/weight unset/)).not.toBeInTheDocument();
});

it('offers recalculation for completed manual workouts without a FIT file', () => {
  const recalculate = vi.fn();
  const workout = { id: 3, completed: true, can_reanalyse: false };
  const { rerender } = render(<WorkoutDetailPanel workout={workout} isLoading={false} errorMessage={null} onRecalculateLoad={recalculate} />);
  fireEvent.click(screen.getByRole('button', { name: 'Recalculate load' }));
  expect(recalculate).toHaveBeenCalledWith(workout);
  rerender(<WorkoutDetailPanel workout={workout} isLoading={false} errorMessage={null} onRecalculateLoad={recalculate} isRecalculatingLoad />);
  expect(screen.getByRole('button', { name: 'Recalculating load...' })).toBeDisabled();
  rerender(<WorkoutDetailPanel workout={{ id: 3, completed: false }} isLoading={false} errorMessage={null} onRecalculateLoad={recalculate} />);
  expect(screen.queryByRole('button', { name: 'Recalculate load' })).not.toBeInTheDocument();
});

it('labels legacy bodyweight sets from catalog metadata while retaining saved analysis', () => {
  const workout = { completed: true, category: 'strength', loads: { strength_load: 123 }, components: [{ type: 'exercise', exercise_code: 'push_up', sets: [{ reps: 15 }] }] };
  render(<WorkoutDetailPanel workout={workout} exercises={[{ code: 'push_up', load_profile: { bodyweight: true, bodyweight_fraction: .7 } }]} isLoading={false} errorMessage={null} />);
  expect(screen.getByText('15 reps · Bodyweight')).toBeInTheDocument();
  expect(screen.queryByText(/weight unset/)).not.toBeInTheDocument();
  expect(screen.getByText('123.0')).toBeInTheDocument();
  expect(workout).not.toHaveProperty('workload');
});
