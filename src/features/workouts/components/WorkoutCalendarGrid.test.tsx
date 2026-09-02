import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WorkoutCalendarGrid } from "@/features/workouts/components/WorkoutCalendarGrid";

function renderCalendar() {
  const onCreateWorkout = vi.fn();
  const onCreateReadinessEntry = vi.fn();
  const onImportFit = vi.fn();

  render(
    <WorkoutCalendarGrid
      monthKey="2026-08"
      selectedDate="2026-08-29"
      workouts={[
        {
          id: 7,
          date: "2026-08-29",
          title: "Aerobic intervals",
          duration_minutes: 50,
        },
      ]}
      isLoading={false}
      onDateSelect={vi.fn()}
      onCreateWorkout={onCreateWorkout}
      onCreateReadinessEntry={onCreateReadinessEntry}
      onImportFit={onImportFit}
      onMonthChange={vi.fn()}
      onWorkoutDelete={vi.fn()}
      onWorkoutSelect={vi.fn()}
    />
  );

  return { onCreateWorkout, onCreateReadinessEntry, onImportFit };
}

describe("WorkoutCalendarGrid", () => {
  it("keeps Add workout primary and exposes secondary actions in a dismissible menu", async () => {
    const user = userEvent.setup();
    const { onCreateWorkout, onCreateReadinessEntry, onImportFit } = renderCalendar();

    expect(screen.getByText("Seven-day agenda")).toBeInTheDocument();
    expect(screen.getAllByText("Aerobic intervals")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Add workout" }));
    expect(onCreateWorkout).toHaveBeenCalledWith("2026-08-29");

    await user.click(screen.getByRole("button", { name: "More calendar actions" }));
    expect(screen.getByRole("menuitem", { name: "Limiter / injury" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Import FIT" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menuitem", { name: "Import FIT" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "More calendar actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Limiter / injury" }));
    expect(onCreateReadinessEntry).toHaveBeenCalledWith("2026-08-29");
    expect(onImportFit).not.toHaveBeenCalled();
  });
});
