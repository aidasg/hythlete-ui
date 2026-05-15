import { apiClient } from "@/services/api/client";
import type { components } from "@/services/api/types";

export type HealthResponse = components["schemas"]["common.HealthResponse"];

export function getHealth() {
  return apiClient.GET("/health");
}
