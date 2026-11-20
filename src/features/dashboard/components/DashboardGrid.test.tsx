import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardGrid } from "./DashboardGrid";
import { useDailyStrategy } from "@/features/strategy/hooks/useDailyStrategy";
vi.mock("@/features/auth/context/useAuth", () => ({ useAuth: () => ({ session: { profile: { user_id: 7, preferred_sports: [{ code: "running" }] } } }) }));
vi.mock("@/features/strategy/hooks/useDailyStrategy", () => ({ useDailyStrategy: vi.fn() }));
vi.mock("@/features/workouts/services/workoutApi", () => ({ listWorkouts: vi.fn(async () => ({ data: [] })), createWorkout: vi.fn(), getWorkoutCatalog: vi.fn(async () => ({ data: { exercises: [] } })) }));
vi.mock("@/features/profile/services/profileApi", () => ({ getProfileOptions: vi.fn(async () => ({ data: { sports: [] } })) }));
function renderToday() { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><DashboardGrid /></MemoryRouter></QueryClientProvider>); }
describe("Today", () => {
 beforeEach(() => { localStorage.clear(); vi.mocked(useDailyStrategy).mockReturnValue({ data: { today: { primary: { key: "running", score: 80, session: { title: "Easy run", sport: "running", duration_minutes: 10, blocks: [{ id: "main", format: "steady", duration_seconds: 600, movements: [{ sport: "running" }] }] } }, alternatives: [] } }, isLoading: false, isFetching: false, error: null, refetch: vi.fn() } as unknown as ReturnType<typeof useDailyStrategy>); });
 it("leads with one concrete session and keeps planning details out of the main flow", async () => {
  renderToday(); expect(await screen.findByRole("heading", { name: "Easy run" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Start" })).toBeEnabled();
  expect(screen.queryByText("Next seven days")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Change" }));
  expect(screen.getByRole("button", { name: "Find a session" })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Activities"), { target: { value: "custom" } });
  fireEvent.click(screen.getByRole("button", { name: "running ×" }));
  expect(screen.getByRole("button", { name: "Find a session" })).toBeDisabled();
 });
 it("offers recovery actions when no session fits", async () => {
  vi.mocked(useDailyStrategy).mockReturnValue({ data: { today: { outcome: "no_fit", no_fit_reason: "Nothing fits the selected equipment." } }, isLoading: false, isFetching: false, error: null, refetch: vi.fn() } as unknown as ReturnType<typeof useDailyStrategy>);
  renderToday(); expect(await screen.findByText("Nothing fits the selected equipment.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Adjust today's choices" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Record your own session" })).toBeInTheDocument();
 });
 it("shows readiness advice while leaving a goal-led running session available", async () => {
  vi.mocked(useDailyStrategy).mockReturnValue({ data: { today: { primary: {
   key: "running", recommendation: "avoid_high_intensity",
   advisories: [{ source: "load_estimate", message: "Estimated Achilles load is high." }],
   session: { title: "Tempo run", sport: "running", duration_minutes: 30, blocks: [{ id: "run", format: "steady", duration_seconds: 1800, movements: [{ sport: "running", intensity_zone: "tempo" }] }] },
  } } }, isLoading: false, isFetching: false, refetch: vi.fn() } as unknown as ReturnType<typeof useDailyStrategy>);
  renderToday();
  expect(await screen.findByText("Estimated Achilles load is high.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Start" })).toBeEnabled();
  expect(screen.getByRole("heading", { name: "Tempo run" })).toBeInTheDocument();
  expect(screen.queryByText(/Controlled effort/)).not.toBeInTheDocument();
 });
});
