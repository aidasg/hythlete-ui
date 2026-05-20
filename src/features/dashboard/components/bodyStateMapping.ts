import type { WorkoutLoadStateResponse } from "@/features/workouts/services/workoutApi";
import { detailedMusclePaths, type MusclePath } from "@/features/dashboard/components/muscleBreakdownData";

export type BodyStateMetric = {
  entityType: string;
  entityId: string;
  loadType: string;
  label: string;
  acuteLoad: number;
  chronicLoad: number;
  ratio: number;
  trend: string;
};

export type BodyRegionState = {
  key: string;
  acuteLoad: number;
  chronicLoad: number;
  readiness: number;
  ratio: number;
  trend: string;
  metrics: BodyStateMetric[];
};

type BackendEntityMap = Record<string, string[]>;

export const backendMuscleToFigureTerms: BackendEntityMap = {
  quads: ["rectus femoris", "vastus lateralis", "vastus medialis"],
  hamstrings: ["semitendinosus", "semimembranosus", "biceps femoris"],
  glute_max: ["gluteus maximus"],
  glute_med: ["gluteus medius", "tensor fasciae latae"],
  adductors: ["gracilis", "adductor", "pectineus"],
  calves_soleus_gastroc: ["soleus", "gastrocnemius", "gastrocneus"],
  tibialis_ankle: [
    "tibialis anterior",
    "fibularis longus",
    "extensor digitorum longus",
    "crural and pedal",
  ],
  hip_flexors: ["iliopsoas", "deep hip flexors"],
  spinal_erectors: ["latissimus dorsi", "rhomboid", "trapezius", "side torso"],
  core_abs_obliques: [
    "rectus abdominis",
    "abdominal",
    "external abdominal oblique",
    "lateral abdominal wall",
    "pelvic floor",
  ],
  lats: ["latissimus dorsi"],
  upper_back: ["trapezius", "rhomboid", "teres major", "infraspinatus"],
  pecs: ["pectoralis"],
  delts: ["deltoid", "deltoideus", "posterior deltoid"],
  triceps: ["triceps"],
  biceps: ["biceps", "brachialis"],
  forearms_grip: [
    "forearm",
    "brachioradialis",
    "pronator",
    "flexor carpi",
    "extensor carpi",
    "hand",
  ],
};

export const backendTissueToFigureTerms: BackendEntityMap = {
  achilles_tendon: [
    "calcaneal tendon",
    "soleus",
    "gastrocnemius",
    "gastrocneus",
  ],
  plantar_fascia: ["plantar aponeurosis", "crural and pedal", "foot"],
  patellar_tendon: ["patellar ligament", "kneecap", "rectus femoris", "vastus"],
  knee_joint: ["knee", "popliteus", "patellar ligament"],
  hip_joint: ["iliopsoas", "pelvic", "gluteus", "adductor", "pectineus"],
  adductor_tendon: ["adductor", "gracilis", "pectineus"],
  hamstring_tendon: ["semitendinosus", "semimembranosus", "biceps femoris", "posterior knee"],
  lumbar_spine: ["latissimus dorsi", "external abdominal oblique", "lateral abdominal wall"],
  shoulder: ["deltoid", "infraspinatus", "teres major", "pectoralis", "trapezius"],
  elbow: ["bicipital aponeurosis", "biceps", "triceps", "brachioradialis", "forearm"],
  wrist_hand: ["hand", "flexor carpi", "extensor carpi", "brachioradialis"],
  neck: ["sternocleidomastoid", "trapezius", "head and neck", "craniofacial"],
};

const trendPriority: Record<string, number> = {
  none: 0,
  detraining: 1,
  stable: 2,
  rising: 3,
  high_acute: 4,
};

export function formatScoreName(loadType: string | undefined) {
  switch (loadType) {
    case "cardio":
      return "Cardiorespiratory Load Score";
    case "neuro":
      return "Neural Fatigue Score";
    case "muscular":
      return "Muscle Load Score";
    case "impact":
      return "Tendon Impact Score";
    case "strength":
      return "Strength Stress Score";
    case "endurance":
      return "Aerobic Stress Score";
    case "power":
      return "Power Output Stress Score";
    case "eccentric":
      return "Eccentric Tissue Stress Score";
    case "stabilizer":
      return "Stabilizer Demand Score";
    default:
      return "Load Adaptation Score";
  }
}

export function formatBackendEntity(entityId: string | undefined) {
  if (!entityId || entityId === "global") {
    return "Global";
  }

  return entityId
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getRegionReadiness(ratio: number, trend: string) {
  if (trend === "none" || ratio <= 0) {
    return 72;
  }

  if (trend === "detraining") {
    return 84;
  }

  if (trend === "stable") {
    return 78;
  }

  if (trend === "rising") {
    return 56;
  }

  return Math.max(18, Math.round(65 - (ratio - 1.2) * 36));
}

function normalize(value: string) {
  return value.toLowerCase();
}

function matchesTerms(path: MusclePath, terms: string[]) {
  const searchable = normalize(
    `${path.key} ${path.sourceId} ${path.scientificName} ${path.groupName}`
  );

  return terms.some((term) => searchable.includes(normalize(term)));
}

function getMappedPathKeys(entityId: string | undefined, entityType: string | undefined) {
  if (!entityId) {
    return [];
  }

  const map =
    entityType === "tissue" ? backendTissueToFigureTerms : backendMuscleToFigureTerms;
  const terms = map[entityId] || [];

  if (!terms.length) {
    return [];
  }

  return detailedMusclePaths
    .filter((path) => matchesTerms(path, terms))
    .map((path) => path.key);
}

function toMetric(state: WorkoutLoadStateResponse): BodyStateMetric {
  return {
    entityType: state.entity_type || "unknown",
    entityId: state.entity_id || "unknown",
    loadType: state.load_type || "load",
    label: formatScoreName(state.load_type),
    acuteLoad: state.acute_load || 0,
    chronicLoad: state.chronic_load || 0,
    ratio: state.ratio || 0,
    trend: state.trend || "none",
  };
}

function mergeTrend(currentTrend: string, nextTrend: string) {
  return (trendPriority[nextTrend] || 0) > (trendPriority[currentTrend] || 0)
    ? nextTrend
    : currentTrend;
}

export function buildBodyRegionState(
  loadState: WorkoutLoadStateResponse[]
): Record<string, BodyRegionState> {
  const regions: Record<string, BodyRegionState> = {};

  loadState.forEach((state) => {
    const pathKeys = getMappedPathKeys(state.entity_id, state.entity_type);
    const metric = toMetric(state);

    pathKeys.forEach((pathKey) => {
      const current = regions[pathKey] || {
        key: pathKey,
        acuteLoad: 0,
        chronicLoad: 0,
        readiness: 72,
        ratio: 0,
        trend: "none",
        metrics: [],
      };
      const acuteLoad = current.acuteLoad + metric.acuteLoad;
      const chronicLoad = current.chronicLoad + metric.chronicLoad;
      const ratio = chronicLoad > 0 ? acuteLoad / chronicLoad : 0;
      const trend = mergeTrend(current.trend, metric.trend);

      regions[pathKey] = {
        ...current,
        acuteLoad,
        chronicLoad,
        ratio,
        trend,
        readiness: getRegionReadiness(ratio, trend),
        metrics: [...current.metrics, metric],
      };
    });
  });

  return regions;
}
