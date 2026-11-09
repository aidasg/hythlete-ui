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
    expect(await screen.findByRole('alert')).toHaveTextContent('Request failed. Request ID unavailable.');
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
    const summary = screen.getByText(/Choose an exercise ·/);
    expect(summary.closest('details')).not.toHaveAttribute('open');
    await user.click(summary);
    expect(screen.getByLabelText('Set target')).toBeInTheDocument(); expect(screen.queryByLabelText('Effort zone')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Select exercise/ })); await user.click(screen.getByRole('option', { name: /Back squat/ }));
    const set = screen.getByRole('group', { name: 'Set 1' }); fireEvent.change(within(set).getByLabelText('Reps'), { target: { value: '5' } });
    expect(within(set).getByLabelText('Reps')).toHaveValue(5);
  });
});

it('edits collapsed imported sets and uses refreshed impact from the save response', async () => {
  const user = userEvent.setup();
  const original: WorkoutRequest = { date: '2026-10-13', source: 'fit', completed: true, sport: 'strength_training', category: 'strength', title: 'Imported lift', duration_minutes: 20,
    components: [{ order: 1, type: 'exercise', exercise_code: 'back_squat', sets: [{ set_order: 1, reps: 5, load_kg: 80 }] }],
    blocks: [{ id: 'plan', format: 'straight_sets', movements: [{ exercise_code: 'back_squat', sets: [{ reps: 99 }] }] }] };
  const saved = { ...original, id: 3, loads: { strength_load: 123 } };
  mocks.update.mockResolvedValue({ data: saved });
  const created = vi.fn();
  render(<QueryClientProvider client={new QueryClient()}><WorkoutBuilder selectedDate="2026-10-13" initialWorkout={original} workoutId={3} catalog={catalog} onCreated={created}/></QueryClientProvider>);
  const summary = screen.getByText('Back squat · 5 reps @ 80 kg');
  const row = summary.closest('details')!;
  expect(row).not.toHaveAttribute('open');
  await user.click(summary);
  fireEvent.change(within(within(row).getByRole('group', { name: 'Set 1' })).getByLabelText('Reps'), { target: { value: '8' } });
  expect(row).toHaveAttribute('open');
  expect(summary).toHaveTextContent('8 reps @ 80 kg');
  await user.click(summary);
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(created).toHaveBeenCalledWith(saved));
  expect(mocks.update).toHaveBeenCalledWith(3, expect.objectContaining({ blocks: original.blocks, components: [expect.objectContaining({ sets: [expect.objectContaining({ reps: 8, load_kg: 80 })] })] }));
  expect(mocks.invalidate).toHaveBeenCalled();
  expect(original.components![0]!.sets![0]!.reps).toBe(5);
});

it('adds exercises to a FIT HIIT import with no recorded exercises', async () => {
  const user = userEvent.setup();
  const original: WorkoutRequest = { date: '2026-10-13', source: 'fit', completed: true, sport: 'hiit', category: 'mixed', duration_minutes: 20, components: [{ order: 1, type: 'steady', duration_seconds: 1200, sport: 'hiit' }] };
  mocks.update.mockImplementation(async (_id: number, body: WorkoutRequest) => ({ data: { ...body, id: 4 } }));
  render(<QueryClientProvider client={new QueryClient()}><WorkoutBuilder selectedDate="2026-10-13" initialWorkout={original} workoutId={4} catalog={catalog}/></QueryClientProvider>);
  await user.click(screen.getByRole('button', { name: 'Add exercise' }));
  await user.click(screen.getByText(/Choose an exercise ·/));
  await user.click(screen.getByRole('button', { name: /Select exercise/ }));
  await user.click(screen.getByRole('option', { name: /Back squat/ }));
  fireEvent.change(within(screen.getByRole('group', { name: 'Set 1' })).getByLabelText('Reps'), { target: { value: '10' } });
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(mocks.update).toHaveBeenCalled());
  expect(mocks.update.mock.calls[0]![1].components).toMatchObject([original.components![0], { type: 'exercise', exercise_code: 'back_squat', sets: [{ reps: 10 }] }]);
});

it('saves an imported activity title and type without replacing its recording', async () => {
  const user=userEvent.setup();
  const original:WorkoutRequest={date:'2026-10-13',source:'fit',completed:true,sport:'inline_skating',title:'Imported skate',category:'endurance',duration_minutes:25,
    execution:{key:'fit:original',elapsed_seconds:1500,imported_activity:{segments:[{component:{order:1,type:'steady',sport:'inline_skating',duration_seconds:1500}}]}},
    components:[{order:1,type:'steady',sport:'inline_skating',duration_seconds:1500}]};
  mocks.update.mockResolvedValue({data:{...original,title:'Evening skate',sport:'running'}});
  render(<QueryClientProvider client={new QueryClient()}><WorkoutBuilder selectedDate="2026-10-13" initialWorkout={original} workoutId={3} catalog={catalog}/></QueryClientProvider>);
  expect(screen.queryByRole('button',{name:'Detailed log'})).not.toBeInTheDocument();
  await user.click(screen.getByRole('button',{name:'Back'}));
  await user.click(screen.getByRole('button',{name:'Running'}));
  expect(screen.queryByRole('button',{name:'Update activity blocks'})).not.toBeInTheDocument();
  await user.click(screen.getByRole('button',{name:'Continue'}));
  await user.click(screen.getByRole('button',{name:'Continue'}));
  const title=screen.getByLabelText('Workout title');
  await user.clear(title);await user.type(title,'Evening skate');
  await user.click(screen.getByRole('button',{name:'Save changes'}));
  await waitFor(()=>expect(mocks.update).toHaveBeenCalledOnce());
  expect(mocks.update).toHaveBeenCalledWith(3,expect.objectContaining({title:'Evening skate',sport:'running',execution:original.execution,components:original.components}));
});
