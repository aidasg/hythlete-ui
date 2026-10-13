import type { ProfileResponse } from "@/features/profile/services/profileApi";

const STORAGE_KEY = "hythlete.strategyConstraints.v1";

export type StrategyConstraints = {
  availableMinutes: number;
  allowedSports: string[];
};

export function normalizeSportCode(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function getProfileSportCodes(profile: ProfileResponse | undefined) {
  return (
    profile?.preferred_sports?.flatMap((sport) => {
      const code = sport.code || normalizeSportCode(sport.name || "");
      return code ? [code] : [];
    }) || []
  );
}

function readStoredConstraints() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, StrategyConstraints>)
      : {};
  } catch {
    return {};
  }
}

export function getStrategyConstraints(
  date: string,
  profile: ProfileResponse | undefined
): StrategyConstraints {
  const stored = readStoredConstraints()[date];

  if (
    stored &&
    Number.isFinite(stored.availableMinutes) &&
    Array.isArray(stored.allowedSports)
  ) {
    return {
      availableMinutes: stored.availableMinutes,
      allowedSports: stored.allowedSports,
    };
  }

  return {
    availableMinutes: 60,
    allowedSports: getProfileSportCodes(profile),
  };
}

export function saveStrategyConstraints(
  date: string,
  constraints: StrategyConstraints
) {
  const current = readStoredConstraints();
  const next = { ...current, [date]: constraints };
  const dates = Object.keys(next).sort().reverse();

  dates.slice(14).forEach((oldDate) => delete next[oldDate]);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
