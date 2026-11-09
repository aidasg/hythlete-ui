import { useMemo, useState } from 'react';
import type { WorkoutResponse } from '../services/workoutApi';
import { buildWorkoutTimeline, timelineTime } from '../services/workoutTimeline';
import { ActivityIdentity } from './ActivityIdentity';
import { resolveActivityIdentity, type ActivityCatalog } from '../services/activityIdentity';
import { WorkoutTimeline } from './WorkoutTimeline';

export function WorkoutCalendarCard({ workout, activities, onSelect, disabled = false }: { workout: WorkoutResponse; activities?: ActivityCatalog; onSelect: (workout: WorkoutResponse) => void; disabled?: boolean }) {
  const data = useMemo(() => buildWorkoutTimeline(workout), [workout]);
  const [focused, setFocused] = useState(false);
  const title = workout.title || workout.subtype || resolveActivityIdentity(workout.sport, activities).name;
  const status = workout.completed ? 'Completed' : workout.planned ? 'Planned' : 'Draft';
  const fallback = [workout.blocks?.some(block => block.completion === 'distance') ? 'Distance targets' : undefined, workout.blocks?.length ? `${workout.blocks.length} ${workout.blocks.length === 1 ? 'block' : 'blocks'}` : undefined].filter(Boolean).join(' / ').replace(/_/g, ' ');
  return <button type="button" className="calendar-session-card" onClick={() => onSelect(workout)} disabled={disabled} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
    <span className="calendar-session-heading">
      <ActivityIdentity sport={workout.sport} activities={activities} compact tooltipOpen={focused} />
      <span className="calendar-session-title">{title}</span>
    </span>
    <span className="calendar-session-meta"><span data-status={status.toLowerCase()}>{status}</span><span>{typeof workout.duration_minutes === 'number' ? `${Math.round(workout.duration_minutes)} min` : data.totalSeconds ? timelineTime(data.totalSeconds) : null}</span></span>
    <WorkoutTimeline workout={workout} miniature />
    {(!data.supported || !data.intervals.length) && fallback && <small className="calendar-session-note">{fallback}</small>}
    {data.intervals.length > 0 && data.partial && <small className="calendar-session-note">Partial timeline</small>}
  </button>;
}
