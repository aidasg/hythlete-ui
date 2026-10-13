import { describe, expect, it } from 'vitest';
import { draftPayload, makeDraft, newBlock, draftError, startLogging, type BuilderDraft } from './workoutBuilder';
import type { WorkoutRequest } from './workoutApi';
const date = '2026-10-13';
describe('workout builder adapters', () => {
  it('defaults past entries to quick logging without invented sets', () => {
    const d = makeDraft('2026-10-12', date); d.workout.sport = 'strength_training'; d.workout.duration_minutes = 30;
    const body = draftPayload(d, { code: 'strength_training', training_category: 'strength' });
    expect(body).toMatchObject({ completed: true, structure_version: 0, components: [], blocks: [], duration_minutes: 30 });
    expect(body.execution).toBeUndefined(); expect(draftError(d)).toBeUndefined();
  });
  it('computes interval duration and preserves distinct targets', () => {
    const d = makeDraft(date, date); d.workout.sport = 'running';
    d.blocks = [{ ...newBlock('running', 'intervals'), rounds: 4, work_seconds: 300, rest_seconds: 60, movements: [{ sport: 'running', intensity_zone: 'threshold', target: { metric: 'power', value: 250, unit: 'watts' } }], recovery: { sport: 'running', intensity_zone: 'recovery' } }];
    expect(draftPayload(d)).toMatchObject({ duration_minutes: 24, structure_version: 2, blocks: [{ duration_seconds: 1440, recovery: { intensity_zone: 'recovery' }, movements: [{ intensity_zone: 'threshold', target: { value: 250 } }] }] });
  });
  it('uses an estimate for distance and keeps unequal exercise sets', () => {
    const d = makeDraft(date, date); d.workout.sport = 'swimming'; d.workout.duration_minutes = 30;
    d.blocks = [{ ...newBlock('swimming'), completion: 'distance', movements: [{ sport: 'swimming', distance_m: 1500 }] }];
    expect(draftPayload(d).blocks?.[0]).toMatchObject({ completion: 'distance', movements: [{ distance_m: 1500 }] });
    expect(draftPayload(d).blocks?.[0]?.duration_seconds).toBeUndefined();
    d.blocks = [{ ...newBlock('strength_training', 'straight_sets'), movements: [{ exercise_code: 'back_squat', sets: [{ reps: 5, load_kg: 80 }, { reps: 3, load_kg: 90 }] }] }];
    expect(draftPayload(d).blocks?.[0]?.movements?.[0]?.sets).toEqual([{ set_order: 1, reps: 5, load_kg: 80 }, { set_order: 2, reps: 3, load_kg: 90 }]);
  });
  it('retains legacy import metrics and target metadata when editing notes', () => {
    const original: WorkoutRequest = { date, source: 'fit', sport: 'trail_running', category: 'endurance', subtype: 'custom', duration_minutes: 60, completed: true, components: [{ order: 1, type: 'steady', sport: 'trail_running', duration_seconds: 3000, distance_m: 8000, intensity_zone: 'tempo', repeats: 2, target_type: 'fit_lap', target_value: { lap: 'original' } as never, metrics: { avg_power_watts: 234 } }] };
    const d = makeDraft(date, date, original); d.workout.notes = 'Changed';
    const payload = draftPayload(d);
    expect(payload.components).toEqual(original.components); expect(payload.duration_minutes).toBe(60); expect(payload.subtype).toBe('custom'); expect(payload.source).toBe('fit');
  });
  it('does not turn planned sets into actual results when changing modes', () => {
    const d = makeDraft(date, date); d.workout.sport = 'strength_training'; d.blocks = [{ ...newBlock('strength_training', 'straight_sets'), movements: [{ exercise_code: 'back_squat', sets: [{ reps: 5 }] }] }];
    const logged = startLogging(d);
    expect(logged.blocks[0]!.movements?.[0]?.sets).toEqual([]);
    expect(draftError(logged)).toMatch(/every set/);
    expect(logged.original?.blocks?.[0]?.movements?.[0]?.sets?.[0]?.reps).toBe(5);
  });
  it('edits recorded sets without changing the original prescription or benchmark link', () => {
    const original: WorkoutRequest = { date, sport: 'strength_training', category: 'strength', structure_version: 2, duration_minutes: 20, completed: true, blocks: [{ id: 'a', format: 'straight_sets', completion: 'manual', movements: [{ exercise_code: 'back_squat', sets: [{ reps: 5 }, { reps: 5 }] }] }], execution: { key: 'saved', elapsed_seconds: 1200, blocks: [{ block_id: 'a', elapsed_seconds: 1200, movements: [{ exercise_code: 'back_squat', sets: [{ reps: 3 }] }] }] }, breakthrough_candidate_id: 9 };
    const d = makeDraft(date, date, original); d.blocks[0]!.movements![0]!.sets![0]!.reps = 4;
    const payload = draftPayload(d);
    expect(payload.blocks?.[0]?.movements?.[0]?.sets).toHaveLength(2);
    expect(payload.execution?.blocks?.[0]?.movements?.[0]?.sets?.[0]?.reps).toBe(4);
    expect(payload.execution?.key).toBe('saved'); expect(payload.breakthrough_candidate_id).toBe(9);
  });
  it('requires valid timing, exercises and targets', () => {
    const d: BuilderDraft = makeDraft(date, date); d.workout.sport = 'hiit'; d.blocks = [{ ...newBlock('hiit', 'emom'), duration_seconds: 90, work_seconds: 60 }];
    expect(draftError(d)).toMatch(/whole intervals/);
    d.blocks = [{ ...newBlock('strength_training', 'straight_sets') }]; expect(draftError(d)).toMatch(/Choose an exercise/);
  });
});

describe('summary completion', () => {
  it('preserves the prescription and records only summary evidence', () => {
    const original: WorkoutRequest = { date, sport: 'running', category: 'endurance', planned: true, blocks: [{ id: 'main', format: 'steady', completion: 'time', duration_seconds: 1200, movements: [{ sport: 'running', intensity_zone: 'threshold' }] }], structure_version: 2, duration_minutes: 20 };
    const d = startLogging(makeDraft(date, date, original)); d.quick = true; d.quickDistanceM = 5000; d.workout.duration_minutes = 30;
    const body = draftPayload(d);
    expect(body.blocks?.[0]?.movements?.[0]?.intensity_zone).toBe('threshold');
    expect(body.components).toEqual([]);
    expect(body.execution).toMatchObject({ summary_only: true, elapsed_seconds: 1800, distance_m: 5000, blocks: [] });
    expect(makeDraft(date, date, body).quick).toBe(true);
  });
  it('reopens a quick log with distance as a quick log', () => {
    const d = makeDraft('2026-10-12', date); d.workout.sport = 'running'; d.workout.duration_minutes = 30; d.quickDistanceM = 5000;
    const body = draftPayload(d); const reopened = makeDraft(date, date, body);
    expect(reopened.quick).toBe(true); expect(reopened.quickDistanceM).toBe(5000);
    expect(body.components?.[0]?.sets).toBeUndefined();
  });
});
