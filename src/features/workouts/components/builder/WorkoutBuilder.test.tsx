import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkoutBuilder } from './WorkoutBuilder';
import { WorkoutModal } from '../WorkoutModal';
import type { WorkoutCatalogResponse, WorkoutRequest } from '../../services/workoutApi';
const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), catalog: vi.fn(), invalidate: vi.fn() }));
vi.mock('@/features/auth/context/useAuth', () => ({ useAuth: () => ({ session: { profile: { timezone: 'Europe/Rome', preferred_sports: [{ code: 'running' }] } } }) }));
vi.mock('@/features/strategy/hooks/useTodayDate', () => ({ useTodayDate: () => '2026-10-13' }));
vi.mock('@/services/query/invalidation', () => ({ invalidateWorkoutDerivedData: mocks.invalidate }));
vi.mock('../../services/workoutApi', () => ({ createWorkout: mocks.create, updateWorkout: mocks.update, getWorkoutCatalog: mocks.catalog }));
const catalog: WorkoutCatalogResponse = { activities: [{ code: 'running', name: 'Running', builder_kind: 'endurance', training_category: 'endurance', formats: ['steady', 'intervals'] }, { code: 'strength_training', name: 'Strength training', builder_kind: 'strength', training_category: 'strength', formats: ['straight_sets'] }, { code: 'yoga', name: 'Yoga', builder_kind: 'general', formats: ['steady'], training_category: 'mobility' }], effort_zones: ['easy', 'threshold', 'recovery'], exercises: [{ code: 'back_squat', name: 'Back squat' }] };
function mount(initialWorkout?: WorkoutRequest, date = '2026-10-13', close = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const created = vi.fn();
  render(<QueryClientProvider client={client}><WorkoutModal title="New workout" eyebrow="Calendar" onClose={close}><WorkoutBuilder selectedDate={date} initialWorkout={initialWorkout} catalog={catalog} onCreated={created} /></WorkoutModal></QueryClientProvider>);
  return { created, close };
}
beforeEach(() => { vi.clearAllMocks(); mocks.catalog.mockResolvedValue({ data: catalog }); mocks.create.mockImplementation(async (body: WorkoutRequest) => ({ data: { ...body, id: 42 } })); });
describe('guided workout builder', () => {
  it('builds an endurance plan without sets or free-text subtype controls', async () => {
    const user = userEvent.setup(); const { created } = mount();
    await user.click(screen.getByRole('button', { name: 'Running' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('heading', { name: 'Build your workout' })).toHaveFocus();
    expect(screen.getByLabelText('Effort zone')).toBeInTheDocument();
    expect(screen.queryByText('Set target')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Subtype')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Effort zone'), 'threshold');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Save planned workout' }));
    await waitFor(() => expect(created).toHaveBeenCalled());
    expect(mocks.create.mock.calls[0]![0]).toMatchObject({ sport: 'running', structure_version: 2, blocks: [{ movements: [{ intensity_zone: 'threshold' }] }] });
  });
  it('supports a quick completed log and retries without losing entered values', async () => {
    const user = userEvent.setup(); mocks.create.mockResolvedValueOnce({ error: { error: 'Offline' } }); mount(undefined, '2026-10-12');
    await user.click(screen.getByRole('button', { name: 'Strength training' })); await user.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByLabelText('Elapsed duration (minutes)'), { target: { value: '30' } });
    await user.click(screen.getByRole('button', { name: 'Continue' })); await user.click(screen.getByRole('button', { name: 'Save completed workout' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Offline');
    expect(screen.getByLabelText('Elapsed duration (minutes)')).toHaveValue(30);
    await user.click(screen.getByRole('button', { name: 'Save completed workout' })); await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
    expect(mocks.create.mock.calls[1]![0]).toMatchObject({ components: [], completed: true, duration_minutes: 30 });
  });
  it('preserves blocks across navigation and supports remove/undo', async () => {
    const user = userEvent.setup(); mount(); await user.click(screen.getByRole('button', { name: 'Running' })); await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Intervals' }));
    const repeats = screen.getByLabelText('Repeats'); fireEvent.change(repeats, { target: { value: '6' } });
    await user.click(screen.getByRole('button', { name: 'Back' })); await user.click(screen.getByRole('button', { name: 'Continue' })); expect(screen.getByLabelText('Repeats')).toHaveValue(6);
    await user.click(screen.getAllByRole('button', { name: 'Remove' })[1]!); expect(screen.queryByLabelText('Repeats')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Undo' })); expect(screen.getByLabelText('Repeats')).toHaveValue(6);
  });
  it('asks before closing a dirty builder', async () => {
    const user = userEvent.setup(); const { close } = mount(); const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await user.click(screen.getByRole('button', { name: 'Running' })); await user.click(screen.getByRole('button', { name: 'Close modal' }));
    expect(confirm).toHaveBeenCalled(); expect(close).not.toHaveBeenCalled(); confirm.mockRestore();
  });
  it('shows only exercise controls for a strength block', async () => {
    const user = userEvent.setup(); mount(); await user.click(screen.getByRole('button', { name: 'Strength training' })); await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByLabelText('Set target')).toBeInTheDocument(); expect(screen.queryByLabelText('Effort zone')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Select exercise/ })); await user.click(screen.getByRole('option', { name: /Back squat/ }));
    const set = screen.getByRole('group', { name: 'Set 1' }); fireEvent.change(within(set).getByLabelText('Reps'), { target: { value: '5' } });
    expect(within(set).getByLabelText('Reps')).toHaveValue(5);
  });
});
