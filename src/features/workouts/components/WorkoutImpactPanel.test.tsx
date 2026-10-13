import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkoutImpactPanel } from "./WorkoutImpactPanel";
import { previewWorkoutImpact } from "../services/workoutApi";

vi.mock("../services/workoutApi", () => ({ previewWorkoutImpact: vi.fn() }));
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
