import { WorkoutBuilder } from './builder/WorkoutBuilder';
import type { WorkoutRequest } from '../services/workoutApi';
export function StructuredSessionEditor({ value, onChange }: { value: WorkoutRequest; onChange: (v: WorkoutRequest) => void }) {
  return <WorkoutBuilder selectedDate={value.date || ''} initialWorkout={value} onApply={onChange} />;
}
