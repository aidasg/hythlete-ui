import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkoutCalendarView } from './WorkoutCalendarView';
import type { WorkoutResponse } from '../services/workoutApi';
import { getTodayKey, formatDisplayDate, getMonthKey } from '../services/workoutDates';

const api = vi.hoisted(() => ({
  getWorkoutCatalog: vi.fn(), listWorkouts: vi.fn(), getWorkoutReadiness: vi.fn(),
  getWorkout: vi.fn(), reanalyseWorkout: vi.fn(), prescribeWorkouts: vi.fn(), deleteWorkout: vi.fn(),
  listCalendarReadinessEntries: vi.fn(), saveCalendarReadinessEntries: vi.fn(),
}));
vi.mock('../services/workoutApi', () => api);
vi.mock('../services/calendarReadinessApi', () => api);
vi.mock('./WorkoutCreateForm', () => ({ WorkoutCreateForm: () => <p>Workout editor</p> }));
vi.mock('./WorkoutFitImportForm', () => ({ WorkoutFitImportForm: ({onImported}: {onImported: (workouts: WorkoutResponse[]) => void}) => <button onClick={() => onImported([{id:91,title:'Imported run',date:'2026-01-01',completed:true}])}>Complete batch import</button> }));
vi.mock('./WorkoutDetailPanel', () => ({ WorkoutDetailPanel: ({workout, onReanalyse, isReanalysing, reanalysisError, reanalysisSuccess}: {
  workout: WorkoutResponse | null; onReanalyse: (w: WorkoutResponse) => void; isReanalysing: boolean;
  reanalysisError: string | null; reanalysisSuccess: boolean;
}) => <div>
  <p>Detail: {workout?.title}</p>
  {workout?.can_reanalyse && <button disabled={isReanalysing} onClick={() => onReanalyse(workout)}>Reanalyse</button>}
  {reanalysisError && <p role="alert">{reanalysisError}</p>}
  {reanalysisSuccess && <p role="status">Activity reanalysed.</p>}
</div> }));
vi.mock('./WorkoutRecommendationPreview', () => ({ WorkoutRecommendationPreview: () => <p>Suggested workout preview</p> }));

function setup(wide = false) {
  vi.mocked(window.matchMedia).mockImplementation(query => ({ matches: wide, media: query, onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn() }));
  return render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><WorkoutCalendarView /></MemoryRouter></QueryClientProvider>);
}
beforeEach(() => {
  vi.clearAllMocks();
  api.getWorkoutCatalog.mockResolvedValue({data:{}});
  api.listWorkouts.mockResolvedValue({data:[]});
  api.listCalendarReadinessEntries.mockResolvedValue({data:{entries:[]}});
  api.getWorkoutReadiness.mockResolvedValue({data:{recommendation:'train', training_options:[{key:'easy',focus:'Easy endurance',sport:'running'}]}});
  api.prescribeWorkouts.mockResolvedValue({data:{drafts:[]}});
});

