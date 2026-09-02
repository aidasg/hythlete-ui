import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getWorkoutReadiness,
  listWorkouts,
  type ReadinessResponse,
  type TrainingOptionResponse,
  type WorkoutResponse,
} from "@/features/workouts/services/workoutApi";
import {
  formatDateKey,
  getTodayKey,
  parseDateKey,
} from "@/features/workouts/services/workoutDates";

type TodayOverviewData = {
  readiness: ReadinessResponse | null;
  workouts: WorkoutResponse[];
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "error" in error) {
    const apiError = error as { error?: unknown };

    if (typeof apiError.error === "string" && apiError.error.trim()) {
      return apiError.error;
    }
  }

  return fallback;
}

function getRangeEnd(dateKey: string) {
  const date = parseDateKey(dateKey);

  return formatDateKey(
    new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7)
  );
}

function rankTrainingOptions(options: TrainingOptionResponse[] | undefined) {
  return [...(options || [])].sort(
    (left, right) => (right.score || 0) - (left.score || 0)
  );
}

export function useTodayOverview() {
  const today = useMemo(() => getTodayKey(), []);
  const [data, setData] = useState<TodayOverviewData>({
    readiness: null,
    workouts: [],
  });
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    setErrorMessage(null);

    try {
      const [workoutsResult, readinessResult] = await Promise.all([
        listWorkouts({ from: today, to: getRangeEnd(today) }),
        getWorkoutReadiness(today),
      ]);
      const errors: string[] = [];

      if (workoutsResult.error) {
        errors.push(
          getErrorMessage(workoutsResult.error, "Could not load upcoming workouts.")
        );
      }

      if (readinessResult.error) {
        errors.push(
          getErrorMessage(readinessResult.error, "Could not load today's readiness.")
        );
      }

      setData((current) => ({
        workouts: workoutsResult.error ? current.workouts : workoutsResult.data,
        readiness: readinessResult.error
          ? current.readiness
          : readinessResult.data,
      }));
      setErrorMessage(errors.length ? errors.join(" ") : null);
    } catch {
      setErrorMessage("Could not reach the training services. Try again.");
    } finally {
      setHasLoaded(true);
      setIsRefreshing(false);
    }
  }, [today]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const todayWorkout = useMemo(() => {
    const todayWorkouts = data.workouts.filter((workout) => workout.date === today);

    return (
      todayWorkouts.find((workout) => !workout.completed) || todayWorkouts[0] || null
    );
  }, [data.workouts, today]);
  const upcomingWorkouts = useMemo(
    () =>
      data.workouts
        .filter((workout) => workout.date && workout.date > today)
        .sort((left, right) => (left.date || "").localeCompare(right.date || ""))
        .slice(0, 3),
    [data.workouts, today]
  );
  const topTrainingOption = useMemo(
    () => rankTrainingOptions(data.readiness?.training_options)[0] || null,
    [data.readiness?.training_options]
  );

  return {
    today,
    readiness: data.readiness,
    todayWorkout,
    upcomingWorkouts,
    topTrainingOption,
    errorMessage,
    isLoading: !hasLoaded,
    isRefreshing,
    refresh,
  };
}

