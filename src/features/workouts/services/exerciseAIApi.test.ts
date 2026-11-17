import { beforeEach, expect, it, vi } from 'vitest';
import { draftExercisesWithAI, exerciseContext } from './exerciseAI';
import { makeDraft } from './workoutBuilder';
import type { WorkoutResponse } from './workoutApi';
import type { paths } from '@/services/api/types';

const transport = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/services/api/client', async () => {
  const { default: createClient } = await import('openapi-fetch');
  return { apiClient: createClient<paths>({ baseUrl: 'https://api.example', fetch: transport.fetch }) };
});
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'X-REQUEST-ID': 'exercise-123' } });
}
beforeEach(() => { vi.clearAllMocks(); transport.fetch.mockResolvedValue(response({ blocks: [], issues: [] })); });

it('sends text, object context and a base64 screenshot as application/json', async () => {
  const context = { activity: 'hiit', mode: 'performed' as const, current_blocks: [] };
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jVNsAAAAASUVORK5CYII=';
  const screenshot = new File([Uint8Array.from(atob(png), c => c.charCodeAt(0))], 'workout.png', { type: 'image/png' });
  const controller = new AbortController();
  expect(await draftExercisesWithAI('3 rounds', context, screenshot, controller.signal)).toEqual({ blocks: [], issues: [] });
  const request = transport.fetch.mock.calls[0]![0] as Request;
  expect(request.url).toBe('https://api.example/v1/workouts/exercises/ai-draft');
  expect(request.method).toBe('POST');
  expect(request.headers.get('Content-Type')).toBe('application/json');
  expect(await request.json()).toEqual({ content: '3 rounds', context, screenshot: { media_type: 'image/png', data: png } });
  controller.abort();
  expect(request.signal.aborted).toBe(true);
});

it('reports server errors without returning an exercise draft', async () => {
  transport.fetch.mockResolvedValue(response({ error: 'Choose Pro to use AI' }, 403));
  await expect(draftExercisesWithAI('squats', { mode: 'planned', current_blocks: [] })).rejects.toThrow('Choose Pro');
});

it.each(['legacy', 'imported', 'structured'] as const)('serializes saved %s sets without database IDs', async kind => {
  const set = { id: 42, set_order: 1, reps: 8, load_kg: 0, duration_seconds: 30, distance_m: 25,
    rest_seconds: 90, rir: 0, rpe: 8, tempo: '3-1-1', is_warmup: true,
    counting_version: 'v1', counting_convention: { version: 'v1', weight_basis: 'total', reps_basis: 'total' }, external_volume_kg_reps: 0 };
  const original: WorkoutResponse = { date: '2026-11-17', sport: 'strength_training', category: 'strength',
    source: kind === 'imported' ? 'fit' : 'manual', completed: kind !== 'structured',
    components: [{ type: 'exercise', exercise_code: 'back_squat', sets: [set] }],
    blocks: kind === 'structured' ? [{ id: 'saved-block', format: 'straight_sets', movements: [{ exercise_code: 'back_squat', sets: [set] }] }] : [],
  };
  const context = exerciseContext(makeDraft('2026-11-17', '2026-11-17', original));
  const before = structuredClone(context);
  await draftExercisesWithAI('Keep these sets', context);
  const request = transport.fetch.mock.calls[0]![0] as Request;
  const body = await request.json();
  const sent = body.context;
  const { id: savedID, ...expectedSet } = set;
  expect(savedID).toBe(42);
  expect(sent).toMatchObject({ mode: kind === 'structured' ? 'planned' : 'performed', current_blocks: [{
    id: kind === 'structured' ? 'saved-block' : 'legacy-0', movements: [{ exercise_code: 'back_squat', sets: [expectedSet] }],
  }] });
  expect(sent.current_blocks[0].movements[0].sets[0]).toEqual(expectedSet);
  expect(body.screenshot).toBeUndefined();
  expect(request.headers.get('Content-Type')).toBe('application/json');
  expect(context).toEqual(before);
});

it('preserves imported context larger than the generated editor block limit', async () => {
  const original: WorkoutResponse = { date: '2026-11-17', sport: 'strength_training', category: 'strength', source: 'fit', completed: true,
    components: Array.from({ length: 64 }, (_, i) => ({ type: 'exercise', exercise_code: 'unknown_exercise', sets: [{ id: i + 1, set_order: 1, reps: i + 1 }] })),
  };
  await draftExercisesWithAI('Replace these exercises', exerciseContext(makeDraft('2026-11-17', '2026-11-17', original)));
  const request = transport.fetch.mock.calls[0]![0] as Request;
  const body = await request.json();
  expect(body.context.current_blocks).toHaveLength(64);
  expect(body.context.current_blocks[63]).toMatchObject({ id: 'legacy-63', movements: [{ exercise_code: 'unknown_exercise', sets: [{ set_order: 1, reps: 64 }] }] });
  expect(body.context.current_blocks[63].movements[0].sets[0]).not.toHaveProperty('id');
});

it.each(['before', 'during'])('does not send a screenshot request cancelled %s encoding', async when => {
  const controller = new AbortController();
  if (when === 'before') controller.abort();
  const pending = draftExercisesWithAI('Use these sets', { mode: 'performed', current_blocks: [] }, new File(['png'], 'screen.png', { type: 'image/png' }), controller.signal);
  if (when === 'during') controller.abort();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  expect(transport.fetch).not.toHaveBeenCalled();
});
