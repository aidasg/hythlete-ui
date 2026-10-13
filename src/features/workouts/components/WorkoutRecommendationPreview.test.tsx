import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WorkoutRecommendationPreview } from "@/features/workouts/components/WorkoutRecommendationPreview";

vi.mock("@/features/workouts/components/WorkoutCreateForm", () => ({
  WorkoutCreateForm: ({ initialWorkout }: { initialWorkout?: { breakthrough_candidate_id?: number } }) => (
    <div data-testid="draft-form">
      {initialWorkout?.breakthrough_candidate_id
        ? `Linked ${initialWorkout.breakthrough_candidate_id}`
        : "Unlinked"}
    </div>
  ),
}));

describe("WorkoutRecommendationPreview", () => {
  it("labels both variants and keeps the minimum-effective fallback unlinked", async () => {
    const user = userEvent.setup();
    const onDraftSelect = vi.fn();
    const props = {
      option: { key: "strength", focus: "max_strength", score: 90 },
      date: "2026-09-02",
      catalog: null,
      isLoading: false,
      errorMessage: null,
      onDraftSelect,
      onRetry: vi.fn(),
      onCreated: vi.fn(),
    };
    const prescription = {
      workouts: [
        {
          key: "strength:standard",
          title: "Strength attempt",
          variant: "standard",
          workout: {
            title: "Strength attempt",
            duration_minutes: 45,
            breakthrough_candidate_id: 12,
          },
        },
        {
          key: "strength:minimum",
          title: "Strength development",
          variant: "minimum_effective",
          workout: { title: "Strength development", duration_minutes: 25 },
        },
      ],
    };

    const { rerender } = render(
      <WorkoutRecommendationPreview
        {...props}
        prescription={prescription}
        selectedDraftIndex={0}
      />
    );
    expect(screen.getByRole("button", { name: "Standard" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Minimum effective" })).toBeInTheDocument();
    expect(screen.getByTestId("draft-form")).toHaveTextContent("Linked 12");

    await user.click(screen.getByRole("button", { name: "Minimum effective" }));
    expect(onDraftSelect).toHaveBeenCalledWith(1);
    rerender(
      <WorkoutRecommendationPreview
        {...props}
        prescription={prescription}
        selectedDraftIndex={1}
      />
    );
    expect(screen.getByTestId("draft-form")).toHaveTextContent("Unlinked");
  });
});
