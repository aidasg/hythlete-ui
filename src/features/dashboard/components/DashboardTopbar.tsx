import { CalendarDays, LayoutDashboard, LogOut, Menu, User } from "lucide-react";
import { Link } from "react-router-dom";
import { BrandLockup } from "@/components/brand/BrandLockup";
import { paths } from "@/routes/paths";

type DashboardTopbarProps = {
  activePage?: "dashboard" | "profile" | "workouts";
  email: string;
  onLogout: () => void;
};

export function DashboardTopbar({
  activePage = "dashboard",
  email,
  onLogout,
}: DashboardTopbarProps) {
  return (
    <header className="dashboard-topbar">
      <div className="topbar-primary">
        <BrandLockup />
        <Link
          className="topbar-nav-button"
          to={paths.dashboard}
          aria-current={activePage === "dashboard" ? "page" : undefined}
        >
          <LayoutDashboard size={17} aria-hidden="true" />
          Dashboard
        </Link>
        <Link
          className="topbar-nav-button"
          to={paths.workouts}
          aria-current={activePage === "workouts" ? "page" : undefined}
        >
          <CalendarDays size={17} aria-hidden="true" />
          Calendar
        </Link>
      </div>

      <div className="dashboard-controls">
        <div className="dashboard-user" aria-label="Current user">
          <strong>{email}</strong>
        </div>

        <details className="controls-menu">
          <summary aria-label="Open controls menu">
            <Menu size={20} aria-hidden="true" />
          </summary>
          <div className="controls-menu-panel">
            <Link
              to={paths.profile}
              aria-current={activePage === "profile" ? "page" : undefined}
            >
              <User size={17} aria-hidden="true" />
              Profile
            </Link>
            <button type="button" onClick={onLogout}>
              <LogOut size={17} aria-hidden="true" />
              Logout
            </button>
          </div>
        </details>
      </div>
    </header>
  );
}
