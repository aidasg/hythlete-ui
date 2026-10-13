import type {
  ProfileOptionsResponse,
  ProfileRequest,
  ProfileResponse,
} from "@/features/profile/services/profileApi";
import { getDetectedTimeZone, isValidTimeZone } from "@/features/profile/services/timezones";

export type Sport = NonNullable<ProfileOptionsResponse["sports"]>[number];
export type Goal = NonNullable<ProfileOptionsResponse["goals"]>[number];
export type BaselineMetric =
  | "thresholdHrBpm"
  | "maxHrBpm"
  | "restingHrBpm"
  | "ftpWatts"
  | "thresholdSpeedMps";

export type BaselineDraft = {
  sport: string;
  calibrationSource: string;
} & Record<BaselineMetric, string>;

export type GoalDraft = { goalId: number; sportId: number | "" };

export type ProfileDraft = {
  birthDate: string;
  activelyTrainingSince: string;
  weightKg: string;
  weeklyTimeBudgetHours: string;
  timezone: string;
  preferredSportIds: number[];
  preferredTrainingDays: string[];
  enduranceBaselines: BaselineDraft[];
  goals: GoalDraft[];
};

export const weekdays = [
  { value: "monday", label: "Mon" },
  { value: "tuesday", label: "Tue" },
  { value: "wednesday", label: "Wed" },
  { value: "thursday", label: "Thu" },
  { value: "friday", label: "Fri" },
  { value: "saturday", label: "Sat" },
  { value: "sunday", label: "Sun" },
];

export const baselineMetrics: {
  key: BaselineMetric;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: string;
}[] = [
  { key: "thresholdHrBpm", label: "Threshold heart rate", unit: "bpm", min: 60, max: 230, step: "1" },
  { key: "maxHrBpm", label: "Maximum heart rate", unit: "bpm", min: 80, max: 240, step: "1" },
  { key: "restingHrBpm", label: "Resting heart rate", unit: "bpm", min: 25, max: 120, step: "1" },
  { key: "ftpWatts", label: "Functional threshold power", unit: "W", min: 50, max: 800, step: "1" },
  { key: "thresholdSpeedMps", label: "Threshold speed", unit: "m/s", min: 0.1, max: 15, step: "0.1" },
];

