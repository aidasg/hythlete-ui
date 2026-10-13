import type { WorkoutCatalogResponse } from '../../services/workoutApi';
import type { SessionBlock, SessionMovement } from '../../services/sessionStructure';
import { blockSummary, displayName } from '../../services/workoutBuilder';
import { DurationField, EffortEditor, ExerciseEditor, NumberField } from './TargetEditors';

type Props = { block: SessionBlock; catalog: WorkoutCatalogResponse; log: boolean; legacy?: boolean; general?: boolean; recordingPlan?: boolean; onChange: (b: SessionBlock) => void; onDuplicate: () => void; onRemove: () => void; onMove: (direction: number) => void; first: boolean; last: boolean };
export function BlockEditor({ block: b, catalog, log, legacy, general, recordingPlan, onChange, onDuplicate, onRemove, onMove, first, last }: Props) {
  const movements = b.movements || [];
  const zones = catalog.effort_zones || [];
  const format = b.format || 'steady';
  function movement(index: number, value: SessionMovement) { onChange({ ...b, movements: movements.map((m, i) => i === index ? value : m) }); }
  return <details className="builder-block" open><summary>{blockSummary(b)}</summary>
    {format !== 'straight_sets' && <div className="builder-field-grid">
      {['steady', 'intervals'].includes(format) && !legacy && !general && <label>Complete by<select value={b.completion || 'time'} onChange={e => onChange({ ...b, completion: e.target.value })}><option value="time">Time</option><option value="distance">Distance</option>{log && <option value="manual">Recorded work</option>}</select></label>}
      {format === 'intervals' ? <><NumberField label="Repeats" min={1} step="1" value={b.rounds} onChange={v => onChange({ ...b, rounds: v })} />{b.completion === 'time' && <DurationField label="Work per interval" seconds={b.work_seconds} onChange={v => onChange({ ...b, work_seconds: v })} />}<DurationField label="Recovery per interval" seconds={b.rest_seconds} onChange={v => onChange({ ...b, rest_seconds: v })} /></> : <>
        {(b.completion === 'time' || log) && <DurationField label={log ? 'Elapsed block time' : ['amrap', 'for_time'].includes(format) ? 'Time cap' : 'Duration'} seconds={b.duration_seconds} onChange={v => onChange({ ...b, duration_seconds: v })} />}
        {['circuit', 'for_time'].includes(format) && <NumberField label="Rounds" min={1} step="1" value={b.rounds} onChange={v => onChange({ ...b, rounds: v })} />}
        {format === 'emom' && <DurationField label="Interval length" seconds={b.work_seconds} onChange={v => onChange({ ...b, work_seconds: v })} />}
      </>}
    </div>}
    {movements.map((m, i) => <div className="builder-movement" key={i}>{m.sets || m.exercise_code ? <ExerciseEditor value={m} onChange={v => movement(i, v)} catalog={catalog} recorded={log} /> : <>
      <details><summary>Activity: {displayName(m.sport)}</summary><label>Activity<select value={m.sport || ''} onChange={e => movement(i, { ...m, sport: e.target.value })}>{!catalog.activities?.some(a => a.code === m.sport) && <option value={m.sport}>{displayName(m.sport)}</option>}{catalog.activities?.map(a => <option key={a.code} value={a.code}>{a.name}</option>)}</select></label></details>
      {(b.completion === 'distance' || log || legacy || movements.length > 1) && <NumberField label={format === 'intervals' ? 'Distance per work interval (m)' : 'Distance (m, optional for timed work)'} value={m.distance_m} onChange={v => movement(i, { ...m, distance_m: v })} />}
      {log && <DurationField label="Recorded activity time" seconds={m.duration_seconds} onChange={v => movement(i, { ...m, duration_seconds: v })} />}
      {!general && <EffortEditor value={m} onChange={v => movement(i, v)} zones={zones} measured={log} />}
    </>}{movements.length > 1 && <button type="button" onClick={() => onChange({ ...b, movements: movements.filter((_, j) => i !== j) })}>Remove movement</button>}</div>)}
    {format === 'intervals' && (b.rest_seconds || 0) > 0 && <fieldset><legend>Recovery target</legend><EffortEditor measured={log} zones={zones} value={b.recovery || { sport: movements[0]?.sport, intensity_zone: 'recovery' }} onChange={v => onChange({ ...b, recovery: { ...v, sport: movements[0]?.sport } })} /></fieldset>}
    {(recordingPlan || ['circuit', 'amrap', 'emom', 'for_time'].includes(format)) && <div className="builder-row-actions"><button type="button" onClick={() => onChange({ ...b, movements: [...movements, { sets: [{ set_order: 1 }] }] })}>Add exercise</button><button type="button" onClick={() => onChange({ ...b, movements: [...movements, { sport: movements.find(m => m.sport)?.sport || 'running' }] })}>Add activity</button></div>}
    <div className="builder-row-actions"><button type="button" disabled={first} aria-label="Move block up" onClick={() => onMove(-1)}>Move up</button><button type="button" disabled={last} aria-label="Move block down" onClick={() => onMove(1)}>Move down</button>{!recordingPlan && <button type="button" onClick={onDuplicate}>Duplicate</button>}<button type="button" onClick={onRemove}>Remove</button></div>
    <details><summary>Rename block</summary><label>Block name<input value={b.label || ''} onChange={e => onChange({ ...b, label: e.target.value })} /></label></details>
  </details>;
}
