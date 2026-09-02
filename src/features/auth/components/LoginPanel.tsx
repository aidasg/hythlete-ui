import { Moon, Sun } from "lucide-react";
import { BrandLockup } from "@/components/brand/BrandLockup";
import {
  AuthForm,
  type AuthMode,
} from "@/features/auth/components/AuthForm";
import { useTheme } from "@/features/theme/useTheme";

const panelCopy = {
  login: {
    title: "Log in",
    body: "Pick up today's best session without losing the bigger picture.",
    switchCopy: "New to Hythlete?",
    switchLabel: "Create your profile",
  },
  register: {
    title: "Register",
    body: "Start building a training direction that adapts when life changes.",
    switchCopy: "Already have a profile?",
    switchLabel: "Log in",
  },
} as const satisfies Record<
  AuthMode,
  {
    title: string;
    body: string;
    switchCopy: string;
    switchLabel: string;
  }
>;

type LoginPanelProps = {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
};

export function LoginPanel({ mode, onModeChange }: LoginPanelProps) {
  const copy = panelCopy[mode];
  const { resolvedTheme, setPreference } = useTheme();

  return (
    <aside className="auth-panel">
      <div className="auth-mobile-brand">
        <div className="auth-mobile-brand-header">
          <BrandLockup />
          <button
            type="button"
            aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} theme`}
            onClick={() =>
              setPreference(resolvedTheme === "dark" ? "light" : "dark")
            }
          >
            {resolvedTheme === "dark" ? (
              <Sun size={18} aria-hidden="true" />
            ) : (
              <Moon size={18} aria-hidden="true" />
            )}
          </button>
        </div>
        <span>Training decisions built around your real readiness.</span>
      </div>
      <div className="panel-header">
        <span className="eyebrow">Personal training workspace</span>
        <h2>{copy.title}</h2>
        <p>{copy.body}</p>
      </div>

      <AuthForm mode={mode} />

      <p className="signup-copy">
        {copy.switchCopy}{" "}
        <button
          className="inline-button"
          type="button"
          onClick={() => onModeChange(mode === "login" ? "register" : "login")}
        >
          {copy.switchLabel}
        </button>
      </p>
    </aside>
  );
}
