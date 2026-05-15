import { apiClient } from "@/services/api/client";
import type { components } from "@/services/api/types";

export type ProfileResponse = components["schemas"]["profile.ProfileResponse"];

export function getProfile() {
  return apiClient.GET("/v1/profile");
}
