import {
  Activity,
  CheckCircle2,
  Circle,
  Clock,
  Dumbbell,
  Loader2,
  Trash2,
} from "lucide-react";
import type { WorkoutResponse } from "@/features/workouts/services/workoutApi";
import { formatDisplayDate } from "@/features/workouts/services/workoutDates";

type WorkoutDetailPanelProps = {
  workout: WorkoutResponse | null;
  isLoading: boolean;
  errorMessage: string | null;
  showHeader?: boolean;
  isDeleting?: boolean;
  onDelete?: (workout: WorkoutResponse) => void;
};

type LoadMetric = {
  label: string;
  value: number | undefined;
};

function formatScore(value: number | undefined) {
  return typeof value === "number" ? value.toFixed(1) : "0.0";
}

function getWorkoutTitle(workout: WorkoutResponse) {
  return workout.title || workout.subtype || workout.category || "Workout";
}

function getMuscleTotal(workout: NonNullable<WorkoutResponse["muscle_loads"]>[number]) {
  return (
    (workout.endurance_load || 0) +
    (workout.strength_load || 0) +
    (workout.eccentric_load || 0) +
    (workout.power_load || 0) +
    (workout.stabilizer_load || 0)
  );
}

function getLoadMetrics(workout: WorkoutResponse): LoadMetric[] {
  return [
    {
      label: "Cardiorespiratory Load Score",
      value: workout.loads?.global_cardio_load,
    },
    {
      label: "Neuromuscular Demand Score",
      value: workout.loads?.global_neuro_load,
    },
    {
      label: "Muscle Load Score",
      value: workout.loads?.global_muscular_load,
    },
    {
      label: "Tendon Load Score",
      value: workout.loads?.impact_tissue_load,
    },
    {
      label: "Strength Stress Score",
      value: workout.loads?.strength_load,
    },
    {
      label: "Aerobic Stress Score",
      value: workout.loads?.endurance_load,
    },
  ];
}

function formatOptionalNumber(value: number | undefined, suffix = "") {
  return typeof value === "number" ? `${value}${suffix}` : null;
}

function formatComponentMeta(
  component: NonNullable<WorkoutResponse["components"]>[number]
) {
  return [
    component.sport,
    component.intensity_zone,
    formatOptionalNumber(component.duration_seconds, " sec"),
    formatOptionalNumber(component.distance_m, " m"),
    component.repeats ? `${component.repeats} repeats` : null,
    component.target_type,
  ].filter(Boolean);
}

function formatMetricMeta(
  component: NonNullable<WorkoutResponse["components"]>[number]
) {
  const metrics = component.metrics;

  if (!metrics) {
    return [];
  }

  return [
    formatOptionalNumber(metrics.avg_heart_rate_bpm, " avg bpm"),
    formatOptionalNumber(metrics.max_heart_rate_bpm, " max bpm"),
    formatOptionalNumber(metrics.avg_power_watts, " avg W"),
    formatOptionalNumber(metrics.max_power_watts, " max W"),
    formatOptionalNumber(metrics.avg_speed_mps, " avg m/s"),
    formatOptionalNumber(metrics.max_speed_mps, " max m/s"),
    formatOptionalNumber(metrics.total_ascent_m, " m ascent"),
    formatOptionalNumber(metrics.total_descent_m, " m descent"),
  ].filter(Boolean);
}

function formatEffortMeta(
  component: NonNullable<WorkoutResponse["components"]>[number]
) {
  const effort = component.effort;

  if (!effort) {
    return [];
  }

  return [
    effort.zone ? `Effort ${effort.zone}` : null,
    typeof effort.intensity_factor === "number"
      ? `IF ${effort.intensity_factor.toFixed(2)}`
      : null,
    typeof effort.confidence === "number"
      ? `${Math.round(effort.confidence * 100)}% confidence`
      : null,
    effort.source,
  ].filter(Boolean);
}

function formatSetMeta(
  set: NonNullable<
    NonNullable<WorkoutResponse["components"]>[number]["sets"]
  >[number]
) {
  return [
    formatOptionalNumber(set.reps, " reps"),
    formatOptionalNumber(set.load_kg, " kg"),
    typeof set.rir === "number" ? `RIR ${set.rir}` : null,
    typeof set.rpe === "number" ? `RPE ${set.rpe}` : null,
    formatOptionalNumber(set.duration_seconds, " sec"),
    formatOptionalNumber(set.distance_m, " m"),
    set.tempo ? `Tempo ${set.tempo}` : null,
    set.is_warmup ? "Warmup" : null,
  ].filter(Boolean);
}

