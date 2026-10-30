import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { WorkoutTimeline } from './WorkoutTimeline';
import type { WorkoutResponse } from '../services/workoutApi';
const workout: WorkoutResponse = {id:1,completed:true,components:[{order:1,duration_seconds:60,metrics:{avg_power_watts:0},intensity_zone:'recovery'},{order:2,duration_seconds:120,metrics:{avg_heart_rate_bpm:170},effort:{zone:'vo2',source:'relative_heart_rate',confidence:.35}}]};
describe('WorkoutTimeline', () => {
  it('selects by click, next/previous, and keyboard; retains zeros and omits missing metrics', async () => {
    const user=userEvent.setup();render(<WorkoutTimeline workout={workout}/>);
    let panel=screen.getByRole('region',{name:'Interval 1 details'});
    expect(within(panel).getByText('Average power')).toBeInTheDocument();expect(within(panel).getByText('0')).toBeInTheDocument();expect(within(panel).queryByText('Average heart rate')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button',{name:'Next interval'}));
    panel=screen.getByRole('region',{name:'Interval 2 details'});expect(within(panel).getByText('170')).toBeInTheDocument();expect(within(panel).getByText(/Activity-relative zone estimate/)).toBeInTheDocument();
    const chart=screen.getByRole('group',{name:'Recorded effort by active time'});chart.focus();await user.keyboard('{ArrowLeft}');expect(screen.getByRole('region',{name:'Interval 1 details'})).toBeInTheDocument();
    fireEvent.click(chart.querySelectorAll('.timeline-interval')[1]!);expect(screen.getByRole('region',{name:'Interval 2 details'})).toBeInTheDocument();
    await user.click(screen.getByRole('button',{name:'Previous interval'}));expect(screen.getByRole('region',{name:'Interval 1 details'})).toBeInTheDocument();
  });
  it('keeps duration proportions and exposes a collapsed accessible table', async () => {
    const user=userEvent.setup();const {container}=render(<WorkoutTimeline workout={workout}/>);
    const bars=container.querySelectorAll('.timeline-interval');expect(Number(bars[1]?.getAttribute('width'))).toBeCloseTo(Number(bars[0]?.getAttribute('width'))*2);
    expect(container.querySelector('details')).not.toHaveAttribute('open');await user.click(screen.getByText('All intervals'));expect(screen.getByRole('table')).toBeInTheDocument();await user.click(screen.getByRole('button',{name:'Show interval 2'}));expect(screen.getByRole('region',{name:'Interval 2 details'})).toBeInTheDocument();
  });
  it('resets selection on another workout and handles incomplete or absent timing', async () => {
    const user=userEvent.setup();const {rerender}=render(<WorkoutTimeline workout={workout}/>);await user.click(screen.getByRole('button',{name:'Next interval'}));rerender(<WorkoutTimeline workout={{...workout,id:2}}/>);expect(screen.getByRole('region',{name:'Interval 1 details'})).toBeInTheDocument();
    rerender(<WorkoutTimeline workout={{completed:true,components:[{duration_seconds:60},{}]}}/>);expect(screen.getByText(/Partial timeline/)).toBeInTheDocument();
    rerender(<WorkoutTimeline workout={{completed:true}}/>);expect(screen.getByText(/timing was not recorded/)).toBeInTheDocument();
  });
  it('does not add focusable controls to miniature graphs or replace strength sets', () => {
    const {container,rerender}=render(<WorkoutTimeline workout={workout} miniature/>);expect(container.querySelector('svg')).toHaveAttribute('aria-hidden','true');expect(screen.queryByRole('button')).not.toBeInTheDocument();
    rerender(<WorkoutTimeline workout={{category:'strength',components:[{type:'exercise'}]}}/>);expect(container).toBeEmptyDOMElement();
  });
});
