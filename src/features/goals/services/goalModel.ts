import type { GoalDefinition, GoalTarget } from './goalApi';
import { weightFromKG, weightToKG, distanceFactor, formatMeasurement, type UnitPreferences } from '@/services/units';
export function newGoal(date: string, role = 'primary'): GoalDefinition {
 return { title: '', notes: '', template_code: '', intent: 'improve', subject: { kind: 'discipline', code: 'running', activities: ['running'] }, starts_on: date, deadline: '', event_name: '', event_date: '', role, rank: 1, status: 'active', capabilities: [] };
}
export function goalError(d: GoalDefinition): string | undefined {
 if (!d.title?.trim()) return 'Give your goal a title or choose a goal template.';
 if (!d.subject?.code?.trim()) return 'Choose the activity or subject for this goal.';
 if (!d.starts_on) return 'Choose a start date.';
 if ((d.deadline && d.deadline < d.starts_on) || (d.event_date && d.event_date < d.starts_on)) return 'The target or event date must be on or after the start date.';
 const t = d.target;
 if (t?.kind === 'milestone' && !t.label?.trim()) return 'Describe the milestone you want to reach.';
 if (t && t.kind !== 'milestone' && (!(typeof t.value === 'number') || !Number.isFinite(t.value) || t.value <= 0)) return 'Enter a positive target.';
 if (t?.metric === 'time_seconds' && d.subject?.kind !== 'benchmark_variant' && !(t.distance_m && t.distance_m > 0)) return 'Enter the distance for this timed effort.';
 if (t?.metric === 'power_watts' && d.subject?.kind !== 'benchmark_variant' && !(t.duration_seconds && t.duration_seconds > 0)) return 'Enter the effort duration.';
 if (t?.metric === 'load_kg' && d.subject?.kind !== 'benchmark_variant' && !(t.reps && t.reps > 0)) return 'Enter the repetition count.';
 if (t && ['load_kg', 'estimated_1rm_kg'].includes(t.metric || '') && !['exercise', 'benchmark_variant'].includes(d.subject?.kind || '')) return 'Choose an exercise for a strength target.';
}
export function measurementLabel(d: GoalDefinition) {
 const t = d.target;
 if (!t || t.kind === 'milestone') return 'Manual tracking';
 if (t.kind === 'weekly') return 'Automatic evidence from completed workouts';
 if (t.metric === 'estimated_1rm_kg') return 'Estimated evidence; a performed lift is separate';
 if (d.subject?.kind === 'benchmark_variant' || t.metric === 'load_kg' || (['time_seconds', 'power_watts', 'distance_m'].includes(t.metric || '') && d.subject?.activities?.length === 1)) return 'Automatic evidence from comparable completed efforts';
 return 'Manual tracking';
}
export function inputValue(value: number | undefined, metric: string | undefined, units: UnitPreferences): number | '' {
 if (value === undefined) return '';
 if (['load_kg', 'estimated_1rm_kg', 'body_weight_kg'].includes(metric || '')) return weightFromKG(value, units.weightUnit);
 if (metric === 'distance_m') return value / distanceFactor(units.distanceUnit);
 if (metric === 'time_seconds') return value / 60;
 return value;
}
export function storedValue(value: number, metric: string | undefined, units: UnitPreferences): number {
 if (['load_kg', 'estimated_1rm_kg', 'body_weight_kg'].includes(metric || '')) return weightToKG(value, units.weightUnit);
 if (metric === 'distance_m') return value * distanceFactor(units.distanceUnit);
 if (metric === 'time_seconds') return value * 60;
 return value;
}
export function targetLabel(t: GoalTarget | undefined, units: UnitPreferences) {
 if (!t) return 'Ongoing development';
 if (t.kind === 'milestone') return t.label;
 if (t.kind === 'weekly') return `${t.value} ${t.metric} per week`;
 return `${t.direction === 'lower' ? 'At most' : 'At least'} ${formatMeasurement(t.value, t.unit, undefined, units)}${t.distance_m ? ` over ${formatMeasurement(t.distance_m, 'm', undefined, units)}` : ''}${t.reps ? ` for ${t.reps} reps` : ''}${t.duration_seconds ? ` over ${Math.round(t.duration_seconds / 60 * 100) / 100} min` : ''}`;
}
export const human = (value: string | undefined) => (value || '').replace(/_/g, ' ');