export function WorkoutDetailPanel({
  workout,
  isLoading,
  errorMessage,
  showHeader = true,
  isDeleting = false,
  onDelete,
}: WorkoutDetailPanelProps) {
  const topMuscles = [...(workout?.muscle_loads || [])]
    .sort((left, right) => getMuscleTotal(right) - getMuscleTotal(left))
    .slice(0, 5);
  const topTissues = [...(workout?.tissue_loads || [])]
    .sort((left, right) => (right.load || 0) - (left.load || 0))
    .slice(0, 5);

  return (
    <aside className="workout-detail-panel" aria-label="Workout detail">
      {showHeader && (
        <div className="workout-panel-header">
          <span className="eyebrow">Detail</span>
          {isLoading && (
            <Loader2 className="spin-icon" size={18} aria-hidden="true" />
          )}
        </div>
      )}

      {!showHeader && isLoading && (
        <div className="workout-modal-loader">
          <Loader2 className="spin-icon" size={18} aria-hidden="true" />
        </div>
      )}

      {errorMessage && (
        <p className="form-message form-message-error" role="alert">
          {errorMessage}
        </p>
      )}

      {!workout && !isLoading && (
        <div className="workout-empty-state">
          <Dumbbell size={24} aria-hidden="true" />
          <strong>No workout selected</strong>
        </div>
      )}

      {workout && (
        <div className="workout-detail-content">
          <div className="workout-detail-title">
            <div className="workout-detail-heading">
              <h2>{getWorkoutTitle(workout)}</h2>
              {onDelete && (
                <button
                  type="button"
                  className="workout-delete-button"
                  aria-label="Delete workout"
                  title="Delete workout"
                  disabled={isLoading || isDeleting || !workout.id}
                  onClick={() => onDelete(workout)}
                >
                  {isDeleting ? (
                    <Loader2 className="spin-icon" size={16} aria-hidden="true" />
                  ) : (
                    <Trash2 size={16} aria-hidden="true" />
                  )}
                </button>
              )}
            </div>
            <span className="workout-status-chip">
              {workout.completed ? (
                <CheckCircle2 size={15} aria-hidden="true" />
              ) : (
                <Circle size={15} aria-hidden="true" />
              )}
              {workout.completed ? "Completed" : workout.planned ? "Planned" : "Draft"}
            </span>
          </div>

          <div className="workout-meta-grid">
            <span>
              <Clock size={15} aria-hidden="true" />
              {formatDisplayDate(workout.date)}
            </span>
            <span>
              <Activity size={15} aria-hidden="true" />
              {workout.duration_minutes || 0} min
            </span>
            <span>{workout.category || "uncategorized"}</span>
            <span>RPE {workout.rpe || 0}</span>
            {workout.started_at && <span>Started {workout.started_at}</span>}
            {workout.planned_start_at && (
              <span>Planned {workout.planned_start_at}</span>
            )}
          </div>

          <div className="workout-load-grid">
            {getLoadMetrics(workout).map((metric) => (
              <div key={metric.label} className="workout-load-card">
                <span>{metric.label}</span>
                <strong>{formatScore(metric.value)}</strong>
              </div>
            ))}
          </div>

          {workout.notes && <p className="workout-notes">{workout.notes}</p>}

          <section className="workout-detail-section">
            <h3>Components</h3>
            <div className="workout-component-list">
              {(workout.components || []).map((component, index) => (
                <div key={component.id ?? index} className="workout-component-detail">
                  <div className="workout-component-detail-header">
                    <strong>
                      {component.order || index + 1}.{" "}
                      {component.exercise_name || component.type || "Component"}
                    </strong>
                    <span>{component.type || "manual"}</span>
                  </div>

                  <div className="workout-component-meta-list">
                    {formatComponentMeta(component).map((meta) => (
                      <small key={meta}>{meta}</small>
                    ))}
                    {formatMetricMeta(component).map((meta) => (
                      <small key={meta}>{meta}</small>
                    ))}
                    {formatEffortMeta(component).map((meta) => (
                      <small key={meta}>{meta}</small>
                    ))}
                    {component.exercise_code && <small>{component.exercise_code}</small>}
                    {!formatComponentMeta(component).length &&
                      !formatMetricMeta(component).length &&
                      !formatEffortMeta(component).length &&
                      !component.exercise_code && (
                        <small>No component metadata returned.</small>
                      )}
                  </div>

                  {Boolean(component.sets?.length) && (
                    <div className="workout-detail-set-list">
                      {component.sets?.map((set, setIndex) => (
                        <div key={set.id ?? setIndex} className="workout-detail-set-row">
                          <span>{set.set_order || setIndex + 1}</span>
                          <div>
                            {formatSetMeta(set).map((meta) => (
                              <small key={meta}>{meta}</small>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {!workout.components?.length && (
                <span className="muted-copy">No components returned.</span>
              )}
            </div>
          </section>

          {Boolean(workout.effort_zone_durations?.length) && (
            <section className="workout-detail-section">
              <h3>Effort Zone Durations</h3>
              <div className="workout-load-list">
                {workout.effort_zone_durations?.map((zoneDuration, index) => (
                  <div
                    key={`${zoneDuration.zone}-${index}`}
                    className="load-list-row"
                  >
                    <span>{zoneDuration.zone || "unclassified"}</span>
                    <strong>
                      {formatScore(
                        typeof zoneDuration.duration_seconds === "number"
                          ? zoneDuration.duration_seconds / 60
                          : undefined
                      )}{" "}
                      min
                    </strong>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="workout-detail-section">
            <h3>Top Muscle Stress Scores</h3>
            <div className="workout-load-list">
              {topMuscles.map((muscle) => (
                <div key={muscle.muscle_code || muscle.muscle_name} className="load-list-row">
                  <span>{muscle.muscle_name || muscle.muscle_code}</span>
                  <strong>{formatScore(getMuscleTotal(muscle))}</strong>
                </div>
              ))}
              {!topMuscles.length && (
                <span className="muted-copy">No muscle stress scores returned.</span>
              )}
            </div>
          </section>

          <section className="workout-detail-section">
            <h3>Top Tendon Load Scores</h3>
            <div className="workout-load-list">
              {topTissues.map((tissue) => (
                <div key={tissue.region_code || tissue.region_name} className="load-list-row">
                  <span>{tissue.region_name || tissue.region_code}</span>
                  <strong>{formatScore(tissue.load)}</strong>
                </div>
              ))}
              {!topTissues.length && (
                <span className="muted-copy">No tendon load scores returned.</span>
              )}
            </div>
          </section>
        </div>
      )}
    </aside>
  );
}
