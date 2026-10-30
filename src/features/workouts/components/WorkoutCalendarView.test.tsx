import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkoutCalendarView } from './WorkoutCalendarView';
import { getTodayKey, formatDisplayDate, getMonthKey } from '../services/workoutDates';

const api = vi.hoisted(() => ({
  getWorkoutCatalog: vi.fn(), listWorkouts: vi.fn(), getWorkoutReadiness: vi.fn(),
  getWorkout: vi.fn(), prescribeWorkouts: vi.fn(), deleteWorkout: vi.fn(),
  listCalendarReadinessEntries: vi.fn(), saveCalendarReadinessEntries: vi.fn(),
}));
vi.mock('../services/workoutApi', () => api);
vi.mock('../services/calendarReadinessApi', () => api);
vi.mock('./WorkoutCreateForm', () => ({ WorkoutCreateForm: () => <p>Workout editor</p> }));
vi.mock('./WorkoutFitImportForm', () => ({ WorkoutFitImportForm: () => null }));
vi.mock('./WorkoutDetailPanel', () => ({ WorkoutDetailPanel: () => null }));
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
