import { describe, expect, it } from 'vitest';
import { draftPayload, makeDraft, newBlock, draftError, startLogging, exerciseSetSummary, type BuilderDraft } from './workoutBuilder';
import type { WorkoutRequest } from './workoutApi';
const date = '2026-10-13';
describe('imported performed exercises', () => {
  const original: WorkoutRequest = { date, source: 'fit', completed: true, sport: 'hiit', category: 'mixed', duration_minutes: 20,
    blocks: [{ id: 'plan', format: 'straight_sets', movements: [{ exercise_code: 'back_squat', sets: [{ reps: 99 }] }] }],
    execution: { key: 'fit:original', elapsed_seconds: 1200, imported_activity: { segments: [{ component: { type: 'steady', duration_seconds: 1200 } }] } },
    components: [{ order: 1, type: 'steady', duration_seconds: 1200, metrics: { avg_heart_rate_bpm: 150 } }, { order: 2, type: 'exercise', exercise_code: 'back_squat', sets: [{ reps: 5, load_kg: 80 }] }] };
  it('edits actual sets, retaining recording and prescription', () => {
    const draft = makeDraft(date, date, original);
    expect(draft.blocks).toHaveLength(1);
    expect(draft.blocks[0]!.movements![0]!.sets![0]!.reps).toBe(5);
    draft.blocks[0]!.movements![0]!.sets = [{ reps: 8, load_kg: 70 }, { reps: 6, load_kg: 75 }];
    const payload = draftPayload(draft);
    expect(payload.execution).toEqual(original.execution);
    expect(payload.blocks).toEqual(original.blocks);
    expect(payload.components?.[0]).toEqual(original.components![0]);
    expect(payload.components?.[1]?.sets).toEqual([{ set_order: 1, reps: 8, load_kg: 70 }, { set_order: 2, reps: 6, load_kg: 75 }]);
    expect(original.components![1]!.sets![0]!.reps).toBe(5);
  });
  it('submits explicit removal and adds exercises to an import without sets', () => {
    const draft = makeDraft(date, date, original); draft.blocks = [];
    expect(draftPayload(draft).components).toEqual([original.components![0]]);
    const empty = makeDraft(date, date, { ...original, components: [] });
    expect(draftPayload(empty).components).toEqual([]);
    empty.blocks = [newBlock('', 'straight_sets', true)];
    expect(draftError(empty)).toBe('Choose an exercise.');
    empty.blocks[0]!.movements![0] = { exercise_code: 'back_squat', sets: [{ reps: 10 }] };
    expect(draftError(empty)).toBeUndefined();
    expect(draftPayload(empty).components).toMatchObject([{ type: 'exercise', exercise_code: 'back_squat', sets: [{ reps: 10 }] }]);
  });
  it('summarizes ordered sets, timed targets, zero and missing weight', () => {
    expect(exerciseSetSummary([{ reps: 8, load_kg: 40 }, { reps: 8, load_kg: 40 }, { reps: 6, load_kg: 45 }, { duration_seconds: 30, load_kg: 0 }, { distance_m: 20 }, {}])).toBe('2 × 8 reps @ 40 kg · 6 reps @ 45 kg · 30s @ 0 kg · 20m @ weight unset · Target unset @ weight unset');
    expect(exerciseSetSummary([])).toBe('No sets');
  });
});
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

it('preserves FIT recording and prescription when changing title and activity type', () => {
  const original: WorkoutRequest = { date, source:'fit', completed:true, sport:'inline_skating', title:'Imported skate', category:'endurance', duration_minutes:25,
    structure_version:2, blocks:[{id:'plan',format:'steady',duration_seconds:1500,movements:[{sport:'inline_skating',intensity_zone:'steady'}]}],
    components:[{order:1,type:'steady',sport:'inline_skating',duration_seconds:1500,intensity_zone:'tempo',metrics:{avg_heart_rate_bpm:155}}],
    execution:{key:'fit:original',elapsed_seconds:1500,imported_activity:{segments:[{component:{order:1,type:'steady',duration_seconds:1500,intensity_zone:'tempo'}}]}} };
  const draft=makeDraft(date,date,original);
  draft.workout.title='Evening skate';draft.workout.sport='skating';
  const payload=draftPayload(draft);
  expect(payload).toMatchObject({title:'Evening skate',sport:'skating',duration_minutes:25,source:'fit',completed:true});
  expect(payload.execution).toEqual(original.execution);
  expect(payload.blocks).toEqual(original.blocks);
  expect(payload.components).toEqual(original.components);
});
