import type { WorkoutResponse } from "@/features/workouts/services/workoutApi";
import type { components } from "@/services/api/types";
import { apiClient } from "@/services/api/client";
export type ExecutionResult = components["schemas"]["workout.ExecutionResultDTO"];
export type BlockResult = components["schemas"]["workout.BlockResultDTO"];
export type ExecutionState = { version: 1; userID: number; workout: WorkoutResponse; elapsedMs: number; runningSince: number | null; result: ExecutionResult; pending: boolean; saved: boolean };
export function elapsed(state: Pick<ExecutionState, "elapsedMs" | "runningSince">, now = Date.now()) {
  return state.elapsedMs + (state.runningSince === null ? 0 : Math.max(0, now - state.runningSince));
}
export function timerPosition(blocks: NonNullable<WorkoutResponse["blocks"]>, elapsedSeconds: number) {
  let offset = 0;
  for (let index = 0; index < blocks.length; index++) {
    const b = blocks[index]!; const duration = b.duration_seconds || 0;
    if (elapsedSeconds < offset + duration || index === blocks.length - 1) {
      const seconds = Math.max(0, elapsedSeconds - offset);
      const cycle = (b.work_seconds || 0) + (b.rest_seconds || 0);
      const inCycle = cycle ? seconds % cycle : 0;
      return { index, seconds, remaining: Math.max(0, duration - seconds), phase: cycle && inCycle >= (b.work_seconds || 0) ? "Rest" : "Work", interval: cycle ? Math.floor(seconds / cycle) + 1 : 1 };
    }
    offset += duration;
  }
  return { index: 0, seconds: 0, remaining: 0, phase: "Work", interval: 1 };
}
export const executionKey = (userID: number, id: number) => `hythlete.execution.v1.${userID}.${id}`;
export function readExecution(userID: number, id: number): ExecutionState | null {
  try { const s = JSON.parse(localStorage.getItem(executionKey(userID, id)) || "null"); return s?.version === 1 && s.userID === userID && s.workout?.id === id && Number.isFinite(s.elapsedMs) ? s : null; } catch { return null; }
}
export function persistExecution(state: ExecutionState) { localStorage.setItem(executionKey(state.userID, state.workout.id!), JSON.stringify(state)); }
export function beginExecution(userID: number, workout: WorkoutResponse): ExecutionState {
  const state: ExecutionState = { version: 1, userID, workout, elapsedMs: 0, runningSince: null, result: { key: crypto.randomUUID(), blocks: [] }, pending: false, saved: !!workout.completed };
  persistExecution(state); return state;
}
export function completeExecution(id: number, body: ExecutionResult) {
  return apiClient.PUT("/v1/workouts/{id}/execution", { params: { path: { id } }, body });
}
