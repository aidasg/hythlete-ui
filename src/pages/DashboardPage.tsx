import { AuthenticatedAppShell } from "@/components/layout/AuthenticatedAppShell";
import { useAuth } from "@/features/auth/context/useAuth";
import { DashboardGrid } from "@/features/dashboard/components/DashboardGrid";
import { ProfileWizardModal } from "@/features/profile/components/ProfileWizardModal";

export function DashboardPage() {
  const { session } = useAuth();

  return (
    <AuthenticatedAppShell>
      <DashboardGrid />
      <ProfileWizardModal profile={session?.profile} />
    </AuthenticatedAppShell>
  );
}
