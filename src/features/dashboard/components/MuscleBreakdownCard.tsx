import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
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
  getMappedPathKeysForBackendEntity,
  type BodyRegionState,
} from "@/features/dashboard/components/bodyStateMapping";
import { detailedMusclePaths } from "@/features/dashboard/components/muscleBreakdownData";
import {
  listCalendarReadinessEntries,
  type CalendarReadinessEntryResponse,
} from "@/features/workouts/services/calendarReadinessApi";
import {
  clampMagnitude,
  formatCalendarReadinessValue,
  getCalendarReadinessBandLabel,
  getCalendarReadinessCssBand,
  isActiveCalendarReadinessEntry,
  sortCalendarReadinessEntries,
} from "@/features/workouts/services/calendarReadiness";
import {
  buildCalendarReadinessTargets,
  formatCalendarReadinessTargetFallback,
  type CalendarReadinessTarget,
} from "@/features/workouts/services/calendarReadinessTargets";
import {
  getWorkoutCatalog,
  getWorkoutLoadState,
  type WorkoutCatalogResponse,
} from "@/features/workouts/services/workoutApi";
import {
  formatRatio,
  getBandCopy,
  getBandCssValue,
  getBandFromRatioTrend,
  getBandFromReadinessScore,
  trainingStateBands,
} from "@/features/workouts/services/trainingStateDisplay";
import {
  formatDateKey,
  formatDisplayDate,
  getTodayKey,
  parseDateKey,
} from "@/features/workouts/services/workoutDates";

const readinessLookbackDays = 30;

