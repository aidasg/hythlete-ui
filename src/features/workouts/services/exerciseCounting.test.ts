import { describe, expect, it } from 'vitest';
import { applySetConvention, applyCatalogCounting, externalVolume, repsLabel, weightLabel, type CountingConvention } from './exerciseCounting';
import { exerciseSetSummary, draftError, makeDraft } from './workoutBuilder';

const paired: CountingConvention = { version: 'exercise-counting-v1', weight_basis: 'per_hand', reps_basis: 'total', movement: 'simultaneous', weights_moved: 2 };
const alternating: CountingConvention = { ...paired, reps_basis: 'per_side', movement: 'alternating', weights_moved: 1, side: 'arm' };
describe('fixed exercise conventions', () => {
  it('counts paired and alternating work once, including two weights with unilateral legs', () => {
    expect(externalVolume(applySetConvention({ reps: 10, load_kg: 20 }, paired))).toBe(400);
    expect(externalVolume(applySetConvention({ reps: 10, load_kg: 20 }, alternating))).toBe(400);
    expect(externalVolume(applySetConvention({ reps: 10, load_kg: 20 }, { ...alternating, weights_moved: 2, side: 'leg' }))).toBe(800);
    expect(externalVolume({ reps: 10, load_kg: 20 })).toBeUndefined();
    expect(externalVolume(applySetConvention({ reps: 10 }, paired))).toBeUndefined();
    expect(externalVolume(applySetConvention({ reps: 10, load_kg: 0 }, paired))).toBe(0);
  });
  it('shows explicit units for catalog-enriched sets', () => {
    expect(weightLabel(paired)).toBe('Weight per hand (kg)');
    expect(repsLabel(alternating)).toBe('Reps per arm');
    expect(exerciseSetSummary([applySetConvention({ reps: 10, load_kg: 20 }, alternating)])).toBe('10 reps per arm @ 20 kg per hand \u00b7 400 kg\u00b7reps');
    expect(exerciseSetSummary([{ reps: 10, load_kg: 20 }])).toBe('10 reps @ 20 kg');
  });
  it('applies current catalog metadata without historical confirmation and reviews exercise changes', () => {
    const blocks = [{ id: 'a', movements: [{ exercise_code: 'press', sets: [{ reps: 10, load_kg: 20 }] }] }];
    const next = applyCatalogCounting(blocks, { exercises: [{ code: 'press', counting_convention: paired }] });
    expect(externalVolume(next[0]!.movements![0]!.sets![0]!)).toBe(400);
    expect(blocks[0]?.movements[0]?.sets[0]).not.toHaveProperty('counting_version');
    const draft = makeDraft('2026-11-17', '2026-11-17');
    draft.blocks = [{ movements: [{ exercise_code: 'press', sets: [{ counting_version: 'review_required', reps: 10 }] }] }];
    expect(draftError(draft)).toMatch(/Review retained/);
  });
});

it('labels added bodyweight resistance without changing recorded weights', () => {
  expect(weightLabel(undefined, { bodyweight_fraction: 0.7 })).toBe('Added weight (optional) (kg)');
  expect(weightLabel(undefined, { bodyweight_fraction: 0.75, additional_weight_required: true })).toBe('Added weight (kg)');
});
