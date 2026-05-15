import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/features/auth/context/useAuth";
import { paths } from "@/routes/paths";

export function GuestRoute() {
  const { isAuthenticated, status } = useAuth();

  if (status === "checking") {
    return <main className="app-shell" />;
  }

  if (isAuthenticated) {
    return <Navigate to={paths.dashboard} replace />;
  }

  return <Outlet />;
}