export function normalizeSportCode(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function sportCode(sport: Sport) {
  return sport.code || normalizeSportCode(sport.name || "");
}

export function createProfileDraft(profile: ProfileResponse | undefined): ProfileDraft {
  return {
    birthDate: profile?.birth_date || "",
    activelyTrainingSince: profile?.actively_training_since || "",
    weightKg: profile?.weight_kg ? String(profile.weight_kg) : "",
    weeklyTimeBudgetHours: profile?.weekly_time_budget_hours
      ? String(profile.weekly_time_budget_hours)
      : "",
    timezone: profile?.timezone || getDetectedTimeZone(),
    preferredSportIds: profile?.preferred_sports?.flatMap((sport) =>
      typeof sport.id === "number" ? [sport.id] : []
    ) || [],
    preferredTrainingDays: profile?.preferred_training_days || [],
    enduranceBaselines: profile?.endurance_baselines?.flatMap((baseline) =>
      baseline.sport ? [{
        sport: baseline.sport,
        calibrationSource: baseline.calibration_source || "manual",
        thresholdHrBpm: baseline.threshold_hr_bpm?.toString() || "",
        maxHrBpm: baseline.max_hr_bpm?.toString() || "",
        restingHrBpm: baseline.resting_hr_bpm?.toString() || "",
        ftpWatts: baseline.ftp_watts?.toString() || "",
        thresholdSpeedMps: baseline.threshold_speed_mps?.toString() || "",
      }] : []
    ) || [],
    goals: profile?.goal_priorities?.flatMap((item) =>
      typeof item.goal?.id === "number"
        ? [{ goalId: item.goal.id, sportId: item.sport?.id || "" as const }]
        : []
    ) || [],
  };
}

export function isProfileComplete(profile: ProfileResponse | undefined) {
  return Boolean(
    profile?.birth_date &&
    profile.actively_training_since &&
    profile.weight_kg &&
    profile.timezone &&
    profile.weekly_time_budget_hours &&
    profile.preferred_sports?.length &&
    profile.preferred_training_days?.length &&
    profile.goal_priorities?.length
  );
}

export function matchingBaseline(draft: ProfileDraft, sport: Sport) {
  const code = sportCode(sport);
  const legacyCode = normalizeSportCode(sport.name || "");
  return draft.enduranceBaselines.find((item) => item.sport === code) ||
    draft.enduranceBaselines.find((item) => item.sport === legacyCode);
}

export function setBaselineMetric(
  draft: ProfileDraft,
  sport: Sport,
  metric: BaselineMetric,
  value: string
): ProfileDraft {
  const code = sportCode(sport);
  const current = matchingBaseline(draft, sport);
  const updated: BaselineDraft = {
    sport: code,
    calibrationSource: "manual",
    thresholdHrBpm: "",
    maxHrBpm: "",
    restingHrBpm: "",
    ftpWatts: "",
    thresholdSpeedMps: "",
    ...current,
    [metric]: value,
  };
  updated.sport = code;
  updated.calibrationSource = "manual";
  const legacyCode = normalizeSportCode(sport.name || "");
  return {
    ...draft,
    enduranceBaselines: [
      ...draft.enduranceBaselines.filter((item) => item.sport !== code && item.sport !== legacyCode),
      updated,
    ],
  };
}

export function clearBaseline(draft: ProfileDraft, sport: Sport): ProfileDraft {
  const code = sportCode(sport);
  const legacyCode = normalizeSportCode(sport.name || "");
  return {
    ...draft,
    enduranceBaselines: draft.enduranceBaselines.filter(
      (item) => item.sport !== code && item.sport !== legacyCode
    ),
  };
}

export function validateBaseline(draft: ProfileDraft) {
  for (const baseline of draft.enduranceBaselines) {
    for (const metric of baselineMetrics) {
      const raw = baseline[metric.key].trim();
      if (!raw) continue;
      const value = Number(raw);
      if (!Number.isFinite(value) || value < metric.min || value > metric.max ||
        (metric.key !== "thresholdSpeedMps" && !Number.isInteger(value))) {
        return `${metric.label} must be between ${metric.min} and ${metric.max} ${metric.unit}.`;
      }
    }
  }
  return null;
}

export function validateSetupStep(step: number, draft: ProfileDraft, options: ProfileOptionsResponse | null) {
  if (step === 0 && !draft.preferredSportIds.length) return "Add at least one activity.";
  if (step === 1) {
    if (!draft.goals.length) return "Choose a primary goal.";
    for (const selected of draft.goals) {
      const goal = options?.goals?.find((item) => item.id === selected.goalId);
      if (goal?.allowed_sports?.length && !selected.sportId) return "Choose an activity for your goal.";
    }
  }
  if (step === 2) {
    if (!draft.preferredTrainingDays.length) return "Choose at least one training day.";
    if (!(Number(draft.weeklyTimeBudgetHours) > 0)) return "Enter your weekly time budget.";
  }
  if (step === 3) {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    if (!draft.birthDate || draft.birthDate >= today) return "Enter a birth date in the past.";
    if (!draft.activelyTrainingSince || draft.activelyTrainingSince > today) return "Enter a training start date no later than today.";
    if (!(Number(draft.weightKg) > 0)) return "Enter your weight.";
    if (!isValidTimeZone(draft.timezone)) return "Enter a valid IANA timezone.";
  }
  return null;
}

export function validateProfileDraft(draft: ProfileDraft, options: ProfileOptionsResponse | null) {
  for (let step = 0; step < 4; step += 1) {
    const error = validateSetupStep(step, draft, options);
    if (error) return error;
  }
  return validateBaseline(draft);
}

function optionalNumber(value: string) {
  return value.trim() ? Number(value) : undefined;
}

export function toProfileRequest(draft: ProfileDraft): ProfileRequest {
  return {
    birth_date: draft.birthDate,
    actively_training_since: draft.activelyTrainingSince,
    weight_kg: Number(draft.weightKg),
    timezone: draft.timezone,
    weekly_time_budget_hours: Number(draft.weeklyTimeBudgetHours),
    preferred_sport_ids: draft.preferredSportIds,
    preferred_training_days: draft.preferredTrainingDays,
    goal_priorities: draft.goals.map((goal, index) => ({
      goal_id: goal.goalId,
      sport_id: typeof goal.sportId === "number" ? goal.sportId : undefined,
      priority: index + 1,
    })),
    endurance_baselines: draft.enduranceBaselines
      .filter((item) => baselineMetrics.some((metric) => item[metric.key].trim()))
      .map((item) => ({
        sport: item.sport,
        calibration_source: item.calibrationSource,
        threshold_hr_bpm: optionalNumber(item.thresholdHrBpm),
        max_hr_bpm: optionalNumber(item.maxHrBpm),
        resting_hr_bpm: optionalNumber(item.restingHrBpm),
        ftp_watts: optionalNumber(item.ftpWatts),
        threshold_speed_mps: optionalNumber(item.thresholdSpeedMps),
      })),
  };
}
