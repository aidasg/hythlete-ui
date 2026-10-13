import { apiClient } from "@/services/api/client";
import type { components } from "@/services/api/types";
export type CoachRequest = components["schemas"]["coach.Request"];
export type CoachProposal = components["schemas"]["coach.Response"];
export const proposeCoaching = (body: CoachRequest) => apiClient.POST("/v1/coach/proposals", { body });
export const acceptCoaching = (id: number) => apiClient.POST("/v1/coach/proposals/{id}/accept", { params: { path: { id } } });
