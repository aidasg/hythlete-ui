import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileEditor } from "@/features/profile/components/ProfileEditor";
import { getProfileOptions, type ProfileOptionsResponse, type ProfileResponse, upsertProfile } from "@/features/profile/services/profileApi";

const refreshSession = vi.fn().mockResolvedValue(undefined);
vi.mock("@/features/auth/context/useAuth", () => ({ useAuth: () => ({ refreshSession }) }));
vi.mock("@/features/profile/services/profileApi", async (original) => ({
  ...await original<typeof import("@/features/profile/services/profileApi")>(),
  getProfileOptions: vi.fn(),
  upsertProfile: vi.fn(),
}));

const running = { id: 1, code: "running", name: "Running", training_category: "endurance" };
const cycling = { id: 2, code: "cycling", name: "Cycling", training_category: "endurance" };
const profile: ProfileResponse = {
  birth_date: "1992-06-10",
  actively_training_since: "2020-01-01",
  weight_kg: 72,
  timezone: "Europe/Vilnius",
  weekly_time_budget_hours: 6,
  preferred_training_days: ["monday", "wednesday"],
  preferred_sports: [running],
  endurance_baselines: [{ sport: "running", threshold_hr_bpm: 170 }],
  goal_priorities: [{ goal: { id: 1, name: "Build endurance", allowed_sports: [running] }, sport: running, priority: 1 }],
  email: "athlete@example.com",
  username: "athlete",
};
const options: ProfileOptionsResponse = {
  sports: [running, cycling, ...Array.from({ length: 120 }, (_, i) => ({
    id: 100 + i, code: `activity_${i}`, name: `Activity ${i}`, training_category: "mixed",
  }))],
  goals: [{ id: 1, name: "Build endurance", allowed_sports: [running] }],
};

function renderEditor(value = profile) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<MemoryRouter><QueryClientProvider client={queryClient}>
    <ProfileEditor profile={value} />
  </QueryClientProvider></MemoryRouter>);
}

describe("ProfileEditor", () => {
  beforeEach(() => {
    refreshSession.mockClear();
    vi.mocked(getProfileOptions).mockResolvedValue({ data: options } as never);
    vi.mocked(upsertProfile).mockResolvedValue({ data: profile } as never);
  });

  it("searches a large catalog, focuses one baseline, and preserves the full payload", async () => {
    const user = userEvent.setup();
    renderEditor();
    await waitFor(() => expect(getProfileOptions).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "Manage activities" }));
    expect(screen.getByRole("heading", { name: "Running" })).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/Threshold heart rate/));
    await user.type(screen.getByLabelText(/Threshold heart rate/), "175");
    await user.click(screen.getByRole("button", { name: "Add activity" }));
    await user.type(screen.getByRole("searchbox", { name: "Search activities" }), "Cycling");
    const results = screen.getByRole("list", { name: "Available activities" });
    expect(within(results).getByRole("button", { name: "Cycling" })).toBeInTheDocument();
    expect(within(results).queryByRole("button", { name: "Activity 5" })).not.toBeInTheDocument();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("heading", { name: "Cycling" })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Add a metric"), "ftpWatts");
    await user.type(screen.getByLabelText(/Functional threshold power/), "250");
    await user.click(screen.getByRole("button", { name: "Running" }));
    expect(screen.getByLabelText(/Threshold heart rate/)).toHaveValue(175);
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(upsertProfile).toHaveBeenCalledOnce());
    expect(upsertProfile).toHaveBeenCalledWith(expect.objectContaining({
      preferred_sport_ids: [1, 2],
      preferred_training_days: ["monday", "wednesday"],
      goal_priorities: [{ goal_id: 1, sport_id: 1, priority: 1 }],
      endurance_baselines: expect.arrayContaining([
        expect.objectContaining({ sport: "running", threshold_hr_bpm: 175 }),
        expect.objectContaining({ sport: "cycling", ftp_watts: 250 }),
      ]),
    }));
    expect(refreshSession).toHaveBeenCalledOnce();
  });

  it("requires goal reassignment before removing its activity and keeps other baselines", async () => {
    const user = userEvent.setup();
    const withCycling: ProfileResponse = {
      ...profile,
      preferred_sports: [running, cycling],
      endurance_baselines: [
        { sport: "running", threshold_hr_bpm: 170 },
        { sport: "cycling", ftp_watts: 245 },
      ],
    };
    vi.mocked(upsertProfile).mockResolvedValue({ data: withCycling } as never);
    renderEditor(withCycling);
    await waitFor(() => expect(getProfileOptions).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "Manage activities" }));
    await user.click(screen.getByRole("button", { name: "Remove activity from profile" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Reassign the goal");
    await user.click(screen.getByRole("button", { name: "Cycling" }));
    await user.click(screen.getByRole("button", { name: "Remove activity from profile" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(upsertProfile).toHaveBeenCalledOnce());
    expect(upsertProfile).toHaveBeenCalledWith(expect.objectContaining({
      preferred_sport_ids: [1],
      endurance_baselines: expect.arrayContaining([expect.objectContaining({ sport: "cycling", ftp_watts: 245 })]),
    }));
  });
});
