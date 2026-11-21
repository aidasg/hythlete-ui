import { AuthenticatedAppShell } from '@/components/layout/AuthenticatedAppShell';
import { GoalsWorkspace } from '@/features/goals/components/GoalsWorkspace';
export function GoalsPage() { return <AuthenticatedAppShell><GoalsWorkspace /></AuthenticatedAppShell>; }
