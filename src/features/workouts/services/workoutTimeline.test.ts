import { describe, expect, it } from 'vitest';
import { buildWorkoutTimeline, intervalTarget } from './workoutTimeline';
import type { WorkoutResponse } from './workoutApi';

describe('workout timeline data', () => {
  it('sorts completed components, expands legacy repeats, and normalizes zones', () => {
    const data = buildWorkoutTimeline({ completed: true, components: [
      { order: 2, duration_seconds: 30, intensity_zone: 'easy', effort: { zone: 'vo2' } },
      { order: 1, duration_seconds: 60, repeats: 2, intensity_zone: 'recovery' },
    ] });
    expect(data.intervals.map(i => [i.start,i.end,i.zone.key])).toEqual([[0,60,'recovery'],[60,120,'recovery'],[120,150,'vo2max']]);
    expect(data.totalSeconds).toBe(150);
  });
  it('uses imported actuals without applying repeats or substituting a prescription', () => {
    const workout: WorkoutResponse = { completed: true, components: [{duration_seconds:999}], blocks: [{duration_seconds:800}], execution: {elapsed_seconds:20,imported_activity:{segments:[{component:{duration_seconds:20,repeats:4,metrics:{avg_power_watts:0}},alignment:'estimated',start:'2026-10-14T08:00:00Z'}]}} };
    const data = buildWorkoutTimeline(workout);
    expect(data.totalSeconds).toBe(20);expect(data.intervals).toHaveLength(1);expect(data.intervals[0]?.component.metrics?.avg_power_watts).toBe(0);expect(data.intervals[0]?.alignment).toBe('estimated');
  });
  it('marks missing durations and unknown zones without stretching time', () => {
    const data = buildWorkoutTimeline({completed:true,duration_minutes:20,components:[{duration_seconds:60,intensity_zone:'not-a-zone'},{duration_seconds:0},{duration_seconds:NaN},{}]});
    expect(data.totalSeconds).toBe(60);expect(data.partial).toBe(true);expect(data.intervals[0]?.zone.key).toBe('unknown');
    expect(buildWorkoutTimeline({completed:true,duration_minutes:20}).intervals).toEqual([]);
  });
  it('expands prescribed work and recovery in chronological order', () => {
    const data = buildWorkoutTimeline({planned:true,blocks:[{format:'intervals',completion:'time',rounds:3,work_seconds:60,rest_seconds:30,movements:[{sport:'cycling',intensity_zone:'threshold',target:{metric:'power',value:250,unit:'watts'}}]}]});
    expect(data.planned).toBe(true);expect(data.intervals.map(i=>i.zone.key)).toEqual(['threshold','recovery','threshold','recovery','threshold','recovery']);expect(data.totalSeconds).toBe(270);expect(intervalTarget(data.intervals[0]!.component)).toBe('250 W');
  });
  it('does not invent zones from numeric targets or timing for untimed/mixed plans', () => {
    const data = buildWorkoutTimeline({planned:true,blocks:[{format:'steady',completion:'time',duration_seconds:60,movements:[{sport:'cycling',target:{metric:'power',value:300,unit:'watts'}}]}]});
    expect(data.intervals[0]?.zone.key).toBe('unknown');
    for(const blocks of [
      [{format:'steady',completion:'distance',movements:[{distance_m:1000}]}],
      [{format:'steady',completion:'time',duration_seconds:120,movements:[{sport:'running'},{sport:'rowing'}]}],
      [{format:'intervals',completion:'manual',movements:[{sport:'running'}]}],
    ]) expect(buildWorkoutTimeline({planned:true,blocks}).supported).toBe(false);
    expect(buildWorkoutTimeline({completed:true,components:[{type:'exercise',duration_seconds:60}]}).supported).toBe(false);
  });
  it('keeps an empty imported activity authoritative without substituting components', () => {
    expect(buildWorkoutTimeline({completed:true, components:[{duration_seconds:90}], execution:{imported_activity:{segments:[]}}}).intervals).toEqual([]);
  });
  it('formats FIT prescriptions independently from detected zones', () => {
    expect(intervalTarget({target_value:{fit_workout_step:{type:'power', value:0, low:1200, high:1300}}})).toBe('200 W - 300 W');
    expect(intervalTarget({target_value:{fit_workout_step:{type:'heart_rate', value:0, low:240, high:260}}})).toBe('140 bpm - 160 bpm');
    expect(intervalTarget({target_value:{fit_workout_step:{type:'power', value:3}}})).toBe('FIT power zone 3');
    expect(intervalTarget({target_value:{fit_workout_step:{type:'power', value:0, low:0xffffffff}}})).toBeUndefined();
  });
  it('honors explicit raw power units without guessing from magnitude', () => {
    const target = (unit?: string, low = 255, high = 291) => ({target_value:{fit_workout_step:{type:'power',value:0,low,high,unit}}});
    expect(intervalTarget(target('watts'))).toBe('255 W - 291 W');
    expect(intervalTarget(target('watts',382,419))).toBe('382 W - 419 W');
    expect(intervalTarget(target('percent_ftp'))).toBe('255% FTP - 291% FTP');
    expect(intervalTarget(target(undefined,80,100))).toBe('80% FTP - 100% FTP');
    expect(intervalTarget(target(undefined,1200,1250))).toBe('200 W - 250 W');
    expect(intervalTarget(target(undefined,255,291))).toBe('255% FTP - 291% FTP');
    expect(intervalTarget({target_value:{fit_workout_step:{type:'power_3s',value:0,low:200,high:250,unit:'watts'}}})).toBe('200 W - 250 W');
    expect(intervalTarget({target_value:{fit_workout_step:{type:'power',value:3,unit:'watts'}}})).toBe('FIT power zone 3');
    expect(intervalTarget(target('watts',0xffffffff,0xffffffff))).toBeUndefined();
  });

});
