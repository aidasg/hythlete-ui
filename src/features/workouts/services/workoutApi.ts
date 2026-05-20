import { apiClient } from "@/services/api/client";
import type { components } from "@/services/api/types";

export type WorkoutCatalogResponse =
  components["schemas"]["workout.CatalogResponse"];
export type WorkoutRequest = components["schemas"]["workout.WorkoutRequest"];
export type WorkoutResponse = components["schemas"]["workout.WorkoutResponse"];
export type WorkoutLoadStateResponse =
  components["schemas"]["workout.LoadStateResponse"];
export type WorkoutComponentRequest =
  components["schemas"]["workout.WorkoutComponentRequest"];
export type ExerciseSetRequest =
  components["schemas"]["workout.ExerciseSetRequest"];

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

export function createWorkout(payload: WorkoutRequest) {
  return apiClient.POST("/v1/workouts", {
    body: payload,
  });
}
