import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { CalendarReadinessEditor } from "@/features/workouts/components/CalendarReadinessEditor";
import { WorkoutCalendarGrid } from "@/features/workouts/components/WorkoutCalendarGrid";
import { WorkoutCreateForm } from "@/features/workouts/components/WorkoutCreateForm";
import { WorkoutDeleteConfirmationModal } from "@/features/workouts/components/WorkoutDeleteConfirmationModal";
import { WorkoutDetailPanel } from "@/features/workouts/components/WorkoutDetailPanel";
import { WorkoutFitImportForm } from "@/features/workouts/components/WorkoutFitImportForm";
import { WorkoutLoadStatePanel } from "@/features/workouts/components/WorkoutLoadStatePanel";
import { WorkoutModal } from "@/features/workouts/components/WorkoutModal";
import { StrengthProfilePanel } from "@/features/workouts/components/StrengthProfilePanel";
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
  listStrengthProfiles,
  getWorkout,
  getWorkoutCatalog,
  getWorkoutReadiness,
  listWorkouts,
  prescribeWorkouts,
  type ExerciseStrengthProfileResponse,
  type ReadinessResponse,
  type TrainingOptionResponse,
  type WorkoutCatalogResponse,
  type WorkoutDraftResponse,
  type WorkoutPrescriptionResponse,
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

function getDraftKey(draft: WorkoutDraftResponse | undefined, index: number) {
  return `${draft?.key || draft?.title || "draft"}-${index}`;
}

function getSuggestionTitle(option: TrainingOptionResponse | null) {
  return option?.focus || option?.category || option?.sport || "Training option";
}

