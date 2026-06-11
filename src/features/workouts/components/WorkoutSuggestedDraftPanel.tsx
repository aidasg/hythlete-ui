import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw, Save } from "lucide-react";
import {
  createWorkout,
  type ExerciseSetRequest,
  type ExerciseStrengthProfileResponse,
  type PlannedImpactResponse,
  type WorkoutComponentRequest,
  type WorkoutPrescriptionResponse,
  type WorkoutRequest,
  type WorkoutResponse,
} from "@/features/workouts/services/workoutApi";
import {
  getLimiterKey,
  getLimiterMeta,
  getLimiterTitle,
  getRecommendationCopy,
  getTopLimiters,
} from "@/features/workouts/services/readinessDisplay";
import {
  getBandCopy,
  getBandFromRecommendation,
} from "@/features/workouts/services/trainingStateDisplay";

type WorkoutSuggestedDraftPanelProps = {
  prescription: WorkoutPrescriptionResponse | null;
  isLoading: boolean;
  errorMessage: string | null;
  strengthProfiles?: ExerciseStrengthProfileResponse[];
  onCreated: (workout: WorkoutResponse) => void;
  onRegenerate: () => void;
};

type FieldValue = string | number | boolean | undefined;

function getErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "error" in error) {
    const apiError = error as { error?: unknown };

    if (typeof apiError.error === "string" && apiError.error.trim()) {
      return apiError.error;
    }
  }

  return "The workout service did not accept that workout.";
}

function parseOptionalNumber(value: string) {
  const parsedValue = Number(value);

  return value.trim() && Number.isFinite(parsedValue) ? parsedValue : undefined;
}

function formatKg(value: number | undefined) {
  return typeof value === "number" ? `${value.toFixed(1).replace(".0", "")} kg` : null;
}

function formatConfidence(value: number | undefined) {
  return typeof value === "number" ? `${Math.round(value * 100)}%` : "n/a";
}

function getStrengthProfileMap(profiles: ExerciseStrengthProfileResponse[]) {
  return profiles.reduce<Record<string, ExerciseStrengthProfileResponse>>(
    (profileMap, profile) => {
      if (profile.exercise_code) {
        profileMap[profile.exercise_code] = profile;
      }

      return profileMap;
    },
    {}
  );
}

function getDraftTitle(workout: WorkoutRequest | undefined, fallback: string | undefined) {
  return workout?.title || fallback || workout?.subtype || workout?.category || "Suggested workout";
}

function cloneWorkout(workout: WorkoutRequest | undefined): WorkoutRequest {
  return {
    ...(workout || {}),
    planned: workout?.planned ?? true,
    completed: workout?.completed ?? false,
    components: (workout?.components || []).map((component) => ({
      ...component,
      sets: component.sets?.map((set) => ({ ...set })),
      metrics: component.metrics ? { ...component.metrics } : undefined,
    })),
    primary_adaptations: [...(workout?.primary_adaptations || [])],
    secondary_adaptations: [...(workout?.secondary_adaptations || [])],
  };
}

function normalizeDraftPayload(workout: WorkoutRequest): WorkoutRequest {
  return {
    ...workout,
    title: workout.title?.trim() || "Suggested workout",
    category: workout.category || "endurance",
    source: workout.source || "prescription",
    planned: workout.planned ?? true,
    completed: workout.completed ?? false,
    notes: workout.notes?.trim() || undefined,
    components: workout.components || [],
  };
}

function ImpactSummary({ impact }: { impact: PlannedImpactResponse | undefined }) {
  if (!impact) {
    return <span className="muted-copy">No planned impact returned.</span>;
  }

  const phases = [
    { label: "Before", readiness: impact.before },
    { label: "After", readiness: impact.after_today },
    { label: "Tomorrow", readiness: impact.tomorrow },
  ];

  return (
    <div className="suggested-impact-grid">
      {phases.map((phase) => {
        const band = getBandFromRecommendation(phase.readiness?.recommendation);

        return (
          <div key={phase.label} className="suggested-impact-card" data-band={band}>
            <span>{phase.label}</span>
            <strong>{getRecommendationCopy(phase.readiness?.recommendation)}</strong>
            <small>{getBandCopy(band)}</small>
          </div>
        );
      })}
    </div>
  );
}

