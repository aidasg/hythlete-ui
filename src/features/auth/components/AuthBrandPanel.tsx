import { AuthTopbar } from "@/features/auth/components/AuthTopbar";
import { LoginHero } from "@/features/auth/components/LoginHero";
import { TrainingMetricsStrip } from "@/features/auth/components/TrainingMetricsStrip";

export function AuthBrandPanel() {
  return (
    <div className="brand-panel">
      <AuthTopbar />
      <LoginHero />
      <TrainingMetricsStrip />
    </div>
  );
}
