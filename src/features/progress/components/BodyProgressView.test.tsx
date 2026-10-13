import { act, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { BodyProgressView } from "./BodyProgressView";
import { getWorkoutCatalog, getWorkoutReadiness } from "@/features/workouts/services/workoutApi";
import { listCalendarReadinessEntries } from "@/features/workouts/services/calendarReadinessApi";
import { invalidateWorkoutDerivedData } from "@/services/query/invalidation";

const account = vi.hoisted(() => ({ uid: 1 }));
vi.mock("@/features/auth/context/useAuth", () => ({ useAuth: () => ({ session: { profile: { user_id: account.uid } } }) }));
vi.mock("@/features/workouts/services/workoutApi", () => ({ getWorkoutCatalog: vi.fn(), getWorkoutReadiness: vi.fn() }));
vi.mock("@/features/workouts/services/calendarReadinessApi", () => ({ listCalendarReadinessEntries: vi.fn() }));

it("isolates body evidence on account changes and refreshes it after a workout or date change", async () => {
  vi.mocked(getWorkoutCatalog).mockResolvedValue({ data: { muscles: [] }, response: new Response() });
  vi.mocked(listCalendarReadinessEntries).mockResolvedValue({ data: { entries: [] }, response: new Response() });
  vi.mocked(getWorkoutReadiness).mockImplementation(async () => ({ data: { entities: [{ entity_type: "muscle", entity_id: account.uid === 1 ? "gastrocnemius" : "pectoralis_major", acute_load: 24, label: "ready" }] }, response: new Response() }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = (date: string) => <QueryClientProvider client={client}><BodyProgressView date={date} /></QueryClientProvider>;
  const { rerender } = render(view("2026-10-13"));
  expect(await screen.findByRole("heading", { name: "Calves" })).toBeInTheDocument();
  account.uid = 2;
  rerender(view("2026-10-13"));
  expect(screen.queryByRole("heading", { name: "Calves" })).not.toBeInTheDocument();
  expect(await screen.findByRole("heading", { name: "Chest" })).toBeInTheDocument();
  expect(within(screen.getByRole("list", { name: "Muscle regions" })).queryByText("Calves")).not.toBeInTheDocument();
  await act(async () => { await invalidateWorkoutDerivedData(client); });
  expect(getWorkoutReadiness).toHaveBeenCalledTimes(3);
  rerender(view("2026-10-14"));
  await waitFor(() => expect(getWorkoutReadiness).toHaveBeenLastCalledWith("2026-10-14"));
  expect(listCalendarReadinessEntries).toHaveBeenLastCalledWith({ from: "2026-09-15", to: "2026-10-14" });
});