describe('calendar readiness', () => {
  it('refreshes after a batch import while keeping the import flow and calendar month open', async () => {
    const user = userEvent.setup(); setup();
    await waitFor(() => expect(api.listWorkouts).toHaveBeenCalled());
    const originalRange = api.listWorkouts.mock.calls[api.listWorkouts.mock.calls.length - 1]?.[0];
    await user.click(screen.getByRole('button', {name:'More calendar actions'}));
    await user.click(screen.getByRole('menuitem', {name:'Import FIT or ZIP'}));
    expect(screen.getByRole('dialog', {name:'Import activities'})).toBeInTheDocument();
    const count = api.listWorkouts.mock.calls.length;
    await user.click(screen.getByRole('button', {name:'Complete batch import'}));
    await waitFor(() => expect(api.listWorkouts.mock.calls.length).toBeGreaterThan(count));
    expect(api.listWorkouts).toHaveBeenLastCalledWith(originalRange);
    expect(screen.getByRole('dialog', {name:'Import activities'})).toBeInTheDocument();
    expect(screen.queryByText('Detail: Imported run')).not.toBeInTheDocument();
  });
  it('loads markers independently and fetches readiness only when open, refreshing the selected date', async () => {
    const user = userEvent.setup(); setup(true);
    await waitFor(() => expect(api.listCalendarReadinessEntries).toHaveBeenCalled());
    const toggle = screen.getByRole('button', {name:'Readiness'});
    expect(toggle).toHaveAttribute('aria-expanded','false');
    expect(api.getWorkoutReadiness).not.toHaveBeenCalled();
    await user.click(toggle);
    await waitFor(() => expect(api.getWorkoutReadiness).toHaveBeenCalledWith(getTodayKey()));
    expect(screen.getByRole('complementary',{name:'Readiness'})).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const differentDate = getMonthKey(getTodayKey()).slice(0,8) + (getTodayKey().endsWith('01') ? '02' : '01');
    await user.click(screen.getByRole('button',{name:`Select ${formatDisplayDate(differentDate)}`}));
    await waitFor(() => expect(api.getWorkoutReadiness).toHaveBeenLastCalledWith(differentDate));
    await user.click(screen.getByRole('button',{name:'Close readiness'}));
    const count = api.getWorkoutReadiness.mock.calls.length;
    await user.click(screen.getByRole('button',{name:'Next month'}));
    expect(api.getWorkoutReadiness).toHaveBeenCalledTimes(count);
    expect(toggle).toHaveAttribute('aria-expanded','false');
  });

  it('traps drawer focus, dismisses with Escape or backdrop, and restores focus', async () => {
    const user = userEvent.setup(); const {container} = setup();
    const toggle = screen.getByRole('button',{name:'Readiness'});
    await user.click(toggle);
    const dialog = await screen.findByRole('dialog',{name:'Readiness'});
    await waitFor(() => expect(within(dialog).getByRole('button',{name:'Close modal'})).toHaveFocus());
    const close = within(dialog).getByRole('button',{name:'Close modal'});
    const lastControl = within(dialog).getByText('Limiters').closest('summary')!;
    lastControl.focus(); await user.tab(); expect(close).toHaveFocus();
    await user.tab({shift:true}); expect(lastControl).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(toggle).toHaveFocus();
    await user.click(toggle);
    fireEvent.mouseDown(container.querySelector('.workout-drawer-backdrop')!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(toggle).toHaveFocus();
  });

  it('closes the drawer before opening a recommendation', async () => {
    const user = userEvent.setup(); setup();
    await user.click(screen.getByRole('button',{name:'Readiness'}));
    const option = await screen.findByRole('button',{name:/Easy endurance/i});
    await user.click(option);
    expect(screen.queryByRole('dialog',{name:'Readiness'})).not.toBeInTheDocument();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByText('Suggested workout preview')).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Readiness'})).toHaveAttribute('aria-expanded','false');
    expect(api.prescribeWorkouts).toHaveBeenCalledWith(expect.objectContaining({date:getTodayKey(),option_key:'easy'}));
  });
});

it('reanalyses the selected activity once, shows errors, and refreshes details on retry', async () => {
  const user = userEvent.setup();
  const workout = { id: 3, date: getTodayKey(), title: 'Imported ride', completed: true, can_reanalyse: true };
  const refreshed = { ...workout, title: 'Refreshed ride' };
  api.listWorkouts.mockResolvedValue({data:[workout]});
  api.getWorkout.mockResolvedValue({data:workout});
  let finish!: (value: unknown) => void;
  api.reanalyseWorkout.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  setup(true);
  await user.click(await screen.findByRole('button', { name: /Imported ride/ }));
  await waitFor(() => expect(api.getWorkout).toHaveBeenCalledWith(3));
  await user.click(screen.getByRole('button', { name: 'Reanalyse' }));
  expect(screen.getByRole('button', { name: 'Reanalyse' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Reanalyse' }));
  expect(api.reanalyseWorkout).toHaveBeenCalledTimes(1);
  finish({error:{error:'Request failed. Activity changed; retry Request ID: reanalysis-123',request_id:'reanalysis-123'}});
  expect(await screen.findByRole('alert')).toHaveTextContent('Request failed. Activity changed; retry Request ID: reanalysis-123');
  expect(screen.getByRole('button', { name: 'Reanalyse' })).toBeEnabled();
  api.reanalyseWorkout.mockResolvedValueOnce({data:refreshed});
  api.listWorkouts.mockResolvedValue({data:[refreshed]});
  await user.click(screen.getByRole('button', { name: 'Reanalyse' }));
  expect(await screen.findByText('Detail: Refreshed ride')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Activity reanalysed.');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(api.reanalyseWorkout).toHaveBeenLastCalledWith(3);
});
