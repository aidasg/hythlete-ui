import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardGrid } from "@/features/dashboard/components/DashboardGrid";
import { useDailyStrategy } from "@/features/strategy/hooks/useDailyStrategy";

vi.mock("@/features/auth/context/useAuth", () => ({
  useAuth: () => ({ session: { profile: { sports: [] } } }),
}));

vi.mock("@/features/strategy/hooks/useDailyStrategy", () => ({
  useDailyStrategy: vi.fn(),
}));

vi.mock("@/features/strategy/components/FocusBlockManager", () => ({
  FocusBlockManager: () => null,
}));

vi.mock("@/features/dashboard/components/MuscleBreakdownCard", () => ({
  MuscleBreakdownCard: () => <div data-testid="muscle-breakdown-card" />,
}));

describe("DashboardGrid", () => {
  beforeEach(() => {
    vi.mocked(useDailyStrategy).mockReturnValue({
      data: undefined,
      error: null,
      isFetching: false,
      isLoading: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useDailyStrategy>);
  });

  it("keeps the advanced muscle overview collapsed and loads it when opened", () => {
    render(
      <MemoryRouter>
        <DashboardGrid />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "Continue setup" })).toHaveAttribute("href", "/setup");

    const summary = screen.getByText("Muscle status overview").closest("summary");
    const details = summary?.closest("details");

    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute("open");
    expect(screen.queryByTestId("muscle-breakdown-card")).not.toBeInTheDocument();

    details!.open = true;
    fireEvent(details!, new Event("toggle"));

    expect(screen.getByTestId("muscle-breakdown-card")).toBeInTheDocument();
  });
});
