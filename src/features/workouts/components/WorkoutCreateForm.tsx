import { WorkoutBuilder } from './builder/WorkoutBuilder';
import type { PlannedImpactResponse, WorkoutCatalogResponse, WorkoutRequest, WorkoutResponse } from '../services/workoutApi';
type Props = {
  catalog: WorkoutCatalogResponse | null; selectedDate: string; initialWorkout?: WorkoutRequest; initialWorkoutKey?: string;
  initialImpactPreview?: PlannedImpactResponse; onCreated: (workout: WorkoutResponse) => void; showHeader?: boolean;
  submitLabel?: string; compact?: boolean; workoutId?: number;
};
export function WorkoutCreateForm(props: Props) {
  return <WorkoutBuilder key={props.initialWorkoutKey || props.workoutId || props.selectedDate} selectedDate={props.selectedDate} initialWorkout={props.initialWorkout} workoutId={props.workoutId} catalog={props.catalog} onCreated={props.onCreated} />;
}
