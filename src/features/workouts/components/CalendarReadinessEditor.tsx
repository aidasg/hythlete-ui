import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Crosshair,
  Loader2,
  Plus,
  Save,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import {
  MuscleBreakdownFigure,
  type MuscleColorMap,
  type MuscleKey,
} from "@/features/dashboard/components/MuscleBreakdownFigure";
import { getMappedPathKeysForBackendEntity } from "@/features/dashboard/components/bodyStateMapping";
import { detailedMusclePaths } from "@/features/dashboard/components/muscleBreakdownData";
import type {
  CalendarReadinessEntryRequest,
  CalendarReadinessEntryResponse,
} from "@/features/workouts/services/calendarReadinessApi";
import {
  calendarReadinessEntityTypes,
  calendarReadinessKinds,
  clampMagnitude,
  formatCalendarReadinessValue,
  getCalendarReadinessEntryKey,
  getCalendarReadinessBandLabel,
  getCalendarReadinessCssBand,
  isActiveCalendarReadinessEntry,
  isCalendarReadinessEntityType,
  isCalendarReadinessKind,
  sortCalendarReadinessEntries,
  type CalendarReadinessEntityType,
  type CalendarReadinessKind,
} from "@/features/workouts/services/calendarReadiness";
import {
  buildCalendarReadinessTargets,
  formatCalendarReadinessTargetFallback,
  type CalendarReadinessTarget,
} from "@/features/workouts/services/calendarReadinessTargets";
import type { WorkoutCatalogResponse } from "@/features/workouts/services/workoutApi";
import { getBandCssValue } from "@/features/workouts/services/trainingStateDisplay";
import { formatDisplayDate } from "@/features/workouts/services/workoutDates";

type CalendarReadinessEditorProps = {
  date: string;
  catalog: WorkoutCatalogResponse | null;
  entries: CalendarReadinessEntryResponse[];
  isSaving: boolean;
  errorMessage: string | null;
  onSave: (entries: CalendarReadinessEntryRequest[]) => Promise<void>;
};

type CalendarReadinessEditableEntry =
  | CalendarReadinessEntryRequest
  | CalendarReadinessEntryResponse;

const defaultSelectedMuscle: MuscleKey = "front:R knee";

function getEntryTargetLabel(
  entry: CalendarReadinessEditableEntry,
  targets: CalendarReadinessTarget[]
) {
  const target = targets.find(
    (item) => item.entityType === entry.entity_type && item.id === entry.entity_id
  );

  return target?.label || formatCalendarReadinessTargetFallback(entry.entity_id);
}

function getEntryPathKeys(
  entry: CalendarReadinessEditableEntry,
  targets: CalendarReadinessTarget[]
) {
  const target = targets.find(
    (item) => item.entityType === entry.entity_type && item.id === entry.entity_id
  );

  return target?.pathKeys?.length
    ? target.pathKeys
    : getMappedPathKeysForBackendEntity(entry.entity_id, entry.entity_type);
}

function getNormalizedKind(kind: string | undefined): CalendarReadinessKind {
  return isCalendarReadinessKind(kind) ? kind : "injury";
}

function getNormalizedEntityType(
  entityType: string | undefined
): CalendarReadinessEntityType {
  return isCalendarReadinessEntityType(entityType) ? entityType : "tissue";
}

function getTargetOptions(
  targets: CalendarReadinessTarget[],
  selectedMuscle: MuscleKey
) {
  const matchedTargets = targets.filter((target) =>
    target.pathKeys.includes(selectedMuscle)
  );

  return matchedTargets.length ? matchedTargets : targets;
}

function toRequestEntry(
  entry: CalendarReadinessEditableEntry,
  fallbackDate: string
): CalendarReadinessEntryRequest {
  return {
    date: entry.date || fallbackDate,
    kind: getNormalizedKind(entry.kind),
    entity_type: getNormalizedEntityType(entry.entity_type),
    entity_id: entry.entity_id,
    magnitude: clampMagnitude(entry.magnitude),
  };
}

