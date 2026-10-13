import { beforeEach, describe, expect, it } from "vitest";
import {
  getStrategyConstraints,
  normalizeSportCode,
  saveStrategyConstraints,
} from "@/features/strategy/services/strategyConstraints";

describe("strategy constraints", () => {
  beforeEach(() => window.localStorage.clear());

  it("normalizes profile sports and remembers applied values by date", () => {
    expect(normalizeSportCode("Weight Training")).toBe("weight_training");
    const profile = {
      preferred_sports: [{ name: "Weight Training" }, { name: "Cycling" }],
    };
    expect(getStrategyConstraints("2026-09-02", profile)).toEqual({
      availableMinutes: 60,
      allowedSports: ["weight_training", "cycling"],
    });

    saveStrategyConstraints("2026-09-02", {
      availableMinutes: 45,
      allowedSports: ["cycling"],
    });
    expect(getStrategyConstraints("2026-09-02", profile)).toEqual({
      availableMinutes: 45,
      allowedSports: ["cycling"],
    });
  });
});
