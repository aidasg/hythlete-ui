import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileUp,
  Plus,
} from "lucide-react";
import { useMemo } from "react";
import type { WorkoutResponse } from "@/features/workouts/services/workoutApi";
import {
  formatMonthLabel,
  getCalendarDays,
  getMonthKey,
  getTodayKey,
  shiftMonth,
} from "@/features/workouts/services/workoutDates";

type WorkoutCalendarGridProps = {
  monthKey: string;
  selectedDate: string;
  workouts: WorkoutResponse[];
  isLoading: boolean;
  onDateSelect: (date: string) => void;
  onCreateWorkout: (date: string) => void;
  onImportFit: () => void;
  onMonthChange: (monthKey: string) => void;
  onWorkoutSelect: (workout: WorkoutResponse) => void;
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

export function WorkoutCalendarGrid({
  monthKey,
  selectedDate,
  workouts,
  isLoading,
  onDateSelect,
  onCreateWorkout,
  onImportFit,
  onMonthChange,
  onWorkoutSelect,
}: WorkoutCalendarGridProps) {
  const days = useMemo(() => getCalendarDays(monthKey), [monthKey]);
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
            New workout
          </button>
          <button
            type="button"
            className="calendar-import-button"
            onClick={onImportFit}
          >
            <FileUp size={17} aria-hidden="true" />
            Import FIT
          </button>
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

      <div className="calendar-weekdays" aria-hidden="true">
        {weekdayLabels.map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>

      <div className="calendar-grid" aria-busy={isLoading}>
        {days.map((day) => {
          const dayWorkouts = workoutsByDate[day.date] || [];
          const visibleWorkouts = dayWorkouts.slice(0, 2);

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
                <button
                  type="button"
                  className="calendar-day-add-button"
                  aria-label={`Add workout on ${day.date}`}
                  title="Add workout"
                  onClick={() => onCreateWorkout(day.date)}
                >
                  <Plus size={15} aria-hidden="true" />
                </button>
              </div>

              <div className="calendar-day-workouts">
                {visibleWorkouts.map((workout, index) => {
                  const primaryScore = getPrimaryScore(workout);
                  const key = workout.id ?? `${day.date}-${index}`;

                  return (
                    <button
                      key={key}
                      type="button"
                      className="calendar-workout-chip"
                      onClick={() => onWorkoutSelect(workout)}
                    >
                      <span>{getWorkoutTitle(workout)}</span>
                      {primaryScore && (
                        <small>
                          {primaryScore.label} {Math.round(primaryScore.value)}
                        </small>
                      )}
                    </button>
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
    </section>
  );
}
