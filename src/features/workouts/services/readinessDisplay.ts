import type { LimiterResponse } from "@/features/workouts/services/workoutApi";

export const recommendationCopy: Record<string, string> = {
  train: "Good day to train.",
  modify: "Train, but adjust the session.",
  recover: "Recovery is the best choice today.",
  avoid_high_intensity: "Avoid hard intensity today.",
};

export function formatReadinessLabel(value: string | undefined) {
  if (!value) {
    return null;
  }

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getRecommendationCopy(recommendation: string | undefined) {
  return recommendation
    ? recommendationCopy[recommendation] ||
        formatReadinessLabel(recommendation) ||
        "Readiness returned."
    : "No recommendation returned.";
}

export function getLimiterTitle(limiter: LimiterResponse) {
  if (limiter.entity_type === "global" || limiter.entity_id === "global") {
    return (
      formatReadinessLabel(limiter.load_type) ||
      limiter.name ||
      limiter.group_name ||
      "Limiter"
    );
  }

  return (
    limiter.name ||
    limiter.group_name ||
    limiter.region ||
    limiter.entity_id ||
    limiter.entity_type ||
    "Limiter"
  );
}

export function getLimiterMeta(limiter: LimiterResponse) {
  return [
    formatReadinessLabel(limiter.kind),
    formatReadinessLabel(limiter.label),
    typeof limiter.magnitude === "number"
      ? `${Math.round(limiter.magnitude)} magnitude`
      : null,
    limiter.source === "user" ? "Calendar" : null,
    formatReadinessLabel(limiter.load_type),
    formatReadinessLabel(limiter.region),
  ].filter(Boolean);
}

export function getLimiterKey(limiter: LimiterResponse) {
  return [
    limiter.source || "load",
    limiter.kind || "load",
    limiter.entity_type || "unknown",
    limiter.entity_id || limiter.name || limiter.group_name || "unknown",
    limiter.load_type || "any",
    limiter.label || "none",
    typeof limiter.magnitude === "number" ? Math.round(limiter.magnitude) : "none",
  ].join(":");
}

export function getTopLimiters(limiters: LimiterResponse[] | undefined, count = 5) {
  return [...(limiters || [])]
    .sort((left, right) => (right.severity || 0) - (left.severity || 0))
    .slice(0, count);
}
