import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DistanceField, DurationField, SessionDurationField, SpeedField, WeightField } from './UnitFields';
import { AuthContext, type AuthContextValue } from '@/features/auth/context/authContextValue';
import { METERS_PER_MILE } from '@/services/units';

const session = (weight: 'kg' | 'lb', distance: 'km' | 'mi'): AuthContextValue => ({ session: { email: 'athlete@example.test', session: null, profile: { user_id: 1, weight_unit: weight, distance_unit: distance } }, status: 'authenticated', isAuthenticated: true, refreshSession: vi.fn(), logoutUser: vi.fn() });
function Editor() {
  const [weight, setWeight] = useState<number | undefined>(20);
  const [distance, setDistance] = useState<number>();
  const [speed, setSpeed] = useState<number | undefined>(4);
  const [duration, setDuration] = useState<number | undefined>(5430);
  return <form><WeightField label="Load" value={weight} onChange={setWeight}/><DistanceField label="Distance" value={distance} onChange={setDistance}/><SpeedField label="Pace" sport="running" value={speed} onChange={setSpeed}/><DurationField label="Work" seconds={duration} onChange={setDuration}/><output data-testid="values">{JSON.stringify({weight,distance,speed,duration})}</output><button>Save</button></form>;
}
const values = () => JSON.parse(screen.getByTestId('values').textContent!);
describe('canonical measurement controls', () => {
  it('submits kg when entering pounds and meters when entering miles', () => {
    render(<AuthContext.Provider value={session('lb','mi')}><Editor/></AuthContext.Provider>);
    fireEvent.change(screen.getByLabelText('Load (lb)'), {target:{value:'100'}});
    fireEvent.change(screen.getByLabelText('Distance (mi)'), {target:{value:'1'}});
    expect(values()).toMatchObject({weight:45.359237,distance:METERS_PER_MILE});
  });
  it('switches units without overwriting untouched values', () => {
    const {rerender} = render(<AuthContext.Provider value={session('kg','km')}><Editor/></AuthContext.Provider>);
    const original = screen.getByTestId('values').textContent;
    rerender(<AuthContext.Provider value={session('lb','mi')}><Editor/></AuthContext.Provider>);
    expect(screen.getByLabelText('Load (lb)')).toHaveValue('44.09'); expect(screen.getByLabelText('Pace (min/mi)')).toHaveValue('6:42');
    expect(screen.getByTestId('values').textContent).toBe(original);
    rerender(<AuthContext.Provider value={session('kg','km')}><Editor/></AuthContext.Provider>);
    expect(screen.getByTestId('values').textContent).toBe(original);
  });
  it('retains selected distance units across the scale threshold', () => {
    render(<Editor/>);
    fireEvent.change(screen.getByLabelText('Distance unit'), {target:{value:'m'}});
    fireEvent.change(screen.getByLabelText('Distance (m)'), {target:{value:'1000'}});
    expect(screen.getByLabelText('Distance (m)')).toHaveValue('1000'); expect(values().distance).toBe(1000);
    fireEvent.change(screen.getByLabelText('Distance unit'), {target:{value:'mi'}});
    expect(values().distance).toBe(1000);
  });
  it('keeps malformed pace visible and blocks form validity until corrected', () => {
    render(<Editor/>); const field = screen.getByLabelText('Pace (min/km)');
    fireEvent.change(field, {target:{value:'5:60'}}); expect(field).toHaveValue('5:60'); expect(field).toBeInvalid(); expect(field.closest('form')!.checkValidity()).toBe(false);
    fireEvent.change(field, {target:{value:'5:30'}}); expect(field).toBeValid(); expect(values().speed).toBeCloseTo(1000/330);
  });
  it('edits hours, minutes and seconds while preserving the other components', () => {
    render(<Editor/>);
    expect(screen.getByLabelText('Work hours')).toHaveValue('1'); expect(screen.getByLabelText('Work minutes')).toHaveValue('30');
    fireEvent.change(screen.getByLabelText('Work hours'), {target:{value:'2'}}); expect(values().duration).toBe(9030);
    fireEvent.change(screen.getByLabelText('Work minutes'), {target:{value:'60'}}); expect(screen.getByLabelText('Work minutes')).toBeInvalid();
    fireEvent.change(screen.getByLabelText('Work minutes'), {target:{value:'0'}}); expect(values().duration).toBe(7230); expect(screen.getByLabelText('Work minutes')).toBeValid();
  });
  it('clears optional values instead of introducing zero or NaN', () => {
    render(<Editor/>);fireEvent.change(screen.getByLabelText('Load (kg)'),{target:{value:''}});expect(values().weight).toBeUndefined();
  });
  it('preserves whole-minute API values with hours/minutes controls', () => {
    const onChange = vi.fn();render(<SessionDurationField label="Session" value={90} onChange={onChange}/>);
    expect(screen.getByLabelText('Session hours')).toHaveValue('1');expect(screen.queryByLabelText('Session seconds')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Session hours'), {target:{value:'2'}}); expect(onChange).toHaveBeenLastCalledWith(150);
  });
});

it('uses account preferences after switching users without a browser-global unit setting', () => {
  const {rerender}=render(<AuthContext.Provider value={session('lb','mi')}><Editor/></AuthContext.Provider>);
  expect(screen.getByLabelText('Pace (min/mi)')).toBeInTheDocument();
  const next=session('kg','km');next.session!.profile!.user_id=2;
  rerender(<AuthContext.Provider value={next}><Editor/></AuthContext.Provider>);
  expect(screen.getByLabelText('Pace (min/km)')).toBeInTheDocument();expect(screen.getByLabelText('Load (kg)')).toHaveValue('20');
});
