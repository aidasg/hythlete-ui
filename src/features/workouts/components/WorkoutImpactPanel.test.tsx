import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlannedWorkoutImpact, WorkoutImpactPanel } from "./WorkoutImpactPanel";
import { previewWorkoutImpact } from "../services/workoutApi";
import { useWorkoutImpactPreview } from "../hooks/useWorkoutImpactPreview";

vi.mock("../services/workoutApi", () => ({ previewWorkoutImpact: vi.fn() }));
vi.mock("../hooks/useWorkoutImpactPreview", () => ({ useWorkoutImpactPreview: vi.fn() }));
describe("completed workout impact", () => {
  it("uses stored performed loads including partial completion and substitutions without a planned preview", () => {
    // No query/auth provider: the completed branch must not even mount a preview hook.
    render(<WorkoutImpactPanel workout={{ planned: true, completed: true, blocks: [{ id: "main", format: "straight_sets", rounds: 5, movements: [{ exercise_code: "back_squat", reps: 10 }] }], execution: { blocks: [{ block_id: "main", rounds: 1, movements: [{ exercise_code: "bench_press", reps: 5 }] }] }, muscle_loads: [{ muscle_code: "pectoralis_major", strength_load: 7 }], tissue_loads: [{ region_code: "shoulder", load: 2 }] }} />);
    expect(screen.getByRole("heading", { name: "Areas worked" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Chest" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Front thighs.*worked/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Details"));
    expect(screen.getByText("Estimated session load: 7.00")).toBeInTheDocument();
    expect(previewWorkoutImpact).not.toHaveBeenCalled();
    expect(screen.queryByText(/Before \/ After/)).not.toBeInTheDocument();
  });
});

it("shows distinct readiness advice alongside a planned impact preview", () => {
  vi.mocked(useWorkoutImpactPreview).mockReturnValue({ loading: false, error: null, retry: vi.fn(), preview: { advisories: [
    { source: "load_estimate", message: "Estimated impact load is high." },
    { source: "athlete_report", concern: "strong_caution", message: "You reported an Achilles issue." },
  ] } });
  render(<PlannedWorkoutImpact workout={{ planned: true, sport: "running" }} />);
  expect(screen.getByText("Estimated impact load is high.")).toBeInTheDocument();
  expect(screen.getByText("You reported an Achilles issue.")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Expected areas worked" })).toBeInTheDocument();
});
