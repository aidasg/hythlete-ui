import { getApiErrorMessage } from "@/services/api/errors";
import { getApiErrorMessage as getErrorMessage } from "@/services/api/errors";
import { useEffect, useMemo, useState } from "react";
import { Activity, Loader2 } from "lucide-react";
import {
  formatScoreName,
  getRegionReadiness,
} from "@/components/body/bodyStateMapping";
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

function formatLoad(value: number | undefined) {
  return typeof value === "number" ? value.toFixed(1) : "0.0";
}

function formatReadiness(value: number | undefined) {
  return value === undefined ? "Not enough data" : Math.round(value).toString();
}

function isGlobalState(state: WorkoutLoadStateResponse) {
  return state.entity_type === "global" || state.entity_id === "global";
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
      .catch((requestError) => {
        if (isActive) {
          setErrorMessage(getApiErrorMessage(requestError));
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
    // Display one tracked dimension; legacy and volume-model units are not additive.
    const available = loadState.filter(s => s.ratio_available !== false);
    const selected = [...available].sort((a, b) => (b.ratio || 0) - (a.ratio || 0))[0] || loadState[0];
    const ratio = selected?.ratio_available === false ? undefined : selected?.ratio;
    const trend = selected?.trend || 'none';
    return { acuteLoad: selected?.acute_load, chronicLoad: selected?.chronic_load, ratio, trend,
      title: getShortLoadType(selected?.load_type),
      readiness: ratio === undefined ? undefined : getRegionReadiness(ratio, trend),
      band: getBandFromRatioTrend(ratio, trend, 'global') };
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
          <span>{summary.title} acute average</span>
          <strong>{formatLoad(summary.acuteLoad)}</strong>
        </div>
        <div>
          <span>{summary.title} chronic average</span>
          <strong>{formatLoad(summary.chronicLoad)}</strong>
        </div>
        <div>
          <span>Load balance</span>
          <strong>{summary.ratio === undefined ? "Limited baseline" : formatRatio(summary.ratio)}</strong>
        </div>
      </div>

      <div
        className="global-load-ratio"
        data-band={summary.band}
        data-trend={summary.trend}
      >
        <span>Load balance / {summary.trend.replace("_", " ")}</span>
        <strong>{summary.ratio === undefined ? "Limited baseline" : formatRatio(summary.ratio)}</strong>
      </div>

      <div className="global-load-metric-list">
        {visibleMetrics.map((metric, index) => {
          const ratio = metric.ratio_available === false ? undefined :
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
                <strong>{getShortLoadType(metric.load_type)}{metric.model_version === "strength-volume-v2" ? " (volume)" : metric.model_version === "strength-workload-v3" ? " (workload)" : ""}</strong>
                <span>{formatScoreName(metric.load_type)}</span>
              </div>
              <div>
                <span>A {formatLoad(metric.acute_load)}</span>
                <span>C {formatLoad(metric.chronic_load)}</span>
                <span>{metric.ratio_available === false ? "Limited baseline" : getBandCopy(band)}</span>
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
