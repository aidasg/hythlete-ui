import type { TrainingMetric } from "@/features/auth/types";

export const loginHeroContent = {
  eyebrow: "Lifelong hybrid training",
  headline: "Know the best workout to do today.",
  body: "Tell Hythlete your time, equipment, fatigue, and priorities. It gives you the right session now while keeping your bigger athletic development on track.",
} as const;

export const trainingMetrics: TrainingMetric[] = [
  { label: "Today", value: "42m", detail: "bodyweight + dumbbells" },
  { label: "Focus", value: "Hybrid", detail: "strength, engine, mobility" },
  { label: "Direction", value: "On track", detail: "short session, long arc" },
];
