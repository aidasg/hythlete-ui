import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthForm, type AuthMode } from "@/features/auth/components/AuthForm";
import { login, register } from "@/features/auth/services/authApi";

const refreshSession = vi.fn().mockResolvedValue(null);
vi.mock("@/features/auth/context/useAuth", () => ({ useAuth: () => ({ refreshSession }) }));
vi.mock("@/features/auth/services/authApi", () => ({
  login: vi.fn(),
  register: vi.fn(),
}));

function renderForm(mode: AuthMode) {
  render(<MemoryRouter initialEntries={["/login"]}><Routes>
    <Route path="/login" element={<AuthForm mode={mode} />} />
    <Route path="/setup" element={<h1>Setup reached</h1>} />
    <Route path="/dashboard" element={<h1>Dashboard reached</h1>} />
  </Routes></MemoryRouter>);
}

describe("AuthForm routes", () => {
  beforeEach(() => {
    refreshSession.mockClear();
    vi.mocked(register).mockResolvedValue({ data: { email: "athlete@example.com", user_id: 1, username: "athlete" } } as never);
    vi.mocked(login).mockResolvedValue({ data: { email: "athlete@example.com", user_id: 1, username: "athlete" } } as never);
  });

  it("opens setup after registration", async () => {
    const user = userEvent.setup();
    renderForm("register");
    await user.type(screen.getByLabelText("Username"), "athlete");
    await user.type(screen.getByLabelText("Email"), "athlete@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Create profile" }));
    expect(await screen.findByRole("heading", { name: "Setup reached" })).toBeInTheDocument();
  });

  it("keeps login directed to the dashboard", async () => {
    const user = userEvent.setup();
    renderForm("login");
    await user.type(screen.getByLabelText("Email"), "athlete@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Start session" }));
    expect(await screen.findByRole("heading", { name: "Dashboard reached" })).toBeInTheDocument();
  });
});
