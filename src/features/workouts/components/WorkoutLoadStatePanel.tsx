import { Activity, AlertTriangle, Loader2, Target } from "lucide-react";
import type {
  ReadinessEntityResponse,
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
import {
  formatRatio,
  getBandCopy,
  getBandFromRatioTrend,
  getBandFromReadinessLabel,
  getBandFromRecommendation,
} from "@/features/workouts/services/trainingStateDisplay";
import { formatDisplayDate } from "@/features/workouts/services/workoutDates";

type WorkoutLoadStatePanelProps = {
  date: string;
  readiness: ReadinessResponse | null;
  isLoading: boolean;
  errorMessage: string | null;
  selectedOptionKey?: string | null;
  onTrainingOptionSelect?: (option: TrainingOptionResponse) => void;
};

function getTrainingOptions(options: TrainingOptionResponse[] | undefined) {
  return [...(options || [])]
    .sort((left, right) => (right.score || 0) - (left.score || 0))
    .slice(0, 3);
}

function getLoadBalanceEntities(entities: ReadinessEntityResponse[] | undefined) {
  return [...(entities || [])]
    .sort((left, right) => (right.score || 0) - (left.score || 0))
    .slice(0, 5);
}

function getEntityTitle(entity: ReadinessEntityResponse) {
  if (entity.entity_type === "global" || entity.entity_id === "global") {
    return (
      formatReadinessLabel(entity.load_type) ||
      entity.name ||
      entity.group_name ||
      "Load balance"
    );
  }

  return (
    entity.name ||
    entity.group_name ||
    entity.region ||
    entity.entity_id ||
    entity.entity_type ||
    "Load balance"
  );
}

export function WorkoutLoadStatePanel({
  date,
  readiness,
  isLoading,
  errorMessage,
  selectedOptionKey,
  onTrainingOptionSelect,
}: WorkoutLoadStatePanelProps) {
  const limiters = getTopLimiters(readiness?.limiters);
  const trainingOptions = getTrainingOptions(readiness?.training_options);
  const loadBalanceEntities = getLoadBalanceEntities(readiness?.entities);
  const recommendationBand = getBandFromRecommendation(readiness?.recommendation);

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
        <div
          className="readiness-status"
          data-band={recommendationBand}
          data-recommendation={readiness.recommendation || "none"}
        >
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

      <section className="readiness-options" aria-label="Training options">
        <div className="readiness-section-heading">
          <Target size={16} aria-hidden="true" />
          <strong>Training options</strong>
        </div>

        {trainingOptions.map((option, index) => {
          const optionKey =
            option.key || [option.focus, option.sport].filter(Boolean).join(":");
          const isSelected = Boolean(optionKey && optionKey === selectedOptionKey);

          return (
          <button
            type="button"
            key={`${optionKey}-${index}`}
            className="training-option-row"
            disabled={!optionKey || !onTrainingOptionSelect}
            onClick={() => onTrainingOptionSelect?.(option)}
            data-selected={isSelected ? "true" : "false"}
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
          </button>
          );
        })}

        {!trainingOptions.length && !isLoading && !errorMessage && (
          <div className="readiness-empty-note">
            <AlertTriangle size={15} aria-hidden="true" />
            <span>No ranked options returned.</span>
          </div>
        )}
      </section>

      <details className="insight-disclosure">
        <summary>
          <span>Limiters</span>
          <small>{limiters.length || "None"}</small>
        </summary>
        <div className="load-state-list">
          {limiters.map((limiter, index) => (
            <div
              key={`${limiter.entity_type}-${limiter.entity_id}-${limiter.load_type}-${index}`}
              className="readiness-limiter-row"
              data-band={getBandFromReadinessLabel(limiter.label)}
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
      </details>

      {Boolean(loadBalanceEntities.length) && (
        <details className="insight-disclosure readiness-load-balance">
          <summary>
            <span>Load balance</span>
            <small>{loadBalanceEntities.length} metrics</small>
          </summary>

          <div className="insight-disclosure-content">
            {loadBalanceEntities.map((entity, index) => {
              const band =
                getBandFromReadinessLabel(entity.label) ||
                getBandFromRatioTrend(entity.ratio, entity.trend, entity.entity_type);
              const displayBand =
                band === "unknown"
                  ? getBandFromRatioTrend(entity.ratio, entity.trend, entity.entity_type)
                  : band;

              return (
                <div
                  key={`${entity.entity_type}-${entity.entity_id}-${entity.load_type}-${index}`}
                  className="load-balance-row"
                  data-band={displayBand}
                  data-entity-type={entity.entity_type || "none"}
                >
                  <div>
                    <strong>{getEntityTitle(entity)}</strong>
                    <span>
                      {[
                        formatReadinessLabel(entity.load_type),
                        formatReadinessLabel(entity.label) || getBandCopy(displayBand),
                      ]
                        .filter(Boolean)
                        .join(" / ")}
                    </span>
                  </div>
                  <span className="load-balance-chip">
                    {formatRatio(entity.ratio)}
                  </span>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </section>
  );
}
