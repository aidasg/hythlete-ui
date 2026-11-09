import { beforeEach, expect, it, vi } from 'vitest';
import { draftExercisesWithAI } from './exerciseAI';

const client = vi.hoisted(() => ({ POST: vi.fn() }));
vi.mock('@/services/api/client', () => ({ apiClient: client }));
beforeEach(() => vi.clearAllMocks());

it('sends text, JSON context, screenshot and abort signal as a multipart request', async () => {
  const response = { blocks: [], issues: [] }; client.POST.mockResolvedValue({ data: response });
  const context = { activity: 'hiit', mode: 'performed' as const, current_blocks: [] };
  const screenshot = new File(['png'], 'workout.png', { type: 'image/png' });
  const controller = new AbortController();
  expect(await draftExercisesWithAI('3 rounds', context, screenshot, controller.signal)).toEqual(response);
  const [path, request] = client.POST.mock.calls[0]!;
  expect(path).toBe('/v1/workouts/exercises/ai-draft');
  expect(request.signal).toBe(controller.signal);
  const form = request.bodySerializer(request.body) as FormData;
  expect(form.get('content')).toBe('3 rounds');
  expect(JSON.parse(form.get('context') as string)).toEqual(context);
  expect(form.get('screenshot')).toBe(screenshot);
});

it('reports server errors without returning an exercise draft', async () => {
  client.POST.mockResolvedValue({ error: { error: 'Choose Pro to use AI' }, response: new Response(null, {status:403, headers:{'X-REQUEST-ID':'exercise-123'}}) });
  await expect(draftExercisesWithAI('squats', { mode: 'planned', current_blocks: [] })).rejects.toThrow('Choose Pro');
});
