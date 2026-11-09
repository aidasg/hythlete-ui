import { beforeEach, expect, it, vi } from 'vitest';
import { importFitWorkout, reanalyseWorkout, inspectFitUploads, importFitBatch } from './workoutApi';

const client = vi.hoisted(() => ({ POST: vi.fn() }));
vi.mock('@/services/api/client', () => ({ apiClient: client }));
beforeEach(() => { vi.clearAllMocks(); client.POST.mockResolvedValue({ data: undefined, response: new Response(null, {status:204}) }); });

it('sends all original uploads and selected references for batch imports', () => {
  const files = [new File(['fit'], 'run.fit'), new File(['zip'], 'garmin.zip')];
  inspectFitUploads(files);
  expect(client.POST.mock.calls[0]![0]).toBe('/v1/workouts/import/fit/inspect');
  expect(client.POST.mock.calls[0]![1].body.getAll('files')).toEqual(files);
  const refs = [{source_index:1,source_sha256:'hash',entry_index:3}];
  importFitBatch(files, refs, 'watts');
  const [path, request] = client.POST.mock.calls[1]!;
  expect(path).toBe('/v1/workouts/import/fit/batch');
  expect(request.body.getAll('files')).toEqual(files);
  expect(JSON.parse(request.body.get('selection'))).toEqual(refs);
  expect(request.body.get('power_target_unit')).toBe('watts');
});

it('includes the power target interpretation in multipart imports', () => {
  importFitWorkout(new File(['fit'],'run.fit'), 'watts');
  const [path, request] = client.POST.mock.calls[0]!;
  expect(path).toBe('/v1/workouts/import/fit');
  expect(request.body.get('power_target_unit')).toBe('watts');
  expect(request.body.get('file').name).toBe('run.fit');
});

it('sends reanalysis options as query parameters while preserving no-body requests', () => {
  reanalyseWorkout(3,'percent_ftp',false);
  expect(client.POST).toHaveBeenCalledWith('/v1/workouts/{id}/reanalyse', {params:{path:{id:3},query:{power_target_unit:'percent_ftp',use_stryd_power:false}}});
  reanalyseWorkout(3);
  expect(client.POST).toHaveBeenLastCalledWith('/v1/workouts/{id}/reanalyse', {params:{path:{id:3},query:{power_target_unit:undefined,use_stryd_power:undefined}}});
});

it('correlates failed batch items while preserving successful imports', async () => {
  const success = {status:'imported', filename:'run.fit', activity:{id:1}};
  client.POST.mockResolvedValue({data:{results:[success,{status:'failed',filename:'ride.fit',error:'Invalid FIT activity data'}]},response:new Response(null,{headers:{'X-REQUEST-ID':'batch-123'}})});
  const result = await importFitBatch([], []);
  expect(result.data!.results[0]).toEqual(success);
  expect(result.data!.results[1]!.error).toBe('Request failed. Invalid FIT activity data Request ID: batch-123');
});
