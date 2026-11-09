import { describe, expect, it } from 'vitest';
import { applyExerciseAI, exerciseContext, restoreExerciseAI, unresolvedExerciseIssues, type ExerciseAIResult } from './exerciseAI';
import { draftPayload, makeDraft } from './workoutBuilder';
import type { WorkoutRequest } from './workoutApi';

const date = '2026-11-03';
const result: ExerciseAIResult = { blocks: [{ id: 'ai-0', format: 'straight_sets', completion: 'manual', rounds: 1, movements: [{ exercise_code: 'back_squat', sets: [{ reps: 8, load_kg: 40 }, { reps: 6, load_kg: 45 }] }] }], issues: [] };

describe('AI exercise draft application', () => {
  it('preserves a planned circuit and activities at the first exercise position', () => {
    const original: WorkoutRequest = { date, sport: 'hiit', category: 'mixed', title: 'Original', duration_minutes: 30, blocks: [
      { id: 'warmup', format: 'steady', completion: 'time', duration_seconds: 300, movements: [{ sport: 'running', intensity_zone: 'easy' }] },
      { id: 'mixed', format: 'circuit', completion: 'manual', rounds: 3, movements: [{ exercise_code: 'push_up', sets: [{ reps: 10 }] }, { sport: 'rowing', duration_seconds: 60, metrics: { avg_power_watts: 200 } }] },
    ] };
    const draft = makeDraft(date, date, original);
    const grouped: ExerciseAIResult = { blocks: [{ ...result.blocks[0], format: 'circuit', rounds: 4 }], issues: [] };
    const applied = applyExerciseAI(draft, grouped).draft;
    expect(applied.blocks.map(b => b.id)).toEqual(['warmup', expect.any(String), 'mixed']);
    expect(applied.blocks[1]).toMatchObject({ format: 'circuit', rounds: 4, movements: result.blocks[0]!.movements });
    expect(applied.blocks[0]).toEqual(draft.blocks[0]);
    expect(applied.blocks[2]!.movements).toEqual([draft.blocks[1]!.movements![1]]);
    expect(applied.workout).toEqual(draft.workout);
    applied.workout = { ...applied.workout, notes: 'Later note' };
    applied.blocks[0]!.movements![0]!.metrics = { avg_power_watts: 150 };
    const rejected = restoreExerciseAI(applied, draft);
    expect(rejected.workout.notes).toBe('Later note');
    expect(rejected.blocks[1]!.movements).toEqual(draft.blocks[1]!.movements);
    expect(rejected.blocks[0]!.movements![0]!.metrics).toEqual({ avg_power_watts: 150 });
  });

  it('preserves imported recordings and prescriptions and does not expand sets twice', () => {
    const original: WorkoutRequest = { date, source: 'fit', completed: true, sport: 'hiit', category: 'mixed', duration_minutes: 20,
      blocks: [{ id: 'plan', format: 'circuit', rounds: 99, movements: [{ exercise_code: 'push_up', sets: [{ reps: 10 }] }] }],
      components: [{ order: 1, type: 'steady', sport: 'hiit', duration_seconds: 1200, metrics: { avg_heart_rate_bpm: 155 } }],
      execution: { key: 'fit:original', elapsed_seconds: 1200, imported_activity: { segments: [{ component: { type: 'steady', duration_seconds: 1200 } }] } } };
    const draft = makeDraft(date, date, original);
    const applied = applyExerciseAI(draft, result).draft;
    const body = draftPayload(applied);
    expect(body.execution).toEqual(original.execution);
    expect(body.blocks).toEqual(original.blocks);
    expect(body.components?.[0]).toEqual(original.components![0]);
    expect(body.components?.[1]?.sets).toHaveLength(2);
    expect(exerciseContext(applied)).toMatchObject({ mode: 'performed', current_blocks: [{ movements: result.blocks[0]!.movements }] });
    expect(restoreExerciseAI(applied, draft).blocks).toEqual(draft.blocks);
  });

  it('keeps structured execution identities and elapsed time, including reject', () => {
    const original: WorkoutRequest = { date, sport: 'hiit', category: 'mixed', duration_minutes: 20, completed: true, structure_version: 2,
      blocks: [
        { id: 'a', format: 'circuit', rounds: 3, movements: [{ sport: 'running' }, { exercise_code: 'push_up', sets: [{ reps: 99 }] }] },
        { id: 'b', format: 'straight_sets', movements: [{ exercise_code: 'push_up', sets: [{ reps: 99 }] }] },
      ], execution: { key: 'saved', elapsed_seconds: 1200, blocks: [
        { block_id: 'a', elapsed_seconds: 600, movements: [{ sport: 'running', duration_seconds: 300 }, { exercise_code: 'push_up', sets: [{ reps: 5 }] }] },
        { block_id: 'b', elapsed_seconds: 600, movements: [{ exercise_code: 'push_up', sets: [{ reps: 5 }] }] },
      ] } };
    const draft = makeDraft(date, date, original);
    const withIssue: ExerciseAIResult = { ...result, issues: [{ block_id: 'ai-0', movement_index: 0, field: 'load_kg', message: 'Check weight', required: false }] };
    const applied = applyExerciseAI(draft, withIssue);
    expect(applied.draft.blocks).toHaveLength(1);
    expect(applied.issues[0]).toMatchObject({ block_id: 'a', movement_index: 1 });
    const payload = draftPayload(applied.draft);
    expect(payload.blocks).toEqual(original.blocks);
    expect(payload.execution).toMatchObject({ key: 'saved', elapsed_seconds: 1200, blocks: [{ block_id: 'a', elapsed_seconds: 1200, movements: [{ sport: 'running', duration_seconds: 300 }, { exercise_code: 'back_squat', sets: result.blocks[0]!.movements![0]!.sets?.map((s, i) => ({ ...s, set_order: i + 1 })) }] }] });
    expect(restoreExerciseAI(applied.draft, draft).blocks).toEqual(draft.blocks);
  });

  it('keeps legacy performed activity metadata', () => {
    const original: WorkoutRequest = { date, sport: 'hiit', category: 'mixed', duration_minutes: 20, completed: true, components: [{ type: 'steady', sport: 'running', duration_seconds: 600, metrics: { avg_power_watts: 200 }, target_type: 'custom' }, { type: 'exercise', exercise_code: 'push_up', sets: [{ reps: 10 }] }] };
    const draft = makeDraft(date, date, original);
    const applied = applyExerciseAI(draft, result).draft;
    expect(applied.legacy).toBe(true);
    expect(draftPayload(applied).components?.[0]).toMatchObject(original.components![0]!);
    expect(draftPayload(applied).components?.[1]?.sets).toHaveLength(2);
  });

  it('resolves missing library mappings and targets as users correct the rows', () => {
    const partial: ExerciseAIResult = { blocks: [{ id: 'ai-0', format: 'straight_sets', movements: [{ exercise_code: '', sets: [{}] }] }], issues: [
      { block_id: 'ai-0', movement_index: 0, field: 'exercise_code', source_name: 'Unclear squat', required: true },
      { block_id: 'ai-0', movement_index: 0, set_index: 0, field: 'target', required: true },
    ] };
    const { draft, issues } = applyExerciseAI(makeDraft(date, date), partial);
    expect(unresolvedExerciseIssues(issues, draft.blocks)).toHaveLength(2);
    draft.blocks[0]!.movements![0] = { exercise_code: 'back_squat', sets: [{ reps: 8 }] };
    expect(unresolvedExerciseIssues(issues, draft.blocks)).toHaveLength(0);
  });
  it('retains an exercise editor when unmatched names have no readable sets', () => {
    const { draft } = applyExerciseAI(makeDraft(date, date), { blocks: [{ id: 'ai-0', format: 'straight_sets', movements: [{ exercise_code: '' }] }], issues: [] });
    expect(draft.blocks[0]!.movements![0]).toMatchObject({ exercise_code: '', sets: [] });
    expect(exerciseContext(draft).current_blocks).toHaveLength(1);
  });
});
