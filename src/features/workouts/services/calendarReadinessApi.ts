import { apiClient } from "@/services/api/client";
import type { components } from "@/services/api/types";

export type CalendarReadinessEntriesRequest =
  components["schemas"]["calendar.ReadinessEntriesRequest"];
export type CalendarReadinessEntriesResponse =
  components["schemas"]["calendar.ReadinessEntriesResponse"];
export type CalendarReadinessEntryRequest =
  components["schemas"]["calendar.ReadinessEntryRequest"];
export type CalendarReadinessEntryResponse =
  components["schemas"]["calendar.ReadinessEntryResponse"];

export type CalendarReadinessListParams = {
  from?: string;
  to?: string;
};

export function listCalendarReadinessEntries(
  params: CalendarReadinessListParams = {}
) {
  return apiClient.GET("/v1/calendar/readiness-entries", {
    params: {
      query: params,
    },
  });
}

export function saveCalendarReadinessEntries(
  payload: CalendarReadinessEntriesRequest
) {
  return apiClient.PUT("/v1/calendar/readiness-entries", {
    body: payload,
  });
}
