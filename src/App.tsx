import { Navigate, Route, Routes } from "react-router-dom";
import { DashboardPage } from "@/pages/DashboardPage";
import { LoginPage } from "@/pages/LoginPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { WorkoutsPage } from "@/pages/WorkoutsPage";
import { GuestRoute } from "@/routes/components/GuestRoute";
import { ProtectedRoute } from "@/routes/components/ProtectedRoute";
import { paths } from "@/routes/paths";

function App() {
  return (
    <Routes>
      <Route path={paths.home} element={<Navigate to={paths.login} replace />} />
      <Route element={<GuestRoute />}>
        <Route path={paths.login} element={<LoginPage />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route path={paths.dashboard} element={<DashboardPage />} />
        <Route path={paths.workouts} element={<WorkoutsPage />} />
        <Route path={paths.profile} element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
