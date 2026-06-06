import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  MuscleBreakdownFigure,
  type BodyStateMap,
  type MuscleColorMap,
  type MuscleKey,
} from "@/features/dashboard/components/MuscleBreakdownFigure";
import {
  buildBodyRegionState,
  formatBackendEntity,
  formatScoreName,
  type BodyRegionState,
} from "@/features/dashboard/components/bodyStateMapping";
import { detailedMusclePaths } from "@/features/dashboard/components/muscleBreakdownData";
import { getWorkoutLoadState } from "@/features/workouts/services/workoutApi";
import {
  formatRatio,
  getBandCopy,
  getBandCssValue,
  getBandFromRatioTrend,
  getBandFromReadinessScore,
  trainingStateBands,
} from "@/features/workouts/services/trainingStateDisplay";
import { getTodayKey } from "@/features/workouts/services/workoutDates";

function getErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "error" in error) {
    const apiError = error as { error?: unknown };

    if (typeof apiError.error === "string" && apiError.error.trim()) {
      return apiError.error;
    }
  }

  return "Could not load body state.";
}

function getSelectedLabel(selectedMuscle: MuscleKey) {
  const muscle = detailedMusclePaths.find((path) => path.key === selectedMuscle);

  if (!muscle) {
    return "Selected region";
  }

  return `${muscle.side} ${muscle.scientificName}`;
}

function formatLoad(value: number | undefined) {
  return typeof value === "number" ? value.toFixed(1) : "0.0";
}

function getMetricEntityLabel(metric: BodyRegionState["metrics"][number]) {
  if (metric.entityType === "global" || metric.entityId === "global") {
    return metric.loadType
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  return formatBackendEntity(metric.entityId);
}

function getMetricSortScore(metric: BodyRegionState["metrics"][number]) {
  const priority: Record<string, number> = {
    impact: 7,
    strength: 6,
    endurance: 5,
    eccentric: 4,
    power: 3,
    stabilizer: 2,
    muscular: 1,
  };

  return priority[metric.loadType] || 0;
}

export function MuscleBreakdownCard() {
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleKey>(
    "front:R rectus femoris"
  );
  const [bodyState, setBodyState] = useState<BodyStateMap>({});
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

        setBodyState(buildBodyRegionState(result.data));
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

  const muscleColors = useMemo<MuscleColorMap>(
    () =>
      detailedMusclePaths.reduce<MuscleColorMap>((colors, muscle) => {
        const state = bodyState[muscle.key];
        const band = state
          ? getBandFromReadinessScore(state.readiness)
          : "unknown";

        colors[muscle.key] = getBandCssValue(band);

        return colors;
      }, {}),
    [bodyState]
  );
  const selectedState = bodyState[selectedMuscle];
  const selectedBand = selectedState
    ? getBandFromReadinessScore(selectedState.readiness)
    : "unknown";
  const selectedMetrics = [...(selectedState?.metrics || [])].sort(
    (left, right) => getMetricSortScore(right) - getMetricSortScore(left)
  );

  return (
    <section className="dashboard-card dashboard-card-muscle">
      <div className="dashboard-card-header">
        <div>
          <span className="eyebrow">Body State</span>
          <h2>Muscle breakdown</h2>
        </div>
        {isLoading && <Loader2 className="spin-icon" size={18} aria-hidden="true" />}
      </div>

      {errorMessage && (
        <p className="form-message form-message-error" role="alert">
          {errorMessage}
        </p>
      )}

      <div className="muscle-card-body">
        <div className="body-state-map-panel">
          <div className="body-state-legend" aria-label="Body state legend">
            {trainingStateBands.map((band) => (
              <span key={band} data-band={band}>
                <i aria-hidden="true" />
                {getBandCopy(band)}
              </span>
            ))}
          </div>

          <MuscleBreakdownFigure
            muscleColors={muscleColors}
            bodyState={bodyState}
            selectedMuscle={selectedMuscle}
            onMuscleSelect={setSelectedMuscle}
          />
        </div>

        <aside
          className="body-state-detail-panel"
          data-band={selectedBand}
          aria-label="Selected body state"
        >
          <span className="eyebrow">Selected Region</span>
          <h3>{getSelectedLabel(selectedMuscle)}</h3>

          <div className="body-state-summary-grid">
            <div data-band={selectedBand}>
              <span>Acute Load</span>
              <strong>{formatLoad(selectedState?.acuteLoad)}</strong>
            </div>
            <div data-band={selectedBand}>
              <span>Chronic Load</span>
              <strong>{formatLoad(selectedState?.chronicLoad)}</strong>
            </div>
            <div data-band={selectedBand}>
              <span>Body State</span>
              <strong>{getBandCopy(selectedBand)}</strong>
            </div>
            <div data-band={selectedBand}>
              <span>Load Balance</span>
              <strong>{formatRatio(selectedState?.ratio)}</strong>
            </div>
          </div>

          <div className="body-state-metric-list">
            {selectedMetrics.map((metric, index) => {
              const band = getBandFromRatioTrend(
                metric.ratio,
                metric.trend,
                metric.entityType
              );

              return (
                <div
                  key={`${metric.entityType}-${metric.entityId}-${metric.loadType}-${index}`}
                  className="body-state-metric-row"
                  data-band={band}
                  data-entity-type={metric.entityType}
                  data-trend={metric.trend}
                >
                  <div>
                    <strong>{metric.label || formatScoreName(metric.loadType)}</strong>
                    <span>
                      {getMetricEntityLabel(metric)} / {getBandCopy(band)}
                    </span>
                  </div>
                  <div>
                    <span>Acute {formatLoad(metric.acuteLoad)}</span>
                    <span>Chronic {formatLoad(metric.chronicLoad)}</span>
                    <span>Balance {formatRatio(metric.ratio)}</span>
                  </div>
                </div>
              );
            })}

            {!selectedMetrics.length && (
              <span className="muted-copy">No mapped load-state metrics returned.</span>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
