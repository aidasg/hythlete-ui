import { formatRequestFailure, requestIdFrom } from "@/services/api/errors";
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

export function updateWorkout(id: number, payload: WorkoutRequest) {
  return apiClient.PUT("/v1/workouts/{id}", {
    params: { path: { id } },
    body: payload,
  });
}

export function deleteWorkout(id: number) {
  return apiClient.DELETE("/v1/workouts/{id}", {
    params: {
      path: {
        id,
      },
    },
  });
}

export function previewWorkoutImpact(payload: WorkoutRequest, signal?: AbortSignal) {
  return apiClient.POST("/v1/workouts/preview-impact", {
    body: payload,
    signal,
  });
}

export function prescribeWorkouts(payload: WorkoutPrescriptionRequest) {
  return apiClient.POST("/v1/workouts/prescriptions", {
    body: payload,
  });
}

export type FitPowerTargetUnit = NonNullable<components["schemas"]["workout.ImportedActivityDTO"]["power_target_unit"]>;

export function importFitWorkout(file: File, powerTargetUnit: FitPowerTargetUnit = "auto") {
  const formData = new FormData();

  formData.append("file", file);
  formData.append("power_target_unit", powerTargetUnit);

  return apiClient.POST("/v1/workouts/import/fit", {
    body: formData as never,
  });
}

export function reanalyseWorkout(id: number, powerTargetUnit?: FitPowerTargetUnit, useStrydPower?: boolean) {
  return apiClient.POST("/v1/workouts/{id}/reanalyse", {
    params: { path: { id }, query: { power_target_unit: powerTargetUnit, use_stryd_power: useStrydPower } },
  });
}

export type FitImportReference = components["schemas"]["workout.FitImportReference"];
export type FitUploadInventory = components["schemas"]["workout.FitUploadInventory"];
export type FitBatchOutcome = components["schemas"]["workout.FitBatchOutcome"];

function fitUploadsBody(files: File[]) {
  const body = new FormData();
  files.forEach(file => body.append("files", file));
  return body;
}

export async function inspectFitUploads(files: File[]) {
  const result = await apiClient.POST("/v1/workouts/import/fit/inspect", { body: fitUploadsBody(files) as never });
  if (result.data) result.data.sources = result.data.sources.map(source => ({ ...source,
    error: source.error ? formatRequestFailure(requestIdFrom(result.response), source.error) : source.error,
    entries: source.entries.map(entry => ({ ...entry, error: entry.error ? formatRequestFailure(requestIdFrom(result.response), entry.error) : entry.error })),
  }));
  return result;
}

export async function importFitBatch(files: File[], selection: FitImportReference[], powerTargetUnit: FitPowerTargetUnit = "auto") {
  const body = fitUploadsBody(files);
  body.append("selection", JSON.stringify(selection));
  body.append("power_target_unit", powerTargetUnit);
  const result = await apiClient.POST("/v1/workouts/import/fit/batch", { body: body as never });
  if (result.data) result.data.results = result.data.results.map(item => item.status === "failed"
    ? { ...item, error: formatRequestFailure(requestIdFrom(result.response, item), item.error) } : item);
  return result;
}
