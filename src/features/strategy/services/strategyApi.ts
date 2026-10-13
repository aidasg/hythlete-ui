import { apiClient } from "@/services/api/client";
import type { components } from "@/services/api/types";

export type DailyStrategyRequest = components["schemas"]["strategy.dailyRequest"];
export type DailyStrategyResponse = components["schemas"]["strategy.dailyResponse"];
export type RankedStrategyOption =
  components["schemas"]["strategy.rankedOptionResponse"];
export type FocusBlockResponse =
  components["schemas"]["strategy.focusBlockResponse"];
export type FocusProposalRequest =
  components["schemas"]["strategy.focusProposalRequest"];
export type FocusStatusRequest =
  components["schemas"]["strategy.focusStatusRequest"];

export function getDailyStrategy(payload: DailyStrategyRequest) {
  return apiClient.POST("/v1/strategy/daily", { body: payload });
}

export function getActiveFocusBlock(date?: string) {
  return apiClient.GET("/v1/strategy/focus-blocks/active", {
    params: { query: { date } },
  });
}

export function createFocusProposal(payload: FocusProposalRequest) {
  return apiClient.POST("/v1/strategy/focus-proposals", { body: payload });
}

export function updateFocusBlock(
  id: number,
  status: FocusStatusRequest["status"]
) {
  return apiClient.PATCH("/v1/strategy/focus-blocks/{id}", {
    params: { path: { id } },
    body: { status },
  });
}
