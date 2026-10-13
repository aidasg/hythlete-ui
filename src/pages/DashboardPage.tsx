import { AuthenticatedAppShell } from "@/components/layout/AuthenticatedAppShell";
import { DashboardGrid } from "@/features/dashboard/components/DashboardGrid";

export function DashboardPage() {
  return (
    <AuthenticatedAppShell>
      <DashboardGrid />
    </AuthenticatedAppShell>
  );
}
