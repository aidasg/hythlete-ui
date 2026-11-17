import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { ExerciseEditor } from './TargetEditors';
import type { SessionMovement } from '../../services/sessionStructure';

it('uses current catalog units for old sets without confirmation', () => {
  function Harness() {
    const [value, setValue] = useState<SessionMovement>({ exercise_code: 'curl', sets: [{ reps: 10, load_kg: 20 }] });
    return <ExerciseEditor collapsible={false} value={value} onChange={setValue} catalog={{ exercises: [{ code: 'curl', name: 'Curl', counting_convention: { version: 'exercise-counting-v1', weight_basis: 'per_hand', reps_basis: 'per_side', movement: 'alternating', weights_moved: 1, side: 'arm' } }] }} />;
  }
  render(<Harness />);
  expect(screen.queryByRole('button', { name: 'Confirm these set values' })).not.toBeInTheDocument();
  const set = screen.getByRole('group', { name: 'Set 1' });
  expect(within(set).getByLabelText('Weight per hand (kg)')).toHaveValue(20);
  expect(within(set).getByLabelText('Reps per arm')).toHaveValue(10);
  expect(screen.getByText('External volume: 400 kg\u00b7reps')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Duplicate set' }));
  expect(screen.getAllByText('External volume: 400 kg\u00b7reps')).toHaveLength(2);
});

it('requires review when an exercise changes while keeping its values', () => {
  function Harness() {
    const c = { version: 'exercise-counting-v1', weight_basis: 'per_hand', reps_basis: 'total', movement: 'simultaneous', weights_moved: 2 };
    const [value, setValue] = useState<SessionMovement>({ exercise_code: 'press', sets: [{ reps: 10, load_kg: 20, counting_version: c.version, counting_convention: c }] });
    return <ExerciseEditor collapsible={false} value={value} onChange={setValue} catalog={{ exercises: [{ code: 'press', name: 'Press', counting_convention: c }, { code: 'curl', name: 'Curl', counting_convention: { ...c, weights_moved: 1, reps_basis: 'per_side', movement: 'alternating', side: 'arm' } }] }} />;
  }
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Press' }));
  fireEvent.click(screen.getByRole('option', { name: /Curl/ }));
  expect(screen.getByText(/Exercise changed. Review the retained values/)).toBeInTheDocument();
  expect(screen.queryByText('External volume: 400 kg\u00b7reps')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm these set values' }));
  expect(within(screen.getByRole('group', { name: 'Set 1' })).getByLabelText('Reps per arm')).toHaveValue(10);
  expect(screen.getByText('External volume: 400 kg\u00b7reps')).toBeInTheDocument();
});

it('uses updated database conventions over a previously saved snapshot', () => {
  function Harness() {
    const c = { version: 'exercise-counting-v1', weight_basis: 'per_hand', reps_basis: 'total', movement: 'simultaneous', weights_moved: 2 };
    const [value, setValue] = useState<SessionMovement>({ exercise_code: 'press', sets: [{ reps: 10, load_kg: 20, counting_version: c.version, counting_convention: c }] });
    return <ExerciseEditor collapsible={false} value={value} onChange={setValue} catalog={{ exercises: [{ code: 'press', name: 'Press', counting_convention: { ...c, weight_basis: 'total', weights_moved: 1 } }] }} />;
  }
  render(<Harness />);
  expect(within(screen.getByRole('group', { name: 'Set 1' })).getByLabelText('Total weight (kg)')).toHaveValue(20);
  expect(screen.getByText('External volume: 200 kg\u00b7reps')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Confirm these set values' })).not.toBeInTheDocument();
});

it('defaults static holds to duration and labels optional added weight', () => {
  function Harness() {
    const [value, setValue] = useState<SessionMovement>({ exercise_code: 'plank', sets: [{ duration_seconds: 60 }] });
    return <ExerciseEditor collapsible={false} value={value} onChange={setValue} catalog={{ exercises: [{ code: 'plank', name: 'Plank', load_profile: { bodyweight_fraction: .7, isometric: true, default_target: 'duration_seconds' } }] }} />;
  }
  render(<Harness />);
  expect(screen.getByLabelText('Set target')).toHaveValue('duration_seconds');
  const set = screen.getByRole('group', { name: 'Set 1' });
  expect(within(set).getByLabelText('Seconds')).toHaveValue(60);
  expect(within(set).getByLabelText('Added weight (optional) (kg)')).toHaveValue(null);
  fireEvent.click(screen.getByRole('button', { name: 'Duplicate set' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add set' }));
  expect(screen.queryByText(/weight unset/)).not.toBeInTheDocument();
});

it('records assistance separately from added weight', () => {
  function Harness() {
    const [value, setValue] = useState<SessionMovement>({ exercise_code: 'pull', sets: [{ reps: 10, assistance_kg: 25 }] });
    return <ExerciseEditor collapsible={false} value={value} onChange={setValue} catalog={{ exercises: [{ code: 'pull', name: 'Assisted pull up', load_profile: { bodyweight_fraction: 1, assisted: true, default_target: 'reps' } }] }} />;
  }
  render(<Harness />);
  const set = screen.getByRole('group', { name: 'Set 1' });
  expect(within(set).getByLabelText('Assistance (kg)')).toHaveValue(25);
  fireEvent.change(within(set).getByLabelText('Assistance (kg)'), { target: { value: '30' } });
  expect(within(set).getByLabelText('Assistance (kg)')).toHaveValue(30);
  expect(within(set).getByLabelText('Added weight (optional) (kg)')).toHaveValue(null);
});
