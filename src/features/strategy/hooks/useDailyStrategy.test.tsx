import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDailyStrategy } from "@/features/strategy/hooks/useDailyStrategy";
import { getDailyStrategy } from "@/features/strategy/services/strategyApi";

vi.mock("@/features/strategy/services/strategyApi", () => ({
  getDailyStrategy: vi.fn(),
}));

describe("useDailyStrategy", () => {
  beforeEach(() => {
    vi.mocked(getDailyStrategy).mockResolvedValue({
      data: {
        date: "2026-09-02",
        today: {
          primary: { key: "threshold:running", score: 88 },
          alternatives: [],
        },
      },
      response: new Response(),
    } as Awaited<ReturnType<typeof getDailyStrategy>>);
  });

  it("posts the applied date, minutes, and sport constraints", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () =>
        useDailyStrategy("2026-09-02", {
          availableMinutes: 75,
          allowedSports: ["running", "cycling"],
        }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getDailyStrategy).toHaveBeenCalledWith({
      date: "2026-09-02",
      available_minutes: 75,
      allowed_sports: ["running", "cycling"],
    });
    expect(result.current.data?.today?.primary?.score).toBe(88);
  });
});