function WarningsAndReasons({
  warnings,
  reasons,
  impact,
}: {
  warnings: string[] | undefined;
  reasons: string[] | undefined;
  impact: PlannedImpactResponse | undefined;
}) {
  const limiters = getTopLimiters(impact?.limiters, 4);

  if (!warnings?.length && !reasons?.length && !limiters.length) {
    return null;
  }

  return (
    <section className="suggested-draft-section">
      <h3>Warnings and limiters</h3>
      <div className="suggested-pill-list">
        {warnings?.map((warning) => (
          <span key={warning} className="suggested-warning-pill">
            <AlertTriangle size={14} aria-hidden="true" />
            {warning}
          </span>
        ))}
        {limiters.map((limiter, index) => (
          <span
            key={`${getLimiterKey(limiter)}-${index}`}
            data-entity-type={limiter.entity_type || "none"}
          >
            {getLimiterTitle(limiter)}
            {getLimiterMeta(limiter).length ? ` / ${getLimiterMeta(limiter).join(" / ")}` : ""}
          </span>
        ))}
        {reasons?.slice(0, 4).map((reason) => (
          <small key={reason}>{reason}</small>
        ))}
      </div>
    </section>
  );
}

function hasLoadedSet(component: WorkoutComponentRequest) {
  return Boolean(
    component.sets?.some((set) => typeof set.load_kg === "number" && set.load_kg > 0)
  );
}

function getUncalibratedStrengthWarnings(
  workout: WorkoutRequest,
  profileMap: Record<string, ExerciseStrengthProfileResponse>
) {
  const warnings = new Set<string>();

  (workout.components || []).forEach((component) => {
    const exerciseCode = component.exercise_code;
    const hasSetPrescription = Boolean(component.sets?.length);

    if (
      component.type === "exercise" &&
      exerciseCode &&
      hasSetPrescription &&
      !hasLoadedSet(component) &&
      !profileMap[exerciseCode]
    ) {
      warnings.add(
        `${exerciseCode}: track a completed loaded workout to calibrate this exercise.`
      );
    }
  });

  return Array.from(warnings);
}

function StrengthCalibrationContext({
  profile,
}: {
  profile: ExerciseStrengthProfileResponse | undefined;
}) {
  if (!profile) {
    return (
      <div className="suggested-calibration-note" data-state="empty">
        Track a completed loaded workout to calibrate this exercise.
      </div>
    );
  }

  return (
    <div className="suggested-calibration-note">
      {[
        formatKg(profile.training_max_kg)
          ? `${formatKg(profile.training_max_kg)} training max`
          : null,
        formatKg(profile.estimated_1rm_kg)
          ? `${formatKg(profile.estimated_1rm_kg)} est. 1RM`
          : null,
        `${formatConfidence(profile.confidence)} confidence`,
      ]
        .filter(Boolean)
        .join(" / ")}
    </div>
  );
}

