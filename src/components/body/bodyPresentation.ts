import type { MuscleView } from "./muscleBreakdownData";

export type BodyLayer = "muscle" | "tissue";
export type LoadBand = "unknown" | "fresh" | "ready" | "loaded" | "caution" | "avoid";
export type BodyReport = { date: string; kind: string; severity: number };
export type BodyRegion = {
  id: string;
  layer: BodyLayer;
  name: string;
  anatomy: string;
  pathKeys: string[];
  value?: number;
  band: LoadBand;
  metrics: { label: string; value: string }[];
  reasons: string[];
  reports: BodyReport[];
};
export const loadBandOrder: LoadBand[] = ["unknown", "fresh", "ready", "loaded", "caution", "avoid"];
export const loadBandLabels: Record<LoadBand, string> = {
  unknown: "Not enough data", fresh: "Light recent use", ready: "Usual training load",
  loaded: "Heavier than usual", caution: "High recent load", avoid: "Very high recent load",
};
export const loadBandDescriptions: Record<LoadBand, string> = {
  unknown: "There is not enough separate training data to describe this area's recent load.",
  fresh: "This area has had light recent use.",
  ready: "This area is around its usual training load.",
  loaded: "This area has worked more than usual recently.",
  caution: "Recent training has put a high amount of work through this area.",
  avoid: "Recent training has put a very high amount of work through this area.",
};
export const commonNames: Record<string, string> = {
  quads: "Front thighs", quadriceps: "Front thighs", hamstrings: "Back of thighs", glutes: "Buttocks",
  rectus_femoris: "Front thighs", vastus_lateralis: "Outer front thighs", vastus_medialis: "Inner front thighs",
  semitendinosus: "Back of thighs", semimembranosus: "Inner back of thighs", biceps_femoris: "Outer back of thighs",
  glute_max: "Buttocks", gluteus_medius: "Side of hips", tensor_fasciae_latae: "Outer hips",
  adductor_longus: "Inner thighs", adductor_magnus: "Inner thighs", gracilis: "Inner thighs", pectineus: "Upper inner thighs",
  soleus: "Deep calves", gastrocnemius: "Calves", tibialis_anterior: "Front of shins", fibularis_longus: "Outer lower legs",
  extensor_digitorum_longus: "Front of lower legs", crural_pedal_complex: "Lower legs and feet",
  iliopsoas: "Front of hips", deep_hip_flexor_region: "Deep hip muscles", spinal_erectors: "Lower back",
  rectus_abdominis: "Front of stomach", external_obliques: "Sides of stomach", pelvic_stabilizers: "Pelvic support muscles",
  lats: "Sides of back", trapezius: "Upper back", rhomboid_major: "Between shoulder blades", infraspinatus: "Back of shoulders",
  teres_major: "Back of armpits", pectoralis_major: "Chest", pectoralis_minor: "Deep chest",
  anterior_deltoid: "Front of shoulders", lateral_deltoid: "Side of shoulders", posterior_deltoid: "Back of shoulders",
  triceps_long_head: "Back of upper arms", triceps_lateral_head: "Outer back of upper arms", triceps_medial_head: "Inner back of upper arms",
  biceps_long_head: "Front of upper arms", biceps_short_head: "Inner front of upper arms", brachialis: "Deep upper arms",
  forearm_flexors: "Inner forearms", forearm_extensors: "Outer forearms", brachioradialis: "Outer forearms", pronator_teres: "Inner forearms", intrinsic_hand: "Hands",
  achilles_tendon: "Back of ankles", plantar_fascia: "Soles of feet", patellar_tendon: "Below kneecaps",
  knee_joint: "Knee joints", hip_joint: "Hip joints", adductor_tendon: "Groin tendons", hamstring_tendon: "Tendons behind knees",
  lumbar_spine: "Lower spine", shoulder: "Shoulder joints", elbow: "Elbows", wrist_hand: "Wrists and hands", neck: "Neck",
};
export function commonName(id: string, fallback?: string) {
  return commonNames[id] || fallback || id.replace(/_/g, " ");
}
// Approximate regional markers, not drawings of individual tendons or joints.
export const tissueMarkers: Record<string, { view: MuscleView; points: [number, number][] }> = {
  neck: { view: "front", points: [[50, 13]] }, shoulder: { view: "front", points: [[30, 22], [70, 22]] },
  elbow: { view: "front", points: [[23, 38], [77, 38]] }, wrist_hand: { view: "front", points: [[15, 54], [85, 54]] },
  hip_joint: { view: "front", points: [[40, 49], [60, 49]] }, adductor_tendon: { view: "front", points: [[44, 55], [56, 55]] },
  knee_joint: { view: "front", points: [[38, 71], [62, 71]] }, patellar_tendon: { view: "front", points: [[38, 76], [62, 76]] },
  lumbar_spine: { view: "back", points: [[50, 44]] }, hamstring_tendon: { view: "back", points: [[39, 71], [61, 71]] },
  achilles_tendon: { view: "back", points: [[38, 89], [62, 89]] }, plantar_fascia: { view: "back", points: [[37, 96], [63, 96]] },
};
export function impactLabel(value: number | undefined, max: number) {
  if (value === undefined) return "Not enough data";
  if (value <= 0 || max <= 0) return "No recorded emphasis";
  const proportion = value / max;
  return proportion > 2 / 3 ? "Main area worked" : proportion > 1 / 3 ? "Supporting area" : "Less work";
}
export function impactColor(value: number | undefined, max: number) {
  if (value === undefined || value <= 0 || max <= 0) return "var(--state-unknown)";
  return value / max > 2 / 3 ? "#60dcf5" : value / max > 1 / 3 ? "#859bdb" : "#5b628b";
}
