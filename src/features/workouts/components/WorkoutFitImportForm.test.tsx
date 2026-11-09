import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { WorkoutFitImportForm } from './WorkoutFitImportForm';
import userEvent from '@testing-library/user-event';
import type { FitImportReference, FitUploadInventory, WorkoutResponse } from '../services/workoutApi';

const api = vi.hoisted(() => ({ inspectFitUploads: vi.fn(), importFitBatch: vi.fn() }));
vi.mock('../services/workoutApi', () => api);
vi.mock('./WorkoutDetailPanel', () => ({ WorkoutDetailPanel: ({workout, onEdit}: {workout: WorkoutResponse; onEdit: () => void}) => <div><p>Recording: {workout.title}</p><button onClick={onEdit}>Edit activity</button></div> }));
vi.mock('./WorkoutCreateForm', () => ({ WorkoutCreateForm: ({initialWorkout, onCreated}: {initialWorkout: WorkoutResponse; onCreated: (w: WorkoutResponse) => void}) => <button onClick={() => onCreated({...initialWorkout, title:'Updated run'})}>Save edit</button> }));
beforeEach(() => vi.resetAllMocks());
function reference(source = 0, entry = -1): FitImportReference { return {source_index:source, source_sha256:`hash${source}`, entry_index:entry}; }
function source(filename = 'run.fit', index = 0, count = 1): FitUploadInventory {
  return {filename, sha256:`hash${index}`, entries:Array.from({length:count}, (_, i) => ({reference:reference(index, filename.endsWith('.zip') ? i : -1), filename:filename.endsWith('.zip') ? `folder/run-${i}.FIT` : filename, size:3}))};
}
function choose(container: HTMLElement, files = [new File(['fit'], 'run.fit')]) { fireEvent.change(container.querySelector('input[type="file"]')!, {target:{files}}); }
const activity = {id:3,title:'Morning run',date:'2026-11-01',duration_minutes:30,sport:'running',source:'fit',completed:true};

it('inspects multiple files, sends one shared option, and shows review after saving', async () => {
  api.inspectFitUploads.mockResolvedValue({data:{sources:[source(),source('garmin.zip',1)]}});
  let finish!: (value: unknown) => void;
  api.importFitBatch.mockReturnValue(new Promise(resolve => {finish=resolve;}));
  const onImported=vi.fn(),onBusyChange=vi.fn();
  const {container}=render(<WorkoutFitImportForm onImported={onImported} onBusyChange={onBusyChange}/>);
  expect(screen.getByText('FIT target options').closest('details')).not.toHaveAttribute('open');
  const files=[new File(['fit'],'run.fit'),new File(['zip'],'garmin.zip')];
  choose(container,files);
  await screen.findByText('2 of 10 activities selected');
  fireEvent.click(screen.getByText('FIT target options'));
  fireEvent.change(screen.getByRole('combobox'),{target:{value:'watts'}});
  fireEvent.click(screen.getByRole('button',{name:'Import 2 activities'}));
  expect(api.importFitBatch).toHaveBeenCalledWith(files,[reference(),reference(1,0)],'watts');
  expect(screen.getByRole('combobox')).toBeDisabled();
  expect(onBusyChange).toHaveBeenLastCalledWith(true);
  fireEvent.submit(container.querySelector('form')!);
  expect(api.importFitBatch).toHaveBeenCalledOnce();
  finish({data:{results:[{reference:reference(),filename:'run.fit',status:'imported',activity},{reference:reference(1,0),filename:'folder/run-0.FIT',status:'duplicate',error:'Already imported'}]}});
  expect(await screen.findByRole('heading',{name:'Review uploaded activities'})).toHaveFocus();
  expect(onImported).toHaveBeenCalledWith([activity]);
  expect(onBusyChange).toHaveBeenLastCalledWith(false);
  expect(screen.getByText(/1 imported, 1 duplicate, 0 failed/)).toBeInTheDocument();
});

it('supports selecting ZIP entries with the keyboard', async () => {
  const user = userEvent.setup();
  api.inspectFitUploads.mockResolvedValue({data:{sources:[source('garmin.zip',0,11)]}});
  const {container}=render(<WorkoutFitImportForm onImported={vi.fn()}/>);
  choose(container,[new File(['zip'],'garmin.zip')]);
  const boxes = await screen.findAllByRole('checkbox');
  boxes[0]!.focus();
  await user.keyboard(' ');
  expect(boxes[0]).toBeChecked();
  await user.tab();
  expect(boxes[1]).toHaveFocus();
  await user.keyboard(' ');
  expect(boxes[1]).toBeChecked();
  expect(screen.getByRole('button',{name:'Import 2 activities'})).toBeEnabled();
});

it('requires choosing up to ten entries from an oversized ZIP and keeps invalid archives visible', async () => {
  api.inspectFitUploads.mockResolvedValue({data:{sources:[source('garmin.zip',0,11),{...source('bad.zip',1,0),error:'Could not read ZIP archive'}]}});
  const {container}=render(<WorkoutFitImportForm onImported={vi.fn()}/>);
  choose(container,[new File(['zip'],'garmin.zip'),new File(['bad'],'bad.zip')]);
  await screen.findByText(/Choose up to 10 activities to import/);
  expect(screen.getByRole('alert')).toHaveTextContent('Could not read ZIP archive');
  expect(screen.getByRole('button',{name:'Import selected activities'})).toBeDisabled();
  const boxes=screen.getAllByRole('checkbox');
  boxes.slice(0,10).forEach(box => fireEvent.click(box));
  expect(boxes[10]).toBeDisabled();
  expect(screen.getByRole('button',{name:'Import 10 activities'})).toBeEnabled();
  fireEvent.click(boxes[0]!);expect(boxes[10]).toBeEnabled();
});

