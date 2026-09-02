import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Settings2,
  SunMoon,
  User,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { BrandLockup } from "@/components/brand/BrandLockup";
import { useTheme } from "@/features/theme/useTheme";
import { paths } from "@/routes/paths";

type DashboardTopbarProps = {
  email: string;
  onLogout: () => void;
};

const navigationItems = [
  { to: paths.dashboard, label: "Today", icon: LayoutDashboard },
  { to: paths.workouts, label: "Calendar", icon: CalendarDays },
  { to: paths.profile, label: "Profile", icon: User },
];

function NavigationLinks({ mobile = false }: { mobile?: boolean }) {
  return (
    <nav
      className={mobile ? "app-bottom-nav" : "app-primary-nav"}
      aria-label={mobile ? "Mobile navigation" : "Primary navigation"}
    >
      {navigationItems.map((item) => {
        const Icon = item.icon;

        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `app-nav-link${isActive ? " is-active" : ""}`
            }
          >
            <Icon size={18} aria-hidden="true" />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

export function DashboardTopbar({ email, onLogout }: DashboardTopbarProps) {
  const { preference, setPreference } = useTheme();
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !accountMenuRef.current?.contains(event.target)
      ) {
        setIsAccountMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsAccountMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <>
      <header className="dashboard-topbar">
        <BrandLockup to={paths.dashboard} />
        <NavigationLinks />

        <div className="dashboard-controls">
          <label className="theme-control">
            <SunMoon size={17} aria-hidden="true" />
            <span className="sr-only">Theme</span>
            <select
              aria-label="Theme"
              value={preference}
              onChange={(event) =>
                setPreference(event.target.value as "system" | "light" | "dark")
              }
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>

          <div className="account-menu" ref={accountMenuRef}>
            <button
              type="button"
              className="account-menu-trigger"
              aria-label="Open account menu"
              aria-haspopup="menu"
              aria-expanded={isAccountMenuOpen}
              onClick={() => setIsAccountMenuOpen((isOpen) => !isOpen)}
            >
              <span className="account-avatar" aria-hidden="true">
                {email.charAt(0).toUpperCase() || "A"}
              </span>
              <ChevronDown size={15} aria-hidden="true" />
            </button>

            {isAccountMenuOpen && (
              <div className="account-menu-panel" role="menu">
                <div className="account-menu-identity">
                  <span>Signed in as</span>
                  <strong>{email}</strong>
                </div>
                <NavLink
                  to={paths.profile}
                  role="menuitem"
                  onClick={() => setIsAccountMenuOpen(false)}
                >
                  <Settings2 size={17} aria-hidden="true" />
                  Profile settings
                </NavLink>
                <button type="button" role="menuitem" onClick={onLogout}>
                  <LogOut size={17} aria-hidden="true" />
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <NavigationLinks mobile />
    </>
  );
}
