import { apiClient } from "@/services/api/client";
import { throwApiResponseError } from "@/services/api/errors";
import type { components } from "@/services/api/types";

export type ChangeRecord = components["schemas"]["changes.Record"];
export type ChangeDecision = "approved" | "rejected";

function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.error || !result.response.ok || result.data === undefined) throwApiResponseError(result);
  return result.data;
}

export async function listCoachChanges() {
  return unwrap(await apiClient.GET("/v1/coach/changes"));
}

export async function reviewCoachChange(id: number) {
  return unwrap(await apiClient.GET("/v1/coach/changes/{id}", { params: { path: { id } } }));
}

export async function decideCoachChange(id: number, decision: ChangeDecision, reviewToken: string) {
  return unwrap(await apiClient.POST("/v1/coach/changes/{id}/decision", {
    params: { path: { id } },
    body: { decision, review_token: reviewToken },
  }));
}
