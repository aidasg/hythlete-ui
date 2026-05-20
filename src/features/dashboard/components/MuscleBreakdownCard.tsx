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
import { getTodayKey } from "@/features/workouts/services/workoutDates";

function getBodyStateColor(readiness: number, hasMetrics: boolean) {
  if (!hasMetrics) {
    return "rgba(174, 184, 214, 0.38)";
  }

  if (readiness >= 75) {
    return "rgba(139, 233, 247, 0.78)";
  }

  if (readiness >= 55) {
    return "rgba(184, 167, 255, 0.84)";
  }

  return "rgba(255, 180, 192, 0.82)";
}

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

        colors[muscle.key] = getBodyStateColor(
          state?.readiness ?? muscle.readiness,
          Boolean(state?.metrics.length)
        );

        return colors;
      }, {}),
    [bodyState]
  );
  const selectedState = bodyState[selectedMuscle];
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
        <MuscleBreakdownFigure
          muscleColors={muscleColors}
          bodyState={bodyState}
          selectedMuscle={selectedMuscle}
          onMuscleSelect={setSelectedMuscle}
        />

        <aside className="body-state-detail-panel" aria-label="Selected body state">
          <span className="eyebrow">Selected Region</span>
          <h3>{getSelectedLabel(selectedMuscle)}</h3>

          <div className="body-state-summary-grid">
            <div>
              <span>Acute Load</span>
              <strong>{formatLoad(selectedState?.acuteLoad)}</strong>
            </div>
            <div>
              <span>Chronic Load</span>
              <strong>{formatLoad(selectedState?.chronicLoad)}</strong>
            </div>
            <div>
              <span>Body State</span>
              <strong>{selectedState?.readiness ?? 72}</strong>
            </div>
            <div>
              <span>Ratio</span>
              <strong>{selectedState?.ratio.toFixed(2) || "0.00"}</strong>
            </div>
          </div>

          <div className="body-state-metric-list">
            {selectedMetrics.map((metric, index) => (
              <div
                key={`${metric.entityType}-${metric.entityId}-${metric.loadType}-${index}`}
                className="body-state-metric-row"
                data-trend={metric.trend}
              >
                <div>
                  <strong>{metric.label || formatScoreName(metric.loadType)}</strong>
                  <span>
                    {formatBackendEntity(metric.entityId)} / {metric.trend}
                  </span>
                </div>
                <div>
                  <span>Acute {formatLoad(metric.acuteLoad)}</span>
                  <span>Chronic {formatLoad(metric.chronicLoad)}</span>
                </div>
              </div>
            ))}

            {!selectedMetrics.length && (
              <span className="muted-copy">No mapped load-state metrics returned.</span>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
