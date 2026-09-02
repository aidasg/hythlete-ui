import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/context/useAuth";
import { DashboardTopbar } from "@/features/dashboard/components/DashboardTopbar";
import { paths } from "@/routes/paths";

type AuthenticatedAppShellProps = {
  children: ReactNode;
};

export function AuthenticatedAppShell({ children }: AuthenticatedAppShellProps) {
  const navigate = useNavigate();
  const { logoutUser, session } = useAuth();

  async function handleLogout() {
    await logoutUser();
    navigate(paths.login, { replace: true });
  }

  return (
    <main className="app-shell dashboard-shell">
      <DashboardTopbar
        email={session?.email || "Authenticated athlete"}
        onLogout={handleLogout}
      />
      {children}
    </main>
  );
}

