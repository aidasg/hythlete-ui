import { useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/context/useAuth";
import { DashboardGrid } from "@/features/dashboard/components/DashboardGrid";
import { DashboardTopbar } from "@/features/dashboard/components/DashboardTopbar";
import { ProfileWizardModal } from "@/features/profile/components/ProfileWizardModal";
import { paths } from "@/routes/paths";

export function DashboardPage() {
  const navigate = useNavigate();
  const { logoutUser, session } = useAuth();

  async function handleLogout() {
    await logoutUser();
    navigate(paths.login, { replace: true });
  }

  return (
    <main className="app-shell dashboard-shell">
      <DashboardTopbar
        email={session?.email || "Authenticated user"}
        onLogout={handleLogout}
      />
      <DashboardGrid />
      <ProfileWizardModal profile={session?.profile} />
    </main>
  );
}
