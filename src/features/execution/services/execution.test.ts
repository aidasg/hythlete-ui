import { clearAuthSession } from "@/features/auth/services/authSession";
import { beforeEach, describe, expect, it } from "vitest";
import { elapsed, timerPosition, beginExecution, readExecution, persistExecution } from "./execution";
describe("recoverable execution", () => {
 beforeEach(() => localStorage.clear());
 it("clears recovery and daily choices on logout", () => {
  beginExecution(7, { id: 4 });
  localStorage.setItem("hythlete.strategyConstraints.v2.7", "{}");
  clearAuthSession();
  expect(readExecution(7,4)).toBeNull();
  expect(localStorage.getItem("hythlete.strategyConstraints.v2.7")).toBeNull();
 });
 it("calculates elapsed time across suspended tabs without counting callbacks", () => {
  expect(elapsed({ elapsedMs: 2000, runningSince: 1000 }, 61000)).toBe(62000);
  expect(elapsed({ elapsedMs: 62000, runningSince: null }, 91000)).toBe(62000);
  expect(elapsed({ elapsedMs: 62000, runningSince: 91000 }, 101000)).toBe(72000);
 });
 it("transitions intervals and blocks at their boundaries", () => {
  const blocks = [{ id: "first", format: "intervals", duration_seconds: 120, work_seconds: 40, rest_seconds: 20 }, { id: "second", format: "emom", duration_seconds: 120, work_seconds: 60 }];
  expect(timerPosition(blocks, 40).phase).toBe("Rest");
  expect(timerPosition(blocks, 60)).toMatchObject({ interval: 2, phase: "Work" });
  expect(timerPosition(blocks, 120)).toMatchObject({ index: 1, seconds: 0 });
 });
 it("recovers unsent results with the same completion key and never across accounts", () => {
  const s = beginExecution(7, { id: 4, blocks: [{ id: "main", format: "amrap", duration_seconds: 600 }] });
  persistExecution({ ...s, pending: true, elapsedMs: 120000 });
  expect(readExecution(7, 4)).toMatchObject({ pending: true, elapsedMs: 120000, result: { key: s.result.key } });
  expect(readExecution(8, 4)).toBeNull();
 });
});
