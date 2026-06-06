import { useEffect, useMemo, useState } from "react";
import { Activity, Loader2 } from "lucide-react";
import {
  formatScoreName,
  getRegionReadiness,
} from "@/features/dashboard/components/bodyStateMapping";
import {
  getWorkoutLoadState,
  type WorkoutLoadStateResponse,
} from "@/features/workouts/services/workoutApi";
import {
  formatRatio,
  getBandCopy,
  getBandFromRatioTrend,
} from "@/features/workouts/services/trainingStateDisplay";
import { getTodayKey } from "@/features/workouts/services/workoutDates";

const trendPriority: Record<string, number> = {
  none: 0,
  detraining: 1,
  stable: 2,
  rising: 3,
  high_acute: 4,
};

function getErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "error" in error) {
    const apiError = error as { error?: unknown };

    if (typeof apiError.error === "string" && apiError.error.trim()) {
      return apiError.error;
    }
  }

  return "Could not load training load.";
}

function formatLoad(value: number | undefined) {
  return typeof value === "number" ? value.toFixed(1) : "0.0";
}

function formatReadiness(value: number) {
  return Math.round(value).toString();
}

function isGlobalState(state: WorkoutLoadStateResponse) {
  return state.entity_type === "global" || state.entity_id === "global";
}

function getDominantTrend(loadState: WorkoutLoadStateResponse[]) {
  return loadState.reduce((currentTrend, state) => {
    const nextTrend = state.trend || "none";

    return (trendPriority[nextTrend] || 0) > (trendPriority[currentTrend] || 0)
      ? nextTrend
      : currentTrend;
  }, "none");
}

function getShortLoadType(loadType: string | undefined) {
  switch (loadType) {
    case "cardio":
      return "Cardio";
    case "neuro":
      return "Neuro";
    case "muscular":
      return "Muscular";
    case "impact":
      return "Impact";
    case "strength":
      return "Strength";
    case "endurance":
      return "Endurance";
    case "power":
      return "Power";
    case "eccentric":
      return "Eccentric";
    case "stabilizer":
      return "Stabilizer";
    default:
      return "Load";
  }
}

export function GlobalTrainingLoadCard() {
  const [loadState, setLoadState] = useState<WorkoutLoadStateResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    setIsLoading(true);
    setErrorMessage(null);

    getWorkoutLoadState(getTodayKey())
      .then((result) => {
        if (!isActive) {
          return;
        }

        if (result.error) {
          setErrorMessage(getErrorMessage(result.error));
          return;
        }

        setLoadState(result.data.filter(isGlobalState));
      })
      .catch(() => {
        if (isActive) {
          setErrorMessage("Could not reach the load-state service.");
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  const summary = useMemo(() => {
    const acuteLoad = loadState.reduce(
      (total, state) => total + (state.acute_load || 0),
      0
    );
    const chronicLoad = loadState.reduce(
      (total, state) => total + (state.chronic_load || 0),
      0
    );
    const ratio = chronicLoad > 0 ? acuteLoad / chronicLoad : 0;
    const trend = getDominantTrend(loadState);

    return {
      acuteLoad,
      chronicLoad,
      ratio,
      trend,
      readiness: getRegionReadiness(ratio, trend),
      band: getBandFromRatioTrend(ratio, trend, "global"),
    };
  }, [loadState]);

  const visibleMetrics = useMemo(
    () =>
      [...loadState]
        .sort((left, right) => (right.ratio || 0) - (left.ratio || 0))
        .slice(0, 3),
    [loadState]
  );

  return (
    <section className="dashboard-card dashboard-stat-card dashboard-global-load-card">
      <div className="dashboard-card-header">
        <div>
          <span className="eyebrow">Training Load</span>
          <h2>Training state</h2>
        </div>
        <div className="dashboard-stat-icon">
          {isLoading ? (
            <Loader2 className="spin-icon" size={18} aria-hidden="true" />
          ) : (
            <Activity size={18} aria-hidden="true" />
          )}
        </div>
      </div>

      {errorMessage && (
        <p className="form-message form-message-error" role="alert">
          {errorMessage}
        </p>
      )}

      <div className="global-state-status" data-band={summary.band}>
        <div>
          <span>Readiness</span>
          <strong>{getBandCopy(summary.band)}</strong>
        </div>
        <span>{formatReadiness(summary.readiness)}</span>
      </div>

      <div className="global-load-summary">
        <div>
          <span>Acute</span>
          <strong>{formatLoad(summary.acuteLoad)}</strong>
        </div>
        <div>
          <span>Chronic</span>
          <strong>{formatLoad(summary.chronicLoad)}</strong>
        </div>
        <div>
          <span>Load balance</span>
          <strong>{formatRatio(summary.ratio)}</strong>
        </div>
      </div>

      <div
        className="global-load-ratio"
        data-band={summary.band}
        data-trend={summary.trend}
      >
        <span>Load balance / {summary.trend.replace("_", " ")}</span>
        <strong>{formatRatio(summary.ratio)}</strong>
      </div>

      <div className="global-load-metric-list">
        {visibleMetrics.map((metric, index) => {
          const ratio =
            typeof metric.ratio === "number"
              ? metric.ratio
              : (metric.chronic_load || 0) > 0
                ? (metric.acute_load || 0) / (metric.chronic_load || 0)
                : 0;
          const band = getBandFromRatioTrend(
            ratio,
            metric.trend || "none",
            metric.entity_type
          );

          return (
            <div
              key={`${metric.entity_type}-${metric.entity_id}-${metric.load_type}-${index}`}
              className="global-load-metric-row"
              data-band={band}
              data-entity-type={metric.entity_type || "none"}
            >
              <div>
                <strong>{getShortLoadType(metric.load_type)}</strong>
                <span>{formatScoreName(metric.load_type)}</span>
              </div>
              <div>
                <span>A {formatLoad(metric.acute_load)}</span>
                <span>C {formatLoad(metric.chronic_load)}</span>
                <span>{getBandCopy(band)}</span>
              </div>
            </div>
          );
        })}

        {!visibleMetrics.length && !isLoading && (
          <span className="muted-copy">No load-state metrics returned.</span>
        )}
      </div>
    </section>
  );
}
