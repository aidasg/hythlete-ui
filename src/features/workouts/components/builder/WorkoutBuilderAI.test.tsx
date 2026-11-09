import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import { WorkoutBuilder } from './WorkoutBuilder';
import type { WorkoutCatalogResponse, WorkoutRequest } from '../../services/workoutApi';
import type { ExerciseAIResult } from '../../services/exerciseAI';

const mocks = vi.hoisted(() => ({ generate: vi.fn(), create: vi.fn(), update: vi.fn() }));
vi.mock('@/features/auth/context/useAuth', () => ({ useAuth: () => ({ session: { profile: { timezone: 'Europe/Vilnius' } } }) }));
vi.mock('@/features/strategy/hooks/useTodayDate', () => ({ useTodayDate: () => '2026-11-03' }));
vi.mock('@/services/query/invalidation', () => ({ invalidateWorkoutDerivedData: vi.fn() }));
vi.mock('@/features/billing/services/billingApi', () => ({ billingKeys: { subscription: ['billing', 'subscription'] }, getSubscription: async () => ({ ai_access: true }) }));
vi.mock('../../services/workoutApi', () => ({ createWorkout: mocks.create, updateWorkout: mocks.update, getWorkoutCatalog: vi.fn() }));
vi.mock('../../services/exerciseAI', async importOriginal => ({ ...await importOriginal<typeof import('../../services/exerciseAI')>(), draftExercisesWithAI: mocks.generate }));
const catalog: WorkoutCatalogResponse = { activities: [{ code: 'strength_training', name: 'Strength training', builder_kind: 'strength', training_category: 'strength', formats: ['straight_sets'] }], exercises: [{ code: 'back_squat', name: 'Back squat' }] };
const initial: WorkoutRequest = { date: '2026-11-03', source: 'fit', sport: 'strength_training', category: 'strength', completed: true, title: 'Imported lift', duration_minutes: 20, components: [{ order: 1, type: 'exercise', exercise_code: 'back_squat', sets: [{ set_order: 1, reps: 5, load_kg: 50 }] }], blocks: [{ id: 'plan', format: 'straight_sets', movements: [{ exercise_code: 'back_squat', sets: [{ reps: 99 }] }] }] };
const result: ExerciseAIResult = { blocks: [{ id: 'ai-0', format: 'straight_sets', completion: 'manual', rounds: 1, movements: [{ exercise_code: 'back_squat', sets: [{ set_order: 1, reps: 8, load_kg: 40 }] }] }], issues: [] };
function mount(workout = initial) {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><WorkoutBuilder selectedDate="2026-11-03" initialWorkout={structuredClone(workout)} workoutId={3} catalog={catalog}/></QueryClientProvider>);
}
async function generate() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Set exercises with AI' }));
  await user.type(screen.getByLabelText('Describe the exercises'), '8 squats at 40 kg');
  await user.click(screen.getByRole('button', { name: 'Set exercises' }));
  return user;
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.generate.mockResolvedValue(result);
  mocks.update.mockImplementation(async (_id: number, body: WorkoutRequest) => ({ data: { ...body, id: 3 } }));
});

it('applies without saving, locks generation, then saves manual adjustments normally', async () => {
  let complete!: (result: ExerciseAIResult) => void;
  mocks.generate.mockReturnValue(new Promise(resolve => { complete = resolve; }));
  mount(); const user = await generate();
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  expect(screen.getByLabelText('Elapsed duration (minutes)')).toBeDisabled();
  await act(async () => complete(result));
  const summary = await screen.findByText('Back squat \u00b7 8 reps @ 40 kg');
  expect(summary.closest('details')).not.toHaveAttribute('open');
  expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Adjust exercises' }));
  const set = screen.getByRole('group', { name: 'Set 1' });
  fireEvent.change(within(set).getByLabelText('Reps'), { target: { value: '10' } });
  await user.click(screen.getByRole('button', { name: 'Review & save' }));
  expect(mocks.update).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(mocks.update).toHaveBeenCalled());
  expect(mocks.update).toHaveBeenCalledWith(3, expect.objectContaining({ blocks: initial.blocks, components: [expect.objectContaining({ sets: [expect.objectContaining({ reps: 10, load_kg: 40 })] })] }));
});

it('rejects AI exercises without reverting later metadata edits', async () => {
  mount(); const user = await generate();
  await screen.findByText('Back squat \u00b7 8 reps @ 40 kg');
  await user.click(screen.getByRole('button', { name: 'Review & save' }));
  fireEvent.change(screen.getByLabelText('Notes (optional)'), { target: { value: 'Keep this note' } });
  await user.click(screen.getByRole('button', { name: 'Reject AI changes' }));
  expect(screen.getByLabelText('Notes (optional)')).toHaveValue('Keep this note');
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(mocks.update).toHaveBeenCalled());
  expect(mocks.update.mock.calls[0]![1]).toMatchObject({ notes: 'Keep this note', components: [{ sets: [{ reps: 5, load_kg: 50 }] }] });
});

it('keeps unclear library mappings editable and blocks saving until corrected', async () => {
  mocks.generate.mockResolvedValue({ blocks: [{ id: 'ai-0', format: 'straight_sets', completion: 'manual', movements: [{ exercise_code: '', sets: [{ reps: 8 }] }] }], issues: [{ block_id: 'ai-0', movement_index: 0, field: 'exercise_code', source_name: 'Unclear squat', message: 'Choose the library exercise.', required: true }] });
  mount(); const user = await generate();
  await screen.findByText(/Unclear squat.*8 reps/);
  await user.click(screen.getByRole('button', { name: 'Review & save' }));
  expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
  expect(mocks.update).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Adjust exercises' }));
  await user.click(screen.getByRole('button', { name: /Select exercise/ }));
  await user.click(screen.getByRole('option', { name: /Back squat/ }));
  await user.click(screen.getByRole('button', { name: 'Review & save' }));
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
});
