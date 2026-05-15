import { useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/context/useAuth";
import { DashboardTopbar } from "@/features/dashboard/components/DashboardTopbar";
import { ProfileEditor } from "@/features/profile/components/ProfileEditor";
import { paths } from "@/routes/paths";

export function ProfilePage() {
  const navigate = useNavigate();
  const { logoutUser, session } = useAuth();

  async function handleLogout() {
    await logoutUser();
    navigate(paths.login, { replace: true });
  }

  return (
    <main className="app-shell dashboard-shell">
      <DashboardTopbar
        activePage="profile"
        email={session?.email || "Authenticated user"}
        onLogout={handleLogout}
      />
      <ProfileEditor profile={session?.profile} />
    </main>
  );
}
