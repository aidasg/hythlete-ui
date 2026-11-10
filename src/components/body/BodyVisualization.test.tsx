import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BodyVisualization } from "./BodyVisualization";
import { sessionBodyRegions, recentBodyRegions } from "@/features/workouts/services/bodyImpact";

describe("body visualization", () => {
  it("normalizes each layer separately and exposes unmapped areas in an equivalent list", () => {
    const regions = sessionBodyRegions({ muscle_loads: [{ muscle_code: "rectus_femoris", strength_load: 100 }, { muscle_code: "custom_area", muscle_name: "Custom area", strength_load: 10 }], tissue_loads: [{ region_code: "achilles_tendon", load: 1 }] });
    const { container } = render(<BodyVisualization mode="session-impact" regions={regions} />);
    const list = screen.getByRole("list", { name: "Muscle regions" });
    fireEvent.click(within(list).getByRole("button", { name: /Custom area/ }));
    expect(within(screen.getByRole("region", { name: "Selected area" })).getByRole("heading")).toHaveTextContent("Custom area");
    expect(within(list).getByText(/Listed only/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Joints & tendons" }));
    expect(screen.getAllByRole("button", { name: "Back of ankles: Main area worked" })).toHaveLength(2);
    expect(container.querySelectorAll('svg g[role="button"] path')).toHaveLength(0);
    expect(screen.queryByText("Moderate recent load")).not.toBeInTheDocument();
  });
  it("selects bilateral muscle paths by keyboard and distinguishes reports from the load legend", () => {
    const regions = recentBodyRegions({ entities: [{ entity_type: "muscle", entity_id: "gastrocnemius", acute_load: 30, label: "ready" }, { entity_type: "muscle", entity_id: "rectus_femoris", acute_load: 40, label: "loaded" }] }, undefined, [{ date: "2026-10-12", entity_type: "muscle", entity_id: "gastrocnemius", kind: "limiter", magnitude: 30 }]);
    render(<BodyVisualization mode="recent-load" regions={regions} />);
    const paths = screen.getAllByRole("button", { name: "Calves: Moderate recent load; recent report" });
    fireEvent.keyDown(paths[0]!, { key: "Enter" });
    expect(paths.every(p => p.getAttribute("aria-pressed") === "true")).toBe(true);
    const selected = screen.getByRole("region", { name: "Selected area" });
    expect(within(selected).getByText(/Reported limitation.*2026-10-12.*30\/100/)).toBeInTheDocument();
    expect(within(selected).getByText("Moderate recent load")).toBeInTheDocument();
  });
  it("shows weekly points and a baseline percentage for both muscle and tendon loads", () => {
    const regions = recentBodyRegions({ entities: [
      { entity_type: "muscle", entity_id: "glute_max", load_type: "endurance", acute_load: 205.32, chronic_load: 524.43, ratio: .39, label: "avoid", reasons: ["acute/chronic ratio 0.39", "recent load 27"] },
      { entity_type: "tissue", entity_id: "achilles_tendon", load_type: "impact", acute_load: 20, chronic_load: 0 },
    ] });
    render(<BodyVisualization mode="recent-load" regions={regions} />);
    const selected = within(screen.getByRole("region", { name: "Selected area" }));
    fireEvent.click(selected.getByText("Weekly load details"));
    expect(selected.getByText("191.33 pts/week")).toBeInTheDocument();
    expect(selected.getByText("99.53 pts/week")).toBeInTheDocument();
    expect(selected.getByText("192.2%")).toBeInTheDocument();
    expect(selected.queryByText("acute/chronic ratio 0.39")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Joints & tendons" }));
    expect(selected.getByText("impact")).toBeInTheDocument();
    expect(selected.getByText("18.64 pts/week")).toBeInTheDocument();
    expect(selected.getByText("Comparison unavailable")).toBeInTheDocument();
  });
});