it('retries only failed items and preserves successful rows', async () => {
  api.inspectFitUploads.mockResolvedValue({data:{sources:[source(),source('ride.fit',1)]}});
  api.importFitBatch.mockResolvedValueOnce({data:{results:[{reference:reference(),filename:'run.fit',status:'imported',activity},{reference:reference(1),filename:'ride.fit',status:'failed',error:'Try again'}]}})
    .mockResolvedValueOnce({data:{results:[{reference:reference(1),filename:'ride.fit',status:'imported',activity:{...activity,id:4,title:'Ride'}}]}});
  const onImported=vi.fn();const {container}=render(<WorkoutFitImportForm onImported={onImported}/>);
  const files=[new File(['fit'],'run.fit'),new File(['fit'],'ride.fit')];choose(container,files);
  fireEvent.click(await screen.findByRole('button',{name:'Import 2 activities'}));
  fireEvent.click(await screen.findByRole('button',{name:'Retry failed activities'}));
  await waitFor(() => expect(api.importFitBatch).toHaveBeenLastCalledWith(files,[reference(1)],'auto'));
  expect(await screen.findByText(/2 imported, 0 duplicates, 0 failed/)).toBeInTheDocument();
  expect(screen.getAllByRole('button',{name:'Open activity'})).toHaveLength(2);
});

it('returns to review after opening, editing, or backing out of an activity', async () => {
  api.inspectFitUploads.mockResolvedValue({data:{sources:[source()]}});
  api.importFitBatch.mockResolvedValue({data:{results:[{reference:reference(),filename:'run.fit',status:'imported',activity}]}});
  const onImported=vi.fn();const {container}=render(<WorkoutFitImportForm onImported={onImported}/>);choose(container);
  fireEvent.click(await screen.findByRole('button',{name:'Import 1 activity'}));
  fireEvent.click(await screen.findByRole('button',{name:'Open activity'}));
  expect(screen.getByText('Recording: Morning run')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Back to uploaded activities'}));
  expect(screen.getByRole('heading',{name:'Review uploaded activities'})).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Open activity'}));
  fireEvent.click(screen.getByRole('button',{name:'Edit activity'}));
  fireEvent.click(screen.getByRole('button',{name:'Save edit'}));
  expect(screen.getByRole('heading',{name:'Review uploaded activities'})).toBeInTheDocument();
  expect(screen.getByText('Updated run')).toBeInTheDocument();
  expect(onImported).toHaveBeenLastCalledWith([{...activity,title:'Updated run'}]);
});

it('adds and removes sources incrementally and keeps the previous selection after inspection failure', async () => {
  api.inspectFitUploads.mockResolvedValueOnce({data:{sources:[source()]}})
    .mockResolvedValueOnce({data:{sources:[source(),source('ride.fit',1)]}})
    .mockResolvedValueOnce({error:{error:'Request failed. Upload failed Request ID: upload-123',request_id:'upload-123'}})
    .mockResolvedValueOnce({data:{sources:[source('ride.fit')]}});
  const {container}=render(<WorkoutFitImportForm onImported={vi.fn()}/>);
  const a=new File(['fit'],'run.fit'), b=new File(['fit'],'ride.fit');
  choose(container,[a]);await screen.findByText('1 of 10 activities selected');
  choose(container,[b]);await screen.findByText('2 of 10 activities selected');
  expect(api.inspectFitUploads).toHaveBeenLastCalledWith([a,b]);
  choose(container,[new File(['bad'],'bad.zip')]);expect(await screen.findByRole('alert')).toHaveTextContent('Request failed. Upload failed Request ID: upload-123');
  expect(screen.getByText('2 of 10 activities selected')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Remove run.fit'}));
  await waitFor(() => expect(screen.queryByRole('region',{name:'run.fit'})).not.toBeInTheDocument());
  expect(within(screen.getByRole('region',{name:'ride.fit'})).getByRole('checkbox')).toBeChecked();
});

it('blocks too many containers locally and preserves options after import errors', async () => {
  api.inspectFitUploads.mockResolvedValue({data:{sources:[source()]}});
  api.importFitBatch.mockResolvedValue({error:{error:'Request failed. Request ID: import-123',request_id:'import-123'}});
  const {container}=render(<WorkoutFitImportForm onImported={vi.fn()}/>);
  choose(container,Array.from({length:11},(_,i)=>new File(['fit'],`${i}.fit`)));
  expect(api.inspectFitUploads).not.toHaveBeenCalled();expect(screen.getByRole('alert')).toHaveTextContent('at most 10');
  choose(container);await screen.findByText('1 of 10 activities selected');
  fireEvent.click(screen.getByText('FIT target options'));fireEvent.change(screen.getByRole('combobox'),{target:{value:'percent_ftp'}});
  fireEvent.click(screen.getByRole('button',{name:'Import 1 activity'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Request failed. Request ID: import-123');
  expect(screen.getByRole('combobox')).toHaveValue('percent_ftp');
  expect(screen.getByRole('checkbox')).toBeChecked();
});
