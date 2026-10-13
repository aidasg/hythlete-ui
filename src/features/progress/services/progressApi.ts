import { apiClient } from "@/services/api/client";
import type { components } from "@/services/api/types";

export type PortfolioResponse = components["schemas"]["progress.portfolioResponse"];
export type CapabilityResponse =
  components["schemas"]["progress.capabilityResponse"];
export type MuscleStimulusResponse =
  components["schemas"]["progress.muscleStimulusResponse"];
export type MuscleGroupBalanceResponse =
  components["schemas"]["progress.muscleGroupBalanceResponse"];
export type StrengthCurveResponse =
  components["schemas"]["progress.strengthCurveResponse"];
export type RepLoadResponse = components["schemas"]["progress.repLoadResponse"];
export type BreakthroughResponse =
  components["schemas"]["progress.breakthroughResponse"];
export type BenchmarkResponse =
  components["schemas"]["progress.benchmarkResponse"];
export type BenchmarkVariantResponse =
  components["schemas"]["progress.benchmarkVariantResponse"];

export function getPortfolio(date?: string) {
  return apiClient.GET("/v1/progress/portfolio", {
    params: { query: { date } },
  });
}

export function getMuscleStimulus(date?: string) {
  return apiClient.GET("/v1/progress/muscle-stimulus", {
    params: { query: { date } },
  });
}

export function getStrengthCurve(
  exerciseCode: string,
  params: { from?: string; to?: string } = {}
) {
  return apiClient.GET("/v1/progress/strength/{exercise_code}", {
    params: {
      path: { exercise_code: exerciseCode },
      query: params,
    },
  });
}

export function listBreakthroughs(status?: string) {
  return apiClient.GET("/v1/progress/breakthroughs", {
    params: { query: { status } },
  });
}

export function updateBreakthrough(id: number, status: "accepted" | "dismissed") {
  return apiClient.PATCH("/v1/progress/breakthroughs/{id}", {
    params: { path: { id } },
    body: { status },
  });
}

export function listBenchmarks() {
  return apiClient.GET("/v1/benchmarks");
}
