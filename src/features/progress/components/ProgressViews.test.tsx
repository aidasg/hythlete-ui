import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MuscleStimulusView } from "@/features/progress/components/MuscleStimulusView";
import { PortfolioView } from "@/features/progress/components/PortfolioView";
import {
  getMuscleStimulus,
  getPortfolio,
} from "@/features/progress/services/progressApi";

vi.mock("@/features/progress/services/progressApi", async (importOriginal) => {
  const original = await importOriginal<
    typeof import("@/features/progress/services/progressApi")
  >();
  return {
    ...original,
    getPortfolio: vi.fn(),
    getMuscleStimulus: vi.fn(),
  };
});

function renderWithQuery(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

describe("progress views", () => {
  beforeEach(() => {
    vi.mocked(getPortfolio).mockResolvedValue({
      data: {
        as_of: "2026-09-02",
        confidence: 0.74,
        capabilities: [
          {
            code: "threshold",
            name: "Threshold",
            role: "push",
            scope_id: "running",
            trend: "improving",
            readiness: "ready",
          },
          {
            code: "max_strength",
            name: "Maximum strength",
            role: "protect",
            trend: "stable",
            readiness: "limited",
          },
        ],
      },
      response: new Response(),
    } as Awaited<ReturnType<typeof getPortfolio>>);
    vi.mocked(getMuscleStimulus).mockResolvedValue({
      data: {
        week_start: "2026-08-31",
        week_end: "2026-09-06",
        groups: [
          {
            group_name: "Quads",
            region: "lower_body",
            role: "push",
            status: "recovering",
            current_stimulus: 2,
            projected_stimulus: 4,
            target_low: 8,
            target_high: 10,
            confidence: 0.7,
            reasons: ["readiness limiter overrides additional stimulus"],
          },
        ],
      },
      response: new Response(),
    } as Awaited<ReturnType<typeof getMuscleStimulus>>);
  });

  it("groups capabilities by backend role without showing a universal score", async () => {
    renderWithQuery(<PortfolioView date="2026-09-02" />);
    expect(await screen.findByRole("heading", { name: "Push now" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Threshold" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Protect" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Maximum strength" })).toBeInTheDocument();
    expect(screen.queryByText(/athletic score/i)).not.toBeInTheDocument();
  });

  it("makes recovery guidance override a low projected target", async () => {
    const { container } = renderWithQuery(<MuscleStimulusView date="2026-09-02" />);
    expect(await screen.findByText("Recovery guidance overrides additional stimulus.")).toBeInTheDocument();
    expect(container.querySelector('[data-status="recovering"]')).not.toBeNull();
    expect(screen.getByText(/does not diagnose/i)).toBeInTheDocument();
  });
});
