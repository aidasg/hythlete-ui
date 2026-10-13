import { AuthenticatedAppShell } from "@/components/layout/AuthenticatedAppShell";
import { ProgressHub } from "@/features/progress/components/ProgressHub";

export function ProgressPage() {
  return (
    <AuthenticatedAppShell>
      <ProgressHub />
    </AuthenticatedAppShell>
  );
}
