import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/features/theme/ThemeProvider";
import { useTheme } from "@/features/theme/useTheme";

function ThemeHarness() {
  const { preference, resolvedTheme, setPreference } = useTheme();
  const [, forceRender] = useState(0);

  return (
    <div>
      <span>{preference}</span>
      <span>{resolvedTheme}</span>
      <button
        type="button"
        onClick={() => {
          setPreference("dark");
          forceRender((value) => value + 1);
        }}
      >
        Use dark
      </button>
    </div>
  );
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: "(prefers-color-scheme: dark)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  it("follows the system initially and remembers an explicit override", async () => {
    render(
      <ThemeProvider>
        <ThemeHarness />
      </ThemeProvider>
    );

    expect(screen.getByText("system")).toBeInTheDocument();
    expect(screen.getByText("light")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Use dark" }));

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("dark");
    });
    expect(window.localStorage.getItem("hythlete-theme")).toBe("dark");
  });
});

