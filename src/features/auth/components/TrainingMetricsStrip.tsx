import { MetricCard } from "@/features/auth/components/MetricCard";
import { trainingMetrics } from "@/features/auth/services/authMockData";

export function TrainingMetricsStrip() {
  return (
    <div className="metrics-strip" aria-label="Training metrics preview">
      {trainingMetrics.map((metric) => (
        <MetricCard key={metric.label} metric={metric} />
      ))}
    </div>
  );
}
