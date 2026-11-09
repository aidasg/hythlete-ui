import { apiClient } from "@/services/api/client";
import type { components } from "@/services/api/types";

export type ProfileResponse = components["schemas"]["profile.ProfileResponse"];
export type ProfileOptionsResponse =
  components["schemas"]["profile.ProfileOptionsResponse"];
export type ProfileRequest = components["schemas"]["profile.ProfileRequest"];

export function getProfile() {
  return apiClient.GET("/v1/profile");
}

export function getProfileOptions() {
  return apiClient.GET("/v1/profile/options");
}

export function upsertProfile(profile: ProfileRequest) {
  return apiClient.PUT("/v1/profile", {
    body: profile,
  });
}

export type ZonePreview = components["schemas"]["profile.ZonePreviewResponse"];
export function previewZones(sport: string, baselines: ProfileRequest["endurance_baselines"], signal?: AbortSignal) {
  return apiClient.POST("/v1/profile/zones/preview", {
    body: { sport, endurance_baselines: baselines }, signal,
  });
}
