import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileSetup } from "@/features/profile/components/ProfileSetup";
import { getProfileOptions, type ProfileResponse, upsertProfile } from "@/features/profile/services/profileApi";

const refreshSession = vi.fn().mockResolvedValue(undefined);
vi.mock("@/features/auth/context/useAuth", () => ({ useAuth: () => ({ refreshSession }) }));
vi.mock("@/features/profile/services/profileApi", async (original) => ({
  ...await original<typeof import("@/features/profile/services/profileApi")>(),
  getProfileOptions: vi.fn(),
  upsertProfile: vi.fn(),
}));

const running = { id: 1, code: "running", name: "Running", training_category: "endurance" };
const complete: ProfileResponse = {
  birth_date: "1992-06-10", actively_training_since: "2020-01-01", weight_kg: 72,
  timezone: "Europe/Vilnius", weekly_time_budget_hours: 5,
  preferred_training_days: ["monday"], preferred_sports: [running],
  goal_priorities: [{ goal: { id: 1, name: "Build endurance" }, sport: running, priority: 1 }],
  endurance_baselines: [],
};

function renderSetup(profile: ProfileResponse | undefined = undefined) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<MemoryRouter initialEntries={["/setup"]}><QueryClientProvider client={queryClient}>
    <Routes>
      <Route path="/setup" element={<ProfileSetup profile={profile} />} />
      <Route path="/dashboard" element={<h1>Dashboard reached</h1>} />
      <Route path="/profile" element={<h1>Profile reached</h1>} />
    </Routes>
  </QueryClientProvider></MemoryRouter>);
}

describe("ProfileSetup", () => {
  beforeEach(() => {
    refreshSession.mockClear();
    vi.mocked(getProfileOptions).mockResolvedValue({
      data: { sports: [running], goals: [{ id: 1, name: "Build endurance", allowed_sports: [running] }] },
    } as never);
    vi.mocked(upsertProfile).mockResolvedValue({ data: complete } as never);
  });

  it("allows a new user to skip without saving", async () => {
    const user = userEvent.setup();
    renderSetup();
    await user.click(screen.getByRole("button", { name: "Skip for now" }));
    expect(screen.getByRole("heading", { name: "Dashboard reached" })).toBeInTheDocument();
    expect(upsertProfile).not.toHaveBeenCalled();
  });

  it("completes four steps without requiring baselines", async () => {
    const user = userEvent.setup();
    renderSetup();
    await screen.findByRole("heading", { name: "Activities" });
    await user.click(screen.getByRole("button", { name: "Add activity" }));
    const results = screen.getByRole("list", { name: "Available activities" });
    await user.click(within(results).getByRole("button", { name: "Running" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("heading", { name: "Primary goal" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Build endurance/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByLabelText("Mon"));
    await user.type(screen.getByLabelText("Weekly time budget, hours"), "5");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.type(screen.getByLabelText("Birth date"), "1992-06-10");
    await user.type(screen.getByLabelText("Training since"), "2020-01-01");
    await user.type(screen.getByLabelText("Weight, kg"), "72");
    await user.click(screen.getByRole("button", { name: "Finish setup" }));
    await waitFor(() => expect(upsertProfile).toHaveBeenCalledOnce());
    expect(upsertProfile).toHaveBeenCalledWith(expect.objectContaining({
      preferred_sport_ids: [1],
      preferred_training_days: ["monday"],
      goal_priorities: [{ goal_id: 1, sport_id: 1, priority: 1 }],
      endurance_baselines: [],
    }));
    expect(await screen.findByRole("heading", { name: "Dashboard reached" })).toBeInTheDocument();
  });

  it("sends completed profiles to the overview", () => {
    renderSetup(complete);
    expect(screen.getByRole("heading", { name: "Profile reached" })).toBeInTheDocument();
  });

  it("retries when options fail to load", async () => {
    const user = userEvent.setup();
    vi.mocked(getProfileOptions).mockRejectedValueOnce(new Error("offline"));
    renderSetup();
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load setup options");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("button", { name: "Add activity" })).toBeInTheDocument();
  });
});
