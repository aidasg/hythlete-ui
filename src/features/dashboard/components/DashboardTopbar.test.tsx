import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { DashboardTopbar } from "@/features/dashboard/components/DashboardTopbar";
import { ThemeContext } from "@/features/theme/themeContextValue";

describe("DashboardTopbar", () => {
  it("exposes the three primary destinations and an accessible account menu", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <ThemeContext.Provider
          value={{ preference: "system", resolvedTheme: "light", setPreference: vi.fn() }}
        >
          <DashboardTopbar email="athlete@example.com" onLogout={vi.fn()} />
        </ThemeContext.Provider>
      </MemoryRouter>
    );

    expect(screen.getAllByRole("link", { name: "Today" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Calendar" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Profile" })).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Open account menu" }));

    expect(screen.getByText("athlete@example.com")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Profile settings" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Log out" })).toBeInTheDocument();
  });
});