function replaceEntry(
  entries: CalendarReadinessEntryRequest[],
  nextEntry: CalendarReadinessEntryRequest
) {
  const nextKey = getCalendarReadinessEntryKey(nextEntry);

  return sortCalendarReadinessEntries([
    ...entries.filter((entry) => getCalendarReadinessEntryKey(entry) !== nextKey),
    nextEntry,
  ]);
}

export function CalendarReadinessEditor({
  date,
  catalog,
  entries,
  isSaving,
  errorMessage,
  onSave,
}: CalendarReadinessEditorProps) {
  const [selectedMuscle, setSelectedMuscle] =
    useState<MuscleKey>(defaultSelectedMuscle);
  const [kind, setKind] = useState<CalendarReadinessKind>("injury");
  const [entityType, setEntityType] =
    useState<CalendarReadinessEntityType>("tissue");
  const [entityId, setEntityId] = useState("");
  const [magnitude, setMagnitude] = useState(70);
  const [draftEntries, setDraftEntries] = useState<
    CalendarReadinessEntryRequest[]
  >([]);
  const [deletedEntries, setDeletedEntries] = useState<
    CalendarReadinessEntryRequest[]
  >([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const targets = useMemo(() => buildCalendarReadinessTargets(catalog), [catalog]);
  const entityTargets = useMemo(
    () => targets.filter((target) => target.entityType === entityType),
    [entityType, targets]
  );
  const targetOptions = useMemo(
    () => getTargetOptions(entityTargets, selectedMuscle),
    [entityTargets, selectedMuscle]
  );
  const selectedTarget = targets.find(
    (target) => target.entityType === entityType && target.id === entityId
  );
  const magnitudeBand = getCalendarReadinessCssBand(magnitude);
  const initialEntryKeys = useMemo(
    () =>
      new Set(
        entries
          .filter(isActiveCalendarReadinessEntry)
          .map((entry) => getCalendarReadinessEntryKey(entry))
      ),
    [entries]
  );
  const activeEntries = useMemo(
    () => sortCalendarReadinessEntries(draftEntries),
    [draftEntries]
  );
  const selectedRegionEntries = useMemo(
    () =>
      sortCalendarReadinessEntries(
        draftEntries.filter((entry) =>
          getEntryPathKeys(entry, targets).includes(selectedMuscle)
        )
      ),
    [draftEntries, selectedMuscle, targets]
  );
  const muscleColors = useMemo<MuscleColorMap>(() => {
    const colors = detailedMusclePaths.reduce<MuscleColorMap>(
      (mappedColors, muscle) => {
        mappedColors[muscle.key] = getBandCssValue("unknown");

        return mappedColors;
      },
      {}
    );

    selectedTarget?.pathKeys.forEach((pathKey) => {
      colors[pathKey] = getBandCssValue(magnitudeBand);
    });

    return colors;
  }, [magnitudeBand, selectedTarget]);

  useEffect(() => {
    setDraftEntries(
      sortCalendarReadinessEntries(
        entries
          .filter(isActiveCalendarReadinessEntry)
          .map((entry) => toRequestEntry(entry, date))
      )
    );
    setDeletedEntries([]);
    setHasChanges(false);
    setLocalError(null);
  }, [date, entries]);

  useEffect(() => {
    if (!targetOptions.length) {
      setEntityId("");
      return;
    }

    if (!targetOptions.some((target) => target.id === entityId)) {
      setEntityId(targetOptions[0]?.id || "");
    }
  }, [entityId, targetOptions]);

  function handleTargetTypeChange(nextEntityType: CalendarReadinessEntityType) {
    setEntityType(nextEntityType);
    setLocalError(null);
  }

  function handleEditEntry(entry: CalendarReadinessEditableEntry) {
    const nextKind = getNormalizedKind(entry.kind);
    const nextEntityType = getNormalizedEntityType(entry.entity_type);
    const nextPathKey = getEntryPathKeys(entry, targets)[0];

    setKind(nextKind);
    setEntityType(nextEntityType);
    setEntityId(entry.entity_id || "");
    setMagnitude(clampMagnitude(entry.magnitude));
    setSelectedMuscle(nextPathKey || defaultSelectedMuscle);
    setLocalError(null);
  }

  function handleDeleteEntry(entry: CalendarReadinessEditableEntry) {
    const requestEntry = toRequestEntry(entry, date);
    const entryKey = getCalendarReadinessEntryKey(requestEntry);
    const existsInDraft = draftEntries.some(
      (draftEntry) => getCalendarReadinessEntryKey(draftEntry) === entryKey
    );
    const existsInitially = initialEntryKeys.has(entryKey);

    if (!existsInDraft && !existsInitially) {
      setLocalError(null);
      return;
    }

    setDraftEntries((currentEntries) =>
      currentEntries.filter(
        (currentEntry) => getCalendarReadinessEntryKey(currentEntry) !== entryKey
      )
    );

    if (initialEntryKeys.has(entryKey)) {
      setDeletedEntries((currentEntries) =>
        replaceEntry(currentEntries, {
          ...requestEntry,
          magnitude: 0,
        })
      );
    }

    setHasChanges(true);
    setLocalError(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!entityId) {
      setLocalError("Choose a catalog target.");
      return;
    }

    const nextEntry: CalendarReadinessEntryRequest = {
      date,
      kind,
      entity_type: entityType,
      entity_id: entityId,
      magnitude: clampMagnitude(magnitude),
    };

    if (nextEntry.magnitude === 0) {
      handleDeleteEntry(nextEntry);
      return;
    }

    setDraftEntries((currentEntries) => replaceEntry(currentEntries, nextEntry));
    setDeletedEntries((currentEntries) =>
      currentEntries.filter(
        (entry) =>
          getCalendarReadinessEntryKey(entry) !==
          getCalendarReadinessEntryKey(nextEntry)
      )
    );
    setHasChanges(true);
    setLocalError(null);
  }

  async function handleSaveAll() {
    try {
      setLocalError(null);
      await onSave([...deletedEntries, ...draftEntries]);
      setDeletedEntries([]);
      setHasChanges(false);
    } catch (error) {
      setLocalError(
        error instanceof Error
          ? error.message
          : "Could not save readiness entries."
      );
    }
  }

  return (
    <section className="calendar-readiness-editor">
      <div className="calendar-readiness-layout">
        <div className="calendar-readiness-map-panel">
          <div
            className="calendar-readiness-legend"
            aria-label="Readiness entry magnitude"
          >
            <span data-band="loaded">
              <i aria-hidden="true" />
              Loaded
            </span>
            <span data-band="caution">
              <i aria-hidden="true" />
              Caution
            </span>
            <span data-band="avoid">
              <i aria-hidden="true" />
              Avoid
            </span>
          </div>

          <MuscleBreakdownFigure
            muscleColors={muscleColors}
            selectedMuscle={selectedMuscle}
            onMuscleSelect={setSelectedMuscle}
          />
        </div>

        <form className="calendar-readiness-form" onSubmit={handleSubmit}>
          <div>
            <span className="eyebrow">Daily readiness</span>
            <h3>{formatDisplayDate(date)}</h3>
          </div>

          <section
            className="calendar-readiness-region-card-list"
            aria-label="Selected region readiness entries"
          >
            <div className="readiness-section-heading">
              <Crosshair size={16} aria-hidden="true" />
              <strong>Selected region entries</strong>
            </div>

            {selectedRegionEntries.map((entry, index) => (
              <div
                key={`${entry.kind}-${entry.entity_type}-${entry.entity_id}-${index}`}
                className="calendar-readiness-region-card"
                data-band={getCalendarReadinessCssBand(entry.magnitude)}
                data-entity-type={entry.entity_type || "none"}
              >
                <div>
                  <strong>{getEntryTargetLabel(entry, targets)}</strong>
                  <span>
                    {[
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

            {!selectedRegionEntries.length && (
              <span className="muted-copy">No entries mapped to this region.</span>
            )}
          </section>

          <fieldset>
            <legend>Kind</legend>
            <div className="calendar-readiness-segmented">
              {calendarReadinessKinds.map((item) => (
                <button
                  key={item}
                  type="button"
                  data-active={kind === item ? "true" : "false"}
                  onClick={() => {
                    setKind(item);
                    setLocalError(null);
                  }}
                >
                  {item === "injury" ? (
                    <AlertTriangle size={15} aria-hidden="true" />
                  ) : (
                    <SlidersHorizontal size={15} aria-hidden="true" />
                  )}
                  {formatCalendarReadinessValue(item)}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Target type</legend>
            <div className="calendar-readiness-segmented">
              {calendarReadinessEntityTypes.map((item) => (
                <button
                  key={item}
                  type="button"
                  data-active={entityType === item ? "true" : "false"}
                  onClick={() => handleTargetTypeChange(item)}
                >
                  <Crosshair size={15} aria-hidden="true" />
                  {formatCalendarReadinessValue(item)}
                </button>
              ))}
            </div>
          </fieldset>

          <label>
            Target
            <select
              value={entityId}
              disabled={!targetOptions.length || isSaving}
              onChange={(event) => {
                setEntityId(event.target.value);
                setLocalError(null);
              }}
            >
              {!targetOptions.length && <option value="">No targets loaded</option>}
              {targetOptions.map((target) => (
                <option key={`${target.entityType}-${target.id}`} value={target.id}>
                  {[target.label, target.meta].filter(Boolean).join(" / ")}
                </option>
              ))}
            </select>
          </label>

          <label
            className="calendar-readiness-slider"
            data-band={magnitudeBand}
          >
            <span>
              Magnitude
              <strong>{getCalendarReadinessBandLabel(magnitude)}</strong>
            </span>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={magnitude}
              disabled={isSaving}
              onChange={(event) => {
                setMagnitude(clampMagnitude(event.target.value));
                setLocalError(null);
              }}
            />
            <output>{clampMagnitude(magnitude)}</output>
          </label>

          {(localError || errorMessage) && (
            <p className="form-message form-message-error" role="alert">
              {localError || errorMessage}
            </p>
          )}

          <button
            type="submit"
            className="primary-button"
            disabled={isSaving || !entityId}
          >
            Add entry
            <Plus size={17} aria-hidden="true" />
          </button>
        </form>
      </div>

      <section className="calendar-readiness-entry-list" aria-label="Readiness entries">
        <div className="readiness-section-heading">
          <SlidersHorizontal size={16} aria-hidden="true" />
          <strong>All date entries</strong>
        </div>

        {activeEntries.map((entry) => {
          const band = getCalendarReadinessCssBand(entry.magnitude);

          return (
            <div
              key={`${entry.kind}-${entry.entity_type}-${entry.entity_id}`}
              className="calendar-readiness-entry-row"
              data-band={band}
              data-entity-type={entry.entity_type || "none"}
            >
              <div>
                <strong>{getEntryTargetLabel(entry, targets)}</strong>
                <span>
                  {[
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
              <div className="calendar-readiness-entry-actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={isSaving}
                  onClick={() => handleEditEntry(entry)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="calendar-readiness-delete-button"
                  disabled={isSaving}
                  onClick={() => handleDeleteEntry(entry)}
                >
                  <Trash2 size={14} aria-hidden="true" />
                  Delete
                </button>
              </div>
            </div>
          );
        })}

        {!activeEntries.length && (
          <span className="muted-copy">No entries for this date.</span>
        )}

        <div className="calendar-readiness-save-footer">
          <button
            type="button"
            className="primary-button"
            disabled={isSaving || !hasChanges}
            onClick={handleSaveAll}
          >
            {isSaving ? "Saving..." : "Save entries"}
            {isSaving ? (
              <Loader2 className="spin-icon" size={17} aria-hidden="true" />
            ) : (
              <Save size={17} aria-hidden="true" />
            )}
          </button>
        </div>
      </section>
    </section>
  );
}
