import { Moon, Sparkles, Sun } from "lucide-react";
import { BrandLockup } from "@/components/brand/BrandLockup";
import { useTheme } from "@/features/theme/useTheme";

type AuthTopbarProps = {
  onStartPlanning: () => void;
};

export function AuthTopbar({ onStartPlanning }: AuthTopbarProps) {
  const { resolvedTheme, setPreference } = useTheme();

  return (
    <nav className="topbar" aria-label="Primary">
      <BrandLockup />
      <div className="auth-topbar-actions">
        <button
          className="auth-theme-button"
          type="button"
          aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} theme`}
          onClick={() => setPreference(resolvedTheme === "dark" ? "light" : "dark")}
        >
          {resolvedTheme === "dark" ? (
            <Sun size={17} aria-hidden="true" />
          ) : (
            <Moon size={17} aria-hidden="true" />
          )}
        </button>
        <button className="ghost-button" type="button" onClick={onStartPlanning}>
          <Sparkles size={17} aria-hidden="true" />
          Create account
        </button>
      </div>
    </nav>
  );
}
