import { useQuery } from "@tanstack/react-query";
import { getDailyStrategy } from "@/features/strategy/services/strategyApi";
import type { StrategyConstraints } from "@/features/strategy/services/strategyConstraints";
import { throwApiResponseError } from "@/services/api/errors";
import { queryKeys } from "@/services/query/queryKeys";

export function useDailyStrategy(
  date: string,
  constraints: StrategyConstraints,
  enabled = true,
 userID = 0
) {
  return useQuery({
    queryKey: [...queryKeys.strategy.daily(
      date,
      constraints.availableMinutes,
      constraints.allowedSports
    ), userID, constraints],
    enabled,
    queryFn: async () => {
      const result = await getDailyStrategy({
        date,
        available_minutes: constraints.availableMinutes,
        allowed_sports: constraints.allowedSports,
        activity_mode: constraints.activityMode, formats: constraints.formats, equipment: constraints.equipment, excluded_keys: constraints.excludedKeys,
      });

      if (result.error) {
        throwApiResponseError(result, "Could not load today's strategy.");
      }

      return result.data;
    },
  });
}
