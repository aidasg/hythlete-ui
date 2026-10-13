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
    expect(screen.queryByText("Usual training load")).not.toBeInTheDocument();
  });
  it("selects bilateral muscle paths by keyboard and distinguishes reports from the load legend", () => {
    const regions = recentBodyRegions({ entities: [{ entity_type: "muscle", entity_id: "gastrocnemius", acute_load: 30, label: "ready" }, { entity_type: "muscle", entity_id: "rectus_femoris", acute_load: 40, label: "loaded" }] }, undefined, [{ date: "2026-10-12", entity_type: "muscle", entity_id: "gastrocnemius", kind: "limiter", magnitude: 30 }]);
    render(<BodyVisualization mode="recent-load" regions={regions} />);
    const paths = screen.getAllByRole("button", { name: "Calves: Usual training load; recent report" });
    fireEvent.keyDown(paths[0]!, { key: "Enter" });
    expect(paths.every(p => p.getAttribute("aria-pressed") === "true")).toBe(true);
    const selected = screen.getByRole("region", { name: "Selected area" });
    expect(within(selected).getByText(/Reported limitation.*2026-10-12.*30\/100/)).toBeInTheDocument();
    expect(within(selected).getByText("Usual training load")).toBeInTheDocument();
  });
});
