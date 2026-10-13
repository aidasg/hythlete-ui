import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ProgressHub } from "./ProgressHub";

vi.mock("@/features/auth/context/useAuth", () => ({ useAuth: () => ({ session: { profile: { user_id: 1, timezone: "Europe/Rome" } } }) }));
vi.mock("./BodyProgressView", () => ({ BodyProgressView: () => <h2>Body content</h2> }));
vi.mock("./PortfolioView", () => ({ PortfolioView: () => <h2>Overview content</h2> }));
vi.mock("./MuscleStimulusView", () => ({ MuscleStimulusView: () => <h2>Muscle content</h2> }));
vi.mock("./StrengthProgressView", () => ({ StrengthProgressView: () => <h2>Strength content</h2> }));
vi.mock("./BreakthroughsView", () => ({ BreakthroughsView: () => <h2>Breakthroughs content</h2> }));
vi.mock("./BenchmarksView", () => ({ BenchmarksView: () => <h2>Benchmarks content</h2> }));
describe("Progress navigation", () => {
  it("defaults to Body and uses plain tab names", () => {
    render(<MemoryRouter initialEntries={["/progress"]}><ProgressHub /></MemoryRouter>);
    expect(screen.getByRole("tab", { name: "Body" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Body content" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Muscle training" })).toBeInTheDocument();
  });
  it("supports arrow-key navigation between tabs", () => {
    render(<MemoryRouter initialEntries={["/progress"]}><ProgressHub /></MemoryRouter>);
    fireEvent.keyDown(screen.getByRole("tab", { name: "Body" }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveFocus();
    expect(screen.getByRole("heading", { name: "Overview content" })).toBeInTheDocument();
  });
  it.each([["portfolio", "Overview"], ["muscle", "Muscle"], ["strength", "Strength"], ["breakthroughs", "Breakthroughs"], ["benchmarks", "Benchmarks"]])("preserves the %s deep link", (key, heading) => {
    render(<MemoryRouter initialEntries={[`/progress?view=${key}`]}><ProgressHub /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: `${heading} content` })).toBeInTheDocument();
  });
});
