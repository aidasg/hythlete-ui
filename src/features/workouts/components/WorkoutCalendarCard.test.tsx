import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WorkoutCalendarCard } from './WorkoutCalendarCard';
import type { WorkoutResponse } from '../services/workoutApi';

const workout: WorkoutResponse = {id:7,title:'Evening session',sport:'inline_skating',completed:true,duration_minutes:30,
  execution:{elapsed_seconds:1800,imported_activity:{segments:[{component:{duration_seconds:1800,intensity_zone:'steady'}}]}}};
const activities = [{code:'inline_skating',name:'Inline Skating'}, {code:'running',name:'Running'}];
describe('calendar activity identification', () => {
  it('shows the activity icon with a timeline and keeps the name in a hover tooltip', async () => {
    const user=userEvent.setup();const onSelect=vi.fn();
    const {container}=render(<WorkoutCalendarCard workout={workout} activities={activities} onSelect={onSelect}/>);
    expect(container.querySelector('.workout-timeline-mini')).toBeInTheDocument();
    const icon=screen.getByRole('img',{name:'Activity: Inline Skating'});
    expect(screen.queryByRole('tooltip',{hidden:true})).not.toBeInTheDocument();
    expect(screen.queryByText('inline_skating')).not.toBeInTheDocument();
    await user.hover(icon);
    expect(screen.getByRole('tooltip',{hidden:true})).toHaveTextContent('Inline Skating');
    await user.unhover(icon);
    expect(screen.queryByRole('tooltip',{hidden:true})).not.toBeInTheDocument();
    await user.click(screen.getByRole('button',{name:/Evening session/}));
    expect(onSelect).toHaveBeenCalledWith(workout);
  });
  it('exposes the activity on keyboard focus without adding another tab stop', async () => {
    const user=userEvent.setup();const onSelect=vi.fn();
    render(<><WorkoutCalendarCard workout={workout} onSelect={onSelect}/><button>Next</button></>);
    await user.tab();
    expect(screen.getByRole('button',{name:/Evening session/})).toHaveFocus();
    expect(screen.getByRole('tooltip',{hidden:true})).toHaveTextContent('Inline Skating');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip',{hidden:true})).not.toBeInTheDocument();
    await user.keyboard('{Enter}');expect(onSelect).toHaveBeenCalledWith(workout);
    await user.tab();expect(screen.getByRole('button',{name:'Next'})).toHaveFocus();
  });
  it('refreshes the icon name after an activity edit and works without a timeline', () => {
    const onSelect=vi.fn();
    const {rerender}=render(<WorkoutCalendarCard workout={{...workout,execution:undefined}} activities={activities} onSelect={onSelect}/>);
    expect(screen.getByRole('img',{name:'Activity: Inline Skating'})).toBeInTheDocument();
    rerender(<WorkoutCalendarCard workout={{...workout,sport:'running',completed:false,planned:true}} activities={activities} onSelect={onSelect}/>);
    expect(screen.getByRole('img',{name:'Activity: Running'})).toBeInTheDocument();
    expect(screen.queryByRole('img',{name:'Activity: Inline Skating'})).not.toBeInTheDocument();
    expect(screen.getByText('Planned')).toBeInTheDocument();
  });
  it('positions the tooltip inward near the right edge', async () => {
    const {container}=render(<WorkoutCalendarCard workout={workout} onSelect={vi.fn()}/>);
    const anchor=container.querySelector('.activity-identity')!;
    vi.spyOn(anchor,'getBoundingClientRect').mockReturnValue({left:window.innerWidth-30} as DOMRect);
    fireEvent.mouseEnter(anchor);
    await waitFor(()=>expect(screen.getByRole('tooltip',{hidden:true})).toHaveClass('activity-identity-tooltip-right'));
  });
});
