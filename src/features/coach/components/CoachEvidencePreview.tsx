import { throwApiResponseError } from "@/services/api/errors";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getWorkout } from "@/features/workouts/services/workoutApi";
import { SessionBlocks } from "@/features/workouts/components/SessionBlocks";
import { WorkoutTimeline } from "@/features/workouts/components/WorkoutTimeline";
import { useCoach } from "@/features/coach/context/coachContext";
import { paths } from "@/routes/paths";
export function CoachEvidencePreview({ id }: { id: number }) {
  const coach = useCoach();
  const workout = useQuery({ queryKey: ["coach", coach?.userID, "evidence", id], queryFn: async () => { const result = await getWorkout(id); if (result.error || !result.data) throwApiResponseError(result); return result.data; }, retry: false });
  return <section className="coach-source" aria-label="Coaching source workout"><button type="button" className="secondary-button" onClick={() => coach?.setPreviewID(0)}>Back to conversation</button>
    {workout.isLoading && <p role="status">Loading source workout...</p>}{workout.error && <p role="alert">{workout.error.message}</p>}
    {workout.data && <><h3>{workout.data.title || "Workout"}</h3><p>{workout.data.date} · {workout.data.duration_minutes} min · {workout.data.completed ? "Completed" : "Planned"}</p><SessionBlocks blocks={workout.data.blocks || []} /><WorkoutTimeline workout={workout.data} /><Link to={`${paths.workouts}?workout=${id}`} onClick={() => coach?.closeCoach()}>Open in Calendar</Link></>}
  </section>;
}