export function WorkoutCalendarView() {
  const today = useMemo(() => getTodayKey(), []);
  const [monthKey, setMonthKey] = useState(() => getMonthKey(today));
  const [selectedDate, setSelectedDate] = useState(today);
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
  const [strengthProfiles, setStrengthProfiles] = useState<
    ExerciseStrengthProfileResponse[]
  >([]);
  const [workoutPendingDeletion, setWorkoutPendingDeletion] =
    useState<WorkoutResponse | null>(null);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<number | null>(null);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [isLoadingWorkouts, setIsLoadingWorkouts] = useState(true);
  const [isLoadingCalendarReadiness, setIsLoadingCalendarReadiness] =
    useState(false);
  const [isLoadingReadiness, setIsLoadingReadiness] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isLoadingPrescription, setIsLoadingPrescription] = useState(false);
  const [isLoadingStrengthProfiles, setIsLoadingStrengthProfiles] = useState(false);
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
  const [strengthProfileError, setStrengthProfileError] = useState<string | null>(
    null
  );
  const [workoutRefreshKey, setWorkoutRefreshKey] = useState(0);
  const [calendarReadinessRefreshKey, setCalendarReadinessRefreshKey] =
    useState(0);
  const [readinessRefreshKey, setReadinessRefreshKey] = useState(0);
  const [strengthProfileRefreshKey, setStrengthProfileRefreshKey] = useState(0);
  const [activeModal, setActiveModal] = useState<
    "create" | "detail" | "fit-import" | "readiness" | null
  >(null);

  const calendarRange = useMemo(() => getCalendarRange(monthKey), [monthKey]);
  const suggestedDrafts = prescription?.workouts || [];
  const selectedSuggestedDraft =
    suggestedDrafts[selectedDraftIndex] || suggestedDrafts[0];
  const selectedSuggestedDraftKey = getDraftKey(
    selectedSuggestedDraft,
    selectedDraftIndex
  );
  const suggestionWarnings = [
    ...(prescription?.warnings || []),
    ...(selectedSuggestedDraft?.warnings || []),
  ];
  const suggestionReasons = [
    ...(prescription?.reasons || []),
    ...(selectedSuggestedDraft?.reasons || []),
  ];
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
      .catch(() => {
        if (isActive) {
          setCalendarReadinessError(
            "Could not reach the calendar readiness service."
          );
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
    let isActive = true;

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
      .catch(() => {
        if (isActive) {
          setReadinessError("Could not reach the readiness service.");
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
  }, [selectedDate, readinessRefreshKey]);

  useEffect(() => {
    let isActive = true;

    setIsLoadingStrengthProfiles(true);
    setStrengthProfileError(null);

    listStrengthProfiles()
      .then((result) => {
        if (!isActive) {
          return;
        }

        if (result.error) {
          setStrengthProfileError(
            getErrorMessage(result.error, "Could not load strength profiles.")
          );
          return;
        }

        setStrengthProfiles(result.data);
      })
      .catch(() => {
        if (isActive) {
          setStrengthProfileError("Could not reach the strength profile service.");
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingStrengthProfiles(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [strengthProfileRefreshKey]);

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
    setSelectedTrainingOption(null);
    setPrescription(null);
    setPrescriptionError(null);
    setIsLoadingPrescription(false);
    setSelectedDraftIndex(0);
    setActiveModal("create");
  }

  function handleCreateReadinessEntry(date: string) {
    setSelectedDate(date);
    setMonthKey(getMonthKey(date));
    setCalendarReadinessSaveError(null);
    setActiveModal("readiness");
  }

  function handleImportFit() {
    setActiveModal("fit-import");
  }

  function handleModalClose() {
    setActiveModal(null);
    setIsLoadingDetail(false);
    setIsLoadingPrescription(false);
    setCalendarReadinessSaveError(null);
  }

  function getTrainingOptionKey(option: TrainingOptionResponse) {
    return option.key || [option.focus, option.sport].filter(Boolean).join(":");
  }

  function requestPrescription(option: TrainingOptionResponse) {
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
      .catch(() => {
        setPrescriptionError("Could not reach the workout prescription service.");
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

  function handleWorkoutCreated(workout: WorkoutResponse) {
    const workoutDate = workout.date || selectedDate;

    setSelectedDate(workoutDate);
    setMonthKey(getMonthKey(workoutDate));
    setSelectedWorkout(workout);
    setSelectedWorkoutId(workout.id ?? null);
    setWorkoutRefreshKey((current) => current + 1);
    setReadinessRefreshKey((current) => current + 1);
    setStrengthProfileRefreshKey((current) => current + 1);
    setActiveModal("detail");
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
      setStrengthProfileRefreshKey((current) => current + 1);
      setWorkoutPendingDeletion(null);

      if (deletingFromDetail) {
        setActiveModal(null);
      }
    } catch {
      setDeleteError("Could not reach the workout delete service.");
    } finally {
      setDeletingWorkoutId(null);
    }
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

          {calendarReadinessError && !isLoadingCalendarReadiness && (
            <p className="form-message form-message-error" role="alert">
              {calendarReadinessError}
            </p>
          )}

          <WorkoutCalendarGrid
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
            onWorkoutDelete={handleWorkoutDelete}
            onWorkoutSelect={handleWorkoutSelect}
            deletingWorkoutId={deletingWorkoutId}
          />
        </div>

        <div className="workouts-side-stack">
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

          <StrengthProfilePanel
            profiles={strengthProfiles}
            isLoading={isLoadingStrengthProfiles}
            errorMessage={strengthProfileError}
          />
        </div>
      </div>

      {activeModal === "detail" && (
        <WorkoutModal
          eyebrow="Calendar"
          title="Workout detail"
          onClose={handleModalClose}
        >
          <WorkoutDetailPanel
            workout={selectedWorkout}
            isLoading={isLoadingDetail}
            errorMessage={detailError}
            showHeader={false}
            isDeleting={
              Boolean(selectedWorkout?.id) && selectedWorkout?.id === deletingWorkoutId
            }
            onDelete={handleWorkoutDelete}
          />
        </WorkoutModal>
      )}

      {activeModal === "create" && (
        <WorkoutModal
          eyebrow={selectedTrainingOption ? "Suggested workout" : "New workout"}
          title={
            selectedTrainingOption
              ? getSuggestionTitle(selectedTrainingOption)
              : "Manual entry"
          }
          onClose={handleModalClose}
        >
          {selectedTrainingOption && isLoadingPrescription && (
            <div className="suggested-draft-loader">
              <Loader2 className="spin-icon" size={18} aria-hidden="true" />
              <span>Building suggested workout...</span>
            </div>
          )}

          {selectedTrainingOption && !isLoadingPrescription && prescriptionError && (
            <div className="workout-empty-state">
              <AlertTriangle size={24} aria-hidden="true" />
              <strong>{prescriptionError}</strong>
              <button
                type="button"
                className="secondary-button"
                onClick={handleRegeneratePrescription}
              >
                <RefreshCw size={16} aria-hidden="true" />
                Try again
              </button>
            </div>
          )}

          {selectedTrainingOption &&
            !isLoadingPrescription &&
            !prescriptionError &&
            !selectedSuggestedDraft?.workout && (
              <div className="workout-empty-state">
                <AlertTriangle size={24} aria-hidden="true" />
                <strong>No suggested workout returned.</strong>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleRegeneratePrescription}
                >
                  <RefreshCw size={16} aria-hidden="true" />
                  Regenerate
                </button>
              </div>
            )}

          {selectedTrainingOption &&
            !isLoadingPrescription &&
            !prescriptionError &&
            selectedSuggestedDraft?.workout && (
              <div className="suggested-create-stack">
                {suggestedDrafts.length > 1 && (
                  <div
                    className="suggested-draft-tabs"
                    aria-label="Suggested workout variants"
                  >
                    {suggestedDrafts.map((draft, index) => (
                      <button
                        type="button"
                        key={getDraftKey(draft, index)}
                        className="secondary-button"
                        data-active={index === selectedDraftIndex ? "true" : "false"}
                        onClick={() => setSelectedDraftIndex(index)}
                      >
                        {draft.title || `Draft ${index + 1}`}
                      </button>
                    ))}
                  </div>
                )}

                <div className="suggested-draft-header">
                  <div>
                    <span className="eyebrow">Prefilled from readiness</span>
                    <h3>{selectedSuggestedDraft.title || "Suggested workout"}</h3>
                  </div>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleRegeneratePrescription}
                  >
                    <RefreshCw size={16} aria-hidden="true" />
                    Regenerate
                  </button>
                </div>

                {Boolean(suggestionWarnings.length || suggestionReasons.length) && (
                  <div className="suggested-pill-list">
                    {suggestionWarnings.map((warning) => (
                      <span key={warning} className="suggested-warning-pill">
                        <AlertTriangle size={14} aria-hidden="true" />
                        {warning}
                      </span>
                    ))}
                    {suggestionReasons.slice(0, 4).map((reason) => (
                      <small key={reason}>{reason}</small>
                    ))}
                  </div>
                )}

                <WorkoutCreateForm
                  key={selectedSuggestedDraftKey}
                  catalog={catalog}
                  selectedDate={selectedDate}
                  initialWorkout={selectedSuggestedDraft.workout}
                  initialWorkoutKey={selectedSuggestedDraftKey}
                  initialImpactPreview={selectedSuggestedDraft.planned_impact}
                  strengthProfiles={strengthProfiles}
                  onCreated={handleWorkoutCreated}
                  showHeader={false}
                />
              </div>
            )}

          {!selectedTrainingOption && (
            <WorkoutCreateForm
              catalog={catalog}
              selectedDate={selectedDate}
              strengthProfiles={strengthProfiles}
              onCreated={handleWorkoutCreated}
              showHeader={false}
            />
          )}
        </WorkoutModal>
      )}

      {activeModal === "fit-import" && (
        <WorkoutModal
          eyebrow="Workout import"
          title="FIT activity"
          onClose={handleModalClose}
        >
          <WorkoutFitImportForm onImported={handleWorkoutCreated} />
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
