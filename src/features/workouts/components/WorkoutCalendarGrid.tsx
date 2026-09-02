import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileUp,
  Loader2,
  Menu,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { CalendarReadinessEntryResponse } from "@/features/workouts/services/calendarReadinessApi";
import {
  clampMagnitude,
  formatCalendarReadinessValue,
  getCalendarReadinessBandLabel,
  getCalendarReadinessCssBand,
  isActiveCalendarReadinessEntry,
  sortCalendarReadinessEntries,
} from "@/features/workouts/services/calendarReadiness";
import type { WorkoutResponse } from "@/features/workouts/services/workoutApi";
import {
  formatMonthLabel,
  formatDisplayDate,
  getCalendarDays,
  getMonthKey,
  getTodayKey,
  shiftMonth,
} from "@/features/workouts/services/workoutDates";

type WorkoutCalendarGridProps = {
  monthKey: string;
  selectedDate: string;
  workouts: WorkoutResponse[];
  readinessEntriesByDate?: Record<string, CalendarReadinessEntryResponse[]>;
  isLoading: boolean;
  onDateSelect: (date: string) => void;
  onCreateWorkout: (date: string) => void;
  onCreateReadinessEntry: (date: string) => void;
  onImportFit: () => void;
  onMonthChange: (monthKey: string) => void;
  onWorkoutDelete: (workout: WorkoutResponse) => void;
  onWorkoutSelect: (workout: WorkoutResponse) => void;
  deletingWorkoutId?: number | null;
};

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getWorkoutTitle(workout: WorkoutResponse) {
  return workout.title || workout.subtype || workout.category || "Workout";
}

function getPrimaryScore(workout: WorkoutResponse) {
  if (typeof workout.loads?.endurance_load === "number") {
    return {
      label: "ASS",
      value: workout.loads.endurance_load,
    };
  }

  if (typeof workout.loads?.strength_load === "number") {
    return {
      label: "SSS",
      value: workout.loads.strength_load,
    };
  }

  if (typeof workout.loads?.global_muscular_load === "number") {
    return {
      label: "MLS",
      value: workout.loads.global_muscular_load,
    };
  }

  if (typeof workout.loads?.global_cardio_load === "number") {
    return {
      label: "CLS",
      value: workout.loads.global_cardio_load,
    };
  }

  return null;
}

function getReadinessMarkerTitle(entry: CalendarReadinessEntryResponse) {
  return [
    formatCalendarReadinessValue(entry.kind) || "Readiness",
    formatCalendarReadinessValue(entry.entity_id) || entry.entity_id || "Target",
    getCalendarReadinessBandLabel(entry.magnitude),
    clampMagnitude(entry.magnitude),
  ]
    .filter(Boolean)
    .join(" / ");
}

