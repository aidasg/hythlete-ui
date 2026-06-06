import { Activity, AlertTriangle, Loader2, Target } from "lucide-react";
import type {
  ReadinessResponse,
  TrainingOptionResponse,
} from "@/features/workouts/services/workoutApi";
import {
  formatReadinessLabel,
  getLimiterMeta,
  getLimiterTitle,
  getRecommendationCopy,
  getTopLimiters,
} from "@/features/workouts/services/readinessDisplay";
import { formatDisplayDate } from "@/features/workouts/services/workoutDates";

type WorkoutLoadStatePanelProps = {
  date: string;
  readiness: ReadinessResponse | null;
  isLoading: boolean;
  errorMessage: string | null;
};

function getTrainingOptions(options: TrainingOptionResponse[] | undefined) {
  return [...(options || [])]
    .sort((left, right) => (right.score || 0) - (left.score || 0))
    .slice(0, 4);
}

export function WorkoutLoadStatePanel({
  date,
  readiness,
  isLoading,
  errorMessage,
}: WorkoutLoadStatePanelProps) {
  const limiters = getTopLimiters(readiness?.limiters);
  const trainingOptions = getTrainingOptions(readiness?.training_options);

  return (
    <section className="load-state-panel" aria-labelledby="load-state-title">
      <div className="workout-panel-header">
        <div>
          <span className="eyebrow">Readiness</span>
          <h2 id="load-state-title">{formatDisplayDate(date)}</h2>
        </div>
        {isLoading && <Loader2 className="spin-icon" size={18} aria-hidden="true" />}
      </div>

      {errorMessage && (
        <p className="form-message form-message-error" role="alert">
          {errorMessage}
        </p>
      )}

      {readiness && (
        <div className="readiness-status" data-recommendation={readiness.recommendation || "none"}>
          <div className="readiness-status-icon">
            <Activity size={18} aria-hidden="true" />
          </div>
          <div>
            <strong>{getRecommendationCopy(readiness.recommendation)}</strong>
            {Boolean(readiness.reasons?.length) && (
              <span>{readiness.reasons?.[0]}</span>
            )}
          </div>
        </div>
      )}

      <div className="load-state-list">
        {limiters.map((limiter, index) => (
          <div
            key={`${limiter.entity_type}-${limiter.entity_id}-${limiter.load_type}-${index}`}
            className="readiness-limiter-row"
            data-label={limiter.label || "none"}
            data-entity-type={limiter.entity_type || "none"}
          >
            <div>
              <strong>{getLimiterTitle(limiter)}</strong>
              <span>{getLimiterMeta(limiter).join(" / ") || "Training limiter"}</span>
              {limiter.reason && <small>{limiter.reason}</small>}
            </div>
            {typeof limiter.severity === "number" && (
              <strong className="readiness-severity">{Math.round(limiter.severity)}</strong>
            )}
          </div>
        ))}

        {!limiters.length && !isLoading && !errorMessage && (
          <span className="muted-copy">No loaded areas returned.</span>
        )}
      </div>

      <section className="readiness-options" aria-label="Training options">
        <div className="readiness-section-heading">
          <Target size={16} aria-hidden="true" />
          <strong>Training options</strong>
        </div>

        {trainingOptions.map((option, index) => (
          <div
            key={`${option.focus}-${option.sport}-${index}`}
            className="training-option-row"
            data-recommendation={option.recommendation || "none"}
          >
            <div className="training-option-rank">{index + 1}</div>
            <div>
              <strong>
                {formatReadinessLabel(option.focus) || option.category || "Training"}
              </strong>
              <span>
                {[
                  formatReadinessLabel(option.sport),
                  formatReadinessLabel(option.recommendation),
                ]
                  .filter(Boolean)
                  .join(" / ") || "Option"}
              </span>
              {Boolean(option.reasons?.length) && (
                <small>{option.reasons?.slice(0, 2).join(" / ")}</small>
              )}
            </div>
            {typeof option.score === "number" && (
              <strong className="training-option-score">{Math.round(option.score)}</strong>
            )}
          </div>
        ))}

        {!trainingOptions.length && !isLoading && !errorMessage && (
          <div className="readiness-empty-note">
            <AlertTriangle size={15} aria-hidden="true" />
            <span>No ranked options returned.</span>
          </div>
        )}
      </section>
    </section>
  );
}
