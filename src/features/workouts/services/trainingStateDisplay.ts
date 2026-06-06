export type TrainingStateBand =
  | "fresh"
  | "ready"
  | "loaded"
  | "caution"
  | "avoid"
  | "unknown";

const bandOrder: Record<TrainingStateBand, number> = {
  unknown: 0,
  fresh: 1,
  ready: 2,
  loaded: 3,
  caution: 4,
  avoid: 5,
};

export const trainingStateBands: TrainingStateBand[] = [
  "fresh",
  "ready",
  "loaded",
  "caution",
  "avoid",
];

export function getBandFromRecommendation(
  recommendation: string | undefined
): TrainingStateBand {
  switch (recommendation) {
    case "train":
      return "ready";
    case "modify":
      return "caution";
    case "recover":
    case "avoid_high_intensity":
      return "avoid";
    default:
      return "unknown";
  }
}

export function getBandFromReadinessLabel(
  label: string | undefined
): TrainingStateBand {
  switch (label) {
    case "fresh":
      return "fresh";
    case "ready":
      return "ready";
    case "loaded":
      return "loaded";
    case "caution":
      return "caution";
    case "avoid":
      return "avoid";
    default:
      return "unknown";
  }
}

function raiseBand(band: TrainingStateBand): TrainingStateBand {
  switch (band) {
    case "fresh":
      return "ready";
    case "ready":
      return "loaded";
    case "loaded":
      return "caution";
    case "caution":
    case "avoid":
      return "avoid";
    default:
      return "unknown";
  }
}

export function getBandFromRatioTrend(
  ratio: number | undefined,
  trend: string | undefined,
  entityType?: string
): TrainingStateBand {
  if (typeof ratio !== "number" || ratio <= 0) {
    return "unknown";
  }

  let band: TrainingStateBand;

  if (ratio < 0.65) {
    band = "fresh";
  } else if (ratio <= 1.05) {
    band = "ready";
  } else if (ratio <= 1.2) {
    band = "loaded";
  } else if (ratio <= 1.4) {
    band = "caution";
  } else {
    band = "avoid";
  }

  if (trend === "rising" && bandOrder[band] < bandOrder.loaded) {
    band = "loaded";
  }

  if (trend === "high_acute" && bandOrder[band] < bandOrder.caution) {
    band = "caution";
  }

  if (entityType === "tissue" && bandOrder[band] >= bandOrder.loaded) {
    band = raiseBand(band);
  }

  return band;
}

export function getBandFromReadinessScore(
  readiness: number | undefined
): TrainingStateBand {
  if (typeof readiness !== "number") {
    return "unknown";
  }

  if (readiness >= 85) {
    return "fresh";
  }

  if (readiness >= 70) {
    return "ready";
  }

  if (readiness >= 55) {
    return "loaded";
  }

  if (readiness >= 40) {
    return "caution";
  }

  return "avoid";
}

export function getBandCopy(band: TrainingStateBand) {
  switch (band) {
    case "fresh":
      return "Fresh";
    case "ready":
      return "Ready";
    case "loaded":
      return "Loaded";
    case "caution":
      return "Caution";
    case "avoid":
      return "Tired";
    default:
      return "No signal";
  }
}

export function getBandScore(band: TrainingStateBand) {
  switch (band) {
    case "fresh":
      return 92;
    case "ready":
      return 78;
    case "loaded":
      return 62;
    case "caution":
      return 46;
    case "avoid":
      return 28;
    default:
      return 0;
  }
}

export function getBandCssValue(band: TrainingStateBand) {
  return `var(--state-${band})`;
}

export function formatRatio(value: number | undefined) {
  return typeof value === "number" && value > 0 ? value.toFixed(2) : "0.00";
}
