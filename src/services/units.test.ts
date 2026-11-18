import { describe, expect, it } from 'vitest';
import { formatDuration, formatClock, formatDistance, formatSpeed, formatWeight, parsePace, speedToMPS, formatTarget, activityUnitFamily, weightToKG, METERS_PER_MILE, readableDistanceUnit } from './units';

describe('readable durations', () => {
  it.each([[0, '0 s'], [45, '45 s'], [59, '59 s'], [60, '1 min'], [90, '1 min 30 s'], [3599, '59 min 59 s'], [3600, '1 h'], [5430, '1 h 30 min 30 s'], [90061, '25 h 1 min 1 s']] as const)('formats %s seconds', (seconds, text) => expect(formatDuration(seconds)).toBe(text));
  it.each([[59, '0:59'], [60, '1:00'], [3599, '59:59'], [3600, '1:00:00'], [90061, '25:01:01']] as const)('formats clock %s', (seconds, text) => expect(formatClock(seconds)).toBe(text));
  it('distinguishes zero from unavailable', () => { for (const value of [undefined, null, NaN, Infinity, -1]) { expect(formatDuration(value)).toBe('—'); expect(formatClock(value)).toBe('—'); } });
});
describe('distance preferences', () => {
  it.each([[400, '400 m'], [999.99, '999.99 m'], [999.999, '1 km'], [1000, '1 km'], [42200, '42.2 km'], [.001, '0.001 m']] as const)('formats %s meters', (meters, text) => expect(formatDistance(meters)).toBe(text));
  it('uses miles from a mile and metric short intervals', () => { expect(formatDistance(400, 'mi', 'running')).toBe('400 m'); expect(formatDistance(METERS_PER_MILE, 'mi', 'running')).toBe('1 mi'); expect(formatDistance(METERS_PER_MILE * 26.2, 'mi', 'running')).toBe('26.2 mi'); });
  it('promotes a rounded mile boundary', () => expect(readableDistanceUnit(METERS_PER_MILE - .001, 'mi')).toBe('mi'));
  it('keeps swimming and rowing metric', () => { expect(formatDistance(2000, 'mi', 'lap_swimming')).toBe('2 km'); expect(formatDistance(500, 'mi', 'indoor_rowing')).toBe('500 m'); });
});
describe('sport-specific speed and pace', () => {
  it('formats metric and mile running pace', () => { expect(formatSpeed(4, 'running')).toBe('4:10 min/km'); expect(formatSpeed(4, 'trail_running', 'mi')).toBe('6:42 min/mi'); });
  it('formats cycling speed', () => { expect(formatSpeed(10, 'cycling')).toBe('36.0 km/h'); expect(formatSpeed(10, 'mountain_biking', 'mi')).toBe('22.4 mph'); });
  it('formats swimming and rowing pace in either preference', () => { expect(formatSpeed(1, 'open_water_swimming', 'mi')).toBe('1:40 min/100 m'); expect(formatSpeed(4, 'indoor_rowing', 'mi')).toBe('2:05 min/500 m'); });
  it('resolves specific variants before ancestors and tolerates catalog cycles', () => {
    expect(activityUnitFamily('custom_foot', [{code:'custom_foot',parent_code:'trail_running'}])).toBe('foot');
    expect(activityUnitFamily('wheelchair_push_run', [{code:'wheelchair_push_run',parent_code:'running'}])).toBe('speed');
    expect(activityUnitFamily('unknown', [{code:'unknown',parent_code:'cycle'},{code:'cycle',parent_code:'unknown'}])).toBe('speed');
  });
  it('handles zero, invalid values and unknown activities', () => { expect(formatSpeed(0, 'running')).toBe('—'); expect(formatSpeed(0, 'cycling')).toBe('0.0 km/h'); expect(formatSpeed(NaN, 'running')).toBe('—'); expect(formatSpeed(10, 'unknown', 'mi')).toBe('22.4 mph'); });
  it('rounds pace carries and retains minutes above an hour', () => { expect(formatSpeed(1000 / 359.6, 'running')).toBe('6:00 min/km'); expect(formatSpeed(1000 / 3660, 'running')).toBe('61:00 min/km'); });
  it('converts user values to canonical measurements', () => { expect(speedToMPS(parsePace('4:10'), 'running')).toBe(4); expect(speedToMPS(parsePace('6:42'), 'running', 'mi')).toBeCloseTo(METERS_PER_MILE / 402); expect(speedToMPS(36, 'cycling')).toBe(10); expect(speedToMPS(parsePace('1:40'), 'swimming')).toBe(1); });
  it.each(['5', '5:60', '5:3', '-1:00', '0:00', '5:', 'NaN'])('rejects malformed pace %s', raw => expect(parsePace(raw)).toBeNaN());
  it('normalizes legacy and canonical pace targets for presentation', () => { expect(formatTarget({metric:'pace',value:120,unit:'seconds_per_100m'},'swimming')).toBe('2:00 min/100 m'); expect(formatTarget({metric:'pace',value:1200,unit:'seconds_per_km'},'swimming')).toBe('2:00 min/100 m'); expect(formatTarget({metric:'pace',value:100,unit:'seconds_per_km'},'cycling')).toBe('36.0 km/h'); });
});
it('converts pounds exactly and formats without precision drift', () => { expect(weightToKG(100, 'lb')).toBe(45.359237); expect(formatWeight(45.359237, 'lb')).toBe('100 lb'); expect(formatWeight(0, 'lb')).toBe('0 lb'); });
