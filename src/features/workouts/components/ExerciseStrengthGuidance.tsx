import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2 } from "lucide-react";
import { getStrengthCurve, type RepLoadResponse } from "@/features/progress/services/progressApi";
import { formatConfidence, formatMetric } from "@/features/progress/services/progressDisplay";
import { throwApiResponseError } from "@/services/api/errors";
import { queryKeys } from "@/services/query/queryKeys";

export function ExerciseStrengthGuidance({ exerciseCode, onApplyTarget }: { exerciseCode: string; onApplyTarget: (target: RepLoadResponse) => void }) {
  const query = useQuery({
    queryKey: queryKeys.progress.strength(exerciseCode),
    enabled: Boolean(exerciseCode),
    queryFn: async () => {
      const result = await getStrengthCurve(exerciseCode);
      if (result.error) throwApiResponseError(result, "Could not load strength guidance.");
      return result.data;
    },
  });
  if (!exerciseCode) return <div className="strength-guidance-card" data-state="empty"><span>Select an exercise to load estimated rep targets.</span></div>;
  if (query.isLoading) return <div className="strength-guidance-card"><Loader2 className="spin-icon" size={16} /><span>Loading strength guidance</span></div>;
  if (query.error) return <div className="strength-guidance-card" data-state="empty"><AlertCircle size={15} /><span>{query.error.message}</span></div>;
  const curve = query.data;
  if (!curve?.sample_count) return <div className="strength-guidance-card" data-state="empty"><strong>No calibrated load yet</strong><span>Complete externally loaded work sets to build an estimate.</span></div>;
  return <div className="strength-guidance-card"><div className="strength-guidance-summary"><div><strong>{curve.exercise_name || curve.exercise_code}</strong><span>{formatMetric(curve.current_1rm_kg, "kg")} e1RM · {formatMetric(curve.training_max_kg, "kg")} training max · {formatConfidence(curve.confidence)}</span></div><small>{curve.sample_count} work sets</small></div><div className="strength-target-actions">{curve.predicted_loads?.slice(0, 6).map((target) => <button type="button" key={target.reps} className="strength-target-chip" disabled={typeof target.reps !== "number" || typeof target.load_kg !== "number"} onClick={() => onApplyTarget(target)}>{target.reps} reps / {formatMetric(target.load_kg, "kg")}</button>)}</div></div>;
}
