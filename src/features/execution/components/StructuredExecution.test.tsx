import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StructuredExecution } from './StructuredExecution';
import type { WorkoutResponse } from '@/features/workouts/services/workoutApi';
const mocks = vi.hoisted(() => ({ read: vi.fn(), persist: vi.fn(), complete: vi.fn() }));
vi.mock('../services/execution', () => ({ readExecution: mocks.read, persistExecution: mocks.persist, completeExecution: mocks.complete, elapsed: (s: { elapsedMs: number }) => s.elapsedMs, beginExecution: vi.fn() }));
vi.mock('@/services/query/invalidation', () => ({ invalidateWorkoutDerivedData: vi.fn() }));
vi.mock('@/features/workouts/components/WorkoutImpactPanel', () => ({ WorkoutImpactPanel: () => <p>Saved impact</p> }));
const workout: WorkoutResponse = { id: 3, structure_version: 2, title: 'Strength', blocks: [{ id: 'strength', format: 'straight_sets', completion: 'manual', movements: [{ exercise_code: 'back_squat', sets: [{ reps: 5, load_kg: 80 }, { reps: 3, load_kg: 85 }] }] }, { id: 'swim', format: 'steady', completion: 'distance', movements: [{ sport: 'swimming', distance_m: 1000 }] }] };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.read.mockReturnValue({ version: 1, userID: 1, workout, elapsedMs: 120000, runningSince: null, result: { key: 'same-key', blocks: [] }, pending: false, saved: false });
  mocks.complete.mockResolvedValue({ data: { ...workout, completed: true } });
});
function mount() { render(<MemoryRouter><QueryClientProvider client={new QueryClient()}><StructuredExecution uid={1} workout={workout} catalog={{ exercises: [{ code: 'back_squat', name: 'Back squat' }], effort_zones: ['easy'] }} /></QueryClientProvider></MemoryRouter>); }
describe('version 2 workout execution', () => {
  it('waits for explicit completion and saves only the set actually logged, retrying with the same key', async () => {
    const user = userEvent.setup(); mocks.complete.mockResolvedValueOnce({ error: { error: 'Offline' } }); mount();
    expect(screen.getByText('Complete this block when your work is done.', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finish and save' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Record set 1' })); await user.click(screen.getByRole('button', { name: 'Log performed work' }));
    await user.click(screen.getByRole('button', { name: 'Finish and save' }));
    await waitFor(() => expect(mocks.complete).toHaveBeenCalledTimes(1));
    const result = mocks.complete.mock.calls[0]![1];
    expect(result.key).toBe('same-key'); expect(result.blocks).toHaveLength(1); expect(result.blocks[0].movements[0].sets).toHaveLength(1); expect(result.blocks[0].movements[0].sets[0].reps).toBe(5);
    await user.click(await screen.findByRole('button', { name: 'Retry save' })); await waitFor(() => expect(screen.getByText('Workout saved')).toBeInTheDocument());
    expect(mocks.complete.mock.calls[1]![1]).toEqual(result);
  });
});
