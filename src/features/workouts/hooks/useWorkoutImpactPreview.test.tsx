import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkoutImpactPreview } from "./useWorkoutImpactPreview";
import { previewWorkoutImpact, type WorkoutRequest } from "../services/workoutApi";
import { invalidateWorkoutDerivedData } from "@/services/query/invalidation";

const account = vi.hoisted(() => ({ uid: 1, day: "2026-10-13" }));
vi.mock("@/features/auth/context/useAuth", () => ({ useAuth: () => ({ session: { profile: { user_id: account.uid } } }) }));
vi.mock("@/features/strategy/hooks/useTodayDate", () => ({ useTodayDate: () => account.day }));
vi.mock("../services/workoutApi", () => ({ previewWorkoutImpact: vi.fn() }));
type Response = Awaited<ReturnType<typeof previewWorkoutImpact>>;
const response = (load: number) => ({ data: { muscle_loads: [{ muscle_code: "gastrocnemius", endurance_load: load }] } }) as Response;
function setup(workout: WorkoutRequest = { duration_minutes: 10, planned: true }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, ...renderHook(({ value }) => useWorkoutImpactPreview(value), { wrapper, initialProps: { value: workout } }) };
}
const advance = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

describe("planned impact requests", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.mocked(previewWorkoutImpact).mockReset(); account.uid = 1; account.day = "2026-10-13"; });
  afterEach(() => { vi.useRealTimers(); });
  it("debounces 300 ms, cancels previous requests, and discards late responses", async () => {
    let oldResponse!: (value: Response) => void;
    let newResponse!: (value: Response) => void;
    vi.mocked(previewWorkoutImpact).mockImplementationOnce(() => new Promise(resolve => { oldResponse = resolve; })).mockImplementationOnce(() => new Promise(resolve => { newResponse = resolve; }));
    const { result, rerender } = setup();
    await advance(299); expect(previewWorkoutImpact).not.toHaveBeenCalled();
    await advance(1); expect(previewWorkoutImpact).toHaveBeenCalledTimes(1);
    const oldSignal = vi.mocked(previewWorkoutImpact).mock.calls[0]![1]!;
    rerender({ value: { duration_minutes: 20, planned: true } });
    expect(result.current.preview).toBeUndefined(); expect(result.current.loading).toBe(true); expect(oldSignal.aborted).toBe(true);
    await advance(300);
    await act(async () => { newResponse(response(20)); }); await advance(1);
    expect(result.current.preview?.muscle_loads?.[0]?.endurance_load).toBe(20);
    await act(async () => { oldResponse(response(10)); }); await advance(1);
    expect(result.current.preview?.muscle_loads?.[0]?.endurance_load).toBe(20);
  });
  it("clears an already displayed estimate on edits and marks failures explicitly", async () => {
    vi.mocked(previewWorkoutImpact).mockResolvedValueOnce(response(10)).mockRejectedValueOnce(new Error("Offline"));
    const { result, rerender } = setup(); await advance(301); await advance(1);
    expect(result.current.preview).toBeDefined();
    rerender({ value: { duration_minutes: 30, planned: true } });
    expect(result.current.preview).toBeUndefined(); expect(result.current.loading).toBe(true);
    await advance(301); await advance(1); expect(result.current.preview).toBeUndefined(); expect(result.current.error?.message).toBe("Offline");
  });
  it("never previews completed workouts, even if their planned flag remains set", async () => {
    const { result } = setup({ planned: true, completed: true }); await advance(1000);
    expect(previewWorkoutImpact).not.toHaveBeenCalled(); expect(result.current.preview).toBeUndefined();
  });
  it("isolates accounts, refreshes at midnight, and invalidates after workout changes", async () => {
    vi.mocked(previewWorkoutImpact).mockResolvedValue(response(10));
    const { result, rerender, client } = setup(); await advance(301); await advance(1);
    expect(result.current.preview).toBeDefined();
    account.uid = 2; rerender({ value: { duration_minutes: 10, planned: true } });
    expect(result.current.preview).toBeUndefined(); await advance(301); await advance(1);
    expect(previewWorkoutImpact).toHaveBeenCalledTimes(2);
    account.day = "2026-10-14"; rerender({ value: { duration_minutes: 10, planned: true } }); await advance(301); await advance(1);
    expect(previewWorkoutImpact).toHaveBeenLastCalledWith(expect.objectContaining({ date: "2026-10-14" }), expect.any(AbortSignal));
    await act(async () => { await invalidateWorkoutDerivedData(client); }); await advance(1);
    expect(previewWorkoutImpact).toHaveBeenCalledTimes(4);
  });
});
