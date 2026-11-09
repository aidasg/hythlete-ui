import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { WorkoutReanalysisModal } from './WorkoutReanalysisModal';
import { WorkoutDetailPanel } from './WorkoutDetailPanel';
import { WorkoutModal } from './WorkoutModal';
vi.mock('./WorkoutImpactPanel', () => ({WorkoutImpactPanel: () => null}));

it('blocks duplicate submissions and dismissal while running, then retains options for retry', async () => {
  let finish!: (value: boolean) => void;
  const onConfirm = vi.fn().mockReturnValueOnce(new Promise<boolean>(resolve => { finish = resolve; })).mockResolvedValueOnce(true);
  const onCancel = vi.fn();
  const props = {workout:{id:3},isReanalysing:false,onConfirm,onCancel};
  const {rerender} = render(<WorkoutReanalysisModal {...props}/>);
  fireEvent.change(screen.getByRole('combobox'),{target:{value:'watts'}});
  fireEvent.click(screen.getByRole('button',{name:'Reanalyse'}));
  expect(screen.getByRole('combobox')).toBeDisabled();
  expect(screen.getByRole('checkbox')).toBeDisabled();
  expect(screen.getByRole('button',{name:'Close modal'})).toBeDisabled();
  expect(screen.getByRole('button',{name:'Cancel'})).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('Reanalysing');
  fireEvent.click(screen.getByRole('button',{name:'Reanalysing...'}));
  fireEvent.keyDown(window,{key:'Escape'});
  fireEvent.mouseDown(screen.getByRole('dialog').parentElement!);
  expect(onCancel).not.toHaveBeenCalled();
  expect(onConfirm).toHaveBeenCalledTimes(1);
  finish(false);
  rerender(<WorkoutReanalysisModal {...props} errorMessage="Activity changed; retry"/>);
  await waitFor(() => expect(screen.getByRole('button',{name:'Reanalyse'})).toBeEnabled());
  expect(screen.getByRole('alert')).toHaveTextContent('Activity changed; retry');
  expect(screen.getByRole('combobox')).toHaveValue('watts');
  fireEvent.click(screen.getByRole('button',{name:'Reanalyse'}));
  await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
});

it('traps focus in the options dialog and Escape closes only that dialog', async () => {
  const user = userEvent.setup();
  render(<WorkoutModal title="Workout detail" eyebrow="Calendar" onClose={vi.fn()}>
    <WorkoutDetailPanel isLoading={false} errorMessage={null} workout={{id:3,completed:true,can_reanalyse:true}} onReanalyse={vi.fn()}/>
  </WorkoutModal>);
  const trigger = screen.getByRole('button',{name:'Reanalyse'});
  await user.click(trigger);
  const dialog = screen.getByRole('dialog',{name:'Reanalyse activity'});
  const confirm = within(dialog).getByRole('button',{name:'Reanalyse'});
  confirm.focus();
  await user.tab();
  expect(within(dialog).getByRole('button',{name:'Close modal'})).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog',{name:'Reanalyse activity'})).not.toBeInTheDocument();
  expect(screen.getByRole('dialog',{name:'Workout detail'})).toBeInTheDocument();
  expect(trigger).toHaveFocus();
});
