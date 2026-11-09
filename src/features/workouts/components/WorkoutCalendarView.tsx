import { getApiErrorMessage } from "@/services/api/errors";
import { getApiErrorMessage as getErrorMessage } from "@/services/api/errors";
import { CoachTrigger } from "@/features/coach/components/CoachTrigger";
import type { FitPowerTargetUnit } from "../services/workoutApi";
import { useCoachPageContext } from "@/features/coach/context/coachContext";
import { X } from "lucide-react";
import { useMediaQuery } from "../hooks/useCalendarLayout";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarReadinessEditor } from "@/features/workouts/components/CalendarReadinessEditor";
import { WorkoutCalendarGrid } from "@/features/workouts/components/WorkoutCalendarGrid";
import { WorkoutCreateForm } from "@/features/workouts/components/WorkoutCreateForm";
import { WorkoutDeleteConfirmationModal } from "@/features/workouts/components/WorkoutDeleteConfirmationModal";
import { WorkoutDetailPanel } from "@/features/workouts/components/WorkoutDetailPanel";
import { WorkoutFitImportForm } from "@/features/workouts/components/WorkoutFitImportForm";
import { WorkoutLoadStatePanel } from "@/features/workouts/components/WorkoutLoadStatePanel";
import { WorkoutModal } from "@/features/workouts/components/WorkoutModal";
import { WorkoutRecommendationPreview } from "@/features/workouts/components/WorkoutRecommendationPreview";
import {
  listCalendarReadinessEntries,
  saveCalendarReadinessEntries,
  type CalendarReadinessEntryRequest,
  type CalendarReadinessEntryResponse,
} from "@/features/workouts/services/calendarReadinessApi";
import {
  getCalendarReadinessEntryKey,
  isActiveCalendarReadinessEntry,
} from "@/features/workouts/services/calendarReadiness";
import {
  deleteWorkout,
  reanalyseWorkout,
  getWorkout,
  getWorkoutCatalog,
  getWorkoutReadiness,
  listWorkouts,
  prescribeWorkouts,
  type ReadinessResponse,
  type TrainingOptionResponse,
  type WorkoutCatalogResponse,
  type WorkoutPrescriptionResponse,
  type WorkoutResponse,
} from "@/features/workouts/services/workoutApi";
import {
  getCalendarRange,
  getMonthKey,
  getTodayKey,
} from "@/features/workouts/services/workoutDates";
import { invalidateWorkoutDerivedData } from "@/services/query/invalidation";
import { queryKeys } from "@/services/query/queryKeys";



