import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MuscleStimulusView } from "@/features/progress/components/MuscleStimulusView";
import { PortfolioView } from "@/features/progress/components/PortfolioView";
import {
  getMuscleStimulus,
  getPortfolio,
  type CapabilityResponse,
} from "@/features/progress/services/progressApi";

vi.mock("@/features/auth/context/useAuth", () => ({ useAuth: () => ({ session: { profile: { user_id: 1 } } }) }));

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
  return render(<MemoryRouter initialEntries={["/progress?view=portfolio"]}><QueryClientProvider client={client}>{node}</QueryClientProvider></MemoryRouter>);
}

function mockPortfolio(capabilities: CapabilityResponse[]) {
  vi.mocked(getPortfolio).mockResolvedValue({
    data: { as_of: "2026-09-02", confidence: 0.74, capabilities },
    response: new Response(),
  } as Awaited<ReturnType<typeof getPortfolio>>);
}

describe("progress views", () => {
  beforeEach(() => {
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

  it("shows three protect rows first and reveals the others on request", async () => {
    mockPortfolio(["Achilles Tendon", "Hip Joint", "Knee Joint", "Patellar Tendon", "Plantar Fascia"].map((name) => ({
      name, code: "tissue_durability", scope_type: "tissue", scope_id: name.toLowerCase().replace(/ /g, "_"),
      role: "protect", readiness: "avoid", evidence: [{ metric: "chronic_load", value: 920, unit: "load_points" }],
    })));
    const user = userEvent.setup();
    renderWithQuery(<PortfolioView date="2026-09-02" />);
    const protect = within(await screen.findByRole("region", { name: "Protect" }));
    expect(protect.getAllByText("Avoid")).toHaveLength(3);
    expect(screen.queryByRole("heading", { name: "Build" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Maintain" })).not.toBeInTheDocument();
    expect(screen.queryByText("920 load points")).not.toBeInTheDocument();

    const showAll = protect.getByRole("button", { name: "Show all 5" });
    showAll.focus();
    await user.keyboard("{Enter}");
    expect(showAll).toHaveAttribute("aria-expanded", "true");
    expect(protect.getAllByText("Avoid")).toHaveLength(5);
    await user.keyboard("{Enter}");
    expect(protect.getAllByText("Avoid")).toHaveLength(3);

    const achilles = protect.getByText("Achilles Tendon").closest("summary")!;
    achilles.focus();
    expect(achilles).toHaveFocus();
    await user.click(achilles);
    expect(await protect.findByText("Weighted long-term load (model input)")).toBeVisible();
    expect(protect.getByRole("link", { name: "Compare weekly load in Body" })).toHaveAttribute("href", "/progress?view=body");
  });

  it("groups mixed evidence and counts each strength movement pattern once", async () => {
    const movement = { code: "max_strength", name: "Max strength", scope_type: "movement_pattern" };
    mockPortfolio([
      { ...movement, scope_id: "squat", trend: "improving", role: "maintain", maintenance_due_date: "2026-09-05" },
      { ...movement, scope_id: "squat", trend: "improving" },
      { ...movement, scope_id: "hinge", trend: "stable" },
      { ...movement, scope_id: "lunge", trend: "declining" },
      { ...movement, scope_id: "horizontal_pull" },
      { ...movement, trend: "declining" },
      { name: "Threshold", scope_type: "sport", scope_id: "running", role: "push", trend: "improving", readiness: "ready" },
      { name: "Aerobic base", scope_type: "sport", scope_id: "cycling", trend: "stable" },
      { name: "Achilles Tendon", scope_type: "tissue", role: "protect", trend: "declining" },
      { name: "Test set", scope_type: "benchmark_variant" },
      { name: "Speed", scope_type: "goal" },
      { name: "New category", scope_type: "future" },
    ]);
    function LocationProbe() {
      return <output>{useLocation().search}</output>;
    }
    const user = userEvent.setup();
    renderWithQuery(<><PortfolioView date="2026-09-02" /><LocationProbe /></>);
    const priorities = within(await screen.findByRole("region", { name: "Training priorities" }));
    expect(priorities.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(["Protect", "Build", "Maintain"]);
    expect(priorities.getByText("Due Sep 5, 2026")).toBeVisible();
    expect(priorities.getByText("Ready")).toBeVisible();

    const trends = within(screen.getByRole("region", { name: "Strength trends" }));
    expect(trends.getByText("4 strength movement patterns")).toBeVisible();
    expect(trends.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "1 Improving", "1 Stable", "1 Declining", "1 Awaiting more evidence",
    ]);

    const inventory = within(screen.getByRole("region", { name: "Explore the evidence" }));
    const groups = ["Strength", "Sport & endurance", "Joints & tendons", "Benchmarks", "Goals awaiting evidence", "Other"];
    for (const group of groups) expect(inventory.getByText(group).closest("details")).not.toHaveAttribute("open");
    await user.click(inventory.getByText("Sport & endurance"));
    expect(inventory.getByRole("heading", { name: "Cycling" })).toBeVisible();
    expect(inventory.getByRole("heading", { name: "Running" })).toBeVisible();
    await user.click(inventory.getByText("Strength"));
    await user.click(inventory.getByText("Benchmarks"));
    expect(inventory.getByRole("link", { name: "View benchmark definitions" })).toHaveAttribute("href", "/progress?view=benchmarks");
    await user.click(inventory.getByRole("link", { name: "View strength curves" }));
    expect(screen.getByText("?view=strength")).toBeInTheDocument();
  });

  it("keeps confidence and observations on demand and pages through evidence newest first", async () => {
    const dates = [1, 12, 4, 3, 10, 11, 6, 9, 2, 8, 5, 7];
    mockPortfolio([{
      name: "Threshold", scope_type: "sport", scope_id: "running", role: "push", confidence: 0.81,
      last_exposure: "2026-08-12", reasons: ["Derived from completed sport efforts"],
      evidence: dates.map((day) => ({
        date: `2026-08-${String(day).padStart(2, "0")}`, metric: day === 12 ? "fade_percent" : "avg_speed_mps", value: day,
        unit: day === 12 ? "percent" : "mps", source: "fit_lap",
      })),
    }]);
    const user = userEvent.setup();
    renderWithQuery(<PortfolioView date="2026-09-02" />);
    const build = within(await screen.findByRole("region", { name: "Build" }));
    expect(screen.getByText("Sep 2, 2026")).toBeVisible();
    expect(screen.getByText("74%")).not.toBeVisible();
    expect(build.queryByText("81%")).not.toBeInTheDocument();
    await user.click(screen.getByText("About this overview"));
    expect(screen.getByText("74%")).toBeVisible();
    await user.click(build.getByText("Threshold"));
    expect(await build.findByText("81%")).toBeVisible();
    expect(build.getByText("Last exposure")).toBeVisible();
    expect(build.getByText("Derived from completed sport efforts")).toBeVisible();
    const observations = within(build.getByRole("list", { name: "Evidence, newest first" }));
    expect(observations.getAllByRole("listitem")).toHaveLength(5);
    expect(observations.getAllByRole("listitem")[0]).toHaveTextContent("Fade12%Aug 12, 2026 · FIT lap");
    expect(observations.getByText("8 m/s")).toBeVisible();
    await user.click(build.getByRole("button", { name: "Show 5 older observations" }));
    expect(observations.getAllByRole("listitem")).toHaveLength(10);
    await user.click(build.getByRole("button", { name: "Show 2 older observations" }));
    expect(observations.getAllByRole("listitem")).toHaveLength(12);
    expect(observations.getAllByRole("listitem")[11]).toHaveTextContent("Aug 1, 2026");
  });

  it("shows one priorities empty state and handles missing evidence", async () => {
    mockPortfolio([{ name: "Aerobic base", scope_type: "goal", role: "observe" }]);
    const user = userEvent.setup();
    renderWithQuery(<PortfolioView date="2026-09-02" />);
    expect(await screen.findByText("No current training priorities.")).toBeVisible();
    expect(screen.getByText(/Strength trends appear/)).toBeVisible();
    await user.click(screen.getByText("Goals awaiting evidence"));
    await user.click(screen.getByText("Aerobic base"));
    expect(await screen.findByText("No observations available yet.")).toBeVisible();
    expect(screen.queryByText("Last exposure")).not.toBeInTheDocument();
  });

  it("makes recovery guidance override a low projected target", async () => {
    const { container } = renderWithQuery(<MuscleStimulusView date="2026-09-02" />);
    expect(await screen.findByText("Give this area time to recover before adding more work.")).toBeInTheDocument();
    expect(container.querySelector('[data-status="recovering"]')).not.toBeNull();
    expect(screen.getByText(/Targets are estimates/i)).toBeInTheDocument();
  });
});
