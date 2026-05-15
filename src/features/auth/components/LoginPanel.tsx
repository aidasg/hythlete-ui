import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { AuthSecondaryActions } from "@/features/auth/components/AuthSecondaryActions";
import {
  AuthForm,
  type AuthMode,
} from "@/features/auth/components/AuthForm";

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

export function LoginPanel() {
  const [mode, setMode] = useState<AuthMode>("login");
  const copy = panelCopy[mode];

  return (
    <aside className="auth-panel">
      <div className="panel-header">
        <span className="status-chip">
          <ShieldCheck size={16} aria-hidden="true" />
          Secure personal training space
        </span>
        <h2>{copy.title}</h2>
        <p>{copy.body}</p>
      </div>

      <AuthForm mode={mode} />
      <AuthSecondaryActions />

      <p className="signup-copy">
        {copy.switchCopy}{" "}
        <button
          className="inline-button"
          type="button"
          onClick={() =>
            setMode((current) => (current === "login" ? "register" : "login"))
          }
        >
          {copy.switchLabel}
        </button>
      </p>
    </aside>
  );
}
