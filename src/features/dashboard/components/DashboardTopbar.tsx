import { LogOut, Menu } from "lucide-react";
import { BrandLockup } from "@/components/brand/BrandLockup";

type DashboardTopbarProps = {
  email: string;
  onLogout: () => void;
};

export function DashboardTopbar({ email, onLogout }: DashboardTopbarProps) {
  return (
    <header className="dashboard-topbar">
      <BrandLockup />

      <div className="dashboard-controls">
        <div className="dashboard-user" aria-label="Current user">
          <span>Signed in as</span>
          <strong>{email}</strong>
        </div>

        <details className="controls-menu">
          <summary aria-label="Open controls menu">
            <Menu size={20} aria-hidden="true" />
          </summary>
          <div className="controls-menu-panel">
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
