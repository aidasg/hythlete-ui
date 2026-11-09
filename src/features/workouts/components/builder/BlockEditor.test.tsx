import { useState } from 'react';
import { fireEvent, render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import type { SessionBlock } from '../../services/sessionStructure';
import { BlockEditor } from './BlockEditor';

it('keeps a circuit open with collapsed exercise rows, preserving expansion while editing', async () => {
  function Harness() {
    const [block, setBlock] = useState<SessionBlock>({ id: 'circuit', format: 'circuit', completion: 'manual', movements: [
      { exercise_code: 'back_squat', sets: [{ reps: 8, load_kg: 40 }, { reps: 8, load_kg: 40 }] },
      { exercise_code: 'plank', sets: [{ duration_seconds: 30 }] },
    ] });
    return <BlockEditor block={block} onChange={setBlock} catalog={{ exercises: [{ code: 'back_squat', name: 'Back squat' }, { code: 'plank', name: 'Plank' }] }} log first last onDuplicate={vi.fn()} onRemove={vi.fn()} onMove={vi.fn()}/>;
  }
  const user = userEvent.setup();
  const { container } = render(<Harness/>);
  expect(container.querySelector('.builder-block')).toHaveAttribute('open');
  const rows = container.querySelectorAll('.builder-exercise-disclosure');
  expect(rows).toHaveLength(2);
  rows.forEach(row => expect(row).not.toHaveAttribute('open'));
  const summary = rows[0]!.querySelector('summary')!;
  expect(summary).toHaveTextContent('Back squat 2 \u00d7 8 reps @ 40 kg');
  expect(rows[1]!.querySelector('summary')).toHaveTextContent('Plank 30s @ weight unset');
  summary.focus();
  expect(summary).toHaveFocus();
  await user.click(summary);
  expect(rows[0]).toHaveAttribute('open');
  const set = within(rows[0] as HTMLElement).getByRole('group', { name: 'Set 1' });
  fireEvent.change(within(set).getByLabelText('Reps'), { target: { value: '10' } });
  expect(rows[0]).toHaveAttribute('open');
  expect(summary).toHaveTextContent('10 reps @ 40 kg · 8 reps @ 40 kg');
  expect(rows[1]).not.toHaveAttribute('open');
});
