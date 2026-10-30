import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WorkoutDetailPanel } from './WorkoutDetailPanel';
vi.mock('./WorkoutImpactPanel', () => ({ WorkoutImpactPanel: () => <section aria-label="Load analysis"/> }));
describe('workout detail presentation', () => {
  it('keeps recorded effort before load analysis and a legacy plan collapsed', () => {
    const {container} = render(<WorkoutDetailPanel isLoading={false} errorMessage={null} workout={{completed:true,execution:{imported_activity:{segments:[{component:{duration_seconds:40,effort:{zone:'easy'}}}],prescription_components:[{duration_seconds:300,intensity_zone:'threshold',repeats:3}]}}}}/>);
    expect(screen.getByRole('group',{name:'Recorded effort by active time'})).toBeInTheDocument();
    expect(screen.getByText('Original workout plan').closest('details')).not.toHaveAttribute('open');
    expect(container.querySelector('.workout-timeline')!.compareDocumentPosition(screen.getByRole('region',{name:'Load analysis'})) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole('heading',{name:'Components'})).not.toBeInTheDocument();
  });
  it('retains strength sets instead of presenting an endurance timeline', () => {
    render(<WorkoutDetailPanel isLoading={false} errorMessage={null} workout={{completed:true,category:'strength',components:[{type:'exercise',exercise_name:'Squat',sets:[{set_order:1,reps:5,load_kg:80}]}]}}/>);
    expect(screen.getByRole('heading',{name:'Components'})).toBeInTheDocument();
    expect(screen.getByText(/Squat/)).toBeInTheDocument();
    expect(screen.getByText(/80/)).toBeInTheDocument();
    expect(screen.queryByRole('region',{name:'Workout timeline'})).not.toBeInTheDocument();
  });
});
