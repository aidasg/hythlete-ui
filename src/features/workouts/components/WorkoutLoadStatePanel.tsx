import { Loader2, TrendingDown, TrendingUp } from "lucide-react";
import type { WorkoutLoadStateResponse } from "@/features/workouts/services/workoutApi";
import { formatDisplayDate } from "@/features/workouts/services/workoutDates";

type WorkoutLoadStatePanelProps = {
  date: string;
  loadState: WorkoutLoadStateResponse[];
  isLoading: boolean;
  errorMessage: string | null;
};

function getTrendIcon(trend: string | undefined) {
  if (trend === "detraining") {
    return <TrendingDown size={15} aria-hidden="true" />;
  }

  return <TrendingUp size={15} aria-hidden="true" />;
}

function formatEntity(loadState: WorkoutLoadStateResponse) {
  if (loadState.entity_type === "global") {
    return "Global";
  }

  return loadState.entity_id || loadState.entity_type || "Load";
}

function formatLoadType(loadType: string | undefined) {
  switch (loadType) {
    case "cardio":
      return "Cardiorespiratory Load Score";
    case "neuro":
      return "Neural Fatigue Score";
    case "muscular":
      return "Muscle Load Score";
    case "impact":
      return "Tendon Impact Score";
    case "strength":
      return "Strength Stress Score";
    case "endurance":
      return "Aerobic Stress Score";
    case "power":
      return "Power Output Stress Score";
    case "eccentric":
      return "Eccentric Tissue Stress Score";
    case "stabilizer":
      return "Stabilizer Demand Score";
    default:
      return "Load Adaptation Score";
  }
}

export function WorkoutLoadStatePanel({
  date,
  loadState,
  isLoading,
  errorMessage,
}: WorkoutLoadStatePanelProps) {
  const visibleLoadState = [...loadState]
    .sort((left, right) => (right.ratio || 0) - (left.ratio || 0))
    .slice(0, 6);

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

      <div className="load-state-list">
        {visibleLoadState.map((state, index) => (
          <div
            key={`${state.entity_type}-${state.entity_id}-${state.load_type}-${index}`}
            className="load-state-row"
            data-trend={state.trend || "none"}
          >
            <div>
              <strong>{formatEntity(state)}</strong>
              <span>{formatLoadType(state.load_type)}</span>
            </div>
            <div className="load-state-trend">
              {getTrendIcon(state.trend)}
              <span>{typeof state.ratio === "number" ? state.ratio.toFixed(2) : "0.00"}</span>
            </div>
          </div>
        ))}

        {!visibleLoadState.length && !isLoading && (
          <span className="muted-copy">No load state returned.</span>
        )}
      </div>
    </section>
  );
}
