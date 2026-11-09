import { useState } from 'react';
import type { WorkoutCatalogResponse } from '../../services/workoutApi';
import type { SessionBlock } from '../../services/sessionStructure';
import { newBlock, newID } from '../../services/workoutBuilder';
import { BlockEditor } from './BlockEditor';
import type { ExerciseAIIssue } from '../../services/exerciseAI';

export function ImportedExercisesEditor({ blocks, catalog, onChange, issues = [] }: { blocks: SessionBlock[]; catalog: WorkoutCatalogResponse; onChange: (blocks: SessionBlock[]) => void; issues?: ExerciseAIIssue[] }) {
  const [removed, setRemoved] = useState<{ block: SessionBlock; index: number }>();
  return <section aria-label="Performed exercises">
    <h3>Performed exercises</h3>
    {blocks.map((block, i) => <BlockEditor key={block.id} block={block} catalog={catalog} log legacy issues={issues.filter(issue => issue.block_id === block.id)} first={i === 0} last={i === blocks.length - 1}
      onChange={value => onChange(blocks.map((b, j) => j === i ? value : b))}
      onDuplicate={() => { const next = [...blocks]; next.splice(i + 1, 0, { ...structuredClone(block), id: newID() }); onChange(next); }}
      onRemove={() => { setRemoved({ block, index: i }); onChange(blocks.filter((_, j) => j !== i)); }}
      onMove={direction => { const next = [...blocks]; [next[i], next[i + direction]] = [next[i + direction]!, next[i]!]; onChange(next); }} />)}
    {!blocks.length && <p>No exercises recorded.</p>}
    {removed && <p role="status">Exercise removed. <button type="button" onClick={() => { const next = [...blocks]; next.splice(removed.index, 0, removed.block); onChange(next); setRemoved(undefined); }}>Undo</button></p>}
    <button type="button" className="secondary-button" onClick={() => onChange([...blocks, newBlock('', 'straight_sets', true)])}>Add exercise</button>
  </section>;
}
