import { AuthTopbar } from "@/features/auth/components/AuthTopbar";
import { LoginHero } from "@/features/auth/components/LoginHero";

type AuthBrandPanelProps = {
  onStartPlanning: () => void;
};

export function AuthBrandPanel({ onStartPlanning }: AuthBrandPanelProps) {
  return (
    <div className="brand-panel">
      <AuthTopbar onStartPlanning={onStartPlanning} />
      <LoginHero />
      <div className="auth-proof-point">
        <strong>Plan with context</strong>
        <span>Readiness, time, training history, and long-term goals in one place.</span>
      </div>
    </div>
  );
}
