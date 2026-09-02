import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileEditor } from "@/features/profile/components/ProfileEditor";
import {
  getProfileOptions,
  type ProfileOptionsResponse,
  type ProfileResponse,
  upsertProfile,
} from "@/features/profile/services/profileApi";

const refreshSession = vi.fn().mockResolvedValue(undefined);

vi.mock("@/features/auth/context/useAuth", () => ({
  useAuth: () => ({ refreshSession }),
}));

vi.mock("@/features/profile/services/profileApi", async (importOriginal) => {
  const original = await importOriginal<
    typeof import("@/features/profile/services/profileApi")
  >();

  return {
    ...original,
    getProfileOptions: vi.fn(),
    upsertProfile: vi.fn(),
  };
});

const running = { id: 1, name: "Running", training_category: "endurance" };
const profile: ProfileResponse = {
  actively_training_since: "2020-01-01",
  birth_date: "1992-06-10",
  email: "athlete@example.com",
  endurance_baselines: [{ sport: "running", threshold_hr_bpm: 170 }],
  goal_priorities: [
    { goal: { id: 1, name: "Build endurance" }, priority: 1, sport: running },
    { goal: { id: 2, name: "Run faster" }, priority: 2, sport: running },
  ],
  preferred_sports: [running],
  preferred_training_days: ["monday", "wednesday"],
  username: "athlete",
  weekly_time_budget_hours: 6,
  weight_kg: 72,
};

const options: ProfileOptionsResponse = {
  sports: [running],
  goals: [
    { id: 1, name: "Build endurance", allowed_sports: [running] },
    { id: 2, name: "Run faster", allowed_sports: [running] },
  ],
};

describe("ProfileEditor", () => {
  beforeEach(() => {
    refreshSession.mockClear();
    vi.mocked(getProfileOptions).mockResolvedValue({ data: options } as never);
    vi.mocked(upsertProfile).mockResolvedValue({ data: profile } as never);
    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: query === "(max-width: 760px)",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  it("uses compact accordions, exposes keyboard reordering, and saves dirty state", async () => {
    const user = userEvent.setup();
    const { container } = render(<ProfileEditor profile={profile} />);

    await screen.findByRole("heading", { name: "Fitness baselines" });

    const sections = [...container.querySelectorAll<HTMLDetailsElement>("details")];
    expect(sections.map((section) => section.open)).toEqual([
      true,
      false,
      false,
      false,
    ]);

    await user.click(screen.getByRole("heading", { name: "Goals and priorities" }));
    const moveUp = screen.getByRole("button", { name: "Move Run faster up" });
    moveUp.focus();
    await user.keyboard("{Enter}");

    const goalList = container.querySelector(".goal-priority-list");
    expect(goalList).not.toBeNull();
    expect(
      [...(goalList as HTMLElement).querySelectorAll("strong")].map(
        (item) => item.textContent
      )
    ).toEqual(["Run faster", "Build endurance"]);

    await user.clear(screen.getByLabelText("Weight, kg"));
    await user.type(screen.getByLabelText("Weight, kg"), "73");
    expect(screen.getByText("You have unsaved changes.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Save profile/ }));

    await waitFor(() => expect(upsertProfile).toHaveBeenCalledOnce());
    expect(refreshSession).toHaveBeenCalledOnce();
    expect(screen.getByRole("status")).toHaveTextContent("Profile saved.");
  });
});
