import { useEffect, useRef, useId, useMemo, useState, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { WorkoutResponse } from '../services/workoutApi';
import { buildWorkoutTimeline, intervalTarget, timelineTime, timelineZones, timelineZone, type WorkoutTimelineData, type TimelineInterval } from '../services/workoutTimeline';

const height = 282;
const left = 88;
const right = 12;
const top = 16;
const bottom = 248;
const row = (bottom - top) / timelineZones.length;

function TimelinePlot({ data, mini = false, selected = 0, onSelect }: {
  data: WorkoutTimelineData; mini?: boolean; selected?: number; onSelect?: (index: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [measuredWidth, setMeasuredWidth] = useState(800);
  const width = mini ? 800 : measuredWidth;
  useEffect(() => {
    if (mini || !svgRef.current || typeof ResizeObserver === 'undefined') return;
    const element = svgRef.current;
    const update = () => setMeasuredWidth(Math.max(260, element.getBoundingClientRect().width || 800));
    update();
    const observer = new ResizeObserver(update); observer.observe(element);
    return () => observer.disconnect();
  }, [mini]);
  const uid = useId();
  const x = (seconds: number) => (mini ? 0 : left) + seconds / data.totalSeconds * (mini ? width : width - left - right);
  const y = (zone: TimelineInterval['zone']) => bottom - (timelineZones.indexOf(zone) + 1) * row;
  function navigate(event: KeyboardEvent<SVGSVGElement>) {
    const next = event.key === 'ArrowRight' ? selected + 1 : event.key === 'ArrowLeft' ? selected - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? data.intervals.length - 1 : null;
    if (next === null || !onSelect) return;
    event.preventDefault(); onSelect(Math.min(data.intervals.length - 1, Math.max(0, next)));
  }
  const current = data.intervals[selected];
  return <svg ref={svgRef} className={mini ? 'workout-timeline-mini' : 'workout-timeline-plot'} viewBox={`0 0 ${width} ${mini ? bottom : height}`}
    preserveAspectRatio={mini ? 'none' : 'xMidYMid meet'} role={mini ? undefined : 'group'} aria-hidden={mini || undefined}
    aria-labelledby={mini ? undefined : `${uid}-title`} aria-describedby={mini ? undefined : `${uid}-description`}
    tabIndex={mini ? undefined : 0} onKeyDown={mini ? undefined : navigate}>
    {!mini && <><title id={`${uid}-title`}>{data.planned ? 'Planned' : 'Recorded'} effort by active time</title>
      <desc id={`${uid}-description`}>Interval widths show duration and heights show effort zones. Use Left and Right arrows to select an interval. {current ? `Selected interval ${selected + 1}, ${current.zone.label}, ${timelineTime(current.start)} to ${timelineTime(current.end)}.` : ''}</desc>
      {timelineZones.map((zone) => <g key={zone.key}><line className="timeline-grid-line" x1={left} x2={width-right} y1={y(zone)} y2={y(zone)} /><text x={left-8} y={y(zone)+row/2+4} textAnchor="end">{zone.label}</text></g>)}
      {(width < 500 ? [0,.5,1] : [0,.25,.5,.75,1]).map(ratio => <text key={ratio} x={x(data.totalSeconds*ratio)} y={bottom+19} textAnchor={ratio === 0 ? 'start' : ratio === 1 ? 'end' : 'middle'}>{timelineTime(data.totalSeconds*ratio)}</text>)}
      <text className="timeline-axis-caption" x={width/2} y={height-2} textAnchor="middle">Active time</text></>}
    {data.intervals.map((interval, index) => <g key={interval.key}>
      <rect x={x(interval.start)} y={y(interval.zone)} width={x(interval.end)-x(interval.start)} height={bottom-y(interval.zone)} fill={interval.zone.color}
        opacity={mini || index === selected ? .92 : .64} className={mini ? undefined : 'timeline-interval'} onClick={mini ? undefined : () => onSelect?.(index)}>
        {!mini && <title>{`Interval ${index+1}: ${interval.zone.label}, ${timelineTime(interval.end-interval.start)}`}</title>}
      </rect>
      {!mini && <line x1={x(interval.start)} x2={x(interval.start)} y1={y(interval.zone)} y2={bottom} className="timeline-divider" />}
      {!mini && index === selected && <rect className="timeline-selection" x={x(interval.start)} y={y(interval.zone)} width={x(interval.end)-x(interval.start)} height={bottom-y(interval.zone)} />}
    </g>)}
  </svg>;
}
function IntervalDetails({ interval, index }: { interval: TimelineInterval; index: number }) {
  const metrics = interval.component.metrics;
  const target = intervalTarget(interval.component);
  const values = [
    ['Average heart rate', metrics?.avg_heart_rate_bpm, 'bpm'], ['Maximum heart rate', metrics?.max_heart_rate_bpm, 'bpm'],
    ['Average power', metrics?.avg_power_watts, 'W'], ['Maximum power', metrics?.max_power_watts, 'W'],
    ['Average speed', metrics?.avg_speed_mps, 'm/s'], ['Maximum speed', metrics?.max_speed_mps, 'm/s'],
    ['Distance', interval.component.distance_m, 'm'], ['Ascent', metrics?.total_ascent_m, 'm'], ['Descent', metrics?.total_descent_m, 'm'],
  ] as const;
  const timestamp = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', month: 'short', day: 'numeric' }) : undefined;
  const start = timestamp(interval.recordedStart);
  const end = timestamp(interval.recordedEnd);
  return <section className="timeline-interval-details" aria-label={`Interval ${index+1} details`}>
    <div className="timeline-detail-heading"><strong>Interval {index+1}</strong><span className="timeline-zone-label"><i style={{ background: interval.zone.color }} />{interval.zone.label}</span></div>
    <p className="timeline-range">{timelineTime(interval.start)} &ndash; {timelineTime(interval.end)} <span>{timelineTime(interval.end-interval.start)} active</span></p>
    <dl className="timeline-metrics">
      {values.filter(([,value]) => typeof value === 'number' && Number.isFinite(value)).map(([label,value,unit]) => <div key={label}><dt>{label}</dt><dd>{Number(value?.toFixed(2))} <small>{unit}</small></dd></div>)}
      {target && <div><dt>Prescribed target</dt><dd>{target}</dd></div>}
      {interval.alignment && interval.alignment !== 'unmatched' && interval.component.intensity_zone && <div><dt>Prescribed zone</dt><dd>{timelineZone(interval.component.intensity_zone).label}</dd></div>}
      {interval.repetition && <div><dt>Repetition</dt><dd>{interval.repetition}</dd></div>}
    </dl>
    {(start || end) && <p className="timeline-note">Recorded {start}{end ? ` - ${end}` : ''}</p>}
    {interval.component.effort?.source?.startsWith('relative_') && <p className="timeline-note">Activity-relative zone estimate{typeof interval.component.effort.confidence === 'number' ? ` (${Math.round(interval.component.effort.confidence * 100)}% confidence)` : ''}</p>}
    {interval.alignment === 'estimated' && <p className="timeline-note">Estimated alignment to the original workout plan</p>}
    {interval.alignment === 'unmatched' && <p className="timeline-note">Not matched to a planned interval</p>}
  </section>;
}
function TimelineContent({ data }: { data: WorkoutTimelineData }) {
  const [selected, setSelected] = useState(0);
  const index = Math.min(selected, data.intervals.length - 1);
  const interval = data.intervals[index];
  if (!interval) return <p className="muted-copy">A zone timeline is unavailable because interval timing was not recorded.</p>;
  return <>
    <TimelinePlot data={data} selected={index} onSelect={setSelected} />
    {data.partial && <p className="timeline-note" role="note">Partial timeline: only intervals with known durations are shown. Untimed activity is not included.</p>}
    <div className="timeline-navigation"><button type="button" className="icon-button" aria-label="Previous interval" disabled={index===0} onClick={() => setSelected(index-1)}><ChevronLeft size={18}/></button><span aria-live="polite">Interval {index+1} of {data.intervals.length} &middot; {interval.zone.label}</span><button type="button" className="icon-button" aria-label="Next interval" disabled={index===data.intervals.length-1} onClick={() => setSelected(index+1)}><ChevronRight size={18}/></button></div>
    <IntervalDetails interval={interval} index={index}/>
    <details className="timeline-table-disclosure"><summary>All intervals</summary><div className="timeline-table-scroll"><table><caption>{data.planned ? 'Planned' : 'Recorded'} intervals in active-time order</caption><thead><tr><th scope="col">Interval</th><th scope="col">Active time</th><th scope="col">Duration</th><th scope="col">Zone</th><th scope="col">Target</th></tr></thead><tbody>{data.intervals.map((v,i) => <tr key={v.key} aria-current={i===index ? 'true' : undefined}><th scope="row"><button type="button" onClick={() => setSelected(i)} aria-label={`Show interval ${i+1}`}>{i+1}</button></th><td>{timelineTime(v.start)} - {timelineTime(v.end)}</td><td>{timelineTime(v.end-v.start)}</td><td>{v.zone.label}</td><td>{intervalTarget(v.component) || '-'}</td></tr>)}</tbody></table></div></details>
  </>;
}
export function WorkoutTimeline({ workout, miniature = false }: { workout: WorkoutResponse; miniature?: boolean }) {
  const data = useMemo(() => buildWorkoutTimeline(workout), [workout]);
  if (!data.supported) return null;
  if (miniature) return data.intervals.length ? <TimelinePlot data={data} mini /> : null;
  return <section className="workout-timeline" aria-label="Workout timeline"><div className="timeline-heading"><h3>{data.planned ? 'Planned effort' : 'Recorded effort'}</h3><span>{timelineTime(data.totalSeconds)} active</span></div><TimelineContent key={`${workout.id ?? workout.title}-${workout.started_at || workout.date}-${workout.completed}`} data={data}/></section>;
}
