import { useMemo } from 'react';
import type { WorkoutResponse } from '../services/workoutApi';
import { buildWorkoutTimeline, timelineTime } from '../services/workoutTimeline';
import { WorkoutTimeline } from './WorkoutTimeline';

export function WorkoutCalendarCard({ workout, onSelect, disabled = false }: { workout: WorkoutResponse; onSelect: (workout: WorkoutResponse) => void; disabled?: boolean }) {
  const data = useMemo(() => buildWorkoutTimeline(workout), [workout]);
  const title = workout.title || workout.subtype || workout.sport || 'Workout';
  const status = workout.completed ? 'Completed' : workout.planned ? 'Planned' : 'Draft';
  const fallback = [workout.sport || workout.category, workout.blocks?.some(block => block.completion === 'distance') ? 'Distance targets' : undefined, workout.blocks?.length ? `${workout.blocks.length} ${workout.blocks.length === 1 ? 'block' : 'blocks'}` : undefined].filter(Boolean).join(' / ').replace(/_/g, ' ');
  return <button type="button" className="calendar-session-card" onClick={() => onSelect(workout)} disabled={disabled}>
    <span className="calendar-session-title">{title}</span>
    <span className="calendar-session-meta"><span data-status={status.toLowerCase()}>{status}</span><span>{typeof workout.duration_minutes === 'number' ? `${Math.round(workout.duration_minutes)} min` : data.totalSeconds ? timelineTime(data.totalSeconds) : workout.sport}</span></span>
    <WorkoutTimeline workout={workout} miniature />
    {(!data.supported || !data.intervals.length) && fallback && <small className="calendar-session-note">{fallback}</small>}
    {data.intervals.length > 0 && data.partial && <small className="calendar-session-note">Partial timeline</small>}
  </button>;
}
