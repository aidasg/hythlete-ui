export type WeightUnit = 'kg' | 'lb';
export type DistanceUnit = 'km' | 'mi';
export type DistanceInputUnit = 'm' | DistanceUnit;
export type UnitPreferences = { weightUnit: WeightUnit; distanceUnit: DistanceUnit };
export type ActivityUnits = { code?: string; parent_code?: string | null };
export const defaultUnits: UnitPreferences = { weightUnit: 'kg', distanceUnit: 'km' };
export const KG_PER_LB = 0.45359237;
export const METERS_PER_MILE = 1609.344;
const valid = (value: number | undefined | null): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
export function compactNumber(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return '—';
  if (value !== 0 && Math.abs(value) < 1e-10) return Number(value.toPrecision(2)).toString();
  const precision = value !== 0 && Math.abs(value) < .01 ? Math.min(12, Math.ceil(-Math.log10(Math.abs(value))) + 1) : decimals;
  return Number(value.toFixed(precision)).toString();
}
export function weightFromKG(value: number, unit: WeightUnit) { return unit === 'lb' ? value / KG_PER_LB : value; }
export function weightToKG(value: number, unit: WeightUnit) { return unit === 'lb' ? value * KG_PER_LB : value; }
export function formatWeight(value: number | undefined | null, unit: WeightUnit = 'kg') {
  return valid(value) ? `${compactNumber(weightFromKG(value, unit))} ${unit}` : '—';
}
export function distanceFactor(unit: DistanceInputUnit) { return unit === 'mi' ? METERS_PER_MILE : unit === 'km' ? 1000 : 1; }
export function activityUnitFamily(sport?: string, activities: ActivityUnits[] = []): 'foot' | 'swim' | 'row' | 'speed' {
  const seen = new Set<string>();
  let code = sport?.trim().toLowerCase().replace(/[ -]+/g, '_') || '';
  while (code && !seen.has(code)) {
    seen.add(code);
    if (code.includes('wheelchair')) return 'speed';
    if (code === 'swimming' || code.endsWith('_swimming')) return 'swim';
    if (code === 'rowing' || code.endsWith('_rowing')) return 'row';
    if (['running', 'walking', 'hiking', 'obstacle_racing', 'rucking'].includes(code) || /_(running|walking|hiking)$/.test(code)) return 'foot';
    const parent = activities.find(a => a.code === code)?.parent_code;
    if (!parent) break;
    code = parent;
  }
  return 'speed';
}
export function metricDistanceSport(sport?: string, activities?: ActivityUnits[]) {
  return ['swim', 'row'].includes(activityUnitFamily(sport, activities));
}
export function readableDistanceUnit(meters: number, unit: DistanceUnit = 'km', sport?: string, activities?: ActivityUnits[]): DistanceInputUnit {
  const preferred = metricDistanceSport(sport, activities) ? 'km' : unit;
  // Promote when rounding meters would otherwise display the next unit's threshold.
  return meters >= distanceFactor(preferred) || Number(meters.toFixed(2)) >= Number(distanceFactor(preferred).toFixed(2)) ? preferred : 'm';
}
export function formatDistance(meters: number | undefined | null, unit: DistanceUnit = 'km', sport?: string, activities?: ActivityUnits[]) {
  if (!valid(meters)) return '—';
  const displayUnit = readableDistanceUnit(meters, unit, sport, activities);
  return `${compactNumber(meters / distanceFactor(displayUnit))} ${displayUnit}`;
}
export function formatDuration(seconds: number | undefined | null) {
  if (!valid(seconds)) return '—';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600), m = Math.floor(total % 3600 / 60), s = total % 60;
  return [h ? `${h} h` : '', m ? `${m} min` : '', s || !total ? `${s} s` : ''].filter(Boolean).join(' ');
}
export function formatClock(seconds: number | undefined | null) {
  if (!valid(seconds)) return '—';
  const total = Math.round(seconds), h = Math.floor(total / 3600), m = Math.floor(total % 3600 / 60), s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}