export function WorkoutCalendarGrid({
  monthKey,
  selectedDate,
  workouts,
  readinessEntriesByDate = {},
  isLoading,
  onDateSelect,
  onCreateWorkout,
  onCreateReadinessEntry,
  onImportFit,
  onMonthChange,
  onWorkoutDelete,
  onWorkoutSelect,
  deletingWorkoutId = null,
}: WorkoutCalendarGridProps) {
  const [openActionsKey, setOpenActionsKey] = useState<string | null>(null);
  const [openAddMenuKey, setOpenAddMenuKey] = useState<string | null>(null);
  const days = useMemo(() => getCalendarDays(monthKey), [monthKey]);
  const agendaDays = useMemo(() => {
    const selectedIndex = Math.max(
      0,
      days.findIndex((day) => day.date === selectedDate)
    );

    return days.slice(selectedIndex, selectedIndex + 7);
  }, [days, selectedDate]);
  const workoutsByDate = useMemo(
    () =>
      workouts.reduce<Record<string, WorkoutResponse[]>>((groupedWorkouts, workout) => {
        if (!workout.date) {
          return groupedWorkouts;
        }

        groupedWorkouts[workout.date] = [
          ...(groupedWorkouts[workout.date] || []),
          workout,
        ];

        return groupedWorkouts;
      }, {}),
    [workouts]
  );

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (
        event.target instanceof Element &&
        (event.target.closest("[data-workout-actions]") ||
          event.target.closest("[data-calendar-add-menu]"))
      ) {
        return;
      }

      setOpenActionsKey(null);
      setOpenAddMenuKey(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenActionsKey(null);
        setOpenAddMenuKey(null);
      }
    }

    document.addEventListener("click", handleDocumentClick);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("click", handleDocumentClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function renderAddMenu(date: string) {
    return (
      <div className="calendar-add-actions-menu" role="menu">
        <button
          type="button"
          role="menuitem"
          className="calendar-add-action"
          onClick={() => {
            setOpenAddMenuKey(null);
            onCreateWorkout(date);
          }}
        >
          <Plus size={14} aria-hidden="true" />
          Workout
        </button>
        <button
          type="button"
          role="menuitem"
          className="calendar-add-action"
          onClick={() => {
            setOpenAddMenuKey(null);
            onCreateReadinessEntry(date);
          }}
        >
          <AlertTriangle size={14} aria-hidden="true" />
          Limiter / Injury
        </button>
      </div>
    );
  }

  function renderSecondaryMenu(date: string) {
    return (
      <div className="calendar-add-actions-menu" role="menu">
        <button
          type="button"
          role="menuitem"
          className="calendar-add-action"
          onClick={() => {
            setOpenAddMenuKey(null);
            onCreateReadinessEntry(date);
          }}
        >
          <AlertTriangle size={14} aria-hidden="true" />
          Limiter / injury
        </button>
        <button
          type="button"
          role="menuitem"
          className="calendar-add-action"
          onClick={() => {
            setOpenAddMenuKey(null);
            onImportFit();
          }}
        >
          <FileUp size={14} aria-hidden="true" />
          Import FIT
        </button>
      </div>
    );
  }

  return (
    <section className="workout-calendar-panel" aria-labelledby="workout-calendar-title">
      <div className="workout-calendar-header">
        <div>
          <span className="eyebrow">Workout calendar</span>
          <h1 id="workout-calendar-title">{formatMonthLabel(monthKey)}</h1>
        </div>

        <div className="calendar-nav">
          <button
            type="button"
            className="calendar-add-button"
            onClick={() => onCreateWorkout(selectedDate)}
          >
            <Plus size={17} aria-hidden="true" />
            Add workout
          </button>
          <div className="calendar-add-menu-wrap" data-calendar-add-menu>
            <button
              type="button"
              className="icon-button"
              aria-label="More calendar actions"
              aria-expanded={openAddMenuKey === "header-more"}
              aria-haspopup="menu"
              onClick={() =>
                setOpenAddMenuKey((currentKey) =>
                  currentKey === "header-more" ? null : "header-more"
                )
              }
            >
              <MoreHorizontal size={18} aria-hidden="true" />
            </button>
            {openAddMenuKey === "header-more" &&
              renderSecondaryMenu(selectedDate)}
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Previous month"
            onClick={() => onMonthChange(shiftMonth(monthKey, -1))}
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="calendar-today-button"
            onClick={() => {
              const today = getTodayKey();

              onMonthChange(getMonthKey(today));
              onDateSelect(today);
            }}
          >
            <CalendarDays size={17} aria-hidden="true" />
            Today
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Next month"
            onClick={() => onMonthChange(shiftMonth(monthKey, 1))}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="calendar-month-view">
        <div className="calendar-weekdays" aria-hidden="true">
          {weekdayLabels.map((weekday) => (
            <span key={weekday}>{weekday}</span>
          ))}
        </div>

        <div className="calendar-grid" aria-busy={isLoading}>
          {days.map((day) => {
          const dayWorkouts = workoutsByDate[day.date] || [];
          const visibleWorkouts = dayWorkouts.slice(0, 2);
          const dayReadinessEntries = sortCalendarReadinessEntries(
            (readinessEntriesByDate[day.date] || []).filter(
              isActiveCalendarReadinessEntry
            )
          );
          const visibleReadinessEntries = dayReadinessEntries.slice(0, 3);
          const dayAddMenuKey = `day-${day.date}`;

          return (
            <div
              key={day.date}
              className={[
                "calendar-day",
                day.isCurrentMonth ? "" : "is-outside-month",
                day.date === selectedDate ? "is-selected" : "",
                day.isToday ? "is-today" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="calendar-day-top">
                <button
                  type="button"
                  className="calendar-day-button"
                  aria-pressed={day.date === selectedDate}
                  onClick={() => onDateSelect(day.date)}
                >
                  <span>{day.dayOfMonth}</span>
                  {dayWorkouts.length > 0 && (
                    <small>
                      {dayWorkouts.length}{" "}
                      {dayWorkouts.length === 1 ? "session" : "sessions"}
                    </small>
                  )}
                </button>
                <div className="calendar-add-menu-wrap" data-calendar-add-menu>
                  <button
                    type="button"
                    className="calendar-day-add-button"
                    aria-label={`Add on ${day.date}`}
                    aria-expanded={openAddMenuKey === dayAddMenuKey}
                    aria-haspopup="menu"
                    title="Add"
                    onClick={() =>
                      setOpenAddMenuKey((currentKey) =>
                        currentKey === dayAddMenuKey ? null : dayAddMenuKey
                      )
                    }
                  >
                    <Plus size={15} aria-hidden="true" />
                  </button>
                  {openAddMenuKey === dayAddMenuKey && renderAddMenu(day.date)}
                </div>
              </div>

              {dayReadinessEntries.length > 0 && (
                <div
                  className="calendar-readiness-marker-list"
                  aria-label={`${dayReadinessEntries.length} readiness entries`}
                >
                  {visibleReadinessEntries.map((entry, index) => (
                    <span
                      key={`${entry.kind}-${entry.entity_type}-${entry.entity_id}-${index}`}
                      data-band={getCalendarReadinessCssBand(entry.magnitude)}
                      title={getReadinessMarkerTitle(entry)}
                    >
                      {formatCalendarReadinessValue(entry.kind)?.charAt(0) || "R"}
                    </span>
                  ))}
                  {dayReadinessEntries.length > visibleReadinessEntries.length && (
                    <small>
                      +{dayReadinessEntries.length - visibleReadinessEntries.length}
                    </small>
                  )}
                </div>
              )}

              <div className="calendar-day-workouts">
                {visibleWorkouts.map((workout, index) => {
                  const primaryScore = getPrimaryScore(workout);
                  const key = workout.id ?? `${day.date}-${index}`;
                  const actionsKey = String(key);
                  const isActionsOpen = openActionsKey === actionsKey;
                  const isDeleting = Boolean(workout.id && workout.id === deletingWorkoutId);

                  return (
                    <div
                      key={key}
                      className="calendar-workout-card"
                      data-workout-actions
                    >
                      <button
                        type="button"
                        className="calendar-workout-chip"
                        onClick={() => {
                          setOpenActionsKey(null);
                          onWorkoutSelect(workout);
                        }}
                      >
                        <span>{getWorkoutTitle(workout)}</span>
                        {primaryScore && (
                          <small>
                            {primaryScore.label} {Math.round(primaryScore.value)}
                          </small>
                        )}
                      </button>
                      <button
                        type="button"
                        className="calendar-workout-menu-button"
                        aria-expanded={isActionsOpen}
                        aria-haspopup="menu"
                        aria-label={`Workout actions for ${getWorkoutTitle(workout)}`}
                        title="Workout actions"
                        disabled={isDeleting}
                        onClick={() =>
                          setOpenActionsKey((currentKey) =>
                            currentKey === actionsKey ? null : actionsKey
                          )
                        }
                      >
                        {isDeleting ? (
                          <Loader2 className="spin-icon" size={14} aria-hidden="true" />
                        ) : (
                          <Menu size={14} aria-hidden="true" />
                        )}
                      </button>
                      {isActionsOpen && (
                        <div className="calendar-workout-actions-menu" role="menu">
                          <button
                            type="button"
                            role="menuitem"
                            className="calendar-workout-action-delete"
                            disabled={isDeleting || !workout.id}
                            onClick={() => {
                              setOpenActionsKey(null);
                              onWorkoutDelete(workout);
                            }}
                          >
                            <Trash2 size={14} aria-hidden="true" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {dayWorkouts.length > visibleWorkouts.length && (
                  <span className="calendar-more-count">
                    +{dayWorkouts.length - visibleWorkouts.length}
                  </span>
                )}
              </div>
            </div>
          );
          })}
        </div>
      </div>

      <div className="calendar-agenda" aria-busy={isLoading}>
        <div className="calendar-agenda-heading">
          <span>Seven-day agenda</span>
          <small>Starting {formatDisplayDate(selectedDate)}</small>
        </div>
        {agendaDays.map((day) => {
          const dayWorkouts = workoutsByDate[day.date] || [];
          const readinessCount = (readinessEntriesByDate[day.date] || []).filter(
            isActiveCalendarReadinessEntry
          ).length;
          const addMenuKey = `agenda-${day.date}`;

          return (
            <section
              key={day.date}
              className={`agenda-day${day.date === selectedDate ? " is-selected" : ""}`}
            >
              <div className="agenda-day-heading">
                <button type="button" onClick={() => onDateSelect(day.date)}>
                  <strong>{formatDisplayDate(day.date)}</strong>
                  <span>
                    {dayWorkouts.length
                      ? `${dayWorkouts.length} ${dayWorkouts.length === 1 ? "session" : "sessions"}`
                      : "Open day"}
                    {readinessCount ? ` · ${readinessCount} limiter` : ""}
                  </span>
                </button>
                <div className="calendar-add-menu-wrap" data-calendar-add-menu>
                  <button
                    type="button"
                    className="calendar-day-add-button"
                    aria-label={`Add on ${day.date}`}
                    aria-expanded={openAddMenuKey === addMenuKey}
                    aria-haspopup="menu"
                    onClick={() =>
                      setOpenAddMenuKey((currentKey) =>
                        currentKey === addMenuKey ? null : addMenuKey
                      )
                    }
                  >
                    <Plus size={16} aria-hidden="true" />
                  </button>
                  {openAddMenuKey === addMenuKey && renderAddMenu(day.date)}
                </div>
              </div>
              {dayWorkouts.map((workout, index) => (
                <button
                  type="button"
                  className="agenda-workout"
                  key={workout.id || `${day.date}-${index}`}
                  onClick={() => onWorkoutSelect(workout)}
                >
                  <span>{getWorkoutTitle(workout)}</span>
                  <small>
                    {typeof workout.duration_minutes === "number"
                      ? `${Math.round(workout.duration_minutes)} min`
                      : workout.category || "View details"}
                  </small>
                </button>
              ))}
            </section>
          );
        })}
      </div>
    </section>
  );
}
