import { beforeEach, describe, expect, it } from "vitest";
import { getStrategyConstraints, normalizeSportCode, saveStrategyConstraints } from "./strategyConstraints";
describe("daily choices", () => {
 beforeEach(() => localStorage.clear());
 it("normalizes aliases and isolates accounts and dates", () => {
  expect(normalizeSportCode("Weight Training")).toBe("strength_training");
  const profile = { user_id: 7, preferred_sports: [{ code: "cycling" }] };
  const choice = { availableMinutes: 10, allowedSports: ["swimming"], activityMode: "custom" as const };
  saveStrategyConstraints("2026-10-13", choice, 7);
  expect(getStrategyConstraints("2026-10-13", profile)).toMatchObject(choice);
  expect(getStrategyConstraints("2026-10-13", { ...profile, user_id: 8 }).allowedSports).toEqual(["cycling"]);
  expect(getStrategyConstraints("2026-10-14", profile).availableMinutes).toBe(30);
 });
 it("reconciles changed profile favorites but preserves explicit daily choices", () => {
  saveStrategyConstraints("2026-10-13", { availableMinutes: 30, allowedSports: ["running"], activityMode: "profile" }, 7);
  expect(getStrategyConstraints("2026-10-13", { user_id: 7, preferred_sports: [{ code: "rowing" }] }).allowedSports).toEqual(["rowing"]);
 });
 it("ignores corrupt storage", () => {
  localStorage.setItem("hythlete.strategyConstraints.v2.7", "invalid");
  expect(getStrategyConstraints("2026-10-13", { user_id: 7 }).availableMinutes).toBe(30);
 });
});
