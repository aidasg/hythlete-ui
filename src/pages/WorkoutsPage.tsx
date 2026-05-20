import { useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/context/useAuth";
import { DashboardTopbar } from "@/features/dashboard/components/DashboardTopbar";
import { WorkoutCalendarView } from "@/features/workouts/components/WorkoutCalendarView";
import { paths } from "@/routes/paths";

export function WorkoutsPage() {
  const navigate = useNavigate();
  const { logoutUser, session } = useAuth();

  async function handleLogout() {
    await logoutUser();
    navigate(paths.login, { replace: true });
  }

  return (
    <main className="app-shell dashboard-shell">
      <DashboardTopbar
        activePage="workouts"
        email={session?.email || "Authenticated user"}
        onLogout={handleLogout}
      />
      <WorkoutCalendarView />
    </main>
  );
}
