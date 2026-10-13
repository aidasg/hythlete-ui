import { WorkoutBuilder } from './builder/WorkoutBuilder';
import type { WorkoutRequest, WorkoutResponse } from '../services/workoutApi';
export function StructuredWorkoutForm({ initialWorkout, workoutId, onCreated }: { initialWorkout: WorkoutRequest; workoutId?: number; onCreated: (w: WorkoutResponse) => void }) {
  return <WorkoutBuilder selectedDate={initialWorkout.date || ''} initialWorkout={initialWorkout} workoutId={workoutId} onCreated={onCreated} />;
}
