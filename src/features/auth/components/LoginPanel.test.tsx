import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import {
  AuthContext,
  type AuthContextValue,
} from "@/features/auth/context/authContextValue";
import type { AuthMode } from "@/features/auth/components/AuthForm";
import { LoginPanel } from "@/features/auth/components/LoginPanel";
import { ThemeContext } from "@/features/theme/themeContextValue";

const authValue: AuthContextValue = {
  session: null,
  status: "anonymous",
  isAuthenticated: false,
  refreshSession: vi.fn().mockResolvedValue(null),
  logoutUser: vi.fn().mockResolvedValue(undefined),
};

function LoginPanelHarness() {
  const [mode, setMode] = useState<AuthMode>("login");

  return <LoginPanel mode={mode} onModeChange={setMode} />;
}

describe("LoginPanel", () => {
  it("switches registration in place and shows only real auth actions", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <ThemeContext.Provider
          value={{ preference: "light", resolvedTheme: "light", setPreference: vi.fn() }}
        >
          <AuthContext.Provider value={authValue}>
            <LoginPanelHarness />
          </AuthContext.Provider>
        </ThemeContext.Provider>
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(screen.queryByText("Set today's constraints")).not.toBeInTheDocument();
    expect(screen.queryByText("Forgot?")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Create your profile" }));

    expect(screen.getByRole("heading", { name: "Register" })).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
  });
});
