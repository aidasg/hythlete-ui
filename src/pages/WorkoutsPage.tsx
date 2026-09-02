import { AuthenticatedAppShell } from "@/components/layout/AuthenticatedAppShell";
import { WorkoutCalendarView } from "@/features/workouts/components/WorkoutCalendarView";

export function WorkoutsPage() {
  return (
    <AuthenticatedAppShell>
      <WorkoutCalendarView />
    </AuthenticatedAppShell>
  );
}
