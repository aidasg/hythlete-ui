import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTodayOverview } from "@/features/dashboard/hooks/useTodayOverview";
import {
  getWorkoutReadiness,
  listWorkouts,
} from "@/features/workouts/services/workoutApi";

vi.mock("@/features/workouts/services/workoutApi", () => ({
  getWorkoutReadiness: vi.fn(),
  listWorkouts: vi.fn(),
}));

const mockedListWorkouts = vi.mocked(listWorkouts);
const mockedGetWorkoutReadiness = vi.mocked(getWorkoutReadiness);

describe("useTodayOverview", () => {
  beforeEach(() => {
    mockedListWorkouts.mockResolvedValue({
      data: [
        { id: 1, date: "2099-01-01", title: "Today's session", planned: true },
        { id: 2, date: "2099-01-02", title: "Next session", planned: true },
      ],
      error: undefined,
      response: new Response(),
    } as Awaited<ReturnType<typeof listWorkouts>>);
    mockedGetWorkoutReadiness.mockResolvedValue({
      data: {
        recommendation: "train",
        training_options: [
          { key: "easy", focus: "easy_endurance", score: 72 },
          { key: "strength", focus: "strength", score: 88 },
        ],
      },
      error: undefined,
      response: new Response(),
    } as Awaited<ReturnType<typeof getWorkoutReadiness>>);
  });

  it("keeps the highest-ranked option and can refresh without clearing data", async () => {
    const { result } = renderHook(() => useTodayOverview());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.topTrainingOption?.key).toBe("strength");

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockedListWorkouts).toHaveBeenCalledTimes(2);
    expect(result.current.topTrainingOption?.key).toBe("strength");
  });
});
