import { afterEach, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { dateInTimezone, useTodayDate } from "./useTodayDate";
it("uses the profile timezone across midnight", () => {
 expect(dateInTimezone("Europe/Rome", new Date("2026-10-13T22:30:00Z"))).toBe("2026-10-14");
 expect(dateInTimezone("America/New_York", new Date("2026-10-13T22:30:00Z"))).toBe("2026-10-13");
});

afterEach(() => vi.useRealTimers());
it("rolls over at profile midnight and reconciles a timezone change", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-13T21:59:59Z"));
  const { result, rerender } = renderHook(({ timezone }) => useTodayDate(timezone), { initialProps: { timezone: "Europe/Rome" } });
  expect(result.current).toBe("2026-10-13");
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(result.current).toBe("2026-10-14");
  rerender({ timezone: "America/New_York" });
  expect(result.current).toBe("2026-10-13");
});
