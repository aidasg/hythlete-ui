import { useEffect, useMemo, useState } from "react";
import { WorkoutCalendarGrid } from "@/features/workouts/components/WorkoutCalendarGrid";
import { WorkoutCreateForm } from "@/features/workouts/components/WorkoutCreateForm";
import { WorkoutDetailPanel } from "@/features/workouts/components/WorkoutDetailPanel";
import { WorkoutLoadStatePanel } from "@/features/workouts/components/WorkoutLoadStatePanel";
import { WorkoutModal } from "@/features/workouts/components/WorkoutModal";
import {
  getWorkout,
  getWorkoutCatalog,
  getWorkoutLoadState,
  listWorkouts,
  type WorkoutCatalogResponse,
  type WorkoutLoadStateResponse,
  type WorkoutResponse,
} from "@/features/workouts/services/workoutApi";
import {
  getCalendarRange,
  getMonthKey,
  getTodayKey,
} from "@/features/workouts/services/workoutDates";

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "error" in error) {
    const apiError = error as { error?: unknown };

    if (typeof apiError.error === "string" && apiError.error.trim()) {
      return apiError.error;
    }
  }

  return fallback;
}

export function WorkoutCalendarView() {
  const today = useMemo(() => getTodayKey(), []);
  const [monthKey, setMonthKey] = useState(() => getMonthKey(today));
  const [selectedDate, setSelectedDate] = useState(today);
  const [catalog, setCatalog] = useState<WorkoutCatalogResponse | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutResponse[]>([]);
  const [loadState, setLoadState] = useState<WorkoutLoadStateResponse[]>([]);
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutResponse | null>(
    null
  );
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<number | null>(null);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [isLoadingWorkouts, setIsLoadingWorkouts] = useState(true);
  const [isLoadingLoadState, setIsLoadingLoadState] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [workoutsError, setWorkoutsError] = useState<string | null>(null);
  const [loadStateError, setLoadStateError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [workoutRefreshKey, setWorkoutRefreshKey] = useState(0);
  const [loadStateRefreshKey, setLoadStateRefreshKey] = useState(0);
  const [activeModal, setActiveModal] = useState<"create" | "detail" | null>(
    null
  );

  const calendarRange = useMemo(() => getCalendarRange(monthKey), [monthKey]);

  useEffect(() => {
    let isActive = true;

    setIsLoadingCatalog(true);
    setCatalogError(null);

    getWorkoutCatalog()
      .then((result) => {
        if (!isActive) {
          return;
        }

        if (result.error) {
          setCatalogError(
            getErrorMessage(result.error, "Could not load workout catalog.")
          );
          return;
        }

        setCatalog(result.data);
      })
      .catch(() => {
        if (isActive) {
          setCatalogError("Could not reach the workout catalog.");
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingCatalog(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    setIsLoadingWorkouts(true);
    setWorkoutsError(null);

    listWorkouts(calendarRange)
      .then((result) => {
        if (!isActive) {
          return;
        }

        if (result.error) {
          setWorkoutsError(
            getErrorMessage(result.error, "Could not load workouts.")
          );
          return;
        }

        setWorkouts(result.data);
      })
      .catch(() => {
        if (isActive) {
          setWorkoutsError("Could not reach the workout service.");
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingWorkouts(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [calendarRange, workoutRefreshKey]);

  useEffect(() => {
    let isActive = true;

    setIsLoadingLoadState(true);
    setLoadStateError(null);

    getWorkoutLoadState(selectedDate)
      .then((result) => {
        if (!isActive) {
          return;
        }

        if (result.error) {
          setLoadStateError(
            getErrorMessage(result.error, "Could not load readiness state.")
          );
          return;
        }

        setLoadState(result.data);
      })
      .catch(() => {
        if (isActive) {
          setLoadStateError("Could not reach the load-state service.");
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingLoadState(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [selectedDate, loadStateRefreshKey]);

  useEffect(() => {
    if (!selectedWorkoutId || activeModal !== "detail") {
      setIsLoadingDetail(false);
      return;
    }

    let isActive = true;

    setIsLoadingDetail(true);
    setDetailError(null);

    getWorkout(selectedWorkoutId)
      .then((result) => {
        if (!isActive) {
          return;
        }

        if (result.error) {
          setDetailError(
            getErrorMessage(result.error, "Could not load workout detail.")
          );
          return;
        }

        setSelectedWorkout(result.data);
      })
      .catch(() => {
        if (isActive) {
          setDetailError("Could not reach the workout detail service.");
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingDetail(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [activeModal, selectedWorkoutId]);

  function handleDateSelect(date: string) {
    setSelectedDate(date);
  }

  function handleWorkoutSelect(workout: WorkoutResponse) {
    const workoutDate = workout.date || selectedDate;

    setSelectedDate(workoutDate);
    setSelectedWorkout(workout);
    setSelectedWorkoutId(workout.id ?? null);
    setIsLoadingDetail(Boolean(workout.id));
    setDetailError(null);
    setActiveModal("detail");
  }

  function handleCreateWorkout(date: string) {
    setSelectedDate(date);
    setMonthKey(getMonthKey(date));
    setActiveModal("create");
  }

  function handleModalClose() {
    setActiveModal(null);
    setIsLoadingDetail(false);
  }

  function handleWorkoutCreated(workout: WorkoutResponse) {
    const workoutDate = workout.date || selectedDate;

    setSelectedDate(workoutDate);
    setMonthKey(getMonthKey(workoutDate));
    setSelectedWorkout(workout);
    setSelectedWorkoutId(workout.id ?? null);
    setWorkoutRefreshKey((current) => current + 1);
    setLoadStateRefreshKey((current) => current + 1);
    setActiveModal("detail");
  }

  return (
    <section className="workouts-page-panel" aria-label="Workout planning">
      <div className="workouts-main-grid">
        <div className="workouts-calendar-stack">
          {catalogError && !isLoadingCatalog && (
            <p className="form-message form-message-error" role="alert">
              {catalogError}
            </p>
          )}

          {workoutsError && (
            <p className="form-message form-message-error" role="alert">
              {workoutsError}
            </p>
          )}

          <WorkoutCalendarGrid
            monthKey={monthKey}
            selectedDate={selectedDate}
            workouts={workouts}
            isLoading={isLoadingWorkouts}
            onDateSelect={handleDateSelect}
            onCreateWorkout={handleCreateWorkout}
            onMonthChange={setMonthKey}
            onWorkoutSelect={handleWorkoutSelect}
          />
        </div>

        <WorkoutLoadStatePanel
          date={selectedDate}
          loadState={loadState}
          isLoading={isLoadingLoadState}
          errorMessage={loadStateError}
        />
      </div>

      {activeModal === "detail" && (
        <WorkoutModal
          eyebrow="Workout detail"
          title={selectedWorkout?.title || "Workout"}
          onClose={handleModalClose}
        >
          <WorkoutDetailPanel
            workout={selectedWorkout}
            isLoading={isLoadingDetail}
            errorMessage={detailError}
            showHeader={false}
          />
        </WorkoutModal>
      )}

      {activeModal === "create" && (
        <WorkoutModal
          eyebrow="New workout"
          title="Manual entry"
          onClose={handleModalClose}
        >
          <WorkoutCreateForm
            catalog={catalog}
            selectedDate={selectedDate}
            onCreated={handleWorkoutCreated}
            showHeader={false}
          />
        </WorkoutModal>
      )}
    </section>
  );
}