export function WorkoutSuggestedDraftPanel({
  prescription,
  isLoading,
  errorMessage,
  strengthProfiles = [],
  onCreated,
  onRegenerate,
}: WorkoutSuggestedDraftPanelProps) {
  const drafts = prescription?.workouts || [];
  const [selectedDraftIndex, setSelectedDraftIndex] = useState(0);
  const selectedDraft = drafts[selectedDraftIndex] || drafts[0];
  const [editedWorkout, setEditedWorkout] = useState<WorkoutRequest>(() =>
    cloneWorkout(selectedDraft?.workout)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const strengthProfileMap = useMemo(
    () => getStrengthProfileMap(strengthProfiles),
    [strengthProfiles]
  );

  useEffect(() => {
    setSelectedDraftIndex(0);
  }, [prescription]);

  useEffect(() => {
    setEditedWorkout(cloneWorkout(selectedDraft?.workout));
    setSaveErrorMessage(null);
  }, [selectedDraft]);

  const title = useMemo(
    () => getDraftTitle(editedWorkout, selectedDraft?.title),
    [editedWorkout, selectedDraft]
  );
  const calibrationWarnings = useMemo(
    () => getUncalibratedStrengthWarnings(editedWorkout, strengthProfileMap),
    [editedWorkout, strengthProfileMap]
  );

  function updateWorkoutField(field: keyof WorkoutRequest, value: FieldValue) {
    setEditedWorkout((current) => ({
      ...current,
      [field]: value,
    }));
    setSaveErrorMessage(null);
  }

  function updateComponent(
    componentIndex: number,
    field: keyof WorkoutComponentRequest,
    value: FieldValue
  ) {
    setEditedWorkout((current) => ({
      ...current,
      components: (current.components || []).map((component, index) =>
        index === componentIndex
          ? {
              ...component,
              [field]: value,
            }
          : component
      ),
    }));
    setSaveErrorMessage(null);
  }

  function updateSet(
    componentIndex: number,
    setIndex: number,
    field: keyof ExerciseSetRequest,
    value: FieldValue
  ) {
    setEditedWorkout((current) => ({
      ...current,
      components: (current.components || []).map((component, index) =>
        index === componentIndex
          ? {
              ...component,
              sets: (component.sets || []).map((set, nextSetIndex) =>
                nextSetIndex === setIndex
                  ? {
                      ...set,
                      [field]: value,
                    }
                  : set
              ),
            }
          : component
      ),
    }));
    setSaveErrorMessage(null);
  }

  async function handleSave() {
    const payload = normalizeDraftPayload(editedWorkout);

    setIsSaving(true);
    setSaveErrorMessage(null);

    try {
      const result = await createWorkout(payload);

      if (result.error) {
        setSaveErrorMessage(getErrorMessage(result.error));
        return;
      }

      onCreated(result.data);
    } catch {
      setSaveErrorMessage("Could not reach the workout service. Try again in a moment.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="suggested-draft-loader">
        <Loader2 className="spin-icon" size={18} aria-hidden="true" />
        <span>Building suggested workout...</span>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="workout-empty-state">
        <AlertTriangle size={24} aria-hidden="true" />
        <strong>{errorMessage}</strong>
        <button type="button" className="secondary-button" onClick={onRegenerate}>
          <RefreshCw size={16} aria-hidden="true" />
          Try again
        </button>
      </div>
    );
  }

  if (!selectedDraft?.workout) {
    return (
      <div className="workout-empty-state">
        <AlertTriangle size={24} aria-hidden="true" />
        <strong>No suggested workout returned.</strong>
      </div>
    );
  }

  return (
    <section className="suggested-draft-panel" aria-label="Suggested workout">
      {drafts.length > 1 && (
        <div className="suggested-draft-tabs" aria-label="Suggested workout variants">
          {drafts.map((draft, index) => (
            <button
              type="button"
              key={draft.key || index}
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
          <span className="eyebrow">Suggested workout</span>
          <h3>{title}</h3>
        </div>
        <button type="button" className="secondary-button" onClick={onRegenerate}>
          <RefreshCw size={16} aria-hidden="true" />
          Regenerate
        </button>
      </div>

      <div className="workout-form-grid suggested-draft-editor">
        <label className="workout-form-wide">
          Title
          <input
            type="text"
            value={editedWorkout.title || ""}
            onChange={(event) => updateWorkoutField("title", event.target.value)}
          />
        </label>
        <label>
          Date
          <input
            type="date"
            value={editedWorkout.date || ""}
            onChange={(event) => updateWorkoutField("date", event.target.value)}
          />
        </label>
        <label>
          Category
          <input
            type="text"
            value={editedWorkout.category || ""}
            onChange={(event) => updateWorkoutField("category", event.target.value)}
          />
        </label>
        <label>
          Sport
          <input
            type="text"
            value={editedWorkout.sport || ""}
            onChange={(event) => updateWorkoutField("sport", event.target.value)}
          />
        </label>
        <label>
          Duration
          <input
            type="number"
            min="0"
            value={editedWorkout.duration_minutes ?? ""}
            onChange={(event) =>
              updateWorkoutField("duration_minutes", parseOptionalNumber(event.target.value))
            }
          />
        </label>
        <label>
          RPE
          <input
            type="number"
            min="1"
            max="10"
            value={editedWorkout.rpe ?? ""}
            onChange={(event) => updateWorkoutField("rpe", parseOptionalNumber(event.target.value))}
          />
        </label>
        <label>
          Subtype
          <input
            type="text"
            value={editedWorkout.subtype || ""}
            onChange={(event) => updateWorkoutField("subtype", event.target.value)}
          />
        </label>
        <label className="workout-form-wide">
          Notes
          <textarea
            value={editedWorkout.notes || ""}
            rows={3}
            onChange={(event) => updateWorkoutField("notes", event.target.value)}
          />
        </label>
      </div>

      <div className="workout-check-row">
        <label className="choice-pill">
          <input
            type="checkbox"
            checked={editedWorkout.planned ?? true}
            onChange={(event) => updateWorkoutField("planned", event.target.checked)}
          />
          Planned
        </label>
        <label className="choice-pill">
          <input
            type="checkbox"
            checked={editedWorkout.completed ?? false}
            onChange={(event) => updateWorkoutField("completed", event.target.checked)}
          />
          Completed
        </label>
      </div>

      <section className="suggested-draft-section">
        <h3>Workout structure</h3>
        <div className="suggested-component-list">
          {(editedWorkout.components || []).map((component, componentIndex) => (
            <section key={`${component.type}-${componentIndex}`} className="suggested-component-card">
              <div className="suggested-component-heading">
                <strong>{component.exercise_code || component.type || `Component ${componentIndex + 1}`}</strong>
                <span>{component.type || "manual"}</span>
              </div>

              {component.type === "exercise" && component.exercise_code && (
                <StrengthCalibrationContext
                  profile={strengthProfileMap[component.exercise_code]}
                />
              )}

              <div className="workout-form-grid">
                <label>
                  Type
                  <input
                    type="text"
                    value={component.type || ""}
                    onChange={(event) =>
                      updateComponent(componentIndex, "type", event.target.value)
                    }
                  />
                </label>
                <label>
                  Sport
                  <input
                    type="text"
                    value={component.sport || ""}
                    onChange={(event) =>
                      updateComponent(componentIndex, "sport", event.target.value)
                    }
                  />
                </label>
                <label>
                  Zone
                  <input
                    type="text"
                    value={component.intensity_zone || ""}
                    onChange={(event) =>
                      updateComponent(componentIndex, "intensity_zone", event.target.value)
                    }
                  />
                </label>
                <label>
                  Seconds
                  <input
                    type="number"
                    min="0"
                    value={component.duration_seconds ?? ""}
                    onChange={(event) =>
                      updateComponent(
                        componentIndex,
                        "duration_seconds",
                        parseOptionalNumber(event.target.value)
                      )
                    }
                  />
                </label>
                <label>
                  Distance m
                  <input
                    type="number"
                    min="0"
                    value={component.distance_m ?? ""}
                    onChange={(event) =>
                      updateComponent(
                        componentIndex,
                        "distance_m",
                        parseOptionalNumber(event.target.value)
                      )
                    }
                  />
                </label>
                <label>
                  Repeats
                  <input
                    type="number"
                    min="0"
                    value={component.repeats ?? ""}
                    onChange={(event) =>
                      updateComponent(
                        componentIndex,
                        "repeats",
                        parseOptionalNumber(event.target.value)
                      )
                    }
                  />
                </label>
              </div>

              {Boolean(component.sets?.length) && (
                <div className="suggested-set-list">
                  {component.sets?.map((set, setIndex) => (
                    <div key={setIndex} className="suggested-set-row">
                      <span>{set.set_order || setIndex + 1}</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="Reps"
                        value={set.reps ?? ""}
                        onChange={(event) =>
                          updateSet(
                            componentIndex,
                            setIndex,
                            "reps",
                            parseOptionalNumber(event.target.value)
                          )
                        }
                      />
                      <input
                        type="number"
                        min="0"
                        placeholder="kg"
                        value={set.load_kg ?? ""}
                        onChange={(event) =>
                          updateSet(
                            componentIndex,
                            setIndex,
                            "load_kg",
                            parseOptionalNumber(event.target.value)
                          )
                        }
                      />
                      <input
                        type="number"
                        min="0"
                        max="10"
                        placeholder="RPE"
                        value={set.rpe ?? ""}
                        onChange={(event) =>
                          updateSet(
                            componentIndex,
                            setIndex,
                            "rpe",
                            parseOptionalNumber(event.target.value)
                          )
                        }
                      />
                      <input
                        type="number"
                        min="0"
                        max="10"
                        placeholder="RIR"
                        value={set.rir ?? ""}
                        onChange={(event) =>
                          updateSet(
                            componentIndex,
                            setIndex,
                            "rir",
                            parseOptionalNumber(event.target.value)
                          )
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      </section>

      <section className="suggested-draft-section">
        <h3>Impact</h3>
        <ImpactSummary impact={selectedDraft.planned_impact} />
      </section>

      <WarningsAndReasons
        warnings={[
          ...(prescription?.warnings || []),
          ...(selectedDraft.warnings || []),
          ...calibrationWarnings,
        ]}
        reasons={[...(prescription?.reasons || []), ...(selectedDraft.reasons || [])]}
        impact={selectedDraft.planned_impact}
      />

      {saveErrorMessage && (
        <p className="form-message form-message-error" role="alert">
          {saveErrorMessage}
        </p>
      )}

      <div className="suggested-draft-actions">
        <button type="button" className="secondary-button" onClick={onRegenerate}>
          <RefreshCw size={16} aria-hidden="true" />
          Regenerate
        </button>
        <button type="button" className="primary-button" disabled={isSaving} onClick={handleSave}>
          <Save size={17} aria-hidden="true" />
          {isSaving ? "Saving workout..." : "Save workout"}
        </button>
      </div>
    </section>
  );
}
