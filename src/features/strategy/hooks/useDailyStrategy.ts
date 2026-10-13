import { useQuery } from "@tanstack/react-query";
import { getDailyStrategy } from "@/features/strategy/services/strategyApi";
import type { StrategyConstraints } from "@/features/strategy/services/strategyConstraints";
import { throwApiResponseError } from "@/services/api/errors";
import { queryKeys } from "@/services/query/queryKeys";

export function useDailyStrategy(
  date: string,
  constraints: StrategyConstraints,
  enabled = true
) {
  return useQuery({
    queryKey: queryKeys.strategy.daily(
      date,
      constraints.availableMinutes,
      constraints.allowedSports
    ),
    enabled,
    queryFn: async () => {
      const result = await getDailyStrategy({
        date,
        available_minutes: constraints.availableMinutes,
        allowed_sports: constraints.allowedSports,
      });

      if (result.error) {
        throwApiResponseError(result, "Could not load today's strategy.");
      }

      return result.data;
    },
  });
}
