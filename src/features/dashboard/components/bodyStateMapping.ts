import type { WorkoutLoadStateResponse } from "@/features/workouts/services/workoutApi";
import { detailedMusclePaths, type MusclePath } from "@/features/dashboard/components/muscleBreakdownData";
import {
  getBandFromRatioTrend,
  getBandScore,
} from "@/features/workouts/services/trainingStateDisplay";

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
  rectus_femoris: ["rectus femoris"],
  vastus_lateralis: ["vastus lateralis"],
  vastus_medialis: ["vastus medialis"],
  semitendinosus: ["semitendinosus"],
  semimembranosus: ["semimembranosus"],
  biceps_femoris: ["biceps femoris"],
  glute_max: ["gluteus maximus"],
  gluteus_medius: ["gluteus medius"],
  tensor_fasciae_latae: ["tensor fasciae latae"],
  adductor_longus: ["adductor longus"],
  adductor_magnus: ["adductor magnus"],
  gracilis: ["gracilis"],
  pectineus: ["pectineus"],
  soleus: ["soleus"],
  gastrocnemius: ["gastrocnemius", "gastrocneus"],
  tibialis_anterior: ["tibialis anterior"],
  fibularis_longus: ["fibularis longus"],
  extensor_digitorum_longus: ["extensor digitorum longus"],
  crural_pedal_complex: ["crural and pedal"],
  iliopsoas: ["iliopsoas"],
  deep_hip_flexor_region: ["deep hip flexors"],
  spinal_erectors: ["erector spinae"],
  rectus_abdominis: ["rectus abdominis", "anterior abdominal wall"],
  external_obliques: ["external abdominal oblique", "lateral abdominal wall"],
  pelvic_stabilizers: ["pelvic floor"],
  lats: ["latissimus dorsi"],
  trapezius: ["trapezius"],
  rhomboid_major: ["rhomboid major"],
  infraspinatus: ["infraspinatus"],
  teres_major: ["teres major"],
  pectoralis_major: ["pectoralis major"],
  pectoralis_minor: ["pectoralis minor"],
  anterior_deltoid: ["deltoid anterior"],
  lateral_deltoid: ["deltoid middle"],
  posterior_deltoid: ["posterior deltoid"],
  triceps_long_head: ["triceps brachii long"],
  triceps_lateral_head: ["triceps brachii lateral"],
  triceps_medial_head: ["triceps brachii medial"],
  biceps_long_head: ["biceps brachii long"],
  biceps_short_head: ["biceps brachii short"],
  brachialis: ["brachialis"],
  forearm_flexors: ["flexor carpi"],
  forearm_extensors: ["extensor carpi", "abductor pollicis longus"],
  brachioradialis: ["brachioradialis"],
  pronator_teres: ["pronator teres"],
  intrinsic_hand: ["intrinsic hand"],
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
  lumbar_spine: [
    "erector spinae",
    "latissimus dorsi",
    "external abdominal oblique",
    "lateral abdominal wall",
  ],
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

export function getRegionReadiness(
  ratio: number,
  trend: string,
  entityType?: string
) {
  const band = getBandFromRatioTrend(ratio, trend, entityType);
  const score = getBandScore(band);

  return score > 0 ? score : 72;
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

export function getMappedPathKeysForBackendEntity(
  entityId: string | undefined,
  entityType: string | undefined
) {
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
    const pathKeys = getMappedPathKeysForBackendEntity(
      state.entity_id,
      state.entity_type
    );
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
        readiness: getRegionReadiness(ratio, trend, metric.entityType),
        metrics: [...current.metrics, metric],
      };
    });
  });

  return regions;
}
