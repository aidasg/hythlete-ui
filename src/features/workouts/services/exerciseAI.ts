import { throwApiResponseError } from "@/services/api/errors";
import { apiClient } from '@/services/api/client';
import type { components } from '@/services/api/types';
import type { SessionBlock, SessionMovement } from './sessionStructure';
import type { BuilderDraft } from './workoutBuilder';
import { isImportedActivity, newID } from './workoutBuilder';

export type ExerciseAIResult = components['schemas']['workout.ExerciseDraftResponse'];
export type ExerciseAIIssue = components['schemas']['ai.ExerciseDraftIssue'];
export type ExerciseAIContext = components['schemas']['workout.ExerciseDraftContextRequest'];
export const isExerciseMovement = (m: SessionMovement) => Boolean(m.exercise_code || m.sets);

function exerciseDraftSet(set: NonNullable<SessionMovement['sets']>[number]) {
  // Saved component sets can carry response-only IDs at runtime. Send only
  // ExerciseSetRequest fields, and normalize nullable numbers from Go responses.
  return {
    assistance_kg: set.assistance_kg ?? undefined,
    set_order: set.set_order, reps: set.reps ?? undefined, load_kg: set.load_kg ?? undefined,
    duration_seconds: set.duration_seconds ?? undefined, distance_m: set.distance_m ?? undefined,
    rest_seconds: set.rest_seconds, rir: set.rir ?? undefined, rpe: set.rpe ?? undefined,
    tempo: set.tempo, is_warmup: set.is_warmup, counting_version: set.counting_version,
    counting_convention: set.counting_convention, external_volume_kg_reps: set.external_volume_kg_reps,
  };
}

async function encodeScreenshot(file: File, signal?: AbortSignal): Promise<{ media_type: 'image/png' | 'image/jpeg' | 'image/webp'; data: string }> {
  signal?.throwIfAborted();
  const mediaType = file.type;
  if (mediaType !== 'image/png' && mediaType !== 'image/jpeg' && mediaType !== 'image/webp') throw new Error('Use a PNG, JPEG or WebP screenshot.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Screenshot must be at most 10 MiB.');
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    const abort = () => reader.abort();
    const cleanup = () => signal?.removeEventListener('abort', abort);
    reader.onload = () => {
      cleanup();
      if (typeof reader.result === 'string') resolve(reader.result.slice(reader.result.indexOf(',') + 1));
      else reject(new Error('Could not read screenshot.'));
    };
    reader.onerror = () => { cleanup(); reject(new Error('Could not read screenshot.')); };
    reader.onabort = () => { cleanup(); reject(signal?.reason ?? new DOMException('Screenshot reading cancelled', 'AbortError')); };
    signal?.addEventListener('abort', abort, { once: true });
    reader.readAsDataURL(file);
  });
  return { media_type: mediaType, data };
}

export async function draftExercisesWithAI(content: string, context: ExerciseAIContext, screenshot?: File, signal?: AbortSignal): Promise<ExerciseAIResult> {
  signal?.throwIfAborted();
  const requestContext: ExerciseAIContext = { activity: context.activity, mode: context.mode,
    current_blocks: context.current_blocks.map(b => ({ ...b,
      movements: b.movements?.map(m => ({ ...m, sets: m.sets?.map(exerciseDraftSet) })),
      recovery: b.recovery ? { ...b.recovery, sets: b.recovery.sets?.map(exerciseDraftSet) } : undefined,
    })),
  };
  const image = screenshot ? await encodeScreenshot(screenshot, signal) : undefined;
  signal?.throwIfAborted();
  const result = await apiClient.POST('/v1/workouts/exercises/ai-draft', {
    body: { content, context: requestContext, screenshot: image }, signal,
  });
  if (result.error || !result.data) throwApiResponseError(result);
  return result.data;
}

export function exerciseContext(draft: BuilderDraft): ExerciseAIContext {
  return { activity: draft.workout.sport, mode: draft.log ? 'performed' : 'planned', current_blocks: draft.blocks.flatMap(b => {
    const movements = b.movements?.filter(isExerciseMovement) || [];
    return movements.length ? [{ ...b, recovery: undefined, movements }] : [];
  }) };
}

