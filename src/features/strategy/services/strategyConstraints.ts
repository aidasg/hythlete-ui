import type { ProfileResponse } from "@/features/profile/services/profileApi";

export type StrategyConstraints = {
  availableMinutes: number;
  allowedSports: string[];
  activityMode?: "profile" | "any" | "custom";
  formats?: string[];
  equipment?: string[];
  excludedKeys?: string[];
};
export function normalizeSportCode(value: string) {
  const code = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return ({ amrap: "hiit", emom: "hiit", tabata: "hiit", weight_training: "strength_training", strength: "strength_training", crossfit: "functional_fitness", xc_skiing: "cross_country_skiing" } as Record<string, string>)[code] || code;
}
export function getProfileSportCodes(profile: ProfileResponse | undefined) {
  return [...new Set(profile?.preferred_sports?.flatMap(sport => {
    const code = normalizeSportCode(sport.code || sport.name || "");
    return code ? [code] : [];
  }) || [])];
}
const key = (userID: number) => `hythlete.strategyConstraints.v2.${userID}`;
function read(userID: number): Record<string, StrategyConstraints> {
  try { return JSON.parse(localStorage.getItem(key(userID)) || "{}"); } catch { return {}; }
}
export function getStrategyConstraints(date: string, profile: ProfileResponse | undefined): StrategyConstraints {
  const defaults: StrategyConstraints = { availableMinutes: 30, allowedSports: getProfileSportCodes(profile), activityMode: "profile", formats: [], equipment: ["bodyweight"], excludedKeys: [] };
  const stored = read(profile?.user_id || 0)?.[date];
  if (!stored || !Number.isFinite(stored.availableMinutes) || stored.availableMinutes < 1 || stored.availableMinutes > 360 || !Array.isArray(stored.allowedSports)) return defaults;
  return { ...defaults, ...stored, allowedSports: stored.activityMode === "profile" ? defaults.allowedSports : stored.allowedSports };
}
export function saveStrategyConstraints(date: string, constraints: StrategyConstraints, userID = 0) {
  const next = { ...read(userID), [date]: constraints };
  Object.keys(next).sort().reverse().slice(14).forEach(date => delete next[date]);
  try { localStorage.setItem(key(userID), JSON.stringify(next)); } catch { /* The current selection remains usable without persistence. */ }
}
