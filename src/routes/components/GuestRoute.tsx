import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/context/useAuth";
import { coachReviewRedirect } from "@/routes/coachReviewRedirect";
import { paths } from "@/routes/paths";

export function GuestRoute() {
  const location = useLocation();
  const { isAuthenticated, status } = useAuth();

  if (status === "checking") {
    return <main className="app-shell" />;
  }

  if (isAuthenticated) {
    return <Navigate to={coachReviewRedirect(location.state) || paths.dashboard} replace />;
  }

  return <Outlet />;
}