export function parsePace(text: string) {
  if (!/^\d+:[0-5]\d$/.test(text.trim())) return NaN;
  const [minutes, seconds] = text.trim().split(':').map(Number);
  const total = minutes! * 60 + seconds!;
  return total > 0 ? total : NaN;
}
export function speedPolicy(sport?: string, unit: DistanceUnit = 'km', activities?: ActivityUnits[]) {
  const family = activityUnitFamily(sport, activities);
  const meters = family === 'swim' ? 100 : family === 'row' ? 500 : unit === 'mi' ? METERS_PER_MILE : 1000;
  const pace = family !== 'speed';
  return { pace, meters, unit: pace ? family === 'swim' ? 'min/100 m' : family === 'row' ? 'min/500 m' : `min/${unit}` : unit === 'mi' ? 'mph' : 'km/h' };
}
export function speedFromMPS(value: number, sport?: string, unit: DistanceUnit = 'km', activities?: ActivityUnits[]) {
  const p = speedPolicy(sport, unit, activities);
  return p.pace ? value > 0 ? p.meters / value : NaN : value * 3600 / (unit === 'mi' ? METERS_PER_MILE : 1000);
}
export function speedToMPS(value: number, sport?: string, unit: DistanceUnit = 'km', activities?: ActivityUnits[]) {
  const p = speedPolicy(sport, unit, activities);
  return p.pace ? value > 0 ? p.meters / value : NaN : value * (unit === 'mi' ? METERS_PER_MILE : 1000) / 3600;
}
export function speedText(value: number | undefined | null, sport?: string, unit: DistanceUnit = 'km', activities?: ActivityUnits[]) {
  if (!valid(value)) return '—';
  const p = speedPolicy(sport, unit, activities), displayed = speedFromMPS(value, sport, unit, activities);
  if (!Number.isFinite(displayed)) return '—';
  // Pace uses minutes, even for exceptionally slow movement.
  return p.pace ? `${Math.floor(Math.round(displayed) / 60)}:${String(Math.round(displayed) % 60).padStart(2, '0')}` : displayed.toFixed(1);
}
export function formatSpeed(value: number | undefined | null, sport?: string, unit: DistanceUnit = 'km', activities?: ActivityUnits[]) {
  const text = speedText(value, sport, unit, activities);
  return text === '—' ? text : `${text} ${speedPolicy(sport, unit, activities).unit}`;
}
export function formatTarget(target?: {metric?: string; value?: number; unit?: string} | null, sport?: string, unit: DistanceUnit = 'km', activities?: ActivityUnits[]) {
  if (!target || !valid(target.value)) return '—';
  if (target.metric === 'pace' && target.value > 0) return formatSpeed((target.unit === 'seconds_per_100m' ? 100 : 1000) / target.value, sport, unit, activities);
  return `${compactNumber(target.value)} ${{ watts: 'W', bpm: 'bpm' }[target.unit || ''] || target.unit || ''}`.trim();
}
export function hasInvalidNumbers(value: unknown): boolean {
  if (typeof value === 'number') return !Number.isFinite(value);
  if (Array.isArray(value)) return value.some(hasInvalidNumbers);
  return !!value && typeof value === 'object' && Object.values(value).some(hasInvalidNumbers);
}
export function formatMeasurement(value: number | undefined | null, unit?: string, sport?: string, units: UnitPreferences = defaultUnits, activities?: ActivityUnits[]) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  if (['mps', 'm/s', 'avg_speed_mps', 'speed_mps'].includes(unit || '')) return formatSpeed(value, sport, units.distanceUnit, activities);
  if (['meters', 'm', 'distance_m'].includes(unit || '')) return formatDistance(value, units.distanceUnit, sport, activities);
  if (['seconds', 's', 'time_seconds', 'elapsed_seconds'].includes(unit || '')) return formatDuration(value);
  if (['kg', 'kilograms'].includes(unit || '')) return formatWeight(value, units.weightUnit);
  if (unit === 'percent') return `${compactNumber(value)}%`;
  return `${compactNumber(value)} ${{ watts: 'W', bpm: 'bpm' }[unit || ''] || unit?.replace(/_/g, ' ') || ''}`.trim();
}