function getErrorMessage(error: unknown, fallback = "Could not load body state.") {
  if (error && typeof error === "object" && "error" in error) {
    const apiError = error as { error?: unknown };

    if (typeof apiError.error === "string" && apiError.error.trim()) {
      return apiError.error;
    }
  }

  return fallback;
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

function getLookbackStartDate(dateKey: string, days: number) {
  const date = parseDateKey(dateKey);

  return formatDateKey(
    new Date(date.getFullYear(), date.getMonth(), date.getDate() - days + 1)
  );
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

function getCalendarEntryTarget(
  entry: CalendarReadinessEntryResponse,
  targets: CalendarReadinessTarget[]
) {
  return targets.find(
    (target) =>
      target.entityType === entry.entity_type && target.id === entry.entity_id
  );
}

function getCalendarEntryPathKeys(
  entry: CalendarReadinessEntryResponse,
  targets: CalendarReadinessTarget[]
) {
  const target = getCalendarEntryTarget(entry, targets);

  return target?.pathKeys?.length
    ? target.pathKeys
    : getMappedPathKeysForBackendEntity(entry.entity_id, entry.entity_type);
}

function getCalendarEntryTargetLabel(
  entry: CalendarReadinessEntryResponse,
  targets: CalendarReadinessTarget[]
) {
  return (
    getCalendarEntryTarget(entry, targets)?.label ||
    formatCalendarReadinessTargetFallback(entry.entity_id)
  );
}

export function MuscleBreakdownCard() {
  const today = useMemo(() => getTodayKey(), []);
  const readinessLookbackStart = useMemo(
    () => getLookbackStartDate(today, readinessLookbackDays),
    [today]
  );
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleKey>(
    "front:R rectus femoris"
  );
  const [bodyState, setBodyState] = useState<BodyStateMap>({});
  const [catalog, setCatalog] = useState<WorkoutCatalogResponse | null>(null);
  const [calendarReadinessEntries, setCalendarReadinessEntries] = useState<
    CalendarReadinessEntryResponse[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [isLoadingCalendarReadiness, setIsLoadingCalendarReadiness] =
    useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [catalogErrorMessage, setCatalogErrorMessage] = useState<string | null>(
    null
  );
  const [calendarReadinessErrorMessage, setCalendarReadinessErrorMessage] =
    useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    setIsLoading(true);
    setErrorMessage(null);

    getWorkoutLoadState(today)
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
  }, [today]);

  useEffect(() => {
    let isActive = true;

    setIsLoadingCatalog(true);
    setCatalogErrorMessage(null);

    getWorkoutCatalog()
      .then((result) => {
        if (!isActive) {
          return;
        }

        if (result.error) {
          setCatalogErrorMessage(
            getErrorMessage(result.error, "Could not load workout catalog.")
          );
          return;
        }

        setCatalog(result.data);
      })
      .catch(() => {
        if (isActive) {
          setCatalogErrorMessage("Could not reach the workout catalog.");
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingCatalog(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    setIsLoadingCalendarReadiness(true);
    setCalendarReadinessErrorMessage(null);

    listCalendarReadinessEntries({
      from: readinessLookbackStart,
      to: today,
    })
      .then((result) => {
        if (!isActive) {
          return;
        }

        if (result.error) {
          setCalendarReadinessErrorMessage(
            getErrorMessage(
              result.error,
              "Could not load calendar readiness entries."
            )
          );
          return;
        }

        setCalendarReadinessEntries(result.data.entries || []);
      })
      .catch(() => {
        if (isActive) {
          setCalendarReadinessErrorMessage(
            "Could not reach the calendar readiness service."
          );
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingCalendarReadiness(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [readinessLookbackStart, today]);

  const calendarTargets = useMemo(
    () => buildCalendarReadinessTargets(catalog),
    [catalog]
  );
  const calendarMuscleStrokeColors = useMemo<MuscleColorMap>(() => {
    const worstMagnitudeByPath = calendarReadinessEntries.reduce<
      Record<string, number>
    >((mappedMagnitudes, entry) => {
      if (!isActiveCalendarReadinessEntry(entry)) {
        return mappedMagnitudes;
      }

      getCalendarEntryPathKeys(entry, calendarTargets).forEach((pathKey) => {
        mappedMagnitudes[pathKey] = Math.max(
          mappedMagnitudes[pathKey] || 0,
          clampMagnitude(entry.magnitude)
        );
      });

      return mappedMagnitudes;
    }, {});

    return Object.entries(worstMagnitudeByPath).reduce<MuscleColorMap>(
      (colors, [pathKey, magnitude]) => {
        colors[pathKey] = getBandCssValue(getCalendarReadinessCssBand(magnitude));

        return colors;
      },
      {}
    );
  }, [calendarReadinessEntries, calendarTargets]);

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
  const selectedCalendarEntries = useMemo(
    () =>
      sortCalendarReadinessEntries(
        calendarReadinessEntries.filter(
          (entry) =>
            isActiveCalendarReadinessEntry(entry) &&
            getCalendarEntryPathKeys(entry, calendarTargets).includes(
              selectedMuscle
            )
        )
      ),
    [calendarReadinessEntries, calendarTargets, selectedMuscle]
  );
  const selectedState = bodyState[selectedMuscle];
  const selectedLoadBand = selectedState
    ? getBandFromReadinessScore(selectedState.readiness)
    : "unknown";
  const selectedCalendarBand = selectedCalendarEntries[0]
    ? getCalendarReadinessCssBand(selectedCalendarEntries[0].magnitude)
    : null;
  const selectedPanelBand = selectedCalendarBand || selectedLoadBand;
  const selectedMetrics = [...(selectedState?.metrics || [])].sort(
    (left, right) => getMetricSortScore(right) - getMetricSortScore(left)
  );
  const errorMessages = [
    errorMessage,
    catalogErrorMessage,
    calendarReadinessErrorMessage,
  ].filter((message): message is string => Boolean(message));

  return (
    <section className="dashboard-card dashboard-card-muscle">
      <div className="dashboard-card-header">
        <div>
          <span className="eyebrow">Body State</span>
          <h2>Muscle breakdown</h2>
        </div>
        {(isLoading || isLoadingCatalog || isLoadingCalendarReadiness) && (
          <Loader2 className="spin-icon" size={18} aria-hidden="true" />
        )}
      </div>

      {errorMessages.map((message) => (
        <p key={message} className="form-message form-message-error" role="alert">
          {message}
        </p>
      ))}

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
            muscleStrokeColors={calendarMuscleStrokeColors}
            bodyState={bodyState}
            selectedMuscle={selectedMuscle}
            onMuscleSelect={setSelectedMuscle}
          />
        </div>

        <aside
          className="body-state-detail-panel"
          data-band={selectedPanelBand}
          aria-label="Selected body state"
        >
          <span className="eyebrow">Selected Region</span>
          <h3>{getSelectedLabel(selectedMuscle)}</h3>

          <div className="body-state-summary-grid">
            <div data-band={selectedLoadBand}>
              <span>Acute Load</span>
              <strong>{formatLoad(selectedState?.acuteLoad)}</strong>
            </div>
            <div data-band={selectedLoadBand}>
              <span>Chronic Load</span>
              <strong>{formatLoad(selectedState?.chronicLoad)}</strong>
            </div>
            <div data-band={selectedLoadBand}>
              <span>Body State</span>
              <strong>{getBandCopy(selectedLoadBand)}</strong>
            </div>
            <div data-band={selectedCalendarBand || "unknown"}>
              <span>Calendar State</span>
              <strong>
                {selectedCalendarEntries[0]
                  ? getCalendarReadinessBandLabel(
                      selectedCalendarEntries[0].magnitude
                    )
                  : "No issues"}
              </strong>
            </div>
            <div data-band={selectedLoadBand}>
              <span>Load Balance</span>
              <strong>{formatRatio(selectedState?.ratio)}</strong>
            </div>
          </div>

          {selectedCalendarEntries.length > 0 && (
            <div className="body-state-calendar-list">
              <div className="readiness-section-heading">
                <AlertTriangle size={16} aria-hidden="true" />
                <strong>Limiters / injuries, last 30d</strong>
              </div>

              {selectedCalendarEntries.map((entry, index) => (
                <div
                  key={`${entry.kind}-${entry.entity_type}-${entry.entity_id}-${index}`}
                  className="body-state-calendar-entry-row"
                  data-band={getCalendarReadinessCssBand(entry.magnitude)}
                  data-entity-type={entry.entity_type || "none"}
                >
                  <div>
                    <strong>
                      {getCalendarEntryTargetLabel(entry, calendarTargets)}
                    </strong>
                    <span>
                      {[
                        formatDisplayDate(entry.date),
                        formatCalendarReadinessValue(entry.kind),
                        formatCalendarReadinessValue(entry.entity_type),
                        getCalendarReadinessBandLabel(entry.magnitude),
                      ]
                        .filter(Boolean)
                        .join(" / ")}
                    </span>
                  </div>
                  <strong className="readiness-severity">
                    {clampMagnitude(entry.magnitude)}
                  </strong>
                </div>
              ))}
            </div>
          )}

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
