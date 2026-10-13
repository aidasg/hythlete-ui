import { useQuery } from '@tanstack/react-query';
import { listBenchmarks } from '@/features/progress/services/progressApi';
import type { WorkoutRequest } from '../../services/workoutApi';
import { DurationField, NumberField } from './TargetEditors';
import { displayName } from '../../services/workoutBuilder';
export function BenchmarkFields({ value, onChange }: { value: WorkoutRequest; onChange: (v: WorkoutRequest) => void }) {
  const query = useQuery({ queryKey: ['progress', 'benchmarks'], queryFn: async () => { const r = await listBenchmarks(); if (r.error) throw Error("Could not load benchmarks"); return r.data; } });
  const variants = query.data?.flatMap(b => (b.variants || []).map(v => ({ ...v, title: `${b.name} · ${v.name}` }))) || [];
  const result = value.benchmark_result;
  const variant = variants.find(v => v.id === result?.variant_id);
  function patch(p: Partial<NonNullable<WorkoutRequest['benchmark_result']>>) { onChange({ ...value, benchmark_result: { ...result, ...p } }); }
  const details = result?.details || {};
  return <fieldset><legend>Benchmark result</legend>{query.error && <p role="alert">Could not load benchmarks. <button type="button" onClick={() => void query.refetch()}>Retry</button></p>}
    <label>Exact benchmark variant<select value={result?.variant_id || ''} onChange={e => onChange({ ...value, benchmark_result: e.target.value ? { variant_id: Number(e.target.value), completed_as_prescribed: false } : undefined })}><option value="">No benchmark result</option>{variants.map(v => <option key={v.id} value={v.id}>{v.title}</option>)}</select></label>
    {result?.variant_id && <>{variant?.score_type === 'time_seconds' ? <DurationField label="Completion time" seconds={result.score_value} onChange={v => patch({ score_value: v })} /> : <NumberField label={variant?.score_type === 'rounds_reps' ? 'Total scored reps' : displayName(variant?.score_type || 'score')} value={result.score_value} onChange={v => patch({ score_value: v })} />}
      {variant?.score_type === 'rounds_reps' && <div className="builder-field-grid">{['rounds', 'extra_reps'].map(key => <NumberField key={key} label={displayName(key)} value={typeof details[key] === 'number' ? details[key] : undefined} onChange={v => patch({ details: { ...details, [key]: v } as NonNullable<WorkoutRequest["benchmark_result"]>["details"] })} />)}</div>}
      <label className="builder-check"><input type="checkbox" checked={!!result.completed_as_prescribed} onChange={e => patch({ completed_as_prescribed: e.target.checked })} />Completed the exact prescribed standard</label></>}
  </fieldset>;
}
