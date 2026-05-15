import type { TrainingMetric } from "@/features/auth/types";

type MetricCardProps = {
  metric: TrainingMetric;
};

export function MetricCard({ metric }: MetricCardProps) {
  return (
    <article className="metric-card">
      <span>{metric.label}</span>
      <strong>{metric.value}</strong>
      <small>{metric.detail}</small>
    </article>
  );
}
