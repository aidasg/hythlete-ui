import { SessionBlocks } from "./SessionBlocks";
import { WorkoutImpactPanel } from "./WorkoutImpactPanel";
import {
  Activity,
  CheckCircle2,
  Circle,
  Clock,
  Dumbbell,
  Loader2,
  Pencil,
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
  onEdit?: (workout: WorkoutResponse) => void;
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

function formatLoadKg(value: number | undefined) {
  return typeof value === "number" ? `${value.toFixed(2)} kg` : null;
}

function formatConfidence(value: number | undefined) {
  return typeof value === "number" ? `${Math.round(value * 100)}%` : "n/a";
}

function formatDurationClock(totalSeconds: number | undefined) {
  if (typeof totalSeconds !== "number" || !Number.isFinite(totalSeconds)) {
    return null;
  }

  const normalizedSeconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(normalizedSeconds / 3600);
  const minutes = Math.floor((normalizedSeconds % 3600) / 60);
  const seconds = normalizedSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function formatMinutesDurationClock(minutes: number | undefined) {
  return typeof minutes === "number" ? formatDurationClock(minutes * 60) : null;
}

function formatComponentMeta(
  component: NonNullable<WorkoutResponse["components"]>[number]
) {
  return [
    component.sport,
    component.intensity_zone,
    formatDurationClock(component.duration_seconds),
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
    formatLoadKg(set.load_kg),
    typeof set.rir === "number" ? `RIR ${set.rir}` : null,
    typeof set.rpe === "number" ? `RPE ${set.rpe}` : null,
    formatDurationClock(set.duration_seconds),
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
  onEdit,
}: WorkoutDetailPanelProps) {
  const hasTrainingEvidence = Boolean(
    workout?.completed &&
      (workout.muscle_stimulus?.length ||
        workout.endurance_efforts?.length ||
        workout.benchmark_result ||
        workout.breakthrough_candidate_id)
  );

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
              {onEdit && (
                <button
                  type="button"
                  className="workout-edit-button"
                  aria-label={workout.completed ? "Edit completed workout" : "Edit or complete workout"}
                  title={workout.completed ? "Edit workout" : "Edit or complete workout"}
                  disabled={isLoading || isDeleting || !workout.id}
                  onClick={() => onEdit(workout)}
                >
                  <Pencil size={16} aria-hidden="true" />
                </button>
              )}
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
              {formatMinutesDurationClock(workout.duration_minutes) || "00:00:00"}
            </span>
            <span>{workout.category || "uncategorized"}</span>
            <span>RPE {workout.rpe || 0}</span>
            {workout.started_at && <span>Started {workout.started_at}</span>}
            {workout.planned_start_at && (
              <span>Planned {workout.planned_start_at}</span>
            )}
          </div>

          {!!workout.blocks?.length && <details open={!workout.completed}><summary>{workout.completed ? "Original workout plan" : "Workout structure"}</summary><SessionBlocks blocks={workout.blocks} /></details>}
          <WorkoutImpactPanel key={workout.id} workout={workout} />
          <details><summary>Load details</summary><div className="workout-load-grid">
            {getLoadMetrics(workout).map((metric) => (
              <div key={metric.label} className="workout-load-card">
                <span>{metric.label}</span>
                <strong>{formatScore(metric.value)}</strong>
              </div>
            ))}
          </div>

          </details>

          {workout.notes && <p className="workout-notes">{workout.notes}</p>}

          {hasTrainingEvidence && (
            <details className="training-evidence-disclosure">
              <summary>
                <div>
                  <span className="eyebrow">Derived facts</span>
                  <strong>Training evidence</strong>
                </div>
              </summary>
              <div className="training-evidence-content">
                {workout.breakthrough_candidate_id && (
                  <section>
                    <h3>Breakthrough attempt</h3>
                    <p>Linked to candidate #{workout.breakthrough_candidate_id}. Achievement is determined by the backend from comparable completed evidence.</p>
                  </section>
                )}
                {workout.benchmark_result && (
                  <section>
                    <h3>Benchmark result</h3>
                    <div className="evidence-stat-row">
                      <span>Variant #{workout.benchmark_result.variant_id}</span>
                      <strong>{workout.benchmark_result.score_value}</strong>
                      <span>{workout.benchmark_result.completed_as_prescribed ? "As prescribed" : "Modified"}</span>
                    </div>
                  </section>
                )}
                {Boolean(workout.endurance_efforts?.length) && (
                  <section>
                    <h3>Endurance efforts</h3>
                    <div className="training-evidence-list">
                      {workout.endurance_efforts?.map((effort, index) => (
                        <div key={`${effort.component_order}-${effort.kind}-${index}`}>
                          <strong>{effort.kind || effort.metric || "Effort"}</strong>
                          <span>{formatOptionalNumber(effort.value, effort.unit ? ` ${effort.unit}` : "") || formatOptionalNumber(effort.distance_m, " m") || formatDurationClock(effort.duration_seconds)}</span>
                          <small>{effort.sport || "endurance"} · {formatConfidence(effort.confidence)} confidence · {effort.source || "derived"}</small>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                {Boolean(workout.muscle_stimulus?.length) && (
                  <section>
                    <h3>Muscle stimulus</h3>
                    <div className="training-evidence-list">
                      {workout.muscle_stimulus?.map((stimulus, index) => (
                        <div key={`${stimulus.muscle_code}-${index}`}>
                          <strong>{stimulus.muscle_name || stimulus.muscle_code}</strong>
                          <span>{stimulus.effective_sets || 0} estimated effective sets</span>
                          <small>Strength {formatScore(stimulus.strength_stimulus)} · Hypertrophy {formatScore(stimulus.hypertrophy_stimulus)} · Endurance {formatScore(stimulus.endurance_stimulus)} · {formatConfidence(stimulus.confidence)}</small>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </details>
          )}

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
                      {formatDurationClock(zoneDuration.duration_seconds) || "00:00:00"}
                    </strong>
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>
      )}
    </aside>
  );
}
