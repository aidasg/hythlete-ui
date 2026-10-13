import { AuthenticatedAppShell } from "@/components/layout/AuthenticatedAppShell";
import { WorkoutExecution } from "@/features/execution/components/WorkoutExecution";
export function ExecutionPage() { return <AuthenticatedAppShell><WorkoutExecution /></AuthenticatedAppShell>; }