export function WorkoutCalendarView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [readinessOpen, setReadinessOpen] = useState(false);
  const wideScreen = useMediaQuery("(min-width: 1281px)");
  const today = useMemo(() => getTodayKey(), []);
  const [monthKey, setMonthKey] = useState(() => getMonthKey(today));
  const [selectedDate, setSelectedDate] = useState(today);
  useCoachPageContext({surface:"calendar",date:selectedDate});
  const [catalog, setCatalog] = useState<WorkoutCatalogResponse | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutResponse[]>([]);
  const [calendarReadinessEntries, setCalendarReadinessEntries] = useState<
    CalendarReadinessEntryResponse[]
  >([]);
  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null);
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutResponse | null>(
    null
  );
  const [selectedTrainingOption, setSelectedTrainingOption] =
    useState<TrainingOptionResponse | null>(null);
  const [prescription, setPrescription] =
    useState<WorkoutPrescriptionResponse | null>(null);
  const [selectedDraftIndex, setSelectedDraftIndex] = useState(0);
  const [workoutPendingDeletion, setWorkoutPendingDeletion] =
    useState<WorkoutResponse | null>(null);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<number | null>(null);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [isLoadingWorkouts, setIsLoadingWorkouts] = useState(true);
  const [isLoadingCalendarReadiness, setIsLoadingCalendarReadiness] =
    useState(false);
  const [isLoadingReadiness, setIsLoadingReadiness] = useState(false);
  const reanalysisInFlight = useRef(false);
  const [reanalysingWorkoutId, setReanalysingWorkoutId] = useState<number | null>(null);
  const [reanalysisError, setReanalysisError] = useState<{ workoutId: number; message: string } | null>(null);
  const [reanalysedWorkoutId, setReanalysedWorkoutId] = useState<number | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isLoadingPrescription, setIsLoadingPrescription] = useState(false);
  const [isSavingCalendarReadiness, setIsSavingCalendarReadiness] =
    useState(false);
  const [deletingWorkoutId, setDeletingWorkoutId] = useState<number | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [workoutsError, setWorkoutsError] = useState<string | null>(null);
  const [calendarReadinessError, setCalendarReadinessError] = useState<
    string | null
  >(null);
  const [calendarReadinessSaveError, setCalendarReadinessSaveError] = useState<
    string | null
  >(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [readinessError, setReadinessError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [prescriptionError, setPrescriptionError] = useState<string | null>(null);
  const [workoutRefreshKey, setWorkoutRefreshKey] = useState(0);
  const [calendarReadinessRefreshKey, setCalendarReadinessRefreshKey] =
    useState(0);
  const [readinessRefreshKey, setReadinessRefreshKey] = useState(0);
  const [isImportingFit, setIsImportingFit] = useState(false);
  const [activeModal, setActiveModal] = useState<
    "create" | "detail" | "edit" | "fit-import" | "readiness" | null
  >(null);

  const calendarRange = useMemo(() => getCalendarRange(monthKey), [monthKey]);
  const readinessEntriesByDate = useMemo(
    () =>
      calendarReadinessEntries.reduce<
        Record<string, CalendarReadinessEntryResponse[]>
      >((groupedEntries, entry) => {
        if (!entry.date || !isActiveCalendarReadinessEntry(entry)) {
          return groupedEntries;
        }

        groupedEntries[entry.date] = [...(groupedEntries[entry.date] || []), entry];

        return groupedEntries;
      }, {}),
    [calendarReadinessEntries]
  );

  useEffect(() => {
    const linkedWorkoutId = Number(searchParams.get("workout"));
    if (linkedWorkoutId > 0) {
      setSelectedWorkoutId(linkedWorkoutId);
      setSelectedWorkout(null);
      setActiveModal("detail");
    }
  }, [searchParams]);

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
      .catch((requestError) => {
        if (isActive) {
          setCatalogError(getApiErrorMessage(requestError));
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
      .catch((requestError) => {
        if (isActive) {
          setWorkoutsError(getApiErrorMessage(requestError));
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

    setIsLoadingCalendarReadiness(true);
    setCalendarReadinessError(null);

    listCalendarReadinessEntries(calendarRange)
      .then((result) => {
        if (!isActive) {
          return;
        }

        if (result.error) {
          setCalendarReadinessError(
            getErrorMessage(
              result.error,
              "Could not load calendar readiness entries."
            )
          );
          return;
        }

        setCalendarReadinessEntries(result.data.entries || []);
      })
      .catch((requestError) => {
        if (isActive) {
          setCalendarReadinessError(getApiErrorMessage(requestError));
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingCalendarReadiness(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [calendarRange, calendarReadinessRefreshKey]);

  useEffect(() => {
    if (!readinessOpen) return;
    let isActive = true;
    setReadiness(null);
    setIsLoadingReadiness(true);
    setReadinessError(null);

    getWorkoutReadiness(selectedDate)
      .then((result) => {
        if (!isActive) {
          return;
        }

        if (result.error) {
          setReadinessError(
            getErrorMessage(result.error, "Could not load workout readiness.")
          );
          return;
        }

        setReadiness(result.data);
      })
      .catch((requestError) => {
        if (isActive) {
          setReadinessError(getApiErrorMessage(requestError));
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingReadiness(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [selectedDate, readinessRefreshKey, readinessOpen]);

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
      .catch((requestError) => {
        if (isActive) {
          setDetailError(getApiErrorMessage(requestError));
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
    setReanalysisError(null);
    setReanalysedWorkoutId(null);
    if (!wideScreen) setReadinessOpen(false);
    const workoutDate = workout.date || selectedDate;

    setSelectedDate(workoutDate);
    setSelectedWorkout(workout);
    setSelectedWorkoutId(workout.id ?? null);
    setIsLoadingDetail(Boolean(workout.id));
    setDetailError(null);
    setActiveModal("detail");
  }

  function handleCreateWorkout(date: string) {
    if (!wideScreen) setReadinessOpen(false);
    setSelectedDate(date);
    setMonthKey(getMonthKey(date));
    setSelectedTrainingOption(null);
    setPrescription(null);
    setPrescriptionError(null);
    setIsLoadingPrescription(false);
    setSelectedDraftIndex(0);
    setActiveModal("create");
  }

  function handleCreateReadinessEntry(date: string) {
    if (!wideScreen) setReadinessOpen(false);
    setSelectedDate(date);
    setMonthKey(getMonthKey(date));
    setCalendarReadinessSaveError(null);
    setActiveModal("readiness");
  }

  function handleImportFit() {
    if (!wideScreen) setReadinessOpen(false);
    setActiveModal("fit-import");
  }

  function handleModalClose() {
    setActiveModal(null);
    setIsLoadingDetail(false);
    setIsLoadingPrescription(false);
    setCalendarReadinessSaveError(null);
    if (searchParams.has("workout")) {
      const next = new URLSearchParams(searchParams);
      next.delete("workout");
      setSearchParams(next, { replace: true });
    }
  }

  function handleWorkoutEdit(workout: WorkoutResponse) {
    if (!wideScreen) setReadinessOpen(false);
    setSelectedWorkout(workout);
    setSelectedWorkoutId(workout.id ?? null);
    setActiveModal("edit");
  }

  function getTrainingOptionKey(option: TrainingOptionResponse) {
    return option.key || [option.focus, option.sport].filter(Boolean).join(":");
  }

  function requestPrescription(option: TrainingOptionResponse) {
    if (!wideScreen) setReadinessOpen(false);
    const optionKey = getTrainingOptionKey(option);

    setSelectedTrainingOption(option);
    setPrescription(null);
    setPrescriptionError(null);
    setIsLoadingPrescription(true);
    setSelectedDraftIndex(0);
    setActiveModal("create");

    prescribeWorkouts({
      date: selectedDate,
      option_key: optionKey || undefined,
      focus: option.focus,
      sport: option.sport,
      category: option.category,
      max_duration_minutes: 45,
      count: 1,
    })
      .then((result) => {
        if (result.error) {
          setPrescriptionError(
            getErrorMessage(result.error, "Could not build a suggested workout.")
          );
          return;
        }

        setPrescription(result.data);
        setSelectedDraftIndex(0);
      })
      .catch((requestError) => {
        setPrescriptionError(getApiErrorMessage(requestError));
      })
      .finally(() => {
        setIsLoadingPrescription(false);
      });
  }

  function handleTrainingOptionSelect(option: TrainingOptionResponse) {
    requestPrescription(option);
  }

  function handleRegeneratePrescription() {
    if (selectedTrainingOption) {
      requestPrescription(selectedTrainingOption);
    }
  }

  async function handleWorkoutReanalyse(workout: WorkoutResponse, powerTargetUnit?: FitPowerTargetUnit, useStrydPower?: boolean) {
    if (!workout.id || reanalysisInFlight.current) return false;
    reanalysisInFlight.current = true;
    setReanalysingWorkoutId(workout.id);
    setReanalysisError(null);
    setReanalysedWorkoutId(null);
    try {
      const result = powerTargetUnit || useStrydPower !== undefined ? await reanalyseWorkout(workout.id, powerTargetUnit, useStrydPower) : await reanalyseWorkout(workout.id);
      if (result.error) {
        setReanalysisError({ workoutId: workout.id, message: getErrorMessage(result.error, "Could not reanalyse activity. Try again.") });
        return false;
      }
      setSelectedWorkout((current) => current?.id === workout.id ? result.data : current);
      setWorkouts((current) => current.map((item) => item.id === workout.id ? result.data : item));
      setWorkoutRefreshKey((current) => current + 1);
      setReadinessRefreshKey((current) => current + 1);
      setReanalysedWorkoutId(workout.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.strategy.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.progress.all }),
      ]);
      return true;
    } catch (requestError) {
      setReanalysisError({ workoutId: workout.id, message: getApiErrorMessage(requestError) });
      return false;
    } finally {
      reanalysisInFlight.current = false;
      setReanalysingWorkoutId(null);
    }
  }

  function handleWorkoutCreated(workout: WorkoutResponse) {
    const workoutDate = workout.date || selectedDate;

    setSelectedDate(workoutDate);
    setMonthKey(getMonthKey(workoutDate));
    setSelectedWorkout(workout);
    setSelectedWorkoutId(workout.id ?? null);
    setWorkoutRefreshKey((current) => current + 1);
    setReadinessRefreshKey((current) => current + 1);
    setActiveModal("detail");
    void invalidateWorkoutDerivedData(queryClient);
  }

  function handleActivitiesImported(activities: WorkoutResponse[]) {
    setWorkouts(current => {
      const updated = new Map(current.map(workout => [workout.id, workout]));
      activities.forEach(workout => updated.set(workout.id, workout));
      return [...updated.values()];
    });
    setWorkoutRefreshKey(current => current + 1);
    setReadinessRefreshKey(current => current + 1);
    void invalidateWorkoutDerivedData(queryClient);
  }

  async function handleCalendarReadinessSaved(
    entries: CalendarReadinessEntryRequest[]
  ) {
    setIsSavingCalendarReadiness(true);
    setCalendarReadinessSaveError(null);
    setCalendarReadinessError(null);

    try {
      const result = await saveCalendarReadinessEntries({
        entries,
      });

      if (result.error) {
        const message = getErrorMessage(
          result.error,
          "Could not save calendar readiness entries."
        );

        setCalendarReadinessSaveError(message);
        throw new Error(message);
      }

      const changedEntryKeys = new Set(entries.map(getCalendarReadinessEntryKey));
      const savedEntries = (result.data.entries || []).filter(
        isActiveCalendarReadinessEntry
      );

      setCalendarReadinessEntries((currentEntries) => [
        ...currentEntries.filter(
          (currentEntry) =>
            !changedEntryKeys.has(getCalendarReadinessEntryKey(currentEntry))
        ),
        ...savedEntries,
      ]);
      await invalidateWorkoutDerivedData(queryClient);
      setCalendarReadinessRefreshKey((current) => current + 1);
      setReadinessRefreshKey((current) => current + 1);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not reach the calendar readiness service.";

      setCalendarReadinessSaveError(message);
      throw new Error(message);
    } finally {
      setIsSavingCalendarReadiness(false);
    }
  }

  function handleWorkoutDelete(workout: WorkoutResponse) {
    if (!workout.id) {
      setWorkoutsError("That workout cannot be deleted because it has no id.");
      return;
    }

    setDeleteError(null);
    setWorkoutPendingDeletion(workout);
  }

  function handleDeleteCancel() {
    if (deletingWorkoutId) {
      return;
    }

    setDeleteError(null);
    setWorkoutPendingDeletion(null);
  }

  async function handleDeleteConfirm() {
    const workoutId = workoutPendingDeletion?.id;

    if (!workoutPendingDeletion || typeof workoutId !== "number") {
      setDeleteError("That workout cannot be deleted because it has no id.");
      return;
    }

    const deletingFromDetail =
      activeModal === "detail" && selectedWorkoutId === workoutId;

    setDeletingWorkoutId(workoutId);
    setDeleteError(null);
    setWorkoutsError(null);
    setDetailError(null);

    try {
      const result = await deleteWorkout(workoutId);

      if (result.error) {
        const message = getErrorMessage(result.error, "Could not delete workout.");

        setDeleteError(message);
        return;
      }

      setWorkouts((currentWorkouts) =>
        currentWorkouts.filter((currentWorkout) => currentWorkout.id !== workoutId)
      );

      if (selectedWorkoutId === workoutId) {
        setSelectedWorkout(null);
        setSelectedWorkoutId(null);
      }

      setWorkoutRefreshKey((current) => current + 1);
      setReadinessRefreshKey((current) => current + 1);
      setWorkoutPendingDeletion(null);
      await invalidateWorkoutDerivedData(queryClient);

      if (deletingFromDetail) {
        setActiveModal(null);
      }
    } catch (requestError) {
      setDeleteError(getApiErrorMessage(requestError));
    } finally {
      setDeletingWorkoutId(null);
    }
  }

  return (
    <section className="workouts-page-panel" aria-label="Workout planning">
      <div className={`workouts-main-grid adaptive-workouts-layout${readinessOpen && wideScreen ? " has-readiness" : ""}`}>
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

          {calendarReadinessError && !isLoadingCalendarReadiness && (
            <p className="form-message form-message-error" role="alert">
              {calendarReadinessError}
            </p>
          )}

          <CoachTrigger label="Plan with Coach" intent={{action:"plan_next_workout",target:{surface:"calendar",date:selectedDate}}} />
        <WorkoutCalendarGrid
            activities={catalog?.activities}
            monthKey={monthKey}
            selectedDate={selectedDate}
            workouts={workouts}
            readinessEntriesByDate={readinessEntriesByDate}
            isLoading={isLoadingWorkouts || isLoadingCalendarReadiness}
            onDateSelect={handleDateSelect}
            onCreateWorkout={handleCreateWorkout}
            onCreateReadinessEntry={handleCreateReadinessEntry}
            onImportFit={handleImportFit}
            onMonthChange={setMonthKey}
            onWorkoutSelect={handleWorkoutSelect}
            deletingWorkoutId={deletingWorkoutId}
            readinessOpen={readinessOpen}
            onReadinessToggle={() => setReadinessOpen(open => !open)}
          />
        </div>

        {readinessOpen && wideScreen && <aside id="calendar-readiness-view" className="workouts-side-stack calendar-readiness-sidebar" aria-label="Readiness">
          <button type="button" className="icon-button readiness-close" aria-label="Close readiness" onClick={() => setReadinessOpen(false)}><X size={18}/></button>
          <WorkoutLoadStatePanel
            date={selectedDate}
            readiness={readiness}
            isLoading={isLoadingReadiness}
            errorMessage={readinessError}
            selectedOptionKey={
              selectedTrainingOption ? getTrainingOptionKey(selectedTrainingOption) : null
            }
            onTrainingOptionSelect={handleTrainingOptionSelect}
          />
        </aside>}

      </div>

      {readinessOpen && !wideScreen && !activeModal && <WorkoutModal title="Readiness" eyebrow="Selected day" variant="drawer" onClose={() => setReadinessOpen(false)}><div id="calendar-readiness-view">
          <WorkoutLoadStatePanel
            date={selectedDate}
            readiness={readiness}
            isLoading={isLoadingReadiness}
            errorMessage={readinessError}
            selectedOptionKey={
              selectedTrainingOption ? getTrainingOptionKey(selectedTrainingOption) : null
            }
            onTrainingOptionSelect={handleTrainingOptionSelect}
          />
      </div></WorkoutModal>}

      {activeModal === "detail" && (
        <WorkoutModal
          eyebrow="Calendar"
          title="Workout detail"
          onClose={handleModalClose}
        >
          <WorkoutDetailPanel
            activities={catalog?.activities}
            workout={selectedWorkout}
            isLoading={isLoadingDetail}
            errorMessage={detailError}
            showHeader={false}
            isDeleting={
              Boolean(selectedWorkout?.id) && selectedWorkout?.id === deletingWorkoutId
            }
            onDelete={handleWorkoutDelete}
            onEdit={handleWorkoutEdit}
            onReanalyse={handleWorkoutReanalyse}
            isReanalysing={reanalysingWorkoutId !== null && selectedWorkout?.id === reanalysingWorkoutId}
            reanalysisError={reanalysisError?.workoutId === selectedWorkout?.id ? reanalysisError?.message : null}
            reanalysisSuccess={reanalysedWorkoutId !== null && selectedWorkout?.id === reanalysedWorkoutId}
          />
        </WorkoutModal>
      )}

      {activeModal === "edit" && selectedWorkout && (
        <WorkoutModal
          eyebrow={selectedWorkout.completed ? "Training record" : "Planned workout"}
          title={selectedWorkout.completed ? "Edit workout" : "Edit or complete workout"}
          onClose={handleModalClose}
        >
          <WorkoutCreateForm
            catalog={catalog}
            selectedDate={selectedWorkout.date || selectedDate}
            initialWorkout={selectedWorkout}
            initialWorkoutKey={`edit-${selectedWorkout.id}`}
            workoutId={selectedWorkout.id}
            onCreated={handleWorkoutCreated}
            showHeader={false}
            submitLabel={selectedWorkout.completed ? "Update workout" : "Save workout"}
          />
        </WorkoutModal>
      )}

      {activeModal === "create" && (
        <WorkoutModal
          eyebrow={selectedTrainingOption ? "Suggested workout" : "New workout"}
          title={
            selectedTrainingOption
              ? selectedTrainingOption.focus ||
                selectedTrainingOption.category ||
                selectedTrainingOption.sport ||
                "Training option"
              : "Manual entry"
          }
          onClose={handleModalClose}
        >
          {selectedTrainingOption && (
            <WorkoutRecommendationPreview
              option={selectedTrainingOption}
              date={selectedDate}
              prescription={prescription}
              selectedDraftIndex={selectedDraftIndex}
              catalog={catalog}
              isLoading={isLoadingPrescription}
              errorMessage={prescriptionError}
              onDraftSelect={setSelectedDraftIndex}
              onRetry={handleRegeneratePrescription}
              onCreated={handleWorkoutCreated}
            />
          )}

          {!selectedTrainingOption && (
            <WorkoutCreateForm
              catalog={catalog}
              selectedDate={selectedDate}
              onCreated={handleWorkoutCreated}
              showHeader={false}
            />
          )}
        </WorkoutModal>
      )}

      {activeModal === "fit-import" && (
        <WorkoutModal
          eyebrow="Workout import"
          title="Import activities"
          onClose={handleModalClose}
          dismissDisabled={isImportingFit}
        >
          <WorkoutFitImportForm catalog={catalog} onImported={handleActivitiesImported} onBusyChange={setIsImportingFit} />
        </WorkoutModal>
      )}

      {activeModal === "readiness" && (
        <WorkoutModal
          eyebrow="Calendar readiness"
          title="Limiter / Injury"
          onClose={handleModalClose}
        >
          <CalendarReadinessEditor
            date={selectedDate}
            catalog={catalog}
            entries={readinessEntriesByDate[selectedDate] || []}
            isSaving={isSavingCalendarReadiness}
            errorMessage={calendarReadinessSaveError}
            onSave={handleCalendarReadinessSaved}
          />
        </WorkoutModal>
      )}

      {workoutPendingDeletion && (
        <WorkoutDeleteConfirmationModal
          workout={workoutPendingDeletion}
          isDeleting={workoutPendingDeletion.id === deletingWorkoutId}
          errorMessage={deleteError}
          onCancel={handleDeleteCancel}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </section>
  );
}
