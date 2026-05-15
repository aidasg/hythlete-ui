import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/context/useAuth";
import { paths } from "@/routes/paths";

export function ProtectedRoute() {
  const { isAuthenticated, status } = useAuth();
  const location = useLocation();

  if (status === "checking") {
    return <main className="app-shell dashboard-shell" />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to={paths.login}
        replace
        state={{ redirectTo: location.pathname }}
      />
    );
  }

  return <Outlet />;
}
