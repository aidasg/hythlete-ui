import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/services/query/queryKeys";

export async function invalidateStrategyAndProgress(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.strategy.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.progress.portfolioAll }),
    queryClient.invalidateQueries({ queryKey: queryKeys.progress.muscleStimulusAll }),
    queryClient.invalidateQueries({ queryKey: queryKeys.progress.breakthroughsAll }),
  ]);
}

export async function invalidateWorkoutDerivedData(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.strategy.dailyAll }),
    queryClient.invalidateQueries({ queryKey: queryKeys.progress.portfolioAll }),
    queryClient.invalidateQueries({ queryKey: queryKeys.progress.muscleStimulusAll }),
    queryClient.invalidateQueries({ queryKey: queryKeys.progress.breakthroughsAll }),
    queryClient.invalidateQueries({ queryKey: queryKeys.progress.strengthAll }),
  ]);
}
