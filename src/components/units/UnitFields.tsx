import { useEffect, useRef, useState } from 'react';
import { useUnits } from '@/services/useUnits';
import { compactNumber, distanceFactor, metricDistanceSport, readableDistanceUnit, speedPolicy, speedText, speedToMPS, parsePace, weightFromKG, weightToKG, type ActivityUnits, type DistanceInputUnit, type DistanceUnit, type WeightUnit } from '@/services/units';

type FieldProps = { label: string; value?: number; onChange: (value: number | undefined) => void; min?: number; max?: number };
// Keep the entered text until an external value/unit changes. Presentation rounding never writes back.
export function ConvertedField({ label, value, onChange, unitKey, display, parse, min = 0, max = Infinity, pace = false }: FieldProps & { unitKey: string; display: (value: number) => string; parse: (text: string) => number; pace?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [edit, setEdit] = useState<{ value?: number; text: string; unitKey: string }>();
  const text = edit && Object.is(edit.value, value) && edit.unitKey === unitKey ? edit.text : value == null || !Number.isFinite(value) ? '' : display(value);
  const invalid = value !== undefined && (!Number.isFinite(value) || value < min || value > max);
  useEffect(() => { inputRef.current?.setCustomValidity(invalid ? pace ? 'Enter a positive pace as minutes:seconds (for example 5:30).' : 'Enter a valid value within the allowed range.' : ''); }, [invalid, pace]);
  function change(raw: string, input: HTMLInputElement) {
    const parsed = raw.trim() ? parse(raw) : undefined;
    const invalid = parsed !== undefined && (!Number.isFinite(parsed) || parsed < min || parsed > max);
    input.setCustomValidity(invalid ? pace ? 'Enter a positive pace as minutes:seconds (for example 5:30).' : 'Enter a valid value within the allowed range.' : '');
    const canonical = invalid ? NaN : parsed;
    setEdit({ value: canonical, text: raw, unitKey });
    onChange(canonical);
  }
  return <label>{label}<input ref={inputRef} type="text" inputMode={pace ? 'text' : 'decimal'} placeholder={pace ? 'm:ss' : undefined} value={text} aria-invalid={value !== undefined && !Number.isFinite(value) || undefined} onChange={e => change(e.target.value, e.currentTarget)} /></label>;
}
const numeric = (text: string) => /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text.trim()) ? Number(text) : NaN;
export function WeightField({ unit: override, ...props }: FieldProps & { unit?: WeightUnit }) {
  const units = useUnits(), unit = override || units.weightUnit;
  return <ConvertedField {...props} label={`${props.label.replace(/\s*\((?:kg|lb)(?:, optional)?\)|, (?:kg|lb)/g, '')} (${unit})`} unitKey={unit} display={v => compactNumber(weightFromKG(v, unit))} parse={text => weightToKG(numeric(text), unit)} />;
}
export function DistanceField({ sport, activities, defaultMeters = false, ...props }: FieldProps & { sport?: string; activities?: ActivityUnits[]; defaultMeters?: boolean }) {
  const { distanceUnit } = useUnits();
  const [selection, setSelection] = useState<{ preference: DistanceUnit; unit: DistanceInputUnit }>(() => ({ preference: distanceUnit, unit: props.value == null ? defaultMeters || metricDistanceSport(sport, activities) ? 'm' : distanceUnit : readableDistanceUnit(props.value, distanceUnit, sport, activities) }));
  const initial = props.value == null ? defaultMeters || metricDistanceSport(sport, activities) ? 'm' : distanceUnit : readableDistanceUnit(props.value, distanceUnit, sport, activities);
  const unit = selection?.preference === distanceUnit ? selection.unit : initial;
  return <div className="unit-distance-field"><ConvertedField {...props} onChange={v => { setSelection({ preference: distanceUnit, unit }); props.onChange(v); }} label={`${props.label} (${unit})`} unitKey={unit} display={v => compactNumber(v / distanceFactor(unit))} parse={text => numeric(text) * distanceFactor(unit)} /><label>Distance unit<select aria-label={`${props.label} unit`} value={unit} onChange={e => setSelection({ preference: distanceUnit, unit: e.target.value as DistanceInputUnit })}><option value="m">m</option><option value="km">km</option><option value="mi">mi</option></select></label></div>;
}
export function SpeedField({ sport, activities, distanceUnit: override, ...props }: FieldProps & { sport?: string; activities?: ActivityUnits[]; distanceUnit?: DistanceUnit }) {
  const units = useUnits(), unit = override || units.distanceUnit;
  const policy = speedPolicy(sport, unit, activities);
  return <ConvertedField {...props} pace={policy.pace} label={`${props.label} (${policy.unit})`} unitKey={`${sport}:${policy.unit}`} display={v => { const text = speedText(v, sport, unit, activities); return text === '—' ? '' : text; }} parse={text => speedToMPS(policy.pace ? parsePace(text) : numeric(text), sport, unit, activities)} />;
}
export function DurationField({ label, seconds, onChange, minutesOnly = false }: { label: string; seconds?: number; onChange: (value: number | undefined) => void; minutesOnly?: boolean }) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [edit, setEdit] = useState<{ seconds?: number; parts: string[] }>();
  const parts = edit && Object.is(edit.seconds, seconds) ? edit.parts : seconds == null || !Number.isFinite(seconds) ? ['', '', ''] : [String(Math.floor(Math.round(seconds) / 3600)), String(Math.floor(Math.round(seconds) % 3600 / 60)), String(Math.round(seconds) % 60)];
  const invalidDuration = seconds !== undefined && !Number.isFinite(seconds);
  useEffect(() => { inputRefs.current.forEach(input => input?.setCustomValidity(invalidDuration ? 'Use whole hours and minutes/seconds from 0 to 59.' : '')); }, [invalidDuration]);
  function change(index: number, raw: string, input: HTMLInputElement) {
    const next = parts.map((p, i) => i === index ? raw : p);
    const invalid = next.some((p, i) => p !== '' && (!/^\d+$/.test(p) || Number(p) > (i ? 59 : Number.MAX_SAFE_INTEGER)));
    input.setCustomValidity(invalid ? 'Use whole hours and minutes/seconds from 0 to 59.' : '');
    const value = invalid ? NaN : next.every(p => !p) ? undefined : Number(next[0]) * 3600 + Number(next[1]) * 60 + (minutesOnly ? 0 : Number(next[2]));
    setEdit({ seconds: value, parts: next }); onChange(value);
  }
  return <fieldset className="builder-duration"><legend>{label}</legend><div style={{ gridTemplateColumns: `repeat(${minutesOnly ? 2 : 3}, minmax(0, 1fr))` }}>{['Hours', 'Minutes', ...(minutesOnly ? [] : ['Seconds'])].map((part, index) => <label key={part}>{part}<input ref={el => { inputRefs.current[index] = el; }} type="text" inputMode="numeric" aria-label={`${label} ${part.toLowerCase()}`} value={parts[index]} onChange={e => change(index, e.target.value, e.currentTarget)} /></label>)}</div></fieldset>;
}
export function SessionDurationField({ label, value, onChange }: FieldProps) {
  return <DurationField label={label} minutesOnly seconds={value === undefined ? undefined : value * 60} onChange={s => onChange(s === undefined ? undefined : s / 60)} />;
}
