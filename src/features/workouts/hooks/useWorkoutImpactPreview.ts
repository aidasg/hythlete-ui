import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/context/useAuth";
import { useTodayDate } from "@/features/strategy/hooks/useTodayDate";
import { previewWorkoutImpact, type WorkoutRequest } from "../services/workoutApi";

export function useWorkoutImpactPreview(workout: WorkoutRequest, enabled = true) {
  const { session } = useAuth();
  const uid = session?.profile?.user_id;
  const today = useTodayDate(session?.profile?.timezone);
  const payload = JSON.stringify({ ...workout, date: workout.date || today });
  const identity = `${uid}:${today}:${payload}`;
  const [settled, setSettled] = useState("");
  const eligible = enabled && !!uid && !workout.completed;

  useEffect(() => {
    if (!eligible) return;
    const timer = window.setTimeout(() => setSettled(identity), 300);
    return () => window.clearTimeout(timer);
  }, [identity, eligible]);

  // A new key immediately hides the previous estimate, including during debounce.
  // Query cancellation and separate cache entries also isolate out-of-order responses.
  const query = useQuery({
    queryKey: ["workouts", "impact", uid, today, payload],
    enabled: eligible && settled === identity,
    queryFn: async ({ signal }) => {
      const result = await previewWorkoutImpact(JSON.parse(payload) as WorkoutRequest, signal);
      if (result.error || !result.data) throw Error("Could not estimate these areas. Check the session and retry.");
      return result.data;
    },
    retry: false,
  });
  const loading = eligible && (settled !== identity || query.isPending || query.isFetching);
  return { preview: eligible && !loading ? query.data : undefined, loading, error: eligible && settled === identity ? query.error : null, retry: query.refetch };
}
