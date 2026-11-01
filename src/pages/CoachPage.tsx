import { AuthenticatedAppShell } from "@/components/layout/AuthenticatedAppShell";
import { CoachWorkspace } from "@/features/coach/components/CoachWorkspace";
export function CoachPage() {
  return <AuthenticatedAppShell><CoachWorkspace /></AuthenticatedAppShell>;
}
