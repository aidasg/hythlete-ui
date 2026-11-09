import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkoutCalendarGrid } from './WorkoutCalendarGrid';
import { getMonthKey, getTodayKey } from '../services/workoutDates';
const callbacks=()=>({onDateSelect:vi.fn(),onCreateWorkout:vi.fn(),onCreateReadinessEntry:vi.fn(),onImportFit:vi.fn(),onMonthChange:vi.fn(),onWorkoutSelect:vi.fn()});
function renderCalendar(dense=false) {
  const handlers=callbacks();
  const result=render(<WorkoutCalendarGrid monthKey="2026-08" selectedDate="2026-08-29" workouts={Array.from({length:dense?5:1},(_,i)=>({id:i+1,date:'2026-08-29',title:`Intervals ${i+1}`,duration_minutes:50,completed:true,components:[{duration_seconds:3000,intensity_zone:'steady'}]}))} isLoading={false} {...handlers}/>);
  return {...handlers,...result};
}
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();Object.defineProperty(window,'innerWidth',{configurable:true,value:1024});});
describe('WorkoutCalendarGrid',()=>{
  it('shows every workout and keeps secondary actions in a dismissible menu',async()=>{
    const user=userEvent.setup();const handlers=renderCalendar(true);
    const day=screen.getByRole('region',{name:'Aug 29, 2026'});expect(within(day).getAllByRole('button',{name:/Intervals/})).toHaveLength(5);expect(screen.queryByText('+3')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button',{name:'Add workout'}));expect(handlers.onCreateWorkout).toHaveBeenCalledWith('2026-08-29');
    await user.click(screen.getByRole('button',{name:'More calendar actions'}));expect(screen.getByRole('menuitem',{name:'Import FIT or ZIP'})).toBeInTheDocument();await user.keyboard('{Escape}');expect(screen.queryByRole('menuitem',{name:'Import FIT or ZIP'})).not.toBeInTheDocument();
    await user.click(screen.getByRole('button',{name:'Add on 2026-08-29'}));await user.click(screen.getByRole('menuitem',{name:'Limiter / injury'}));expect(handlers.onCreateReadinessEntry).toHaveBeenCalledWith('2026-08-29');
    await user.click(within(day).getByRole('button',{name:/Intervals 5/}));expect(handlers.onWorkoutSelect).toHaveBeenCalledWith(expect.objectContaining({id:5}));
  });
  it('shows a full month agenda on narrow screens without duplicate day content',()=>{
    Object.defineProperty(window,'innerWidth',{configurable:true,value:390});renderCalendar();expect(screen.getByText('Month agenda')).toBeInTheDocument();expect(screen.getByRole('region',{name:'Aug 1, 2026'})).toBeInTheDocument();expect(screen.getByRole('region',{name:'Aug 31, 2026'})).toBeInTheDocument();expect(screen.queryByRole('region',{name:'Sep 1, 2026'})).not.toBeInTheDocument();expect(screen.getAllByText('Intervals 1')).toHaveLength(1);
  });
  it('responds to available container width, not just the viewport',()=>{
    let width=1000;let resize=()=>{};
    vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(()=>({width,height:100,top:0,left:0,right:width,bottom:100,x:0,y:0,toJSON:()=>({})}));
    vi.stubGlobal('ResizeObserver',class{constructor(callback:()=>void){resize=callback;}observe(){}disconnect(){}});
    renderCalendar();expect(screen.queryByText('Month agenda')).not.toBeInTheDocument();width=850;act(()=>resize());expect(screen.getByText('Month agenda')).toBeInTheDocument();width=1100;act(()=>resize());expect(screen.queryByText('Month agenda')).not.toBeInTheDocument();
  });
  it('selects the first day when moving to another month',async()=>{
    const user=userEvent.setup();const handlers=renderCalendar();await user.click(screen.getByRole('button',{name:'Next month'}));expect(handlers.onMonthChange).toHaveBeenCalledWith('2026-09-01');expect(handlers.onDateSelect).toHaveBeenCalledWith('2026-09-01');
  });
  it('selects today and brings it into view in the month agenda', async () => {
    Object.defineProperty(window, 'innerWidth', {configurable:true, value:390});
    const scroll = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {configurable:true, value:scroll});
    const handlers = callbacks();
    render(<WorkoutCalendarGrid monthKey={getMonthKey(getTodayKey())} selectedDate={getMonthKey(getTodayKey())} workouts={[]} isLoading={false} {...handlers}/>);
    await userEvent.setup().click(screen.getByRole('button',{name:'Today'}));
    expect(handlers.onDateSelect).toHaveBeenCalledWith(getTodayKey());
    expect(scroll).toHaveBeenCalledWith({block:'center',behavior:'smooth'});
    delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
  });

});

it('passes catalog names to activity icons in both month and agenda layouts', () => {
  const handlers=callbacks();
  const props={monthKey:'2026-08',selectedDate:'2026-08-29',activities:[{code:'commuting_cycling',name:'Bike Commuting',parent_code:'cycling'}],workouts:[{id:1,date:'2026-08-29',sport:'commuting_cycling',title:'Ride to work',planned:true}],isLoading:false,...handlers};
  const {unmount}=render(<WorkoutCalendarGrid {...props}/>);
  expect(screen.getByRole('img',{name:'Activity: Bike Commuting'})).toBeInTheDocument();
  unmount();
  Object.defineProperty(window,'innerWidth',{configurable:true,value:390});
  render(<WorkoutCalendarGrid {...props}/>);
  expect(screen.getByText('Month agenda')).toBeInTheDocument();
  expect(screen.getByRole('img',{name:'Activity: Bike Commuting'})).toBeInTheDocument();
});
