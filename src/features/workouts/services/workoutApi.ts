import { apiClient } from "@/services/api/client";
import type { components } from "@/services/api/types";

export type WorkoutCatalogResponse =
  components["schemas"]["workout.CatalogResponse"];
export type WorkoutRequest = components["schemas"]["workout.WorkoutRequest"];
export type WorkoutResponse = components["schemas"]["workout.WorkoutResponse"];
export type FitImportResponse =
  components["schemas"]["workout.FitImportResponse"];
export type WorkoutLoadStateResponse =
  components["schemas"]["workout.LoadStateResponse"];
export type ReadinessResponse =
  components["schemas"]["workout.ReadinessResponse"];
export type ReadinessEntityResponse =
  components["schemas"]["workout.ReadinessEntityResponse"];
export type LimiterResponse = components["schemas"]["workout.LimiterResponse"];
export type TrainingOptionResponse =
  components["schemas"]["workout.TrainingOptionResponse"];
export type PlannedImpactResponse =
  components["schemas"]["workout.PlannedImpactResponse"];
export type WorkoutDraftResponse =
  components["schemas"]["workout.WorkoutDraftResponse"];
export type WorkoutPrescriptionRequest =
  components["schemas"]["workout.WorkoutPrescriptionRequest"];
export type WorkoutPrescriptionResponse =
  components["schemas"]["workout.WorkoutPrescriptionResponse"];
export type WorkoutComponentRequest =
  components["schemas"]["workout.WorkoutComponentRequest"];
export type ExerciseSetRequest =
  components["schemas"]["workout.ExerciseSetRequest"];
export type SegmentMetricsRequest =
  components["schemas"]["workout.SegmentMetricsRequest"];

export type WorkoutListParams = {
  from?: string;
  to?: string;
};

export function getWorkoutCatalog() {
  return apiClient.GET("/v1/workouts/catalog");
}

export function listWorkouts(params: WorkoutListParams = {}) {
  return apiClient.GET("/v1/workouts", {
    params: {
      query: params,
    },
  });
}

export function getWorkout(id: number) {
  return apiClient.GET("/v1/workouts/{id}", {
    params: {
      path: {
        id,
      },
    },
  });
}

export function getWorkoutLoadState(date: string) {
  return apiClient.GET("/v1/workouts/load-state", {
    params: {
      query: {
        date,
      },
    },
  });
}

export function getWorkoutReadiness(date: string) {
  return apiClient.GET("/v1/workouts/readiness", {
    params: {
      query: {
        date,
      },
    },
  });
}

export function createWorkout(payload: WorkoutRequest) {
  return apiClient.POST("/v1/workouts", {
    body: payload,
  });
}

export function previewWorkoutImpact(payload: WorkoutRequest) {
  return apiClient.POST("/v1/workouts/preview-impact", {
    body: payload,
  });
}

export function prescribeWorkouts(payload: WorkoutPrescriptionRequest) {
  return apiClient.POST("/v1/workouts/prescriptions", {
    body: payload,
  });
}

export function importFitWorkout(file: File) {
  const formData = new FormData();

  formData.append("file", file);

  return apiClient.POST("/v1/workouts/import/fit", {
    body: formData as never,
  });
}