export function applyExerciseAI(draft: BuilderDraft, result: ExerciseAIResult): { draft: BuilderDraft; issues: ExerciseAIIssue[] } {
  const idMap = new Map<string | undefined, string>();
  const generated = (result.blocks || []).map(b => {
    const id = newID(); idMap.set(b.id, id);
    // Empty DTO set arrays are omitted on the wire. Every movement from this
    // endpoint is still an exercise, including unmatched names with no sets yet.
    return { ...structuredClone(b), id, movements: (b.movements || []).map(m => ({ ...structuredClone(m), exercise_code: m.exercise_code || '', sets: structuredClone(m.sets || []).map(s => ({ ...exerciseDraftSet(s), load_profile: s.load_profile })) })) };
  });
  let issues = (result.issues || []).map(i => ({ ...i, block_id: idMap.get(i.block_id) || i.block_id }));
  if (isImportedActivity(draft.original)) return { draft: { ...draft, blocks: generated }, issues };

  // Saved prescriptions define execution block identity. Fold performed exercises
  // into an existing block and transfer elapsed time from removed exercise blocks.
  if (draft.log && draft.original?.blocks?.length) {
    const firstExercise = draft.blocks.find(b => b.movements?.some(isExerciseMovement));
    const anchor = firstExercise || draft.blocks[0];
    if (!anchor) return { draft, issues };
    const oldMovements = anchor.movements || [];
    const insertion = oldMovements.findIndex(isExerciseMovement);
    const before = insertion < 0 ? oldMovements.length : oldMovements.slice(0, insertion).filter(m => !isExerciseMovement(m)).length;
    const replacements = generated.flatMap(b => b.movements || []);
    const activities = oldMovements.filter(m => !isExerciseMovement(m));
    const movements = [...activities.slice(0, before), ...replacements, ...activities.slice(before)];
    let extraSeconds = 0;
    const retained = draft.blocks.filter(b => {
      if (b.id === anchor.id) return true;
      const keep = b.movements?.some(m => !isExerciseMovement(m));
      if (!keep) extraSeconds += b.duration_seconds || 0;
      return keep;
    });
    const blocks = retained.map(b => b.id === anchor.id
      ? { ...b, format: 'straight_sets', completion: 'manual', rounds: 1, work_seconds: undefined, rest_seconds: undefined, recovery: undefined, duration_seconds: (b.duration_seconds || 0) + extraSeconds, movements }
      : { ...b, movements: b.movements?.filter(m => !isExerciseMovement(m)) });
    const offsets = new Map<string | undefined, number>();
    let offset = before;
    for (const b of generated) { offsets.set(b.id, offset); offset += b.movements?.length || 0; }
    issues = issues.map(i => ({ ...i, movement_index: (offsets.get(i.block_id) || 0) + (i.movement_index || 0), block_id: anchor.id }));
    return { draft: { ...draft, quick: false, blocks }, issues };
  }

  const blocks: SessionBlock[] = [];
  let inserted = false;
  for (const block of draft.blocks) {
    if (block.movements?.some(isExerciseMovement) && !inserted) { blocks.push(...generated); inserted = true; }
    const movements = block.movements?.filter(m => !isExerciseMovement(m)) || [];
    if (movements.length) blocks.push({ ...block, movements });
  }
  if (!inserted) blocks.push(...generated);
  return { draft: { ...draft, quick: false, legacy: draft.log ? draft.legacy : false, blocks }, issues };
}

export function restoreExerciseAI(draft: BuilderDraft, snapshot: BuilderDraft): BuilderDraft {
  if (isImportedActivity(draft.original)) return { ...draft, blocks: structuredClone(snapshot.blocks) };
  const blocks: SessionBlock[] = draft.blocks.flatMap(b => {
    const movements = b.movements?.filter(m => !isExerciseMovement(m)) || [];
    return movements.length ? [{ ...b, movements }] : [];
  });
  const anchor = snapshot.blocks.find(b => b.movements?.some(isExerciseMovement)) || snapshot.blocks[0];
  const transferredSeconds = snapshot.log && snapshot.original?.blocks?.length
    ? snapshot.blocks.filter(b => b.id !== anchor?.id && !b.movements?.some(m => !isExerciseMovement(m))).reduce((sum, b) => sum + (b.duration_seconds || 0), 0) : 0;
  snapshot.blocks.forEach((old, index) => {
    if (!old.movements?.some(isExerciseMovement)) return;
    const current = blocks.findIndex(b => b.id === old.id);
    if (current < 0) { blocks.splice(Math.min(index, blocks.length), 0, structuredClone(old)); return; }
    const b = blocks[current]!;
    const activities = [...(b.movements || [])];
    const movements = old.movements.map(m => isExerciseMovement(m) ? structuredClone(m) : activities.shift()).filter((m): m is SessionMovement => !!m);
    blocks[current] = { ...b, format: old.format, completion: old.completion, rounds: old.rounds, work_seconds: old.work_seconds, rest_seconds: old.rest_seconds, recovery: old.recovery, duration_seconds: b.id === anchor?.id && transferredSeconds ? Math.max(0, (b.duration_seconds || 0) - transferredSeconds) : b.duration_seconds, movements: [...movements, ...activities] };
  });
  return { ...draft, quick: snapshot.quick, legacy: snapshot.legacy, blocks };
}

export function unresolvedExerciseIssues(issues: ExerciseAIIssue[], blocks: SessionBlock[]): ExerciseAIIssue[] {
  return issues.filter(issue => {
    const block = blocks.find(b => b.id === issue.block_id);
    if (!block) return false;
    if (issue.field === 'rounds') return !(block.rounds && block.rounds > 0);
    const m = block.movements?.[issue.movement_index || 0];
    if (!m) return false;
    if (issue.field === 'exercise_code') return !m.exercise_code;
    if (issue.field === 'sets') return !m.sets?.length || m.sets.some(s => !((s.reps || 0) > 0 || (s.duration_seconds || 0) > 0 || (s.distance_m || 0) > 0));
    const sets = issue.set_index === undefined ? m.sets || [] : [m.sets?.[issue.set_index]];
    if (issue.field === 'counting_version') return !sets.length || sets.some(s => !s?.counting_version || s.counting_version === 'review_required');
    if (issue.field === 'target') return !sets.length || sets.some(s => !s || !((s.reps || 0) > 0 || (s.duration_seconds || 0) > 0 || (s.distance_m || 0) > 0));
    if (['assistance_kg', 'reps', 'duration_seconds', 'distance_m', 'load_kg', 'rest_seconds', 'rir', 'rpe'].includes(issue.field || '')) {
      return !sets.length || sets.some(s => !s || s[issue.field as keyof typeof s] == null);
    }
    return true;
  });
}
