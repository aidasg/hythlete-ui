import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WorkoutDetailPanel } from './WorkoutDetailPanel';
vi.mock('./WorkoutImpactPanel', () => ({ WorkoutImpactPanel: () => <section aria-label="Load analysis"/> }));
describe('workout detail presentation', () => {
  it('keeps recorded effort before load analysis and a legacy plan collapsed', () => {
    const {container} = render(<WorkoutDetailPanel isLoading={false} errorMessage={null} workout={{completed:true,execution:{imported_activity:{segments:[{component:{duration_seconds:40,effort:{zone:'easy'}}}],prescription_components:[{duration_seconds:300,intensity_zone:'threshold',repeats:3}]}}}}/>);
    expect(screen.getByRole('group',{name:'Recorded effort by active time'})).toBeInTheDocument();
    expect(screen.getByText('Original workout plan').closest('details')).not.toHaveAttribute('open');
    expect(container.querySelector('.workout-timeline')!.compareDocumentPosition(screen.getByRole('region',{name:'Load analysis'})) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole('heading',{name:'Components'})).not.toBeInTheDocument();
  });
  it('retains strength sets instead of presenting an endurance timeline', () => {
    render(<WorkoutDetailPanel isLoading={false} errorMessage={null} workout={{completed:true,category:'strength',components:[{type:'exercise',exercise_name:'Squat',sets:[{set_order:1,reps:5,load_kg:80}]}]}}/>);
    expect(screen.getByRole('heading',{name:'Components'})).toBeInTheDocument();
    expect(screen.getByText(/Squat/)).toBeInTheDocument();
    expect(screen.getByText(/80/)).toBeInTheDocument();
    expect(screen.queryByRole('region',{name:'Workout timeline'})).not.toBeInTheDocument();
  });
});

it('opens reanalysis options only for eligible completed FIT activities', () => {
  const onReanalyse = vi.fn();
  const workout = { id: 3, title: 'Ride', completed: true, can_reanalyse: true };
  const { rerender } = render(<WorkoutDetailPanel isLoading={false} errorMessage={null} workout={workout} onReanalyse={onReanalyse} />);
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Reanalyse' }));
  expect(screen.getByRole('dialog', {name:'Reanalyse activity'})).toBeInTheDocument();
  expect(onReanalyse).not.toHaveBeenCalled();
  rerender(<WorkoutDetailPanel isLoading={false} errorMessage={null} workout={{...workout, can_reanalyse: false}} onReanalyse={onReanalyse} />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Reanalyse' })).not.toBeInTheDocument();
  rerender(<WorkoutDetailPanel isLoading={false} errorMessage={null} workout={{...workout, completed: false}} onReanalyse={onReanalyse} />);
  expect(screen.queryByRole('button', { name: 'Reanalyse' })).not.toBeInTheDocument();
});

it('keeps power options local until confirmation and restores saved options after cancellation', async () => {
  const onReanalyse = vi.fn();
  const workout = {id:3,completed:true,can_reanalyse:true,execution:{imported_activity:{power_target_unit:'watts' as const,use_stryd_power:false,segments:[]}}};
  const {rerender} = render(<WorkoutDetailPanel isLoading={false} errorMessage={null} workout={workout} onReanalyse={onReanalyse}/>);
  fireEvent.click(screen.getByRole('button', {name:'Reanalyse'}));
  expect(screen.getByRole('combobox', {name:'FIT power target units'})).toHaveValue('watts');
  expect(screen.getByRole('checkbox')).not.toBeChecked();
  fireEvent.change(screen.getByRole('combobox'), {target:{value:'percent_ftp'}});
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', {name:'Cancel'}));
  expect(onReanalyse).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name:'Reanalyse'}));
  expect(screen.getByRole('combobox')).toHaveValue('watts');
  expect(screen.getByRole('checkbox')).not.toBeChecked();
  fireEvent.change(screen.getByRole('combobox'), {target:{value:'percent_ftp'}});
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', {name:'Reanalyse'}));
  expect(onReanalyse).toHaveBeenCalledWith(workout,'percent_ftp',true);
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  rerender(<WorkoutDetailPanel isLoading={false} errorMessage={null} workout={{...workout,id:4,execution:undefined}} onReanalyse={onReanalyse}/>);
  fireEvent.click(screen.getByRole('button', {name:'Reanalyse'}));
  expect(screen.getByRole('combobox')).toHaveValue('auto');
  expect(screen.getByRole('checkbox')).toBeChecked();
});

it('shows Stryd as the recorded power source', () => {
  render(<WorkoutDetailPanel isLoading={false} errorMessage={null} workout={{completed:true,execution:{imported_activity:{power_source:'stryd',segments:[{component:{duration_seconds:60,metrics:{avg_power_watts:242}}}]}}}}/>);
  expect(screen.getByText('Power source: Stryd (W)')).toBeInTheDocument();
  expect(screen.getByText('Average power').parentElement).toHaveTextContent('242 W');
});

it('shows the exact activity name independently of title and updates after edits', () => {
  const activities=[{code:'inline_skating',name:'Inline Skating'}, {code:'running',name:'Running'}];
  const {rerender}=render(<WorkoutDetailPanel isLoading={false} errorMessage={null} activities={activities} workout={{title:'Evening session',sport:'inline_skating',category:'endurance'}}/>);
  expect(screen.getByRole('heading',{name:'Evening session'})).toBeInTheDocument();
  expect(screen.getByText('Inline Skating')).toBeInTheDocument();
  rerender(<WorkoutDetailPanel isLoading={false} errorMessage={null} activities={activities} workout={{title:'Evening session',sport:'running',category:'endurance'}}/>);
  expect(screen.getByText('Running')).toBeInTheDocument();
  expect(screen.queryByText('Inline Skating')).not.toBeInTheDocument();
});
